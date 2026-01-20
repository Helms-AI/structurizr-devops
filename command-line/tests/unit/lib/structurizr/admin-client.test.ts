/**
 * Admin Client Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StructurizrAdminClient,
  createAdminClient,
} from '../../../../src/lib/structurizr/admin-client';
import { StructurizrWorkspaceClient } from '../../../../src/lib/structurizr/workspace-client';
import { NotFoundError } from '../../../../src/lib/structurizr/errors';
import { server, BASE_URL, createErrorHandler } from '../../../helpers/mocks';

const TEST_ADMIN_KEY = 'test-admin-api-key';

describe('StructurizrAdminClient', () => {
  let client: StructurizrAdminClient;

  beforeEach(() => {
    client = createAdminClient({
      baseUrl: BASE_URL,
      adminApiKey: TEST_ADMIN_KEY,
    });
  });

  describe('createAdminClient', () => {
    it('should create a StructurizrAdminClient instance', () => {
      const adminClient = createAdminClient({
        baseUrl: BASE_URL,
        adminApiKey: TEST_ADMIN_KEY,
      });
      expect(adminClient).toBeInstanceOf(StructurizrAdminClient);
    });
  });

  describe('listWorkspaces', () => {
    it('should return an array of workspace metadata', async () => {
      const workspaces = await client.listWorkspaces();

      expect(Array.isArray(workspaces)).toBe(true);
      expect(workspaces.length).toBeGreaterThan(0);
      expect(workspaces[0]).toHaveProperty('id');
      expect(workspaces[0]).toHaveProperty('name');
      expect(workspaces[0]).toHaveProperty('apiKey');
    });

    it('should throw on authentication error', async () => {
      server.use(createErrorHandler('get', '/api/workspace', 401, 'Unauthorized'));

      await expect(client.listWorkspaces()).rejects.toThrow();
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace metadata for valid ID', async () => {
      const workspace = await client.getWorkspace(1);

      expect(workspace).toHaveProperty('id', 1);
      expect(workspace).toHaveProperty('name');
      expect(workspace).toHaveProperty('description');
    });

    it('should throw NotFoundError for invalid ID', async () => {
      await expect(client.getWorkspace(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('createWorkspace', () => {
    it('should return new workspace credentials', async () => {
      const result = await client.createWorkspace();

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('apiKey');
      expect(result).toHaveProperty('apiSecret');
      expect(typeof result.id).toBe('number');
      expect(typeof result.apiKey).toBe('string');
      expect(typeof result.apiSecret).toBe('string');
    });
  });

  describe('deleteWorkspace', () => {
    it('should complete without error for valid ID', async () => {
      await expect(client.deleteWorkspace(1)).resolves.not.toThrow();
    });

    it('should throw NotFoundError for invalid ID', async () => {
      await expect(client.deleteWorkspace(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('workspaceExists', () => {
    it('should return true for existing workspace', async () => {
      const exists = await client.workspaceExists(1);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing workspace', async () => {
      const exists = await client.workspaceExists(999);
      expect(exists).toBe(false);
    });

    it('should throw on non-404 errors', async () => {
      server.use(createErrorHandler('get', '/api/workspace/1', 500, 'Server error'));

      await expect(client.workspaceExists(1)).rejects.toThrow();
    });
  });

  describe('createWorkspaceClient', () => {
    it('should return a StructurizrWorkspaceClient instance', () => {
      const workspaceClient = client.createWorkspaceClient({
        workspaceId: 1,
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      expect(workspaceClient).toBeInstanceOf(StructurizrWorkspaceClient);
      expect(workspaceClient.getWorkspaceId()).toBe(1);
    });
  });
});
