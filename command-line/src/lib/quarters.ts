import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import type { Config, QuarterRegistry, QuarterInfo, QuarterWorkspaceInfo } from '../types';

/**
 * Load the workspace registry from registry.yaml
 */
export function loadRegistry(config: Config): QuarterRegistry | null {
  const registryPath = path.join(config.sharedDir, 'registry.yaml');
  if (!fs.existsSync(registryPath)) {
    return null;
  }

  const content = fs.readFileSync(registryPath, 'utf-8');
  return yaml.parse(content) as QuarterRegistry;
}

/**
 * Get the workspace ID for the project
 */
export function getWorkspaceId(config: Config): number | null {
  const registry = loadRegistry(config);
  return registry?.workspace_id || null;
}

/**
 * Get the Lite port for editing
 */
export function getLitePort(config: Config): number {
  const registry = loadRegistry(config);
  return registry?.lite_port || 20100;
}

/**
 * Get the current quarter name
 */
export function getCurrentQuarter(config: Config): string {
  const registry = loadRegistry(config);
  return registry?.current_quarter || 'current';
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
      if (!dirent.isDirectory()) return false;
      if (dirent.name === 'shared') return false;
      if (dirent.name === 'current') return false; // Skip symlink

      // Check for workspace.dsl at quarter root (new structure)
      const quarterPath = path.join(workspacesDir, dirent.name);
      if (fs.existsSync(path.join(quarterPath, 'workspace.dsl'))) {
        return true;
      }
      // Also support legacy structure with domains/perspectives
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
 * Get information about a specific quarter
 */
export function getQuarterInfo(config: Config, quarter: string): QuarterInfo | null {
  const registry = loadRegistry(config);
  if (!registry?.quarters) {
    return null;
  }
  const info = registry.quarters[quarter];
  if (!info) {
    return null;
  }
  return {
    name: info.name,
    description: info.description,
    branch: info.branch,
    status: info.status,
    workspaceFile: info.workspace_file || 'workspace.dsl',
  };
}

/**
 * Check if a quarter exists
 */
export function quarterExists(config: Config, quarter: string): boolean {
  const quarterPath = getQuarterPath(config, quarter);
  if (!fs.existsSync(quarterPath)) {
    return false;
  }

  // Check for workspace.dsl (new unified structure)
  const workspacePath = path.join(quarterPath, 'workspace.dsl');
  if (fs.existsSync(workspacePath)) {
    return true;
  }

  // Support legacy structure with domains/perspectives directories
  return (
    fs.existsSync(path.join(quarterPath, 'domains')) ||
    fs.existsSync(path.join(quarterPath, 'perspectives'))
  );
}

/**
 * Check if a quarter uses the new unified structure
 */
export function isUnifiedStructure(config: Config, quarter: string): boolean {
  const workspacePath = path.join(getQuarterPath(config, quarter), 'workspace.dsl');
  return fs.existsSync(workspacePath);
}

/**
 * Get the path to a quarter directory
 */
export function getQuarterPath(config: Config, quarter: string): string {
  return path.join(config.workspacesDir, quarter);
}

/**
 * Get the path to a quarter's workspace.dsl file
 */
export function getWorkspacePath(config: Config, quarter: string): string {
  return path.join(getQuarterPath(config, quarter), 'workspace.dsl');
}

/**
 * Get workspace info for a quarter (for promotion)
 */
export function getQuarterWorkspaceInfo(config: Config, quarter: string): QuarterWorkspaceInfo | null {
  if (!quarterExists(config, quarter)) {
    return null;
  }

  const registry = loadRegistry(config);
  const workspaceId = registry?.workspace_id || 0;
  const quarterInfo = registry?.quarters?.[quarter];
  const branch = quarterInfo?.branch || quarter;

  return {
    quarter,
    path: getWorkspacePath(config, quarter),
    workspaceId,
    branch,
    isUnified: isUnifiedStructure(config, quarter),
  };
}

/**
 * Validate a quarter name format
 */
export function validateQuarterName(name: string): { valid: boolean; error?: string } {
  // Match patterns like q1-2025, q2-2025, etc.
  if (!/^q[1-4]-\d{4}$/.test(name)) {
    return {
      valid: false,
      error: 'Quarter name must be in format qN-YYYY (e.g., q1-2025, q2-2025)',
    };
  }
  return { valid: true };
}

/**
 * Get the Structurizr workspace branch name for a quarter
 */
export function getQuarterBranch(config: Config, quarter: string): string {
  const registry = loadRegistry(config);
  const quarterInfo = registry?.quarters?.[quarter];
  return quarterInfo?.branch || quarter;
}
