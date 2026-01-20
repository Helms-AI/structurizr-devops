# Analytics Platform - Second System (C2-C3)

analytics = softwareSystem "Analytics Platform" "Collects, processes, and visualizes business metrics and user behavior" {
    tags "Core"

    # C2 - Containers
    dashboard = container "Analytics Dashboard" "Interactive dashboards for business insights" "React, D3.js" {
        tags "WebBrowser"
    }

    ingestionApi = container "Ingestion API" "Receives events from various sources" "Go, Gin" {
        tags "API"

        # C3 - Components
        eventReceiver = component "Event Receiver" "HTTP endpoint for event ingestion" "Gin Handler"
        eventValidator = component "Event Validator" "Validates and enriches events" "Validator"
        eventRouter = component "Event Router" "Routes events to appropriate queues" "Router"

        # Component relationships
        eventReceiver -> eventValidator "Validates via"
        eventValidator -> eventRouter "Routes via"
    }

    streamProcessor = container "Stream Processor" "Real-time event processing and aggregation" "Apache Flink" {
        tags "Microservice"

        # C3 - Components
        eventConsumer = component "Event Consumer" "Consumes events from Kafka" "Flink Source"
        aggregator = component "Aggregator" "Computes real-time metrics" "Flink Operator"
        alertEngine = component "Alert Engine" "Triggers alerts on thresholds" "Flink Operator"
        sinkWriter = component "Sink Writer" "Writes results to data stores" "Flink Sink"

        # Component relationships
        eventConsumer -> aggregator "Feeds events to"
        aggregator -> sinkWriter "Writes aggregates via"
        aggregator -> alertEngine "Triggers alerts via"
    }

    queryService = container "Query Service" "Serves analytics queries and reports" "Python, FastAPI" {
        tags "Microservice"
    }

    eventStore = container "Event Store" "Stores raw events for replay" "Apache Kafka" {
        tags "Infrastructure"
    }

    timeSeries = container "Time Series DB" "Stores metrics and aggregations" "InfluxDB" {
        tags "Database"
    }

    dataWarehouse = container "Data Warehouse" "Long-term analytics storage" "ClickHouse" {
        tags "Database"
    }

    # Container relationships
    dashboard -> queryService "Queries data from" "HTTPS/GraphQL"
    ingestionApi -> eventStore "Publishes events to" "Kafka Protocol"
    streamProcessor -> eventStore "Consumes events from" "Kafka Protocol"
    streamProcessor -> timeSeries "Writes metrics to" "InfluxDB Protocol"
    streamProcessor -> dataWarehouse "Writes aggregates to" "Native Protocol"
    queryService -> timeSeries "Reads metrics from" "InfluxQL"
    queryService -> dataWarehouse "Reads reports from" "SQL"

    # Cross-container component relationships
    ingestionApi.eventRouter -> eventStore "Publishes to" "Kafka"
    streamProcessor.eventConsumer -> eventStore "Consumes from" "Kafka"
    streamProcessor.sinkWriter -> timeSeries "Writes to"
    streamProcessor.sinkWriter -> dataWarehouse "Writes to"
}

# Integration with e-commerce
ecommerce -> analytics "Sends events to" "HTTPS"
ecommerce.orderService -> analytics.ingestionApi "Sends order events" "HTTPS"
ecommerce.productService -> analytics.ingestionApi "Sends product events" "HTTPS"
admin -> analytics.dashboard "Views reports"
