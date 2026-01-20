/**
 * Structurizr Workspace API Client
 *
 * Provides typed access to the Structurizr Workspace API
 * for workspace content operations.
 */

import * as crypto from 'crypto';
import { isNotFoundError } from './errors';
import {
  StructurizrApiError,
  AuthenticationError,
  NotFoundError,
  NetworkError,
  ServerError,
} from './errors';
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
 * The Workspace API requires HMAC-SHA256 authentication:
 * - X-Authorization: HMAC signature of (method + path + md5 + contentType + nonce)
 * - Nonce: Timestamp in milliseconds
 * - Content-MD5: Base64 MD5 hash of request body (for PUT/POST)
 */
export class StructurizrWorkspaceClient {
  private readonly baseUrl: string;
  private readonly workspaceId: number;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly timeout: number;

  constructor(config: WorkspaceClientConfig) {
    this.workspaceId = config.workspaceId;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeout = config.timeout || 30000;
  }

  /**
   * Generate HMAC-SHA256 authentication headers for Structurizr API.
   *
   * Based on Structurizr Java client's HmacAuthorizationHeader:
   * - Message format: METHOD\nPATH\nMD5\nCONTENT_TYPE\nNONCE (newline separated)
   * - MD5: Base64-encoded MD5 hash of request body
   * - Signature: Hex-encoded HMAC-SHA256 of message using API secret
   * - X-Authorization: apiKey:hexSignature
   */
  private generateAuthHeaders(
    method: string,
    path: string,
    body?: string
  ): Record<string, string> {
    const nonce = Date.now().toString();
    const contentType = 'application/json; charset=UTF-8';

    // Calculate MD5 of body (base64 encoded)
    const contentMd5 = body
      ? crypto.createHash('md5').update(body).digest('base64')
      : crypto.createHash('md5').update('').digest('base64');

    // Create message to sign with newline separators (matches Java client)
    const message = [method, path, contentMd5, contentType, nonce].join('\n');

    // Generate HMAC-SHA256 signature (hex encoded, like Java client)
    const hmac = crypto.createHmac('sha256', this.apiSecret);
    hmac.update(message);
    const signature = hmac.digest('hex');

    return {
      'Content-Type': contentType,
      'Content-MD5': contentMd5,
      'Nonce': nonce,
      'X-Authorization': `${this.apiKey}:${signature}`,
    };
  }

  /**
   * Make an authenticated request to the Structurizr API.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const bodyString = body ? JSON.stringify(body) : undefined;
    const headers = this.generateAuthHeaders(method, path, bodyString);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: bodyString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const text = await response.text();
          return text ? JSON.parse(text) : ({} as T);
        }
        return {} as T;
      }

      // Handle error responses
      const errorText = await response.text();
      throw this.mapHttpError(response.status, errorText, url, method);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof StructurizrApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new StructurizrApiError(`Request timeout after ${this.timeout}ms`, {
          endpoint: url,
          method,
        });
      }

      if (error instanceof TypeError) {
        throw new NetworkError(`Failed to connect: ${error.message}`, {
          endpoint: url,
          method,
          cause: error,
        });
      }

      throw new StructurizrApiError(
        error instanceof Error ? error.message : 'Unknown error',
        { endpoint: url, method }
      );
    }
  }

  /**
   * Map HTTP status codes to appropriate error types.
   */
  private mapHttpError(
    status: number,
    responseText: string,
    endpoint: string,
    method: string
  ): StructurizrApiError {
    const message = responseText || `HTTP ${status}`;

    switch (status) {
      case 401:
      case 403:
        return new AuthenticationError(message, { endpoint, method });
      case 404:
        return new NotFoundError(message, { endpoint, method });
      case 500:
      case 502:
      case 503:
      case 504:
        return new ServerError(message, { statusCode: status, endpoint, method });
      default:
        return new StructurizrApiError(message, { statusCode: status, endpoint, method });
    }
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

    return this.request<StructurizrWorkspace>('GET', path);
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

    return this.request<ApiResponse>('PUT', path, workspace);
  }

  /**
   * List all branches for the workspace.
   *
   * @returns Array of branch information
   */
  async listBranches(): Promise<BranchInfo[]> {
    const path = `/api/workspace/${this.workspaceId}/branch`;
    return this.request<BranchInfo[]>('GET', path);
  }

  /**
   * Delete a branch.
   *
   * @param name - Branch name to delete
   * @throws NotFoundError if branch doesn't exist
   */
  async deleteBranch(name: string): Promise<void> {
    const path = `/api/workspace/${this.workspaceId}/branch/${encodeURIComponent(name)}`;
    await this.request<void>('DELETE', path);
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

    const path = `/api/workspace/${this.workspaceId}/lock`;
    return this.request<LockStatus>(
      'PUT',
      path,
      Object.keys(body).length > 0 ? body : undefined
    );
  }

  /**
   * Unlock the workspace.
   */
  async unlock(): Promise<void> {
    const path = `/api/workspace/${this.workspaceId}/lock`;
    await this.request<void>('DELETE', path);
  }

  /**
   * Get the lock status for the workspace.
   *
   * @returns Lock status
   */
  async getLockStatus(): Promise<LockStatus> {
    const path = `/api/workspace/${this.workspaceId}/lock`;
    return this.request<LockStatus>('GET', path);
  }

  /**
   * Get the workspace ID this client is configured for.
   */
  getWorkspaceId(): number {
    return this.workspaceId;
  }

  /**
   * Get workspace content as JSON (for diff/merge operations).
   *
   * @param branch - Optional branch name
   * @returns Workspace JSON content
   */
  async getWorkspaceJson(branch?: string): Promise<StructurizrWorkspace> {
    return this.getWorkspace(branch);
  }

  /**
   * Clone workspace content to another workspace.
   *
   * @param targetClient - Target workspace client to clone to
   * @param sourceBranch - Optional source branch name
   * @param targetBranch - Optional target branch name
   */
  async cloneToWorkspace(
    targetClient: StructurizrWorkspaceClient,
    sourceBranch?: string,
    targetBranch?: string
  ): Promise<ApiResponse> {
    const workspace = await this.getWorkspace(sourceBranch);
    return targetClient.putWorkspace(workspace, targetBranch);
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
