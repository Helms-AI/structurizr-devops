import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../lib/config';
import { validateWorkspace } from '../lib/docker';
import {
  listQuarters,
  quarterExists,
  isUnifiedStructure,
  getWorkspacePath,
} from '../lib/quarters';
import { logger } from '../lib/logger';

export function registerValidateCommand(program: Command): void {
  program
    .command('workspace:validate')
    .description('Validate the workspace DSL for a quarter')
    .option('-q, --quarter <quarter>', 'Quarter to validate (default: current)', 'current')
    .option('--list-quarters', 'List available quarters')
    .action(async (options?: { quarter?: string; listQuarters?: boolean }) => {
      const config = loadConfig();

      // List quarters mode
      if (options?.listQuarters) {
        logger.header('Available Quarters');
        const quarters = listQuarters(config);
        if (quarters.length === 0) {
          logger.warn('No quarters found');
        } else {
          for (const q of quarters) {
            const unified = isUnifiedStructure(config, q);
            const indicator = unified ? '(unified)' : '(legacy)';
            logger.info(`  ${q} ${indicator}`);
          }
        }
        return;
      }

      const quarter = options?.quarter || 'current';

      logger.header('Structurizr Workspace Validation');
      logger.keyValue('Quarter', quarter);
      logger.blank();

      // Check if quarter exists
      if (!quarterExists(config, quarter)) {
        logger.error(`Quarter '${quarter}' not found`);
        logger.blank();
        const quarters = listQuarters(config);
        if (quarters.length > 0) {
          logger.info('Available quarters:');
          logger.list(quarters);
        }
        process.exit(1);
      }

      // Check structure type
      const isUnified = isUnifiedStructure(config, quarter);
      if (!isUnified) {
        logger.warn(`Quarter '${quarter}' uses legacy structure.`);
        logger.info('Consider migrating to the unified workspace structure.');
        logger.blank();
        // For legacy structure, suggest using the old command pattern
        logger.info('For legacy validation, use the domain-specific pattern.');
        process.exit(1);
      }

      // Validate the unified workspace
      const workspacePath = getWorkspacePath(config, quarter);
      logger.info(`Validating workspace: ${workspacePath}`);
      logger.blank();

      const spinner = ora(`Validating ${quarter} workspace...`).start();

      try {
        const valid = await validateWorkspace(config, workspacePath);
        if (valid) {
          spinner.succeed(`${quarter}: VALID`);
          logger.blank();
          logger.success('Workspace validated successfully!');
        } else {
          spinner.fail(`${quarter}: INVALID`);
          logger.blank();
          logger.error('Workspace validation failed');
          process.exit(1);
        }
      } catch (error) {
        spinner.fail(`${quarter}: ERROR`);
        logger.blank();
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

}
