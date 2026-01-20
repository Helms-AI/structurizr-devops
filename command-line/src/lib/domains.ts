import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import type { Config, Domain, Perspective, DomainsRegistry, WorkspaceInfo, WorkspaceType } from '../types';

/**
 * List all domains in the current quarter
 */
export function listDomains(config: Config, quarter = 'current'): string[] {
  const domainsDir = path.join(config.workspacesDir, quarter, 'domains');
  if (!fs.existsSync(domainsDir)) {
    return [];
  }

  return fs
    .readdirSync(domainsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .filter((dirent) => {
      const workspacePath = path.join(domainsDir, dirent.name, 'workspace.dsl');
      return fs.existsSync(workspacePath);
    })
    .map((dirent) => dirent.name)
    .sort();
}

/**
 * List all perspectives in the current quarter
 */
export function listPerspectives(config: Config, quarter = 'current'): string[] {
  const perspectivesDir = path.join(config.workspacesDir, quarter, 'perspectives');
  if (!fs.existsSync(perspectivesDir)) {
    return [];
  }

  return fs
    .readdirSync(perspectivesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .filter((dirent) => {
      const workspacePath = path.join(perspectivesDir, dirent.name, 'workspace.dsl');
      return fs.existsSync(workspacePath);
    })
    .map((dirent) => dirent.name)
    .sort();
}

/**
 * List all workspaces (domains + perspectives) in a quarter
 */
export function listAllWorkspaces(config: Config, quarter = 'current'): WorkspaceInfo[] {
  const workspaces: WorkspaceInfo[] = [];
  const registry = loadDomainsRegistry(config);

  // Add domains
  for (const name of listDomains(config, quarter)) {
    const domainInfo = registry?.domains?.[name];
    workspaces.push({
      name,
      type: 'domain',
      quarter,
      path: getWorkspacePath(config, name, 'domain', quarter),
      workspaceId: domainInfo?.workspace_id || 0,
    });
  }

  // Add perspectives
  for (const name of listPerspectives(config, quarter)) {
    const perspectiveInfo = registry?.perspectives?.[name];
    workspaces.push({
      name,
      type: 'perspective',
      quarter,
      path: getWorkspacePath(config, name, 'perspective', quarter),
      workspaceId: perspectiveInfo?.workspace_id || 0,
    });
  }

  return workspaces;
}

/**
 * List all available quarters
 */
export function listQuarters(config: Config): string[] {
  const workspacesDir = config.workspacesDir;
  if (!fs.existsSync(workspacesDir)) {
    return [];
  }

  return fs
    .readdirSync(workspacesDir, { withFileTypes: true })
    .filter((dirent) => {
      // Include directories that contain domains/ or perspectives/
      if (!dirent.isDirectory()) return false;
      if (dirent.name === 'shared') return false;
      if (dirent.name === 'current') return false; // Skip symlink

      const quarterPath = path.join(workspacesDir, dirent.name);
      return (
        fs.existsSync(path.join(quarterPath, 'domains')) ||
        fs.existsSync(path.join(quarterPath, 'perspectives'))
      );
    })
    .map((dirent) => dirent.name)
    .sort()
    .reverse(); // Most recent first
}

/**
 * Check if a domain exists
 */
export function domainExists(config: Config, domain: string, quarter = 'current'): boolean {
  const workspacePath = path.join(config.workspacesDir, quarter, 'domains', domain, 'workspace.dsl');
  return fs.existsSync(workspacePath);
}

/**
 * Check if a perspective exists
 */
export function perspectiveExists(config: Config, perspective: string, quarter = 'current'): boolean {
  const workspacePath = path.join(config.workspacesDir, quarter, 'perspectives', perspective, 'workspace.dsl');
  return fs.existsSync(workspacePath);
}

/**
 * Check if a workspace (domain or perspective) exists
 */
export function workspaceExists(
  config: Config,
  name: string,
  type?: WorkspaceType,
  quarter = 'current'
): boolean {
  if (type === 'domain') {
    return domainExists(config, name, quarter);
  } else if (type === 'perspective') {
    return perspectiveExists(config, name, quarter);
  }
  // Auto-detect
  return domainExists(config, name, quarter) || perspectiveExists(config, name, quarter);
}

/**
 * Detect workspace type
 */
export function detectWorkspaceType(config: Config, name: string, quarter = 'current'): WorkspaceType | null {
  if (domainExists(config, name, quarter)) {
    return 'domain';
  }
  if (perspectiveExists(config, name, quarter)) {
    return 'perspective';
  }
  return null;
}

/**
 * Get the path to a workspace DSL file
 */
export function getWorkspacePath(
  config: Config,
  name: string,
  type: WorkspaceType,
  quarter = 'current'
): string {
  const subdir = type === 'domain' ? 'domains' : 'perspectives';
  return path.join(config.workspacesDir, quarter, subdir, name, 'workspace.dsl');
}

/**
 * Get the path to a domain workspace (backward compatible)
 */
export function getDomainWorkspacePath(config: Config, domain: string, quarter = 'current'): string {
  return getWorkspacePath(config, domain, 'domain', quarter);
}

/**
 * Load the domains registry from domains.yaml
 */
export function loadDomainsRegistry(config: Config): DomainsRegistry | null {
  const domainsYamlPath = path.join(config.sharedDir, 'domains.yaml');
  if (!fs.existsSync(domainsYamlPath)) {
    return null;
  }

  const content = fs.readFileSync(domainsYamlPath, 'utf-8');
  return yaml.parse(content) as DomainsRegistry;
}

/**
 * Get domain info from registry
 */
export function getDomainFromRegistry(config: Config, domainName: string): Domain | null {
  const registry = loadDomainsRegistry(config);
  if (!registry || !registry.domains) {
    return null;
  }
  return registry.domains[domainName] || null;
}

/**
 * Get perspective info from registry
 */
export function getPerspectiveFromRegistry(config: Config, perspectiveName: string): Perspective | null {
  const registry = loadDomainsRegistry(config);
  if (!registry || !registry.perspectives) {
    return null;
  }
  return registry.perspectives[perspectiveName] || null;
}

/**
 * Get workspace ID for a workspace
 */
export function getWorkspaceId(config: Config, name: string, type: WorkspaceType): number | null {
  if (type === 'domain') {
    const domain = getDomainFromRegistry(config, name);
    return domain?.workspace_id || null;
  } else {
    const perspective = getPerspectiveFromRegistry(config, name);
    return perspective?.workspace_id || null;
  }
}

/**
 * Get the next available port for domains
 */
export function getNextAvailablePort(config: Config): number {
  const registry = loadDomainsRegistry(config);
  if (!registry || !registry.domains) {
    return 20100;
  }

  let maxPort = 20099;
  for (const domain of Object.values(registry.domains)) {
    if (domain.port > maxPort) {
      maxPort = domain.port;
    }
  }
  return maxPort + 1;
}

/**
 * Validate a domain name
 */
export function validateDomainName(name: string): { valid: boolean; error?: string } {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    return {
      valid: false,
      error:
        'Domain name must start with lowercase letter and contain only lowercase letters, numbers, and hyphens',
    };
  }

  if (name.length > 30) {
    return {
      valid: false,
      error: 'Domain name must be 30 characters or less',
    };
  }

  return { valid: true };
}

/**
 * Convert string to title case
 */
export function toTitleCase(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

