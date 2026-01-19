#!/bin/bash
# =============================================================================
# Structurizr Lite - On-Demand Workspace Editor
# =============================================================================
# Starts a Structurizr Lite container for visual editing of a specific workspace.
#
# Usage:
#   ./scripts/lite.sh <workspace> [quarter] [type] [port]
#
# Arguments:
#   workspace   Name of the workspace (e.g., platform, orders, executive)
#   quarter     Quarter directory (default: current)
#   type        Workspace type: domain or perspective (default: auto-detect)
#   port        Port to expose (default: 20100)
#
# Examples:
#   ./scripts/lite.sh platform                    # Edit platform domain (current quarter)
#   ./scripts/lite.sh orders current              # Edit orders domain (explicit current)
#   ./scripts/lite.sh executive perspective       # Edit executive perspective
#   ./scripts/lite.sh platform q1-2025            # Edit archived quarter
#   ./scripts/lite.sh platform current domain 8080  # Custom port
#
# Notes:
#   - Stops any existing structurizr-lite container before starting
#   - Changes are saved directly to the workspace.dsl file
#   - Press Ctrl+C to stop the container
# =============================================================================

set -e

# Default values
WORKSPACE=${1:-platform}
QUARTER=${2:-current}
TYPE=${3:-}
PORT=${4:-20100}

# Project root (parent of scripts directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Detect container runtime
detect_runtime() {
    if command -v nerdctl &> /dev/null; then
        echo "nerdctl"
    elif command -v docker &> /dev/null; then
        echo "docker"
    else
        echo "Error: No container runtime found. Install nerdctl or docker." >&2
        exit 1
    fi
}

RUNTIME=$(detect_runtime)

# Auto-detect workspace type if not specified
if [ -z "$TYPE" ]; then
    if [ -d "$PROJECT_ROOT/workspaces/$QUARTER/domains/$WORKSPACE" ]; then
        TYPE="domain"
    elif [ -d "$PROJECT_ROOT/workspaces/$QUARTER/perspectives/$WORKSPACE" ]; then
        TYPE="perspective"
    # Try resolving current symlink
    elif [ -L "$PROJECT_ROOT/workspaces/current" ] && [ -d "$PROJECT_ROOT/workspaces/current/domains/$WORKSPACE" ]; then
        TYPE="domain"
    elif [ -L "$PROJECT_ROOT/workspaces/current" ] && [ -d "$PROJECT_ROOT/workspaces/current/perspectives/$WORKSPACE" ]; then
        TYPE="perspective"
    else
        echo "Error: Could not find workspace '$WORKSPACE' in quarter '$QUARTER'"
        echo ""
        echo "Available domains:"
        ls -1 "$PROJECT_ROOT/workspaces/$QUARTER/domains" 2>/dev/null || echo "  (none)"
        echo ""
        echo "Available perspectives:"
        ls -1 "$PROJECT_ROOT/workspaces/$QUARTER/perspectives" 2>/dev/null || echo "  (none)"
        exit 1
    fi
fi

# Construct workspace path
if [ "$TYPE" = "domain" ]; then
    WORKSPACE_PATH="$PROJECT_ROOT/workspaces/$QUARTER/domains/$WORKSPACE"
elif [ "$TYPE" = "perspective" ]; then
    WORKSPACE_PATH="$PROJECT_ROOT/workspaces/$QUARTER/perspectives/$WORKSPACE"
else
    echo "Error: Invalid workspace type '$TYPE'. Use 'domain' or 'perspective'."
    exit 1
fi

# Verify workspace exists
if [ ! -f "$WORKSPACE_PATH/workspace.dsl" ]; then
    echo "Error: Workspace file not found: $WORKSPACE_PATH/workspace.dsl"
    exit 1
fi

# Stop existing container if running
echo "Stopping any existing structurizr-lite container..."
$RUNTIME stop structurizr-lite 2>/dev/null || true
$RUNTIME rm structurizr-lite 2>/dev/null || true

# Display configuration
echo ""
echo "=============================================="
echo "Structurizr Lite - Visual Workspace Editor"
echo "=============================================="
echo ""
echo "Workspace:  $WORKSPACE ($TYPE)"
echo "Quarter:    $QUARTER"
echo "Path:       $WORKSPACE_PATH"
echo "Port:       $PORT"
echo "URL:        http://localhost:$PORT"
echo ""
echo "Starting Structurizr Lite..."
echo "Press Ctrl+C to stop"
echo ""

# Run container (foreground so Ctrl+C works)
$RUNTIME run --rm \
    --name structurizr-lite \
    -p "$PORT:8080" \
    -v "$WORKSPACE_PATH:/usr/local/structurizr:rw" \
    -e STRUCTURIZR_WORKSPACE_FILENAME=workspace.dsl \
    structurizr/lite:latest
