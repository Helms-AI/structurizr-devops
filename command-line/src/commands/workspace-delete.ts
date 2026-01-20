import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../lib/config';
import {
  loadRegistry,
  listWorkspaces,
  workspaceExists,
  saveRegistry,
} from '../lib/workspace-registry';
import { logger } from '../lib/logger';
import { createAdminClient, isStructurizrApiError, isNotFoundError } from '../lib/structurizr';

/**
 * Delete a workspace from Structurizr On-Premises via Admin API
 */
async function deleteWorkspaceViaApi(
  baseUrl: string,
  workspaceId: number,
  adminApiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient({
      baseUrl: baseUrl.replace(/\/api\/?$/, ''),
      adminApiKey,
    });

    await adminClient.deleteWorkspace(workspaceId);
    return { success: true };
  } catch (error) {
    if (isNotFoundError(error)) {
      // Workspace already deleted - treat as success
      return { success: true };
    }
    if (isStructurizrApiError(error)) {
      return {
        success: false,
        error: `API Error (${error.statusCode}): ${error.message}`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function registerWorkspaceDeleteCommand(program: Command): void {
  program
    .command('workspace:delete [workspace]')
    .description('Delete a workspace from Structurizr and remove from registry')
    .option('--all', 'Delete all workspaces')
    .option('--dry-run', 'Show what would be deleted without making changes')
    .option('--keep-files', 'Keep the local workspace files (only delete from server)')
    .action(async (workspace?: string, options?: {
      all?: boolean;
      dryRun?: boolean;
      keepFiles?: boolean;
    }) => {
      const config = loadConfig();

      logger.header('Workspace Deletion');
      logger.blank();

      // Validate workspace argument
      if (!workspace && !options?.all) {
        logger.error('Please specify a workspace name or use --all');
        process.exit(1);
      }

      // Get admin API key
      const adminApiKey = config.adminApiKey;
      if (!adminApiKey && !options?.dryRun) {
        logger.error('No STRUCTURIZR_ADMIN_API_KEY configured');
        logger.info('Set it in containers/.env');
        process.exit(1);
      }

      const registry = loadRegistry(config);
      if (!registry) {
        logger.error('Could not load registry.yaml');
        process.exit(1);
      }

      interface WorkspaceToDelete {
        name: string;
        workspaceId: number;
      }

      const workspacesToDelete: WorkspaceToDelete[] = [];

      if (workspace && !options?.all) {
        // Single workspace deletion
        if (!workspaceExists(config, workspace)) {
          logger.error(`Workspace '${workspace}' not found`);
          const allWorkspaces = listWorkspaces(config);
          if (allWorkspaces.length > 0) {
            logger.blank();
            logger.info('Available workspaces:');
            logger.list(allWorkspaces);
          }
          process.exit(1);
        }

        const workspaceDef = registry.workspaces?.[workspace];
        if (!workspaceDef?.workspace_id) {
          logger.error(`Workspace '${workspace}' has no workspace_id in registry`);
          process.exit(1);
        }

        workspacesToDelete.push({
          name: workspace,
          workspaceId: workspaceDef.workspace_id,
        });
      } else {
        // Delete all workspaces
        const allWorkspaces = listWorkspaces(config);
        if (allWorkspaces.length === 0) {
          logger.warn('No workspaces found');
          return;
        }

        for (const w of allWorkspaces) {
          const workspaceDef = registry.workspaces?.[w];
          if (workspaceDef?.workspace_id) {
            workspacesToDelete.push({
              name: w,
              workspaceId: workspaceDef.workspace_id,
            });
          } else {
            logger.warn(`Skipping ${w} - no workspace_id in registry`);
          }
        }

        if (workspacesToDelete.length === 0) {
          logger.error('No workspaces have workspace_id configured');
          process.exit(1);
        }
      }

      // Dry run output
      if (options?.dryRun) {
        logger.info('DRY RUN - No changes will be made');
        logger.blank();
        logger.subheader('Workspaces to delete:');
        for (const w of workspacesToDelete) {
          logger.info(`  ${w.name} (ID: ${w.workspaceId})`);
        }
        logger.blank();
        logger.keyValue('Target URL', config.structurizrUrl);
        return;
      }

      // Deletion phase
      logger.subheader('Deletion Phase');
      logger.blank();

      let deleted = 0;
      let failed = 0;

      for (const w of workspacesToDelete) {
        const spinner = ora(`Deleting ${w.name} (ID: ${w.workspaceId})...`).start();

        // Delete from Structurizr
        const result = await deleteWorkspaceViaApi(
          config.structurizrUrl,
          w.workspaceId,
          adminApiKey!
        );

        if (result.success) {
          // Remove from registry
          if (registry.workspaces) {
            delete registry.workspaces[w.name];
          }

          // Update current_workspace if this was the current one
          if (registry.current_workspace === w.name) {
            const remaining = Object.keys(registry.workspaces || {});
            registry.current_workspace = remaining.length > 0 ? remaining[0] : null as unknown as string;
          }

          spinner.succeed(`${w.name}: DELETED`);
          deleted++;
        } else {
          spinner.fail(`${w.name}: FAILED - ${result.error}`);
          failed++;
        }
      }

      // Save updated registry
      if (deleted > 0) {
        saveRegistry(config, registry);
      }

      logger.blank();

      // Summary
      logger.header('Summary');
      logger.keyValue('Deleted', String(deleted));
      logger.keyValue('Failed', String(failed));
      logger.blank();

      if (failed > 0) {
        process.exit(1);
      } else {
        logger.success('Deletion completed!');
        if (!options?.keepFiles) {
          logger.blank();
          logger.info('Note: Local workspace files are preserved');
          logger.info('Delete manually with: rm -rf workspaces/<workspace>');
        }
      }
    });
}
