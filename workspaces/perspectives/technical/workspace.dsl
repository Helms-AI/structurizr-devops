workspace "Technical Architecture" "Developer-focused view with implementation details, tech stack, and deployment" {

    !identifiers hierarchical

    model {
        # =============================================================================
        # Development Personas
        # =============================================================================
        platformDev = person "Platform Developer" "Develops core platform services" {
            tags "Developer"
        }

        domainDev = person "Domain Developer" "Develops business domain services" {
            tags "Developer"
        }

        sre = person "SRE" "Site Reliability Engineer" {
            tags "Operations"
        }

        # =============================================================================
        # Platform Domain (Infrastructure Layer)
        # =============================================================================
        platformDomain = softwareSystem "Platform Domain" "Core platform infrastructure services" {
            tags "Domain" "Platform"

            apiGateway = container "API Gateway" "Kong/Envoy - Request routing, auth, rate limiting" {
                technology "Kong Gateway"
                tags "Infrastructure"
            }

            authService = container "Auth Service" "Authentication and authorization" {
                technology "Go, OAuth2, JWT"
                tags "Microservice"

                authApi = component "Auth API" "REST endpoints for auth operations" {
                    technology "Go, Chi router"
                }
                tokenService = component "Token Service" "JWT generation and validation" {
                    technology "Go, go-jwt"
                }
                sessionStore = component "Session Store" "Session management" {
                    technology "Redis client"
                }
            }

            userService = container "User Service" "User management and profiles" {
                technology "Go, gRPC"
                tags "Microservice"
            }

            platformDb = container "Platform Database" "Primary relational store" {
                technology "PostgreSQL 15"
                tags "Database"
            }

            redis = container "Redis Cluster" "Caching and session storage" {
                technology "Redis 7"
                tags "Cache"
            }

            messageQueue = container "Message Queue" "Event bus for async communication" {
                technology "RabbitMQ"
                tags "Messaging"
            }
        }

        # =============================================================================
        # Orders Domain (Business Layer)
        # =============================================================================
        ordersDomain = softwareSystem "Orders Domain" "Order management business domain" {
            tags "Domain" "Orders"

            orderApi = container "Order API" "Order management REST API" {
                technology "TypeScript, NestJS"
                tags "Microservice"

                orderController = component "Order Controller" "REST endpoints" {
                    technology "NestJS Controller"
                }
                orderService = component "Order Service" "Business logic" {
                    technology "NestJS Service"
                }
                orderRepository = component "Order Repository" "Data access layer" {
                    technology "TypeORM"
                }
            }

            orderWorker = container "Order Worker" "Background processing for orders" {
                technology "TypeScript, Bull"
                tags "Worker"
            }

            orderDb = container "Order Database" "Order data store" {
                technology "PostgreSQL 15"
                tags "Database"
            }

            orderCache = container "Order Cache" "Order data caching" {
                technology "Redis"
                tags "Cache"
            }
        }

        # =============================================================================
        # Notifications Domain (Business Layer)
        # =============================================================================
        notificationsDomain = softwareSystem "Notifications Domain" "Customer communication domain" {
            tags "Domain" "Notifications"

            notificationApi = container "Notification API" "Notification management API" {
                technology "Python, FastAPI"
                tags "Microservice"
            }

            notificationWorker = container "Notification Worker" "Message delivery worker" {
                technology "Python, Celery"
                tags "Worker"
            }

            templateEngine = container "Template Engine" "Email/SMS template rendering" {
                technology "Jinja2"
                tags "Utility"
            }

            notificationDb = container "Notification Database" "Notification history and templates" {
                technology "MongoDB"
                tags "Database"
            }

            notificationQueue = container "Notification Queue" "Delivery queue" {
                technology "RabbitMQ"
                tags "Messaging"
            }
        }

        # =============================================================================
        # External Systems
        # =============================================================================
        emailProvider = softwareSystem "Email Provider" "SendGrid/SES for email delivery" {
            tags "External"
        }

        smsProvider = softwareSystem "SMS Provider" "Twilio for SMS delivery" {
            tags "External"
        }

        paymentGateway = softwareSystem "Payment Gateway" "Stripe for payment processing" {
            tags "External"
        }

        identityProvider = softwareSystem "Identity Provider" "Okta/Auth0 for SSO" {
            tags "External"
        }

        # =============================================================================
        # Relationships
        # =============================================================================

        # Developer interactions
        platformDev -> platformDomain "Develops"
        domainDev -> ordersDomain "Develops"
        domainDev -> notificationsDomain "Develops"
        sre -> platformDomain "Operates and monitors"

        # Platform domain internal
        platformDomain.apiGateway -> platformDomain.authService "Validates tokens"
        platformDomain.apiGateway -> platformDomain.userService "Routes requests"
        platformDomain.authService -> platformDomain.platformDb "Reads/writes user auth"
        platformDomain.authService -> platformDomain.redis "Caches sessions"
        platformDomain.authService -> identityProvider "Federates auth"
        platformDomain.userService -> platformDomain.platformDb "Reads/writes users"

        # Auth service internal
        platformDomain.authService.authApi -> platformDomain.authService.tokenService "Issues tokens"
        platformDomain.authService.authApi -> platformDomain.authService.sessionStore "Manages sessions"
        platformDomain.authService.sessionStore -> platformDomain.redis "Stores sessions"

        # Orders domain
        platformDomain.apiGateway -> ordersDomain.orderApi "Routes /api/orders"
        ordersDomain.orderApi -> ordersDomain.orderDb "Persists orders"
        ordersDomain.orderApi -> ordersDomain.orderCache "Caches orders"
        ordersDomain.orderApi -> platformDomain.messageQueue "Publishes events"
        ordersDomain.orderWorker -> platformDomain.messageQueue "Consumes events"
        ordersDomain.orderWorker -> ordersDomain.orderDb "Updates orders"
        ordersDomain.orderApi -> paymentGateway "Processes payments"

        # Order API internal
        ordersDomain.orderApi.orderController -> ordersDomain.orderApi.orderService "Delegates"
        ordersDomain.orderApi.orderService -> ordersDomain.orderApi.orderRepository "Data access"
        ordersDomain.orderApi.orderRepository -> ordersDomain.orderDb "SQL queries"

        # Notifications domain
        platformDomain.messageQueue -> notificationsDomain.notificationQueue "Forwards events"
        notificationsDomain.notificationApi -> notificationsDomain.notificationDb "Stores templates"
        notificationsDomain.notificationWorker -> notificationsDomain.notificationQueue "Consumes messages"
        notificationsDomain.notificationWorker -> notificationsDomain.templateEngine "Renders templates"
        notificationsDomain.notificationWorker -> emailProvider "Sends emails"
        notificationsDomain.notificationWorker -> smsProvider "Sends SMS"

        # Cross-domain
        ordersDomain.orderApi -> notificationsDomain.notificationApi "Triggers notifications"
    }

    views {
        # =============================================================================
        # System Landscape
        # =============================================================================
        systemLandscape "TechnicalLandscape" {
            include *
            autoLayout
            description "High-level technical architecture showing all domains and external dependencies"
        }

        # =============================================================================
        # Platform Domain Detail
        # =============================================================================
        container platformDomain "PlatformContainers" {
            include *
            autoLayout
            description "Platform domain containers with technology stack"
        }

        # =============================================================================
        # Auth Service Components
        # =============================================================================
        component platformDomain.authService "AuthServiceComponents" {
            include *
            autoLayout
            description "Auth service internal components"
        }

        # =============================================================================
        # Orders Domain Detail
        # =============================================================================
        container ordersDomain "OrdersContainers" {
            include *
            autoLayout
            description "Orders domain containers with technology stack"
        }

        # =============================================================================
        # Order API Components
        # =============================================================================
        component ordersDomain.orderApi "OrderApiComponents" {
            include *
            autoLayout
            description "Order API internal components"
        }

        # =============================================================================
        # Notifications Domain Detail
        # =============================================================================
        container notificationsDomain "NotificationsContainers" {
            include *
            autoLayout
            description "Notifications domain containers with technology stack"
        }

        # =============================================================================
        # Technical Styles
        # =============================================================================
        styles {
            element "Software System" {
                background #1168bd
                color #ffffff
                shape RoundedBox
            }
            element "Container" {
                background #438dd5
                color #ffffff
            }
            element "Component" {
                background #85bbf0
                color #000000
            }
            element "Person" {
                shape Person
                background #08427b
                color #ffffff
            }
            element "Developer" {
                background #2e7d32
                color #ffffff
            }
            element "Operations" {
                background #f57c00
                color #ffffff
            }
            element "Domain" {
                shape RoundedBox
            }
            element "Platform" {
                background #1168bd
            }
            element "Orders" {
                background #2e7d32
            }
            element "Notifications" {
                background #7b1fa2
            }
            element "Microservice" {
                shape Hexagon
            }
            element "Worker" {
                shape Robot
            }
            element "Database" {
                shape Cylinder
                background #0d47a1
                color #ffffff
            }
            element "Cache" {
                shape Cylinder
                background #ff5722
                color #ffffff
            }
            element "Messaging" {
                shape Pipe
                background #795548
                color #ffffff
            }
            element "Infrastructure" {
                background #37474f
                color #ffffff
            }
            element "External" {
                background #999999
                color #ffffff
            }
            element "Utility" {
                background #78909c
                color #ffffff
            }
        }

        theme default
    }

}
