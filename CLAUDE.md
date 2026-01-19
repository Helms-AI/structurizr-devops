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

Each domain/perspective maps to a workspace ID on Structurizr On-Premises with branches per quarter:

| Workspace | Type | ID | Branches |
|-----------|------|-----|----------|
| platform | domain | 1 | main, q1-2025, q2-2025 |
| orders | domain | 3 | main, q1-2025, q2-2025 |
| notifications | domain | 5 | main, q1-2025, q2-2025 |
| executive | perspective | 10 | main, q1-2025, q2-2025 |
| security | perspective | 11 | main, q1-2025, q2-2025 |
| technical | perspective | 12 | main, q1-2025, q2-2025 |

## Common Commands

### CLI Tool (Recommended)

Use `./cli` from the project root (auto-builds on first run):

```bash
# Validation
./cli validate                          # Validate all workspaces in current quarter
./cli validate platform                 # Validate specific workspace
./cli validate -q q1-2025               # Validate workspaces in specific quarter
./cli validate -t domain                # Validate only domains
./cli validate --all                    # Validate all (domains + perspectives)

# Promotion
./cli promote platform                  # Promote to Integration (default)
./cli promote platform -e Production    # Promote to Production
./cli promote --all                     # Promote all workspaces
./cli promote --all -e Production       # Promote all to Production
./cli promote --all --dry-run           # Show what would be promoted
./cli promote -q q1-2025                # Promote from specific quarter

# Workspace Management
./cli list                              # List all workspaces with IDs
./cli list --quarters                   # List available quarters
./cli workspace:create inventory        # Create new workspace
./cli workspace:init platform           # Initialize in On-Premises

# Quarterly Operations
./cli quarter:snapshot q2-2025          # Create quarterly snapshot directory
./cli quarter:rollover q1-2025 q2-2025  # Create new quarter from existing

# Secrets Management (requires -e environment flag)
# Environments: local (uses .env), Integration, Production
./cli secrets:list -e local             # List secrets from .env file
./cli secrets:list -e Integration       # List GitHub secrets for Integration
./cli secrets:list -e Production --check # Check missing secrets for Production
./cli secrets:get NAME -e local         # Get a secret from .env file
./cli secrets:get NAME -e Integration   # Check if secret exists (value not shown)
./cli secrets:get NAME -e Integration --repo # Check repository-level secret
./cli secrets:set NAME value -e local   # Set secret in .env file
./cli secrets:set NAME value -e Integration        # Set environment-specific secret
./cli secrets:set NAME value -e Integration --repo # Set repository-level secret
./cli secrets:sync                      # Sync workspace IDs from domains.yaml
./cli secrets:init                      # Interactive setup for all secrets
./cli secrets:init -e Integration       # Interactive setup for specific env

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
```

### Local Environment
```bash
# Start On-Premises (always available)
cd containers && nerdctl compose up -d

# Start Lite for editing (on-demand)
./scripts/lite.sh platform              # Edit platform workspace
./scripts/lite.sh orders q2-2025        # Edit orders in specific quarter
./scripts/lite.sh executive current perspective  # Edit perspective

# Container management
cd containers && nerdctl compose down
cd containers && nerdctl compose logs -f structurizr-onpremises
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
  Structurizr On-Premises (:20000)  →  Promoted workspaces with branches
```

**Deployment Flow:**
```
workspaces/
├── current -> q2-2025/           # Symlink to active quarter
├── q2-2025/domains/platform/     # → workspace 1, branch "main"
└── q1-2025/domains/platform/     # → workspace 1, branch "q1-2025"
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
| `quarterly-snapshot.yml` | Manual | Creates directory snapshot + optional workspace branches + git tag |

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

Secrets and variables are managed via CLI (`./cli secrets:*` and `./cli env:*`).

### Environments

| Environment | Storage | Description |
|-------------|---------|-------------|
| `local` | `containers/.env` | Local development credentials |
| `Integration` | GitHub Actions | CI/CD integration/staging environment |
| `Production` | GitHub Actions | Production environment |

### Local Environment (.env file)

```bash
# containers/.env
STRUCTURIZR_URL=http://localhost:20000/api
STRUCTURIZR_PLATFORM_WORKSPACE_ID=1
STRUCTURIZR_PLATFORM_WORKSPACE_KEY=your-key
STRUCTURIZR_PLATFORM_WORKSPACE_SECRET=your-secret
```

### GitHub Secrets (Integration/Production)

Use `--repo` flag to set repository-level secrets (shared across all environments).

```
# Repository-level secrets (use --repo flag, shared across environments)
STRUCTURIZR_URL_INT                    # Integration environment URL
STRUCTURIZR_URL_PROD                   # Production environment URL
STRUCTURIZR_{NAME}_WORKSPACE_ID        # Workspace ID (same across envs)

# Environment-specific secrets (default, per environment)
STRUCTURIZR_{NAME}_WORKSPACE_KEY_INT   # API key for Integration
STRUCTURIZR_{NAME}_WORKSPACE_KEY_PROD  # API key for Production
STRUCTURIZR_{NAME}_WORKSPACE_SECRET_INT    # API secret for Integration
STRUCTURIZR_{NAME}_WORKSPACE_SECRET_PROD   # API secret for Production
```

**Example for platform domain:**
```
# Repository secrets
STRUCTURIZR_PLATFORM_WORKSPACE_ID=1

# Integration environment secrets
STRUCTURIZR_PLATFORM_WORKSPACE_KEY_INT=xxx
STRUCTURIZR_PLATFORM_WORKSPACE_SECRET_INT=xxx

# Production environment secrets
STRUCTURIZR_PLATFORM_WORKSPACE_KEY_PROD=xxx
STRUCTURIZR_PLATFORM_WORKSPACE_SECRET_PROD=xxx
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
