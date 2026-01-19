workspace "Orders Domain" "Order management and fulfillment business domain" {

    !identifiers hierarchical

    model {
        # =============================================================================
        # People
        # =============================================================================
        customer = person "Customer" "A customer placing orders" {
            tags "External"
        }

        supportAgent = person "Support Agent" "Handles order issues and inquiries" {
            tags "Internal"
        }

        # =============================================================================
        # Order System
        # =============================================================================
        orderSystem = softwareSystem "Order System" "Manages customer orders and fulfillment" {
            tags "Orders Domain"

            orderApi = container "Order API" "RESTful API for order operations" "Go" {
                tags "Service"

                orderController = component "Order Controller" "Handles HTTP requests" "Go"
                orderService = component "Order Service" "Business logic for orders" "Go"
                orderRepository = component "Order Repository" "Data access layer" "Go"
            }

            orderWorker = container "Order Worker" "Processes async order tasks" "Go" {
                tags "Worker"
            }

            orderDatabase = container "Order Database" "Stores order data" "PostgreSQL" {
                tags "Database"
            }

            orderCache = container "Order Cache" "Caches frequently accessed orders" "Redis" {
                tags "Cache"
            }
        }

        # =============================================================================
        # External Dependencies
        # =============================================================================
        platform = softwareSystem "Platform" "Core platform services" {
            tags "External System"
        }

        paymentGateway = softwareSystem "Payment Gateway" "External payment processor" {
            tags "External System"
        }

        inventorySystem = softwareSystem "Inventory System" "Manages product inventory" {
            tags "External System"
        }

        # =============================================================================
        # Relationships
        # =============================================================================
        customer -> orderSystem "Places orders via"
        supportAgent -> orderSystem "Manages orders via"

        orderSystem.orderApi.orderController -> orderSystem.orderApi.orderService "Uses"
        orderSystem.orderApi.orderService -> orderSystem.orderApi.orderRepository "Uses"
        orderSystem.orderApi.orderRepository -> orderSystem.orderDatabase "Reads/writes"
        orderSystem.orderApi.orderService -> orderSystem.orderCache "Caches data in"

        orderSystem.orderApi -> platform "Authenticates via"
        orderSystem.orderApi -> paymentGateway "Processes payments via"
        orderSystem.orderApi -> inventorySystem "Checks inventory via"

        orderSystem.orderWorker -> orderSystem.orderDatabase "Processes orders from"
        orderSystem.orderWorker -> platform "Publishes events to"
    }

    views {
        # =============================================================================
        # System Context
        # =============================================================================
        systemContext orderSystem "SystemContext" {
            include *
            autoLayout
            description "Order system context showing external dependencies"
        }

        # =============================================================================
        # Container View
        # =============================================================================
        container orderSystem "Containers" {
            include *
            autoLayout
            description "Order system containers"
        }

        # =============================================================================
        # Component View
        # =============================================================================
        component orderSystem.orderApi "Components" {
            include *
            autoLayout
            description "Order API internal components"
        }

        # =============================================================================
        # Styles
        # =============================================================================
        styles {
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "External System" {
                background #999999
                color #ffffff
            }
            element "Person" {
                shape person
                background #08427b
                color #ffffff
            }
            element "Internal" {
                background #08427b
            }
            element "External" {
                background #999999
            }
            element "Container" {
                background #438dd5
                color #ffffff
            }
            element "Component" {
                background #85bbf0
                color #000000
            }
            element "Database" {
                shape cylinder
            }
            element "Cache" {
                shape cylinder
                background #85bbf0
            }
            element "Worker" {
                shape hexagon
            }
            element "Service" {
                background #438dd5
            }
            element "Orders Domain" {
                background #2e7d32
            }
        }

        theme default
    }

}
