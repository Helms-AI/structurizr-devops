# =============================================================================
# Base Model - Shared Elements Across Quarters
# =============================================================================
# This file contains common people, systems, and relationships that persist
# across quarterly architecture snapshots. Include this file in workspace DSLs
# using: !include ../shared/base-model.dsl
#
# Purpose:
#   - Define stable organizational personas
#   - Define core platform systems that don't change quarterly
#   - Establish baseline relationships
#
# Note: Quarter-specific additions should be made in the workspace.dsl files,
# not here. This file should only contain elements that are stable across quarters.
# =============================================================================

# =============================================================================
# Core Organizational Personas
# =============================================================================
# These represent the primary actors interacting with our systems

developer = person "Developer" "A software developer working on the platform" {
    tags "Internal" "Core"
}

architect = person "Architect" "Platform architect responsible for system design" {
    tags "Internal" "Core"
}

endUser = person "End User" "External user consuming platform services" {
    tags "External"
}

# =============================================================================
# Core External Systems
# =============================================================================
# Stable external dependencies that persist across quarters

identityProvider = softwareSystem "Identity Provider" "External SSO provider (Okta/Auth0)" {
    tags "External System" "Core"
}

monitoring = softwareSystem "Monitoring" "Observability platform (Datadog/Prometheus)" {
    tags "External System" "Core"
}
