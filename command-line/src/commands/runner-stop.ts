import { Command } from 'commander';
import { loadConfig } from '../lib/config';
import { composeStopService, composeRmService } from '../lib/compose';
import { logger } from '../lib/logger';

interface RunnerStopOptions {
  remove?: boolean;
}

export function registerRunnerStopCommand(program: Command): void {
  program
    .command('runner:stop')
    .description('Stop the GitHub Actions self-hosted runner')
    .option('--remove', 'Remove the container after stopping')
    .action(async (options: RunnerStopOptions) => {
      const config = loadConfig();

      logger.header('Stopping GitHub Actions Runner');
      logger.keyValue('Containers directory', config.containersDir);
      logger.blank();

      const stopResult = await composeStopService(config, 'github-runner', {
        stream: true,
        profile: 'runner',
      });

      if (stopResult.success) {
        logger.blank();
        logger.success('Runner stopped successfully');

        if (options.remove) {
          logger.blank();
          logger.info('Removing container...');
          const rmResult = await composeRmService(config, 'github-runner', {
            stream: true,
            profile: 'runner',
            force: true,
          });

          if (rmResult.success) {
            logger.success('Container removed');
          } else {
            logger.warn('Failed to remove container');
          }
        }
      } else {
        logger.blank();
        logger.error('Failed to stop runner');
        logger.info('The runner may not be running. Check status with: ./cli runner:status');
        process.exit(1);
      }
    });
}
