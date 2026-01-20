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
  listWorkspaces,
  workspaceExists,
  isUnifiedStructure,
  getWorkspaceDslPath,
  getWorkspaceId,
  getWorkspaceBranch,
  getWorkspacePromotionInfo,
  resolveWorkspace,
} from '../lib/workspace-registry';
import { setEnvValue, getEnvFilePath } from '../lib/dotenv';
import { logger } from '../lib/logger';
import { createAdminClient, isStructurizrApiError } from '../lib/structurizr';
import { normalizeEnvironment } from '../types';
import type { WorkspaceCredentials, Config } from '../types';

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
        current_workspace: 'current',
        workspaces: {},
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
    .description('Promote a workspace to Structurizr On-Premises')
    .option('-w, --workspace <workspace>', 'Workspace to promote (default: current)', 'current')
    .option('-e, --environment <env>', 'Target environment: Local, Integration, or Production', 'Local')
    .option('--validate', 'Run DSL validation before promotion')
    .option('-i, --workspace-id <id>', 'Workspace ID (overrides registry)')
    .option('-b, --branch <branch>', 'Structurizr branch name (overrides workspace)')
    .option('--init', 'Initialize workspace if it does not exist (creates and saves credentials)')
    .option('--dry-run', 'Show what would be promoted without making changes')
    .action(async (options?: {
      workspace?: string;
      environment?: string;
      validate?: boolean;
      workspaceId?: string;
      branch?: string;
      init?: boolean;
      dryRun?: boolean;
    }) => {
      const config = loadConfig();

      // Resolve workspace name (translates 'current' to actual workspace from registry)
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
        environment = normalizeEnvironment(options?.environment || 'Local');
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      const isLocal = environment === 'Local';

      logger.header('Structurizr Workspace Promotion');
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
        logger.info('Consider migrating to the unified workspace structure.');
        logger.blank();
        logger.info('For legacy promotion, use the domain-specific pattern.');
        process.exit(1);
      }

      // Get workspace info
      const workspaceInfo = getWorkspacePromotionInfo(config, workspace);
      if (!workspaceInfo) {
        logger.error(`Could not load workspace info for '${workspace}'`);
        process.exit(1);
      }

      // Get target URL
      const targetUrl = config.structurizrUrl;
      if (!targetUrl) {
        logger.error(`No URL configured for environment '${environment}'`);
        logger.info('Set STRUCTURIZR_URL in environment');
        process.exit(1);
      }

      const workspacePath = getWorkspaceDslPath(config, workspace);

      // Get workspace ID - prefer per-workspace ID (new approach) over root ID (legacy)
      let workspaceId: string;
      let credentials: { workspaceId: string; workspaceKey: string; workspaceSecret: string };

      if (workspaceInfo.hasOwnWorkspaceId) {
        // New ID-based approach: workspace has its own workspace ID
        workspaceId = options?.workspaceId || String(workspaceInfo.workspaceId);
        credentials = {
          workspaceId,
          workspaceKey: workspaceInfo.credentials?.apiKey || '',
          workspaceSecret: workspaceInfo.credentials?.apiSecret || '',
        };
        logger.info('Using per-workspace workspace ID (new approach)');
      } else {
        // Legacy branch-based approach
        workspaceId = options?.workspaceId || String(getWorkspaceId(config) || '');
        credentials = getWorkspaceCredentials(environment);
      }

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
          // Create admin client and use it to create workspace
          const adminClient = createAdminClient({
            baseUrl: targetUrl.replace('/api', ''),
            adminApiKey: config.adminApiKey,
          });

          const newCredentials = await adminClient.createWorkspace();

          initSpinner.succeed('Workspace created!');
          logger.blank();

          // Save credentials to .env
          const newWorkspaceId = String(newCredentials.id);
          workspaceId = newWorkspaceId;
          setEnvValue(config, 'STRUCTURIZR_WORKSPACE_ID', newWorkspaceId);
          setEnvValue(config, 'STRUCTURIZR_WORKSPACE_KEY', newCredentials.apiKey);
          setEnvValue(config, 'STRUCTURIZR_WORKSPACE_SECRET', newCredentials.apiSecret);

          logger.success(`Credentials saved to ${getEnvFilePath(config)}`);

          // Update registry.yaml
          if (updateRegistryWithWorkspaceId(config, newWorkspaceId)) {
            logger.success(`workspace_id: ${newWorkspaceId} added to registry.yaml`);
          }
          logger.blank();

          // Update credentials for promotion
          credentials = {
            workspaceId: newWorkspaceId,
            workspaceKey: newCredentials.apiKey,
            workspaceSecret: newCredentials.apiSecret,
          };

        } catch (error) {
          initSpinner.fail('Failed to create workspace');
          if (isStructurizrApiError(error)) {
            logger.error(`API Error: ${error.message}`);
            if (error.statusCode) {
              logger.info(`Status code: ${error.statusCode}`);
            }
          } else {
            logger.error(error instanceof Error ? error.message : String(error));
          }
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

      // Get branch (from option, registry, or default to workspace name)
      // For ID-based workspaces, branch is null unless explicitly specified
      let branch: string | undefined;
      if (options?.branch) {
        branch = options.branch;
      } else if (!workspaceInfo.hasOwnWorkspaceId) {
        // Legacy approach uses branches
        branch = getWorkspaceBranch(config, workspace);
      }
      // ID-based workspaces don't use branches by default

      logger.keyValue('Workspace Path', workspacePath);
      logger.keyValue('Workspace ID', workspaceId);
      if (branch) {
        logger.keyValue('Branch', branch);
      } else {
        logger.keyValue('Mode', 'Direct (no branch)');
      }
      logger.keyValue('Target URL', translateUrlForContainer(targetUrl));
      logger.blank();

      if (options?.dryRun) {
        logger.info('DRY RUN - No changes will be made');
        logger.blank();
        logger.subheader('Would promote:');
        if (branch) {
          logger.info(`  ${workspace} -> workspace ${workspaceId} (branch: ${branch})`);
        } else {
          logger.info(`  ${workspace} -> workspace ${workspaceId} (direct)`);
        }
        logger.blank();
        return;
      }

      // Validation phase
      if (options?.validate) {
        logger.subheader('Validation Phase');
        const spinner = ora(`Validating ${workspace}...`).start();
        try {
          const valid = await validateWorkspace(config, workspacePath);
          if (valid) {
            spinner.succeed(`${workspace}: VALID`);
          } else {
            spinner.fail(`${workspace}: INVALID`);
            logger.error('Validation failed. Aborting promotion.');
            process.exit(1);
          }
        } catch (error) {
          spinner.fail(`${workspace}: ERROR`);
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
        logger.blank();
      }

      // Promotion phase
      logger.subheader('Promotion Phase');

      const spinner = ora(`Promoting ${workspace} to workspace ${workspaceId}...`).start();

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
          spinner.succeed(`${workspace}: PROMOTED`);
          logger.blank();

          // Summary
          logger.header('Promotion Summary');
          logger.keyValue('Workspace', workspace);
          logger.keyValue('Workspace ID', workspaceId);
          if (branch) {
            logger.keyValue('Branch', branch);
          } else {
            logger.keyValue('Mode', 'Direct (no branch)');
          }
          logger.keyValue('Environment', environment);
          logger.blank();

          // Access URL
          const baseUrl = targetUrl.replace('/api', '');
          const accessUrl = `${baseUrl}/workspace/${workspaceId}`;
          logger.subheader('Access Workspace');
          logger.info(`  ${accessUrl}`);
          if (branch && branch !== 'main') {
            logger.info(`  ${accessUrl}/${branch}`);
          }
          logger.blank();
          logger.success('Workspace promoted successfully!');
        } else {
          spinner.fail(`${workspace}: FAILED`);
          logger.blank();
          logger.error('Promotion failed');
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
