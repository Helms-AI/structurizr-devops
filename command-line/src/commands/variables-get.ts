import { Command } from 'commander';
import { checkGitHubCli, getRepoPath, getVariable } from '../lib/github';
import { getEnvValue, getEnvFilePath, envFileExists } from '../lib/dotenv';
import { loadConfig } from '../lib/config';
import { logger } from '../lib/logger';
import type { Environment } from '../types';

export function registerVariablesGetCommand(program: Command): void {
  program
    .command('variables:get <name>')
    .description('Get a specific environment variable')
    .requiredOption('-e, --environment <env>', 'Environment: local, Integration, or Production')
    .action(async (name: string, options: { environment: string }) => {
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
        handleLocalVariableGet(config, name);
        return;
      }

      // Handle GitHub variables
      await handleGitHubVariableGet(name, environment);
    });
}

function handleLocalVariableGet(
  config: ReturnType<typeof loadConfig>,
  name: string
): void {
  logger.header('Get Local Variable (.env)');

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
      logger.success(`'${name}' found`);
      logger.keyValue('Value', '***');
      logger.blank();
      logger.info('Tip: Use secrets:get for secret values');
    } else {
      logger.success(`'${name}' found`);
      logger.keyValue('Value', value);
    }
  } else {
    logger.error(`'${name}' not found in .env file`);
    process.exit(1);
  }
}

async function handleGitHubVariableGet(
  name: string,
  environment: Environment
): Promise<void> {
  logger.header(`Get GitHub Variable (${environment})`);

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
  logger.keyValue('Environment', environment);
  logger.keyValue('Variable Name', name);
  logger.blank();

  // Get variable (GitHub expects lowercase environment names)
  const ghEnvName = environment.toLowerCase();
  const variable = await getVariable(name, ghEnvName);

  if (variable) {
    logger.success(`Variable '${name}' found`);
    logger.keyValue('Value', variable.value);
    if (variable.updatedAt) {
      logger.keyValue('Last Updated', new Date(variable.updatedAt).toLocaleString());
    }
  } else {
    logger.error(`Variable '${name}' not found in ${environment}`);
    process.exit(1);
  }
}
