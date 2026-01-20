# =============================================================================
# External Systems - Third-Party Dependencies
# =============================================================================
# External systems and services that the organization depends on.
# These are systems outside our control/ownership.
# =============================================================================

# =============================================================================
# Identity & Security
# =============================================================================
identityProvider = softwareSystem "Identity Provider" "External SSO provider (Okta/Auth0)" {
    tags "External" "Core" "Security"
    description "Enterprise SSO and authentication services via SAML/OIDC"
}

# =============================================================================
# Observability
# =============================================================================
monitoring = softwareSystem "Monitoring" "Observability platform (Datadog/Prometheus)" {
    tags "External" "Core" "Infrastructure"
    description "Metrics, logging, and tracing for system health monitoring"
}

# =============================================================================
# Payment Processing
# =============================================================================
paymentGateway = softwareSystem "Payment Gateway" "External payment processor (Stripe)" {
    tags "External" "Financial" "PCI"
    description "PCI-DSS compliant payment processing for order transactions"
}

# =============================================================================
# Inventory Management
# =============================================================================
inventorySystem = softwareSystem "Inventory System" "Manages product inventory" {
    tags "External" "Orders"
    description "Third-party inventory management and stock tracking"
}

# =============================================================================
# Communication Providers
# =============================================================================
emailProvider = softwareSystem "Email Provider" "SendGrid/SES for email delivery" {
    tags "External" "Notifications" "Communication"
    description "Transactional and marketing email delivery service"
}

smsProvider = softwareSystem "SMS Provider" "Twilio for SMS delivery" {
    tags "External" "Notifications" "Communication"
    description "SMS and MMS messaging delivery service"
}

pushProvider = softwareSystem "Push Provider" "Firebase for push notifications" {
    tags "External" "Notifications" "Communication"
    description "Mobile and web push notification delivery"
}
