import { Command } from 'commander';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../lib/config';
import { listAllWorkspaces } from '../lib/domains';
import { logger } from '../lib/logger';
import * as git from '../lib/git';

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
    .description('Create quarterly snapshot with git tag')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--tag', 'Create git tag {quarter}-final (default: true)', true)
    .option('--no-tag', 'Skip git tag creation')
    .action(async (quarter: string, options: { dryRun?: boolean; tag?: boolean }) => {
      const config = loadConfig();

      logger.header('Quarterly Snapshot');

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

      // Phase 2: Git Tag
      if (options.tag !== false) {
        logger.subheader('Phase 2: Git Tag');
        const tagName = `${quarter}-final`;

        const tagSpinner = ora(`Checking for existing tag ${tagName}...`).start();

        if (await git.tagExists(tagName)) {
          tagSpinner.warn(`Tag ${tagName} already exists, skipping tag creation`);
          results.push({ task: 'Git tag', success: true });
        } else {
          if (options.dryRun) {
            tagSpinner.info(`Would create tag: ${tagName}`);
            results.push({ task: 'Git tag', success: true });
          } else {
            try {
              await git.createTag(tagName, `Quarterly architecture snapshot: ${quarter}`);
              tagSpinner.succeed(`Created tag: ${tagName}`);
              results.push({ task: 'Git tag', success: true });
            } catch (error) {
              tagSpinner.fail('Failed to create git tag');
              const errorMsg = error instanceof Error ? error.message : String(error);
              logger.error(errorMsg);
              results.push({ task: 'Git tag', success: false, error: errorMsg });
            }
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

      if (results.some((r) => r.task === 'Directory snapshot' && r.success)) {
        logger.subheader('Access Archived Quarter');
        logger.info(`Directory: workspaces/${quarter}/`);
        logger.info(`Validate:  ./cli validate -q ${quarter}`);
        logger.info(`Promote:   ./cli promote --all -q ${quarter}`);
        logger.blank();
      }

      if (options.tag !== false && results.some((r) => r.task === 'Git tag' && r.success)) {
        logger.subheader('Git Tag');
        logger.info(`Tag: ${quarter}-final`);
        logger.info(`Push: git push origin ${quarter}-final`);
        logger.blank();
      }

      if (failed.length > 0) {
        process.exit(1);
      } else {
        logger.success(`Quarter ${quarter} snapshot created successfully!`);
      }
    });
}
