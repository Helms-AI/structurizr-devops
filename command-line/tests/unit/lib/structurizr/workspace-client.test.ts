/**
 * Workspace Client Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StructurizrWorkspaceClient,
  createWorkspaceClient,
} from '../../../../src/lib/structurizr/workspace-client';
import { NotFoundError } from '../../../../src/lib/structurizr/errors';
import { server, BASE_URL, createErrorHandler } from '../../../helpers/mocks';
import { createWorkspace } from '../../../helpers/fixtures';

const TEST_WORKSPACE_ID = 1;
const TEST_API_KEY = 'test-api-key';
const TEST_API_SECRET = 'test-api-secret';

describe('StructurizrWorkspaceClient', () => {
  let client: StructurizrWorkspaceClient;

  beforeEach(() => {
    client = createWorkspaceClient({
      baseUrl: BASE_URL,
      workspaceId: TEST_WORKSPACE_ID,
      apiKey: TEST_API_KEY,
      apiSecret: TEST_API_SECRET,
    });
  });

  describe('createWorkspaceClient', () => {
    it('should create a StructurizrWorkspaceClient instance', () => {
      const workspaceClient = createWorkspaceClient({
        baseUrl: BASE_URL,
        workspaceId: TEST_WORKSPACE_ID,
        apiKey: TEST_API_KEY,
        apiSecret: TEST_API_SECRET,
      });
      expect(workspaceClient).toBeInstanceOf(StructurizrWorkspaceClient);
    });
  });

  describe('getWorkspaceId', () => {
    it('should return the configured workspace ID', () => {
      expect(client.getWorkspaceId()).toBe(TEST_WORKSPACE_ID);
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace content', async () => {
      const workspace = await client.getWorkspace();

      expect(workspace).toHaveProperty('id');
      expect(workspace).toHaveProperty('name');
      expect(workspace).toHaveProperty('model');
      expect(workspace).toHaveProperty('views');
    });

    it('should return workspace content for specific branch', async () => {
      const workspace = await client.getWorkspace('develop');

      expect(workspace).toHaveProperty('id');
      expect(workspace).toHaveProperty('name');
    });

    it('should throw NotFoundError for non-existing branch', async () => {
      await expect(client.getWorkspace('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('putWorkspace', () => {
    it('should update workspace content', async () => {
      const workspace = createWorkspace();
      const result = await client.putWorkspace(workspace);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('revision');
    });

    it('should update workspace content on specific branch', async () => {
      const workspace = createWorkspace();
      const result = await client.putWorkspace(workspace, 'develop');

      expect(result).toHaveProperty('success', true);
    });
  });

  describe('listBranches', () => {
    it('should return array of branch info', async () => {
      const branches = await client.listBranches();

      expect(Array.isArray(branches)).toBe(true);
      expect(branches.length).toBeGreaterThan(0);
      expect(branches[0]).toHaveProperty('name');
    });

    it('should include common branch names', async () => {
      const branches = await client.listBranches();
      const branchNames = branches.map((b) => b.name);

      expect(branchNames).toContain('main');
      expect(branchNames).toContain('develop');
    });
  });

  describe('deleteBranch', () => {
    it('should complete without error for valid branch', async () => {
      await expect(client.deleteBranch('develop')).resolves.not.toThrow();
    });

    it('should throw NotFoundError for non-existing branch', async () => {
      await expect(client.deleteBranch('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('branchExists', () => {
    it('should return true for existing branch', async () => {
      const exists = await client.branchExists('main');
      expect(exists).toBe(true);
    });

    it('should return false for non-existing branch', async () => {
      const exists = await client.branchExists('nonexistent-branch-xyz');
      expect(exists).toBe(false);
    });
  });

  describe('lock', () => {
    it('should return lock status', async () => {
      const lockStatus = await client.lock();

      expect(lockStatus).toHaveProperty('locked', true);
    });

    it('should accept username and agent', async () => {
      const lockStatus = await client.lock('test-user', 'test-agent');

      expect(lockStatus).toHaveProperty('locked', true);
      expect(lockStatus).toHaveProperty('username');
    });
  });

  describe('unlock', () => {
    it('should complete without error', async () => {
      await expect(client.unlock()).resolves.not.toThrow();
    });
  });

  describe('getLockStatus', () => {
    it('should return lock status', async () => {
      const lockStatus = await client.getLockStatus();

      expect(lockStatus).toHaveProperty('locked');
    });
  });
});
