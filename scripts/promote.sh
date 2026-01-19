#!/usr/bin/env bash
#
# Manually promote a domain workspace to Structurizr On-Premises
#
# Usage: ./promote.sh <domain-name> [workspace-id]
# Example: ./promote.sh platform 1
#
# Prerequisites:
#   - nerdctl installed and running
#   - structurizr/cli:latest image available
#   - Domain credentials configured in environment or .env file
#
# Environment variables:
#   STRUCTURIZR_URL              - On-Premises API URL
#   STRUCTURIZR_WORKSPACE_ID     - Workspace ID (or pass as argument)
#   STRUCTURIZR_WORKSPACE_KEY    - Workspace API key
#   STRUCTURIZR_WORKSPACE_SECRET - Workspace API secret

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOMAINS_DIR="$PROJECT_ROOT/workspaces/domains"
ENV_FILE="$PROJECT_ROOT/containers/.env"

# Java SSL/TLS options to handle certificate issues in containerized environments
JAVA_SSL_OPTS="-Dcom.sun.net.ssl.checkRevocation=false -Djsse.enableSNIExtension=true -Dhttps.protocols=TLSv1.2,TLSv1.3 -Djdk.tls.client.protocols=TLSv1.2,TLSv1.3"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =============================================================================
# Functions
# =============================================================================
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

usage() {
    echo "Usage: $0 [--validate-ssl] <domain-name> [workspace-id]"
    echo ""
    echo "Arguments:"
    echo "  --validate-ssl     Run DSL validation before promotion (skipped by default)"
    echo "  domain-name    Name of the domain (e.g., platform, orders, notifications)"
    echo "  workspace-id   Workspace ID (optional, can use env var)"
    echo ""
    echo "Environment variables:"
    echo "  STRUCTURIZR_URL              On-Premises API URL"
    echo "  STRUCTURIZR_WORKSPACE_ID     Workspace ID"
    echo "  STRUCTURIZR_WORKSPACE_KEY    Workspace API key"
    echo "  STRUCTURIZR_WORKSPACE_SECRET Workspace API secret"
    echo ""
    echo "Available domains:"
    list_domains | sed 's/^/  - /'
    echo ""
    echo "Examples:"
    echo "  ./promote.sh platform"
    echo "  ./promote.sh --validate-ssl platform"
    echo "  ./promote.sh orders 2"
    exit 1
}

load_env() {
    if [ -f "$ENV_FILE" ]; then
        log_info "Loading environment from $ENV_FILE"
        # shellcheck disable=SC1090
        set -a
        source "$ENV_FILE"
        set +a
    fi
}

check_prerequisites() {
    if ! command -v nerdctl &> /dev/null; then
        log_error "nerdctl is required but not installed"
        exit 1
    fi

    if [ -z "${STRUCTURIZR_URL:-}" ]; then
        log_error "STRUCTURIZR_URL is not set"
        exit 1
    fi

    if [ -z "${STRUCTURIZR_WORKSPACE_KEY:-}" ]; then
        log_error "STRUCTURIZR_WORKSPACE_KEY is not set"
        exit 1
    fi

    if [ -z "${STRUCTURIZR_WORKSPACE_SECRET:-}" ]; then
        log_error "STRUCTURIZR_WORKSPACE_SECRET is not set"
        exit 1
    fi
}

list_domains() {
    find "$DOMAINS_DIR" -name "workspace.dsl" -type f 2>/dev/null | \
        xargs -I {} dirname {} | \
        xargs -I {} basename {} | \
        sort
}

validate_domain() {
    local domain="$1"
    local workspace_path="workspaces/domains/$domain/workspace.dsl"

    log_info "Validating domain before promotion..."

    if ! nerdctl run --rm \
        -v "$PROJECT_ROOT:/workspaces:ro" \
        -e JAVA_TOOL_OPTIONS="$JAVA_SSL_OPTS" \
        structurizr/cli:latest \
        validate \
        -workspace "/workspaces/$workspace_path"; then
        log_error "Domain validation failed"
        exit 1
    fi

    log_info "Domain validation passed"
}

promote_domain() {
    local domain="$1"
    local workspace_id="$2"
    local workspace_path="workspaces/domains/$domain/workspace.dsl"

    # Translate localhost to container-accessible hostname
    local container_url="$STRUCTURIZR_URL"
    if [[ "$container_url" == *"localhost"* ]]; then
        container_url="${container_url//localhost/host.lima.internal}"
        log_info "Translated localhost to host.lima.internal for container access"
    fi

    log_info "Promoting domain to $container_url"
    log_info "Domain: $domain"
    log_info "Workspace ID: $workspace_id"
    log_info "Workspace file: $workspace_path"

    echo ""

    if nerdctl run --rm \
        -v "$PROJECT_ROOT:/workspaces:ro" \
        -e JAVA_TOOL_OPTIONS="$JAVA_SSL_OPTS" \
        structurizr/cli:latest \
        push \
        -url "$container_url" \
        -id "$workspace_id" \
        -key "$STRUCTURIZR_WORKSPACE_KEY" \
        -secret "$STRUCTURIZR_WORKSPACE_SECRET" \
        -workspace "/workspaces/$workspace_path"; then
        echo ""
        log_info "Domain promoted successfully!"
        log_info "View at: ${STRUCTURIZR_URL%/api}/workspace/$workspace_id"
    else
        log_error "Promotion failed"
        exit 1
    fi
}

# =============================================================================
# Main
# =============================================================================
main() {
    local run_validation=false

    # Parse flags
    while [[ $# -gt 0 && "$1" == --* ]]; do
        case "$1" in
            --validate-ssl)
                run_validation=true
                shift
                ;;
            *)
                log_error "Unknown flag: $1"
                usage
                ;;
        esac
    done

    if [ $# -lt 1 ]; then
        usage
    fi

    local domain="$1"
    local workspace_id="${2:-${STRUCTURIZR_WORKSPACE_ID:-}}"

    # Load environment file
    load_env

    # Override workspace ID if provided as argument
    if [ -n "${2:-}" ]; then
        workspace_id="$2"
    fi

    if [ -z "$workspace_id" ]; then
        log_error "Workspace ID not provided and STRUCTURIZR_WORKSPACE_ID not set"
        usage
    fi

    # Check prerequisites
    check_prerequisites

    # Validate domain path
    local domain_path="$DOMAINS_DIR/$domain/workspace.dsl"
    if [ ! -f "$domain_path" ]; then
        log_error "Domain workspace file not found: $domain_path"
        echo ""
        echo "Available domains:"
        list_domains | sed 's/^/  - /'
        exit 1
    fi

    echo ""
    echo "========================================"
    echo "Structurizr Domain Promotion"
    echo "========================================"
    echo ""

    # Validate before promoting (only if --validate-ssl flag is set)
    if [ "$run_validation" = true ]; then
        validate_domain "$domain"
    else
        log_info "Skipping validation (use --validate-ssl to enable)"
    fi

    echo ""

    # Promote
    promote_domain "$domain" "$workspace_id"
}

main "$@"
