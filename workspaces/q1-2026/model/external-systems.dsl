# External Systems

emailSystem = softwareSystem "Email System" "Sends transactional emails (SendGrid)" {
    tags "External"
}

paymentGateway = softwareSystem "Payment Gateway" "Handles payment processing (Stripe)" {
    tags "External"
}

# Relationships to external systems
customer -> ecommerce "Browses and purchases products"
admin -> ecommerce "Manages products and orders"
ecommerce -> emailSystem "Sends emails via" "SMTP/API"
ecommerce -> paymentGateway "Processes payments via" "HTTPS"

# Component-level external relationships
ecommerce.orderService.paymentProcessor -> paymentGateway "Calls" "HTTPS"
ecommerce.orderService.notificationService -> emailSystem "Sends emails via" "SMTP"
