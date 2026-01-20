/**
 * Structurizr Workspace API Client
 *
 * Provides typed access to the Structurizr Workspace API
 * for workspace content operations.
 */

import { HttpClient, createHttpClient } from './http-client';
import { isNotFoundError } from './errors';
import type {
  WorkspaceClientConfig,
  StructurizrWorkspace,
  BranchInfo,
  LockStatus,
  ApiResponse,
} from '../../types';

/**
 * Client for the Structurizr Workspace API.
 *
 * The Workspace API requires authentication via the Authorization header
 * with the workspace API key, and optionally HMAC signing for cloud API.
 * For on-premises installations, simple key-based auth is typically sufficient.
 */
export class StructurizrWorkspaceClient {
  private readonly httpClient: HttpClient;
  private readonly workspaceId: number;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(config: WorkspaceClientConfig) {
    this.workspaceId = config.workspaceId;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;

    const baseUrl = config.baseUrl.replace(/\/+$/, '');

    this.httpClient = createHttpClient({
      baseUrl,
      timeout: config.timeout,
      headers: {
        // For on-premises, simple key auth via Authorization header
        'Authorization': this.apiKey,
      },
    });
  }

  /**
   * Get the workspace content.
   *
   * @param branch - Optional branch name (default: main)
   * @returns Workspace content
   */
  async getWorkspace(branch?: string): Promise<StructurizrWorkspace> {
    const path = branch
      ? `/api/workspace/${this.workspaceId}/${encodeURIComponent(branch)}`
      : `/api/workspace/${this.workspaceId}`;

    const response = await this.httpClient.get<StructurizrWorkspace>(path);
    return response;
  }

  /**
   * Update the workspace content.
   *
   * @param workspace - Workspace content to upload
   * @param branch - Optional branch name (default: main)
   * @returns API response with revision number
   */
  async putWorkspace(workspace: StructurizrWorkspace, branch?: string): Promise<ApiResponse> {
    const path = branch
      ? `/api/workspace/${this.workspaceId}/${encodeURIComponent(branch)}`
      : `/api/workspace/${this.workspaceId}`;

    const response = await this.httpClient.put<ApiResponse>(path, workspace);
    return response;
  }

  /**
   * List all branches for the workspace.
   *
   * @returns Array of branch information
   */
  async listBranches(): Promise<BranchInfo[]> {
    const response = await this.httpClient.get<BranchInfo[]>(
      `/api/workspace/${this.workspaceId}/branch`
    );
    return response;
  }

  /**
   * Delete a branch.
   *
   * @param name - Branch name to delete
   * @throws NotFoundError if branch doesn't exist
   */
  async deleteBranch(name: string): Promise<void> {
    await this.httpClient.delete(
      `/api/workspace/${this.workspaceId}/branch/${encodeURIComponent(name)}`
    );
  }

  /**
   * Check if a branch exists.
   *
   * @param name - Branch name
   * @returns true if branch exists, false otherwise
   */
  async branchExists(name: string): Promise<boolean> {
    try {
      const branches = await this.listBranches();
      return branches.some((b) => b.name === name);
    } catch {
      return false;
    }
  }

  /**
   * Lock the workspace.
   *
   * @param username - Username to record as lock owner
   * @param agent - Agent name to record
   * @returns Lock status
   */
  async lock(username?: string, agent?: string): Promise<LockStatus> {
    const body: Record<string, string> = {};
    if (username) body.username = username;
    if (agent) body.agent = agent;

    const response = await this.httpClient.put<LockStatus>(
      `/api/workspace/${this.workspaceId}/lock`,
      Object.keys(body).length > 0 ? body : undefined
    );
    return response;
  }

  /**
   * Unlock the workspace.
   */
  async unlock(): Promise<void> {
    await this.httpClient.delete(`/api/workspace/${this.workspaceId}/lock`);
  }

  /**
   * Get the lock status for the workspace.
   *
   * @returns Lock status
   */
  async getLockStatus(): Promise<LockStatus> {
    const response = await this.httpClient.get<LockStatus>(
      `/api/workspace/${this.workspaceId}/lock`
    );
    return response;
  }

  /**
   * Get the workspace ID this client is configured for.
   */
  getWorkspaceId(): number {
    return this.workspaceId;
  }
}

/**
 * Create a new Workspace API client.
 *
 * @param config - Workspace client configuration
 * @returns StructurizrWorkspaceClient instance
 */
export function createWorkspaceClient(config: WorkspaceClientConfig): StructurizrWorkspaceClient {
  return new StructurizrWorkspaceClient(config);
}
