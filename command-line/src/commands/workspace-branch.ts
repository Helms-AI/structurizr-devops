import { Command } from 'commander';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../lib/config';
import {
  listWorkspaces,
  workspaceExists,
  validateWorkspaceName,
  getWorkspacePromotionInfo,
  addWorkspaceToRegistry,
  getWorkspaceDir,
  resolveWorkspace,
} from '../lib/workspace-registry';
import { logger } from '../lib/logger';
import { createAdminClient, isStructurizrApiError } from '../lib/structurizr';
import { pushWorkspace } from '../lib/docker';
import type { Config } from '../types';

/**
 * Copy directory contents recursively, skipping cache directories
 */
function copyDirectorySync(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Skip .structurizr directories (Lite cache)
      if (entry.name === '.structurizr') {
        continue;
      }
      copyDirectorySync(srcPath, destPath);
    } else {
      // Skip temporary files
      if (entry.name.endsWith('.dsl.dsl') || entry.name.endsWith('.dsl.json')) {
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function registerWorkspaceBranchCommand(program: Command): void {
  program
    .command('workspace:branch <workspace>')
    .description('Create a new workspace with its own workspace ID (branched from existing)')
    .option('--from <workspace>', 'Source workspace to branch from (default: current)')
    .option('--dry-run', 'Show what would be done without making changes')
    .action(async (workspace: string, options: { from?: string; dryRun?: boolean }) => {
      const config = loadConfig();

      logger.header('Workspace Branch');

      // Validate target workspace name format
      const validation = validateWorkspaceName(workspace);
      if (!validation.valid) {
        logger.error(validation.error || 'Invalid workspace format');
        logger.info('Workspace name must be in format qN-YYYY (e.g., q3-2025)');
        process.exit(1);
      }

      // Check if target already exists
      if (workspaceExists(config, workspace)) {
        logger.error(`Workspace '${workspace}' already exists`);
        logger.blank();
        logger.info('Existing workspaces:');
        const workspaces = listWorkspaces(config);
        logger.list(workspaces);
        process.exit(1);
      }

      // Determine source workspace
      let sourceWorkspace: string;
      try {
        sourceWorkspace = resolveWorkspace(config, options.from || 'current');
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      // Validate source workspace exists
      if (!workspaceExists(config, sourceWorkspace)) {
        logger.error(`Source workspace '${sourceWorkspace}' not found`);
        logger.blank();
        logger.info('Available workspaces:');
        const workspaces = listWorkspaces(config);
        if (workspaces.length > 0) {
          logger.list(workspaces);
        } else {
          logger.info('  (none)');
        }
        process.exit(1);
      }

      // Get source workspace info
      const sourceInfo = getWorkspacePromotionInfo(config, sourceWorkspace);
      if (!sourceInfo) {
        logger.error(`Could not load workspace info for '${sourceWorkspace}'`);
        process.exit(1);
      }

      logger.keyValue('New workspace', workspace);
      logger.keyValue('Branch from', sourceWorkspace);
      logger.keyValue('Source workspace ID', String(sourceInfo.workspaceId));
      if (sourceInfo.hasOwnWorkspaceId) {
        logger.keyValue('Source type', 'ID-based (new)');
      } else {
        logger.keyValue('Source type', 'Branch-based (legacy)');
        logger.keyValue('Source branch', sourceInfo.branch || 'main');
      }
      logger.blank();

      if (options.dryRun) {
        logger.info('DRY RUN - No changes will be made');
        logger.blank();
        logger.subheader('Would perform:');
        logger.info('  1. Copy DSL files from source workspace');
        logger.info('  2. Create new Structurizr workspace via Admin API');
        logger.info('  3. Push DSL content to new workspace');
        logger.info('  4. Update registry.yaml with new workspace ID and parent');
        logger.blank();
        return;
      }

      // Check admin API key
      if (!config.adminApiKey) {
        logger.error('STRUCTURIZR_ADMIN_API_KEY is required for workspace:branch');
        logger.info('Set it with: export STRUCTURIZR_ADMIN_API_KEY=your-admin-key');
        process.exit(1);
      }

      const targetDir = getWorkspaceDir(config, workspace);
      const sourceDir = getWorkspaceDir(config, sourceWorkspace);

      // Step 1: Copy DSL files
      const copySpinner = ora('Copying DSL files from source workspace...').start();
      try {
        copyDirectorySync(sourceDir, targetDir);
        copySpinner.succeed('DSL files copied');
      } catch (error) {
        copySpinner.fail('Failed to copy DSL files');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      // Step 2: Create new workspace via Admin API
      const createSpinner = ora('Creating new Structurizr workspace...').start();

      let newWorkspaceId: number;
      let newApiKey: string;
      let newApiSecret: string;

      try {
        const adminClient = createAdminClient({
          baseUrl: config.structurizrUrl.replace('/api', ''),
          adminApiKey: config.adminApiKey,
        });

        const result = await adminClient.createWorkspace();
        newWorkspaceId = result.id;
        newApiKey = result.apiKey;
        newApiSecret = result.apiSecret;

        createSpinner.succeed(`Created workspace ${newWorkspaceId}`);
      } catch (error) {
        createSpinner.fail('Failed to create workspace');
        // Clean up copied files
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true });
        }
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

      // Step 3: Push local DSL files to new workspace
      const pushSpinner = ora('Pushing workspace content...').start();
      try {
        const workspaceDslPath = path.join(targetDir, 'workspace.dsl');

        // Push local DSL files to the new workspace
        const success = await pushWorkspace(
          config,
          workspaceDslPath,
          config.structurizrUrl,
          String(newWorkspaceId),
          newApiKey,
          newApiSecret
          // No branch - ID-based workspaces don't use branches
        );

        if (success) {
          pushSpinner.succeed('Workspace content pushed');
        } else {
          pushSpinner.fail('Failed to push workspace content');
          logger.warn('Workspace created but content not pushed. You can promote manually.');
        }
      } catch (error) {
        pushSpinner.fail('Failed to push workspace content');
        logger.warn('Workspace created but content not pushed. You can promote manually.');
        if (isStructurizrApiError(error)) {
          logger.error(`API Error: ${error.message}`);
        } else {
          logger.error(error instanceof Error ? error.message : String(error));
        }
        // Continue anyway - the workspace exists
      }

      // Step 4: Update registry
      const registrySpinner = ora('Updating registry...').start();
      try {
        const success = addWorkspaceToRegistry(
          config,
          workspace,
          newWorkspaceId,
          newApiKey,
          newApiSecret,
          sourceWorkspace
        );

        if (success) {
          registrySpinner.succeed('Registry updated');
        } else {
          registrySpinner.fail('Failed to update registry');
          logger.warn('Workspace created but registry not updated. Update manually.');
        }
      } catch (error) {
        registrySpinner.fail('Failed to update registry');
        logger.error(error instanceof Error ? error.message : String(error));
      }

      logger.blank();
      logger.header('Branch Summary');
      logger.keyValue('New workspace', workspace);
      logger.keyValue('Workspace ID', String(newWorkspaceId));
      logger.keyValue('Parent workspace', sourceWorkspace);
      logger.keyValue('API Key', newApiKey);
      logger.keyValue('API Secret', newApiSecret.substring(0, 8) + '...');
      logger.blank();

      // Access URL
      const baseUrl = config.structurizrUrl.replace('/api', '');
      logger.subheader('Access Workspace');
      logger.info(`  ${baseUrl}/workspace/${newWorkspaceId}`);
      logger.blank();

      logger.success(`Workspace ${workspace} branched successfully!`);
      logger.blank();
      logger.info('Next steps:');
      logger.info(`  Edit:     Edit files in workspaces/${workspace}/`);
      logger.info(`  Validate: ./cli workspace:validate -w ${workspace}`);
      logger.info(`  Promote:  ./cli workspace:promote -w ${workspace}`);
      logger.info(`  Lineage:  ./cli workspace:lineage`);
    });
}
