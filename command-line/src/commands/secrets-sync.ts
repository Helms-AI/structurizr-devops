import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../lib/config';
import { getWorkspacesForSecrets } from '../lib/workspace-registry';
import { checkGitHubCli, setSecret, listSecrets, generateSecretNames, getRepoPath } from '../lib/github';
import { logger } from '../lib/logger';

export function registerSecretsSyncCommand(program: Command): void {
  program
    .command('secrets:sync')
    .description('Sync workspace IDs from registry.yaml to GitHub Actions secrets')
    .option('--dry-run', 'Show what would be synced without making changes')
    .action(async (options: { dryRun?: boolean }) => {
      const config = loadConfig();

      logger.header('Sync Workspace IDs to GitHub');

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

      if (options.dryRun) {
        logger.info('DRY RUN - No changes will be made');
        logger.blank();
      }

      // Get all workspaces with their IDs
      const workspaces = getWorkspacesForSecrets(config);
      const existingSecrets = await listSecrets();
      const existingNames = new Set(existingSecrets.map((s) => s.name));

      const toSync: Array<{ name: string; value: string; exists: boolean }> = [];
      const missingCredentials: Array<{ workspace: string; missing: string[] }> = [];

      for (const workspace of workspaces) {
        if (!workspace.workspaceId) {
          logger.warn(`${workspace.name}: No workspace_id in registry.yaml`);
          continue;
        }

        const names = generateSecretNames(workspace.name);
        const idSecretName = names.workspaceId;
        const exists = existingNames.has(idSecretName);

        toSync.push({
          name: idSecretName,
          value: String(workspace.workspaceId),
          exists,
        });

        // Note: Key/Secret credentials are stored per GitHub environment
        // and checked via ./cli secrets:list -e <env> --check
        missingCredentials.push({
          workspace: workspace.name,
          missing: [names.workspaceKey, names.workspaceSecret],
        });
      }

      if (toSync.length === 0) {
        logger.warn('No workspaces with workspace_id found');
        logger.info('Add workspace_id to registry.yaml for each workspace');
        return;
      }

      // Sync workspace IDs
      logger.subheader('Syncing Workspace IDs');

      let synced = 0;
      let failed = 0;

      for (const item of toSync) {
        const action = item.exists ? 'Updating' : 'Creating';
        const syncSpinner = ora(`${action} ${item.name}...`).start();

        if (options.dryRun) {
          syncSpinner.info(`Would set ${item.name} = ${item.value}`);
          synced++;
          continue;
        }

        const success = await setSecret(item.name, item.value);
        if (success) {
          syncSpinner.succeed(`${item.name} = ${item.value}`);
          synced++;
        } else {
          syncSpinner.fail(`Failed to set ${item.name}`);
          failed++;
        }
      }

      logger.blank();
      logger.keyValue('Synced', String(synced));
      logger.keyValue('Failed', String(failed));
      logger.blank();

      // Report credential setup instructions
      if (missingCredentials.length > 0) {
        logger.subheader('Credential Setup (Per GitHub Environment)');
        logger.info('API keys and secrets are stored per GitHub environment.');
        logger.info('Use ./cli secrets:init -e <env> or set them manually:');
        logger.blank();

        for (const { workspace, missing } of missingCredentials) {
          logger.info(`${workspace}:`);
          for (const name of missing) {
            logger.info(`  gh secret set ${name} --env Integration`);
            logger.info(`  gh secret set ${name} --env Production`);
          }
        }
        logger.blank();
        logger.info('Or use ./cli secrets:init -e Integration for interactive setup');
      }

      if (failed > 0) {
        process.exit(1);
      } else {
        logger.success('Workspace IDs synced successfully!');
      }
    });
}
