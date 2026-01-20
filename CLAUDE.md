# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a DevOps pipeline for promoting Structurizr architecture workspaces from local development through staging to production. It manages architecture-as-code using Structurizr DSL with a unified quarterly workspace structure.

**Key Components:**
- **Quarters**: Unified workspaces per quarter (`workspaces/q2-2025/workspace.dsl`)
- **Current**: Symlink to active quarter (`workspaces/current -> q2-2025`)
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
├── current -> q2-2025/           # Symlink to active quarter
├── q2-2025/                      # Current quarter (unified workspace)
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

Single workspace ID with branches for quarterly isolation:
- One workspace ID (e.g., `1`) for the entire project
- Structurizr branches for quarterly snapshots
- URLs: `/workspace/1/q2-2025`, `/workspace/1/q1-2025`

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
./cli workspace:validate                # Validate current quarter
./cli workspace:validate -q q1-2025     # Validate specific quarter
./cli workspace:promote                 # Promote current quarter to Local
./cli workspace:promote -e integration  # Promote to Integration
./cli workspace:promote -e production   # Promote to Production
./cli workspace:promote -q q1-2025      # Promote specific quarter
./cli workspace:promote --dry-run       # Show what would be promoted
./cli workspace:promote --validate      # Validate before promoting

# Quarterly Operations
./cli quarter:new q3-2025               # Create new quarter directory
./cli quarter:switch q3-2025            # Update current symlink

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
├── current -> q2-2025/           # Symlink to active quarter
├── q2-2025/workspace.dsl         # → workspace 1, branch: q2-2025
└── q1-2025/workspace.dsl         # → workspace 1, branch: q1-2025
```

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

## Key Files

### Configuration
- `containers/.env` - Local credentials (copy from `.env.example`)
- `containers/onpremises/structurizr.properties` - On-Premises config
- `containers/docker-compose.yml` - Service definitions
- `workspaces/shared/registry.yaml` - Workspace registry

### Workspace DSL Files
- `workspaces/current/workspace.dsl` - Main workspace entry point
- `workspaces/current/model/*.dsl` - Model definitions
- `workspaces/current/views/**/*.dsl` - View definitions
- `workspaces/current/styles/theme.dsl` - Styling

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

# Verbose validation
nerdctl run --rm -v "$PWD:/workspaces:ro" \
  structurizr/cli:latest validate \
  -workspace /workspaces/workspaces/current/workspace.dsl

# Check GitHub CLI auth
gh auth status

# List available quarters
./cli workspace:list

# Runner status
./svc.sh status
```
