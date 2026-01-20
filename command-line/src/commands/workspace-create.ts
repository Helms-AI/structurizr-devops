import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../lib/config';
import {
  domainExists,
  validateDomainName,
  toTitleCase,
  getNextAvailablePort,
} from '../lib/domains';
import { logger } from '../lib/logger';

function generateWorkspaceDsl(domain: string, description: string): string {
  const title = toTitleCase(domain);
  const systemName = domain.replace(/-/g, '') + 'System';

  return `workspace "${title} Domain" "${description}" {

    !identifiers hierarchical

    model {
        # =============================================================================
        # Domain-Specific Elements
        # =============================================================================

        # TODO: Define your domain's software system
        ${systemName} = softwareSystem "${title} System" "${description}" {
            tags "Domain" "${title}"

            # TODO: Define containers
            # api = container "${title} API" "REST API for ${title}" {
            #     technology "TypeScript, NestJS"
            #     tags "Microservice"
            # }
            #
            # database = container "${title} Database" "Data store" {
            #     technology "PostgreSQL"
            #     tags "Database"
            # }
        }

        # =============================================================================
        # Relationships
        # =============================================================================
        # TODO: Define relationships with other systems and domains
    }

    views {
        # =============================================================================
        # System Context
        # =============================================================================
        systemContext ${systemName} "${title}Context" {
            include *
            autoLayout
            description "${title} system context showing external dependencies"
        }

        # =============================================================================
        # Container View
        # =============================================================================
        container ${systemName} "${title}Containers" {
            include *
            autoLayout
            description "${title} containers and their relationships"
        }

        # =============================================================================
        # Styles
        # =============================================================================
        styles {
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "Container" {
                background #438dd5
                color #ffffff
            }
            element "Database" {
                shape cylinder
            }
            element "Domain" {
                background #1168bd
            }
        }

        theme default
    }

}
`;
}

export function registerWorkspaceCreateCommand(program: Command): void {
  program
    .command('workspace:create <name>')
    .description('Scaffold new domain workspace files')
    .option('-o, --owner <owner>', 'Team or person responsible', 'TBD')
    .option('-d, --description <description>', 'Short description of the domain')
    .option('-q, --quarter <quarter>', 'Quarter to create in (default: current)', 'current')
    .option('-t, --type <type>', 'Workspace type: domain or perspective', 'domain')
    .action(async (name: string, options: { owner: string; description?: string; quarter?: string; type?: string }) => {
      const config = loadConfig();
      const quarter = options.quarter || 'current';
      const type = options.type === 'perspective' ? 'perspective' : 'domain';
      const typeDir = type === 'domain' ? 'domains' : 'perspectives';

      logger.header(`Creating New ${type === 'domain' ? 'Domain' : 'Perspective'}: ${name}`);
      logger.keyValue('Quarter', quarter);
      logger.blank();

      logger.step('Validating name...');
      const validation = validateDomainName(name);
      if (!validation.valid) {
        logger.error(validation.error || 'Invalid name');
        process.exit(1);
      }

      if (domainExists(config, name, quarter)) {
        const existingPath = path.join(config.workspacesDir, quarter, typeDir, name);
        logger.error(`Workspace '${name}' already exists at ${existingPath}`);
        process.exit(1);
      }
      logger.success('Name is valid');

      const port = getNextAvailablePort(config);
      logger.keyValue('Suggested port', String(port));

      const description = options.description || `${name} ${type}`;

      logger.step('Creating workspace directory...');
      const workspaceDir = path.join(config.workspacesDir, quarter, typeDir, name);
      fs.mkdirSync(workspaceDir, { recursive: true });
      logger.success(`Created ${workspaceDir}`);

      logger.step('Creating workspace.dsl...');
      const workspaceDsl = generateWorkspaceDsl(name, description);
      fs.writeFileSync(path.join(workspaceDir, 'workspace.dsl'), workspaceDsl);
      logger.success('Created workspace.dsl with starter template');

      logger.blank();
      logger.header('Workspace Created Successfully!');

      logger.keyValue('Name', name);
      logger.keyValue('Type', type);
      logger.keyValue('Owner', options.owner);
      logger.keyValue('Description', description);
      logger.keyValue('Directory', workspaceDir);
      logger.blank();

      logger.header('Next Steps');

      const upperName = name.toUpperCase().replace(/-/g, '_');
      console.log(`1. Edit the workspace.dsl file:
   ${workspaceDir}/workspace.dsl

2. Add the workspace to domains.yaml with a workspace_id:
   ${type}s:
     ${name}:
       name: ${toTitleCase(name)}
       workspace_id: <assign ID>
       ...

3. Configure local credentials (.env):
   STRUCTURIZR_${upperName}_WORKSPACE_ID=<id>
   STRUCTURIZR_${upperName}_WORKSPACE_KEY=<key>
   STRUCTURIZR_${upperName}_WORKSPACE_SECRET=<secret>

4. Configure GitHub secrets (for CI/CD):
   ./cli secrets:sync  # Syncs workspace ID from domains.yaml
   ./cli secrets:init -e Integration  # Set API keys per environment

5. Validate the workspace:
   ./cli workspace:validate ${name}

6. (Optional) Edit visually with Structurizr Lite:
   ./scripts/lite.sh ${name}
`);
    });
}
