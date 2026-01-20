import { Command } from 'commander';
import { loadConfig } from '../lib/config';
import { loadRegistry, listWorkspaces, getCurrentWorkspace } from '../lib/workspace-registry';
import { logger } from '../lib/logger';

export function registerListCommand(program: Command): void {
  program
    .command('workspace:list')
    .description('List all available workspaces')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options: { verbose?: boolean }) => {
      const config = loadConfig();

      logger.header('Available Workspaces');

      const workspaces = listWorkspaces(config);
      if (workspaces.length === 0) {
        logger.warn('No workspaces found');
        logger.blank();
        logger.info('Create a workspace with: ./cli workspace:create <name>');
        return;
      }

      const registry = loadRegistry(config);
      let currentWorkspace: string | null = null;
      try {
        currentWorkspace = getCurrentWorkspace(config);
      } catch {
        // No current workspace set
      }

      // Print header
      console.log('');
      console.log('  Workspace    Workspace ID   Parent       Status');
      console.log('  ──────────   ────────────   ──────────   ──────────');

      for (const workspace of workspaces) {
        const workspaceDef = registry?.workspaces?.[workspace];
        const isCurrent = workspace === currentWorkspace;
        const marker = isCurrent ? '*' : ' ';

        // Workspace ID
        const wsId = workspaceDef?.workspace_id
          ? String(workspaceDef.workspace_id).padEnd(12)
          : 'not set'.padEnd(12);

        // Parent
        const parent = (workspaceDef?.parent || '-').padEnd(12);

        // Status
        const status = workspaceDef?.status || 'unknown';

        console.log(`${marker} ${workspace.padEnd(12)} ${wsId} ${parent} ${status}`);

        if (options.verbose && workspaceDef) {
          console.log(`    Name: ${workspaceDef.name || workspace}`);
          console.log(`    Description: ${workspaceDef.description || 'N/A'}`);
          if (workspaceDef.api_key) {
            console.log(`    API Key: ${workspaceDef.api_key.substring(0, 8)}...`);
          }
          console.log('');
        }
      }

      logger.blank();
      if (currentWorkspace) {
        logger.keyValue('Current workspace', currentWorkspace);
      } else {
        logger.warn('No current workspace set');
      }
      logger.blank();
      logger.info('Legend: * = current workspace');

      if (!options.verbose) {
        logger.blank();
        logger.info('Use --verbose for detailed information');
      }
    });
}
