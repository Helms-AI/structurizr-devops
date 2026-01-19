# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a DevOps pipeline for promoting Structurizr architecture workspaces from local development through staging to production. It manages architecture-as-code using Structurizr DSL with quarterly lifecycle management.

**Key Components:**
- **Domains**: Business domain workspaces (platform, orders, notifications) in `workspaces/domains/`
- **Perspectives**: Stakeholder-specific aggregate views (executive, security, technical) in `workspaces/perspectives/`
- **Shared**: Cross-cutting resources (base-model.dsl, styles.dsl, domains.yaml)
- **Containers**: Docker Compose stack with Structurizr Lite (editors) and On-Premises (promotion target)
- **Scripts**: Bash automation for validation, promotion, domain creation, and quarterly management
- **Workflows**: GitHub Actions CI/CD with self-hosted runners

## Common Commands

### Validation
```bash
./scripts/validate-all.sh              # Validate all domains
./scripts/validate-all.sh platform     # Validate specific domain (platform, orders, notifications)
```

### Local Environment
```bash
cd containers && nerdctl compose up -d     # Start all services
cd containers && nerdctl compose down      # Stop all services
cd containers && nerdctl compose logs -f structurizr-onpremises  # View On-Premises logs
cd containers && nerdctl compose ps        # Check service status
```

### Manual Promotion
```bash
export STRUCTURIZR_URL=http://localhost:20000/api
export STRUCTURIZR_WORKSPACE_ID=1
export STRUCTURIZR_WORKSPACE_KEY=your-key
export STRUCTURIZR_WORKSPACE_SECRET=your-secret
./scripts/promote.sh platform
```

### Domain Management
```bash
# Create new domain scaffold
./scripts/domain-create.sh inventory "Warehouse Team" "Inventory management"

# Initialize workspace in Structurizr On-Premises
export STRUCTURIZR_ADMIN_API_KEY=your-key
./scripts/init-workspace.sh platform
```

### Quarterly Operations
```bash
./scripts/quarterly-rollover.sh q2-2025 q3-2025  # Local rollover
# Or use GitHub Actions: "Quarterly Snapshot" then "Start New Quarter" workflows
```

## Architecture

```
Local Development:
  Structurizr Lite (Domains :20100-20102, Perspectives :20200-20202)  →  Edit DSL files
                ↓
  Git Push to GitHub
                ↓
CI/CD Pipeline:
  GitHub Actions (self-hosted runner with nerdctl)
                ↓
  Structurizr On-Premises (:20000)  →  Promoted workspaces
```

**Service Ports:**
- 20000: On-Premises (promotion target)
- 20100: Domain - platform
- 20101: Domain - orders
- 20102: Domain - notifications
- 20200: Perspective - executive
- 20201: Perspective - security
- 20202: Perspective - technical

## Directory Structure

```
workspaces/
├── domains/                    # Business domain workspaces
│   ├── platform/              # Core platform (Port: 20100)
│   ├── orders/                # Order domain (Port: 20101)
│   └── notifications/         # Notification domain (Port: 20102)
├── perspectives/              # Stakeholder-specific aggregate views
│   ├── executive/            # C-level dashboard view (Port: 20200)
│   ├── security/             # Security architecture view (Port: 20201)
│   └── technical/            # Developer-focused view (Port: 20202)
└── shared/                    # Cross-cutting resources
    ├── base-model.dsl        # Shared people/systems
    ├── styles.dsl            # Shared visual styling
    └── domains.yaml          # Domain registry/catalog
```

## Development Workflow

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Latest promoted architecture → triggers staging promotion |
| `develop` | Development pipeline → triggers dev promotion |
| `release/{quarter}` | Current quarter work (e.g., `release/q2-2025`) |
| `planning/{quarter}` | Future quarter planning (isolated) |
| Tag `{quarter}-final` | Immutable quarterly snapshot (e.g., `q1-2025-final`) |

### Promotion Flow

1. **Development**: Push to `develop` → auto-promotes to dev environment
2. **Staging**: Merge to `main` → auto-promotes to staging environment
3. **Production**: Manual workflow with "PRODUCTION" confirmation

### GitHub Actions Workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| `ci.yml` | Push/PR | Validates DSL files |
| `promote-dev.yml` | Push to develop | Promotes to dev |
| `promote-staging.yml` | Push to main | Promotes to staging |
| `promote-prod.yml` | Manual | Promotes to production (requires typing "PRODUCTION") |
| `quarterly-snapshot.yml` | Manual | Creates workspace branches + git tag |
| `start-quarter.yml` | Manual | Initializes new quarter branches |

## Key Files

### Configuration
- `containers/.env` - Local credentials (copy from `.env.example`)
- `containers/onpremises/structurizr.properties` - On-Premises config (add bcrypt API key here)
- `containers/docker-compose.yml` - Service definitions
- `workspaces/shared/domains.yaml` - Domain registry with metadata

### Domain Workspace DSL
- `workspaces/domains/platform/workspace.dsl` - Platform architecture
- `workspaces/domains/orders/workspace.dsl` - Order service domain
- `workspaces/domains/notifications/workspace.dsl` - Notification service domain

### Perspective Workspace DSL
- `workspaces/perspectives/executive/workspace.dsl` - Executive view
- `workspaces/perspectives/security/workspace.dsl` - Security architecture view
- `workspaces/perspectives/technical/workspace.dsl` - Technical architecture view

### Shared Resources
- `workspaces/shared/base-model.dsl` - Shared people/systems
- `workspaces/shared/styles.dsl` - Shared visual styling

Include shared resources in workspace files:
```dsl
workspace "Name" {
    model {
        !include ../../shared/base-model.dsl
        # Domain-specific elements
    }
    views {
        !include ../../shared/styles.dsl
    }
}
```

## GitHub Secrets Required

```
STRUCTURIZR_URL
STRUCTURIZR_PLATFORM_WORKSPACE_ID / _KEY / _SECRET
STRUCTURIZR_ORDERS_WORKSPACE_ID / _KEY / _SECRET
STRUCTURIZR_NOTIFICATIONS_WORKSPACE_ID / _KEY / _SECRET
```

## Prerequisites

- **nerdctl** - Container runtime (required for all operations)
- **Self-hosted GitHub Actions runner** - Labels: `self-hosted, structurizr, nerdctl`
- **Structurizr On-Premises license** - For production use

## Troubleshooting

```bash
# Health check
curl http://localhost:20000/health

# Verbose validation
nerdctl run --rm -v "$PWD:/workspaces:ro" \
  structurizr/cli:latest validate \
  -workspace /workspaces/workspaces/domains/platform/workspace.dsl

# Runner status
./svc.sh status
```
