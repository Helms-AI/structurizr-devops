# =============================================================================
# Notifications Domain - Customer Engagement
# =============================================================================
# Notification and messaging business domain.
# Handles multi-channel customer communications.
# =============================================================================

group "Notifications Domain" {
    notificationSystem = softwareSystem "Notification System" "Sends notifications across multiple channels" {
        tags "Notifications" "Core"
        description "Email, SMS, and push notification delivery"

        # =================================================================
        # Application Services
        # =================================================================
        notificationApi = container "Notification API" "RESTful API for sending notifications" "Node.js" {
            tags "Notifications" "Application"
            description "Notification triggers, template management, delivery status"
        }

        notificationWorker = container "Notification Worker" "Processes notification queue" "Node.js" {
            tags "Notifications" "Worker" "Application"
            description "Queue consumer, delivery orchestration, retry handling"
        }

        templateEngine = container "Template Engine" "Renders notification templates" "Node.js" {
            tags "Notifications" "Application"
            description "Jinja/Mustache template rendering for email/SMS"
        }

        # =================================================================
        # Data Layer
        # =================================================================
        notificationDatabase = container "Notification Database" "Stores notification history and templates" "MongoDB" {
            tags "Notifications" "Database" "Data"
            description "Template storage, delivery history, analytics data"
        }

        notificationQueue = container "Notification Queue" "Queues pending notifications" "RabbitMQ" {
            tags "Notifications" "Messaging" "Infrastructure"
            description "Priority queuing for notification delivery"
        }

        # =================================================================
        # Internal Relationships
        # =================================================================
        notificationApi -> notificationQueue "Enqueues notifications to"
        notificationApi -> notificationDatabase "Stores history in"
        notificationApi -> templateEngine "Renders templates via"
        notificationWorker -> notificationQueue "Consumes from"
        notificationWorker -> templateEngine "Renders with"
        notificationWorker -> notificationDatabase "Updates status in"
        templateEngine -> notificationDatabase "Loads templates from"
    }
}
