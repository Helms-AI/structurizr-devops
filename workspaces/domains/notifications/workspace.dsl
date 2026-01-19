workspace "Notifications Domain" "Notification and messaging business domain" {

    !identifiers hierarchical

    model {
        # =============================================================================
        # People
        # =============================================================================
        recipient = person "Recipient" "User receiving notifications" {
            tags "External"
        }

        operator = person "Operator" "Manages notification templates and rules" {
            tags "Internal"
        }

        # =============================================================================
        # Notification System
        # =============================================================================
        notificationSystem = softwareSystem "Notification System" "Sends notifications across multiple channels" {
            tags "Notifications Domain"

            notificationApi = container "Notification API" "RESTful API for sending notifications" "Node.js" {
                tags "Service"
            }

            notificationWorker = container "Notification Worker" "Processes notification queue" "Node.js" {
                tags "Worker"
            }

            templateEngine = container "Template Engine" "Renders notification templates" "Node.js" {
                tags "Service"
            }

            notificationDatabase = container "Notification Database" "Stores notification history and templates" "MongoDB" {
                tags "Database"
            }

            notificationQueue = container "Notification Queue" "Queues pending notifications" "RabbitMQ" {
                tags "Queue"
            }
        }

        # =============================================================================
        # External Dependencies
        # =============================================================================
        platform = softwareSystem "Platform" "Core platform services" {
            tags "External System"
        }

        emailProvider = softwareSystem "Email Provider" "SendGrid/SES for email delivery" {
            tags "External System"
        }

        smsProvider = softwareSystem "SMS Provider" "Twilio for SMS delivery" {
            tags "External System"
        }

        pushProvider = softwareSystem "Push Provider" "Firebase for push notifications" {
            tags "External System"
        }

        # =============================================================================
        # Relationships
        # =============================================================================
        recipient -> notificationSystem "Receives notifications from"
        operator -> notificationSystem "Configures templates in"

        platform -> notificationSystem "Triggers notifications via"
        platform -> notificationSystem.notificationApi "Triggers notifications via" "REST API"

        notificationSystem.notificationApi -> notificationSystem.notificationQueue "Enqueues notifications to"
        notificationSystem.notificationApi -> notificationSystem.notificationDatabase "Stores history in"
        notificationSystem.notificationApi -> notificationSystem.templateEngine "Renders templates via"

        notificationSystem.notificationWorker -> notificationSystem.notificationQueue "Consumes from"
        notificationSystem.notificationWorker -> notificationSystem.templateEngine "Renders with"
        notificationSystem.notificationWorker -> notificationSystem.notificationDatabase "Updates status in"

        notificationSystem.notificationWorker -> emailProvider "Sends emails via" "SMTP/API"
        notificationSystem.notificationWorker -> smsProvider "Sends SMS via" "API"
        notificationSystem.notificationWorker -> pushProvider "Sends push via" "API"

        notificationSystem.templateEngine -> notificationSystem.notificationDatabase "Loads templates from"
    }

    views {
        # =============================================================================
        # System Context
        # =============================================================================
        systemContext notificationSystem "SystemContext" {
            include *
            autoLayout
            description "Notification system context showing delivery channels"
        }

        # =============================================================================
        # Container View
        # =============================================================================
        container notificationSystem "Containers" {
            include *
            autoLayout
            description "Notification system containers and flow"
        }

        # =============================================================================
        # Dynamic View - Send Notification Flow
        # =============================================================================
        dynamic notificationSystem "SendNotificationFlow" "Shows the flow of sending a notification" {
            platform -> notificationSystem.notificationApi "1. Trigger notification"
            notificationSystem.notificationApi -> notificationSystem.templateEngine "2. Render template"
            notificationSystem.templateEngine -> notificationSystem.notificationDatabase "3. Load template"
            notificationSystem.notificationApi -> notificationSystem.notificationQueue "4. Enqueue notification"
            notificationSystem.notificationWorker -> notificationSystem.notificationQueue "5. Consume notification"
            notificationSystem.notificationWorker -> emailProvider "6. Deliver notification"
            notificationSystem.notificationWorker -> notificationSystem.notificationDatabase "7. Update status"
            autoLayout
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
            element "Database" {
                shape cylinder
            }
            element "Queue" {
                shape pipe
                background #f9a825
                color #000000
            }
            element "Worker" {
                shape hexagon
            }
            element "Service" {
                background #438dd5
            }
            element "Notifications Domain" {
                background #7b1fa2
            }
        }

        theme default
    }

}
