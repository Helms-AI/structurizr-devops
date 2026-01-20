# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a DevOps pipeline for promoting Structurizr architecture workspaces from local development through staging to production. It manages architecture-as-code using Structurizr DSL with a unified quarterly workspace structure.

**Key Components:**
- **Quarters**: Unified workspaces per quarter (`workspaces/q2-2025/workspace.dsl`)
- **Active Quarter**: Configured in `registry.yaml` via `current_quarter` field
- **Model**: Unified architecture model (`model/people.dsl`, `model/external-systems.dsl`, `model/domains/`)
- **Views**: Domain and perspective views (`views/domains/`, `views/perspectives/`)
- **Styles**: Shared styling (`styles/theme.dsl`)
- **Shared**: Cross-cutting resources (`registry.yaml`)
- **Containers**: Docker Compose stack with Structurizr On-Premises (always on) + Lite (on-demand)
- **CLI**: TypeScript CLI tool (`command-line/`) with `./cli` wrapper for all DevOps operations
- **Scripts**: Bash scripts (`scripts/`) including `lite.sh` for on-demand editing
- **Workflows**: GitHub Actions CI/CD with self-hosted runners

## Workspace Structure

### Unified Structure (Single Workspace per Quarter)

The project uses a unified workspace structure where each quarter contains a single `workspace.dsl` that composes all domains and perspectives:

```
workspaces/
├── q2-2025/                      # Quarter workspace (unified)
│   ├── workspace.dsl             # Main entry point
│   ├── model/                    # Unified model
│   │   ├── people.dsl            # All actors/stakeholders
│   │   ├── external-systems.dsl  # External dependencies
│   │   └── domains/              # Domain-specific models
│   │       ├── platform/system.dsl
│   │       ├── orders/system.dsl
│   │       └── notifications/system.dsl
│   ├── views/                    # All views
│   │   ├── landscape.dsl         # System landscape views
│   │   ├── domains/              # Domain-focused views
│   │   │   ├── platform.dsl
│   │   │   ├── orders.dsl
│   │   │   └── notifications.dsl
│   │   └── perspectives/         # Stakeholder filtered views
│   │       ├── executive.dsl
│   │       ├── security.dsl
│   │       └── technical.dsl
│   └── styles/
│       └── theme.dsl             # Shared styling
├── q1-2025/                      # Archived quarter (same structure)
└── shared/
    └── registry.yaml             # Workspace registry
```

### Workspace ID Strategy

The project supports two approaches (coexisting):

**New ID-based approach (recommended for new quarters):**
- Each quarter has its own workspace ID
- Parent-child relationships tracked in registry
- Supports branching and merging between quarters
- Created with `./cli workspace:branch`

**Legacy branch-based approach (existing quarters):**
- Single workspace ID (e.g., `6`) for the entire project
- Structurizr branches for quarterly snapshots
- URLs: `/workspace/6/q2-2025`, `/workspace/6/q1-2025`

### Tagging Strategy

Elements are tagged for filtered perspective views:

| Tag Category | Tags | Purpose |
|--------------|------|---------|
| Domain | `Platform`, `Orders`, `Notifications` | Filter by business domain |
| Visibility | `Core`, `Supporting`, `Generic` | Executive view filtering |
| Security | `PII`, `Financial`, `Public` | Security perspective |
| Technical | `Infrastructure`, `Application`, `Data` | Technical perspective |

## Common Commands

### CLI Tool (Recommended)

Use `./cli` from the project root (auto-builds on first run):

```bash
# Workspace Management (Quarter-Level)
./cli workspace:list                    # List quarters and workspace info
./cli workspace:list --quarters         # List quarters with IDs and lineage
./cli workspace:validate                # Validate current quarter
./cli workspace:validate -q q1-2025     # Validate specific quarter
./cli workspace:promote                 # Promote current quarter to Local
./cli workspace:promote -e integration  # Promote to Integration
./cli workspace:promote -e production   # Promote to Production
./cli workspace:promote -q q1-2025      # Promote specific quarter
./cli workspace:promote --dry-run       # Show what would be promoted
./cli workspace:promote --validate      # Validate before promoting

# Workspace Branching & Merging (New)
./cli workspace:branch q3-2025          # Create new quarter from current
./cli workspace:branch q3-2025 --from q2-2025  # Branch from specific quarter
./cli workspace:lineage                 # Show workspace inheritance tree
./cli workspace:diff q1-2025 q2-2025    # Compare two quarters
./cli workspace:diff --from-parent      # Compare current with parent
./cli workspace:merge                   # Merge parent changes into current
./cli workspace:merge -q q3-2025        # Merge into specific quarter
./cli workspace:merge --dry-run         # Preview merge without applying
./cli workspace:merge --strategy ours   # Auto-resolve conflicts with ours

# Workspace Creation
./cli workspace:create q3-2025 --empty  # Create new empty quarter workspace
./cli workspace:create q3-2025          # Copy from current quarter
./cli workspace:create q3-2025 --from q2-2025  # Copy from specific quarter

# Secrets Management (requires -e environment flag)
./cli secrets:list -e local             # List secrets from .env file
./cli secrets:list -e integration       # List GitHub secrets for Integration
./cli secrets:init -e production        # Interactive setup for Production

# Variables Management
./cli variables:list -e local           # List variables from .env file
./cli variables:get NAME -e local       # Get a variable
./cli variables:set NAME value -e local # Set a variable

# System Control
./cli system:start                      # Start Structurizr On-Premises
./cli system:start --logs               # Start and follow logs
./cli system:stop                       # Stop container
./cli system:restart                    # Restart container
./cli system:logs -f                    # Follow logs
```

### Local Environment

```bash
# Start On-Premises (recommended: use CLI)
./cli system:start                      # Start container
./cli system:start --logs               # Start and follow logs

# Start Lite for editing (on-demand)
./scripts/lite.sh                       # Edit current quarter (unified)
./scripts/lite.sh q2-2025               # Edit specific quarter
./scripts/lite.sh q2-2025 8080          # Custom port

# Container management
cd containers && nerdctl compose ps
```

## Architecture

```
Local Development:
  Structurizr Lite (:20100)  →  Edit workspace.dsl
                ↓
  Git Push to GitHub
                ↓
CI/CD Pipeline:
  GitHub Actions (self-hosted runner)
                ↓
  Structurizr On-Premises (:20000)  →  Promoted workspaces (with branches)
```

**Deployment Flow:**
```
workspaces/
├── q2-2025/workspace.dsl         # → workspace 1, branch: q2-2025 (legacy)
├── q1-2025/workspace.dsl         # → workspace 1, branch: q1-2025 (legacy)
└── q3-2025/workspace.dsl         # → workspace 12 (own ID, new approach)
```

The active quarter is set in `registry.yaml` via `current_quarter: q2-2025`.

**Service Ports:**
- 20000: On-Premises (promotion target, always running)
- 20100: Lite (on-demand, configurable via lite.sh)

## Development Workflow

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `develop` | Development pipeline → auto-promotes to integration |
| `main` | Production-ready → manual promote to production |
| Tag `{quarter}-final` | Immutable quarterly snapshot |

### Promotion Flow

1. **Integration**: Push to `develop` → auto-promotes to Integration
2. **Production**: Manual workflow dispatch with "PRODUCTION" confirmation

### GitHub Actions Workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| `ci.yml` | Push/PR | Validates DSL files |
| `promote.yml` | Push to develop / Manual | Promotes to environments |

## Registry Schema

The `workspaces/shared/registry.yaml` file defines workspace configuration:

```yaml
# Legacy root workspace ID (for branch-based quarters)
workspace_id: 6
lite_port: 20100
current_quarter: q2-2025

quarters:
  # Legacy branch-based quarter (no workspace_id)
  q2-2025:
    name: Q2 2025
    description: Q2 2025 architecture workspace
    branch: q2-2025
    status: active
    workspace_file: workspace.dsl

  # New ID-based quarter (has workspace_id)
  q3-2025:
    name: Q3 2025
    description: Q3 2025 architecture workspace
    branch: q3-2025
    status: active
    workspace_file: workspace.dsl
    workspace_id: 12          # Own workspace ID
    parent: q2-2025           # Parent quarter for merging
    merge_base: "a1b2c3d4"    # Last merge point (hash)
    api_key: "key-xxx"        # Per-quarter credentials
    api_secret: "secret-xxx"
```

**Quarter Fields:**
- `workspace_id`: Per-quarter workspace ID (new approach)
- `parent`: Parent quarter for lineage tracking
- `merge_base`: Last merge commit hash for three-way merge
- `api_key`, `api_secret`: Credentials for this quarter's workspace

## Key Files

### Configuration
- `containers/.env` - Local credentials (copy from `.env.example`)
- `containers/onpremises/structurizr.properties` - On-Premises config
- `containers/docker-compose.yml` - Service definitions
- `workspaces/shared/registry.yaml` - Workspace registry

### Workspace DSL Files
- `workspaces/{quarter}/workspace.dsl` - Main workspace entry point
- `workspaces/{quarter}/model/*.dsl` - Model definitions
- `workspaces/{quarter}/views/**/*.dsl` - View definitions
- `workspaces/{quarter}/styles/theme.dsl` - Styling

## Secrets and Variables Configuration

### Environments

| Environment | Storage | Description |
|-------------|---------|-------------|
| `Local` | `containers/.env` | Local development |
| `Integration` | GitHub Actions env | CI/CD staging |
| `Production` | GitHub Actions env | Production |

### Variable Naming (Simplified)

All variables use simple names (no domain suffixes in unified structure):

| Variable | Description |
|----------|-------------|
| `STRUCTURIZR_URL` | API URL per environment |
| `STRUCTURIZR_WORKSPACE_ID` | Single workspace ID |
| `STRUCTURIZR_WORKSPACE_KEY` | API key |
| `STRUCTURIZR_WORKSPACE_SECRET` | API secret |

### Local Environment (.env file)

```bash
# containers/.env
STRUCTURIZR_URL=http://localhost:20000/api
STRUCTURIZR_WORKSPACE_ID=1
STRUCTURIZR_WORKSPACE_KEY=your-key
STRUCTURIZR_WORKSPACE_SECRET=your-secret
```

### GitHub Secrets (Integration/Production)

```
# Per GitHub environment
STRUCTURIZR_URL                        # API URL for environment
STRUCTURIZR_WORKSPACE_ID               # Workspace ID
STRUCTURIZR_WORKSPACE_KEY              # API key
STRUCTURIZR_WORKSPACE_SECRET           # API secret
```

## Prerequisites

- **nerdctl** - Container runtime (required for all operations)
- **gh** - GitHub CLI (required for secrets management)
- **Self-hosted GitHub Actions runner** - Labels: `self-hosted, structurizr, nerdctl`
- **Structurizr On-Premises license** - For production use

## Troubleshooting

```bash
# Health check
curl http://localhost:20000/health

# Verbose validation (replace {workspace} with actual quarter, e.g., q1-2026)
nerdctl run --rm -v "$PWD:/workspaces:ro" \
  structurizr/cli:latest validate \
  -workspace /workspaces/workspaces/{workspace}/workspace.dsl

# Check GitHub CLI auth
gh auth status

# List available quarters with workspace IDs
./cli workspace:list --quarters

# View workspace lineage tree
./cli workspace:lineage

# Compare current quarter with parent
./cli workspace:diff --from-parent

# Runner status
./svc.sh status
```
