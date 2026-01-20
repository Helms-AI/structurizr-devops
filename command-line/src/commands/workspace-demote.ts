import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../lib/config';
import {
  listAllWorkspaces,
  workspaceExists,
  detectWorkspaceType,
  getWorkspaceId,
} from '../lib/domains';
import {
  checkGitHubCli,
  generateSecretNames,
  deleteEnvironmentSecret,
  listEnvironmentSecrets,
} from '../lib/github';
import { deleteEnvValue, getEnvFilePath, listEnvValues, envFileExists } from '../lib/dotenv';
import { logger } from '../lib/logger';
import type { WorkspaceType } from '../types';
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
    const apiUrl = baseUrl.replace(/\/api\/?$/, '');
    const endpoint = `${apiUrl}/api/workspace/${workspaceId}`;

    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'X-Authorization': adminApiKey,
      },
    });

    if (response.ok) {
      return { success: true };
    }

    const text = await response.text();
    return {
      success: false,
      error: `HTTP ${response.status}: ${text || response.statusText}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function registerWorkspaceDemoteCommand(program: Command): void {
  program
    .command('workspace:demote [workspace]')
    .description('Remove workspace from On-Premises and cleanup secrets (Local: .env, Remote: GitHub)')
    .requiredOption('-e, --environment <env>', 'Target environment: Local, Integration, or Production')
    .option('-t, --type <type>', 'Workspace type: domain or perspective (auto-detected if not specified)')
    .option('--all', 'Demote all workspaces')
    .option('--dry-run', 'Show what would be demoted without making changes')
    .action(async (workspace?: string, options?: {
      environment: string;
      type?: string;
      all?: boolean;
      dryRun?: boolean;
    }) => {
      const config = loadConfig();

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
      logger.keyValue('Environment', environment);
      logger.blank();

      // Validate workspace argument
      if (!workspace && !options?.all) {
        logger.error('Please specify a workspace name or use --all');
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

      interface WorkspaceToDemote {
        name: string;
        type: WorkspaceType;
        workspaceId: string;
      }

      const workspacesToDemote: WorkspaceToDemote[] = [];

      if (workspace && !options?.all) {
        // Single workspace demotion
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

        workspacesToDemote.push({
          name: workspace,
          type,
          workspaceId: wsId,
        });
      } else {
        // Demote all workspaces
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
          workspacesToDemote.push({
            name: w.name,
            type: w.type,
            workspaceId: String(w.workspaceId),
          });
        }

        if (workspacesToDemote.length === 0) {
          logger.error('No workspaces have workspace_id configured');
          process.exit(1);
        }
      }

      // Dry run output
      if (options?.dryRun) {
        logger.info('DRY RUN - No changes will be made');
        logger.blank();
        logger.subheader('Workspaces to demote:');
        for (const w of workspacesToDemote) {
          logger.info(`  ${w.name} (${w.type}) - workspace ID ${w.workspaceId}`);
          const names = generateSecretNames(w.name);
          if (isLocal) {
            logger.info(`    Will delete from .env: ${names.workspaceKey}`);
            logger.info(`    Will delete from .env: ${names.workspaceSecret}`);
          } else {
            logger.info(`    Will delete from GitHub (${environment}): ${names.workspaceKey}`);
            logger.info(`    Will delete from GitHub (${environment}): ${names.workspaceSecret}`);
          }
        }
        logger.blank();

        if (targetUrl && adminApiKey) {
          logger.info('Will also delete workspaces from On-Premises via Admin API');
          logger.keyValue('Target URL', targetUrl);
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
        logger.blank();
      }

      let demoted = 0;
      let failed = 0;
      const results: Array<{ name: string; success: boolean; apiDeleted: boolean; secretsDeleted: string[]; error?: string }> = [];

      for (const w of workspacesToDemote) {
        const workspaceSpinner = ora(`Demoting ${w.name} (${w.type})...`).start();

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

        // Step 2: Delete secrets (Local: .env, Remote: GitHub environment)
        const names = generateSecretNames(w.name);
        const secretsToDelete = [names.workspaceKey, names.workspaceSecret];

        for (const secretName of secretsToDelete) {
          if (existingSecretNames.has(secretName)) {
            let deleted: boolean;
            if (isLocal) {
              deleted = deleteEnvValue(config, secretName);
            } else {
              deleted = await deleteEnvironmentSecret(secretName, environment.toLowerCase());
            }
            if (deleted) {
              result.secretsDeleted.push(secretName);
            } else {
              result.success = false;
              result.error = `Failed to delete ${secretName}`;
            }
          }
        }

        if (result.success) {
          workspaceSpinner.succeed(`${w.name}: DEMOTED`);
          demoted++;
        } else {
          workspaceSpinner.fail(`${w.name}: FAILED`);
          failed++;
        }

        results.push(result);
      }

      logger.blank();

      // Summary
      logger.header('Demotion Summary');
      logger.keyValue('Total', String(workspacesToDemote.length));
      logger.keyValue('Demoted', String(demoted));
      logger.keyValue('Failed', String(failed));
      logger.blank();

      if (failed > 0) {
        logger.subheader('Failed Workspaces');
        for (const result of results.filter((r) => !r.success)) {
          logger.error(`${result.name}: ${result.error}`);
        }
        logger.blank();
      }

      if (demoted > 0) {
        logger.subheader('Demoted Details');
        for (const result of results.filter((r) => r.success)) {
          logger.info(`${result.name}:`);
          if (result.apiDeleted) {
            logger.info('  - Deleted from On-Premises');
          }
          if (result.secretsDeleted.length > 0) {
            const location = isLocal ? '.env' : `GitHub (${environment})`;
            logger.info(`  - Deleted from ${location}: ${result.secretsDeleted.join(', ')}`);
          }
        }
        logger.blank();
      }

      if (failed > 0) {
        process.exit(1);
      } else {
        logger.success('All workspaces demoted successfully!');
        logger.blank();
        logger.info('Note: DSL files and domains.yaml workspace IDs are preserved');
        logger.info('To re-initialize: ./cli workspace:init <workspace> --save');
        logger.info(`To re-promote: ./cli workspace:promote <workspace> -e ${environment}`);
      }
    });
}
