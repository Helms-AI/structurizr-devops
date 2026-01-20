# =============================================================================
# Security Perspective Views
# =============================================================================
# Security-focused views showing trust boundaries, data flows,
# and security controls.
# =============================================================================

# =============================================================================
# Security Landscape
# =============================================================================
systemLandscape "Security-Landscape" {
    include securityArchitect securityEngineer complianceOfficer
    include platform orderSystem notificationSystem
    include identityProvider paymentGateway
    autoLayout
    title "Security Architecture Overview"
    description "Overall security architecture showing trust boundaries and data flows"
}

# =============================================================================
# Filtered Security-Sensitive Elements
# =============================================================================
# Shows elements tagged with security-relevant tags
filtered "SystemLandscape" include "Element.tag==Security,Element.tag==PII,Element.tag==Financial" "Security-Sensitive" {
    title "Security-Sensitive Systems"
    description "Systems handling sensitive data requiring security controls"
}

# =============================================================================
# PCI Scope View
# =============================================================================
filtered "SystemLandscape" include "Element.tag==Financial,Element.tag==PCI" "Security-PCIScope" {
    title "PCI Scope"
    description "Systems in scope for PCI-DSS compliance"
}

# =============================================================================
# Platform Security View
# =============================================================================
container platform "Security-Platform-Containers" {
    include *
    autoLayout
    title "Platform Security Architecture"
    description "Platform containers with security controls and data classification"
}

# =============================================================================
# Data Flow Security View
# =============================================================================
container orderSystem "Security-Orders-Containers" {
    include *
    autoLayout
    title "Order System Security"
    description "Order system with PCI scope and financial data flows"
}
