#!/usr/bin/env bash
#
# Generate a bcrypt-encoded API key for Structurizr On-Premises
#
# Usage: ./generate-api-key.sh [plaintext-key]
# Example: ./generate-api-key.sh my-secret-admin-key
#
# If no key is provided, a secure random key will be generated.
#
# The script outputs:
#   1. The plaintext key (save this for API calls)
#   2. The bcrypt hash (put this in structurizr.properties)

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =============================================================================
# Functions
# =============================================================================
generate_random_key() {
    # Generate a secure random 32-character hex string
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    elif [ -f /dev/urandom ]; then
        head -c 32 /dev/urandom | xxd -p | tr -d '\n'
    else
        echo "Error: Cannot generate random key (no openssl or /dev/urandom)"
        exit 1
    fi
}

generate_bcrypt_hash() {
    local key="$1"

    # Try different methods to generate bcrypt hash
    if command -v htpasswd &> /dev/null; then
        # Apache htpasswd method
        # -n: don't update file, print to stdout
        # -b: use password from command line
        # -B: force bcrypt
        # -C 10: cost factor of 10
        htpasswd -nbBC 10 "" "$key" | tr -d ':\n' | sed 's/$2y/$2a/'
    elif command -v python3 &> /dev/null; then
        # Python bcrypt method
        python3 -c "
import bcrypt
import sys
password = sys.argv[1].encode('utf-8')
salt = bcrypt.gensalt(rounds=10)
hashed = bcrypt.hashpw(password, salt)
print(hashed.decode('utf-8'))
" "$key" 2>/dev/null || {
            echo ""
            echo -e "${YELLOW}Note: Python bcrypt module not installed${NC}"
            echo "Install with: pip3 install bcrypt"
            return 1
        }
    elif command -v nerdctl &> /dev/null; then
        # Use a container with htpasswd
        nerdctl run --rm httpd:alpine htpasswd -nbBC 10 "" "$key" 2>/dev/null | tr -d ':\n' | sed 's/$2y/$2a/'
    else
        echo ""
        echo "Error: No bcrypt tool available"
        echo ""
        echo "Install one of:"
        echo "  - Apache htpasswd: brew install httpd (macOS) or apt install apache2-utils (Linux)"
        echo "  - Python bcrypt: pip3 install bcrypt"
        echo "  - nerdctl/docker: to use containerized htpasswd"
        return 1
    fi
}

# =============================================================================
# Main
# =============================================================================
main() {
    local plaintext_key="${1:-}"

    echo ""
    echo "========================================"
    echo "Structurizr Admin API Key Generator"
    echo "========================================"
    echo ""

    # Generate or use provided key
    if [ -z "$plaintext_key" ]; then
        echo "Generating secure random key..."
        plaintext_key=$(generate_random_key)
    else
        echo "Using provided key..."
    fi

    echo ""

    # Generate bcrypt hash
    echo "Generating bcrypt hash..."
    local bcrypt_hash
    if bcrypt_hash=$(generate_bcrypt_hash "$plaintext_key"); then
        echo ""
        echo -e "${GREEN}========================================"
        echo "KEY GENERATED SUCCESSFULLY"
        echo -e "========================================${NC}"
        echo ""
        echo -e "${GREEN}Plaintext Key (keep secret!):${NC}"
        echo "$plaintext_key"
        echo ""
        echo -e "${GREEN}Bcrypt Hash (for structurizr.properties):${NC}"
        echo "$bcrypt_hash"
        echo ""
        echo "========================================"
        echo "CONFIGURATION"
        echo "========================================"
        echo ""
        echo "1. Add to structurizr.properties:"
        echo "   structurizr.apiKey=$bcrypt_hash"
        echo ""
        echo "2. Set environment variable:"
        echo "   export STRUCTURIZR_ADMIN_API_KEY=$plaintext_key"
        echo ""
        echo "3. Use in API calls:"
        echo "   curl -H 'X-Authorization: $plaintext_key' http://localhost:20000/api/workspace"
        echo ""
    else
        exit 1
    fi
}

main "$@"
