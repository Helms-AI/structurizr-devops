# =============================================================================
# Theme - Unified Visual Styling
# =============================================================================
# Shared styling for all architecture diagrams.
# Consistent styling ensures visual coherence across all views.
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

    element "External" {
        background #999999
        color #ffffff
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

    element "Executive" {
        background #c62828
        color #ffffff
    }

    element "Security" {
        background #d32f2f
        color #ffffff
    }

    element "Compliance" {
        background #7b1fa2
        color #ffffff
    }

    element "Developer" {
        background #2e7d32
        color #ffffff
    }

    element "Operations" {
        background #f57c00
        color #ffffff
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
        background #0d47a1
        color #ffffff
    }

    element "Cache" {
        shape Cylinder
        background #ff5722
        color #ffffff
    }

    element "Messaging" {
        shape Pipe
        background #795548
        color #ffffff
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

    element "Application" {
        background #438dd5
    }

    element "Infrastructure" {
        background #37474f
        color #ffffff
    }

    element "Utility" {
        background #78909c
        color #ffffff
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

    element "Orders" {
        background #2e7d32
    }

    element "Notifications" {
        background #7b1fa2
    }

    # =========================================================================
    # Data Classification
    # =========================================================================
    element "Data" {
        background #1565c0
        color #ffffff
    }

    element "PII" {
        stroke #d32f2f
        strokeWidth 3
    }

    element "Financial" {
        stroke #ff5722
        strokeWidth 3
    }

    element "PCI" {
        stroke #ff5722
        strokeWidth 4
    }

    element "Public" {
        background #4caf50
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

    relationship "Encrypted" {
        color #2e7d32
        style solid
    }

    relationship "Authenticated" {
        color #1565c0
        style solid
    }
}
