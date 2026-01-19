import { Command } from 'commander';
import { checkGitHubCli, getRepoPath, getSecretInfo } from '../lib/github';
import { getEnvValue, getEnvFilePath, envFileExists } from '../lib/dotenv';
import { loadConfig } from '../lib/config';
import { logger } from '../lib/logger';
import type { Environment } from '../types';

export function registerSecretsGetCommand(program: Command): void {
  program
    .command('secrets:get <name>')
    .description('Get information about a secret (value not shown for security)')
    .requiredOption('-e, --environment <env>', 'Environment: local, Integration, or Production')
    .option('--repo', 'Check repository-level secret (shared across all environments)')
    .action(async (name: string, options: { environment: string; repo?: boolean }) => {
      const config = loadConfig();
      const environment = options.environment as Environment;

      // Validate environment
      if (!['local', 'Integration', 'Production'].includes(environment)) {
        logger.error(`Invalid environment: ${environment}`);
        logger.info('Valid environments: local, Integration, Production');
        process.exit(1);
      }

      // Handle local environment - read from .env file
      if (environment === 'local') {
        handleLocalSecretGet(config, name);
        return;
      }

      // Handle GitHub secrets
      await handleGitHubSecretGet(name, environment, options.repo);
    });
}

function handleLocalSecretGet(
  config: ReturnType<typeof loadConfig>,
  name: string
): void {
  logger.header('Get Local Secret (.env)');

  const envPath = getEnvFilePath(config);
  logger.keyValue('File', envPath);
  logger.keyValue('Name', name);
  logger.blank();

  if (!envFileExists(config)) {
    logger.error('.env file does not exist');
    process.exit(1);
  }

  const value = getEnvValue(config, name);

  if (value !== undefined) {
    // Check if it's a secret-like value (contains KEY or SECRET)
    const isSecret = name.includes('_KEY') || name.includes('_SECRET');
    if (isSecret) {
      logger.success(`Secret '${name}' exists`);
      logger.keyValue('Value', '***');
    } else {
      logger.success(`'${name}' found`);
      logger.keyValue('Value', value);
    }
  } else {
    logger.error(`'${name}' not found in .env file`);
    process.exit(1);
  }
}

async function handleGitHubSecretGet(
  name: string,
  environment: Environment,
  isRepo?: boolean
): Promise<void> {
  const level = isRepo ? 'Repository' : `Environment (${environment})`;
  logger.header(`Get GitHub Secret (${level})`);

  // Check GitHub CLI
  const ghAvailable = await checkGitHubCli();
  if (!ghAvailable) {
    logger.error('GitHub CLI (gh) is not installed or not authenticated');
    logger.info('Install: https://cli.github.com/');
    logger.info('Authenticate: gh auth login');
    process.exit(1);
  }

  const repoPath = await getRepoPath();
  if (!repoPath) {
    logger.error('Not in a GitHub repository');
    process.exit(1);
  }

  logger.keyValue('Repository', repoPath);
  logger.keyValue('Secret Name', name);
  logger.keyValue('Level', level);
  logger.blank();

  // Get secret info (GitHub expects lowercase environment names)
  const ghEnvName = isRepo ? undefined : environment.toLowerCase();
  const secretInfo = await getSecretInfo(name, ghEnvName);

  if (secretInfo) {
    logger.success(`Secret '${name}' exists`);
    if (secretInfo.updatedAt) {
      logger.keyValue('Last Updated', new Date(secretInfo.updatedAt).toLocaleString());
    }
    logger.blank();
    logger.info('Note: Secret values cannot be retrieved from GitHub for security reasons');
  } else {
    logger.error(`Secret '${name}' not found`);
    process.exit(1);
  }
}
