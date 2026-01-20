import { Command } from 'commander';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { loadConfig, getWorkspaceCredentials } from '../lib/config';
import {
  validateWorkspace,
  pushWorkspace,
  translateUrlForContainer,
} from '../lib/docker';
import {
  listQuarters,
  quarterExists,
  isUnifiedStructure,
  getWorkspacePath,
  getWorkspaceId,
  getQuarterBranch,
  getQuarterWorkspaceInfo,
} from '../lib/quarters';
import { setEnvValue, getEnvFilePath } from '../lib/dotenv';
import { logger } from '../lib/logger';
import { normalizeEnvironment } from '../types';
import type { WorkspaceCredentials, Config } from '../types';

interface CreateWorkspaceResponse {
  id?: number;
  workspaceId?: number;
  apiKey?: string;
  key?: string;
  apiSecret?: string;
  secret?: string;
}

/**
 * Create workspace via Structurizr On-Premises Admin API
 */
async function createWorkspaceViaApi(
  url: string,
  apiKey: string
): Promise<WorkspaceCredentials> {
  const baseUrl = url.replace('/api', '');
  const endpoint = `${baseUrl}/api/workspace`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-Authorization': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const data = (await response.json()) as CreateWorkspaceResponse;

  return {
    id: String(data.id || data.workspaceId || ''),
    apiKey: data.apiKey || data.key || '',
    apiSecret: data.apiSecret || data.secret || '',
  };
}

/**
 * Update registry.yaml with workspace_id
 */
function updateRegistryWithWorkspaceId(config: Config, workspaceId: string): boolean {
  const registryPath = path.join(config.sharedDir, 'registry.yaml');

  try {
    if (!fs.existsSync(registryPath)) {
      const registry = {
        workspace_id: parseInt(workspaceId, 10),
        lite_port: 20100,
        current_quarter: 'current',
        quarters: {},
      };
      fs.writeFileSync(registryPath, yaml.stringify(registry));
      return true;
    }

    const content = fs.readFileSync(registryPath, 'utf-8');
    const registry = yaml.parse(content);
    registry.workspace_id = parseInt(workspaceId, 10);
    fs.writeFileSync(registryPath, yaml.stringify(registry));
    return true;
  } catch {
    return false;
  }
}


export function registerPromoteCommand(program: Command): void {
  program
    .command('workspace:promote')
    .description('Promote a quarter workspace to Structurizr On-Premises')
    .option('-q, --quarter <quarter>', 'Quarter to promote (default: current)', 'current')
    .option('-e, --environment <env>', 'Target environment: Local, Integration, or Production', 'Local')
    .option('--validate', 'Run DSL validation before promotion')
    .option('-i, --workspace-id <id>', 'Workspace ID (overrides registry)')
    .option('-b, --branch <branch>', 'Structurizr branch name (overrides quarter)')
    .option('--init', 'Initialize workspace if it does not exist (creates and saves credentials)')
    .option('--dry-run', 'Show what would be promoted without making changes')
    .action(async (options?: {
      quarter?: string;
      environment?: string;
      validate?: boolean;
      workspaceId?: string;
      branch?: string;
      init?: boolean;
      dryRun?: boolean;
    }) => {
      const config = loadConfig();
      const quarter = options?.quarter || 'current';

      // Normalize environment (case-insensitive)
      let environment;
      try {
        environment = normalizeEnvironment(options?.environment || 'Local');
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      const isLocal = environment === 'Local';

      logger.header('Structurizr Workspace Promotion');
      logger.keyValue('Quarter', quarter);
      logger.keyValue('Environment', environment);
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
        logger.info('For legacy promotion, use the domain-specific pattern.');
        process.exit(1);
      }

      // Get workspace info
      const workspaceInfo = getQuarterWorkspaceInfo(config, quarter);
      if (!workspaceInfo) {
        logger.error(`Could not load workspace info for quarter '${quarter}'`);
        process.exit(1);
      }

      // Get target URL
      const targetUrl = config.structurizrUrl;
      if (!targetUrl) {
        logger.error(`No URL configured for environment '${environment}'`);
        logger.info('Set STRUCTURIZR_URL in environment');
        process.exit(1);
      }

      const workspacePath = getWorkspacePath(config, quarter);

      // Get workspace ID (from option or registry)
      let workspaceId = options?.workspaceId || String(getWorkspaceId(config) || '');

      // Get credentials
      let credentials = getWorkspaceCredentials(environment);

      // Check if we need to initialize
      const needsInit = !workspaceId || !credentials.workspaceKey || !credentials.workspaceSecret;

      if (needsInit && options?.init && isLocal) {
        // Auto-initialize for Local environment
        logger.subheader('Initialization Phase');

        if (!config.adminApiKey) {
          logger.error('STRUCTURIZR_ADMIN_API_KEY is required for --init');
          logger.info('Set it with: export STRUCTURIZR_ADMIN_API_KEY=your-admin-key');
          process.exit(1);
        }

        const initSpinner = ora('Creating workspace via Admin API...').start();

        try {
          const newCredentials = await createWorkspaceViaApi(
            targetUrl,
            config.adminApiKey
          );

          initSpinner.succeed('Workspace created!');
          logger.blank();

          // Save credentials to .env
          workspaceId = newCredentials.id;
          setEnvValue(config, 'STRUCTURIZR_WORKSPACE_ID', newCredentials.id);
          setEnvValue(config, 'STRUCTURIZR_WORKSPACE_KEY', newCredentials.apiKey);
          setEnvValue(config, 'STRUCTURIZR_WORKSPACE_SECRET', newCredentials.apiSecret);

          logger.success(`Credentials saved to ${getEnvFilePath(config)}`);

          // Update registry.yaml
          if (updateRegistryWithWorkspaceId(config, newCredentials.id)) {
            logger.success(`workspace_id: ${newCredentials.id} added to registry.yaml`);
          }
          logger.blank();

          // Update credentials for promotion
          credentials = {
            workspaceId: newCredentials.id,
            workspaceKey: newCredentials.apiKey,
            workspaceSecret: newCredentials.apiSecret,
          };

        } catch (error) {
          initSpinner.fail('Failed to create workspace');
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      } else if (needsInit && options?.init && !isLocal) {
        logger.error('--init is only supported for Local environment');
        logger.info('For remote environments, run: ./cli workspace:init -e ' + environment);
        process.exit(1);
      } else if (!workspaceId) {
        logger.error('No workspace ID found. Set workspace_id in registry.yaml or use --workspace-id');
        logger.info('Or use --init to create a new workspace (Local only)');
        process.exit(1);
      } else if (!credentials.workspaceKey || !credentials.workspaceSecret) {
        logger.error(`Missing credentials for environment '${environment}'`);
        logger.info('Set STRUCTURIZR_WORKSPACE_KEY and STRUCTURIZR_WORKSPACE_SECRET');
        logger.info('Or use --init to create a new workspace (Local only)');
        process.exit(1);
      }

      // Get branch (from option, registry, or default to quarter name)
      const branch = options?.branch || getQuarterBranch(config, quarter);

      logger.keyValue('Workspace Path', workspacePath);
      logger.keyValue('Workspace ID', workspaceId);
      logger.keyValue('Branch', branch);
      logger.keyValue('Target URL', translateUrlForContainer(targetUrl));
      logger.blank();

      if (options?.dryRun) {
        logger.info('DRY RUN - No changes will be made');
        logger.blank();
        logger.subheader('Would promote:');
        logger.info(`  ${quarter} -> workspace ${workspaceId} (branch: ${branch})`);
        logger.blank();
        return;
      }

      // Validation phase
      if (options?.validate) {
        logger.subheader('Validation Phase');
        const spinner = ora(`Validating ${quarter}...`).start();
        try {
          const valid = await validateWorkspace(config, workspacePath);
          if (valid) {
            spinner.succeed(`${quarter}: VALID`);
          } else {
            spinner.fail(`${quarter}: INVALID`);
            logger.error('Validation failed. Aborting promotion.');
            process.exit(1);
          }
        } catch (error) {
          spinner.fail(`${quarter}: ERROR`);
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
        logger.blank();
      }

      // Promotion phase
      logger.subheader('Promotion Phase');

      const spinner = ora(`Promoting ${quarter} to workspace ${workspaceId}...`).start();

      try {
        const success = await pushWorkspace(
          config,
          workspacePath,
          targetUrl,
          workspaceId,
          credentials.workspaceKey,
          credentials.workspaceSecret,
          branch
        );

        if (success) {
          spinner.succeed(`${quarter}: PROMOTED`);
          logger.blank();

          // Summary
          logger.header('Promotion Summary');
          logger.keyValue('Quarter', quarter);
          logger.keyValue('Workspace ID', workspaceId);
          logger.keyValue('Branch', branch);
          logger.keyValue('Environment', environment);
          logger.blank();

          // Access URL
          const baseUrl = targetUrl.replace('/api', '');
          const accessUrl = `${baseUrl}/workspace/${workspaceId}`;
          logger.subheader('Access Workspace');
          logger.info(`  ${accessUrl}`);
          if (branch !== 'main') {
            logger.info(`  ${accessUrl}/${branch}`);
          }
          logger.blank();
          logger.success('Workspace promoted successfully!');
        } else {
          spinner.fail(`${quarter}: FAILED`);
          logger.blank();
          logger.error('Promotion failed');
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
