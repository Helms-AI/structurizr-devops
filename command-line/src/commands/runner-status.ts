import { Command } from 'commander';
import { loadConfig, getEnvValue } from '../lib/config';
import { composePs } from '../lib/compose';
import { getRunnerByName, getRepoUrl } from '../lib/github';
import { logger } from '../lib/logger';

export function registerRunnerStatusCommand(program: Command): void {
  program
    .command('runner:status')
    .description('Check the status of the GitHub Actions self-hosted runner')
    .action(async () => {
      const config = loadConfig();

      logger.header('GitHub Actions Runner Status');

      // Check configuration
      const repoUrl = getEnvValue(config.envFile, 'GITHUB_REPO_URL');
      const runnerName = getEnvValue(config.envFile, 'GITHUB_RUNNER_NAME') || 'structurizr-runner';

      logger.subheader('Configuration');
      if (repoUrl) {
        logger.keyValue('Repository', repoUrl);
        logger.keyValue('Runner name', runnerName);
      } else {
        logger.warn('Runner not configured');
        logger.info('Run: ./cli runner:init');
        return;
      }

      // Check container status
      logger.subheader('Container Status');
      const services = await composePs(config, 'github-runner');
      const runnerService = services.find((s) => s.name === 'github-runner');

      if (runnerService) {
        logger.keyValue('State', runnerService.status || 'unknown');
        logger.keyValue('Running', runnerService.running ? 'yes' : 'no');
        if (runnerService.health) {
          logger.keyValue('Health', runnerService.health);
        }
      } else {
        logger.keyValue('State', 'not running');
        logger.info('Start with: ./cli runner:start');
      }

      // Check GitHub registration status
      logger.subheader('GitHub Registration');
      const ghRunner = await getRunnerByName(runnerName);

      if (ghRunner) {
        logger.keyValue('Status', ghRunner.status);
        logger.keyValue('Busy', ghRunner.busy ? 'yes' : 'no');
        logger.keyValue('OS', ghRunner.os);
        logger.keyValue('Labels', ghRunner.labels.map((l) => l.name).join(', '));
      } else {
        logger.keyValue('Status', 'not registered');
        logger.info('The runner may still be starting up');
      }

      // Show link to GitHub settings
      logger.blank();
      const actualRepoUrl = await getRepoUrl();
      if (actualRepoUrl) {
        logger.info('View runners in GitHub:');
        logger.keyValue('URL', `${actualRepoUrl}/settings/actions/runners`);
      }
    });
}
