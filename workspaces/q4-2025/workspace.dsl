# =============================================================================
# Q2 2025 Architecture Workspace
# =============================================================================
# Unified architecture workspace for Q2 2025 containing all business domains
# and stakeholder perspectives. This single workspace replaces the previous
# multi-workspace structure with domain-specific workspaces.
#
# Structure:
#   - model/         Unified architecture model organized by domain
#   - views/         Views organized by purpose (domains, perspectives)
#   - styles/        Shared visual styling
#
# Tagging Strategy:
#   Domain tags:     Platform, Orders, Notifications
#   Visibility:      Core, Supporting, Generic
#   Security:        PII, Financial, Public
#   Technical:       Infrastructure, Application, Data
# =============================================================================

workspace "Q2 2025" "Q2 2025 architecture workspace" {

    !identifiers hierarchical

    model {
        # =====================================================================
        # People & External Systems
        # =====================================================================
        !include model/people.dsl
        !include model/external-systems.dsl

        # =====================================================================
        # Business Domains
        # =====================================================================
        !include model/domains/platform/system.dsl
        !include model/domains/orders/system.dsl
        !include model/domains/notifications/system.dsl

        # =====================================================================
        # Cross-Domain Relationships
        # =====================================================================
        # Platform dependencies
        endUser -> platform.apiGateway "Uses APIs via" "HTTPS"
        developer -> platform "Develops and maintains"
        architect -> platform "Designs architecture for"
        platform -> monitoring "Sends metrics to"
        platform.authService -> identityProvider "Authenticates via" "OIDC"

        # Orders dependencies
        customer -> orderSystem "Places orders via"
        supportAgent -> orderSystem "Manages orders via"
        orderSystem.orderApi -> platform.apiGateway "Authenticates via"
        orderSystem.orderApi -> paymentGateway "Processes payments via"
        orderSystem.orderApi -> inventorySystem "Checks inventory via"
        orderSystem.orderWorker -> platform.messageQueue "Publishes events to"

        # Notifications dependencies
        recipient -> notificationSystem "Receives notifications from"
        operator -> notificationSystem "Configures templates in"
        platform -> notificationSystem.notificationApi "Triggers notifications via" "REST API"
        notificationSystem.notificationWorker -> emailProvider "Sends emails via" "SMTP/API"
        notificationSystem.notificationWorker -> smsProvider "Sends SMS via" "API"
        notificationSystem.notificationWorker -> pushProvider "Sends push via" "API"

        # Cross-domain integration
        orderSystem.orderWorker -> notificationSystem.notificationApi "Triggers order notifications"
    }

    views {
        # =====================================================================
        # Domain Views
        # =====================================================================
        !include views/landscape.dsl
        !include views/domains/platform.dsl
        !include views/domains/orders.dsl
        !include views/domains/notifications.dsl

        # =====================================================================
        # Perspective Views (Filtered)
        # =====================================================================
        !include views/perspectives/executive.dsl
        !include views/perspectives/security.dsl
        !include views/perspectives/technical.dsl

        # =====================================================================
        # Styles
        # =====================================================================
        !include styles/theme.dsl
    }

}
