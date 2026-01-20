/**
 * MSW Request Handlers
 *
 * Provides mock HTTP handlers for Structurizr API endpoints.
 */

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  createWorkspaceMetadata,
  createWorkspaceResponse,
  createWorkspace,
  createBranchList,
  createLockStatus,
  createWorkspaceList,
} from './fixtures';

// Base URL for mock API
export const BASE_URL = 'http://localhost:20000';

/**
 * Default handlers for successful responses.
 * NOTE: Order matters - more specific routes should come first.
 */
export const handlers = [
  // Workspace API - List branches (must come before generic :id route)
  http.get(`${BASE_URL}/api/workspace/:id/branch`, () => {
    return HttpResponse.json(createBranchList(['main', 'develop', 'feature/test']));
  }),

  // Workspace API - Delete branch
  http.delete(`${BASE_URL}/api/workspace/:id/branch/:name`, ({ params }) => {
    const name = params.name as string;
    if (name === 'nonexistent') {
      return new HttpResponse('Branch not found', { status: 404 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // Workspace API - Lock workspace
  http.put(`${BASE_URL}/api/workspace/:id/lock`, () => {
    return HttpResponse.json(createLockStatus({ locked: true, username: 'test-user' }));
  }),

  // Workspace API - Unlock workspace
  http.delete(`${BASE_URL}/api/workspace/:id/lock`, () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // Workspace API - Get lock status (must come before generic :id route)
  http.get(`${BASE_URL}/api/workspace/:id/lock`, () => {
    return HttpResponse.json(createLockStatus());
  }),

  // Workspace API - Get workspace content with branch (must come before generic :id route)
  http.get(`${BASE_URL}/api/workspace/:id/:branch`, ({ params }) => {
    const id = parseInt(params.id as string, 10);
    const branch = params.branch as string;
    // Exclude known sub-paths
    if (branch === 'branch' || branch === 'lock') {
      return;
    }
    if (branch === 'nonexistent') {
      return new HttpResponse('Branch not found', { status: 404 });
    }
    return HttpResponse.json(createWorkspace({ id }));
  }),

  // Workspace API - Put workspace content with branch
  http.put(`${BASE_URL}/api/workspace/:id/:branch`, ({ params }) => {
    const branch = params.branch as string;
    // Exclude known sub-paths
    if (branch === 'lock') {
      return;
    }
    return HttpResponse.json({ success: true, revision: 2 });
  }),

  // Admin API - List workspaces (no :id parameter)
  http.get(`${BASE_URL}/api/workspace`, () => {
    return HttpResponse.json(createWorkspaceList(3));
  }),

  // Admin/Workspace API - Get workspace by ID
  // Note: This returns workspace metadata for admin API requests
  // The workspace content endpoint uses the same path but with different auth
  http.get(`${BASE_URL}/api/workspace/:id`, ({ params, request }) => {
    const id = parseInt(params.id as string, 10);
    if (id === 999) {
      return new HttpResponse('Workspace not found', { status: 404 });
    }
    // Check if this is an admin API call (X-Authorization header) or workspace API call
    const adminAuth = request.headers.get('X-Authorization');
    if (adminAuth) {
      return HttpResponse.json(createWorkspaceMetadata({ id }));
    }
    // Workspace API call - return full workspace content
    return HttpResponse.json(createWorkspace({ id }));
  }),

  // Admin API - Create workspace
  http.post(`${BASE_URL}/api/workspace`, () => {
    return HttpResponse.json(createWorkspaceResponse());
  }),

  // Admin API - Delete workspace
  http.delete(`${BASE_URL}/api/workspace/:id`, ({ params }) => {
    const id = parseInt(params.id as string, 10);
    if (id === 999) {
      return new HttpResponse('Workspace not found', { status: 404 });
    }
    return new HttpResponse(null, { status: 200 });
  }),

  // Workspace API - Put workspace content
  http.put(`${BASE_URL}/api/workspace/:id`, () => {
    return HttpResponse.json({ success: true, revision: 2 });
  }),
];

/**
 * Setup MSW server with default handlers.
 */
export const server = setupServer(...handlers);

/**
 * Helper to create an error handler for testing error cases.
 */
export function createErrorHandler(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  status: number,
  message: string
) {
  const methods = {
    get: http.get,
    post: http.post,
    put: http.put,
    delete: http.delete,
  };

  return methods[method](`${BASE_URL}${path}`, () => {
    return new HttpResponse(message, { status });
  });
}

/**
 * Helper to create a timeout handler for testing timeout cases.
 */
export function createTimeoutHandler(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string
) {
  const methods = {
    get: http.get,
    post: http.post,
    put: http.put,
    delete: http.delete,
  };

  return methods[method](`${BASE_URL}${path}`, async () => {
    // Delay longer than any reasonable timeout
    await new Promise((resolve) => setTimeout(resolve, 60000));
    return new HttpResponse(null, { status: 200 });
  });
}

/**
 * Helper to create a network error handler.
 */
export function createNetworkErrorHandler(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string
) {
  const methods = {
    get: http.get,
    post: http.post,
    put: http.put,
    delete: http.delete,
  };

  return methods[method](`${BASE_URL}${path}`, () => {
    return HttpResponse.error();
  });
}
