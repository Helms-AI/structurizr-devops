import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../lib/config';
import { validateWorkspace } from '../lib/docker';
import {
  listAllWorkspaces,
  workspaceExists,
  detectWorkspaceType,
  getWorkspacePath,
} from '../lib/domains';
import { logger } from '../lib/logger';
import type { WorkspaceType } from '../types';

export function registerValidateCommand(program: Command): void {
  program
    .command('workspace:validate [workspace]')
    .description('Validate workspace(s) DSL')
    .option('-q, --quarter <quarter>', 'Quarter to validate (default: current)', 'current')
    .option('-t, --type <type>', 'Workspace type: domain or perspective (auto-detected if not specified)')
    .option('--all', 'Validate all workspaces (domains and perspectives)')
    .action(async (workspace?: string, options?: { quarter?: string; type?: string; all?: boolean }) => {
      const config = loadConfig();
      const quarter = options?.quarter || 'current';

      logger.header('Structurizr Workspace Validation');
      logger.keyValue('Quarter', quarter);
      logger.blank();

      interface WorkspaceToValidate {
        name: string;
        type: WorkspaceType;
        path: string;
      }

      const workspacesToValidate: WorkspaceToValidate[] = [];

      if (workspace) {
        // Single workspace validation
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

        workspacesToValidate.push({
          name: workspace,
          type,
          path: getWorkspacePath(config, workspace, type, quarter),
        });
      } else {
        // Validate all workspaces
        const allWorkspaces = listAllWorkspaces(config, quarter);
        if (allWorkspaces.length === 0) {
          logger.error(`No workspaces found in quarter '${quarter}'`);
          process.exit(1);
        }

        for (const w of allWorkspaces) {
          workspacesToValidate.push({
            name: w.name,
            type: w.type,
            path: w.path,
          });
        }
      }

      logger.info(`Validating ${workspacesToValidate.length} workspace(s)...`);
      logger.blank();

      let passed = 0;
      let failed = 0;

      for (const w of workspacesToValidate) {
        const label = `${w.name} (${w.type})`;
        const spinner = ora(`Validating ${label}...`).start();

        try {
          const valid = await validateWorkspace(config, w.path);
          if (valid) {
            spinner.succeed(`${label}: VALID`);
            passed++;
          } else {
            spinner.fail(`${label}: INVALID`);
            failed++;
          }
        } catch (error) {
          spinner.fail(`${label}: ERROR`);
          logger.error(error instanceof Error ? error.message : String(error));
          failed++;
        }

        logger.blank();
      }

      logger.header('Validation Summary');
      logger.keyValue('Total', String(workspacesToValidate.length));
      logger.keyValue('Passed', String(passed));
      logger.keyValue('Failed', String(failed));
      logger.blank();

      if (failed > 0) {
        logger.error('Some workspaces failed validation');
        process.exit(1);
      } else {
        logger.success('All workspaces validated successfully!');
      }
    });
}
