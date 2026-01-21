import execa = require('execa');
import { logger } from './logger';

export interface GitHubSecret {
  name: string;
  updatedAt?: string;
}

/**
 * Check if GitHub CLI is installed and authenticated
 */
export async function checkGitHubCli(): Promise<boolean> {
  try {
    await execa('gh', ['auth', 'status']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current repository in owner/repo format
 */
export async function getRepoPath(): Promise<string | null> {
  try {
    const result = await execa('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
    return result.stdout.trim();
  } catch {
    return null;
  }
}

/**
 * List all repository secrets
 */
export async function listSecrets(): Promise<GitHubSecret[]> {
  try {
    const result = await execa('gh', ['secret', 'list', '--json', 'name,updatedAt']);
    const secrets = JSON.parse(result.stdout) as Array<{ name: string; updatedAt: string }>;
    return secrets.map((s) => ({
      name: s.name,
      updatedAt: s.updatedAt,
    }));
  } catch (error) {
    logger.error(`Failed to list secrets: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Set a repository secret
 */
export async function setSecret(name: string, value: string): Promise<boolean> {
  try {
    // Use stdin to pass the secret value securely
    await execa('gh', ['secret', 'set', name], {
      input: value,
    });
    return true;
  } catch (error) {
    logger.error(`Failed to set secret '${name}': ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Delete a repository secret
 */
export async function deleteSecret(name: string): Promise<boolean> {
  try {
    await execa('gh', ['secret', 'delete', name, '--yes']);
    return true;
  } catch (error) {
    logger.error(`Failed to delete secret '${name}': ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Check if a secret exists
 */
export async function secretExists(name: string): Promise<boolean> {
  const secrets = await listSecrets();
  return secrets.some((s) => s.name === name);
}

/**
 * Generate the expected secret/variable names for a workspace.
 *
 * Variables use simple names without environment suffixes:
 * - STRUCTURIZR_{NAME}_WORKSPACE_ID (usually a GitHub variable, not secret)
 * - STRUCTURIZR_{NAME}_WORKSPACE_KEY (stored per GitHub environment)
 * - STRUCTURIZR_{NAME}_WORKSPACE_SECRET (stored per GitHub environment)
 */
export function generateSecretNames(workspaceName: string): {
  workspaceId: string;
  workspaceKey: string;
  workspaceSecret: string;
} {
  const nameUpper = workspaceName.toUpperCase().replace(/-/g, '_');
  return {
    workspaceId: `STRUCTURIZR_${nameUpper}_WORKSPACE_ID`,
    workspaceKey: `STRUCTURIZR_${nameUpper}_WORKSPACE_KEY`,
    workspaceSecret: `STRUCTURIZR_${nameUpper}_WORKSPACE_SECRET`,
  };
}

// =============================================================================
// Environment Variables (gh variable commands)
// =============================================================================

export interface GitHubVariable {
  name: string;
  value: string;
  updatedAt?: string;
}

/**
 * List repository variables (optionally for a specific environment)
 */
export async function listVariables(environment?: string): Promise<GitHubVariable[]> {
  try {
    const args = ['variable', 'list', '--json', 'name,value,updatedAt'];
    if (environment) {
      args.push('--env', environment);
    }
    const result = await execa('gh', args);
    const variables = JSON.parse(result.stdout) as Array<{ name: string; value: string; updatedAt: string }>;
    return variables.map((v) => ({
      name: v.name,
      value: v.value,
      updatedAt: v.updatedAt,
    }));
  } catch (error) {
    // If environment doesn't exist, gh returns an error
    if (error instanceof Error && error.message.includes('not found')) {
      return [];
    }
    logger.error(`Failed to list variables: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Set a repository variable (optionally for a specific environment)
 */
export async function setVariable(name: string, value: string, environment?: string): Promise<boolean> {
  try {
    const args = ['variable', 'set', name, '--body', value];
    if (environment) {
      args.push('--env', environment);
    }
    await execa('gh', args);
    return true;
  } catch (error) {
    logger.error(`Failed to set variable '${name}': ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Delete a repository variable (optionally for a specific environment)
 */
export async function deleteVariable(name: string, environment?: string): Promise<boolean> {
  try {
    const args = ['variable', 'delete', name, '--yes'];
    if (environment) {
      args.push('--env', environment);
    }
    await execa('gh', args);
    return true;
  } catch (error) {
    logger.error(`Failed to delete variable '${name}': ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Check if a variable exists (optionally for a specific environment)
 */
export async function variableExists(name: string, environment?: string): Promise<boolean> {
  const variables = await listVariables(environment);
  return variables.some((v) => v.name === name);
}

/**
 * Get a specific variable value (optionally for a specific environment)
 */
export async function getVariable(name: string, environment?: string): Promise<GitHubVariable | null> {
  const variables = await listVariables(environment);
  return variables.find((v) => v.name === name) || null;
}

/**
 * Get info about a specific secret (name and last updated, value not available)
 */
export async function getSecretInfo(name: string, environment?: string): Promise<GitHubSecret | null> {
  const secrets = environment
    ? await listEnvironmentSecrets(environment)
    : await listSecrets();
  return secrets.find((s) => s.name === name) || null;
}

/**
 * List available GitHub environments for the repository
 */
export async function listEnvironments(): Promise<string[]> {
  try {
    const result = await execa('gh', ['api', 'repos/{owner}/{repo}/environments', '--jq', '.environments[].name']);
    return result.stdout.split('\n').filter((e) => e.trim().length > 0);
  } catch {
    return [];
  }
}

/**
 * Set an environment-specific secret
 */
export async function setEnvironmentSecret(name: string, value: string, environment: string): Promise<boolean> {
  try {
    await execa('gh', ['secret', 'set', name, '--env', environment], {
      input: value,
    });
    return true;
  } catch (error) {
    logger.error(`Failed to set environment secret '${name}' for '${environment}': ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * List environment-specific secrets
 */
export async function listEnvironmentSecrets(environment: string): Promise<GitHubSecret[]> {
  try {
    const result = await execa('gh', ['secret', 'list', '--env', environment, '--json', 'name,updatedAt']);
    const secrets = JSON.parse(result.stdout) as Array<{ name: string; updatedAt: string }>;
    return secrets.map((s) => ({
      name: s.name,
      updatedAt: s.updatedAt,
    }));
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return [];
    }
    logger.error(`Failed to list environment secrets: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Delete an environment-specific secret
 */
export async function deleteEnvironmentSecret(name: string, environment: string): Promise<boolean> {
  try {
    await execa('gh', ['secret', 'delete', name, '--env', environment, '--yes']);
    return true;
  } catch (error) {
    logger.error(`Failed to delete environment secret '${name}' for '${environment}': ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Check if a GitHub environment exists
 */
export async function environmentExists(environment: string): Promise<boolean> {
  const environments = await listEnvironments();
  return environments.includes(environment);
}

/**
 * Create a GitHub environment (idempotent - safe to call if already exists)
 * @returns 'created' if new, 'exists' if already existed, 'failed' on error
 */
export async function createEnvironment(environment: string): Promise<'created' | 'exists' | 'failed'> {
  try {
    // Check if already exists
    if (await environmentExists(environment)) {
      return 'exists';
    }

    // Create the environment using GitHub API
    await execa('gh', ['api', `repos/{owner}/{repo}/environments/${environment}`, '-X', 'PUT']);
    return 'created';
  } catch (error) {
    logger.error(`Failed to create environment '${environment}': ${error instanceof Error ? error.message : String(error)}`);
    return 'failed';
  }
}

// =============================================================================
// GitHub Actions Runner Functions
// =============================================================================

export interface RunnerRegistrationToken {
  token: string;
  expiresAt: string;
}

export interface GitHubRunner {
  id: number;
  name: string;
  os: string;
  status: string;
  busy: boolean;
  labels: Array<{ name: string }>;
}

/**
 * Get the repository URL in https format
 */
export async function getRepoUrl(): Promise<string | null> {
  try {
    const result = await execa('gh', ['repo', 'view', '--json', 'url', '-q', '.url']);
    return result.stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Generate a runner registration token for the repository.
 * The token is valid for 1 hour.
 */
export async function generateRunnerToken(): Promise<RunnerRegistrationToken | null> {
  try {
    const result = await execa('gh', [
      'api',
      'repos/{owner}/{repo}/actions/runners/registration-token',
      '-X', 'POST',
      '--jq', '{token: .token, expiresAt: .expires_at}',
    ]);
    return JSON.parse(result.stdout) as RunnerRegistrationToken;
  } catch (error) {
    logger.error(`Failed to generate runner token: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * List all self-hosted runners for the repository
 */
export async function listRunners(): Promise<GitHubRunner[]> {
  try {
    const result = await execa('gh', [
      'api',
      'repos/{owner}/{repo}/actions/runners',
      '--jq', '.runners',
    ]);
    return JSON.parse(result.stdout) as GitHubRunner[];
  } catch (error) {
    logger.error(`Failed to list runners: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Get a specific runner by name
 */
export async function getRunnerByName(name: string): Promise<GitHubRunner | null> {
  const runners = await listRunners();
  return runners.find((r) => r.name === name) || null;
}

/**
 * Delete a runner by ID
 */
export async function deleteRunner(runnerId: number): Promise<boolean> {
  try {
    await execa('gh', [
      'api',
      `repos/{owner}/{repo}/actions/runners/${runnerId}`,
      '-X', 'DELETE',
    ]);
    return true;
  } catch (error) {
    logger.error(`Failed to delete runner: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
