#!/usr/bin/env bash
#
# Create a new domain workspace with scaffolding
#
# Usage: ./domain-create.sh <domain-name> [owner] [description]
# Example: ./domain-create.sh inventory "Warehouse Team" "Inventory management domain"
#
# This script will:
#   1. Create the domain directory structure
#   2. Generate a starter workspace.dsl file
#   3. Add entry to domains.yaml registry
#   4. Add service definition to docker-compose.yml
#   5. Display next steps for configuration

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOMAINS_DIR="$PROJECT_ROOT/workspaces/domains"
SHARED_DIR="$PROJECT_ROOT/workspaces/shared"
DOMAINS_YAML="$SHARED_DIR/domains.yaml"
COMPOSE_FILE="$PROJECT_ROOT/containers/docker-compose.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

usage() {
    echo "Usage: $0 <domain-name> [owner] [description]"
    echo ""
    echo "Arguments:"
    echo "  domain-name    Name of the domain (lowercase, alphanumeric, hyphens allowed)"
    echo "  owner          Team or person responsible (optional, default: 'TBD')"
    echo "  description    Short description of the domain (optional)"
    echo ""
    echo "Examples:"
    echo "  $0 inventory"
    echo "  $0 inventory 'Warehouse Team'"
    echo "  $0 inventory 'Warehouse Team' 'Inventory management and tracking'"
    echo ""
    echo "Existing domains:"
    list_domains | sed 's/^/  - /'
    exit 1
}

list_domains() {
    find "$DOMAINS_DIR" -name "workspace.dsl" -type f 2>/dev/null | \
        xargs -I {} dirname {} | \
        xargs -I {} basename {} | \
        sort
}

get_next_port() {
    # Find highest port number used in domains and add 1
    local max_port
    max_port=$(grep -oP 'port:\s*\K[0-9]+' "$DOMAINS_YAML" 2>/dev/null | sort -n | tail -1)

    if [ -z "$max_port" ]; then
        echo "20100"
    else
        echo "$((max_port + 1))"
    fi
}

validate_domain_name() {
    local name="$1"

    # Check format
    if ! [[ "$name" =~ ^[a-z][a-z0-9-]*$ ]]; then
        log_error "Domain name must start with lowercase letter and contain only lowercase letters, numbers, and hyphens"
        exit 1
    fi

    # Check length
    if [ ${#name} -gt 30 ]; then
        log_error "Domain name must be 30 characters or less"
        exit 1
    fi

    # Check if exists
    if [ -d "$DOMAINS_DIR/$name" ]; then
        log_error "Domain '$name' already exists at $DOMAINS_DIR/$name"
        exit 1
    fi
}

create_workspace_dsl() {
    local domain="$1"
    local description="$2"
    local domain_title
    domain_title=$(echo "$domain" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')

    cat > "$DOMAINS_DIR/$domain/workspace.dsl" << EOF
workspace "$domain_title Domain" "$description" {

    !identifiers hierarchical

    model {
        # Include shared base model
        !include ../../shared/base-model.dsl

        # =============================================================================
        # Domain-Specific Elements
        # =============================================================================

        # TODO: Define your domain's software system
        ${domain}System = softwareSystem "$domain_title System" "$description" {
            tags "Domain" "${domain_title}"

            # TODO: Define containers
            # api = container "${domain_title} API" "REST API for ${domain_title}" {
            #     technology "TypeScript, NestJS"
            #     tags "Microservice"
            # }
            #
            # database = container "${domain_title} Database" "Data store" {
            #     technology "PostgreSQL"
            #     tags "Database"
            # }
        }

        # =============================================================================
        # Relationships
        # =============================================================================
        # TODO: Define relationships with shared systems and other domains
        # Example:
        # externalUser -> ${domain}System.api "Uses"
        # ${domain}System.api -> ${domain}System.database "Reads/writes"
    }

    views {
        # =============================================================================
        # System Context
        # =============================================================================
        systemContext ${domain}System "${domain_title}Context" {
            include *
            autoLayout
            description "${domain_title} system context showing external dependencies"
        }

        # =============================================================================
        # Container View
        # =============================================================================
        container ${domain}System "${domain_title}Containers" {
            include *
            autoLayout
            description "${domain_title} containers and their relationships"
        }

        # =============================================================================
        # Styles
        # =============================================================================
        !include ../../shared/styles.dsl
    }

}
EOF
}

add_to_domains_yaml() {
    local domain="$1"
    local owner="$2"
    local description="$3"
    local port="$4"

    local domain_title
    domain_title=$(echo "$domain" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')

    # Insert before perspectives section
    local insert_marker="# =============================================================================
# Perspectives"

    local new_entry="  # ---------------------------------------------------------------------------
  # $domain_title Domain
  # ---------------------------------------------------------------------------
  $domain:
    name: $domain_title Domain
    description: $description
    owner: $owner
    port: $port
    workspace_file: workspace.dsl
    color: \"#607d8b\"
    tags:
      - new
    dependencies:
      - platform

"

    # Check if we can find the marker
    if grep -q "# Perspectives" "$DOMAINS_YAML" 2>/dev/null; then
        # Insert before perspectives section
        sed -i.bak "/$insert_marker/i\\
$new_entry" "$DOMAINS_YAML"
        rm -f "${DOMAINS_YAML}.bak"
        log_info "Added domain to $DOMAINS_YAML"
    else
        log_warn "Could not find insertion point in domains.yaml"
        log_warn "Please add the domain entry manually"
        echo ""
        echo "$new_entry"
    fi
}

print_compose_snippet() {
    local domain="$1"
    local port="$2"

    echo ""
    echo "Add this to containers/docker-compose.yml under the Domain Workspaces section:"
    echo ""
    echo "  # ${domain^} Domain - http://localhost:$port"
    echo "  structurizr-domain-$domain:"
    echo "    <<: *structurizr-lite-defaults"
    echo "    container_name: structurizr-domain-$domain"
    echo "    ports:"
    echo "      - \"$port:8080\""
    echo "    volumes:"
    echo "      - ../workspaces/domains/$domain:/usr/local/structurizr"
    echo ""
}

# =============================================================================
# Main
# =============================================================================
main() {
    if [ $# -lt 1 ]; then
        usage
    fi

    local domain="$1"
    local owner="${2:-TBD}"
    local description="${3:-$domain business domain}"

    echo ""
    echo "========================================"
    echo "Creating New Domain: $domain"
    echo "========================================"
    echo ""

    # Validate domain name
    log_step "Validating domain name..."
    validate_domain_name "$domain"
    log_info "Domain name is valid"

    # Get next available port
    local port
    port=$(get_next_port)
    log_info "Assigned port: $port"

    # Create directory
    log_step "Creating domain directory..."
    mkdir -p "$DOMAINS_DIR/$domain"
    log_info "Created $DOMAINS_DIR/$domain"

    # Create workspace.dsl
    log_step "Creating workspace.dsl..."
    create_workspace_dsl "$domain" "$description"
    log_info "Created workspace.dsl with starter template"

    # Add to domains.yaml
    log_step "Updating domains.yaml..."
    add_to_domains_yaml "$domain" "$owner" "$description" "$port"

    echo ""
    echo "========================================"
    echo "Domain Created Successfully!"
    echo "========================================"
    echo ""
    echo "Domain:      $domain"
    echo "Owner:       $owner"
    echo "Description: $description"
    echo "Port:        $port"
    echo "Directory:   $DOMAINS_DIR/$domain"
    echo ""

    # Print docker-compose snippet
    print_compose_snippet "$domain" "$port"

    echo "========================================"
    echo "Next Steps"
    echo "========================================"
    echo ""
    echo "1. Edit the workspace.dsl file:"
    echo "   $DOMAINS_DIR/$domain/workspace.dsl"
    echo ""
    echo "2. Add the service to docker-compose.yml (snippet shown above)"
    echo ""
    echo "3. Initialize the workspace in Structurizr On-Premises:"
    echo "   export STRUCTURIZR_ADMIN_API_KEY=your-key"
    echo "   ./scripts/init-workspace.sh $domain"
    echo ""
    echo "4. Configure GitHub secrets:"
    local domain_upper
    domain_upper=$(echo "$domain" | tr '[:lower:]-' '[:upper:]_')
    echo "   - STRUCTURIZR_${domain_upper}_WORKSPACE_ID"
    echo "   - STRUCTURIZR_${domain_upper}_WORKSPACE_KEY"
    echo "   - STRUCTURIZR_${domain_upper}_WORKSPACE_SECRET"
    echo ""
    echo "5. Start the local environment:"
    echo "   cd containers && nerdctl compose up -d"
    echo ""
    echo "6. Access the workspace at:"
    echo "   http://localhost:$port"
    echo ""
}

main "$@"
