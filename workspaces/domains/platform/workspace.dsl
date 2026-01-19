workspace "Platform Domain" "Core platform infrastructure and shared services domain" {

    !identifiers hierarchical

    model {
        # =============================================================================
        # People
        # =============================================================================
        developer = person "Developer" "A software developer working on the platform" {
            tags "Internal"
        }

        architect = person "Architect" "Platform architect responsible for system design" {
            tags "Internal"
        }

        endUser = person "End User" "External user consuming platform services" {
            tags "External"
        }

        # =============================================================================
        # Platform System
        # =============================================================================
        platform = softwareSystem "Platform" "Core platform providing shared services" {
            tags "Platform"

            apiGateway = container "API Gateway" "Routes and authenticates API requests" "Kong/NGINX" {
                tags "Infrastructure"
            }

            authService = container "Auth Service" "Handles authentication and authorization" "Go" {
                tags "Service"
            }

            userService = container "User Service" "Manages user accounts and profiles" "Go" {
                tags "Service"
            }

            database = container "Platform Database" "Stores platform data" "PostgreSQL" {
                tags "Database"
            }

            messageQueue = container "Message Queue" "Async messaging between services" "RabbitMQ" {
                tags "Infrastructure"
            }
        }

        # =============================================================================
        # External Systems
        # =============================================================================
        identityProvider = softwareSystem "Identity Provider" "External SSO provider" {
            tags "External System"
        }

        monitoring = softwareSystem "Monitoring" "Observability platform" {
            tags "External System"
        }

        # =============================================================================
        # Relationships
        # =============================================================================
        developer -> platform "Develops and maintains"
        architect -> platform "Designs architecture for"
        endUser -> platform.apiGateway "Uses APIs via" "HTTPS"

        platform.apiGateway -> platform.authService "Validates tokens with"
        platform.apiGateway -> platform.userService "Routes requests to"
        platform.authService -> identityProvider "Authenticates via" "OIDC"
        platform.authService -> platform.database "Reads/writes user sessions"
        platform.userService -> platform.database "Reads/writes user data"
        platform.userService -> platform.messageQueue "Publishes events to"

        platform -> monitoring "Sends metrics to"
    }

    views {
        # =============================================================================
        # System Context
        # =============================================================================
        systemContext platform "SystemContext" {
            include *
            autoLayout
            description "System context diagram showing the platform and its relationships"
        }

        # =============================================================================
        # Container View
        # =============================================================================
        container platform "Containers" {
            include *
            autoLayout
            description "Container diagram showing the platform's internal structure"
        }

        # =============================================================================
        # Styles
        # =============================================================================
        styles {
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "External System" {
                background #999999
                color #ffffff
            }
            element "Person" {
                shape person
                background #08427b
                color #ffffff
            }
            element "Internal" {
                background #08427b
            }
            element "External" {
                background #999999
            }
            element "Container" {
                background #438dd5
                color #ffffff
            }
            element "Database" {
                shape cylinder
            }
            element "Infrastructure" {
                background #85bbf0
                color #000000
            }
            element "Service" {
                background #438dd5
            }
            element "Platform" {
                background #1168bd
            }
        }

        # =============================================================================
        # Themes
        # =============================================================================
        theme default
    }

}
