export interface Config {
  rootDir: string;
  projectRoot: string;
  workspacesDir: string;
  sharedDir: string;
  containersDir: string;
  envFile: string;
  structurizrUrl: string;
  adminApiKey: string;
  javaSSLOpts: string;
  currentWorkspace: string;
}

export interface EnvironmentCredentials {
  url: string;
  workspaceId: string;
  workspaceKey: string;
  workspaceSecret: string;
}

// =============================================================================
// Workspace Registry Types (registry.yaml)
// =============================================================================

export interface WorkspaceRegistry {
  lite_port: number;
  current_workspace: string;
  workspaces: Record<string, WorkspaceDefinition>;
  /** Legacy root workspace ID (for branch-based quarters) */
  workspace_id?: number;
}

export interface WorkspaceDefinition {
  name: string;
  description: string;
  branch?: string;
  status: 'active' | 'archived' | 'planned';
  workspace_file: string;
  /** Per-workspace workspace ID */
  workspace_id?: number;
  /** Parent workspace reference for lineage tracking */
  parent?: string;
  /** Last common merge point (workspace JSON hash for three-way merge) */
  merge_base?: string;
  /** API key for this workspace */
  api_key?: string;
  /** API secret for this workspace */
  api_secret?: string;
}

export interface WorkspaceEntry {
  name: string;
  description: string;
  branch: string;
  status: string;
  workspaceFile: string;
}

export interface WorkspacePromotionInfo {
  workspace: string;
  path: string;
  workspaceId: number;
  /** Branch name (only used for legacy branch-based approach, null for ID-based) */
  branch: string | null;
  isUnified: boolean;
  /** Whether this workspace uses the new per-workspace workspace ID approach */
  hasOwnWorkspaceId: boolean;
  /** Parent workspace name (if any) */
  parent?: string;
  /** API credentials for this workspace (if using per-workspace IDs) */
  credentials?: {
    apiKey: string;
    apiSecret: string;
  };
}

export interface ValidationResult {
  workspace: string;
  valid: boolean;
  error?: string;
}

export interface WorkspaceCredentials {
  id: string;
  apiKey: string;
  apiSecret: string;
}

export type Environment = 'Local' | 'Integration' | 'Production';

/**
 * Normalize environment input to canonical form (case-insensitive).
 * Accepts: 'local', 'Local', 'LOCAL', 'integration', 'Integration', etc.
 * Returns: 'Local', 'Integration', or 'Production'
 */
export function normalizeEnvironment(env: string): Environment {
  const lower = env.toLowerCase();
  if (lower === 'local') return 'Local';
  if (lower === 'integration') return 'Integration';
  if (lower === 'production') return 'Production';
  throw new Error(`Invalid environment: ${env}. Valid values: Local, Integration, Production`);
}

// =============================================================================
// Structurizr API Types
// =============================================================================

/**
 * Configuration for the Structurizr Admin API client.
 */
export interface AdminClientConfig {
  /** Base URL of the Structurizr server (e.g., http://localhost:20000) */
  baseUrl: string;
  /** Admin API key for authentication */
  adminApiKey: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Configuration for the Structurizr Workspace API client.
 */
export interface WorkspaceClientConfig {
  /** Base URL of the Structurizr server (e.g., http://localhost:20000) */
  baseUrl: string;
  /** Workspace ID */
  workspaceId: number;
  /** Workspace API key */
  apiKey: string;
  /** Workspace API secret */
  apiSecret: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * User access information for a workspace.
 */
export interface WorkspaceUser {
  username: string;
  role: 'ReadWrite' | 'ReadOnly';
}

/**
 * Users configuration for a workspace.
 */
export interface WorkspaceUsers {
  readWrite: string[];
  readOnly: string[];
}

/**
 * Workspace metadata returned by the Admin API.
 */
export interface WorkspaceMetadata {
  id: number;
  name: string;
  description: string;
  apiKey: string;
  apiSecret: string;
  publicUrl: string;
  privateUrl: string;
  shareableLink: string;
  branches?: string[];
  users?: WorkspaceUsers;
  lastModifiedDate?: string;
  lastModifiedUser?: string;
  lastModifiedAgent?: string;
  size?: number;
}

/**
 * Response from creating a new workspace.
 */
export interface CreateWorkspaceResponse {
  id: number;
  apiKey: string;
  apiSecret: string;
}

/**
 * Branch information for a workspace.
 */
export interface BranchInfo {
  name: string;
  lastModifiedDate?: string;
  lastModifiedUser?: string;
}

/**
 * Lock status for a workspace.
 */
export interface LockStatus {
  locked: boolean;
  username?: string;
  agent?: string;
  date?: string;
}

/**
 * Structurizr workspace model (simplified).
 * Full workspace model is complex - this covers key fields.
 */
export interface StructurizrWorkspace {
  id?: number;
  name?: string;
  description?: string;
  version?: number;
  revision?: number;
  lastModifiedDate?: string;
  lastModifiedUser?: string;
  lastModifiedAgent?: string;
  model?: Record<string, unknown>;
  views?: Record<string, unknown>;
  documentation?: Record<string, unknown>;
  configuration?: Record<string, unknown>;
}

/**
 * Response from workspace operations.
 */
export interface ApiResponse {
  success: boolean;
  message?: string;
  revision?: number;
}

// =============================================================================
// Merge Types
// =============================================================================

/**
 * Represents a difference between two workspace elements.
 */
export interface ElementDiff<T = unknown> {
  type: 'added' | 'removed' | 'modified';
  path: string;
  before?: T;
  after?: T;
}

/**
 * Full diff between two workspaces.
 */
export interface WorkspaceDiff {
  model: {
    people: ElementDiff[];
    softwareSystems: ElementDiff[];
    deploymentNodes: ElementDiff[];
  };
  relationships: ElementDiff[];
  views: {
    systemLandscape: ElementDiff[];
    systemContext: ElementDiff[];
    container: ElementDiff[];
    component: ElementDiff[];
    dynamic: ElementDiff[];
    deployment: ElementDiff[];
    filtered: ElementDiff[];
    custom: ElementDiff[];
  };
  styles: ElementDiff[];
  documentation: ElementDiff[];
  stats: {
    added: number;
    removed: number;
    modified: number;
  };
}

/**
 * Merge conflict details.
 */
export interface MergeConflict {
  type: 'element' | 'relationship' | 'view' | 'style' | 'documentation';
  path: string;
  description: string;
  base: unknown;
  ours: unknown;
  theirs: unknown;
}

/**
 * Resolution strategy for merge conflicts.
 */
export type MergeStrategy = 'recursive' | 'ours' | 'theirs';

/**
 * Result of a workspace merge operation.
 */
export interface MergeResult {
  success: boolean;
  merged: StructurizrWorkspace;
  conflicts: MergeConflict[];
  stats: {
    added: number;
    modified: number;
    removed: number;
    conflictsResolved: number;
  };
}

/**
 * Lineage node for workspace ancestry visualization.
 */
export interface LineageNode {
  workspace: string;
  workspaceId?: number;
  parent?: string;
  status: string;
  children: string[];
}
