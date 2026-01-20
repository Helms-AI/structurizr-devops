# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a DevOps pipeline for promoting Structurizr architecture workspaces from local development through staging to production. It manages architecture-as-code using Structurizr DSL with directory-based quarterly lifecycle management.

**Key Components:**
- **Quarters**: Directory-based quarterly snapshots (`workspaces/q2-2025/`, `workspaces/q1-2025/`)
- **Current**: Symlink to active quarter (`workspaces/current -> q2-2025`)
- **Domains**: Business domain workspaces in `workspaces/{quarter}/domains/`
- **Perspectives**: Stakeholder-specific aggregate views in `workspaces/{quarter}/perspectives/`
- **Shared**: Cross-cutting resources (base-model.dsl, styles.dsl, domains.yaml)
- **Containers**: Docker Compose stack with Structurizr On-Premises (always on) + Lite (on-demand)
- **CLI**: TypeScript CLI tool (`command-line/`) with `./cli` wrapper for all DevOps operations
- **Scripts**: Bash scripts (`scripts/`) including `lite.sh` for on-demand editing
- **Workflows**: GitHub Actions CI/CD with self-hosted runners

## Workspace ID Mapping

Each domain/perspective maps to a workspace ID on Structurizr On-Premises:

| Workspace | Type | ID |
|-----------|------|-----|
| executive | perspective | 1 |
| security | perspective | 2 |
| technical | perspective | 3 |
| platform | domain | 4 |
| orders | domain | 5 |
| notifications | domain | 6 |

## Common Commands

### CLI Tool (Recommended)

Use `./cli` from the project root (auto-builds on first run):

```bash
# Workspace Management
./cli workspace:list                    # List all workspaces with IDs
./cli workspace:list --quarters         # List available quarters
./cli workspace:validate                # Validate all workspaces in current quarter
./cli workspace:validate platform       # Validate specific workspace
./cli workspace:validate -q q1-2025     # Validate workspaces in specific quarter
./cli workspace:validate -t domain      # Validate only domains
./cli workspace:validate --all          # Validate all (domains + perspectives)
./cli workspace:promote platform        # Promote to Local (default, localhost:20000)
./cli workspace:promote platform -e integration   # Promote to Integration
./cli workspace:promote platform -e production    # Promote to Production
./cli workspace:promote --all           # Promote all workspaces
./cli workspace:promote --all -e Production       # Promote all to Production
./cli workspace:promote --all --dry-run # Show what would be promoted
./cli workspace:promote -q q1-2025      # Promote from specific quarter
./cli workspace:create inventory        # Create new workspace
./cli workspace:init platform           # Initialize in On-Premises

# Quarterly Operations
./cli quarter:new q3-2025               # Create new quarter directory for planning
./cli quarter:switch q3-2025            # Update current symlink to different quarter
./cli quarter:snapshot q2-2025          # Create git tag for quarterly milestone

# Secrets Management (requires -e environment flag)
# Environments: Local (uses .env), Integration, Production (case-insensitive)
./cli secrets:list -e local             # List secrets from .env file
./cli secrets:list -e integration       # List GitHub secrets for Integration
./cli secrets:list -e production --check # Check missing secrets for Production
./cli secrets:sync                      # Sync workspace IDs from domains.yaml (repo level)
./cli secrets:init                      # Interactive setup for all secrets
./cli secrets:init -e integration       # Interactive setup for specific env

# Variables Management (requires -e environment flag)
# Environments: local (uses .env), Integration, Production
./cli variables:list -e local           # List variables from .env file
./cli variables:list -e Integration     # List GitHub env variables
./cli variables:list -e Production --secrets  # Include secrets in listing
./cli variables:list --environments     # List available GitHub environments
./cli variables:get NAME -e local       # Get a variable from .env file
./cli variables:get NAME -e Integration # Get a GitHub env variable
./cli variables:set NAME value -e local       # Set variable in .env file
./cli variables:set NAME value -e Integration # Set GitHub env variable
./cli variables:set NAME value -e Production --secret # Set as secret

# Admin Operations
./cli admin:generate-key                # Generate API key

# System Control
./cli system:start                      # Start Structurizr On-Premises container
./cli system:start --logs               # Start and follow container logs
./cli system:stop                       # Stop Structurizr On-Premises container
./cli system:restart                    # Restart Structurizr On-Premises container
./cli system:logs                       # View container logs
./cli system:logs -f                    # Follow container logs
```

### Local Environment
```bash
# Start On-Premises (recommended: use CLI)
./cli system:start                      # Start container
./cli system:start --logs               # Start and follow logs
./cli system:logs -f                    # Follow logs anytime

# Start Lite for editing (on-demand)
./scripts/lite.sh platform              # Edit platform workspace
./scripts/lite.sh orders q2-2025        # Edit orders in specific quarter
./scripts/lite.sh executive current perspective  # Edit perspective

# Container management (alternative: direct compose commands)
cd containers && nerdctl compose ps
```

## Architecture

```
Local Development:
  Structurizr Lite (on-demand :20100)  →  Edit DSL files
                ↓
  Git Push to GitHub
                ↓
CI/CD Pipeline:
  GitHub Actions (self-hosted runner with nerdctl)
                ↓
  Structurizr On-Premises (:20000)  →  Promoted workspaces
```

**Deployment Flow:**
```
workspaces/
├── current -> q2-2025/           # Symlink to active quarter
├── q2-2025/domains/platform/     # → workspace 4 (promoted)
├── q1-2025/domains/platform/     # Archived (can promote for review)
└── q3-2025/domains/platform/     # Future planning (can promote to preview)
```

**Service Ports:**
- 20000: On-Premises (promotion target, always running)
- 20100: Lite (on-demand, configurable via lite.sh)

## Directory Structure

```
workspaces/
├── current -> q2-2025/           # Symlink to active quarter
├── q2-2025/                      # Current quarter
│   ├── domains/
│   │   ├── platform/workspace.dsl
│   │   ├── orders/workspace.dsl
│   │   └── notifications/workspace.dsl
│   └── perspectives/
│       ├── executive/workspace.dsl
│       ├── security/workspace.dsl
│       └── technical/workspace.dsl
├── q1-2025/                      # Archived quarter
│   ├── domains/...
│   └── perspectives/...
└── shared/                       # Cross-cutting resources
    ├── base-model.dsl           # Shared people/systems
    ├── styles.dsl               # Shared visual styling
    └── domains.yaml             # Domain registry with workspace IDs
```

## Development Workflow

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `develop` | Development pipeline → auto-promotes to integration |
| `main` | Production-ready → manual promote to production |
| Tag `{quarter}-final` | Immutable quarterly snapshot (e.g., `q1-2025-final`) |

### Promotion Flow

1. **Integration**: Push to `develop` → auto-promotes to Integration environment
2. **Production**: Manual workflow dispatch with "PRODUCTION" confirmation

### GitHub Actions Workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| `ci.yml` | Push/PR | Validates DSL files in current/ |
| `promote.yml` | Push to develop / Manual | Promotes to integration (auto) or production (manual) |

## Key Files

### Configuration
- `containers/.env` - Local credentials (copy from `.env.example`)
- `containers/onpremises/structurizr.properties` - On-Premises config
- `containers/docker-compose.yml` - Service definitions (uses profiles)
- `workspaces/shared/domains.yaml` - Domain registry with workspace IDs

### Workspace DSL Files
- `workspaces/current/domains/{name}/workspace.dsl` - Domain workspaces
- `workspaces/current/perspectives/{name}/workspace.dsl` - Perspective workspaces

### Shared Resources
- `workspaces/shared/base-model.dsl` - Shared people/systems
- `workspaces/shared/styles.dsl` - Shared visual styling

Include shared resources in workspace files:
```dsl
workspace "Name" {
    model {
        !include ../../../shared/base-model.dsl
        # Domain-specific elements
    }
    views {
        !include ../../../shared/styles.dsl
    }
}
```

## Secrets and Variables Configuration

Secrets and variables are managed via CLI (`./cli secrets:*`).

### Environments

| Environment | Storage | Description |
|-------------|---------|-------------|
| `Local` | `containers/.env` | Local development (default for promote) |
| `Integration` | GitHub Actions env | CI/CD integration/staging environment |
| `Production` | GitHub Actions env | Production environment |

Environment input is case-insensitive: `local`, `Local`, `LOCAL` all work.

### Variable Naming (Simplified)

All variables use the same simple names across environments (no `_INT`/`_PROD` suffixes):

| Variable | Description | Storage |
|----------|-------------|---------|
| `STRUCTURIZR_URL` | Structurizr API URL | Per environment |
| `STRUCTURIZR_{NAME}_WORKSPACE_ID` | Workspace ID | Repo level (GitHub) or .env (Local) |
| `STRUCTURIZR_{NAME}_WORKSPACE_KEY` | API key | Per environment |
| `STRUCTURIZR_{NAME}_WORKSPACE_SECRET` | API secret | Per environment |

### Local Environment (.env file)

```bash
# containers/.env
STRUCTURIZR_URL=http://localhost:20000/api
STRUCTURIZR_PLATFORM_WORKSPACE_ID=4
STRUCTURIZR_PLATFORM_WORKSPACE_KEY=your-key
STRUCTURIZR_PLATFORM_WORKSPACE_SECRET=your-secret
```

### GitHub Secrets (Integration/Production)

Secrets are stored per GitHub environment with the same names:

```
# Repository-level (shared across environments)
STRUCTURIZR_{NAME}_WORKSPACE_ID        # Workspace ID

# Per GitHub environment (Integration, Production)
STRUCTURIZR_URL                        # API URL for that environment
STRUCTURIZR_{NAME}_WORKSPACE_KEY       # API key
STRUCTURIZR_{NAME}_WORKSPACE_SECRET    # API secret
```

**Example for platform domain:**
```
# Repository secrets (./cli secrets:sync)
STRUCTURIZR_PLATFORM_WORKSPACE_ID=4

# Integration environment secrets (./cli secrets:init -e Integration)
STRUCTURIZR_URL=https://structurizr-int.example.com/api
STRUCTURIZR_PLATFORM_WORKSPACE_KEY=xxx
STRUCTURIZR_PLATFORM_WORKSPACE_SECRET=xxx

# Production environment secrets (./cli secrets:init -e Production)
STRUCTURIZR_URL=https://structurizr.example.com/api
STRUCTURIZR_PLATFORM_WORKSPACE_KEY=yyy
STRUCTURIZR_PLATFORM_WORKSPACE_SECRET=yyy
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

# Verbose validation
nerdctl run --rm -v "$PWD:/workspaces:ro" \
  structurizr/cli:latest validate \
  -workspace /workspaces/workspaces/current/domains/platform/workspace.dsl

# Check GitHub CLI auth
gh auth status

# List configured secrets (environment required)
./cli secrets:list -e local --check       # Check local .env
./cli secrets:list -e Integration --check # Check GitHub Integration
./cli secrets:list -e Production --check  # Check GitHub Production

# Runner status
./svc.sh status
```
