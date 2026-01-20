# =============================================================================
# Orders Domain - Order Management
# =============================================================================
# Order management and fulfillment business domain.
# Handles customer orders, payment processing, and order lifecycle.
# =============================================================================

group "Orders Domain" {
    orderSystem = softwareSystem "Order System" "Manages customer orders and fulfillment" {
        tags "Orders" "Core" "Financial"
        description "Order capture, fulfillment, and customer service"

        # =================================================================
        # Application Services
        # =================================================================
        orderApi = container "Order API" "RESTful API for order operations" "Go" {
            tags "Orders" "Application"
            description "Order CRUD, status management, customer queries"

            orderController = component "Order Controller" "Handles HTTP requests" "Go" {
                tags "Orders" "Application"
            }
            orderService = component "Order Service" "Business logic for orders" "Go" {
                tags "Orders" "Application"
            }
            orderRepository = component "Order Repository" "Data access layer" "Go" {
                tags "Orders" "Data"
            }
        }

        orderWorker = container "Order Worker" "Processes async order tasks" "Go" {
            tags "Orders" "Worker" "Application"
            description "Background processing for fulfillment, notifications, analytics"
        }

        # =================================================================
        # Data Layer
        # =================================================================
        orderDatabase = container "Order Database" "Stores order data" "PostgreSQL" {
            tags "Orders" "Database" "Data" "Financial"
            description "Order records, line items, customer order history"
        }

        orderCache = container "Order Cache" "Caches frequently accessed orders" "Redis" {
            tags "Orders" "Cache" "Data"
            description "Hot order data, cart sessions, rate limiting"
        }

        # =================================================================
        # Internal Relationships
        # =================================================================
        orderApi.orderController -> orderApi.orderService "Uses"
        orderApi.orderService -> orderApi.orderRepository "Uses"
        orderApi.orderRepository -> orderDatabase "Reads/writes"
        orderApi.orderService -> orderCache "Caches data in"
        orderWorker -> orderDatabase "Processes orders from"
    }
}
