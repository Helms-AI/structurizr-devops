# =============================================================================
# Notifications Domain Views
# =============================================================================
# Views focused on the Notifications domain architecture.
# =============================================================================

# =============================================================================
# Notifications System Context
# =============================================================================
systemContext notificationSystem "Notifications-Context" {
    include *
    autoLayout
    title "Notification System Context"
    description "Notification system context showing delivery channels"
}

# =============================================================================
# Notifications Containers
# =============================================================================
container notificationSystem "Notifications-Containers" {
    include *
    autoLayout
    title "Notification System Containers"
    description "Notification system container architecture"
}

# =============================================================================
# Dynamic View - Send Notification Flow
# =============================================================================
dynamic notificationSystem "Notifications-SendFlow" "Shows the flow of sending a notification" {
    platform -> notificationSystem.notificationApi "1. Trigger notification"
    notificationSystem.notificationApi -> notificationSystem.templateEngine "2. Render template"
    notificationSystem.templateEngine -> notificationSystem.notificationDatabase "3. Load template"
    notificationSystem.notificationApi -> notificationSystem.notificationQueue "4. Enqueue notification"
    notificationSystem.notificationWorker -> notificationSystem.notificationQueue "5. Consume notification"
    notificationSystem.notificationWorker -> emailProvider "6. Deliver notification"
    notificationSystem.notificationWorker -> notificationSystem.notificationDatabase "7. Update status"
    autoLayout
}
