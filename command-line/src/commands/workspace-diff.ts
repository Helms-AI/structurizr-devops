import { Command } from 'commander';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig } from '../lib/config';
import {
  workspaceExists,
  getWorkspacePromotionInfo,
  getParentWorkspace,
  listWorkspaces,
  resolveWorkspace,
} from '../lib/workspace-registry';
import { logger } from '../lib/logger';
import { pullWorkspaceJson } from '../lib/docker';
import { diffWorkspaces, isDiffEmpty, formatDiff } from '../lib/merge';
import type { StructurizrWorkspace } from '../types';

export function registerWorkspaceDiffCommand(program: Command): void {
  program
    .command('workspace:diff [source] [target]')
    .description('Show differences between two workspaces')
    .option('--from-parent', 'Compare current workspace with its parent')
    .option('-w, --workspace <workspace>', 'Workspace to compare (with --from-parent)')
    .option('--format <format>', 'Output format: summary, detailed, json', 'summary')
    .action(async (
      source: string | undefined,
      target: string | undefined,
      options: { fromParent?: boolean; workspace?: string; format?: string }
    ) => {
      const config = loadConfig();

      logger.header('Workspace Diff');

      let sourceWorkspaceName: string;
      let targetWorkspaceName: string;

      if (options.fromParent) {
        // Compare workspace with its parent
        let workspace: string;
        try {
          workspace = resolveWorkspace(config, options.workspace || 'current');
        } catch (error) {
          logger.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }

        const parent = getParentWorkspace(config, workspace);
        if (!parent) {
          logger.error(`Workspace '${workspace}' has no parent (it's a root workspace)`);
          process.exit(1);
        }

        sourceWorkspaceName = parent;
        targetWorkspaceName = workspace;
      } else if (source && target) {
        sourceWorkspaceName = source;
        targetWorkspaceName = target;
      } else {
        logger.error('Please provide two workspaces to compare, or use --from-parent');
        logger.blank();
        logger.info('Usage:');
        logger.info('  ./cli workspace:diff q1-2025 q2-2025');
        logger.info('  ./cli workspace:diff --from-parent');
        logger.info('  ./cli workspace:diff --from-parent -w q3-2025');
        process.exit(1);
      }

      // Validate workspaces exist
      if (!workspaceExists(config, sourceWorkspaceName)) {
        logger.error(`Source workspace '${sourceWorkspaceName}' not found`);
        const workspaces = listWorkspaces(config);
        if (workspaces.length > 0) {
          logger.blank();
          logger.info('Available workspaces:');
          logger.list(workspaces);
        }
        process.exit(1);
      }

      if (!workspaceExists(config, targetWorkspaceName)) {
        logger.error(`Target workspace '${targetWorkspaceName}' not found`);
        const workspaces = listWorkspaces(config);
        if (workspaces.length > 0) {
          logger.blank();
          logger.info('Available workspaces:');
          logger.list(workspaces);
        }
        process.exit(1);
      }

      // Get workspace info
      const sourceInfo = getWorkspacePromotionInfo(config, sourceWorkspaceName);
      const targetInfo = getWorkspacePromotionInfo(config, targetWorkspaceName);

      if (!sourceInfo || !targetInfo) {
        logger.error('Could not load workspace info');
        process.exit(1);
      }

      logger.keyValue('Source (base)', `${sourceWorkspaceName} [ID: ${sourceInfo.workspaceId}]`);
      logger.keyValue('Target (changes)', `${targetWorkspaceName} [ID: ${targetInfo.workspaceId}]`);
      logger.blank();

      // Fetch workspace content using CLI (has working HMAC auth)
      const fetchSpinner = ora('Fetching workspace content...').start();

      let sourceWorkspace: StructurizrWorkspace;
      let targetWorkspace: StructurizrWorkspace;

      try {
        // Get credentials - prefer per-workspace credentials, fall back to environment
        const sourceApiKey = sourceInfo.credentials?.apiKey || process.env.STRUCTURIZR_WORKSPACE_KEY || '';
        const sourceApiSecret = sourceInfo.credentials?.apiSecret || process.env.STRUCTURIZR_WORKSPACE_SECRET || '';
        const targetApiKey = targetInfo.credentials?.apiKey || process.env.STRUCTURIZR_WORKSPACE_KEY || '';
        const targetApiSecret = targetInfo.credentials?.apiSecret || process.env.STRUCTURIZR_WORKSPACE_SECRET || '';

        // Fetch both workspaces using CLI pull command
        [sourceWorkspace, targetWorkspace] = await Promise.all([
          pullWorkspaceJson(
            config,
            config.structurizrUrl,
            String(sourceInfo.workspaceId),
            sourceApiKey,
            sourceApiSecret
          ) as Promise<StructurizrWorkspace>,
          pullWorkspaceJson(
            config,
            config.structurizrUrl,
            String(targetInfo.workspaceId),
            targetApiKey,
            targetApiSecret
          ) as Promise<StructurizrWorkspace>,
        ]);

        fetchSpinner.succeed('Workspace content fetched');
      } catch (error) {
        fetchSpinner.fail('Failed to fetch workspace content');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      // Compute diff
      // Swap arguments: we want to show what target needs to match source
      // "added" = items target needs to add (in source, not in target)
      // "removed" = items target has extra (in target, not in source)
      const diffSpinner = ora('Computing diff...').start();
      const diff = diffWorkspaces(targetWorkspace, sourceWorkspace);
      diffSpinner.succeed('Diff computed');
      logger.blank();

      // Output based on format
      if (options.format === 'json') {
        console.log(JSON.stringify(diff, null, 2));
        return;
      }

      if (isDiffEmpty(diff)) {
        logger.success('No differences found - workspaces are identical');
        return;
      }

      logger.subheader('Differences');
      console.log(formatDiff(diff, options.format === 'detailed' ? 'detailed' : 'summary'));
      logger.blank();

      logger.subheader('Summary');
      logger.keyValue('Added', String(diff.stats.added));
      logger.keyValue('Modified', String(diff.stats.modified));
      logger.keyValue('Removed', String(diff.stats.removed));
    });
}
