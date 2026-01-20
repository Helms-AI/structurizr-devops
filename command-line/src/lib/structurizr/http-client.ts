/**
 * HTTP Client for Structurizr API
 *
 * Provides a typed HTTP abstraction layer with automatic error mapping.
 */

import {
  StructurizrApiError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  TimeoutError,
  NetworkError,
  ValidationError,
  ServerError,
} from './errors';

export interface HttpClientConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface HttpResponse<T> {
  status: number;
  data: T;
  headers: Headers;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Low-level HTTP client with error mapping for Structurizr API.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(config: HttpClientConfig) {
    // Normalize base URL - remove trailing slash
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.defaultTimeout = config.timeout || DEFAULT_TIMEOUT;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * Make an HTTP request with automatic error mapping.
   */
  async request<T>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    const { method, path, body, headers, timeout } = options;
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const requestTimeout = timeout || this.defaultTimeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    const requestHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...headers,
    };

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle response based on status code
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        let data: T;

        if (contentType?.includes('application/json')) {
          const text = await response.text();
          data = text ? JSON.parse(text) : ({} as T);
        } else {
          // Handle empty or non-JSON responses
          data = {} as T;
        }

        return {
          status: response.status,
          data,
          headers: response.headers,
        };
      }

      // Handle error responses
      const errorText = await response.text();
      throw this.mapHttpError(response.status, errorText, url, method);
    } catch (error) {
      clearTimeout(timeoutId);

      // Re-throw if already a StructurizrApiError
      if (error instanceof StructurizrApiError) {
        throw error;
      }

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(requestTimeout, { endpoint: url, method });
      }

      // Handle network errors
      if (error instanceof TypeError) {
        throw new NetworkError(`Failed to connect: ${error.message}`, {
          endpoint: url,
          method,
          cause: error,
        });
      }

      // Unknown error
      throw new StructurizrApiError(
        error instanceof Error ? error.message : 'Unknown error',
        {
          endpoint: url,
          method,
          cause: error instanceof Error ? error : undefined,
        }
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
      case 400:
        return new ValidationError(message, { endpoint, method, details: responseText });
      case 401:
      case 403:
        return new AuthenticationError(message, { endpoint, method });
      case 404:
        return new NotFoundError(message, { endpoint, method });
      case 409:
        return new ConflictError(message, { endpoint, method });
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
   * Convenience method for GET requests.
   */
  async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    const response = await this.request<T>({ method: 'GET', path, headers });
    return response.data;
  }

  /**
   * Convenience method for POST requests.
   */
  async post<T>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    const response = await this.request<T>({ method: 'POST', path, body, headers });
    return response.data;
  }

  /**
   * Convenience method for PUT requests.
   */
  async put<T>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    const response = await this.request<T>({ method: 'PUT', path, body, headers });
    return response.data;
  }

  /**
   * Convenience method for DELETE requests.
   */
  async delete<T = void>(path: string, headers?: Record<string, string>): Promise<T> {
    const response = await this.request<T>({ method: 'DELETE', path, headers });
    return response.data;
  }
}

/**
 * Create a new HTTP client instance.
 */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  return new HttpClient(config);
}
