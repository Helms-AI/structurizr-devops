import { Command } from 'commander';
import ora from 'ora';
import { checkGitHubCli, getRepoPath, listEnvironments, createEnvironment } from '../lib/github';
import { logger } from '../lib/logger';
import type { Environment } from '../types';

/** All available environments */
const ALL_ENVIRONMENTS: Environment[] = ['Local', 'Integration', 'Production'];

/** GitHub environments (excludes Local) */
const GITHUB_ENVIRONMENTS: Environment[] = ALL_ENVIRONMENTS.filter((e) => e !== 'Local');

export function registerEnvironmentsInitCommand(program: Command): void {
  program
    .command('environments:init')
    .description('Create GitHub environments for CI/CD (Integration, Production)')
    .option('--dry-run', 'Show what would be created without making changes')
    .action(async (options: { dryRun?: boolean }) => {
      logger.header('GitHub Environments Setup');
      logger.blank();

      // Check GitHub CLI
      const spinner = ora('Checking GitHub CLI...').start();
      const ghAvailable = await checkGitHubCli();
      if (!ghAvailable) {
        spinner.fail('GitHub CLI not available or not authenticated');
        logger.blank();
        logger.info('Install GitHub CLI: https://cli.github.com/');
        logger.info('Authenticate: gh auth login');
        process.exit(1);
      }
      spinner.succeed('GitHub CLI authenticated');

      // Get repo info
      const repoPath = await getRepoPath();
      if (repoPath) {
        logger.keyValue('Repository', repoPath);
      } else {
        logger.error('Could not determine repository. Are you in a git repository?');
        process.exit(1);
      }
      logger.blank();

      // Show environments to create
      logger.subheader('Environments to initialize');
      for (const env of GITHUB_ENVIRONMENTS) {
        logger.info(`  - ${env}`);
      }
      logger.blank();

      if (options.dryRun) {
        logger.warn('DRY RUN - No changes made');
        return;
      }

      // Check existing environments
      const existingSpinner = ora('Checking existing environments...').start();
      const existing = await listEnvironments();
      existingSpinner.succeed(`Found ${existing.length} existing environment(s)`);

      // Create environments
      logger.blank();
      logger.subheader('Creating environments');

      let created = 0;
      let alreadyExists = 0;
      let failed = 0;

      for (const env of GITHUB_ENVIRONMENTS) {
        const envSpinner = ora(`Creating ${env}...`).start();
        const result = await createEnvironment(env);

        switch (result) {
          case 'created':
            envSpinner.succeed(`Created ${env}`);
            created++;
            break;
          case 'exists':
            envSpinner.succeed(`${env} already exists`);
            alreadyExists++;
            break;
          case 'failed':
            envSpinner.fail(`Failed to create ${env}`);
            failed++;
            break;
        }
      }

      // Summary
      logger.blank();
      logger.header('Summary');
      logger.keyValue('Created', String(created));
      logger.keyValue('Already existed', String(alreadyExists));
      logger.keyValue('Failed', String(failed));
      logger.blank();

      if (failed > 0) {
        logger.warn('Some environments failed to create');
        process.exit(1);
      }

      logger.success('All environments initialized!');
      logger.blank();
      logger.info('Next steps:');
      logger.info('  Configure secrets: ./cli secrets:init -e Integration');
      logger.info('  Configure secrets: ./cli secrets:init -e Production');
    });
}
