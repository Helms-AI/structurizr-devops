/**
 * Vitest Global Test Setup
 *
 * Configures MSW for HTTP mocking and other global test utilities.
 */

import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './helpers/mocks';

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});
