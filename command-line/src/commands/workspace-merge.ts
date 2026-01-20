import { Command } from 'commander';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig } from '../lib/config';
import {
  workspaceExists,
  getWorkspacePromotionInfo,
  getParentWorkspace,
  getMergeBase,
  updateMergeBase,
  listWorkspaces,
  resolveWorkspace,
  getWorkspaceDslPath,
} from '../lib/workspace-registry';
import { logger } from '../lib/logger';
import { pullWorkspaceJson, pushWorkspaceJson } from '../lib/docker';
import {
  diffWorkspaces,
  isDiffEmpty,
  mergeWorkspaces,
  hashWorkspace,
  resolveConflictsInteractively,
  summarizeConflicts,
  autoResolveConflicts,
} from '../lib/merge';
import type { StructurizrWorkspace, MergeStrategy } from '../types';

export function registerWorkspaceMergeCommand(program: Command): void {
  program
    .command('workspace:merge')
    .description('Merge changes from parent workspace into child (one-way)')
    .option('-w, --workspace <workspace>', 'Target workspace to merge into (default: current)')
    .option('--dry-run', 'Preview changes without applying')
    .option('--strategy <strategy>', 'Conflict resolution: recursive, ours, theirs', 'recursive')
    .option('--auto-resolve', 'Auto-resolve conflicts using strategy (no prompts)')
    .action(async (options: {
      workspace?: string;
      dryRun?: boolean;
      strategy?: string;
      autoResolve?: boolean;
    }) => {
      const config = loadConfig();

      logger.header('Workspace Merge');

      // Resolve target workspace
      let targetWorkspaceName: string;
      try {
        targetWorkspaceName = resolveWorkspace(config, options.workspace || 'current');
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      // Validate workspace exists
      if (!workspaceExists(config, targetWorkspaceName)) {
        logger.error(`Workspace '${targetWorkspaceName}' not found`);
        const workspaces = listWorkspaces(config);
        if (workspaces.length > 0) {
          logger.blank();
          logger.info('Available workspaces:');
          logger.list(workspaces);
        }
        process.exit(1);
      }

      // Get parent workspace
      const parentWorkspaceName = getParentWorkspace(config, targetWorkspaceName);
      if (!parentWorkspaceName) {
        logger.error(`Workspace '${targetWorkspaceName}' has no parent - cannot merge`);
        logger.info('Only workspaces created with workspace:branch can be merged');
        process.exit(1);
      }

      // Get workspace info
      const targetInfo = getWorkspacePromotionInfo(config, targetWorkspaceName);
      const parentInfo = getWorkspacePromotionInfo(config, parentWorkspaceName);

      if (!targetInfo || !parentInfo) {
        logger.error('Could not load workspace info');
        process.exit(1);
      }

      logger.keyValue('Target (child)', `${targetWorkspaceName} [ID: ${targetInfo.workspaceId}]`);
      logger.keyValue('Parent', `${parentWorkspaceName} [ID: ${parentInfo.workspaceId}]`);
      logger.keyValue('Strategy', options.strategy || 'recursive');
      logger.blank();

      // Validate strategy
      const strategy = (options.strategy || 'recursive') as MergeStrategy;
      if (!['recursive', 'ours', 'theirs'].includes(strategy)) {
        logger.error(`Invalid strategy: ${strategy}`);
        logger.info('Valid strategies: recursive, ours, theirs');
        process.exit(1);
      }

      // Fetch workspace content using CLI (has working HMAC auth)
      const fetchSpinner = ora('Fetching workspace content...').start();

      let targetWorkspace: StructurizrWorkspace;
      let parentWorkspace: StructurizrWorkspace;
      let baseWorkspace: StructurizrWorkspace;

      try {
        // Get credentials - prefer per-workspace credentials, fall back to environment
        const targetApiKey = targetInfo.credentials?.apiKey || process.env.STRUCTURIZR_WORKSPACE_KEY || '';
        const targetApiSecret = targetInfo.credentials?.apiSecret || process.env.STRUCTURIZR_WORKSPACE_SECRET || '';
        const parentApiKey = parentInfo.credentials?.apiKey || process.env.STRUCTURIZR_WORKSPACE_KEY || '';
        const parentApiSecret = parentInfo.credentials?.apiSecret || process.env.STRUCTURIZR_WORKSPACE_SECRET || '';

        // Fetch both workspaces using CLI pull command
        [targetWorkspace, parentWorkspace] = await Promise.all([
          pullWorkspaceJson(
            config,
            config.structurizrUrl,
            String(targetInfo.workspaceId),
            targetApiKey,
            targetApiSecret
          ) as Promise<StructurizrWorkspace>,
          pullWorkspaceJson(
            config,
            config.structurizrUrl,
            String(parentInfo.workspaceId),
            parentApiKey,
            parentApiSecret
          ) as Promise<StructurizrWorkspace>,
        ]);

        // For base, we use the merge_base or fall back to child for first merge
        // In a proper implementation, we'd store and retrieve the actual base workspace JSON
        const mergeBaseHash = getMergeBase(config, targetWorkspaceName);
        if (mergeBaseHash) {
          // Subsequent merge - use parent as base (items changed since last merge)
          baseWorkspace = parentWorkspace;
        } else {
          // First merge - use child as base so parent items appear as additions
          // This makes the three-way merge: base=child, ours=child, theirs=parent
          // Items in parent not in child will be seen as "added by theirs"
          baseWorkspace = targetWorkspace;
        }

        fetchSpinner.succeed('Workspace content fetched');
      } catch (error) {
        fetchSpinner.fail('Failed to fetch workspace content');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      // Check if there are any changes to merge (compare parent vs child)
      // Source = parent (what we're merging from), Target = child (what we're merging into)
      const diff = diffWorkspaces(parentWorkspace, targetWorkspace);
      if (isDiffEmpty(diff)) {
        logger.success('No changes to merge - workspaces are identical');
        return;
      }

      logger.subheader('Changes to Apply from Parent');
      logger.keyValue('To add', String(diff.stats.removed));  // Items in parent (source) not in child
      logger.keyValue('To update', String(diff.stats.modified));
      logger.keyValue('Only in child', String(diff.stats.added));  // Items in child (target) not in parent
      logger.blank();

      // Perform merge
      const mergeSpinner = ora('Merging workspaces...').start();
      const mergeResult = mergeWorkspaces(baseWorkspace, targetWorkspace, parentWorkspace, strategy);
      mergeSpinner.succeed('Merge computed');
      logger.blank();

      // Handle conflicts
      if (mergeResult.conflicts.length > 0) {
        logger.warn(`Found ${mergeResult.conflicts.length} conflict(s)`);
        logger.blank();

        if (options.autoResolve) {
          const resolveStrategy = strategy === 'theirs' ? 'theirs' : 'ours';
          logger.info(`Auto-resolving conflicts using '${resolveStrategy}' strategy`);
          autoResolveConflicts(mergeResult.conflicts, resolveStrategy);
        } else if (!options.dryRun) {
          logger.info('Conflicts require resolution:');
          console.log(summarizeConflicts(mergeResult.conflicts));
          logger.blank();

          // Interactive resolution
          await resolveConflictsInteractively(mergeResult.conflicts);
        } else {
          logger.info('Conflicts would need resolution:');
          console.log(summarizeConflicts(mergeResult.conflicts));
        }
      }

      if (options.dryRun) {
        logger.blank();
        logger.info('DRY RUN - No changes applied');
        logger.blank();
        logger.subheader('Would apply:');
        logger.keyValue('Merged elements', 'Ready');
        logger.keyValue('Conflicts', String(mergeResult.conflicts.length));
        return;
      }

      // Push merged workspace using CLI (has working HMAC auth)
      const pushSpinner = ora('Pushing merged workspace...').start();
      try {
        const targetApiKey = targetInfo.credentials?.apiKey || process.env.STRUCTURIZR_WORKSPACE_KEY || '';
        const targetApiSecret = targetInfo.credentials?.apiSecret || process.env.STRUCTURIZR_WORKSPACE_SECRET || '';

        const success = await pushWorkspaceJson(
          config,
          config.structurizrUrl,
          String(targetInfo.workspaceId),
          targetApiKey,
          targetApiSecret,
          mergeResult.merged
        );

        if (success) {
          pushSpinner.succeed('Merged workspace pushed');
        } else {
          throw new Error('Push failed');
        }
      } catch (error) {
        pushSpinner.fail('Failed to push merged workspace');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      // Update merge base
      const newMergeBase = hashWorkspace(parentWorkspace);
      updateMergeBase(config, targetWorkspaceName, newMergeBase);

      logger.blank();
      logger.header('Merge Summary');
      logger.keyValue('Target workspace', targetWorkspaceName);
      logger.keyValue('Parent workspace', parentWorkspaceName);
      logger.keyValue('Conflicts resolved', String(mergeResult.conflicts.length));
      logger.keyValue('Merge base updated', newMergeBase.substring(0, 8));
      logger.blank();
      logger.success('Merge completed successfully!');
    });
}
