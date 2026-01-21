import { Command } from 'commander';
import { loadConfig, getEnvValue } from '../lib/config';
import { getRepoUrl, generateRunnerToken } from '../lib/github';
import { updateEnvFile } from '../lib/config';
import { composeUpWithProfile, composeLogs } from '../lib/compose';
import { logger } from '../lib/logger';

interface RunnerStartOptions {
  logs?: boolean;
  refreshToken?: boolean;
}

export function registerRunnerStartCommand(program: Command): void {
  program
    .command('runner:start')
    .description('Start the GitHub Actions self-hosted runner')
    .option('--logs', 'Follow container logs after starting')
    .option('--refresh-token', 'Generate a fresh runner registration token before starting')
    .action(async (options: RunnerStartOptions) => {
      const config = loadConfig();

      logger.header('Starting GitHub Actions Runner');

      // Check if runner is configured
      const repoUrl = getEnvValue(config.envFile, 'GITHUB_REPO_URL');
      const existingToken = getEnvValue(config.envFile, 'GITHUB_RUNNER_TOKEN');

      if (!repoUrl || !existingToken) {
        logger.error('Runner not configured');
        logger.info('Run: ./cli runner:init');
        process.exit(1);
      }

      // Optionally refresh the token (recommended since tokens expire after 1 hour)
      if (options.refreshToken) {
        logger.info('Refreshing runner registration token...');
        const tokenResult = await generateRunnerToken();
        if (!tokenResult) {
          logger.warn('Failed to refresh token, using existing token');
        } else {
          updateEnvFile(config.envFile, {
            GITHUB_RUNNER_TOKEN: tokenResult.token,
          });
          logger.success('Token refreshed');
        }
      }

      logger.keyValue('Repository', repoUrl);
      logger.keyValue('Containers directory', config.containersDir);
      logger.blank();

      const result = await composeUpWithProfile(config, 'runner', {
        detached: true,
        stream: true,
        service: 'github-runner',
      });

      if (result.success) {
        logger.blank();
        logger.success('Runner started successfully');

        // Get the actual repo URL for the settings link
        const actualRepoUrl = await getRepoUrl();
        if (actualRepoUrl) {
          logger.info('Check runner status at:');
          logger.keyValue('URL', `${actualRepoUrl}/settings/actions/runners`);
        }

        if (options.logs) {
          logger.blank();
          logger.info('Following logs (Ctrl+C to exit)...');
          logger.blank();
          await composeLogs(config, { follow: true, stream: true });
        }
      } else {
        logger.blank();
        logger.error('Failed to start runner');
        logger.info('If the token has expired, try: ./cli runner:start --refresh-token');
        process.exit(1);
      }
    });
}
