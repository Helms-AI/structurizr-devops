# =============================================================================
# Executive Perspective Views
# =============================================================================
# High-level business architecture views for leadership.
# Focuses on business capabilities and strategic relationships.
# =============================================================================

# =============================================================================
# Filtered Executive Landscape
# =============================================================================
# Shows only Core elements relevant to executive stakeholders
filtered "SystemLandscape" include "Element.tag==Core" "Executive-Landscape" {
    title "Executive Overview"
    description "Core systems and capabilities for leadership view"
}

# =============================================================================
# Business Capabilities View
# =============================================================================
# Custom landscape focusing on executive stakeholders
systemLandscape "Executive-BusinessCapabilities" {
    include cto ceo businessOwner
    include platform orderSystem notificationSystem
    include paymentGateway identityProvider
    autoLayout
    title "Business Capabilities"
    description "High-level view of business capabilities and their relationships"
}
