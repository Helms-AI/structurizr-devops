import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';
import { loadConfig, getWorkspaceCredentials } from '../lib/config';
import { listWorkspaces, saveRegistry, loadRegistry, resolveWorkspace, getWorkspaceDslPath, workspaceExists } from '../lib/workspace-registry';
import { logger } from '../lib/logger';
import { composeDownWithVolumes, composeUp } from '../lib/compose';
import { createAdminClient, isNotFoundError } from '../lib/structurizr';
import { pushWorkspace } from '../lib/docker';
import { setEnvValue, getEnvFilePath } from '../lib/dotenv';

export function registerSystemDataResetCommand(program: Command): void {
  program
    .command('system:data:reset')
    .description('Reset registry and delete all workspaces (preserves shared directory)')
    .option('--dry-run', 'Show what would be deleted without making changes')
    .option('--force', 'Skip confirmation prompt')
    .action(async (options?: { dryRun?: boolean; force?: boolean }) => {
      const config = loadConfig();

      // Validate required environment variables early
      const missingVars: string[] = [];
      if (!config.structurizrUrl) {
        missingVars.push('STRUCTURIZR_URL');
      }
      if (!config.adminApiKey) {
        missingVars.push('STRUCTURIZR_ADMIN_API_KEY');
      }
      if (missingVars.length > 0) {
        logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
        logger.info('These are required to demote workspaces from On-Premises');
        logger.info('Set them in containers/.env or as environment variables');
        process.exit(1);
      }

      logger.header('System Data Reset');
      logger.blank();

      // Get list of workspaces to delete
      const workspaces = listWorkspaces(config);
      const workspacesDir = config.workspacesDir;

      // Find all directories in workspaces folder (except shared)
      let directories: string[] = [];
      try {
        const entries = fs.readdirSync(workspacesDir, { withFileTypes: true });
        directories = entries
          .filter((e) => e.isDirectory() && e.name !== 'shared')
          .map((e) => e.name);
      } catch {
        logger.warn('Could not read workspaces directory');
      }

      if (directories.length === 0) {
        logger.info('No workspace directories to delete');
        logger.success('System is already clean');
        return;
      }

      // Show what will be deleted
      logger.subheader('Directories to delete');
      for (const dir of directories) {
        const fullPath = path.join(workspacesDir, dir);
        logger.info(`  ${dir}/ (${fullPath})`);
      }
      logger.blank();

      logger.subheader('Registry changes');
      logger.info('  - Reset current_workspace to null');
      logger.info('  - Clear all workspace entries');
      logger.info('  - Preserve lite_port setting');
      logger.blank();

      if (options?.dryRun) {
        logger.warn('DRY RUN - No changes made');
        return;
      }

      // Confirm unless --force
      if (!options?.force) {
        logger.warn('This will permanently delete all workspace data!');
        logger.info('Use --force to skip this confirmation');
        logger.blank();

        // Use readline for confirmation
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question('Type "RESET" to confirm: ', resolve);
        });
        rl.close();

        if (answer !== 'RESET') {
          logger.error('Aborted - confirmation not received');
          process.exit(1);
        }
        logger.blank();
      }

      // Demote workspaces from On-Premises before deleting locally
      let demoted = 0;
      let demoteFailed = 0;
      const registry = loadRegistry(config);

      logger.subheader('Demoting workspaces from On-Premises');

      const adminClient = createAdminClient({
        baseUrl: config.structurizrUrl.replace(/\/api\/?$/, ''),
        adminApiKey: config.adminApiKey,
      });

      // Demote workspaces with their own workspace_id
      if (registry?.workspaces) {
        for (const [name, info] of Object.entries(registry.workspaces)) {
          const wsInfo = info as { workspace_id?: number };
          if (wsInfo.workspace_id) {
            const spinner = ora(`Demoting ${name} (ID: ${wsInfo.workspace_id})...`).start();
            try {
              await adminClient.deleteWorkspace(wsInfo.workspace_id);
              spinner.succeed(`Demoted ${name}`);
              demoted++;
            } catch (error) {
              if (isNotFoundError(error)) {
                spinner.succeed(`${name} already removed from On-Premises`);
                demoted++;
              } else {
                spinner.warn(`Failed to demote ${name}: ${error instanceof Error ? error.message : String(error)}`);
                demoteFailed++;
              }
            }
          }
        }
      }

      // Also check for root workspace_id (legacy)
      if (registry?.workspace_id) {
        const spinner = ora(`Demoting root workspace (ID: ${registry.workspace_id})...`).start();
        try {
          await adminClient.deleteWorkspace(registry.workspace_id);
          spinner.succeed('Demoted root workspace');
          demoted++;
        } catch (error) {
          if (isNotFoundError(error)) {
            spinner.succeed('Root workspace already removed from On-Premises');
            demoted++;
          } else {
            spinner.warn(`Failed to demote root workspace: ${error instanceof Error ? error.message : String(error)}`);
            demoteFailed++;
          }
        }
      }

      logger.blank();

      // Delete workspace directories
      const deleteSpinner = ora('Deleting workspace directories...').start();
      let deleted = 0;
      let failed = 0;

      for (const dir of directories) {
        const fullPath = path.join(workspacesDir, dir);
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
          deleted++;
        } catch (error) {
          logger.warn(`Failed to delete ${dir}: ${error instanceof Error ? error.message : String(error)}`);
          failed++;
        }
      }

      if (failed > 0) {
        deleteSpinner.warn(`Deleted ${deleted} directories, ${failed} failed`);
      } else {
        deleteSpinner.succeed(`Deleted ${deleted} workspace directories`);
      }

      // Reset registry
      const registrySpinner = ora('Resetting registry...').start();
      try {
        if (registry) {
          // Preserve lite_port, reset everything else
          const newRegistry = {
            lite_port: registry.lite_port || 20100,
            current_workspace: null as unknown as string,
            workspaces: {},
          };
          saveRegistry(config, newRegistry);
          registrySpinner.succeed('Registry reset');
        } else {
          registrySpinner.fail('Could not load registry');
        }
      } catch (error) {
        registrySpinner.fail(`Failed to reset registry: ${error instanceof Error ? error.message : String(error)}`);
      }

      logger.blank();
      logger.header('Summary');
      if (demoted > 0 || demoteFailed > 0) {
        logger.keyValue('Workspaces demoted', String(demoted));
        if (demoteFailed > 0) {
          logger.keyValue('Demotion failures', String(demoteFailed));
        }
      }
      logger.keyValue('Directories deleted', String(deleted));
      logger.keyValue('Directories failed', String(failed));
      logger.keyValue('Registry', 'Reset');
      logger.blank();

      if (failed === 0 && demoteFailed === 0) {
        logger.success('System data reset complete!');
        logger.blank();
        logger.info('Next steps:');
        logger.info('  Create a new workspace: ./cli workspace:create q1-2026');
      } else {
        logger.warn('Reset completed with errors');
        process.exit(1);
      }
    });
}
