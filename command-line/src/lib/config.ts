import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as yaml from 'yaml';
import type { Config, EnvironmentCredentials, WorkspaceRegistry, Environment } from '../types';

/**
 * Simple credentials structure for workspace API access
 */
export interface WorkspaceCredentialValues {
  workspaceId: string;
  workspaceKey: string;
  workspaceSecret: string;
}

function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, 'workspaces')) &&
      fs.existsSync(path.join(dir, 'containers'))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function getCurrentWorkspace(projectRoot: string): string {
  const registryPath = path.join(projectRoot, 'workspaces', 'shared', 'registry.yaml');
  if (fs.existsSync(registryPath)) {
    try {
      const content = fs.readFileSync(registryPath, 'utf-8');
      const registry = yaml.parse(content) as WorkspaceRegistry;
      // Support both old and new field names
      if (registry.current_workspace) {
        return registry.current_workspace;
      }
    } catch {
      // Fall through to default
    }
  }
  return 'current';
}

export function loadConfig(): Config {
  const projectRoot = findProjectRoot();
  const envFile = path.join(projectRoot, 'containers', '.env');

  if (fs.existsSync(envFile)) {
    // Use override: true to ensure .env values take precedence over
    // any existing environment variables (e.g., from parent shell)
    dotenv.config({ path: envFile, override: true });
  }

  const currentWorkspace = getCurrentWorkspace(projectRoot);

  return {
    rootDir: projectRoot,
    projectRoot,
    workspacesDir: path.join(projectRoot, 'workspaces'),
    sharedDir: path.join(projectRoot, 'workspaces', 'shared'),
    containersDir: path.join(projectRoot, 'containers'),
    envFile,
    structurizrUrl: process.env.STRUCTURIZR_URL || 'http://localhost:20000/api',
    adminApiKey: process.env.STRUCTURIZR_ADMIN_API_KEY || '',
    javaSSLOpts:
      '-Dcom.sun.net.ssl.checkRevocation=false -Djsse.enableSNIExtension=true -Dhttps.protocols=TLSv1.2,TLSv1.3 -Djdk.tls.client.protocols=TLSv1.2,TLSv1.3',
    currentWorkspace,
  };
}

/**
 * Get workspace credentials from environment variables.
 *
 * Credentials use simple names:
 * - STRUCTURIZR_WORKSPACE_ID
 * - STRUCTURIZR_WORKSPACE_KEY
 * - STRUCTURIZR_WORKSPACE_SECRET
 *
 * For Local: loaded from .env file
 * For Integration/Production: provided via GitHub Actions environment
 */
export function getWorkspaceCredentials(_environment?: Environment): WorkspaceCredentialValues {
  return {
    workspaceId: process.env.STRUCTURIZR_WORKSPACE_ID || '',
    workspaceKey: process.env.STRUCTURIZR_WORKSPACE_KEY || '',
    workspaceSecret: process.env.STRUCTURIZR_WORKSPACE_SECRET || '',
  };
}

/**
 * Get full environment credentials including URL.
 *
 * URL comes from STRUCTURIZR_URL environment variable.
 * For Local: defaults to http://localhost:20000/api
 * For Integration/Production: provided via GitHub Actions environment
 */
export function getEnvironmentCredentials(
  _environment: Environment,
  config: Config
): EnvironmentCredentials {
  const creds = getWorkspaceCredentials(_environment);

  return {
    url: config.structurizrUrl,
    ...creds,
  };
}

export function appendToEnvFile(
  envFile: string,
  entries: Record<string, string>,
  comment?: string
): void {
  let content = '\n';
  if (comment) {
    content += `# ${comment}\n`;
  }
  for (const [key, value] of Object.entries(entries)) {
    content += `${key}=${value}\n`;
  }
  fs.appendFileSync(envFile, content);
}

/**
 * Update or add entries in the .env file.
 * If a key exists, its value is updated. If not, it's appended.
 */
export function updateEnvFile(
  envFile: string,
  entries: Record<string, string>
): void {
  let content = '';

  if (fs.existsSync(envFile)) {
    content = fs.readFileSync(envFile, 'utf-8');
  }

  for (const [key, value] of Object.entries(entries)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const newLine = `${key}=${value}`;

    if (regex.test(content)) {
      // Update existing entry
      content = content.replace(regex, newLine);
    } else {
      // Append new entry
      if (!content.endsWith('\n') && content.length > 0) {
        content += '\n';
      }
      content += `${newLine}\n`;
    }
  }

  fs.writeFileSync(envFile, content);
}

/**
 * Get a specific value from the .env file
 */
export function getEnvValue(envFile: string, key: string): string | null {
  if (!fs.existsSync(envFile)) {
    return null;
  }

  const content = fs.readFileSync(envFile, 'utf-8');
  const regex = new RegExp(`^${key}=(.*)$`, 'm');
  const match = content.match(regex);

  return match ? match[1] : null;
}
