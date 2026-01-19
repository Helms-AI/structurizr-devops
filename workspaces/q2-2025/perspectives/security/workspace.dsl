workspace "Security Architecture" "Security-focused view showing trust boundaries, data flows, and security controls" {

    !identifiers hierarchical

    model {
        # =============================================================================
        # Security Stakeholders
        # =============================================================================
        securityArchitect = person "Security Architect" "Designs and reviews security architecture" {
            tags "Security Team"
        }

        securityEngineer = person "Security Engineer" "Implements and monitors security controls" {
            tags "Security Team"
        }

        complianceOfficer = person "Compliance Officer" "Ensures regulatory compliance" {
            tags "Compliance"
        }

        # =============================================================================
        # Trust Boundaries
        # =============================================================================

        # External Zone (Untrusted)
        externalUser = person "External User" "End user accessing the system" {
            tags "External"
        }

        # DMZ Zone
        dmz = softwareSystem "DMZ Services" "Edge services handling external traffic" {
            tags "TrustBoundary" "DMZ"

            apiGateway = container "API Gateway" "WAF, rate limiting, TLS termination" {
                tags "Security Control"
            }

            loadBalancer = container "Load Balancer" "Traffic distribution and DDoS protection" {
                tags "Security Control"
            }
        }

        # Internal Zone (Trusted)
        internalServices = softwareSystem "Internal Services" "Core business services" {
            tags "TrustBoundary" "Internal"

            authService = container "Authentication Service" "OAuth2/OIDC, JWT issuance" {
                tags "Security Critical"
            }

            platformServices = container "Platform Services" "Core platform functionality" {
                tags "Internal Service"
            }

            orderServices = container "Order Services" "Order processing and fulfillment" {
                tags "Internal Service" "PCI Scope"
            }

            notificationServices = container "Notification Services" "Customer communications" {
                tags "Internal Service"
            }
        }

        # Data Zone (Restricted)
        dataServices = softwareSystem "Data Services" "Data storage and processing" {
            tags "TrustBoundary" "Data"

            primaryDatabase = container "Primary Database" "Encrypted at rest, TDE enabled" {
                tags "Data Store" "Encrypted"
            }

            cacheLayer = container "Cache Layer" "In-memory data, session storage" {
                tags "Data Store"
            }

            messageQueue = container "Message Queue" "Async communication, encrypted in transit" {
                tags "Data Store" "Encrypted"
            }
        }

        # External Dependencies
        identityProvider = softwareSystem "Identity Provider" "Enterprise SSO (SAML/OIDC)" {
            tags "External Dependency"
        }

        paymentGateway = softwareSystem "Payment Gateway" "PCI-DSS compliant payment processing" {
            tags "External Dependency" "PCI Scope"
        }

        # =============================================================================
        # Data Flow Relationships
        # =============================================================================

        # External to DMZ
        externalUser -> dmz.loadBalancer "HTTPS (TLS 1.3)" {
            tags "Encrypted"
        }
        dmz.loadBalancer -> dmz.apiGateway "Internal TLS" {
            tags "Encrypted"
        }

        # DMZ to Internal
        dmz.apiGateway -> internalServices.authService "mTLS, JWT validation" {
            tags "Authenticated"
        }
        dmz.apiGateway -> internalServices.platformServices "mTLS" {
            tags "Authenticated"
        }
        dmz.apiGateway -> internalServices.orderServices "mTLS" {
            tags "Authenticated"
        }

        # Internal service communication
        internalServices.platformServices -> internalServices.authService "Token validation"
        internalServices.orderServices -> internalServices.notificationServices "Event-driven"
        internalServices.authService -> identityProvider "SAML/OIDC federation"
        internalServices.orderServices -> paymentGateway "PCI-DSS compliant channel"

        # Internal to Data
        internalServices.authService -> dataServices.cacheLayer "Session data"
        internalServices.platformServices -> dataServices.primaryDatabase "Encrypted connection"
        internalServices.orderServices -> dataServices.primaryDatabase "Encrypted connection"
        internalServices.notificationServices -> dataServices.messageQueue "TLS encrypted"

        # Security team relationships
        securityArchitect -> dmz "Reviews architecture"
        securityEngineer -> dataServices "Monitors and maintains"
        complianceOfficer -> internalServices.orderServices "Audits PCI compliance"
    }

    views {
        # =============================================================================
        # Security Landscape
        # =============================================================================
        systemLandscape "SecurityLandscape" {
            include *
            autoLayout
            description "Overall security architecture showing trust boundaries and data flows"
        }

        # =============================================================================
        # Trust Boundary View
        # =============================================================================
        systemContext dmz "DMZContext" {
            include *
            autoLayout
            description "DMZ trust boundary and external interfaces"
        }

        # =============================================================================
        # Data Flow View
        # =============================================================================
        container internalServices "InternalServicesSecurityView" {
            include *
            autoLayout
            description "Internal services with security controls and data classification"
        }

        # =============================================================================
        # Data Services Security
        # =============================================================================
        container dataServices "DataServicesSecurityView" {
            include *
            autoLayout
            description "Data storage security controls and encryption"
        }

        # =============================================================================
        # Security Styles
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
            element "Person" {
                shape Person
                background #08427b
                color #ffffff
            }
            element "Security Team" {
                background #c62828
                color #ffffff
            }
            element "Compliance" {
                background #7b1fa2
                color #ffffff
            }
            element "External" {
                background #999999
                color #ffffff
            }
            element "TrustBoundary" {
                strokeWidth 4
            }
            element "DMZ" {
                background #ff9800
                color #000000
            }
            element "Internal" {
                background #2e7d32
                color #ffffff
            }
            element "Data" {
                background #1565c0
                color #ffffff
            }
            element "Security Control" {
                background #d32f2f
                color #ffffff
            }
            element "Security Critical" {
                background #b71c1c
                color #ffffff
            }
            element "PCI Scope" {
                stroke #ff5722
                strokeWidth 3
            }
            element "Data Store" {
                shape Cylinder
                background #0d47a1
                color #ffffff
            }
            element "Encrypted" {
                icon https://structurizr.com/static/img/lock.png
            }
            element "External Dependency" {
                background #757575
                color #ffffff
            }
            relationship "Encrypted" {
                color #2e7d32
                style solid
            }
            relationship "Authenticated" {
                color #1565c0
                style solid
            }
        }

        theme default
    }

}
