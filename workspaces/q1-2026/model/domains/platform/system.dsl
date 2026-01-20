# =============================================================================
# Platform Domain - Core Infrastructure
# =============================================================================
# Core platform providing shared services including authentication,
# user management, API gateway, and messaging infrastructure.
# =============================================================================

group "Platform Domain" {
    platform = softwareSystem "Platform" "Core platform providing shared services" {
        tags "Platform" "Core" "Infrastructure"
        description "Authentication, user management, messaging, and shared infrastructure"

        # =================================================================
        # API Layer
        # =================================================================
        apiGateway = container "API Gateway" "Routes and authenticates API requests" "Kong/NGINX" {
            tags "Platform" "Infrastructure" "Public"
            description "WAF, rate limiting, TLS termination, request routing"
        }

        # =================================================================
        # Application Services
        # =================================================================
        authService = container "Auth Service" "Handles authentication and authorization" "Go" {
            tags "Platform" "Application" "Security"
            description "OAuth2/OIDC, JWT issuance, session management"

            authApi = component "Auth API" "REST endpoints for auth operations" "Go, Chi router" {
                tags "Platform" "Application"
            }
            tokenService = component "Token Service" "JWT generation and validation" "Go, go-jwt" {
                tags "Platform" "Security"
            }
            sessionStore = component "Session Store" "Session management" "Redis client" {
                tags "Platform" "Data"
            }
        }

        userService = container "User Service" "Manages user accounts and profiles" "Go" {
            tags "Platform" "Application" "PII"
            description "User CRUD operations, profile management, preferences"
        }

        # =================================================================
        # Data Layer
        # =================================================================
        database = container "Platform Database" "Stores platform data" "PostgreSQL" {
            tags "Platform" "Database" "Data" "PII"
            description "Primary relational store for users, sessions, and configurations"
        }

        redis = container "Redis Cluster" "Caching and session storage" "Redis 7" {
            tags "Platform" "Cache" "Data"
            description "In-memory caching, session data, rate limiting counters"
        }

        # =================================================================
        # Messaging Infrastructure
        # =================================================================
        messageQueue = container "Message Queue" "Async messaging between services" "RabbitMQ" {
            tags "Platform" "Infrastructure" "Messaging"
            description "Event bus for async communication, domain events"
        }

        # =================================================================
        # Internal Relationships
        # =================================================================
        apiGateway -> authService "Validates tokens with"
        apiGateway -> userService "Routes requests to"
        authService -> database "Reads/writes user sessions"
        authService -> redis "Caches sessions in"
        userService -> database "Reads/writes user data"
        userService -> messageQueue "Publishes events to"

        # Auth service components
        authService.authApi -> authService.tokenService "Issues tokens via"
        authService.authApi -> authService.sessionStore "Manages sessions via"
        authService.sessionStore -> redis "Stores sessions in"
    }
}
