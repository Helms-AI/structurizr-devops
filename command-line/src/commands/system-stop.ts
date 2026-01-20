import { Command } from 'commander';
import { loadConfig } from '../lib/config';
import { composeDown } from '../lib/compose';
import { logger } from '../lib/logger';

export function registerSystemStopCommand(program: Command): void {
  program
    .command('system:stop')
    .description('Stop the Structurizr On-Premises container')
    .action(async () => {
      const config = loadConfig();

      logger.header('Stopping Structurizr On-Premises');
      logger.keyValue('Containers directory', config.containersDir);
      logger.blank();

      const result = await composeDown(config, { stream: true });

      if (result.success) {
        logger.blank();
        logger.success('Structurizr On-Premises stopped successfully');
      } else {
        logger.blank();
        logger.error('Failed to stop Structurizr On-Premises');
        process.exit(1);
      }
    });
}
