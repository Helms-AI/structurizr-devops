#!/usr/bin/env bash
#
# Validate all Structurizr workspace DSL files locally
#
# Usage: ./validate-all.sh [domain]
# Examples:
#   ./validate-all.sh              # Validate all domains
#   ./validate-all.sh platform     # Validate only platform domain
#   ./validate-all.sh orders       # Validate only orders domain
#
# Prerequisites:
#   - nerdctl installed and running
#   - structurizr/cli:latest image available

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOMAINS_DIR="$PROJECT_ROOT/workspaces/domains"

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

check_prerequisites() {
    if ! command -v nerdctl &> /dev/null; then
        log_error "nerdctl is required but not installed"
        exit 1
    fi
}

validate_domain() {
    local domain="$1"
    local workspace_path="$DOMAINS_DIR/$domain/workspace.dsl"

    if [ ! -f "$workspace_path" ]; then
        log_error "Workspace file not found: $workspace_path"
        return 1
    fi

    log_info "Validating domain: $domain"

    if nerdctl run --rm \
        -v "$PROJECT_ROOT:/workspaces:ro" \
        -e JAVA_TOOL_OPTIONS="$JAVA_SSL_OPTS" \
        structurizr/cli:latest \
        validate \
        -workspace "/workspaces/workspaces/domains/$domain/workspace.dsl"; then
        log_info "$domain: VALID"
        return 0
    else
        log_error "$domain: INVALID"
        return 1
    fi
}

list_domains() {
    # Find all domains with workspace.dsl files
    find "$DOMAINS_DIR" -name "workspace.dsl" -type f 2>/dev/null | \
        xargs -I {} dirname {} | \
        xargs -I {} basename {} | \
        sort
}

# =============================================================================
# Main
# =============================================================================
main() {
    local specific_domain="${1:-}"
    local failed=0
    local total=0

    check_prerequisites

    echo ""
    echo "========================================"
    echo "Structurizr Domain Validation"
    echo "========================================"
    echo ""

    if [ -n "$specific_domain" ]; then
        # Validate specific domain
        total=1
        if ! validate_domain "$specific_domain"; then
            failed=1
        fi
    else
        # Validate all domains
        while IFS= read -r domain; do
            if [ -n "$domain" ]; then
                ((total++))
                echo ""
                if ! validate_domain "$domain"; then
                    ((failed++))
                fi
            fi
        done < <(list_domains)
    fi

    echo ""
    echo "========================================"
    echo "Validation Summary"
    echo "========================================"
    echo "Total:  $total"
    echo "Passed: $((total - failed))"
    echo "Failed: $failed"
    echo ""

    if [ "$failed" -gt 0 ]; then
        log_error "Some domains failed validation"
        exit 1
    else
        log_info "All domains validated successfully!"
        exit 0
    fi
}

main "$@"
