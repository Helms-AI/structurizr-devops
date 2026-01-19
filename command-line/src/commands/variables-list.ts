import { Command } from 'commander';
import {
  checkGitHubCli,
  getRepoPath,
  listVariables,
  listEnvironments,
  listEnvironmentSecrets,
} from '../lib/github';
import { listEnvValues, getEnvFilePath, envFileExists } from '../lib/dotenv';
import { loadConfig } from '../lib/config';
import { logger } from '../lib/logger';
import type { Environment } from '../types';

export function registerVariablesListCommand(program: Command): void {
  program
    .command('variables:list')
    .description('List environment variables and secrets')
    .option('-e, --environment <env>', 'Environment: local, Integration, or Production (required unless --environments)')
    .option('--secrets', 'Also list environment secrets')
    .option('--environments', 'List available GitHub environments')
    .action(async (options?: {
      environment?: string;
      secrets?: boolean;
      environments?: boolean;
    }) => {
      const config = loadConfig();

      // List environments mode - doesn't require environment parameter
      if (options?.environments) {
        await listGitHubEnvironments();
        return;
      }

      // Environment is required for listing variables
      const environment = options?.environment as Environment | undefined;
      if (!environment) {
        logger.error('Environment is required');
        logger.info('Use: ./cli variables:list -e local');
        logger.info('Use: ./cli variables:list -e Integration');
        logger.info('Use: ./cli variables:list -e Production');
        logger.info('Use: ./cli variables:list --environments (to list available GitHub environments)');
        process.exit(1);
      }

      // Validate environment
      if (!['local', 'Integration', 'Production'].includes(environment)) {
        logger.error(`Invalid environment: ${environment}`);
        logger.info('Valid environments: local, Integration, Production');
        process.exit(1);
      }

      // Handle local environment - read from .env file
      if (environment === 'local') {
        handleLocalEnv(config, options?.secrets);
        return;
      }

      // Handle GitHub environments
      await handleGitHubEnv(environment, options?.secrets);
    });
}

async function listGitHubEnvironments(): Promise<void> {
  // Check GitHub CLI
  const ghAvailable = await checkGitHubCli();
  if (!ghAvailable) {
    logger.error('GitHub CLI (gh) is not installed or not authenticated');
    logger.info('Install: https://cli.github.com/');
    logger.info('Authenticate: gh auth login');
    process.exit(1);
  }

  const repoPath = await getRepoPath();

  logger.header('GitHub Environments');
  if (repoPath) {
    logger.keyValue('Repository', repoPath);
  }
  logger.blank();

  logger.subheader('Available Environments');
  const environments = await listEnvironments();
  if (environments.length === 0) {
    logger.warn('No environments configured');
    logger.info('Create environments in GitHub: Settings > Environments');
  } else {
    logger.list(environments);
  }
  logger.blank();

  logger.info('Note: "local" environment uses containers/.env file');
}

function handleLocalEnv(config: ReturnType<typeof loadConfig>, showSecrets?: boolean): void {
  logger.header('Local Environment Variables (.env)');

  const envPath = getEnvFilePath(config);
  logger.keyValue('File', envPath);
  logger.blank();

  if (!envFileExists(config)) {
    logger.warn('.env file does not exist');
    logger.info('Create it by copying containers/.env.example');
    return;
  }

  const values = listEnvValues(config);

  if (values.length === 0) {
    logger.warn('No values found in .env file');
    return;
  }

  // Separate secrets (keys/secrets) from regular variables
  const secrets = values.filter((v) =>
    v.name.includes('_KEY') || v.name.includes('_SECRET')
  );
  const variables = values.filter((v) =>
    !v.name.includes('_KEY') && !v.name.includes('_SECRET')
  );

  logger.subheader('Variables');
  if (variables.length === 0) {
    logger.info('  (none)');
  } else {
    for (const v of variables) {
      logger.keyValue(v.name, v.value);
    }
  }
  logger.blank();

  if (showSecrets) {
    logger.subheader('Secrets');
    if (secrets.length === 0) {
      logger.info('  (none)');
    } else {
      for (const s of secrets) {
        // Mask the value
        logger.keyValue(s.name, '***');
      }
    }
    logger.blank();
  }

  logger.keyValue('Total values', String(values.length));
}

async function handleGitHubEnv(environment: Environment, showSecrets?: boolean): Promise<void> {
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

  logger.header(`GitHub Environment Configuration (${environment})`);
  logger.keyValue('Repository', repoPath);
  logger.blank();

  // List variables (GitHub expects lowercase environment names)
  const ghEnvName = environment.toLowerCase();
  logger.subheader(`Variables (${environment})`);
  const variables = await listVariables(ghEnvName);

  if (variables.length === 0) {
    logger.warn(`No variables found for environment '${environment}'`);
  } else {
    for (const v of variables) {
      logger.keyValue(v.name, v.value);
    }
  }
  logger.blank();

  // List secrets if requested
  if (showSecrets) {
    logger.subheader(`Secrets (${environment})`);
    const secrets = await listEnvironmentSecrets(ghEnvName);

    if (secrets.length === 0) {
      logger.warn(`No secrets found for environment '${environment}'`);
    } else {
      for (const s of secrets) {
        const updated = s.updatedAt ? ` (updated: ${new Date(s.updatedAt).toLocaleDateString()})` : '';
        logger.info(`  ${s.name}${updated}`);
      }
    }
    logger.blank();
  }
}
