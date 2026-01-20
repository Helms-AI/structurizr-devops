import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../lib/config';
import { validateWorkspace } from '../lib/docker';
import {
  listWorkspaces,
  workspaceExists,
  isUnifiedStructure,
  getWorkspaceDslPath,
  resolveWorkspace,
} from '../lib/workspace-registry';
import { logger } from '../lib/logger';

export function registerValidateCommand(program: Command): void {
  program
    .command('workspace:validate')
    .description('Validate the workspace DSL')
    .option('-w, --workspace <workspace>', 'Workspace to validate (default: current)', 'current')
    .option('--list', 'List available workspaces')
    .action(async (options?: { workspace?: string; list?: boolean }) => {
      const config = loadConfig();

      // List workspaces mode
      if (options?.list) {
        logger.header('Available Workspaces');
        const workspaces = listWorkspaces(config);
        if (workspaces.length === 0) {
          logger.warn('No workspaces found');
        } else {
          for (const ws of workspaces) {
            const unified = isUnifiedStructure(config, ws);
            const indicator = unified ? '(unified)' : '(legacy)';
            logger.info(`  ${ws} ${indicator}`);
          }
        }
        return;
      }

      let workspace: string;
      try {
        workspace = resolveWorkspace(config, options?.workspace || 'current');
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      logger.header('Structurizr Workspace Validation');
      logger.keyValue('Workspace', workspace);
      logger.blank();

      // Check if workspace exists
      if (!workspaceExists(config, workspace)) {
        logger.error(`Workspace '${workspace}' not found`);
        logger.blank();
        const workspaces = listWorkspaces(config);
        if (workspaces.length > 0) {
          logger.info('Available workspaces:');
          logger.list(workspaces);
        }
        process.exit(1);
      }

      // Check structure type
      const isUnified = isUnifiedStructure(config, workspace);
      if (!isUnified) {
        logger.warn(`Workspace '${workspace}' uses legacy structure.`);
        logger.info('Consider migrating to the unified workspace structure.');
        logger.blank();
        // For legacy structure, suggest using the old command pattern
        logger.info('For legacy validation, use the domain-specific pattern.');
        process.exit(1);
      }

      // Validate the unified workspace
      const workspacePath = getWorkspaceDslPath(config, workspace);
      logger.info(`Validating workspace: ${workspacePath}`);
      logger.blank();

      const spinner = ora(`Validating ${workspace} workspace...`).start();

      try {
        const valid = await validateWorkspace(config, workspacePath);
        if (valid) {
          spinner.succeed(`${workspace}: VALID`);
          logger.blank();
          logger.success('Workspace validated successfully!');
        } else {
          spinner.fail(`${workspace}: INVALID`);
          logger.blank();
          logger.error('Workspace validation failed');
          process.exit(1);
        }
      } catch (error) {
        spinner.fail(`${workspace}: ERROR`);
        logger.blank();
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

}
