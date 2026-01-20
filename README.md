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
│   └── promote.yml             # Unified promotion (integration + production)
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
│   └── generate-api-key.sh     # Generate bcrypt API key
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

### CI - Validate Workspaces (ci.yml)

- **Trigger**: Push to any branch, PR to main/develop (when workspace files change)
- **Action**: Validates all domain and perspective DSL files in `workspaces/current/`
- **Runner**: `self-hosted, structurizr, nerdctl`
- **Jobs**: Discovers workspaces dynamically, validates each in parallel

### Promote Workspaces (promote.yml)

Unified promotion workflow for all environments.

| Trigger | Environment | Confirmation |
|---------|-------------|--------------|
| Push to `develop` | integration | None (auto) |
| Manual dispatch | integration | None |
| Manual dispatch | production | Must type "PRODUCTION" |

- **Action**: Validates then promotes domains and perspectives
- **Options**: Promote all workspaces or select specific one
- **Credentials**: Uses environment-specific secrets (e.g., `STRUCTURIZR_PLATFORM_WORKSPACE_KEY_INT`)

## Quarterly Architecture Management

The repository uses a directory-based approach for quarterly architecture management. All quarters exist as directories, with a `current` symlink pointing to the active quarter.

### Architecture Overview

```
workspaces/
├── current -> q2-2025/           # Symlink to active quarter
├── q1-2025/                      # Past quarter (archive)
├── q2-2025/                      # Current quarter (active)
├── q3-2025/                      # Future quarter (planning)
└── shared/                       # Cross-cutting resources
```

Timeline determines meaning:
- **Past quarter** = Archive (e.g., `q1-2025/` when we're in Q2)
- **Current quarter** = Active development (pointed to by `current` symlink)
- **Future quarter** = Planning (e.g., `q3-2025/` when we're in Q2)

### Deployment Model

- **Single version per workspace**: Promotion overwrites previous content
- **Any quarter deployable**: Can promote from any `workspaces/{quarter}/` directory
- **History in git**: Use git tags (`q1-2025-final`) and git history for rollback

### Quarterly Workflow

#### Normal Development

1. Work in `workspaces/current/` (points to active quarter)
2. Push to `main` branch → CI validates → promote to Integration/Production

#### Start Planning Next Quarter

```bash
./cli quarter:new q3-2025                 # Create planning directory
# Edit workspaces/q3-2025/ for future changes
```

#### End of Quarter Rollover

```bash
./cli quarter:snapshot q2-2025            # Tag q2-2025-final in git
./cli quarter:switch q3-2025              # Update current symlink
./cli promote --all                       # Deploy new quarter to Structurizr
```

#### Deploy Historical Quarter (for review)

```bash
./cli promote platform -q q1-2025 -e Integration
# Deploys Q1 architecture to Integration environment
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `./cli quarter:new <quarter>` | Create new quarter directory (for planning) |
| `./cli quarter:switch <quarter>` | Update `current` symlink to different quarter |
| `./cli quarter:snapshot <quarter>` | Create git tag for quarterly milestone |

### Accessing Historical Architecture

| Method | Command |
|--------|---------|
| Git checkout | `git checkout q1-2025-final` |
| Promote | `./cli promote --all -q q1-2025` |

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
