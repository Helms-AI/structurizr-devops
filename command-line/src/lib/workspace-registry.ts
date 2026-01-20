import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import type { Config, WorkspaceRegistry, WorkspaceEntry, WorkspacePromotionInfo, WorkspaceDefinition } from '../types';

/**
 * Load the workspace registry from registry.yaml
 */
export function loadRegistry(config: Config): WorkspaceRegistry | null {
  const registryPath = path.join(config.sharedDir, 'registry.yaml');
  if (!fs.existsSync(registryPath)) {
    return null;
  }

  const content = fs.readFileSync(registryPath, 'utf-8');
  const raw = yaml.parse(content);

  // Handle both old 'quarters' and new 'workspaces' key names
  if (raw.quarters && !raw.workspaces) {
    raw.workspaces = raw.quarters;
    delete raw.quarters;
  }
  // Handle both old 'current_quarter' and new 'current_workspace' key names
  if (raw.current_quarter && !raw.current_workspace) {
    raw.current_workspace = raw.current_quarter;
    delete raw.current_quarter;
  }

  return raw as WorkspaceRegistry;
}

/**
 * Get the workspace ID for the current workspace
 * @deprecated Use getWorkspacePromotionInfo() instead for per-workspace IDs
 */
export function getWorkspaceId(config: Config): number | null {
  const registry = loadRegistry(config);
  const currentWorkspace = registry?.current_workspace;
  if (!currentWorkspace || !registry?.workspaces?.[currentWorkspace]) {
    return null;
  }
  return registry.workspaces[currentWorkspace].workspace_id || null;
}

/**
 * Get the Lite port for editing
 */
export function getLitePort(config: Config): number {
  const registry = loadRegistry(config);
  return registry?.lite_port || 20100;
}

/**
 * Get the current workspace name from registry
 * Throws error if not configured
 */
export function getCurrentWorkspace(config: Config): string {
  const registry = loadRegistry(config);
  if (!registry?.current_workspace) {
    throw new Error('No current_workspace configured in registry.yaml. Set it manually or use workspace:create to create a workspace.');
  }
  return registry.current_workspace;
}

/**
 * Resolve a workspace name - translates 'current' to the actual workspace name
 * Returns the workspace name as-is if it's not 'current'
 */
export function resolveWorkspace(config: Config, workspace: string): string {
  if (workspace === 'current') {
    return getCurrentWorkspace(config);
  }
  return workspace;
}

/**
 * List all available workspaces
 */
export function listWorkspaces(config: Config): string[] {
  const workspacesDir = config.workspacesDir;
  if (!fs.existsSync(workspacesDir)) {
    return [];
  }

  return fs
    .readdirSync(workspacesDir, { withFileTypes: true })
    .filter((dirent) => {
      if (!dirent.isDirectory()) return false;
      if (dirent.name === 'shared') return false;
      if (dirent.name === 'current') return false; // Skip symlink if exists

      // Check for workspace.dsl at workspace root (new structure)
      const workspaceDir = path.join(workspacesDir, dirent.name);
      if (fs.existsSync(path.join(workspaceDir, 'workspace.dsl'))) {
        return true;
      }
      // Also support legacy structure with domains/perspectives
      return (
        fs.existsSync(path.join(workspaceDir, 'domains')) ||
        fs.existsSync(path.join(workspaceDir, 'perspectives'))
      );
    })
    .map((dirent) => dirent.name)
    .sort()
    .reverse(); // Most recent first
}

/**
 * Get information about a specific workspace
 */
export function getWorkspaceEntry(config: Config, workspace: string): WorkspaceEntry | null {
  const registry = loadRegistry(config);
  if (!registry?.workspaces) {
    return null;
  }
  const info = registry.workspaces[workspace];
  if (!info) {
    return null;
  }
  return {
    name: info.name,
    description: info.description,
    branch: info.branch || workspace,
    status: info.status,
    workspaceFile: info.workspace_file || 'workspace.dsl',
  };
}

/**
 * Check if a workspace exists
 */
export function workspaceExists(config: Config, workspace: string): boolean {
  const workspaceDir = getWorkspaceDir(config, workspace);
  if (!fs.existsSync(workspaceDir)) {
    return false;
  }

  // Check for workspace.dsl (new unified structure)
  const workspacePath = path.join(workspaceDir, 'workspace.dsl');
  if (fs.existsSync(workspacePath)) {
    return true;
  }

  // Support legacy structure with domains/perspectives directories
  return (
    fs.existsSync(path.join(workspaceDir, 'domains')) ||
    fs.existsSync(path.join(workspaceDir, 'perspectives'))
  );
}

/**
 * Check if a workspace uses the new unified structure
 */
export function isUnifiedStructure(config: Config, workspace: string): boolean {
  const workspacePath = path.join(getWorkspaceDir(config, workspace), 'workspace.dsl');
  return fs.existsSync(workspacePath);
}

/**
 * Get the path to a workspace directory
 */
export function getWorkspaceDir(config: Config, workspace: string): string {
  return path.join(config.workspacesDir, workspace);
}

/**
 * Get the path to a workspace's workspace.dsl file
 */
export function getWorkspaceDslPath(config: Config, workspace: string): string {
  return path.join(getWorkspaceDir(config, workspace), 'workspace.dsl');
}

/**
 * Get workspace info for promotion
 *
 * Supports both:
 * - New ID-based workspaces: Each workspace has its own workspace_id
 * - Legacy branch-based workspaces: Single workspace_id with branches
 */
export function getWorkspacePromotionInfo(config: Config, workspace: string): WorkspacePromotionInfo | null {
  if (!workspaceExists(config, workspace)) {
    return null;
  }

  const registry = loadRegistry(config);
  const workspaceDef = registry?.workspaces?.[workspace];

  // Check if this workspace has its own workspace ID (new approach)
  if (workspaceDef?.workspace_id) {
    return {
      workspace,
      path: getWorkspaceDslPath(config, workspace),
      workspaceId: workspaceDef.workspace_id,
      branch: null, // No branch for ID-based workspaces
      isUnified: isUnifiedStructure(config, workspace),
      hasOwnWorkspaceId: true,
      parent: workspaceDef.parent,
      credentials: workspaceDef.api_key && workspaceDef.api_secret
        ? { apiKey: workspaceDef.api_key, apiSecret: workspaceDef.api_secret }
        : undefined,
    };
  }

  // Legacy branch-based approach - workspace without its own workspace_id
  // This is deprecated; all workspaces should have their own workspace_id
  const workspaceId = 0;  // No workspace ID configured
  const branch = workspaceDef?.branch || workspace;

  return {
    workspace,
    path: getWorkspaceDslPath(config, workspace),
    workspaceId,
    branch,
    isUnified: isUnifiedStructure(config, workspace),
    hasOwnWorkspaceId: false,
    parent: workspaceDef?.parent,
  };
}

/**
 * Validate a workspace name format
 */
export function validateWorkspaceName(name: string): { valid: boolean; error?: string } {
  // Match patterns like q1-2025, q2-2025, etc.
  if (!/^q[1-4]-\d{4}$/.test(name)) {
    return {
      valid: false,
      error: 'Workspace name must be in format qN-YYYY (e.g., q1-2025, q2-2025)',
    };
  }
  return { valid: true };
}

/**
 * Get the Structurizr workspace branch name for a workspace
 */
export function getWorkspaceBranch(config: Config, workspace: string): string {
  const registry = loadRegistry(config);
  const workspaceInfo = registry?.workspaces?.[workspace];
  return workspaceInfo?.branch || workspace;
}

/**
 * Save the registry back to disk
 */
export function saveRegistry(config: Config, registry: WorkspaceRegistry): void {
  const registryPath = path.join(config.sharedDir, 'registry.yaml');
  fs.writeFileSync(registryPath, yaml.stringify(registry));
}

/**
 * Update a workspace's configuration in the registry
 */
export function updateWorkspaceInRegistry(
  config: Config,
  workspace: string,
  updates: Partial<WorkspaceDefinition>
): boolean {
  const registry = loadRegistry(config);
  if (!registry) {
    return false;
  }

  if (!registry.workspaces) {
    registry.workspaces = {};
  }

  registry.workspaces[workspace] = {
    ...registry.workspaces[workspace],
    ...updates,
  } as WorkspaceDefinition;

  saveRegistry(config, registry);
  return true;
}

/**
 * Add a new workspace to the registry with workspace ID
 */
export function addWorkspaceToRegistry(
  config: Config,
  workspace: string,
  workspaceId: number,
  apiKey: string,
  apiSecret: string,
  parent?: string
): boolean {
  const registry = loadRegistry(config);
  if (!registry) {
    return false;
  }

  if (!registry.workspaces) {
    registry.workspaces = {};
  }

  registry.workspaces[workspace] = {
    name: workspace.toUpperCase().replace('-', ' '),
    description: `${workspace.toUpperCase().replace('-', ' ')} architecture workspace`,
    branch: workspace,
    status: 'active',
    workspace_file: 'workspace.dsl',
    workspace_id: workspaceId,
    parent: parent,
    api_key: apiKey,
    api_secret: apiSecret,
  };

  saveRegistry(config, registry);
  return true;
}

/**
 * Get the parent workspace for a given workspace
 */
export function getParentWorkspace(config: Config, workspace: string): string | null {
  const registry = loadRegistry(config);
  return registry?.workspaces?.[workspace]?.parent || null;
}

/**
 * Get the lineage (ancestry chain) of a workspace
 */
export function getWorkspaceLineage(config: Config, workspace: string): string[] {
  const lineage: string[] = [workspace];
  let current = workspace;

  while (true) {
    const parent = getParentWorkspace(config, current);
    if (!parent) break;
    lineage.push(parent);
    current = parent;
  }

  return lineage;
}

/**
 * Get all children of a workspace
 */
export function getWorkspaceChildren(config: Config, workspace: string): string[] {
  const registry = loadRegistry(config);
  if (!registry?.workspaces) return [];

  return Object.entries(registry.workspaces)
    .filter(([_, def]) => def.parent === workspace)
    .map(([name]) => name);
}

/**
 * Build the complete lineage tree
 */
export function buildLineageTree(config: Config): Record<string, import('../types').LineageNode> {
  const registry = loadRegistry(config);
  if (!registry?.workspaces) return {};

  const tree: Record<string, import('../types').LineageNode> = {};

  // First pass: create nodes
  for (const [name, def] of Object.entries(registry.workspaces)) {
    tree[name] = {
      workspace: name,
      workspaceId: def.workspace_id,
      parent: def.parent,
      status: def.status,
      children: [],
    };
  }

  // Second pass: populate children
  for (const [name, def] of Object.entries(registry.workspaces)) {
    if (def.parent && tree[def.parent]) {
      tree[def.parent].children.push(name);
    }
  }

  return tree;
}

/**
 * Update merge base for a workspace after successful merge
 */
export function updateMergeBase(config: Config, workspace: string, mergeBase: string): boolean {
  return updateWorkspaceInRegistry(config, workspace, { merge_base: mergeBase });
}

/**
 * Get merge base for a workspace
 */
export function getMergeBase(config: Config, workspace: string): string | null {
  const registry = loadRegistry(config);
  return registry?.workspaces?.[workspace]?.merge_base || null;
}

// =============================================================================
// Backward compatibility exports (deprecated, will be removed in future)
// =============================================================================

/** @deprecated Use resolveWorkspace instead */
export const resolveQuarter = resolveWorkspace;

/** @deprecated Use getCurrentWorkspace instead */
export const getCurrentQuarter = getCurrentWorkspace;

/** @deprecated Use listWorkspaces instead */
export const listQuarters = listWorkspaces;

/** @deprecated Use getWorkspaceEntry instead */
export const getQuarterInfo = getWorkspaceEntry;

/** @deprecated Use workspaceExists instead */
export const quarterExists = workspaceExists;

/** @deprecated Use getWorkspaceDir instead */
export const getQuarterPath = getWorkspaceDir;

/** @deprecated Use getWorkspaceDslPath instead */
export const getWorkspacePath = getWorkspaceDslPath;

/** @deprecated Use getWorkspacePromotionInfo instead */
export const getQuarterWorkspaceInfo = getWorkspacePromotionInfo;

/** @deprecated Use validateWorkspaceName instead */
export const validateQuarterName = validateWorkspaceName;

/** @deprecated Use getWorkspaceBranch instead */
export const getQuarterBranch = getWorkspaceBranch;

/** @deprecated Use updateWorkspaceInRegistry instead */
export const updateQuarterInRegistry = updateWorkspaceInRegistry;

/** @deprecated Use addWorkspaceToRegistry instead */
export const addQuarterToRegistry = addWorkspaceToRegistry;

/** @deprecated Use getParentWorkspace instead */
export const getParentQuarter = getParentWorkspace;

/** @deprecated Use getWorkspaceLineage instead */
export const getQuarterLineage = getWorkspaceLineage;

/** @deprecated Use getWorkspaceChildren instead */
export const getQuarterChildren = getWorkspaceChildren;

// =============================================================================
// Workspace Info for Secrets Management
// =============================================================================

/**
 * Workspace info for secrets management
 */
export interface WorkspaceSecretInfo {
  name: string;
  workspaceId?: number;
}

/**
 * Get workspaces with their IDs for secrets management
 */
export function getWorkspacesForSecrets(config: Config): WorkspaceSecretInfo[] {
  const registry = loadRegistry(config);
  if (!registry?.workspaces) {
    return [];
  }

  return Object.entries(registry.workspaces).map(([name, def]) => ({
    name,
    workspaceId: def.workspace_id,
  }));
}
