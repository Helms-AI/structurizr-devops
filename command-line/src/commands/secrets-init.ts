import { Command } from 'commander';
import ora from 'ora';
import * as readline from 'readline';
import { loadConfig } from '../lib/config';
import { getWorkspacesForSecrets } from '../lib/workspace-registry';
import {
  checkGitHubCli,
  setSecret,
  setEnvironmentSecret,
  listSecrets,
  listEnvironmentSecrets,
  generateSecretNames,
  getRepoPath,
} from '../lib/github';
import { logger } from '../lib/logger';
import type { Environment } from '../types';
import { normalizeEnvironment } from '../types';

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const q = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(q, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

async function confirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (y/n)`, 'n');
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

export function registerSecretsInitCommand(program: Command): void {
  program
    .command('secrets:init')
    .description('Interactive setup for GitHub Actions secrets')
    .option('-e, --environment <env>', 'Environment to configure: Integration or Production')
    .option('--skip-urls', 'Skip URL configuration')
    .option('--skip-workspaces', 'Skip workspace credentials configuration')
    .action(async (options: { environment?: string; skipUrls?: boolean; skipWorkspaces?: boolean }) => {
      const config = loadConfig();

      logger.header('GitHub Actions Secrets Setup');
      logger.info('This wizard will help you configure secrets for your CI/CD pipeline.');
      logger.info('Secrets are stored per GitHub environment (Integration/Production).');
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
      }
      logger.blank();

      // Get existing repo-level secrets
      const existingRepoSecrets = await listSecrets();
      const existingRepoNames = new Set(existingRepoSecrets.map((s) => s.name));

      const results: Array<{ name: string; env?: string; success: boolean }> = [];

      // Determine which environment(s) to configure
      let environments: Environment[] = [];
      if (options.environment) {
        try {
          const normalized = normalizeEnvironment(options.environment);
          if (normalized === 'Local') {
            logger.error('Use ./cli secrets:set -e local for local environment');
            process.exit(1);
          }
          environments = [normalized];
        } catch (error) {
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      } else {
        logger.subheader('Select Environment');
        logger.info('1. Integration (development/staging)');
        logger.info('2. Production');
        logger.info('3. Both');
        const choice = await prompt('Choose', '3');
        switch (choice) {
          case '1':
            environments = ['Integration'];
            break;
          case '2':
            environments = ['Production'];
            break;
          default:
            environments = ['Integration', 'Production'];
        }
      }
      logger.blank();

      // Get existing env-level secrets for each environment
      const existingEnvSecrets: Record<string, Set<string>> = {};
      for (const env of environments) {
        const envSecrets = await listEnvironmentSecrets(env);
        existingEnvSecrets[env] = new Set(envSecrets.map((s) => s.name));
      }

      // Configure URL secrets (per environment)
      if (!options.skipUrls) {
        logger.subheader('Environment URLs');
        logger.info('STRUCTURIZR_URL is stored per GitHub environment.');
        logger.blank();

        for (const env of environments) {
          const exists = existingEnvSecrets[env]?.has('STRUCTURIZR_URL');

          if (exists) {
            const update = await confirm(`STRUCTURIZR_URL already exists in ${env}. Update it?`);
            if (!update) {
              logger.info(`Skipping STRUCTURIZR_URL for ${env}`);
              continue;
            }
          }

          const defaultUrl = env === 'Integration'
            ? 'http://localhost:20000/api'
            : '';
          const url = await prompt(`${env} Structurizr URL`, defaultUrl);

          if (url) {
            const setSpinner = ora(`Setting STRUCTURIZR_URL in ${env}...`).start();
            const success = await setEnvironmentSecret('STRUCTURIZR_URL', url, env);
            if (success) {
              setSpinner.succeed(`STRUCTURIZR_URL set in ${env}`);
              results.push({ name: 'STRUCTURIZR_URL', env, success: true });
            } else {
              setSpinner.fail(`Failed to set STRUCTURIZR_URL in ${env}`);
              results.push({ name: 'STRUCTURIZR_URL', env, success: false });
            }
          } else {
            logger.info(`Skipping STRUCTURIZR_URL for ${env} (no value provided)`);
          }
        }
        logger.blank();
      }

      // Configure workspace secrets
      if (!options.skipWorkspaces) {
        const workspaces = getWorkspacesForSecrets(config);

        if (workspaces.length === 0) {
          logger.warn('No workspaces found');
        } else {
          logger.subheader('Workspace Credentials');
          logger.info(`Found ${workspaces.length} workspace(s) to configure.`);
          logger.info('Workspace IDs are stored at repository level.');
          logger.info('API keys/secrets are stored per GitHub environment.');
          logger.blank();

          for (const workspace of workspaces) {
            logger.info(`--- ${workspace.name} ---`);

            const names = generateSecretNames(workspace.name);

            // Workspace ID (repository level)
            if (workspace.workspaceId) {
              const idExists = existingRepoNames.has(names.workspaceId);
              if (!idExists) {
                const setSpinner = ora(`Setting ${names.workspaceId} (repo level)...`).start();
                const success = await setSecret(names.workspaceId, String(workspace.workspaceId));
                if (success) {
                  setSpinner.succeed(`${names.workspaceId} = ${workspace.workspaceId}`);
                  results.push({ name: names.workspaceId, success: true });
                } else {
                  setSpinner.fail(`Failed to set ${names.workspaceId}`);
                  results.push({ name: names.workspaceId, success: false });
                }
              } else {
                logger.info(`${names.workspaceId} already set (repo level)`);
              }
            } else {
              logger.warn(`No workspace_id in registry.yaml for ${workspace.name}`);
            }

            // Credentials per environment (environment level)
            for (const env of environments) {
              const envSecretNames = existingEnvSecrets[env] || new Set();

              // API Key
              const keyExists = envSecretNames.has(names.workspaceKey);
              if (keyExists) {
                const update = await confirm(`${names.workspaceKey} exists in ${env}. Update?`);
                if (!update) {
                  logger.info(`Skipping ${names.workspaceKey} for ${env}`);
                } else {
                  const key = await prompt(`${env} API Key for ${workspace.name}`);
                  if (key) {
                    const setSpinner = ora(`Setting ${names.workspaceKey} in ${env}...`).start();
                    const success = await setEnvironmentSecret(names.workspaceKey, key, env);
                    setSpinner[success ? 'succeed' : 'fail'](`${names.workspaceKey} in ${env}`);
                    results.push({ name: names.workspaceKey, env, success });
                  }
                }
              } else {
                const key = await prompt(`${env} API Key for ${workspace.name}`);
                if (key) {
                  const setSpinner = ora(`Setting ${names.workspaceKey} in ${env}...`).start();
                  const success = await setEnvironmentSecret(names.workspaceKey, key, env);
                  setSpinner[success ? 'succeed' : 'fail'](`${names.workspaceKey} in ${env}`);
                  results.push({ name: names.workspaceKey, env, success });
                } else {
                  logger.info(`Skipping ${names.workspaceKey} for ${env}`);
                }
              }

              // API Secret
              const secretExists = envSecretNames.has(names.workspaceSecret);
              if (secretExists) {
                const update = await confirm(`${names.workspaceSecret} exists in ${env}. Update?`);
                if (!update) {
                  logger.info(`Skipping ${names.workspaceSecret} for ${env}`);
                } else {
                  const secret = await prompt(`${env} API Secret for ${workspace.name}`);
                  if (secret) {
                    const setSpinner = ora(`Setting ${names.workspaceSecret} in ${env}...`).start();
                    const success = await setEnvironmentSecret(names.workspaceSecret, secret, env);
                    setSpinner[success ? 'succeed' : 'fail'](`${names.workspaceSecret} in ${env}`);
                    results.push({ name: names.workspaceSecret, env, success });
                  }
                }
              } else {
                const secret = await prompt(`${env} API Secret for ${workspace.name}`);
                if (secret) {
                  const setSpinner = ora(`Setting ${names.workspaceSecret} in ${env}...`).start();
                  const success = await setEnvironmentSecret(names.workspaceSecret, secret, env);
                  setSpinner[success ? 'succeed' : 'fail'](`${names.workspaceSecret} in ${env}`);
                  results.push({ name: names.workspaceSecret, env, success });
                } else {
                  logger.info(`Skipping ${names.workspaceSecret} for ${env}`);
                }
              }
            }

            logger.blank();
          }
        }
      }

      // Summary
      logger.header('Setup Summary');

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      logger.keyValue('Secrets configured', String(successful.length));
      logger.keyValue('Failed', String(failed.length));
      logger.blank();

      if (failed.length > 0) {
        logger.subheader('Failed');
        for (const result of failed) {
          const envLabel = result.env ? ` (${result.env})` : '';
          logger.error(`  ${result.name}${envLabel}`);
        }
        logger.blank();
      }

      if (results.length === 0) {
        logger.info('No secrets were configured.');
      } else if (failed.length === 0) {
        logger.success('All secrets configured successfully!');
      } else {
        logger.warn('Some secrets failed to configure.');
        process.exit(1);
      }

      logger.blank();
      logger.info('Verify with:');
      logger.info('  ./cli secrets:list -e Integration --check');
      logger.info('  ./cli secrets:list -e Production --check');
    });
}
