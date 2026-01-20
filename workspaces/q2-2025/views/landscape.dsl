# =============================================================================
# System Landscape Views
# =============================================================================
# High-level views showing all systems and their relationships.
# =============================================================================

# =============================================================================
# Full System Landscape
# =============================================================================
systemLandscape "SystemLandscape" {
    include *
    autoLayout
    title "System Landscape"
    description "Complete system landscape showing all domains and external dependencies"
}

# =============================================================================
# Internal Systems Only
# =============================================================================
systemLandscape "InternalSystems" {
    include platform orderSystem notificationSystem
    include developer architect platformDev domainDev sre
    autoLayout
    title "Internal Systems"
    description "Internal systems without external dependencies"
}
