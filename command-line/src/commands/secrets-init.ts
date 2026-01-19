import { Command } from 'commander';
import ora from 'ora';
import * as readline from 'readline';
import { loadConfig } from '../lib/config';
import { listAllWorkspaces } from '../lib/domains';
import { checkGitHubCli, setSecret, listSecrets, generateSecretNames, getRepoPath } from '../lib/github';
import { logger } from '../lib/logger';
import type { Environment } from '../types';

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
    .option('-e, --environment <env>', 'Environment to configure: integration or production')
    .option('--skip-urls', 'Skip URL configuration')
    .option('--skip-workspaces', 'Skip workspace credentials configuration')
    .action(async (options: { environment?: string; skipUrls?: boolean; skipWorkspaces?: boolean }) => {
      const config = loadConfig();

      logger.header('GitHub Actions Secrets Setup');
      logger.info('This wizard will help you configure secrets for your CI/CD pipeline.');
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

      // Get existing secrets
      const existingSecrets = await listSecrets();
      const existingNames = new Set(existingSecrets.map((s) => s.name));

      const results: Array<{ name: string; success: boolean }> = [];

      // Determine which environment(s) to configure
      let environments: Environment[] = [];
      if (options.environment) {
        environments = [options.environment as Environment];
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

      // Configure URL secrets
      if (!options.skipUrls) {
        logger.subheader('Environment URLs');

        for (const env of environments) {
          const envLabel = env === 'Integration' ? 'Integration' : 'Production';
          const secretName = env === 'Integration' ? 'STRUCTURIZR_URL_INT' : 'STRUCTURIZR_URL_PROD';
          const exists = existingNames.has(secretName);

          if (exists) {
            const update = await confirm(`${secretName} already exists. Update it?`);
            if (!update) {
              logger.info(`Skipping ${secretName}`);
              continue;
            }
          }

          const defaultUrl = env === 'Integration'
            ? 'http://localhost:20000/api'
            : '';
          const url = await prompt(`${envLabel} Structurizr URL`, defaultUrl);

          if (url) {
            const setSpinner = ora(`Setting ${secretName}...`).start();
            const success = await setSecret(secretName, url);
            if (success) {
              setSpinner.succeed(`${secretName} set`);
              results.push({ name: secretName, success: true });
            } else {
              setSpinner.fail(`Failed to set ${secretName}`);
              results.push({ name: secretName, success: false });
            }
          } else {
            logger.info(`Skipping ${secretName} (no value provided)`);
          }
        }
        logger.blank();
      }

      // Configure workspace secrets
      if (!options.skipWorkspaces) {
        const workspaces = listAllWorkspaces(config, 'current');

        if (workspaces.length === 0) {
          logger.warn('No workspaces found');
        } else {
          logger.subheader('Workspace Credentials');
          logger.info(`Found ${workspaces.length} workspace(s) to configure.`);
          logger.blank();

          for (const workspace of workspaces) {
            logger.info(`--- ${workspace.name} (${workspace.type}) ---`);

            const names = generateSecretNames(workspace.name);

            // Workspace ID
            if (workspace.workspaceId) {
              const idExists = existingNames.has(names.workspaceId);
              if (!idExists) {
                const setSpinner = ora(`Setting ${names.workspaceId}...`).start();
                const success = await setSecret(names.workspaceId, String(workspace.workspaceId));
                if (success) {
                  setSpinner.succeed(`${names.workspaceId} = ${workspace.workspaceId}`);
                  results.push({ name: names.workspaceId, success: true });
                } else {
                  setSpinner.fail(`Failed to set ${names.workspaceId}`);
                  results.push({ name: names.workspaceId, success: false });
                }
              } else {
                logger.info(`${names.workspaceId} already set`);
              }
            } else {
              logger.warn(`No workspace_id in domains.yaml for ${workspace.name}`);
            }

            // Credentials per environment
            for (const env of environments) {
              const envSuffix = env === 'Integration' ? 'INT' : 'PROD';
              const envLabel = env === 'Integration' ? 'Integration' : 'Production';

              const keySecretName = env === 'Integration' ? names.workspaceKeyInt : names.workspaceKeyProd;
              const secretSecretName = env === 'Integration' ? names.workspaceSecretInt : names.workspaceSecretProd;

              // API Key
              const keyExists = existingNames.has(keySecretName);
              if (keyExists) {
                const update = await confirm(`${keySecretName} exists. Update?`);
                if (!update) {
                  logger.info(`Skipping ${keySecretName}`);
                } else {
                  const key = await prompt(`${envLabel} API Key for ${workspace.name}`);
                  if (key) {
                    const setSpinner = ora(`Setting ${keySecretName}...`).start();
                    const success = await setSecret(keySecretName, key);
                    setSpinner[success ? 'succeed' : 'fail'](`${keySecretName}`);
                    results.push({ name: keySecretName, success });
                  }
                }
              } else {
                const key = await prompt(`${envLabel} API Key for ${workspace.name}`);
                if (key) {
                  const setSpinner = ora(`Setting ${keySecretName}...`).start();
                  const success = await setSecret(keySecretName, key);
                  setSpinner[success ? 'succeed' : 'fail'](`${keySecretName}`);
                  results.push({ name: keySecretName, success });
                } else {
                  logger.info(`Skipping ${keySecretName}`);
                }
              }

              // API Secret
              const secretExists = existingNames.has(secretSecretName);
              if (secretExists) {
                const update = await confirm(`${secretSecretName} exists. Update?`);
                if (!update) {
                  logger.info(`Skipping ${secretSecretName}`);
                } else {
                  const secret = await prompt(`${envLabel} API Secret for ${workspace.name}`);
                  if (secret) {
                    const setSpinner = ora(`Setting ${secretSecretName}...`).start();
                    const success = await setSecret(secretSecretName, secret);
                    setSpinner[success ? 'succeed' : 'fail'](`${secretSecretName}`);
                    results.push({ name: secretSecretName, success });
                  }
                }
              } else {
                const secret = await prompt(`${envLabel} API Secret for ${workspace.name}`);
                if (secret) {
                  const setSpinner = ora(`Setting ${secretSecretName}...`).start();
                  const success = await setSecret(secretSecretName, secret);
                  setSpinner[success ? 'succeed' : 'fail'](`${secretSecretName}`);
                  results.push({ name: secretSecretName, success });
                } else {
                  logger.info(`Skipping ${secretSecretName}`);
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
          logger.error(`  ${result.name}`);
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
      logger.info('  ./cli secrets:list -e integration --check');
      logger.info('  ./cli secrets:list -e production --check');
    });
}
