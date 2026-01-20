import { Command } from 'commander';
import ora from 'ora';
import { loadConfig, appendToEnvFile } from '../lib/config';
import { listAllWorkspaces, workspaceExists, detectWorkspaceType } from '../lib/domains';
import { logger } from '../lib/logger';
import type { WorkspaceCredentials } from '../types';

interface CreateWorkspaceResponse {
  id?: number;
  workspaceId?: number;
  apiKey?: string;
  key?: string;
  apiSecret?: string;
  secret?: string;
}

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

export function registerWorkspaceInitCommand(program: Command): void {
  program
    .command('workspace:init <workspace>')
    .description('Initialize new workspace via Admin API')
    .option('--save', 'Save credentials to .env file')
    .option('-q, --quarter <quarter>', 'Quarter to look for workspace (default: current)', 'current')
    .action(async (workspace: string, options: { save?: boolean; quarter?: string }) => {
      const config = loadConfig();
      const quarter = options.quarter || 'current';

      logger.header('Initialize Workspace');

      // Check if workspace exists
      if (!workspaceExists(config, workspace, undefined, quarter)) {
        logger.error(`Workspace '${workspace}' not found in quarter '${quarter}'`);
        logger.blank();
        const allWorkspaces = listAllWorkspaces(config, quarter);
        if (allWorkspaces.length > 0) {
          logger.info('Available workspaces:');
          logger.list(allWorkspaces.map((w) => `${w.name} (${w.type})`));
        }
        process.exit(1);
      }

      const type = detectWorkspaceType(config, workspace, quarter);

      if (!config.adminApiKey) {
        logger.error('STRUCTURIZR_ADMIN_API_KEY environment variable is not set');
        logger.blank();
        logger.info('Set it with: export STRUCTURIZR_ADMIN_API_KEY=your-admin-key');
        logger.info('Generate one with: ./cli admin:generate-key');
        process.exit(1);
      }

      logger.keyValue('Workspace', workspace);
      logger.keyValue('Type', type || 'unknown');
      logger.keyValue('Quarter', quarter);
      logger.keyValue('URL', `${config.structurizrUrl.replace('/api', '')}/api/workspace`);
      logger.blank();

      const spinner = ora('Creating workspace via Admin API...').start();

      try {
        const credentials = await createWorkspaceViaApi(
          config.structurizrUrl,
          config.adminApiKey
        );

        spinner.succeed('Workspace created successfully!');
        logger.blank();

        logger.subheader('WORKSPACE CREDENTIALS');
        logger.keyValue('Workspace', workspace);
        logger.keyValue('Workspace ID', credentials.id);
        logger.keyValue('API Key', credentials.apiKey);
        logger.keyValue('API Secret', credentials.apiSecret);
        logger.blank();

        const workspaceUpper = workspace.toUpperCase().replace(/-/g, '_');
        const envVars = {
          [`STRUCTURIZR_${workspaceUpper}_WORKSPACE_ID`]: credentials.id,
          [`STRUCTURIZR_${workspaceUpper}_WORKSPACE_KEY`]: credentials.apiKey,
          [`STRUCTURIZR_${workspaceUpper}_WORKSPACE_SECRET`]: credentials.apiSecret,
        };

        logger.subheader('ENVIRONMENT VARIABLES');
        for (const [key, value] of Object.entries(envVars)) {
          console.log(`${key}=${value}`);
        }
        logger.blank();

        if (options.save) {
          const date = new Date().toISOString().split('T')[0];
          appendToEnvFile(config.envFile, envVars, `${workspace} workspace (created ${date})`);
          logger.success(`Credentials appended to ${config.envFile}`);
          logger.blank();
        }

        logger.subheader('NEXT STEPS');
        logger.info('1. Add workspace_id to domains.yaml:');
        console.log(`   ${type}s:`);
        console.log(`     ${workspace}:`);
        console.log(`       workspace_id: ${credentials.id}`);
        logger.blank();

        logger.info('2. Sync workspace ID to GitHub (after adding to domains.yaml):');
        console.log(`   ./cli secrets:sync`);
        logger.blank();

        logger.info('3. Configure GitHub secrets per environment (for CI/CD):');
        console.log(`   ./cli secrets:init -e Integration`);
        console.log(`   # Or manually:`);
        console.log(`   gh secret set STRUCTURIZR_${workspaceUpper}_WORKSPACE_KEY --env Integration`);
        console.log(`   gh secret set STRUCTURIZR_${workspaceUpper}_WORKSPACE_SECRET --env Integration`);
      } catch (error) {
        spinner.fail('Failed to create workspace');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
