import { Command } from 'commander';
import { loadConfig } from '../lib/config';
import {
  listWorkspaces,
  buildLineageTree,
  getWorkspaceLineage,
  loadRegistry,
} from '../lib/workspace-registry';
import { logger } from '../lib/logger';
import type { LineageNode } from '../types';

/**
 * Render a lineage tree as ASCII art
 */
function renderTree(
  tree: Record<string, LineageNode>,
  rootNodes: string[],
  indent: string = '',
  isLast: boolean = true
): string[] {
  const lines: string[] = [];

  for (let i = 0; i < rootNodes.length; i++) {
    const nodeName = rootNodes[i];
    const node = tree[nodeName];
    if (!node) continue;

    const isLastNode = i === rootNodes.length - 1;
    const prefix = indent + (isLastNode ? '└── ' : '├── ');
    const childIndent = indent + (isLastNode ? '    ' : '│   ');

    // Format node info
    const wsId = node.workspaceId ? `[ID: ${node.workspaceId}]` : '[branch-based]';
    const status = node.status === 'active' ? '' : ` (${node.status})`;
    lines.push(`${prefix}${nodeName} ${wsId}${status}`);

    // Recursively render children
    if (node.children.length > 0) {
      const childLines = renderTree(tree, node.children, childIndent, isLastNode);
      lines.push(...childLines);
    }
  }

  return lines;
}

export function registerWorkspaceLineageCommand(program: Command): void {
  program
    .command('workspace:lineage')
    .description('Display workspace inheritance tree showing parent-child relationships')
    .option('-w, --workspace <workspace>', 'Show lineage for specific workspace')
    .option('--visual', 'Show visual tree representation (default)')
    .option('--json', 'Output as JSON')
    .action(async (options: { workspace?: string; visual?: boolean; json?: boolean }) => {
      const config = loadConfig();
      const registry = loadRegistry(config);

      if (!registry?.workspaces) {
        logger.warn('No workspaces found in registry');
        return;
      }

      // If specific workspace requested, show its lineage
      if (options.workspace) {
        const lineage = getWorkspaceLineage(config, options.workspace);

        if (options.json) {
          console.log(JSON.stringify({ workspace: options.workspace, lineage }, null, 2));
          return;
        }

        logger.header(`Lineage for ${options.workspace}`);
        logger.blank();

        if (lineage.length === 1) {
          logger.info(`${options.workspace} is a root workspace (no parent)`);
        } else {
          logger.info('Ancestry (newest to oldest):');
          for (let i = 0; i < lineage.length; i++) {
            const ws = lineage[i];
            const workspaceDef = registry.workspaces[ws];
            const wsId = workspaceDef?.workspace_id ? `[ID: ${workspaceDef.workspace_id}]` : '[branch-based]';
            const arrow = i < lineage.length - 1 ? ' ↓' : ' (root)';
            logger.info(`  ${ws} ${wsId}${arrow}`);
          }
        }
        logger.blank();
        return;
      }

      // Build and display full tree
      const tree = buildLineageTree(config);
      const workspaces = Object.keys(tree);

      if (options.json) {
        console.log(JSON.stringify(tree, null, 2));
        return;
      }

      logger.header('Workspace Lineage Tree');
      logger.blank();

      if (workspaces.length === 0) {
        logger.warn('No workspaces defined in registry');
        return;
      }

      // Find root nodes (workspaces with no parent)
      const rootNodes = workspaces.filter((ws) => !tree[ws].parent);

      if (rootNodes.length === 0) {
        // All workspaces have parents - this shouldn't happen but handle it
        logger.warn('No root workspaces found (circular reference?)');
        logger.blank();
        logger.subheader('All Workspaces:');
        for (const [name, node] of Object.entries(tree)) {
          const wsId = node.workspaceId ? `[ID: ${node.workspaceId}]` : '[branch-based]';
          const parent = node.parent ? `parent: ${node.parent}` : 'no parent';
          logger.info(`  ${name} ${wsId} (${parent})`);
        }
        return;
      }

      // Render tree
      const treeLines = renderTree(tree, rootNodes);
      for (const line of treeLines) {
        console.log(line);
      }

      logger.blank();

      // Summary
      const withIds = workspaces.filter((ws) => tree[ws].workspaceId).length;
      const branchBased = workspaces.length - withIds;

      logger.subheader('Summary');
      logger.keyValue('Total workspaces', String(workspaces.length));
      logger.keyValue('ID-based (new)', String(withIds));
      logger.keyValue('Branch-based (legacy)', String(branchBased));
      logger.blank();

      // Legend
      logger.info('Legend:');
      logger.info('  [ID: N] = Has own workspace ID (new approach)');
      logger.info('  [branch-based] = Uses root workspace ID with branch (legacy)');
    });
}
