# Structurizr DevOps

A complete DevOps pipeline for promoting Structurizr architecture workspaces from local development through staging to production using GitHub Actions with a self-hosted runner.

## Architecture

```
                            ┌─────────────────────────────────────────────────┐
                            │           LOCAL CONTAINER HOST (nerdctl)        │
                            │                                                 │
                            │  ┌─────────────────────────┐  ┌──────────────┐ │
Developer ──► Edit DSL ────►│  │   Structurizr Lite      │  │ On-Premises  │ │
                            │  │   (Domain Workspaces)   │  │   :20000     │ │
                            │  │                         │  │              │ │
                            │  │  Domains:               │  └──────────────┘ │
                            │  │  ├─ platform  (:20100)  │         ▲         │
                            │  │  ├─ orders    (:20101)  │         │         │
                            │  │  └─ notif.    (:20102)  │         │         │
                            │  │                         │         │         │
                            │  │  Perspectives:          │         │         │
                            │  │  ├─ executive (:20200)  │         │         │
                            │  │  ├─ security  (:20201)  │         │         │
                            │  │  └─ technical (:20202)  │         │         │
                            │  └─────────────────────────┘         │         │
                            │                                      │         │
                            │  ┌───────────────────────────────────┴───────┐ │
                            │  │           Self-Hosted Runner              │ │
                            │  │    (GitHub Actions + Structurizr CLI)     │ │
                            │  └───────────────────────────────────────────┘ │
                            └─────────────────────────────────────────────────┘
                                                        │
                                                        │ git push
                                                        ▼
                                              ┌─────────────────┐
                                              │  GitHub Repo    │
                                              └─────────────────┘
```

## Quick Start

### 1. Generate Admin API Key

```bash
./scripts/generate-api-key.sh
```

Copy the bcrypt hash to `containers/onpremises/structurizr.properties`.

### 2. Start Local Environment

```bash
cd containers
nerdctl compose up -d
```

### 3. Access Services

| Service | URL | Description |
|---------|-----|-------------|
| **On-Premises** | http://localhost:20000 | Promotion target |
| **Domains** | | |
| Platform | http://localhost:20100 | Core platform workspace |
| Orders | http://localhost:20101 | Order domain workspace |
| Notifications | http://localhost:20102 | Notification domain workspace |
| **Perspectives** | | |
| Executive | http://localhost:20200 | Executive dashboard view |
| Security | http://localhost:20201 | Security architecture view |
| Technical | http://localhost:20202 | Developer-focused view |

### 4. Initialize Domain Workspaces

```bash
export STRUCTURIZR_ADMIN_API_KEY=your-plaintext-key
./scripts/init-workspace.sh platform
./scripts/init-workspace.sh orders
./scripts/init-workspace.sh notifications
```

### 5. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

| Secret | Description |
|--------|-------------|
| `STRUCTURIZR_URL` | `http://localhost:20000/api` |
| `STRUCTURIZR_PLATFORM_WORKSPACE_ID` | Platform workspace ID |
| `STRUCTURIZR_PLATFORM_WORKSPACE_KEY` | Platform workspace API key |
| `STRUCTURIZR_PLATFORM_WORKSPACE_SECRET` | Platform workspace API secret |
| `STRUCTURIZR_ORDERS_WORKSPACE_ID` | Orders workspace ID |
| `STRUCTURIZR_ORDERS_WORKSPACE_KEY` | Orders workspace API key |
| `STRUCTURIZR_ORDERS_WORKSPACE_SECRET` | Orders workspace API secret |
| `STRUCTURIZR_NOTIFICATIONS_WORKSPACE_ID` | Notifications workspace ID |
| `STRUCTURIZR_NOTIFICATIONS_WORKSPACE_KEY` | Notifications workspace API key |
| `STRUCTURIZR_NOTIFICATIONS_WORKSPACE_SECRET` | Notifications workspace API secret |

### 6. Setup Self-Hosted Runner

```bash
./scripts/setup-runner.sh
```

Follow the interactive guide to configure your GitHub Actions runner.

## Directory Structure

```
structurizr-devops/
├── .github/workflows/
│   ├── ci.yml                  # Validation on all branches
│   ├── promote-dev.yml         # Auto-promote on develop branch
│   ├── promote-staging.yml     # Auto-promote on main branch
│   ├── promote-prod.yml        # Manual production promotion
│   ├── quarterly-snapshot.yml  # Create quarterly architecture snapshots
│   └── start-quarter.yml       # Initialize new quarter branches
├── containers/
│   ├── docker-compose.yml      # Full local stack
│   ├── onpremises/
│   │   └── structurizr.properties
│   └── .env.example
├── workspaces/
│   ├── domains/                # Business domain workspaces
│   │   ├── platform/           # Core platform architecture
│   │   │   └── workspace.dsl
│   │   ├── orders/             # Order management domain
│   │   │   └── workspace.dsl
│   │   └── notifications/      # Notification domain
│   │       └── workspace.dsl
│   ├── perspectives/           # Stakeholder-specific views
│   │   ├── executive/          # C-level dashboard view
│   │   │   └── workspace.dsl
│   │   ├── security/           # Security architecture view
│   │   │   └── workspace.dsl
│   │   └── technical/          # Developer-focused view
│   │       └── workspace.dsl
│   └── shared/
│       ├── base-model.dsl      # Shared people/systems
│       ├── styles.dsl          # Shared visual styling
│       └── domains.yaml        # Domain registry/catalog
├── scripts/
│   ├── domain-create.sh        # Create new domain scaffold
│   ├── init-workspace.sh       # Create workspace via Admin API
│   ├── validate-all.sh         # Local validation
│   ├── promote.sh              # Manual promotion
│   ├── setup-runner.sh         # Runner setup guide
│   ├── generate-api-key.sh     # Generate bcrypt API key
│   └── quarterly-rollover.sh   # Local quarterly rollover
└── README.md
```

## Domain-Based Architecture

### Domains vs Perspectives

**Domains** represent business capabilities owned by specific teams:
- `platform` - Core infrastructure services (Platform Team)
- `orders` - Order management (Commerce Team)
- `notifications` - Customer communications (Engagement Team)

**Perspectives** are aggregate views for different stakeholders:
- `executive` - High-level business capability view for leadership
- `security` - Security architecture with trust boundaries and data flows
- `technical` - Developer-focused view with implementation details

### Adding a New Domain

```bash
# Create domain scaffold
./scripts/domain-create.sh inventory "Warehouse Team" "Inventory management"

# Initialize in Structurizr On-Premises
export STRUCTURIZR_ADMIN_API_KEY=your-key
./scripts/init-workspace.sh inventory

# Configure GitHub secrets (shown in init output)
```

### Domain Registry

The `workspaces/shared/domains.yaml` file serves as a catalog of all domains with metadata including owner, port, and dependencies.

## Workflows

### CI (ci.yml)

- **Trigger**: Push to any branch, PR to main/develop
- **Action**: Validates all domain workspace DSL files
- **Runner**: `self-hosted, structurizr, nerdctl`

### Development Promotion (promote-dev.yml)

- **Trigger**: Push to `develop` branch
- **Action**: Validates and promotes all domains
- **Environment**: development

### Staging Promotion (promote-staging.yml)

- **Trigger**: Push to `main` branch
- **Action**: Validates and promotes all domains
- **Environment**: staging

### Production Promotion (promote-prod.yml)

- **Trigger**: Manual (workflow_dispatch)
- **Confirmation**: Must type "PRODUCTION" to confirm
- **Options**: Promote all domains or select specific one
- **Environment**: production

### Quarterly Snapshot (quarterly-snapshot.yml)

- **Trigger**: Manual (workflow_dispatch)
- **Action**: Creates quarterly architecture snapshots
- **Creates**: Structurizr workspace branches + git tags
- **Purpose**: Preserve architecture state at quarter end

### Start New Quarter (start-quarter.yml)

- **Trigger**: Manual (workflow_dispatch)
- **Action**: Creates release branch for new quarter
- **Options**: Merge planning branch, create next planning branch
- **Purpose**: Initialize quarterly development cycle

## Quarterly Architecture Management

The repository supports quarterly architecture snapshots using Structurizr workspace branches and git tags.

### Architecture Overview

```
Git Repository                          Structurizr On-Premises
─────────────────                       ─────────────────────────

main ◄──────────────────────────────►   Workspace ID 1 (platform)
  │                                       ├── branch: main (current)
  ├── tag: q1-2025-final                  ├── branch: q1-2025
  ├── tag: q2-2025-final                  ├── branch: q2-2025
  │                                       └── branch: q3-2025
  │
release/q2-2025 (current quarter)
  │
planning/q3-2025 (future planning)
```

### Branch Strategy

| Branch Type | Example | Purpose |
|-------------|---------|---------|
| `main` | `main` | Latest promoted architecture |
| `release/{quarter}` | `release/q2-2025` | Current quarter development |
| `planning/{quarter}` | `planning/q3-2025` | Future quarter planning (isolated) |
| Tag | `q1-2025-final` | Immutable quarterly snapshot |

### Quarterly Workflow

#### Normal Development (Within Quarter)

1. Work on `release/q2-2025` branch
2. Push to develop → auto-promotes to dev environment
3. Merge to main → auto-promotes to staging environment
4. Manual workflow → promotes to production environment

#### Planning Future Quarter

1. Create `planning/q3-2025` from `release/q2-2025`
2. Make architectural changes for Q3
3. Changes stay isolated until rollover
4. Optionally promote to Structurizr branch for review

#### Quarterly Rollover (End of Quarter)

**Option A: Using GitHub Actions (Recommended)**

1. Run "Quarterly Snapshot" workflow with quarter `q2-2025`
   - Creates Structurizr workspace branches
   - Creates git tag `q2-2025-final`

2. Run "Start New Quarter" workflow
   - New quarter: `q3-2025`
   - Base branch: `main`
   - Merge planning: `true`
   - Next quarter: `q4-2025`

**Option B: Local Script**

```bash
./scripts/quarterly-rollover.sh q2-2025 q3-2025
```

Then run "Quarterly Snapshot" workflow to create Structurizr branches.

### Accessing Historical Architecture

| Method | Command/URL |
|--------|-------------|
| Git checkout | `git checkout q1-2025-final` |
| Structurizr UI | `http://localhost:20000/workspace/1/q1-2025` |

### Shared Resources

The `workspaces/shared/` directory contains elements shared across domains:

- **base-model.dsl**: Common people, systems, and relationships
- **styles.dsl**: Standard visual styling for all diagrams
- **domains.yaml**: Domain registry with metadata

Include in workspace files:
```dsl
workspace "My Workspace" {
    model {
        !include ../../shared/base-model.dsl
        # Domain-specific elements here
    }
    views {
        # ... views ...
        !include ../../shared/styles.dsl
    }
}
```

## Local Development

### Validate Domains

```bash
# Validate all domains
./scripts/validate-all.sh

# Validate specific domain
./scripts/validate-all.sh platform
```

### Manual Promotion

```bash
# Set credentials
export STRUCTURIZR_URL=http://localhost:20000/api
export STRUCTURIZR_WORKSPACE_ID=1
export STRUCTURIZR_WORKSPACE_KEY=your-key
export STRUCTURIZR_WORKSPACE_SECRET=your-secret

# Promote
./scripts/promote.sh platform
```

### View Logs

```bash
cd containers
nerdctl compose logs -f structurizr-onpremises
```

### Restart Services

```bash
cd containers
nerdctl compose restart
```

### Stop All Services

```bash
cd containers
nerdctl compose down
```

## Business Domains

### Platform Domain

Core platform infrastructure services:
- API Gateway
- Auth Service
- User Service
- Platform Database
- Message Queue

### Orders Domain

Order management business domain:
- Order API
- Order Worker
- Order Database
- Order Cache

### Notifications Domain

Customer communication domain:
- Notification API
- Notification Worker
- Template Engine
- Notification Database
- Notification Queue

## Troubleshooting

### Container won't start

```bash
# Check container status
nerdctl compose ps

# View logs
nerdctl compose logs structurizr-onpremises
```

### Validation fails

```bash
# Run validation with verbose output
nerdctl run --rm -v "$PWD:/workspaces:ro" \
  structurizr/cli:latest validate \
  -workspace /workspaces/workspaces/domains/platform/workspace.dsl
```

### Promotion fails

1. Verify On-Premises is running: `curl http://localhost:20000/health`
2. Check workspace credentials are correct
3. Verify workspace ID exists in On-Premises

### Runner not picking up jobs

1. Check runner status: `./svc.sh status`
2. Verify labels match: `self-hosted, structurizr, nerdctl`
3. Check GitHub runner page for errors

## References

- [Structurizr Lite](https://docs.structurizr.com/lite)
- [Structurizr On-Premises](https://docs.structurizr.com/onpremises)
- [Structurizr CLI](https://docs.structurizr.com/cli)
- [Structurizr DSL](https://docs.structurizr.com/dsl)
- [GitHub Actions Self-Hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
