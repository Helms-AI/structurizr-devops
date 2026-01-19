import { Command } from 'commander';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, getDomainCredentials } from '../lib/config';
import { listAllWorkspaces, loadDomainsRegistry } from '../lib/domains';
import { logger } from '../lib/logger';
import * as git from '../lib/git';

async function createWorkspaceBranch(
  url: string,
  workspaceId: string,
  key: string,
  secret: string,
  branchName: string
): Promise<boolean> {
  const baseUrl = url.replace('/api', '');
  const endpoint = `${baseUrl}/api/workspace/${workspaceId}/branch`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-Authorization': `${key}:${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: branchName }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return true;
  } catch (error) {
    logger.error(
      `Failed to create branch: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

function copyDirectorySync(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Skip .structurizr directories (Lite cache)
      if (entry.name === '.structurizr') {
        continue;
      }
      copyDirectorySync(srcPath, destPath);
    } else {
      // Skip temporary files
      if (entry.name.endsWith('.dsl.dsl') || entry.name.endsWith('.dsl.json')) {
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function registerQuarterSnapshotCommand(program: Command): void {
  program
    .command('quarter:snapshot <quarter>')
    .description('Create quarterly workspace snapshot')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--create-branches', 'Also create workspace branches on Structurizr On-Premises')
    .option('--skip-directory', 'Skip creating directory copy (only create workspace branches)')
    .action(async (quarter: string, options: { dryRun?: boolean; createBranches?: boolean; skipDirectory?: boolean }) => {
      const config = loadConfig();

      logger.header('Quarterly Workspace Snapshot');

      if (!git.validateQuarterFormat(quarter)) {
        logger.error(`Invalid quarter format: ${quarter} (expected: qN-YYYY)`);
        process.exit(1);
      }

      const workspaces = listAllWorkspaces(config, 'current');

      if (workspaces.length === 0) {
        logger.error('No workspaces found in current quarter');
        process.exit(1);
      }

      logger.keyValue('Quarter', quarter);
      logger.keyValue('Workspaces', String(workspaces.length));
      logger.blank();

      if (options.dryRun) {
        logger.info('DRY RUN - No changes will be made');
        logger.blank();
      }

      const results: Array<{ task: string; success: boolean; error?: string }> = [];

      // Phase 1: Create directory snapshot
      if (!options.skipDirectory) {
        logger.subheader('Phase 1: Directory Snapshot');

        const sourceDir = path.join(config.workspacesDir, 'current');
        const targetDir = path.join(config.workspacesDir, quarter);

        if (fs.existsSync(targetDir)) {
          logger.warn(`Quarter directory already exists: ${targetDir}`);
          logger.info('Skipping directory creation (use a different quarter name or remove existing directory)');
          results.push({ task: 'Directory snapshot', success: false, error: 'Directory already exists' });
        } else {
          const spinner = ora(`Creating ${quarter} directory...`).start();

          if (options.dryRun) {
            spinner.info(`Would create directory: ${targetDir}`);
            results.push({ task: 'Directory snapshot', success: true });
          } else {
            try {
              // Resolve symlink to actual directory
              const realSourceDir = fs.realpathSync(sourceDir);
              copyDirectorySync(realSourceDir, targetDir);
              spinner.succeed(`Created ${quarter} directory`);
              results.push({ task: 'Directory snapshot', success: true });
            } catch (error) {
              spinner.fail('Failed to create directory');
              const errorMsg = error instanceof Error ? error.message : String(error);
              logger.error(errorMsg);
              results.push({ task: 'Directory snapshot', success: false, error: errorMsg });
            }
          }
        }
        logger.blank();
      }

      // Phase 2: Create workspace branches on Structurizr
      if (options.createBranches) {
        logger.subheader('Phase 2: Workspace Branches');
        logger.keyValue('URL', config.structurizrUrl);
        logger.blank();

        for (const workspace of workspaces) {
          if (!workspace.workspaceId) {
            logger.warn(`Skipping ${workspace.name} - no workspace_id configured`);
            results.push({
              task: `Branch for ${workspace.name}`,
              success: false,
              error: 'Missing workspace_id',
            });
            continue;
          }

          const credentials = getDomainCredentials(workspace.name);

          if (!credentials.workspaceKey || !credentials.workspaceSecret) {
            logger.warn(`Skipping ${workspace.name} - missing credentials`);
            results.push({
              task: `Branch for ${workspace.name}`,
              success: false,
              error: 'Missing credentials',
            });
            continue;
          }

          const spinner = ora(`Creating branch '${quarter}' for ${workspace.name}...`).start();

          if (options.dryRun) {
            spinner.info(`Would create branch '${quarter}' for ${workspace.name} (workspace ${workspace.workspaceId})`);
            results.push({ task: `Branch for ${workspace.name}`, success: true });
            continue;
          }

          try {
            const success = await createWorkspaceBranch(
              config.structurizrUrl,
              String(workspace.workspaceId),
              credentials.workspaceKey,
              credentials.workspaceSecret,
              quarter
            );

            if (success) {
              spinner.succeed(`Created branch '${quarter}' for ${workspace.name}`);
              results.push({ task: `Branch for ${workspace.name}`, success: true });
            } else {
              spinner.fail(`Failed to create branch for ${workspace.name}`);
              results.push({
                task: `Branch for ${workspace.name}`,
                success: false,
                error: 'API call failed',
              });
            }
          } catch (error) {
            spinner.fail(`Error creating branch for ${workspace.name}`);
            results.push({
              task: `Branch for ${workspace.name}`,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        logger.blank();
      }

      // Summary
      logger.header('Snapshot Summary');

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      logger.keyValue('Total tasks', String(results.length));
      logger.keyValue('Successful', String(successful.length));
      logger.keyValue('Failed', String(failed.length));
      logger.blank();

      if (failed.length > 0) {
        logger.subheader('Failed Tasks');
        for (const result of failed) {
          logger.error(`${result.task}: ${result.error}`);
        }
        logger.blank();
      }

      if (!options.skipDirectory && results.some((r) => r.task === 'Directory snapshot' && r.success)) {
        logger.subheader('Access Archived Quarter');
        logger.info(`Directory: workspaces/${quarter}/`);
        logger.info(`Validate:  ./cli validate --quarter ${quarter}`);
        logger.info(`Promote:   ./cli promote --all --quarter ${quarter}`);
        logger.blank();
      }

      if (options.createBranches && successful.some((r) => r.task.startsWith('Branch for'))) {
        logger.subheader('Access Workspace Branches');
        logger.info(`Structurizr: Navigate to workspace and select branch '${quarter}'`);
        logger.blank();
      }

      if (failed.length > 0) {
        process.exit(1);
      } else {
        logger.success(`Quarter ${quarter} snapshot created successfully!`);
      }
    });
}
