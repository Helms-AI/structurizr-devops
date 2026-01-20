# Analytics Platform Views (C1-C3)

# C1 - System Context
systemContext analytics "AnalyticsContext" "System Context diagram for Analytics Platform" {
    include *
    autoLayout
}

# C2 - Container View
container analytics "AnalyticsContainers" "Container diagram for Analytics Platform" {
    include *
    autoLayout
}

# C3 - Component Views
component analytics.ingestionApi "IngestionApiComponents" "Component diagram for Ingestion API" {
    include *
    autoLayout
}

component analytics.streamProcessor "StreamProcessorComponents" "Component diagram for Stream Processor" {
    include *
    autoLayout
}
