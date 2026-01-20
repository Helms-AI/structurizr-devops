/**
 * Structurizr API Client Library
 *
 * This module provides typed clients for interacting with the Structurizr API.
 *
 * @example
 * ```typescript
 * import { createAdminClient, createWorkspaceClient } from './lib/structurizr';
 *
 * // Create an admin client
 * const admin = createAdminClient({
 *   baseUrl: 'http://localhost:20000',
 *   adminApiKey: 'your-admin-key',
 * });
 *
 * // Create a workspace
 * const { id, apiKey, apiSecret } = await admin.createWorkspace();
 *
 * // Create a workspace client
 * const workspace = createWorkspaceClient({
 *   baseUrl: 'http://localhost:20000',
 *   workspaceId: id,
 *   apiKey,
 *   apiSecret,
 * });
 *
 * // Or use the admin client to create a workspace client
 * const workspace2 = admin.createWorkspaceClient({
 *   workspaceId: id,
 *   apiKey,
 *   apiSecret,
 * });
 * ```
 */

// Clients
export { StructurizrAdminClient, createAdminClient } from './admin-client';
export { StructurizrWorkspaceClient, createWorkspaceClient } from './workspace-client';

// HTTP Client (for advanced use cases)
export { HttpClient, createHttpClient } from './http-client';
export type { HttpClientConfig, HttpRequestOptions, HttpResponse } from './http-client';

// Errors
export {
  StructurizrApiError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  TimeoutError,
  NetworkError,
  ValidationError,
  ServerError,
  isStructurizrApiError,
  isAuthenticationError,
  isNotFoundError,
} from './errors';

// Re-export types from main types module for convenience
export type {
  AdminClientConfig,
  WorkspaceClientConfig,
  WorkspaceMetadata,
  CreateWorkspaceResponse,
  BranchInfo,
  LockStatus,
  StructurizrWorkspace,
  ApiResponse,
  WorkspaceUsers,
  WorkspaceUser,
} from '../../types';
