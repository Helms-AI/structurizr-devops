/**
 * Test Data Factories
 *
 * Provides functions to create test data for Structurizr API responses.
 */

import type {
  WorkspaceMetadata,
  CreateWorkspaceResponse,
  BranchInfo,
  LockStatus,
  StructurizrWorkspace,
} from '../../src/types';

/**
 * Create a mock WorkspaceMetadata object.
 */
export function createWorkspaceMetadata(
  overrides?: Partial<WorkspaceMetadata>
): WorkspaceMetadata {
  return {
    id: 1,
    name: 'Test Workspace',
    description: 'A test workspace',
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    publicUrl: 'https://structurizr.com/share/1',
    privateUrl: 'https://structurizr.com/workspace/1',
    shareableLink: 'https://structurizr.com/share/1/abcdef',
    branches: ['main', 'develop'],
    users: {
      readWrite: ['admin'],
      readOnly: ['viewer'],
    },
    lastModifiedDate: '2025-01-19T12:00:00Z',
    lastModifiedUser: 'admin',
    lastModifiedAgent: 'structurizr-cli',
    size: 1024,
    ...overrides,
  };
}

/**
 * Create a mock CreateWorkspaceResponse object.
 */
export function createWorkspaceResponse(
  overrides?: Partial<CreateWorkspaceResponse>
): CreateWorkspaceResponse {
  return {
    id: 1,
    apiKey: 'new-api-key-12345',
    apiSecret: 'new-api-secret-67890',
    ...overrides,
  };
}

/**
 * Create a mock BranchInfo object.
 */
export function createBranchInfo(overrides?: Partial<BranchInfo>): BranchInfo {
  return {
    name: 'main',
    lastModifiedDate: '2025-01-19T12:00:00Z',
    lastModifiedUser: 'admin',
    ...overrides,
  };
}

/**
 * Create a mock LockStatus object.
 */
export function createLockStatus(overrides?: Partial<LockStatus>): LockStatus {
  return {
    locked: false,
    ...overrides,
  };
}

/**
 * Create a mock StructurizrWorkspace object.
 */
export function createWorkspace(
  overrides?: Partial<StructurizrWorkspace>
): StructurizrWorkspace {
  return {
    id: 1,
    name: 'Test Workspace',
    description: 'A test workspace for unit tests',
    version: 1,
    revision: 1,
    lastModifiedDate: '2025-01-19T12:00:00Z',
    lastModifiedUser: 'admin',
    lastModifiedAgent: 'structurizr-cli',
    model: {
      softwareSystems: [],
      people: [],
    },
    views: {
      systemLandscapeViews: [],
      systemContextViews: [],
      containerViews: [],
      componentViews: [],
    },
    documentation: {},
    configuration: {},
    ...overrides,
  };
}

/**
 * Create multiple mock workspaces.
 */
export function createWorkspaceList(count: number): WorkspaceMetadata[] {
  return Array.from({ length: count }, (_, i) =>
    createWorkspaceMetadata({
      id: i + 1,
      name: `Workspace ${i + 1}`,
      description: `Test workspace ${i + 1}`,
    })
  );
}

/**
 * Create multiple mock branches.
 */
export function createBranchList(names: string[]): BranchInfo[] {
  return names.map((name) =>
    createBranchInfo({
      name,
      lastModifiedDate: '2025-01-19T12:00:00Z',
    })
  );
}
