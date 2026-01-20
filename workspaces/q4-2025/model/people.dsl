# =============================================================================
# People - All Actors and Stakeholders
# =============================================================================
# Unified people definitions across all domains and perspectives.
# Tags are used to filter visibility for different stakeholder perspectives.
# =============================================================================

# =============================================================================
# Core Platform Actors
# =============================================================================
developer = person "Developer" "A software developer working on the platform" {
    tags "Internal" "Core" "Technical"
}

architect = person "Architect" "Platform architect responsible for system design" {
    tags "Internal" "Core" "Technical"
}

endUser = person "End User" "External user consuming platform services" {
    tags "External" "Core"
}

# =============================================================================
# Orders Domain Actors
# =============================================================================
customer = person "Customer" "A customer placing orders" {
    tags "External" "Core" "Orders"
}

supportAgent = person "Support Agent" "Handles order issues and inquiries" {
    tags "Internal" "Orders"
}

# =============================================================================
# Notifications Domain Actors
# =============================================================================
recipient = person "Recipient" "User receiving notifications" {
    tags "External" "Notifications"
}

operator = person "Operator" "Manages notification templates and rules" {
    tags "Internal" "Notifications"
}

# =============================================================================
# Executive Stakeholders
# =============================================================================
cto = person "CTO" "Chief Technology Officer" {
    tags "Executive" "Core"
}

ceo = person "CEO" "Chief Executive Officer" {
    tags "Executive" "Core"
}

businessOwner = person "Business Owner" "Domain business owner" {
    tags "Internal" "Core"
}

# =============================================================================
# Security Stakeholders
# =============================================================================
securityArchitect = person "Security Architect" "Designs and reviews security architecture" {
    tags "Security" "Internal"
}

securityEngineer = person "Security Engineer" "Implements and monitors security controls" {
    tags "Security" "Internal"
}

complianceOfficer = person "Compliance Officer" "Ensures regulatory compliance" {
    tags "Compliance" "Internal"
}

# =============================================================================
# Technical Operations
# =============================================================================
platformDev = person "Platform Developer" "Develops core platform services" {
    tags "Developer" "Technical" "Platform"
}

domainDev = person "Domain Developer" "Develops business domain services" {
    tags "Developer" "Technical"
}

sre = person "SRE" "Site Reliability Engineer" {
    tags "Operations" "Technical" "Infrastructure"
}
