import { Command } from 'commander';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../lib/config';
import { listQuarters } from '../lib/domains';
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

export function registerQuarterSwitchCommand(program: Command): void {
  program
    .command('quarter:switch <quarter>')
    .description('Switch current symlink to a different quarter')
    .option('--create', 'Create quarter directory if it does not exist (copies from current)')
    .option('--dry-run', 'Show what would be done without making changes')
    .action(async (quarter: string, options: { create?: boolean; dryRun?: boolean }) => {
      const config = loadConfig();

      logger.header('Quarter Switch');

      if (!git.validateQuarterFormat(quarter)) {
        logger.error(`Invalid quarter format: ${quarter} (expected: qN-YYYY)`);
        process.exit(1);
      }

      const currentSymlink = path.join(config.workspacesDir, 'current');
      const targetDir = path.join(config.workspacesDir, quarter);

      // Get current symlink target for display
      let currentTarget = 'none';
      try {
        if (fs.existsSync(currentSymlink)) {
          const linkTarget = fs.readlinkSync(currentSymlink);
          currentTarget = path.basename(linkTarget);
        }
      } catch {
        // Ignore errors reading symlink
      }

      logger.keyValue('Current quarter', currentTarget);
      logger.keyValue('Target quarter', quarter);
      logger.blank();

      if (options.dryRun) {
        logger.info('DRY RUN - No changes will be made');
        logger.blank();
      }

      // Check if target quarter exists
      if (!fs.existsSync(targetDir)) {
        if (options.create) {
          const spinner = ora(`Creating ${quarter} directory...`).start();

          if (options.dryRun) {
            spinner.info(`Would create directory: ${targetDir}`);
          } else {
            try {
              // Copy from current
              const realSourceDir = fs.realpathSync(currentSymlink);
              copyDirectorySync(realSourceDir, targetDir);
              spinner.succeed(`Created ${quarter} directory from current`);
            } catch (error) {
              spinner.fail('Failed to create directory');
              logger.error(error instanceof Error ? error.message : String(error));
              process.exit(1);
            }
          }
          logger.blank();
        } else {
          logger.error(`Quarter directory does not exist: ${targetDir}`);
          logger.blank();
          logger.info('Available quarters:');
          const quarters = listQuarters(config);
          if (quarters.length > 0) {
            logger.list(quarters);
          } else {
            logger.info('  (none)');
          }
          logger.blank();
          logger.info('Use --create to create the quarter directory');
          process.exit(1);
        }
      }

      // Update symlink
      const spinner = ora('Updating current symlink...').start();

      if (options.dryRun) {
        spinner.info(`Would update symlink: current -> ${quarter}`);
      } else {
        try {
          // Remove existing symlink if it exists
          if (fs.existsSync(currentSymlink)) {
            fs.unlinkSync(currentSymlink);
          }

          // Create new symlink (relative path)
          fs.symlinkSync(quarter, currentSymlink);
          spinner.succeed(`Updated symlink: current -> ${quarter}`);
        } catch (error) {
          spinner.fail('Failed to update symlink');
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }

      logger.blank();
      logger.success(`Switched to quarter ${quarter}`);
      logger.blank();
      logger.info('Next steps:');
      logger.info(`  Validate: ./cli validate`);
      logger.info(`  Promote:  ./cli promote --all`);
    });
}
