# E-Commerce Platform - Main System (C1-C3)

ecommerce = softwareSystem "E-Commerce Platform" "Allows customers to browse products and place orders" {
    tags "Core"

    # C2 - Containers
    webApp = container "Web Application" "Delivers the static content and SPA" "React, TypeScript" {
        tags "WebBrowser"
    }

    apiGateway = container "API Gateway" "Routes and authenticates API requests" "Node.js, Express" {
        tags "API"
    }

    productService = container "Product Service" "Manages product catalog and inventory" "Node.js, TypeScript" {
        tags "Microservice"

        # C3 - Components
        productController = component "Product Controller" "REST API endpoints for products" "Express Router"
        productRepository = component "Product Repository" "Data access for products" "TypeORM"
        inventoryManager = component "Inventory Manager" "Manages stock levels" "Business Logic"
        searchEngine = component "Search Engine" "Full-text product search" "Elasticsearch Client"

        # Component relationships
        productController -> productRepository "Uses"
        productController -> inventoryManager "Uses"
        productController -> searchEngine "Searches via"
        inventoryManager -> productRepository "Updates stock via"
    }

    orderService = container "Order Service" "Handles order processing and fulfillment" "Node.js, TypeScript" {
        tags "Microservice"

        # C3 - Components
        orderController = component "Order Controller" "REST API endpoints for orders" "Express Router"
        orderRepository = component "Order Repository" "Data access for orders" "TypeORM"
        paymentProcessor = component "Payment Processor" "Integrates with payment gateway" "Stripe SDK"
        notificationService = component "Notification Service" "Sends order notifications" "Email Client"

        # Component relationships
        orderController -> orderRepository "Uses"
        orderController -> paymentProcessor "Processes payments via"
        orderController -> notificationService "Sends notifications via"
    }

    userService = container "User Service" "Manages user accounts and authentication" "Node.js, TypeScript" {
        tags "Microservice"
    }

    database = container "Database" "Stores product, order, and user data" "PostgreSQL" {
        tags "Database"
    }

    cache = container "Cache" "Caches frequently accessed data" "Redis" {
        tags "Database"
    }

    messageQueue = container "Message Queue" "Async communication between services" "RabbitMQ" {
        tags "Infrastructure"
    }

    # Container relationships
    webApp -> apiGateway "Makes API calls to" "HTTPS/JSON"
    apiGateway -> productService "Routes requests to" "HTTP/JSON"
    apiGateway -> orderService "Routes requests to" "HTTP/JSON"
    apiGateway -> userService "Routes requests to" "HTTP/JSON"

    productService -> database "Reads/writes data" "SQL"
    productService -> cache "Caches data" "Redis Protocol"
    orderService -> database "Reads/writes data" "SQL"
    orderService -> messageQueue "Publishes events" "AMQP"
    userService -> database "Reads/writes data" "SQL"

    # Cross-container component relationships
    productService.productRepository -> database "Reads/writes" "SQL"
    productService.searchEngine -> cache "Caches results in"
    orderService.orderRepository -> database "Reads/writes" "SQL"
    orderService.notificationService -> messageQueue "Publishes events to" "AMQP"
}
