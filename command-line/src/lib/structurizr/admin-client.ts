/**
 * Structurizr Admin API Client
 *
 * Provides typed access to the Structurizr On-Premises Admin API
 * for workspace management operations.
 */

import { HttpClient, createHttpClient } from './http-client';
import { NotFoundError, isNotFoundError } from './errors';
import type {
  AdminClientConfig,
  WorkspaceMetadata,
  CreateWorkspaceResponse,
  WorkspaceClientConfig,
} from '../../types';
import { StructurizrWorkspaceClient } from './workspace-client';

/**
 * Client for the Structurizr Admin API.
 *
 * The Admin API requires authentication via the X-Authorization header
 * with the admin API key.
 */
export class StructurizrAdminClient {
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;
  private readonly adminApiKey: string;

  constructor(config: AdminClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.adminApiKey = config.adminApiKey;

    this.httpClient = createHttpClient({
      baseUrl: this.baseUrl,
      timeout: config.timeout,
      headers: {
        'X-Authorization': this.adminApiKey,
      },
    });
  }

  /**
   * List all workspaces.
   *
   * @returns Array of workspace metadata
   */
  async listWorkspaces(): Promise<WorkspaceMetadata[]> {
    const response = await this.httpClient.get<WorkspaceMetadata[]>('/api/workspace');
    return response;
  }

  /**
   * Get a single workspace by ID.
   *
   * @param id - Workspace ID
   * @returns Workspace metadata
   * @throws NotFoundError if workspace doesn't exist
   */
  async getWorkspace(id: number): Promise<WorkspaceMetadata> {
    const response = await this.httpClient.get<WorkspaceMetadata>(`/api/workspace/${id}`);
    return response;
  }

  /**
   * Create a new workspace.
   *
   * @returns Created workspace credentials
   */
  async createWorkspace(): Promise<CreateWorkspaceResponse> {
    const response = await this.httpClient.post<CreateWorkspaceResponse>('/api/workspace');
    return {
      id: response.id,
      apiKey: response.apiKey,
      apiSecret: response.apiSecret,
    };
  }

  /**
   * Delete a workspace by ID.
   *
   * @param id - Workspace ID to delete
   * @throws NotFoundError if workspace doesn't exist
   */
  async deleteWorkspace(id: number): Promise<void> {
    await this.httpClient.delete(`/api/workspace/${id}`);
  }

  /**
   * Check if a workspace exists.
   *
   * @param id - Workspace ID
   * @returns true if workspace exists, false otherwise
   */
  async workspaceExists(id: number): Promise<boolean> {
    try {
      await this.getWorkspace(id);
      return true;
    } catch (error) {
      if (isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Create a WorkspaceClient for a specific workspace.
   *
   * This is a convenience method to create a workspace client
   * using the same base URL and timeout settings.
   *
   * @param config - Workspace client configuration (workspaceId, apiKey, apiSecret)
   * @returns StructurizrWorkspaceClient instance
   */
  createWorkspaceClient(config: Omit<WorkspaceClientConfig, 'baseUrl'>): StructurizrWorkspaceClient {
    return new StructurizrWorkspaceClient({
      baseUrl: this.baseUrl,
      ...config,
    });
  }
}

/**
 * Create a new Admin API client.
 *
 * @param config - Admin client configuration
 * @returns StructurizrAdminClient instance
 */
export function createAdminClient(config: AdminClientConfig): StructurizrAdminClient {
  return new StructurizrAdminClient(config);
}
