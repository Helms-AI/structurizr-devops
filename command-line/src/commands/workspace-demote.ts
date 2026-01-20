import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../lib/config';
import {
  workspaceExists,
  isUnifiedStructure,
  getWorkspaceId,
  listWorkspaces,
  resolveWorkspace,
} from '../lib/workspace-registry';
import {
  checkGitHubCli,
  deleteEnvironmentSecret,
  listEnvironmentSecrets,
} from '../lib/github';
import { deleteEnvValue, getEnvFilePath, listEnvValues, envFileExists } from '../lib/dotenv';
import { logger } from '../lib/logger';
import { createAdminClient, isStructurizrApiError, isNotFoundError } from '../lib/structurizr';
import { normalizeEnvironment } from '../types';

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

export function registerWorkspaceDemoteCommand(program: Command): void {
  program
    .command('workspace:demote')
    .description('Remove workspace from On-Premises and cleanup secrets')
    .requiredOption('-e, --environment <env>', 'Target environment: Local, Integration, or Production')
    .option('-w, --workspace <workspace>', 'Workspace to demote (default: current)', 'current')
    .option('--dry-run', 'Show what would be demoted without making changes')
    .action(async (options?: {
      environment: string;
      workspace?: string;
      dryRun?: boolean;
    }) => {
      const config = loadConfig();

      // Resolve workspace name
      let workspace: string;
      try {
        workspace = resolveWorkspace(config, options?.workspace || 'current');
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      // Normalize environment (case-insensitive)
      let environment;
      try {
        environment = normalizeEnvironment(options?.environment || '');
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      const isLocal = environment === 'Local';

      logger.header('Structurizr Workspace Demotion');
      logger.keyValue('Workspace', workspace);
      logger.keyValue('Environment', environment);
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
        logger.info('Legacy demotion is not supported in this version.');
        process.exit(1);
      }

      // Check GitHub CLI for remote environments
      if (!isLocal) {
        const spinner = ora('Checking GitHub CLI...').start();
        const ghAvailable = await checkGitHubCli();
        if (!ghAvailable) {
          spinner.fail('GitHub CLI not available or not authenticated');
          logger.blank();
          logger.info('Install GitHub CLI: https://cli.github.com/');
          logger.info('Authenticate: gh auth login');
          process.exit(1);
        }
        spinner.succeed('GitHub CLI authenticated');
        logger.blank();
      }

      // Get workspace ID
      const workspaceId = String(getWorkspaceId(config) || '');
      if (!workspaceId) {
        logger.error('No workspace ID found in registry.yaml');
        process.exit(1);
      }

      // Get environment URL for API calls
      const targetUrl = config.structurizrUrl;
      if (!targetUrl && !options?.dryRun) {
        logger.warn(`No STRUCTURIZR_URL set for ${environment} environment`);
        logger.info('Workspace deletion from On-Premises will be skipped');
        logger.info(isLocal ? 'Only .env secrets will be cleaned up' : 'Only GitHub secrets will be cleaned up');
        logger.blank();
      }

      // Get admin API key
      const adminApiKey = config.adminApiKey;
      if (!adminApiKey && !options?.dryRun && targetUrl) {
        logger.warn('No STRUCTURIZR_ADMIN_API_KEY configured');
        logger.info('Workspace deletion from On-Premises will be skipped');
        logger.info(isLocal ? 'Only .env secrets will be cleaned up' : 'Only GitHub secrets will be cleaned up');
        logger.blank();
      }

      // Secrets to clean up (unified structure uses simple names)
      const secretsToDelete = [
        'STRUCTURIZR_WORKSPACE_KEY',
        'STRUCTURIZR_WORKSPACE_SECRET',
      ];

      // Dry run output
      if (options?.dryRun) {
        logger.info('DRY RUN - No changes will be made');
        logger.blank();
        logger.subheader('Workspace to demote:');
        logger.info(`  ${workspace} -> workspace ID ${workspaceId}`);
        logger.blank();

        if (isLocal) {
          logger.info('Will delete from .env:');
          for (const secretName of secretsToDelete) {
            logger.info(`  - ${secretName}`);
          }
        } else {
          logger.info(`Will delete from GitHub (${environment}):`);
          for (const secretName of secretsToDelete) {
            logger.info(`  - ${secretName}`);
          }
        }
        logger.blank();

        if (targetUrl && adminApiKey) {
          logger.info('Will also delete workspace from On-Premises via Admin API');
          logger.keyValue('Target URL', targetUrl);
          logger.keyValue('Workspace ID', workspaceId);
        } else {
          logger.warn('On-Premises deletion skipped (missing URL or admin key)');
        }

        if (isLocal) {
          logger.keyValue('.env file', getEnvFilePath(config));
        }
        logger.blank();
        return;
      }

      // Get existing secrets/values for reference
      let existingSecretNames: Set<string>;
      if (isLocal) {
        const existingValues = envFileExists(config) ? listEnvValues(config) : [];
        existingSecretNames = new Set(existingValues.map((v) => v.name));
      } else {
        const envLower = environment.toLowerCase();
        const existingSecrets = await listEnvironmentSecrets(envLower);
        existingSecretNames = new Set(existingSecrets.map((s) => s.name));
      }

      // Demotion phase
      logger.subheader('Demotion Phase');
      if (isLocal) {
        logger.keyValue('.env file', getEnvFilePath(config));
      }
      logger.keyValue('Workspace ID', workspaceId);
      logger.blank();

      const demoteSpinner = ora(`Demoting ${workspace}...`).start();

      let apiDeleted = false;
      const deletedSecrets: string[] = [];
      let success = true;
      let error: string | undefined;

      // Step 1: Delete from On-Premises via Admin API (if available)
      if (targetUrl && adminApiKey) {
        const apiResult = await deleteWorkspaceViaApi(targetUrl, workspaceId, adminApiKey);
        if (apiResult.success) {
          apiDeleted = true;
        } else {
          logger.warn(`Failed to delete workspace ${workspaceId} from On-Premises: ${apiResult.error}`);
        }
      }

      // Step 2: Delete secrets
      for (const secretName of secretsToDelete) {
        if (existingSecretNames.has(secretName)) {
          let deleted: boolean;
          if (isLocal) {
            deleted = deleteEnvValue(config, secretName);
          } else {
            deleted = await deleteEnvironmentSecret(secretName, environment.toLowerCase());
          }
          if (deleted) {
            deletedSecrets.push(secretName);
          } else {
            success = false;
            error = `Failed to delete ${secretName}`;
          }
        }
      }

      if (success) {
        demoteSpinner.succeed(`${workspace}: DEMOTED`);
      } else {
        demoteSpinner.fail(`${workspace}: FAILED`);
      }

      logger.blank();

      // Summary
      logger.header('Demotion Summary');
      logger.keyValue('Workspace', workspace);
      logger.keyValue('Workspace ID', workspaceId);
      logger.keyValue('Status', success ? 'Success' : 'Failed');
      logger.blank();

      if (!success && error) {
        logger.error(error);
        logger.blank();
      }

      if (success) {
        logger.subheader('Details');
        if (apiDeleted) {
          logger.info('- Deleted from On-Premises');
        }
        if (deletedSecrets.length > 0) {
          const location = isLocal ? '.env' : `GitHub (${environment})`;
          logger.info(`- Deleted from ${location}: ${deletedSecrets.join(', ')}`);
        }
        logger.blank();
        logger.success('Workspace demoted successfully!');
        logger.blank();
        logger.info('Note: DSL files and registry.yaml are preserved');
        logger.info(`To re-promote: ./cli workspace:promote -w ${workspace} -e ${environment}`);
      } else {
        process.exit(1);
      }
    });
}
