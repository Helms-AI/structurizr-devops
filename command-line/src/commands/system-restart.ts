import { Command } from 'commander';
import { loadConfig } from '../lib/config';
import { composeRestart } from '../lib/compose';
import { logger } from '../lib/logger';

export function registerSystemRestartCommand(program: Command): void {
  program
    .command('system:restart')
    .description('Restart the Structurizr On-Premises container')
    .action(async () => {
      const config = loadConfig();

      logger.header('Restarting Structurizr On-Premises');
      logger.keyValue('Containers directory', config.containersDir);
      logger.blank();

      const result = await composeRestart(config, { stream: true });

      if (result.success) {
        logger.blank();
        logger.success('Structurizr On-Premises restarted successfully');
        logger.keyValue('URL', 'http://localhost:20000');
        logger.keyValue('Health check', 'http://localhost:20000/health');
      } else {
        logger.blank();
        logger.error('Failed to restart Structurizr On-Premises');
        process.exit(1);
      }
    });
}
