#!/usr/bin/env bash
#
# Wrapper script to execute the structurizr-devops CLI
#
# Usage: ./cli.sh <command> [options]
# Example: ./cli.sh validate platform
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$SCRIPT_DIR/cli"

# Check if CLI is built
if [ ! -d "$CLI_DIR/dist" ]; then
    echo "CLI not built. Running: cd cli && npm install && npm run build"
    cd "$CLI_DIR" && npm install && npm run build
fi

# Execute CLI with all arguments
node "$CLI_DIR/dist/index.js" "$@"
