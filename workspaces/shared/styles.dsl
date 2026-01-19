# =============================================================================
# Shared Styles - Common Visual Styling Across All Workspaces
# =============================================================================
# This file contains the standard styling for all architecture diagrams.
# Include this file in workspace DSL views sections using:
#   !include ../shared/styles.dsl
#
# Consistent styling ensures:
#   - Visual coherence across team workspaces
#   - Clear distinction between internal/external systems
#   - Recognizable element shapes by type
# =============================================================================

styles {
    # =========================================================================
    # Software Systems
    # =========================================================================
    element "Software System" {
        background #1168bd
        color #ffffff
        shape RoundedBox
    }

    element "External System" {
        background #999999
        color #ffffff
        shape RoundedBox
    }

    # =========================================================================
    # People
    # =========================================================================
    element "Person" {
        shape Person
        background #08427b
        color #ffffff
    }

    element "Internal" {
        background #08427b
    }

    element "External" {
        background #999999
    }

    # =========================================================================
    # Containers
    # =========================================================================
    element "Container" {
        background #438dd5
        color #ffffff
    }

    element "Database" {
        shape Cylinder
    }

    element "Cache" {
        shape Cylinder
        background #85bbf0
        color #000000
    }

    element "Queue" {
        shape Pipe
        background #f9a825
        color #000000
    }

    element "Worker" {
        shape Hexagon
        background #438dd5
    }

    element "Service" {
        background #438dd5
    }

    element "Infrastructure" {
        background #85bbf0
        color #000000
    }

    # =========================================================================
    # Components
    # =========================================================================
    element "Component" {
        background #85bbf0
        color #000000
    }

    # =========================================================================
    # Domain Colors
    # =========================================================================
    element "Platform" {
        background #1168bd
    }

    element "Platform Domain" {
        background #1168bd
    }

    element "Orders Domain" {
        background #2e7d32
    }

    element "Notifications Domain" {
        background #7b1fa2
    }

    # =========================================================================
    # Core Elements (stable across quarters)
    # =========================================================================
    element "Core" {
        border solid
        strokeWidth 3
    }

    # =========================================================================
    # Relationships
    # =========================================================================
    relationship "Relationship" {
        thickness 2
        color #707070
        style solid
    }

    relationship "Async" {
        style dashed
        color #f9a825
    }
}
