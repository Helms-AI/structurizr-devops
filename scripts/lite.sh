#!/bin/bash
# =============================================================================
# Structurizr Lite - On-Demand Workspace Editor
# =============================================================================
# Starts a Structurizr Lite container for visual editing of a quarter workspace.
#
# Usage (New Unified Structure):
#   ./scripts/lite.sh [quarter] [port]
#
# Usage (Legacy Structure):
#   ./scripts/lite.sh <workspace> [quarter] [type] [port]
#
# Arguments:
#   quarter     Quarter directory (default: current)
#   port        Port to expose (default: 20100)
#
# Examples (Unified):
#   ./scripts/lite.sh                         # Edit current quarter
#   ./scripts/lite.sh q2-2025                 # Edit specific quarter
#   ./scripts/lite.sh q2-2025 8080            # Custom port
#
# Examples (Legacy - domain/perspective structure):
#   ./scripts/lite.sh platform                # Edit platform domain (current quarter)
#   ./scripts/lite.sh orders current          # Edit orders domain (explicit current)
#   ./scripts/lite.sh executive perspective   # Edit executive perspective
#   ./scripts/lite.sh platform q1-2025        # Edit archived quarter
#
# Notes:
#   - Stops any existing structurizr-lite container before starting
#   - Changes are saved directly to the workspace.dsl file
#   - Press Ctrl+C to stop the container
# =============================================================================

set -e

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

# Check if a quarter has unified structure (workspace.dsl at root)
is_unified_quarter() {
    local quarter=$1
    [ -f "$PROJECT_ROOT/workspaces/$quarter/workspace.dsl" ]
}

# Check if a quarter has legacy structure (domains/perspectives directories)
is_legacy_quarter() {
    local quarter=$1
    [ -d "$PROJECT_ROOT/workspaces/$quarter/domains" ] || [ -d "$PROJECT_ROOT/workspaces/$quarter/perspectives" ]
}

# Determine mode based on arguments and structure
# If first arg looks like a quarter (q*-*) or is empty, use unified mode
# Otherwise try legacy mode
determine_mode() {
    local arg1="${1:-}"

    # No arguments - try unified current
    if [ -z "$arg1" ]; then
        echo "unified"
        return
    fi

    # Looks like a quarter pattern (q1-2025, q2-2025, etc.)
    if [[ "$arg1" =~ ^q[1-4]-[0-9]{4}$ ]]; then
        echo "unified"
        return
    fi

    # "current" keyword
    if [ "$arg1" = "current" ]; then
        echo "unified"
        return
    fi

    # Check if arg1 is a workspace in legacy structure
    local target_quarter="${2:-current}"
    if [ -d "$PROJECT_ROOT/workspaces/$target_quarter/domains/$arg1" ] || \
       [ -d "$PROJECT_ROOT/workspaces/$target_quarter/perspectives/$arg1" ]; then
        echo "legacy"
        return
    fi

    # Default to unified (arg1 might be quarter)
    echo "unified"
}

MODE=$(determine_mode "$1" "$2")

if [ "$MODE" = "unified" ]; then
    # ==========================================================================
    # Unified Mode - Edit entire quarter
    # ==========================================================================

    # First arg is quarter (or empty for current)
    QUARTER="${1:-current}"
    PORT="${2:-20100}"

    # Handle "current" by reading from registry.yaml
    if [ "$QUARTER" = "current" ]; then
        QUARTER_PATH="$PROJECT_ROOT/workspaces/current"
        if [ -L "$QUARTER_PATH" ]; then
            QUARTER=$(basename "$(readlink "$QUARTER_PATH")")
            WORKSPACE_PATH=$(readlink -f "$QUARTER_PATH")
        else
            WORKSPACE_PATH="$QUARTER_PATH"
        fi
    else
        WORKSPACE_PATH="$PROJECT_ROOT/workspaces/$QUARTER"
    fi

    # Verify it's a unified structure
    if [ ! -f "$WORKSPACE_PATH/workspace.dsl" ]; then
        echo "Error: No unified workspace.dsl found in $WORKSPACE_PATH"
        echo ""
        echo "This quarter may use the legacy structure. Try:"
        echo "  ./scripts/lite.sh <workspace-name> $QUARTER"
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
    echo "Mode:       Unified (single workspace per quarter)"
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
else
    # ==========================================================================
    # Legacy Mode - Edit specific domain/perspective
    # ==========================================================================

    WORKSPACE=${1:-platform}
    QUARTER=${2:-current}
    TYPE=${3:-}
    PORT=${4:-20100}

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
    echo "Mode:       Legacy (domain/perspective structure)"
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
fi
