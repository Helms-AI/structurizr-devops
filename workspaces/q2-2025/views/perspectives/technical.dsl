# =============================================================================
# Technical Perspective Views
# =============================================================================
# Developer-focused views with implementation details, tech stack,
# and deployment architecture.
# =============================================================================

# =============================================================================
# Technical Landscape
# =============================================================================
systemLandscape "Technical-Landscape" {
    include platformDev domainDev sre developer architect
    include platform orderSystem notificationSystem
    include emailProvider smsProvider paymentGateway identityProvider monitoring
    autoLayout
    title "Technical Architecture"
    description "High-level technical architecture showing all domains and external dependencies"
}

# =============================================================================
# Filtered Infrastructure View
# =============================================================================
filtered "SystemLandscape" include "Element.tag==Infrastructure" "Technical-Infrastructure" {
    title "Infrastructure Components"
    description "Infrastructure and DevOps view of the system"
}

# =============================================================================
# Platform Technical Detail
# =============================================================================
container platform "Technical-Platform" {
    include *
    autoLayout
    title "Platform Technical Architecture"
    description "Platform domain containers with technology stack"
}

# =============================================================================
# Auth Service Technical Detail
# =============================================================================
component platform.authService "Technical-AuthService" {
    include *
    autoLayout
    title "Auth Service Components"
    description "Auth service internal components and technology"
}

# =============================================================================
# Orders Technical Detail
# =============================================================================
container orderSystem "Technical-Orders" {
    include *
    autoLayout
    title "Orders Technical Architecture"
    description "Orders domain containers with technology stack"
}

# =============================================================================
# Order API Technical Detail
# =============================================================================
component orderSystem.orderApi "Technical-OrderApi" {
    include *
    autoLayout
    title "Order API Components"
    description "Order API internal components and architecture"
}

# =============================================================================
# Notifications Technical Detail
# =============================================================================
container notificationSystem "Technical-Notifications" {
    include *
    autoLayout
    title "Notifications Technical Architecture"
    description "Notifications domain containers with technology stack"
}
