import { Command } from 'commander';
import { loadConfig, updateEnvFile } from '../lib/config';
import { checkGitHubCli, getRepoUrl, generateRunnerToken } from '../lib/github';
import { composeUpWithProfile } from '../lib/compose';
import { logger } from '../lib/logger';

interface RunnerInitOptions {
  name?: string;
  labels?: string;
  start?: boolean;
  dryRun?: boolean;
  pat?: string;
}

export function registerRunnerInitCommand(program: Command): void {
  program
    .command('runner:init')
    .description('Configure and optionally start the GitHub Actions self-hosted runner')
    .option('--name <name>', 'Runner name', 'structurizr-runner')
    .option('--labels <labels>', 'Additional labels (comma-separated)')
    .option('--start', 'Start the runner after configuration')
    .option('--dry-run', 'Show what would be configured without making changes')
    .option('--pat <token>', 'Use a Personal Access Token instead of registration token (persistent)')
    .action(async (options: RunnerInitOptions) => {
      const config = loadConfig();

      logger.header('GitHub Actions Runner Configuration');

      const usingPat = !!options.pat;
      const totalSteps = usingPat ? 3 : 4;

      // Step 1: Check GitHub CLI
      logger.step(1, totalSteps, 'Checking GitHub CLI...');
      const ghOk = await checkGitHubCli();
      if (!ghOk) {
        logger.error('GitHub CLI is not installed or not authenticated');
        logger.info('Run: gh auth login');
        process.exit(1);
      }
      logger.success('GitHub CLI authenticated');

      // Step 2: Get repository URL
      logger.step(2, totalSteps, 'Getting repository information...');
      const repoUrl = await getRepoUrl();
      if (!repoUrl) {
        logger.error('Failed to get repository URL');
        logger.info('Make sure you are in a git repository with a GitHub remote');
        process.exit(1);
      }
      logger.keyValue('Repository', repoUrl);

      let token: string;
      let tokenExpiry: string | null = null;

      if (usingPat) {
        // Use provided Personal Access Token
        token = options.pat!;
        logger.step(3, totalSteps, 'Using Personal Access Token (persistent)...');
        logger.success('PAT configured (does not expire)');
      } else {
        // Step 3: Generate runner token
        logger.step(3, totalSteps, 'Generating runner registration token...');
        const tokenResult = await generateRunnerToken();
        if (!tokenResult) {
          logger.error('Failed to generate runner registration token');
          logger.info('Make sure you have admin access to the repository');
          logger.blank();
          logger.info('Alternative: Use a Personal Access Token for persistent configuration:');
          logger.command('./cli runner:init --pat <your-pat>');
          process.exit(1);
        }
        token = tokenResult.token;
        tokenExpiry = tokenResult.expiresAt;
        logger.success('Token generated (valid for 1 hour)');
        logger.keyValue('Expires', tokenExpiry);
      }

      // Show configuration
      const runnerName = options.name || 'structurizr-runner';
      logger.blank();
      logger.subheader('Configuration');
      logger.keyValue('Runner name', runnerName);
      logger.keyValue('Labels', 'self-hosted,structurizr,nerdctl' + (options.labels ? `,${options.labels}` : ''));
      logger.keyValue('Repository URL', repoUrl);
      logger.keyValue('Token type', usingPat ? 'Personal Access Token (persistent)' : 'Registration token (1 hour)');

      if (options.dryRun) {
        logger.blank();
        logger.info('Dry run - no changes made');
        logger.blank();
        logger.info('Would update .env file with:');
        logger.keyValue('GITHUB_REPO_URL', repoUrl);
        logger.keyValue('GITHUB_RUNNER_TOKEN', `${token.substring(0, 10)}...`);
        logger.keyValue('GITHUB_RUNNER_NAME', runnerName);
        return;
      }

      // Step 4 (or 3 for PAT): Update .env file
      const updateStep = usingPat ? 3 : 4;
      logger.step(updateStep, totalSteps, 'Updating .env file...');
      updateEnvFile(config.envFile, {
        GITHUB_REPO_URL: repoUrl,
        GITHUB_RUNNER_TOKEN: token,
        GITHUB_RUNNER_NAME: runnerName,
      });
      logger.success('Environment file updated');
      logger.keyValue('File', config.envFile);

      logger.blank();
      logger.success('Runner configured successfully');

      if (!usingPat) {
        logger.blank();
        logger.warn('Note: Registration token expires in 1 hour');
        logger.info('For persistent configuration, use a Personal Access Token:');
        logger.command('./cli runner:init --pat <your-pat>');
      }

      if (options.start) {
        logger.blank();
        logger.header('Starting Runner');

        const result = await composeUpWithProfile(config, 'runner', {
          detached: true,
          stream: true,
          service: 'github-runner',
        });

        if (result.success) {
          logger.blank();
          logger.success('Runner started successfully');
          logger.info('Check runner status at:');
          logger.keyValue('URL', `${repoUrl}/settings/actions/runners`);
        } else {
          logger.blank();
          logger.error('Failed to start runner');
          process.exit(1);
        }
      } else {
        logger.blank();
        logger.info('To start the runner, run:');
        logger.command('./cli runner:start');
      }
    });
}
