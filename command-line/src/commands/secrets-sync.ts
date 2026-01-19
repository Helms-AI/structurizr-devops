import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../lib/config';
import { listAllWorkspaces } from '../lib/domains';
import { checkGitHubCli, setSecret, listSecrets, generateSecretNames, getRepoPath } from '../lib/github';
import { logger } from '../lib/logger';

export function registerSecretsSyncCommand(program: Command): void {
  program
    .command('secrets:sync')
    .description('Sync workspace IDs from domains.yaml to GitHub Actions secrets')
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
      const workspaces = listAllWorkspaces(config, 'current');
      const existingSecrets = await listSecrets();
      const existingNames = new Set(existingSecrets.map((s) => s.name));

      const toSync: Array<{ name: string; value: string; exists: boolean }> = [];
      const missingCredentials: Array<{ workspace: string; missing: string[] }> = [];

      for (const workspace of workspaces) {
        if (!workspace.workspaceId) {
          logger.warn(`${workspace.name}: No workspace_id in domains.yaml`);
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

        // Check for missing key/secret credentials
        const missing: string[] = [];
        if (!existingNames.has(names.workspaceKeyInt)) missing.push(names.workspaceKeyInt);
        if (!existingNames.has(names.workspaceKeyProd)) missing.push(names.workspaceKeyProd);
        if (!existingNames.has(names.workspaceSecretInt)) missing.push(names.workspaceSecretInt);
        if (!existingNames.has(names.workspaceSecretProd)) missing.push(names.workspaceSecretProd);

        if (missing.length > 0) {
          missingCredentials.push({ workspace: workspace.name, missing });
        }
      }

      if (toSync.length === 0) {
        logger.warn('No workspaces with workspace_id found');
        logger.info('Add workspace_id to domains.yaml for each workspace');
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

      // Report missing credentials
      if (missingCredentials.length > 0) {
        logger.subheader('Missing Credentials (Manual Setup Required)');
        logger.info('The following secrets need to be set manually:');
        logger.blank();

        for (const { workspace, missing } of missingCredentials) {
          logger.info(`${workspace}:`);
          for (const name of missing) {
            const env = name.includes('_INT') ? 'integration' : 'production';
            logger.info(`  ./cli secrets:set ${name} <value> -e ${env}`);
          }
        }
        logger.blank();
        logger.info('Or use ./cli secrets:init -e <environment> for interactive setup');
      }

      if (failed > 0) {
        process.exit(1);
      } else {
        logger.success('Workspace IDs synced successfully!');
      }
    });
}
