# =============================================================================
# Orders Domain Views
# =============================================================================
# Views focused on the Orders domain architecture.
# =============================================================================

# =============================================================================
# Orders System Context
# =============================================================================
systemContext orderSystem "Orders-Context" {
    include *
    autoLayout
    title "Order System Context"
    description "Order system context showing external dependencies"
}

# =============================================================================
# Orders Containers
# =============================================================================
container orderSystem "Orders-Containers" {
    include *
    autoLayout
    title "Order System Containers"
    description "Order system container architecture"
}

# =============================================================================
# Order API Components
# =============================================================================
component orderSystem.orderApi "Orders-OrderApi-Components" {
    include *
    autoLayout
    title "Order API Components"
    description "Order API internal components"
}
