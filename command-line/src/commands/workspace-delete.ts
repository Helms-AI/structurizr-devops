import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../lib/config';
import {
  listAllWorkspaces,
  workspaceExists,
  detectWorkspaceType,
  getWorkspaceId,
} from '../lib/domains';
import { generateSecretNames } from '../lib/github';
import { deleteEnvValue, getEnvFilePath, listEnvValues, envFileExists } from '../lib/dotenv';
import { logger } from '../lib/logger';
import { createAdminClient, isStructurizrApiError, isNotFoundError } from '../lib/structurizr';
import type { WorkspaceType } from '../types';

/**
 * Delete a workspace from Structurizr On-Premises via Admin API
 */
async function deleteWorkspaceViaApi(
  baseUrl: string,
  workspaceId: string,
  adminApiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient({
      baseUrl: baseUrl.replace(/\/api\/?$/, ''),
      adminApiKey,
    });

    await adminClient.deleteWorkspace(parseInt(workspaceId, 10));
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
    .description('Remove workspace from local On-Premises and cleanup .env secrets (alias for workspace:demote -e Local)')
    .option('-t, --type <type>', 'Workspace type: domain or perspective (auto-detected if not specified)')
    .option('--all', 'Delete all workspaces')
    .option('--dry-run', 'Show what would be deleted without making changes')
    .action(async (workspace?: string, options?: {
      type?: string;
      all?: boolean;
      dryRun?: boolean;
    }) => {
      const config = loadConfig();

      logger.header('Structurizr Workspace Deletion (Local)');
      logger.keyValue('Environment', 'Local');
      logger.blank();

      // Validate workspace argument
      if (!workspace && !options?.all) {
        logger.error('Please specify a workspace name or use --all');
        process.exit(1);
      }

      // Get local URL
      const targetUrl = config.structurizrUrl;
      if (!targetUrl && !options?.dryRun) {
        logger.warn('No STRUCTURIZR_URL configured');
        logger.info('Workspace deletion from On-Premises will be skipped');
        logger.info('Only .env secrets will be cleaned up');
        logger.blank();
      }

      // Get admin API key
      const adminApiKey = config.adminApiKey;
      if (!adminApiKey && !options?.dryRun && targetUrl) {
        logger.warn('No STRUCTURIZR_ADMIN_API_KEY configured');
        logger.info('Workspace deletion from On-Premises will be skipped');
        logger.info('Only .env secrets will be cleaned up');
        logger.blank();
      }

      interface WorkspaceToDelete {
        name: string;
        type: WorkspaceType;
        workspaceId: string;
      }

      const workspacesToDelete: WorkspaceToDelete[] = [];

      if (workspace && !options?.all) {
        // Single workspace deletion
        let type = options?.type as WorkspaceType | undefined;
        if (!type) {
          const detected = detectWorkspaceType(config, workspace, 'current');
          type = detected || undefined;
          if (!type) {
            logger.error(`Workspace '${workspace}' not found in current quarter`);
            logger.blank();
            const allWorkspaces = listAllWorkspaces(config, 'current');
            if (allWorkspaces.length > 0) {
              logger.info('Available workspaces:');
              logger.list(allWorkspaces.map((w) => `${w.name} (${w.type})`));
            }
            process.exit(1);
          }
        }

        if (!workspaceExists(config, workspace, type, 'current')) {
          logger.error(`Workspace '${workspace}' (${type}) not found in current quarter`);
          process.exit(1);
        }

        const wsId = String(getWorkspaceId(config, workspace, type) || '');
        if (!wsId) {
          logger.error(`No workspace ID found for '${workspace}' in domains.yaml`);
          process.exit(1);
        }

        workspacesToDelete.push({
          name: workspace,
          type,
          workspaceId: wsId,
        });
      } else {
        // Delete all workspaces
        const allWorkspaces = listAllWorkspaces(config, 'current');
        if (allWorkspaces.length === 0) {
          logger.error('No workspaces found in current quarter');
          process.exit(1);
        }

        for (const w of allWorkspaces) {
          if (!w.workspaceId) {
            logger.warn(`Skipping ${w.name} - no workspace_id configured in domains.yaml`);
            continue;
          }
          workspacesToDelete.push({
            name: w.name,
            type: w.type,
            workspaceId: String(w.workspaceId),
          });
        }

        if (workspacesToDelete.length === 0) {
          logger.error('No workspaces have workspace_id configured');
          process.exit(1);
        }
      }

      // Get existing .env values for reference
      const envPath = getEnvFilePath(config);
      const existingValues = envFileExists(config) ? listEnvValues(config) : [];
      const existingValueNames = new Set(existingValues.map((v) => v.name));

      // Dry run output
      if (options?.dryRun) {
        logger.info('DRY RUN - No changes will be made');
        logger.blank();
        logger.subheader('Workspaces to delete:');
        for (const w of workspacesToDelete) {
          logger.info(`  ${w.name} (${w.type}) - workspace ID ${w.workspaceId}`);
          const names = generateSecretNames(w.name);
          logger.info(`    Will delete from .env: ${names.workspaceKey}`);
          logger.info(`    Will delete from .env: ${names.workspaceSecret}`);
        }
        logger.blank();

        if (targetUrl && adminApiKey) {
          logger.info('Will also delete workspaces from On-Premises via Admin API');
          logger.keyValue('Target URL', targetUrl);
        } else {
          logger.warn('On-Premises deletion skipped (missing URL or admin key)');
        }
        logger.blank();
        logger.keyValue('.env file', envPath);
        return;
      }

      // Deletion phase
      logger.subheader('Deletion Phase');
      logger.keyValue('.env file', envPath);
      logger.blank();

      let deleted = 0;
      let failed = 0;
      const results: Array<{ name: string; success: boolean; apiDeleted: boolean; secretsDeleted: string[]; error?: string }> = [];

      for (const w of workspacesToDelete) {
        const workspaceSpinner = ora(`Deleting ${w.name} (${w.type})...`).start();

        const result: { name: string; success: boolean; apiDeleted: boolean; secretsDeleted: string[]; error?: string } = {
          name: w.name,
          success: true,
          apiDeleted: false,
          secretsDeleted: [],
        };

        // Step 1: Delete from On-Premises via Admin API (if available)
        if (targetUrl && adminApiKey) {
          const apiResult = await deleteWorkspaceViaApi(targetUrl, w.workspaceId, adminApiKey);
          if (apiResult.success) {
            result.apiDeleted = true;
          } else {
            logger.warn(`Failed to delete workspace ${w.workspaceId} from On-Premises: ${apiResult.error}`);
          }
        }

        // Step 2: Delete .env secrets
        const names = generateSecretNames(w.name);
        const secretsToDelete = [names.workspaceKey, names.workspaceSecret];

        for (const secretName of secretsToDelete) {
          if (existingValueNames.has(secretName)) {
            const deletedValue = deleteEnvValue(config, secretName);
            if (deletedValue) {
              result.secretsDeleted.push(secretName);
            } else {
              result.success = false;
              result.error = `Failed to delete ${secretName} from .env`;
            }
          }
        }

        if (result.success) {
          workspaceSpinner.succeed(`${w.name}: DELETED`);
          deleted++;
        } else {
          workspaceSpinner.fail(`${w.name}: FAILED`);
          failed++;
        }

        results.push(result);
      }

      logger.blank();

      // Summary
      logger.header('Deletion Summary');
      logger.keyValue('Total', String(workspacesToDelete.length));
      logger.keyValue('Deleted', String(deleted));
      logger.keyValue('Failed', String(failed));
      logger.blank();

      if (failed > 0) {
        logger.subheader('Failed Workspaces');
        for (const result of results.filter((r) => !r.success)) {
          logger.error(`${result.name}: ${result.error}`);
        }
        logger.blank();
      }

      if (deleted > 0) {
        logger.subheader('Deletion Details');
        for (const result of results.filter((r) => r.success)) {
          logger.info(`${result.name}:`);
          if (result.apiDeleted) {
            logger.info('  - Deleted from On-Premises');
          }
          if (result.secretsDeleted.length > 0) {
            logger.info(`  - Deleted from .env: ${result.secretsDeleted.join(', ')}`);
          }
        }
        logger.blank();
      }

      if (failed > 0) {
        process.exit(1);
      } else {
        logger.success('All workspaces deleted successfully!');
        logger.blank();
        logger.info('Note: Local DSL files and domains.yaml workspace IDs are preserved');
        logger.info('To re-initialize, use: ./cli workspace:init <workspace> --save');
        logger.info('To re-promote, use: ./cli workspace:promote <workspace>');
      }
    });
}
