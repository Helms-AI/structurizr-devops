import { Command } from 'commander';
import { loadConfig } from '../lib/config';
import { composeUp, composeLogs } from '../lib/compose';
import { logger } from '../lib/logger';

export function registerSystemStartCommand(program: Command): void {
  program
    .command('system:start')
    .description('Start the Structurizr On-Premises container')
    .option('--logs', 'Follow container logs after starting')
    .action(async (options?: { logs?: boolean }) => {
      const config = loadConfig();

      logger.header('Starting Structurizr On-Premises');
      logger.keyValue('Containers directory', config.containersDir);
      logger.blank();

      const result = await composeUp(config, { stream: true });

      if (result.success) {
        logger.blank();
        logger.success('Structurizr On-Premises started successfully');
        logger.keyValue('URL', 'http://localhost:20000');
        logger.keyValue('Health check', 'http://localhost:20000/health');

        if (options?.logs) {
          logger.blank();
          logger.info('Following logs (Ctrl+C to exit)...');
          logger.blank();
          await composeLogs(config, { follow: true, stream: true });
        }
      } else {
        logger.blank();
        logger.error('Failed to start Structurizr On-Premises');
        process.exit(1);
      }
    });
}
