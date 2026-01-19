import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../lib/config';
import { listAllWorkspaces } from '../lib/domains';
import { checkGitHubCli, listSecrets, listEnvironmentSecrets, generateSecretNames, getRepoPath } from '../lib/github';
import { listEnvValues, getEnvFilePath, envFileExists } from '../lib/dotenv';
import { logger } from '../lib/logger';
import type { Environment } from '../types';

export function registerSecretsListCommand(program: Command): void {
  program
    .command('secrets:list')
    .description('List secrets for an environment')
    .requiredOption('-e, --environment <env>', 'Environment: local, Integration, or Production')
    .option('--check', 'Check which secrets are missing for each workspace')
    .action(async (options: { environment: string; check?: boolean }) => {
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
        await handleLocalSecrets(config, options.check);
        return;
      }

      // Handle GitHub environments
      await handleGitHubSecrets(config, environment, options.check);
    });
}

async function handleLocalSecrets(config: ReturnType<typeof loadConfig>, check?: boolean): Promise<void> {
  logger.header('Local Environment Secrets (.env)');

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

  // Group values
  const urlVars = values.filter((v) => v.name.includes('_URL'));
  const idVars = values.filter((v) => v.name.includes('_WORKSPACE_ID'));
  const keyVars = values.filter((v) => v.name.includes('_KEY'));
  const secretVars = values.filter((v) => v.name.includes('_SECRET') && !v.name.includes('_KEY'));
  const otherVars = values.filter((v) =>
    !v.name.includes('_URL') &&
    !v.name.includes('_WORKSPACE_ID') &&
    !v.name.includes('_KEY') &&
    !v.name.includes('_SECRET')
  );

  if (urlVars.length > 0) {
    logger.subheader('URLs');
    for (const v of urlVars) {
      logger.keyValue(v.name, v.value);
    }
    logger.blank();
  }

  if (idVars.length > 0) {
    logger.subheader('Workspace IDs');
    for (const v of idVars.sort((a, b) => a.name.localeCompare(b.name))) {
      logger.keyValue(v.name, v.value);
    }
    logger.blank();
  }

  if (keyVars.length > 0) {
    logger.subheader('API Keys');
    for (const v of keyVars.sort((a, b) => a.name.localeCompare(b.name))) {
      logger.keyValue(v.name, '***');
    }
    logger.blank();
  }

  if (secretVars.length > 0) {
    logger.subheader('API Secrets');
    for (const v of secretVars.sort((a, b) => a.name.localeCompare(b.name))) {
      logger.keyValue(v.name, '***');
    }
    logger.blank();
  }

  if (otherVars.length > 0) {
    logger.subheader('Other');
    for (const v of otherVars) {
      logger.keyValue(v.name, v.value);
    }
    logger.blank();
  }

  logger.keyValue('Total values', String(values.length));
  logger.blank();

  // Check mode
  if (check) {
    logger.subheader('Workspace Secret Status (local)');

    const workspaces = listAllWorkspaces(config, 'current');
    const valueNames = new Set(values.map((v) => v.name));

    let hasIssues = false;

    // Check URL
    const hasUrl = valueNames.has('STRUCTURIZR_URL') || valueNames.has('STRUCTURIZR_URL_INT');
    logger.info('Environment URL:');
    logger.info(`  ${hasUrl ? '\u2713' : '\u2717'} STRUCTURIZR_URL`);
    if (!hasUrl) hasIssues = true;
    logger.blank();

    // Check each workspace
    for (const workspace of workspaces) {
      const names = generateSecretNames(workspace.name);
      const hasId = valueNames.has(names.workspaceId);
      const hasKey = valueNames.has(names.workspaceKeyInt) || valueNames.has(`STRUCTURIZR_${workspace.name.toUpperCase().replace(/-/g, '_')}_WORKSPACE_KEY`);
      const hasSecret = valueNames.has(names.workspaceSecretInt) || valueNames.has(`STRUCTURIZR_${workspace.name.toUpperCase().replace(/-/g, '_')}_WORKSPACE_SECRET`);

      const allGood = hasId && hasKey && hasSecret;
      const status = allGood ? '\u2713' : '\u2717';

      logger.info(`${status} ${workspace.name} (${workspace.type}):`);

      if (!hasId) {
        logger.info(`    Missing: ${names.workspaceId}`);
        hasIssues = true;
      }
      if (!hasKey) {
        logger.info(`    Missing: STRUCTURIZR_${workspace.name.toUpperCase().replace(/-/g, '_')}_WORKSPACE_KEY`);
        hasIssues = true;
      }
      if (!hasSecret) {
        logger.info(`    Missing: STRUCTURIZR_${workspace.name.toUpperCase().replace(/-/g, '_')}_WORKSPACE_SECRET`);
        hasIssues = true;
      }
    }
    logger.blank();

    if (hasIssues) {
      logger.warn('Some values are missing in .env');
      logger.info('Use ./cli secrets:set <name> <value> -e local to add them');
    } else {
      logger.success('All workspace secrets for local are configured!');
    }
  }
}

async function handleGitHubSecrets(
  config: ReturnType<typeof loadConfig>,
  environment: Environment,
  check?: boolean
): Promise<void> {
  logger.header(`GitHub Actions Secrets (${environment})`);

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
  logger.blank();

  // List repo-level secrets (URL secrets, workspace IDs)
  const repoSecrets = await listSecrets();

  // List environment-specific secrets (GitHub expects lowercase)
  const envSecrets = await listEnvironmentSecrets(environment.toLowerCase());

  if (repoSecrets.length === 0 && envSecrets.length === 0) {
    logger.warn('No secrets found');
    logger.blank();
    logger.info('Use ./cli secrets:init to set up secrets for your environment');
    return;
  }

  // Group repo secrets
  const urlSecrets = repoSecrets.filter((s) => s.name.includes('_URL'));
  const idSecrets = repoSecrets.filter((s) => s.name.includes('_WORKSPACE_ID'));
  const otherRepoSecrets = repoSecrets.filter((s) =>
    !s.name.includes('_URL') && !s.name.includes('_WORKSPACE_ID')
  );

  if (urlSecrets.length > 0) {
    logger.subheader('Environment URLs (Repository Level)');
    for (const secret of urlSecrets) {
      logger.info(`  ${secret.name}`);
    }
    logger.blank();
  }

  if (idSecrets.length > 0) {
    logger.subheader('Workspace IDs (Repository Level)');
    for (const secret of idSecrets.sort((a, b) => a.name.localeCompare(b.name))) {
      logger.info(`  ${secret.name}`);
    }
    logger.blank();
  }

  if (envSecrets.length > 0) {
    logger.subheader(`Environment Secrets (${environment})`);
    for (const secret of envSecrets.sort((a, b) => a.name.localeCompare(b.name))) {
      logger.info(`  ${secret.name}`);
    }
    logger.blank();
  }

  if (otherRepoSecrets.length > 0) {
    logger.subheader('Other Repository Secrets');
    for (const secret of otherRepoSecrets) {
      logger.info(`  ${secret.name}`);
    }
    logger.blank();
  }

  logger.keyValue('Repository secrets', String(repoSecrets.length));
  logger.keyValue('Environment secrets', String(envSecrets.length));
  logger.blank();

  // Check mode - verify all workspaces have their secrets for this environment
  if (check) {
    logger.subheader(`Workspace Secret Status (${environment})`);

    const workspaces = listAllWorkspaces(config, 'current');
    const repoSecretNames = new Set(repoSecrets.map((s) => s.name));
    const envSecretNames = new Set(envSecrets.map((s) => s.name));
    const envSuffix = environment === 'Integration' ? 'INT' : 'PROD';

    let hasIssues = false;

    // Check URL secret for this environment
    const urlSecretName = `STRUCTURIZR_URL_${envSuffix}`;
    const hasUrl = repoSecretNames.has(urlSecretName);
    logger.info('Environment URL:');
    logger.info(`  ${hasUrl ? '\u2713' : '\u2717'} ${urlSecretName}`);
    if (!hasUrl) hasIssues = true;
    logger.blank();

    // Check each workspace for this environment
    for (const workspace of workspaces) {
      const names = generateSecretNames(workspace.name);
      const hasId = repoSecretNames.has(names.workspaceId);

      // Key and secret should be in environment secrets
      const keyName = environment === 'Integration' ? names.workspaceKeyInt : names.workspaceKeyProd;
      const secretName = environment === 'Integration' ? names.workspaceSecretInt : names.workspaceSecretProd;

      // Check both repo-level and environment-level for keys/secrets
      const hasKey = envSecretNames.has(keyName) || repoSecretNames.has(keyName);
      const hasSecret = envSecretNames.has(secretName) || repoSecretNames.has(secretName);

      const allGood = hasId && hasKey && hasSecret;
      const status = allGood ? '\u2713' : '\u2717';

      logger.info(`${status} ${workspace.name} (${workspace.type}):`);

      if (!hasId) {
        logger.info(`    Missing: ${names.workspaceId} (repo secret)`);
        hasIssues = true;
      }
      if (!hasKey) {
        logger.info(`    Missing: ${keyName}`);
        hasIssues = true;
      }
      if (!hasSecret) {
        logger.info(`    Missing: ${secretName}`);
        hasIssues = true;
      }
    }
    logger.blank();

    if (hasIssues) {
      logger.warn('Some secrets are missing');
      logger.info('Use ./cli secrets:sync to sync workspace IDs from domains.yaml');
      logger.info(`Use ./cli secrets:init -e ${environment} to set up secrets`);
    } else {
      logger.success(`All workspace secrets for ${environment} are configured!`);
    }
  }
}
