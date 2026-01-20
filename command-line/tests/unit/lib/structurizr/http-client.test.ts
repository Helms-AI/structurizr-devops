/**
 * HTTP Client Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HttpClient, createHttpClient } from '../../../../src/lib/structurizr/http-client';
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
  ServerError,
  TimeoutError,
} from '../../../../src/lib/structurizr/errors';
import { server, BASE_URL, createErrorHandler, createNetworkErrorHandler } from '../../../helpers/mocks';

describe('HttpClient', () => {
  let client: HttpClient;

  beforeEach(() => {
    client = createHttpClient({
      baseUrl: BASE_URL,
      timeout: 5000,
    });
  });

  describe('createHttpClient', () => {
    it('should create an HttpClient instance', () => {
      const httpClient = createHttpClient({ baseUrl: BASE_URL });
      expect(httpClient).toBeInstanceOf(HttpClient);
    });
  });

  describe('request', () => {
    it('should make a GET request and return JSON data', async () => {
      const response = await client.request<{ id: number; name: string }[]>({
        method: 'GET',
        path: '/api/workspace',
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should make a POST request with body', async () => {
      const response = await client.request<{ id: number }>({
        method: 'POST',
        path: '/api/workspace',
        body: { name: 'Test' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id');
    });

    it('should include custom headers', async () => {
      const response = await client.request({
        method: 'GET',
        path: '/api/workspace/1',
        headers: { 'X-Custom-Header': 'test-value' },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('error handling', () => {
    it('should throw AuthenticationError on 401', async () => {
      server.use(createErrorHandler('get', '/api/workspace', 401, 'Unauthorized'));

      await expect(client.get('/api/workspace')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError on 403', async () => {
      server.use(createErrorHandler('get', '/api/workspace', 403, 'Forbidden'));

      await expect(client.get('/api/workspace')).rejects.toThrow(AuthenticationError);
    });

    it('should throw NotFoundError on 404', async () => {
      await expect(client.get('/api/workspace/999')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError on 400', async () => {
      server.use(createErrorHandler('post', '/api/workspace', 400, 'Invalid request'));

      await expect(client.post('/api/workspace')).rejects.toThrow(ValidationError);
    });

    it('should throw ServerError on 500', async () => {
      server.use(createErrorHandler('get', '/api/workspace', 500, 'Internal error'));

      await expect(client.get('/api/workspace')).rejects.toThrow(ServerError);
    });

    it('should throw ServerError on 503', async () => {
      server.use(createErrorHandler('get', '/api/workspace', 503, 'Service unavailable'));

      await expect(client.get('/api/workspace')).rejects.toThrow(ServerError);
    });
  });

  describe('convenience methods', () => {
    describe('get', () => {
      it('should return data directly', async () => {
        const data = await client.get<{ id: number }[]>('/api/workspace');
        expect(Array.isArray(data)).toBe(true);
      });
    });

    describe('post', () => {
      it('should return data directly', async () => {
        const data = await client.post<{ id: number }>('/api/workspace', { name: 'Test' });
        expect(data).toHaveProperty('id');
      });
    });

    describe('put', () => {
      it('should return data directly', async () => {
        const data = await client.put<{ success: boolean }>('/api/workspace/1', {});
        expect(data).toHaveProperty('success');
      });
    });

    describe('delete', () => {
      it('should complete without error', async () => {
        await expect(client.delete('/api/workspace/1')).resolves.not.toThrow();
      });
    });
  });

  describe('URL handling', () => {
    it('should handle base URL with trailing slash', async () => {
      const clientWithSlash = createHttpClient({
        baseUrl: `${BASE_URL}/`,
      });

      const data = await clientWithSlash.get('/api/workspace');
      expect(Array.isArray(data)).toBe(true);
    });

    it('should handle path without leading slash', async () => {
      const data = await client.get('api/workspace');
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
