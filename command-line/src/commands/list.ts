import { Command } from 'commander';
import { loadConfig, getDomainCredentials } from '../lib/config';
import {
  listDomains,
  listPerspectives,
  listQuarters,
  listAllWorkspaces,
  loadDomainsRegistry,
  getDomainFromRegistry,
  getPerspectiveFromRegistry,
} from '../lib/domains';
import { logger } from '../lib/logger';

export function registerListCommand(program: Command): void {
  program
    .command('workspace:list')
    .description('List all available workspaces')
    .option('-q, --quarter <quarter>', 'Quarter to list (default: current)', 'current')
    .option('-v, --verbose', 'Show detailed information')
    .option('--quarters', 'List available quarters')
    .action(async (options: { quarter?: string; verbose?: boolean; quarters?: boolean }) => {
      const config = loadConfig();

      // List quarters mode
      if (options.quarters) {
        logger.header('Available Quarters');

        const quarters = listQuarters(config);
        if (quarters.length === 0) {
          logger.warn('No quarters found');
          return;
        }

        const registry = loadDomainsRegistry(config);
        const currentQuarter = registry?.current_quarter || 'unknown';

        for (const quarter of quarters) {
          const isCurrent = quarter === currentQuarter;
          const marker = isCurrent ? ' (current)' : '';
          console.log(`  ${quarter}${marker}`);
        }

        logger.blank();
        logger.keyValue('Current quarter', currentQuarter);
        logger.info('Symlink: workspaces/current -> ' + currentQuarter);
        return;
      }

      const quarter = options.quarter || 'current';

      logger.header('Available Workspaces');
      logger.keyValue('Quarter', quarter);
      logger.blank();

      const workspaces = listAllWorkspaces(config, quarter);

      if (workspaces.length === 0) {
        logger.warn(`No workspaces found in quarter '${quarter}'`);
        logger.blank();
        logger.info('Available quarters:');
        const quarters = listQuarters(config);
        if (quarters.length > 0) {
          logger.list(quarters);
        } else {
          logger.info('  (none)');
        }
        return;
      }

      const registry = loadDomainsRegistry(config);
      const domains = workspaces.filter((w) => w.type === 'domain');
      const perspectives = workspaces.filter((w) => w.type === 'perspective');

      // List domains
      if (domains.length > 0) {
        logger.subheader('Domains');

        for (const workspace of domains) {
          const domainInfo = getDomainFromRegistry(config, workspace.name);
          const credentials = getDomainCredentials(workspace.name);

          if (options.verbose) {
            logger.info(`--- ${workspace.name} ---`);
            if (domainInfo) {
              logger.keyValue('Name', domainInfo.name);
              logger.keyValue('Description', domainInfo.description);
              logger.keyValue('Owner', domainInfo.owner);
              logger.keyValue('Workspace ID', String(domainInfo.workspace_id || 'not set'));
              logger.keyValue('Port', String(domainInfo.port));
              logger.keyValue('Tags', domainInfo.tags?.join(', ') || 'none');
            }
            logger.keyValue('Credentials', credentials.workspaceKey ? 'configured' : 'missing');
            logger.blank();
          } else {
            const wsId = workspace.workspaceId ? `[ID: ${workspace.workspaceId}]` : '[no ID]';
            const port = domainInfo?.port ? `:${domainInfo.port}` : '';
            console.log(`  ${workspace.name}${port} ${wsId}`);
          }
        }

        if (!options.verbose) {
          logger.blank();
        }
      }

      // List perspectives
      if (perspectives.length > 0) {
        logger.subheader('Perspectives');

        for (const workspace of perspectives) {
          const perspectiveInfo = getPerspectiveFromRegistry(config, workspace.name);
          const credentials = getDomainCredentials(workspace.name);

          if (options.verbose) {
            logger.info(`--- ${workspace.name} ---`);
            if (perspectiveInfo) {
              logger.keyValue('Name', perspectiveInfo.name);
              logger.keyValue('Description', perspectiveInfo.description);
              logger.keyValue('Workspace ID', String(perspectiveInfo.workspace_id || 'not set'));
              logger.keyValue('Port', String(perspectiveInfo.port));
              logger.keyValue('Includes', perspectiveInfo.includes?.join(', ') || 'none');
            }
            logger.keyValue('Credentials', credentials.workspaceKey ? 'configured' : 'missing');
            logger.blank();
          } else {
            const wsId = workspace.workspaceId ? `[ID: ${workspace.workspaceId}]` : '[no ID]';
            const port = perspectiveInfo?.port ? `:${perspectiveInfo.port}` : '';
            console.log(`  ${workspace.name}${port} ${wsId}`);
          }
        }

        if (!options.verbose) {
          logger.blank();
        }
      }

      // Summary
      logger.keyValue('Total workspaces', String(workspaces.length));

      if (!options.verbose) {
        logger.blank();
        logger.info('Use --verbose for detailed information');
        logger.info('Use --quarters to list available quarters');
      }
    });
}
