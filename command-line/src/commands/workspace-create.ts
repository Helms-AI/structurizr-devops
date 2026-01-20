import { Command } from 'commander';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../lib/config';
import {
  listWorkspaces,
  resolveWorkspace,
  loadRegistry,
  saveRegistry,
} from '../lib/workspace-registry';
import { setEnvValue } from '../lib/dotenv';
import { logger } from '../lib/logger';
import * as git from '../lib/git';
import type { WorkspaceCredentials, WorkspaceRegistry } from '../types';

interface CreateWorkspaceResponse {
  id?: number;
  workspaceId?: number;
  apiKey?: string;
  key?: string;
  apiSecret?: string;
  secret?: string;
}

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

/**
 * Create a new workspace with the unified structure and default DSL files
 */
function createEmptyWorkspaceStructure(dest: string, workspaceName: string): void {
  // Create directory structure
  fs.mkdirSync(path.join(dest, 'model', 'domains'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'views', 'domains'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'views', 'perspectives'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'styles'), { recursive: true });

  // Format workspace name for display (e.g., "q1-2026" -> "Q1 2026")
  const displayName = workspaceName.toUpperCase().replace('-', ' ');

  // Create workspace.dsl
  const workspaceDsl = `workspace "${displayName} Architecture" "Architecture workspace for ${displayName}" {

    !identifiers hierarchical

    model {
        !include model/people.dsl
        !include model/external-systems.dsl
    }

    views {
        !include views/landscape.dsl
        !include styles/theme.dsl
    }

}
`;
  fs.writeFileSync(path.join(dest, 'workspace.dsl'), workspaceDsl);

  // Create model/people.dsl
  const peopleDsl = `# People / Actors
# Define users and stakeholders here

# Example:
# user = person "User" "A user of the system" {
#     tags "External"
# }
`;
  fs.writeFileSync(path.join(dest, 'model', 'people.dsl'), peopleDsl);

  // Create model/external-systems.dsl
  const externalSystemsDsl = `# External Systems
# Define external dependencies here

# Example:
# emailSystem = softwareSystem "Email System" "External email service" {
#     tags "External"
# }
`;
  fs.writeFileSync(path.join(dest, 'model', 'external-systems.dsl'), externalSystemsDsl);

  // Create views/landscape.dsl
  const landscapeDsl = `# System Landscape Views

systemLandscape "SystemLandscape" "Overview of all systems" {
    include *
    autoLayout
}
`;
  fs.writeFileSync(path.join(dest, 'views', 'landscape.dsl'), landscapeDsl);

  // Create styles/theme.dsl
  const themeDsl = `styles {
    element "Software System" {
        background #1168bd
        color #ffffff
        shape RoundedBox
    }
    element "Person" {
        background #08427b
        color #ffffff
        shape Person
    }
    element "External" {
        background #999999
        color #ffffff
    }
    element "Container" {
        background #438dd5
        color #ffffff
    }
    element "Component" {
        background #85bbf0
        color #000000
    }
}
`;
  fs.writeFileSync(path.join(dest, 'styles', 'theme.dsl'), themeDsl);
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
 * Add workspace to registry.yaml with credentials
 */
function addWorkspaceToRegistry(
  config: { sharedDir: string },
  workspace: string,
  credentials: WorkspaceCredentials,
  parent?: string
): boolean {
  const registryPath = path.join(config.sharedDir, 'registry.yaml');

  try {
    let registry: WorkspaceRegistry;

    if (fs.existsSync(registryPath)) {
      const content = fs.readFileSync(registryPath, 'utf-8');
      const { parse } = require('yaml');
      registry = parse(content) as WorkspaceRegistry;
    } else {
      registry = {
        lite_port: 20100,
        current_workspace: workspace,
        workspaces: {},
      };
    }

    // Ensure workspaces object exists
    if (!registry.workspaces) {
      registry.workspaces = {};
    }

    // Format workspace name for display (e.g., "q1-2026" -> "Q1 2026")
    const displayName = workspace.toUpperCase().replace('-', ' ');

    // Add workspace entry
    registry.workspaces[workspace] = {
      name: displayName,
      description: `${displayName} architecture workspace`,
      status: 'active',
      workspace_file: 'workspace.dsl',
      workspace_id: parseInt(credentials.id, 10),
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
      ...(parent && { parent }),
    };

    // Update current_workspace to the new workspace
    registry.current_workspace = workspace;

    saveRegistry(config as Parameters<typeof saveRegistry>[0], registry);
    return true;
  } catch (error) {
    logger.error(`Failed to update registry.yaml: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export function registerWorkspaceCreateCommand(program: Command): void {
  program
    .command('workspace:create <workspace>')
    .description('Create a new workspace directory and initialize in Structurizr')
    .option('--empty', 'Create empty structure instead of copying from source')
    .option('--from <workspace>', 'Copy from specific workspace instead of current')
    .option('--dry-run', 'Show what would be done without making changes')
    .action(async (workspace: string, options: { empty?: boolean; from?: string; dryRun?: boolean }) => {
      const config = loadConfig();

      logger.header('Create New Workspace');

      if (!git.validateQuarterFormat(workspace)) {
        logger.error(`Invalid workspace format: ${workspace} (expected: qN-YYYY)`);
        process.exit(1);
      }

      const targetDir = path.join(config.workspacesDir, workspace);

      // Determine source - resolve 'current' to actual workspace name
      let sourceWorkspace: string | undefined;
      if (options.from) {
        // Validate explicit source format
        if (!git.validateQuarterFormat(options.from)) {
          logger.error(`Invalid source workspace format: ${options.from} (expected: qN-YYYY)`);
          process.exit(1);
        }
        sourceWorkspace = options.from;
      } else if (!options.empty) {
        // Resolve 'current' from registry when copying
        try {
          sourceWorkspace = resolveWorkspace(config, 'current');
        } catch {
          // No current workspace - default to empty
          logger.info('No current workspace found, creating empty structure');
          options.empty = true;
        }
      }
      const sourceDir = sourceWorkspace ? path.join(config.workspacesDir, sourceWorkspace) : '';

      logger.keyValue('New workspace', workspace);
      if (!options.empty && sourceWorkspace) {
        logger.keyValue('Copy from', sourceWorkspace);
      } else {
        logger.keyValue('Mode', 'Empty structure');
      }
      logger.blank();

      if (options.dryRun) {
        logger.info('DRY RUN - No changes will be made');
        logger.blank();
      }

      // Check if target already exists
      if (fs.existsSync(targetDir)) {
        logger.error(`Workspace directory already exists: ${targetDir}`);
        logger.blank();
        logger.info('Existing workspaces:');
        const workspaces = listWorkspaces(config);
        logger.list(workspaces);
        process.exit(1);
      }

      // Check if source exists (unless creating empty)
      if (!options.empty && sourceDir) {
        if (!fs.existsSync(sourceDir)) {
          logger.error(`Source workspace directory does not exist: ${sourceDir}`);
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
      }

      // Check admin API key (needed for Structurizr workspace creation)
      if (!config.adminApiKey && !options.dryRun) {
        logger.error('STRUCTURIZR_ADMIN_API_KEY environment variable is not set');
        logger.blank();
        logger.info('Set it in containers/.env or export it:');
        logger.info('  export STRUCTURIZR_ADMIN_API_KEY=your-admin-key');
        process.exit(1);
      }

      // Check target URL
      if (!config.structurizrUrl && !options.dryRun) {
        logger.error('STRUCTURIZR_URL environment variable is not set');
        logger.info('Set it in containers/.env or export it:');
        logger.info('  export STRUCTURIZR_URL=http://localhost:20000/api');
        process.exit(1);
      }

      // Step 1: Create the directory
      const dirSpinner = ora(`Creating ${workspace} directory...`).start();

      if (options.dryRun) {
        if (options.empty || !sourceWorkspace) {
          dirSpinner.info(`Would create empty directory structure: ${targetDir}`);
        } else {
          dirSpinner.info(`Would copy from ${sourceWorkspace} to ${targetDir}`);
        }
      } else {
        try {
          if (options.empty || !sourceWorkspace) {
            createEmptyWorkspaceStructure(targetDir, workspace);
            dirSpinner.succeed(`Created ${workspace} with unified workspace structure`);
          } else {
            copyDirectorySync(sourceDir, targetDir);
            dirSpinner.succeed(`Created ${workspace} directory from ${sourceWorkspace}`);
          }
        } catch (error) {
          dirSpinner.fail('Failed to create directory');
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }

      // Step 2: Create Structurizr workspace via Admin API
      logger.blank();
      logger.keyValue('Target URL', config.structurizrUrl.replace('/api', ''));

      const apiSpinner = ora('Creating Structurizr workspace via Admin API...').start();

      if (options.dryRun) {
        apiSpinner.info('Would create Structurizr workspace via Admin API');
        logger.blank();
        logger.success(`Workspace ${workspace} would be created successfully!`);
        return;
      }

      let credentials: WorkspaceCredentials;
      try {
        credentials = await createWorkspaceViaApi(
          config.structurizrUrl,
          config.adminApiKey
        );
        apiSpinner.succeed('Structurizr workspace created!');
      } catch (error) {
        apiSpinner.fail('Failed to create Structurizr workspace');
        logger.error(error instanceof Error ? error.message : String(error));
        logger.blank();
        logger.warn(`Directory ${workspace} was created but Structurizr workspace failed.`);
        logger.info('You can retry with: ./cli workspace:delete ' + workspace + ' && ./cli workspace:create ' + workspace);
        process.exit(1);
      }

      logger.blank();
      logger.subheader('Workspace Credentials');
      logger.keyValue('Workspace ID', credentials.id);
      logger.keyValue('API Key', credentials.apiKey);
      logger.keyValue('API Secret', credentials.apiSecret.substring(0, 8) + '...');
      logger.blank();

      // Step 3: Save credentials to .env
      const envSpinner = ora('Saving credentials to .env...').start();
      try {
        setEnvValue(config, 'STRUCTURIZR_WORKSPACE_ID', credentials.id);
        setEnvValue(config, 'STRUCTURIZR_WORKSPACE_KEY', credentials.apiKey);
        setEnvValue(config, 'STRUCTURIZR_WORKSPACE_SECRET', credentials.apiSecret);
        envSpinner.succeed('Credentials saved to .env');
      } catch (error) {
        envSpinner.warn('Could not save to .env: ' + (error instanceof Error ? error.message : String(error)));
      }

      // Step 4: Add to registry.yaml
      const regSpinner = ora('Adding workspace to registry.yaml...').start();
      const parent = sourceWorkspace && !options.empty ? sourceWorkspace : undefined;
      if (addWorkspaceToRegistry(config, workspace, credentials, parent)) {
        regSpinner.succeed(`Added ${workspace} to registry.yaml`);
      } else {
        regSpinner.fail('Failed to update registry.yaml');
      }

      logger.blank();
      logger.success(`Workspace ${workspace} created successfully!`);
      logger.blank();
      logger.info('Next steps:');
      logger.info(`  Edit:     Edit files in workspaces/${workspace}/`);
      logger.info(`  Validate: ./cli workspace:validate -w ${workspace}`);
      logger.info(`  Promote:  ./cli workspace:promote -w ${workspace}`);
    });
}
