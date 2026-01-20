import { Command } from 'commander';
import ora from 'ora';
import { loadConfig, getDomainCredentials } from '../lib/config';
import {
  validateWorkspace,
  pushWorkspace,
  translateUrlForContainer,
} from '../lib/docker';
import {
  listAllWorkspaces,
  workspaceExists,
  detectWorkspaceType,
  getWorkspacePath,
  getWorkspaceId,
} from '../lib/domains';
import { logger } from '../lib/logger';
import type { WorkspaceType } from '../types';
import { normalizeEnvironment } from '../types';

export function registerPromoteCommand(program: Command): void {
  program
    .command('workspace:promote [workspace]')
    .description('Promote workspace(s) to Structurizr On-Premises')
    .option('-q, --quarter <quarter>', 'Quarter to promote (default: current)', 'current')
    .option('-t, --type <type>', 'Workspace type: domain or perspective (auto-detected if not specified)')
    .option('-e, --environment <env>', 'Target environment: Local, Integration, or Production', 'Local')
    .option('--validate', 'Run DSL validation before promotion')
    .option('-i, --workspace-id <id>', 'Workspace ID (overrides registry)')
    .option('--all', 'Promote all workspaces in the quarter')
    .option('--dry-run', 'Show what would be promoted without making changes')
    .action(async (workspace?: string, options?: {
      quarter?: string;
      type?: string;
      environment?: string;
      validate?: boolean;
      workspaceId?: string;
      all?: boolean;
      dryRun?: boolean;
    }) => {
      const config = loadConfig();
      const quarter = options?.quarter || 'current';

      // Normalize environment (case-insensitive)
      let environment;
      try {
        environment = normalizeEnvironment(options?.environment || 'Local');
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      logger.header('Structurizr Workspace Promotion');
      logger.keyValue('Quarter', quarter);
      logger.keyValue('Environment', environment);
      logger.blank();

      // URL comes from STRUCTURIZR_URL environment variable
      // For Local: defaults to http://localhost:20000/api
      // For Integration/Production: provided via GitHub Actions environment
      const targetUrl = config.structurizrUrl;

      if (!targetUrl) {
        logger.error(`No URL configured for environment '${environment}'`);
        logger.info('Set STRUCTURIZR_URL in environment');
        process.exit(1);
      }

      interface WorkspaceToPromote {
        name: string;
        type: WorkspaceType;
        path: string;
        workspaceId: string;
      }

      const workspacesToPromote: WorkspaceToPromote[] = [];

      if (workspace && !options?.all) {
        // Single workspace promotion
        let type = options?.type as WorkspaceType | undefined;
        if (!type) {
          const detected = detectWorkspaceType(config, workspace, quarter);
          type = detected || undefined;
          if (!type) {
            logger.error(`Workspace '${workspace}' not found in quarter '${quarter}'`);
            logger.blank();
            const allWorkspaces = listAllWorkspaces(config, quarter);
            if (allWorkspaces.length > 0) {
              logger.info('Available workspaces:');
              logger.list(allWorkspaces.map((w) => `${w.name} (${w.type})`));
            }
            process.exit(1);
          }
        }

        if (!workspaceExists(config, workspace, type, quarter)) {
          logger.error(`Workspace '${workspace}' (${type}) not found in quarter '${quarter}'`);
          process.exit(1);
        }

        // Get workspace ID
        const wsId = options?.workspaceId || String(getWorkspaceId(config, workspace, type) || '');
        if (!wsId) {
          logger.error(`No workspace ID found for '${workspace}'. Set workspace_id in domains.yaml or use --workspace-id`);
          process.exit(1);
        }

        workspacesToPromote.push({
          name: workspace,
          type,
          path: getWorkspacePath(config, workspace, type, quarter),
          workspaceId: wsId,
        });
      } else {
        // Promote all workspaces
        const allWorkspaces = listAllWorkspaces(config, quarter);
        if (allWorkspaces.length === 0) {
          logger.error(`No workspaces found in quarter '${quarter}'`);
          process.exit(1);
        }

        for (const w of allWorkspaces) {
          if (!w.workspaceId) {
            logger.warn(`Skipping ${w.name} - no workspace_id configured in domains.yaml`);
            continue;
          }
          workspacesToPromote.push({
            name: w.name,
            type: w.type,
            path: w.path,
            workspaceId: String(w.workspaceId),
          });
        }

        if (workspacesToPromote.length === 0) {
          logger.error('No workspaces have workspace_id configured');
          process.exit(1);
        }
      }

      if (options?.dryRun) {
        logger.info('DRY RUN - No changes will be made');
        logger.blank();
        logger.subheader('Workspaces to promote:');
        for (const w of workspacesToPromote) {
          logger.info(`  ${w.name} (${w.type}) -> workspace ${w.workspaceId}`);
        }
        logger.blank();
        return;
      }

      // Validation phase
      if (options?.validate) {
        logger.subheader('Validation Phase');
        for (const w of workspacesToPromote) {
          const spinner = ora(`Validating ${w.name}...`).start();
          try {
            const valid = await validateWorkspace(config, w.path);
            if (valid) {
              spinner.succeed(`${w.name}: VALID`);
            } else {
              spinner.fail(`${w.name}: INVALID`);
              logger.error('Validation failed. Aborting promotion.');
              process.exit(1);
            }
          } catch (error) {
            spinner.fail(`${w.name}: ERROR`);
            logger.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
          }
        }
        logger.blank();
      }

      // Promotion phase
      logger.subheader('Promotion Phase');
      logger.keyValue('Target URL', translateUrlForContainer(targetUrl));
      logger.blank();

      let promoted = 0;
      let failed = 0;
      const results: Array<{ name: string; success: boolean; error?: string }> = [];

      for (const w of workspacesToPromote) {
        const credentials = getDomainCredentials(w.name, environment);

        if (!credentials.workspaceKey) {
          logger.warn(`Skipping ${w.name} - missing workspace key`);
          results.push({ name: w.name, success: false, error: 'Missing workspace key' });
          failed++;
          continue;
        }

        if (!credentials.workspaceSecret) {
          logger.warn(`Skipping ${w.name} - missing workspace secret`);
          results.push({ name: w.name, success: false, error: 'Missing workspace secret' });
          failed++;
          continue;
        }

        const spinner = ora(`Promoting ${w.name} (${w.type})...`).start();

        try {
          const success = await pushWorkspace(
            config,
            w.path,
            targetUrl,
            w.workspaceId,
            credentials.workspaceKey,
            credentials.workspaceSecret
          );

          if (success) {
            spinner.succeed(`${w.name}: PROMOTED`);
            results.push({ name: w.name, success: true });
            promoted++;
          } else {
            spinner.fail(`${w.name}: FAILED`);
            results.push({ name: w.name, success: false, error: 'Push failed' });
            failed++;
          }
        } catch (error) {
          spinner.fail(`${w.name}: ERROR`);
          const errorMsg = error instanceof Error ? error.message : String(error);
          results.push({ name: w.name, success: false, error: errorMsg });
          logger.error(errorMsg);
          failed++;
        }

        logger.blank();
      }

      // Summary
      logger.header('Promotion Summary');
      logger.keyValue('Total', String(workspacesToPromote.length));
      logger.keyValue('Promoted', String(promoted));
      logger.keyValue('Failed', String(failed));
      logger.blank();

      if (failed > 0) {
        logger.subheader('Failed Workspaces');
        for (const result of results.filter((r) => !r.success)) {
          logger.error(`${result.name}: ${result.error}`);
        }
        logger.blank();
      }

      if (promoted > 0) {
        logger.subheader('Access Workspaces');
        const baseUrl = targetUrl.replace('/api', '');
        for (const result of results.filter((r) => r.success)) {
          const w = workspacesToPromote.find((ws) => ws.name === result.name);
          if (w) {
            logger.info(`  ${w.name}: ${baseUrl}/workspace/${w.workspaceId}`);
          }
        }
        logger.blank();
      }

      if (failed > 0) {
        process.exit(1);
      } else {
        logger.success('All workspaces promoted successfully!');
      }
    });
}
