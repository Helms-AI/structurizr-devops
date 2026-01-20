# =============================================================================
# Platform Domain Views
# =============================================================================
# Views focused on the Platform domain architecture.
# =============================================================================

# =============================================================================
# Platform System Context
# =============================================================================
systemContext platform "Platform-Context" {
    include *
    autoLayout
    title "Platform System Context"
    description "Platform system and its external dependencies"
}

# =============================================================================
# Platform Containers
# =============================================================================
container platform "Platform-Containers" {
    include *
    autoLayout
    title "Platform Containers"
    description "Platform internal container architecture"
}

# =============================================================================
# Auth Service Components
# =============================================================================
component platform.authService "Platform-AuthService-Components" {
    include *
    autoLayout
    title "Auth Service Components"
    description "Authentication service internal components"
}
