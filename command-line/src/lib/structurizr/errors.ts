/**
 * Structurizr API Error Types
 *
 * Provides a hierarchy of typed errors for Structurizr API interactions.
 */

/**
 * Base error class for all Structurizr API errors.
 */
export class StructurizrApiError extends Error {
  public readonly statusCode?: number;
  public readonly endpoint?: string;
  public readonly method?: string;
  public readonly cause?: Error;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      endpoint?: string;
      method?: string;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'StructurizrApiError';
    this.statusCode = options?.statusCode;
    this.endpoint = options?.endpoint;
    this.method = options?.method;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when authentication fails (HTTP 401 or 403).
 */
export class AuthenticationError extends StructurizrApiError {
  constructor(
    message = 'Authentication failed',
    options?: {
      endpoint?: string;
      method?: string;
      cause?: Error;
    }
  ) {
    super(message, { ...options, statusCode: 401 });
    this.name = 'AuthenticationError';
  }
}

/**
 * Thrown when a resource is not found (HTTP 404).
 */
export class NotFoundError extends StructurizrApiError {
  public readonly resourceType?: string;
  public readonly resourceId?: string | number;

  constructor(
    message = 'Resource not found',
    options?: {
      resourceType?: string;
      resourceId?: string | number;
      endpoint?: string;
      method?: string;
      cause?: Error;
    }
  ) {
    super(message, { ...options, statusCode: 404 });
    this.name = 'NotFoundError';
    this.resourceType = options?.resourceType;
    this.resourceId = options?.resourceId;
  }
}

/**
 * Thrown when there is a conflict (HTTP 409).
 * For example, when trying to create a workspace that already exists.
 */
export class ConflictError extends StructurizrApiError {
  constructor(
    message = 'Resource conflict',
    options?: {
      endpoint?: string;
      method?: string;
      cause?: Error;
    }
  ) {
    super(message, { ...options, statusCode: 409 });
    this.name = 'ConflictError';
  }
}

/**
 * Thrown when a request times out.
 */
export class TimeoutError extends StructurizrApiError {
  public readonly timeoutMs: number;

  constructor(
    timeoutMs: number,
    options?: {
      endpoint?: string;
      method?: string;
      cause?: Error;
    }
  ) {
    super(`Request timed out after ${timeoutMs}ms`, options);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Thrown when a network error occurs (connection refused, DNS failure, etc.).
 */
export class NetworkError extends StructurizrApiError {
  constructor(
    message = 'Network error',
    options?: {
      endpoint?: string;
      method?: string;
      cause?: Error;
    }
  ) {
    super(message, options);
    this.name = 'NetworkError';
  }
}

/**
 * Thrown when the request payload is invalid (HTTP 400).
 */
export class ValidationError extends StructurizrApiError {
  public readonly details?: string;

  constructor(
    message = 'Validation error',
    options?: {
      details?: string;
      endpoint?: string;
      method?: string;
      cause?: Error;
    }
  ) {
    super(message, { ...options, statusCode: 400 });
    this.name = 'ValidationError';
    this.details = options?.details;
  }
}

/**
 * Thrown when the server returns an unexpected error (HTTP 5xx).
 */
export class ServerError extends StructurizrApiError {
  constructor(
    message = 'Server error',
    options?: {
      statusCode?: number;
      endpoint?: string;
      method?: string;
      cause?: Error;
    }
  ) {
    super(message, { ...options, statusCode: options?.statusCode || 500 });
    this.name = 'ServerError';
  }
}

/**
 * Type guard to check if an error is a StructurizrApiError
 */
export function isStructurizrApiError(error: unknown): error is StructurizrApiError {
  return error instanceof StructurizrApiError;
}

/**
 * Type guard to check if an error is an AuthenticationError
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

/**
 * Type guard to check if an error is a NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}
