import { Command } from 'commander';
import {
  checkGitHubCli,
  getRepoPath,
  setVariable,
  setEnvironmentSecret,
  variableExists,
} from '../lib/github';
import { setEnvValue, getEnvFilePath } from '../lib/dotenv';
import { loadConfig } from '../lib/config';
import { logger } from '../lib/logger';
import type { Environment } from '../types';

export function registerVariablesSetCommand(program: Command): void {
  program
    .command('variables:set <name> <value>')
    .description('Set an environment variable or secret')
    .requiredOption('-e, --environment <env>', 'Environment: local, Integration, or Production')
    .option('--secret', 'Set as a secret instead of a variable')
    .option('--force', 'Overwrite existing value without confirmation')
    .action(async (name: string, value: string, options: {
      environment: string;
      secret?: boolean;
      force?: boolean;
    }) => {
      const config = loadConfig();
      const environment = options.environment as Environment;

      // Validate environment
      if (!['local', 'Integration', 'Production'].includes(environment)) {
        logger.error(`Invalid environment: ${environment}`);
        logger.info('Valid environments: local, Integration, Production');
        process.exit(1);
      }

      // Handle local environment - write to .env file
      if (environment === 'local') {
        handleLocalEnvSet(config, name, value);
        return;
      }

      // Handle GitHub environments
      await handleGitHubEnvSet(name, value, environment, options.secret, options.force);
    });
}

function handleLocalEnvSet(
  config: ReturnType<typeof loadConfig>,
  name: string,
  value: string
): void {
  logger.header('Set Local Environment Variable (.env)');

  const envPath = getEnvFilePath(config);
  logger.keyValue('File', envPath);
  logger.keyValue('Name', name);
  logger.blank();

  const success = setEnvValue(config, name, value);

  if (success) {
    logger.success(`'${name}' set in .env file`);
  } else {
    logger.error(`Failed to set '${name}'`);
    process.exit(1);
  }
}

async function handleGitHubEnvSet(
  name: string,
  value: string,
  environment: Environment,
  isSecret?: boolean,
  force?: boolean
): Promise<void> {
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

  logger.header(`Set GitHub Environment Configuration (${environment})`);
  logger.keyValue('Repository', repoPath);
  logger.keyValue('Environment', environment);
  logger.keyValue('Type', isSecret ? 'Secret' : 'Variable');
  logger.keyValue('Name', name);
  logger.blank();

  // Check if exists (for variables only)
  // GitHub expects lowercase environment names
  const ghEnvName = environment.toLowerCase();
  if (!force && !isSecret) {
    const exists = await variableExists(name, ghEnvName);
    if (exists) {
      logger.warn(`Variable '${name}' already exists in ${environment}`);
      logger.info('Use --force to overwrite');
      process.exit(1);
    }
  }

  let success: boolean;
  if (isSecret) {
    success = await setEnvironmentSecret(name, value, ghEnvName);
  } else {
    success = await setVariable(name, value, ghEnvName);
  }

  if (success) {
    logger.success(`${isSecret ? 'Secret' : 'Variable'} '${name}' set successfully in ${environment}`);
  } else {
    logger.error(`Failed to set ${isSecret ? 'secret' : 'variable'} '${name}'`);
    process.exit(1);
  }
}
