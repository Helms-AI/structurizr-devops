import { Command } from 'commander';
import { loadConfig } from '../lib/config';
import { composeLogs } from '../lib/compose';
import { logger } from '../lib/logger';

export function registerSystemLogsCommand(program: Command): void {
  program
    .command('system:logs')
    .description('View Structurizr On-Premises container logs')
    .option('-f, --follow', 'Follow log output')
    .action(async (options?: { follow?: boolean }) => {
      const config = loadConfig();

      if (!options?.follow) {
        logger.header('Structurizr On-Premises Logs');
      }

      await composeLogs(config, { follow: options?.follow, stream: true });
    });
}
