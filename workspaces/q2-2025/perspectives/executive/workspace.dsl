workspace "Executive Dashboard" "High-level business architecture view for leadership" {

    !identifiers hierarchical

    model {
        # =============================================================================
        # Stakeholders
        # =============================================================================
        cto = person "CTO" "Chief Technology Officer" {
            tags "Executive"
        }

        ceo = person "CEO" "Chief Executive Officer" {
            tags "Executive"
        }

        businessOwner = person "Business Owner" "Domain business owner" {
            tags "Internal"
        }

        # =============================================================================
        # Business Capabilities (High-Level Systems)
        # =============================================================================
        platformCapability = softwareSystem "Platform Services" "Core platform infrastructure enabling all business domains" {
            tags "Capability" "Platform"
            description "Authentication, user management, messaging, and shared infrastructure"
        }

        orderCapability = softwareSystem "Order Management" "End-to-end order processing capability" {
            tags "Capability" "Orders"
            description "Order capture, fulfillment, and customer service"
        }

        notificationCapability = softwareSystem "Customer Engagement" "Multi-channel customer communication" {
            tags "Capability" "Notifications"
            description "Email, SMS, and push notification delivery"
        }

        # =============================================================================
        # External Dependencies (Business View)
        # =============================================================================
        paymentProvider = softwareSystem "Payment Processing" "External payment gateway services" {
            tags "External Capability"
        }

        identityProvider = softwareSystem "Identity Services" "Enterprise SSO and authentication" {
            tags "External Capability"
        }

        # =============================================================================
        # Relationships (Business Level)
        # =============================================================================
        cto -> platformCapability "Oversees technology strategy"
        businessOwner -> orderCapability "Owns order domain"
        businessOwner -> notificationCapability "Owns engagement domain"

        orderCapability -> platformCapability "Depends on"
        notificationCapability -> platformCapability "Depends on"
        orderCapability -> paymentProvider "Processes payments via"
        platformCapability -> identityProvider "Authenticates via"
        orderCapability -> notificationCapability "Triggers notifications"
    }

    views {
        # =============================================================================
        # Business Capability Map
        # =============================================================================
        systemLandscape "BusinessCapabilities" {
            include *
            autoLayout
            description "High-level view of business capabilities and their relationships"
        }

        # =============================================================================
        # Platform Dependencies
        # =============================================================================
        systemContext platformCapability "PlatformContext" {
            include *
            autoLayout
            description "Platform services and dependent capabilities"
        }

        # =============================================================================
        # Styles (Executive Theme)
        # =============================================================================
        styles {
            element "Software System" {
                background #1168bd
                color #ffffff
                shape RoundedBox
            }
            element "Capability" {
                background #2e7d32
                color #ffffff
            }
            element "External Capability" {
                background #999999
                color #ffffff
            }
            element "Person" {
                shape Person
                background #08427b
                color #ffffff
            }
            element "Executive" {
                background #c62828
                color #ffffff
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
        }

        theme default
    }

}
