#!/usr/bin/env bash
#
# Initialize a domain workspace in Structurizr On-Premises via Admin API
#
# Usage: ./init-workspace.sh <domain-name>
# Example: ./init-workspace.sh platform
#
# Prerequisites:
#   - Structurizr On-Premises running on localhost:20000
#   - Admin API key configured in structurizr.properties
#   - STRUCTURIZR_ADMIN_API_KEY environment variable set
#
# This script will:
#   1. Create a new workspace via POST /api/workspace
#   2. Output the workspace credentials (ID, key, secret)
#   3. Optionally append credentials to .env file

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOMAINS_DIR="$PROJECT_ROOT/workspaces/domains"
STRUCTURIZR_URL="${STRUCTURIZR_URL:-http://localhost:20000}"
ADMIN_API_KEY="${STRUCTURIZR_ADMIN_API_KEY:-}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/containers/.env}"

# =============================================================================
# Functions
# =============================================================================
usage() {
    echo "Usage: $0 <domain-name>"
    echo ""
    echo "Arguments:"
    echo "  domain-name    Name of the domain (e.g., platform, orders, notifications)"
    echo ""
    echo "Environment variables:"
    echo "  STRUCTURIZR_URL           On-Premises URL (default: http://localhost:20000)"
    echo "  STRUCTURIZR_ADMIN_API_KEY Admin API key (required)"
    echo "  ENV_FILE                  Path to .env file (default: ../containers/.env)"
    echo ""
    echo "Available domains:"
    list_domains | sed 's/^/  - /'
    echo ""
    echo "Examples:"
    echo "  STRUCTURIZR_ADMIN_API_KEY=my-key ./init-workspace.sh platform"
    echo "  STRUCTURIZR_ADMIN_API_KEY=my-key ./init-workspace.sh orders"
    exit 1
}

list_domains() {
    find "$DOMAINS_DIR" -name "workspace.dsl" -type f 2>/dev/null | \
        xargs -I {} dirname {} | \
        xargs -I {} basename {} | \
        sort
}

check_prerequisites() {
    if [ -z "$ADMIN_API_KEY" ]; then
        echo "Error: STRUCTURIZR_ADMIN_API_KEY environment variable is not set"
        echo ""
        echo "Set it with: export STRUCTURIZR_ADMIN_API_KEY=your-admin-key"
        exit 1
    fi

    if ! command -v curl &> /dev/null; then
        echo "Error: curl is required but not installed"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        echo "Warning: jq is not installed, output will be raw JSON"
    fi
}

create_workspace() {
    local domain="$1"

    # Verify domain exists
    local domain_path="$DOMAINS_DIR/$domain/workspace.dsl"
    if [ ! -f "$domain_path" ]; then
        echo "Error: Domain workspace file not found: $domain_path"
        echo ""
        echo "Available domains:"
        list_domains | sed 's/^/  - /'
        exit 1
    fi

    echo "Creating workspace for domain: $domain"
    echo "URL: $STRUCTURIZR_URL/api/workspace"
    echo ""

    # Create workspace via Admin API
    local response
    response=$(curl -s -X POST \
        -H "X-Authorization: $ADMIN_API_KEY" \
        -H "Content-Type: application/json" \
        "$STRUCTURIZR_URL/api/workspace" 2>&1)

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "X-Authorization: $ADMIN_API_KEY" \
        -H "Content-Type: application/json" \
        "$STRUCTURIZR_URL/api/workspace" 2>&1)

    if [ "$http_code" != "200" ] && [ "$http_code" != "201" ]; then
        echo "Error: Failed to create workspace (HTTP $http_code)"
        echo "Response: $response"
        exit 1
    fi

    echo "Workspace created successfully!"
    echo ""
    echo "========================================"
    echo "WORKSPACE CREDENTIALS"
    echo "========================================"

    if command -v jq &> /dev/null; then
        local workspace_id key secret

        workspace_id=$(echo "$response" | jq -r '.id // .workspaceId // empty')
        key=$(echo "$response" | jq -r '.apiKey // .key // empty')
        secret=$(echo "$response" | jq -r '.apiSecret // .secret // empty')

        echo "Domain:       $domain"
        echo "Workspace ID: $workspace_id"
        echo "API Key:      $key"
        echo "API Secret:   $secret"
        echo ""

        # Generate environment variable names (domain name to uppercase)
        local name_upper
        name_upper=$(echo "$domain" | tr '[:lower:]-' '[:upper:]_')

        echo "========================================"
        echo "ENVIRONMENT VARIABLES"
        echo "========================================"
        echo "STRUCTURIZR_${name_upper}_WORKSPACE_ID=$workspace_id"
        echo "STRUCTURIZR_${name_upper}_WORKSPACE_KEY=$key"
        echo "STRUCTURIZR_${name_upper}_WORKSPACE_SECRET=$secret"
        echo ""

        # Ask to append to .env file
        if [ -f "$ENV_FILE" ]; then
            read -p "Append to $ENV_FILE? [y/N] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                {
                    echo ""
                    echo "# $domain domain (created $(date +%Y-%m-%d))"
                    echo "STRUCTURIZR_${name_upper}_WORKSPACE_ID=$workspace_id"
                    echo "STRUCTURIZR_${name_upper}_WORKSPACE_KEY=$key"
                    echo "STRUCTURIZR_${name_upper}_WORKSPACE_SECRET=$secret"
                } >> "$ENV_FILE"
                echo "Credentials appended to $ENV_FILE"
            fi
        fi
    else
        echo "Raw response:"
        echo "$response"
    fi

    echo ""
    echo "========================================"
    echo "GITHUB SECRETS TO CONFIGURE"
    echo "========================================"
    local name_upper
    name_upper=$(echo "$domain" | tr '[:lower:]-' '[:upper:]_')
    echo "Add these secrets to your GitHub repository:"
    echo "  - STRUCTURIZR_${name_upper}_WORKSPACE_ID"
    echo "  - STRUCTURIZR_${name_upper}_WORKSPACE_KEY"
    echo "  - STRUCTURIZR_${name_upper}_WORKSPACE_SECRET"
}

# =============================================================================
# Main
# =============================================================================
main() {
    if [ $# -lt 1 ]; then
        usage
    fi

    local domain="$1"

    check_prerequisites
    create_workspace "$domain"
}

main "$@"
