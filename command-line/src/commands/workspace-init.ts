import { Command } from 'commander';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { loadConfig } from '../lib/config';
import { quarterExists, isUnifiedStructure, getWorkspaceId, listQuarters } from '../lib/quarters';
import { setEnvValue, getEnvFilePath } from '../lib/dotenv';
import { logger } from '../lib/logger';
import { normalizeEnvironment } from '../types';
import type { WorkspaceCredentials } from '../types';

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
function updateRegistryWithWorkspaceId(config: { sharedDir: string }, workspaceId: string): boolean {
  const registryPath = path.join(config.sharedDir, 'registry.yaml');

  try {
    if (!fs.existsSync(registryPath)) {
      // Create new registry file
      const registry = {
        workspace_id: parseInt(workspaceId, 10),
        lite_port: 20100,
        current_quarter: 'current',
        quarters: {},
      };
      fs.writeFileSync(registryPath, yaml.stringify(registry));
      return true;
    }

    // Update existing registry
    const content = fs.readFileSync(registryPath, 'utf-8');
    const registry = yaml.parse(content);
    registry.workspace_id = parseInt(workspaceId, 10);
    fs.writeFileSync(registryPath, yaml.stringify(registry));
    return true;
  } catch (error) {
    logger.error(`Failed to update registry.yaml: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export function registerWorkspaceInitCommand(program: Command): void {
  program
    .command('workspace:init')
    .description('Initialize workspace in Structurizr On-Premises and save credentials')
    .option('-e, --environment <env>', 'Target environment: Local, Integration, or Production', 'Local')
    .option('-q, --quarter <quarter>', 'Quarter to initialize (default: current)', 'current')
    .option('--update-registry', 'Update registry.yaml with new workspace ID')
    .action(async (options?: {
      environment?: string;
      quarter?: string;
      updateRegistry?: boolean;
    }) => {
      const config = loadConfig();
      const quarter = options?.quarter || 'current';

      // Normalize environment
      let environment;
      try {
        environment = normalizeEnvironment(options?.environment || 'Local');
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      const isLocal = environment === 'Local';

      logger.header('Initialize Workspace');
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
      if (!isUnifiedStructure(config, quarter)) {
        logger.warn(`Quarter '${quarter}' uses legacy structure.`);
        logger.info('This command is for unified workspace structure only.');
        process.exit(1);
      }

      // Check for existing workspace ID
      const existingId = getWorkspaceId(config);
      if (existingId) {
        logger.warn(`Workspace ID ${existingId} already exists in registry.yaml`);
        logger.info('Use workspace:promote to push updates to an existing workspace.');
        logger.blank();
        logger.info('To create a new workspace, first remove workspace_id from registry.yaml');
        process.exit(1);
      }

      // Check admin API key
      if (!config.adminApiKey) {
        logger.error('STRUCTURIZR_ADMIN_API_KEY environment variable is not set');
        logger.blank();
        logger.info('Set it with: export STRUCTURIZR_ADMIN_API_KEY=your-admin-key');
        logger.info('Generate one with: ./cli admin:generate-key');
        process.exit(1);
      }

      // Check target URL
      if (!config.structurizrUrl) {
        logger.error('STRUCTURIZR_URL environment variable is not set');
        logger.info('Set it with: export STRUCTURIZR_URL=http://localhost:20000/api');
        process.exit(1);
      }

      logger.keyValue('Target URL', config.structurizrUrl.replace('/api', ''));
      logger.blank();

      const spinner = ora('Creating workspace via Admin API...').start();

      try {
        const credentials = await createWorkspaceViaApi(
          config.structurizrUrl,
          config.adminApiKey
        );

        spinner.succeed('Workspace created successfully!');
        logger.blank();

        logger.subheader('Workspace Credentials');
        logger.keyValue('Workspace ID', credentials.id);
        logger.keyValue('API Key', credentials.apiKey);
        logger.keyValue('API Secret', credentials.apiSecret);
        logger.blank();

        // Save credentials based on environment
        if (isLocal) {
          logger.subheader('Saving to .env');

          setEnvValue(config, 'STRUCTURIZR_WORKSPACE_ID', credentials.id);
          setEnvValue(config, 'STRUCTURIZR_WORKSPACE_KEY', credentials.apiKey);
          setEnvValue(config, 'STRUCTURIZR_WORKSPACE_SECRET', credentials.apiSecret);

          logger.success(`Credentials saved to ${getEnvFilePath(config)}`);
          logger.blank();

          // Update registry.yaml
          logger.subheader('Updating registry.yaml');
          if (updateRegistryWithWorkspaceId(config, credentials.id)) {
            logger.success(`workspace_id: ${credentials.id} added to registry.yaml`);
          }
          logger.blank();
        } else {
          // For remote environments, display the values for manual setup
          logger.subheader('GitHub Secrets to Configure');
          logger.info(`Environment: ${environment}`);
          logger.blank();

          logger.info('Run these commands to set GitHub secrets:');
          console.log(`  gh secret set STRUCTURIZR_WORKSPACE_KEY --env ${environment}`);
          console.log(`  # Enter: ${credentials.apiKey}`);
          console.log(`  gh secret set STRUCTURIZR_WORKSPACE_SECRET --env ${environment}`);
          console.log(`  # Enter: ${credentials.apiSecret}`);
          logger.blank();

          if (options?.updateRegistry) {
            logger.subheader('Updating registry.yaml');
            if (updateRegistryWithWorkspaceId(config, credentials.id)) {
              logger.success(`workspace_id: ${credentials.id} added to registry.yaml`);
            }
          } else {
            logger.info('Add workspace_id to registry.yaml:');
            console.log(`  workspace_id: ${credentials.id}`);
          }
          logger.blank();
        }

        logger.subheader('Next Steps');
        logger.info('1. Promote the workspace to upload DSL content:');
        console.log(`   ./cli workspace:promote -q ${quarter} -e ${environment}`);
        logger.blank();

        logger.success('Workspace initialized successfully!');

      } catch (error) {
        spinner.fail('Failed to create workspace');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
