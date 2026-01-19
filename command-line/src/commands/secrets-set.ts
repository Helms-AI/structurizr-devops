import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../lib/config';
import { checkGitHubCli, setSecret, setEnvironmentSecret, getRepoPath } from '../lib/github';
import { setEnvValue, getEnvFilePath } from '../lib/dotenv';
import { logger } from '../lib/logger';
import type { Environment } from '../types';

const VALID_ENVIRONMENTS = ['local', 'Integration', 'Production'];

export function registerSecretsSetCommand(program: Command): void {
  program
    .command('secrets:set <name> <value>')
    .description('Set a secret for an environment')
    .requiredOption('-e, --environment <env>', 'Environment: local, Integration, or Production')
    .option('--repo', 'Set as repository-level secret (shared across all environments)')
    .action(async (name: string, value: string, options: { environment: string; repo?: boolean }) => {
      const config = loadConfig();
      const environment = options.environment as Environment;

      // Validate environment
      if (!VALID_ENVIRONMENTS.includes(environment)) {
        logger.error(`Invalid environment: ${environment}`);
        logger.info('Valid environments: local, Integration, Production');
        process.exit(1);
      }

      // Handle local environment - write to .env file
      if (environment === 'local') {
        await handleLocalSecret(config, name, value);
        return;
      }

      // Handle GitHub environments
      await handleGitHubSecret(name, value, environment, options.repo);
    });
}

async function handleLocalSecret(
  config: ReturnType<typeof loadConfig>,
  name: string,
  value: string
): Promise<void> {
  logger.header('Set Local Secret (.env)');

  const envPath = getEnvFilePath(config);
  logger.keyValue('File', envPath);
  logger.keyValue('Name', name);
  logger.blank();

  const spinner = ora(`Setting '${name}'...`).start();
  const success = setEnvValue(config, name, value);

  if (success) {
    spinner.succeed(`'${name}' set in .env file`);
  } else {
    spinner.fail(`Failed to set '${name}'`);
    process.exit(1);
  }
}

async function handleGitHubSecret(
  name: string,
  value: string,
  environment: Environment,
  isRepo?: boolean
): Promise<void> {
  const level = isRepo ? 'Repository' : `Environment (${environment})`;
  logger.header(`Set GitHub Secret (${level})`);

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
  }
  logger.keyValue('Secret Name', name);
  logger.keyValue('Level', level);
  logger.blank();

  // Set the secret
  const setSpinner = ora(`Setting secret '${name}'...`).start();
  let success: boolean;

  if (isRepo) {
    // Repository-level secret (shared across all environments)
    success = await setSecret(name, value);
  } else {
    // Environment-specific secret (lowercase for GitHub API)
    const ghEnvName = environment.toLowerCase();
    success = await setEnvironmentSecret(name, value, ghEnvName);
  }

  if (success) {
    setSpinner.succeed(`Secret '${name}' set successfully`);
  } else {
    setSpinner.fail(`Failed to set secret '${name}'`);
    process.exit(1);
  }
}
