export interface Config {
  rootDir: string;
  projectRoot: string;
  workspacesDir: string;
  currentDir: string;
  sharedDir: string;
  containersDir: string;
  envFile: string;
  structurizrUrl: string;
  structurizrUrlInt: string;
  structurizrUrlProd: string;
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

export type Environment = 'local' | 'Integration' | 'Production';
