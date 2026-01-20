export interface Config {
  rootDir: string;
  projectRoot: string;
  workspacesDir: string;
  currentDir: string;
  sharedDir: string;
  containersDir: string;
  envFile: string;
  structurizrUrl: string;
  adminApiKey: string;
  javaSSLOpts: string;
  currentQuarter: string;
}

export interface DomainCredentials {
  workspaceId: string;
  workspaceKey: string;
  workspaceSecret: string;
}

export interface EnvironmentCredentials {
  url: string;
  workspaceId: string;
  workspaceKey: string;
  workspaceSecret: string;
}

export interface Domain {
  name: string;
  description: string;
  owner: string;
  workspace_id: number;
  port: number;
  workspace_file: string;
  color: string;
  tags: string[];
  dependencies: string[];
}

export interface Perspective {
  name: string;
  description: string;
  workspace_id: number;
  port: number;
  includes: string[];
}

export interface DomainsRegistry {
  current_quarter: string;
  domains: Record<string, Domain>;
  perspectives: Record<string, Perspective>;
}

// =============================================================================
// New Unified Workspace Types (registry.yaml)
// =============================================================================

export interface QuarterRegistry {
  workspace_id: number;
  lite_port: number;
  current_quarter: string;
  quarters: Record<string, QuarterDefinition>;
  domains?: Record<string, DomainMetadata>;
  perspectives?: Record<string, PerspectiveMetadata>;
}

export interface QuarterDefinition {
  name: string;
  description: string;
  branch: string;
  status: 'active' | 'archived' | 'planned';
  workspace_file: string;
}

export interface QuarterInfo {
  name: string;
  description: string;
  branch: string;
  status: string;
  workspaceFile: string;
}

export interface QuarterWorkspaceInfo {
  quarter: string;
  path: string;
  workspaceId: number;
  branch: string;
  isUnified: boolean;
}

export interface DomainMetadata {
  name: string;
  description: string;
  owner: string;
  color: string;
  tags: string[];
}

export interface PerspectiveMetadata {
  name: string;
  description: string;
  filter_tags: string[];
}

export interface ValidationResult {
  domain: string;
  valid: boolean;
  error?: string;
}

export interface WorkspaceCredentials {
  id: string;
  apiKey: string;
  apiSecret: string;
}

export type WorkspaceType = 'domain' | 'perspective';

export interface WorkspaceInfo {
  name: string;
  type: WorkspaceType;
  quarter: string;
  path: string;
  workspaceId: number;
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
