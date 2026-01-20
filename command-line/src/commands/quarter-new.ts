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

function createEmptyQuarterStructure(dest: string): void {
  const domainsDir = path.join(dest, 'domains');
  const perspectivesDir = path.join(dest, 'perspectives');

  fs.mkdirSync(domainsDir, { recursive: true });
  fs.mkdirSync(perspectivesDir, { recursive: true });
}

export function registerQuarterNewCommand(program: Command): void {
  program
    .command('quarter:new <quarter>')
    .description('Create a new quarter directory for planning')
    .option('--empty', 'Create empty structure instead of copying from source')
    .option('--from <quarter>', 'Copy from specific quarter instead of current')
    .option('--dry-run', 'Show what would be done without making changes')
    .action(async (quarter: string, options: { empty?: boolean; from?: string; dryRun?: boolean }) => {
      const config = loadConfig();

      logger.header('Create New Quarter');

      if (!git.validateQuarterFormat(quarter)) {
        logger.error(`Invalid quarter format: ${quarter} (expected: qN-YYYY)`);
        process.exit(1);
      }

      const targetDir = path.join(config.workspacesDir, quarter);

      // Determine source
      let sourceQuarter = options.from || 'current';
      let sourceDir = path.join(config.workspacesDir, sourceQuarter);

      // Validate source if specified
      if (options.from && !git.validateQuarterFormat(options.from)) {
        logger.error(`Invalid source quarter format: ${options.from} (expected: qN-YYYY)`);
        process.exit(1);
      }

      logger.keyValue('New quarter', quarter);
      if (!options.empty) {
        logger.keyValue('Copy from', sourceQuarter);
      } else {
        logger.keyValue('Mode', 'Empty structure');
      }
      logger.blank();

      if (options.dryRun) {
        logger.info('DRY RUN - No changes will be made');
        logger.blank();
      }

      // Check if target already exists
      if (fs.existsSync(targetDir)) {
        logger.error(`Quarter directory already exists: ${targetDir}`);
        logger.blank();
        logger.info('Existing quarters:');
        const quarters = listQuarters(config);
        logger.list(quarters);
        process.exit(1);
      }

      // Check if source exists (unless creating empty)
      if (!options.empty) {
        if (!fs.existsSync(sourceDir)) {
          logger.error(`Source quarter directory does not exist: ${sourceDir}`);
          logger.blank();
          logger.info('Available quarters:');
          const quarters = listQuarters(config);
          if (quarters.length > 0) {
            logger.list(quarters);
          } else {
            logger.info('  (none)');
          }
          process.exit(1);
        }
      }

      // Create the directory
      const spinner = ora(`Creating ${quarter} directory...`).start();

      if (options.dryRun) {
        if (options.empty) {
          spinner.info(`Would create empty directory structure: ${targetDir}`);
        } else {
          spinner.info(`Would copy from ${sourceQuarter} to ${targetDir}`);
        }
      } else {
        try {
          if (options.empty) {
            createEmptyQuarterStructure(targetDir);
            spinner.succeed(`Created empty ${quarter} directory`);
          } else {
            // Resolve symlink if copying from 'current'
            const realSourceDir = fs.realpathSync(sourceDir);
            copyDirectorySync(realSourceDir, targetDir);
            spinner.succeed(`Created ${quarter} directory from ${sourceQuarter}`);
          }
        } catch (error) {
          spinner.fail('Failed to create directory');
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }

      logger.blank();
      logger.success(`Quarter ${quarter} created successfully!`);
      logger.blank();
      logger.info('Next steps:');
      logger.info(`  Edit:     Edit files in workspaces/${quarter}/`);
      logger.info(`  Validate: ./cli validate -q ${quarter}`);
      logger.info(`  Switch:   ./cli quarter:switch ${quarter}`);
    });
}
