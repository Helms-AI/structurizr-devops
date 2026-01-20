# Structurizr DevOps

A DevOps pipeline for promoting Structurizr architecture workspaces from local development through staging to production using GitHub Actions with a self-hosted runner.

## Architecture

```
                            ┌─────────────────────────────────────────────────┐
                            │           LOCAL CONTAINER HOST (nerdctl)        │
                            │                                                 │
                            │  ┌─────────────────┐  ┌──────────────────────┐ │
Developer ──► Edit DSL ────►│  │ Structurizr     │  │ Structurizr          │ │
                            │  │ Lite            │  │ On-Premises          │ │
                            │  │ :20100          │  │ :20000               │ │
                            │  │ (on-demand)     │  │ (always running)     │ │
                            │  └────────┬────────┘  └───────────▲──────────┘ │
                            │           │                       │            │
                            │           │ Save to DSL           │ Promote    │
                            │           ▼                       │            │
                            │  ┌────────────────────────────────┴──────────┐ │
                            │  │      workspaces/{quarter}/workspace.dsl   │ │
                            │  └───────────────────────────────────────────┘ │
                            │                                                 │
                            │  ┌───────────────────────────────────────────┐ │
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

**Key Points:**
- **Unified workspace** per quarter (single `workspace.dsl` at root)
- **On-Premises** (:20000) is the promotion target, always running
- **Lite** (:20100) is for visual editing, started on-demand via `./scripts/lite.sh`
- **Tagging strategy** enables filtered views for different stakeholders

## Quick Start

### 1. Generate Admin API Key

```bash
./cli admin:generate-key
```

Copy the bcrypt hash to `containers/onpremises/structurizr.properties`.

### 2. Start On-Premises

```bash
./cli system:start
```

### 3. Initialize Workspace

```bash
./cli workspace:init
```

This creates workspace credentials in On-Premises and saves them to `.env`.

### 4. Edit with Structurizr Lite

```bash
./scripts/lite.sh              # Edit current quarter
./scripts/lite.sh q2-2025      # Edit specific quarter
./scripts/lite.sh q2-2025 8080 # Custom port
```

### 5. Access Services

| Service | URL | Description |
|---------|-----|-------------|
| **On-Premises** | http://localhost:20000 | Promotion target (always running) |
| **Lite** | http://localhost:20100 | Visual editor (on-demand) |

### 6. Configure GitHub Secrets

Add the following secrets to your GitHub repository environments (Integration, Production):

| Secret | Description |
|--------|-------------|
| `STRUCTURIZR_URL` | API URL (e.g., `http://localhost:20000/api`) |
| `STRUCTURIZR_WORKSPACE_ID` | Workspace ID (e.g., `6`) |
| `STRUCTURIZR_WORKSPACE_KEY` | Workspace API key |
| `STRUCTURIZR_WORKSPACE_SECRET` | Workspace API secret |

### 7. Setup Self-Hosted Runner

```bash
./scripts/setup-runner.sh
```

Follow the interactive guide to configure your GitHub Actions runner.

## Directory Structure

```
structurizr-devops/
├── .github/workflows/
│   ├── ci.yml                     # Validation + CLI tests
│   └── promote.yml                # Promote to environments
├── containers/
│   ├── docker-compose.yml         # On-Premises service
│   ├── onpremises/
│   │   └── structurizr.properties
│   └── .env.example
├── workspaces/
│   ├── q2-2025/                   # Quarter workspace (unified)
│   │   ├── workspace.dsl          # Main entry point
│   │   ├── model/
│   │   │   ├── people.dsl         # Actors and stakeholders
│   │   │   ├── external-systems.dsl
│   │   │   └── domains/
│   │   │       ├── platform/system.dsl
│   │   │       ├── orders/system.dsl
│   │   │       └── notifications/system.dsl
│   │   ├── views/
│   │   │   ├── landscape.dsl      # System landscape
│   │   │   ├── domains/           # Domain-focused views
│   │   │   │   ├── platform.dsl
│   │   │   │   ├── orders.dsl
│   │   │   │   └── notifications.dsl
│   │   │   └── perspectives/      # Stakeholder views
│   │   │       ├── executive.dsl
│   │   │       ├── security.dsl
│   │   │       └── technical.dsl
│   │   └── styles/
│   │       └── theme.dsl
│   └── shared/
│       └── registry.yaml          # Workspace registry
├── command-line/                  # TypeScript CLI source
├── scripts/
│   ├── lite.sh                    # On-demand Lite editor
│   ├── setup-runner.sh            # Runner configuration
│   └── generate-api-key.sh        # Legacy key generation
├── cli                            # CLI wrapper (auto-builds)
└── README.md
```

## CLI Commands

Use `./cli` from the project root (auto-builds on first run):

### Workspace Management

```bash
./cli workspace:list                    # List quarters and workspace info
./cli workspace:validate                # Validate current quarter
./cli workspace:validate -q q1-2025     # Validate specific quarter
./cli workspace:promote                 # Promote current quarter to Local
./cli workspace:promote -e integration  # Promote to Integration
./cli workspace:promote -e production   # Promote to Production
./cli workspace:promote -q q1-2025      # Promote specific quarter
./cli workspace:promote --dry-run       # Show what would be promoted
./cli workspace:init                    # Initialize workspace in On-Premises
./cli workspace:demote                  # Remove workspace from On-Premises
./cli workspace:delete                  # Alias for demote -e Local
```

### Workspace Creation

```bash
./cli workspace:create q3-2025 --empty  # Create new empty quarter workspace
./cli workspace:create q3-2025          # Copy from current quarter
./cli workspace:create q3-2025 --from q2-2025  # Copy from specific quarter
```

### Branching and Merging

```bash
./cli workspace:branch q3-2025          # Create new workspace from current (with own ID)
./cli workspace:branch q3-2025 --from q2-2025  # Branch from specific quarter
./cli workspace:lineage                 # Show workspace inheritance tree
./cli workspace:diff q1-2025 q2-2025    # Compare two workspaces
./cli workspace:merge -q q3-2025        # Merge parent changes into child
```

### Secrets Management

```bash
./cli secrets:list -e local             # List secrets from .env file
./cli secrets:list -e integration       # List GitHub secrets for Integration
./cli secrets:get NAME -e local         # Get secret info
./cli secrets:set NAME value -e local   # Set a secret
./cli secrets:init -e production        # Interactive setup for Production
./cli secrets:sync                      # Sync to GitHub Actions
```

### Variables Management

```bash
./cli variables:list -e local           # List variables from .env file
./cli variables:get NAME -e local       # Get a variable
./cli variables:set NAME value -e local # Set a variable
```

### System Control

```bash
./cli system:start                      # Start On-Premises container
./cli system:start --logs               # Start and follow logs
./cli system:stop                       # Stop container
./cli system:restart                    # Restart container
./cli system:logs -f                    # Follow logs
```

### Admin Operations

```bash
./cli admin:generate-key                # Generate bcrypt API key
./cli admin:generate-key my-secret-key  # Generate from specific key
```

## Unified Workspace Architecture

### Single Workspace Per Quarter

The project uses a unified structure where each quarter contains a single `workspace.dsl` that composes all domains and perspectives:

```
workspaces/
├── q2-2025/                      # Quarter workspace
│   ├── workspace.dsl             # Single entry point
│   ├── model/                    # All models in one place
│   ├── views/                    # All views
│   └── styles/                   # Shared styling
└── shared/
    └── registry.yaml             # Quarter metadata (current_quarter, workspace IDs)
```

### Workspace ID Strategy

Two approaches are supported:

**Per-Quarter IDs (new):** Each quarter has its own workspace ID with lineage tracking
- Created with `./cli workspace:branch`
- Enables parent-child relationships and one-way merge
- URLs: `/workspace/12`, `/workspace/13`

**Legacy Branch-Based:** Single workspace ID with Structurizr branches
- Single workspace ID (e.g., `6`) for the entire project
- Structurizr branches for quarterly isolation
- URLs: `/workspace/6/q2-2025`, `/workspace/6/q1-2025`

### Tagging Strategy

Elements are tagged to enable filtered perspective views:

| Tag Category | Tags | Purpose |
|--------------|------|---------|
| Domain | `Platform`, `Orders`, `Notifications` | Filter by business domain |
| Visibility | `Core`, `Supporting`, `Generic` | Executive view filtering |
| Security | `PII`, `Financial`, `Public`, `PCI` | Security perspective |
| Technical | `Infrastructure`, `Application`, `Data` | Technical perspective |

Example in DSL:
```dsl
softwareSystem "Order Service" {
    tags "Orders" "Core" "Financial"
}
```

Views can then filter by tags:
```dsl
systemLandscape "Executive-View" {
    include element.tag==Core
}
```

### Adding a New Domain

1. Create model file:
   ```bash
   touch workspaces/{workspace}/model/domains/inventory/system.dsl
   ```

2. Add include to main workspace:
   ```dsl
   # In workspace.dsl
   !include model/domains/inventory/system.dsl
   ```

3. Create domain view:
   ```bash
   touch workspaces/{workspace}/views/domains/inventory.dsl
   ```

4. Update registry:
   ```yaml
   # In shared/registry.yaml
   domains:
     inventory:
       name: Inventory
       description: Warehouse and stock management
       owner: Warehouse Team
       tags: [Inventory, Core]
   ```

## Workflows

### CI - Validate Workspaces (ci.yml)

- **Trigger**: Push to any branch, PR to main/develop
- **Action**: Validates DSL files and runs CLI tests
- **Runner**: `self-hosted, structurizr, nerdctl`
- **Jobs**: Validates workspaces in the current quarter (set in `registry.yaml`)

### Promote Workspaces (promote.yml)

Unified promotion workflow for all environments.

| Trigger | Environment | Confirmation |
|---------|-------------|--------------|
| Push to `develop` | Integration | None (auto) |
| Manual dispatch | Integration | None |
| Manual dispatch | Production | Must type "PRODUCTION" |

- **Action**: Validates then promotes to Structurizr On-Premises
- **Branch**: Uses quarterly branches for isolation

## Quarterly Architecture Management

### Timeline-Based Structure

```
workspaces/
├── q1-2025/                      # Past quarter (archived)
├── q2-2025/                      # Current quarter (active)
└── q3-2025/                      # Future quarter (planning)
```

The active quarter is configured in `registry.yaml`:
```yaml
current_quarter: q2-2025
```

- **Past quarter** = Archive (e.g., `q1-2025/` when in Q2)
- **Current quarter** = Active development (set in `current_quarter`)
- **Future quarter** = Planning (e.g., `q3-2025/` when in Q2)

### Quarterly Workflow

#### Normal Development

1. Work in the quarter specified by `current_quarter` in `registry.yaml`
2. Push to `develop` → auto-promotes to Integration
3. Merge to `main` → manual promote to Production

#### Start Planning Next Quarter

```bash
./cli workspace:create q3-2025            # Create empty workspace directory
./cli workspace:branch q3-2025            # Or create with own workspace ID (recommended)
# Edit workspaces/q3-2025/ for future changes
```

#### End of Quarter Rollover

```bash
git tag q2-2025-final -m "Quarterly snapshot"  # Create git tag for milestone
# Edit registry.yaml: current_quarter: q3-2025
./cli workspace:promote                        # Deploy new quarter
```

#### Deploy Historical Quarter

```bash
./cli workspace:promote -q q1-2025 -e integration
# Deploys Q1 architecture for review
```

## Local Development

### Validate Workspace

```bash
./cli workspace:validate                  # Validate current quarter
./cli workspace:validate -q q2-2025       # Validate specific quarter
```

### Promote to Local On-Premises

```bash
./cli workspace:promote                   # Promote to local
./cli workspace:promote --dry-run         # Preview what will be promoted
```

### View Logs

```bash
./cli system:logs                         # View recent logs
./cli system:logs -f                      # Follow logs
```

### Restart Services

```bash
./cli system:restart                      # Restart On-Premises
```

### Stop Services

```bash
./cli system:stop                         # Stop On-Premises
```

## Troubleshooting

### Container won't start

```bash
# Check container status
./cli system:logs

# Or manually
cd containers && nerdctl compose ps
nerdctl compose logs structurizr-onpremises
```

### Validation fails

```bash
# Run validation with verbose output (replace {workspace} with actual quarter)
nerdctl run --rm -v "$PWD:/workspaces:ro" \
  structurizr/cli:latest validate \
  -workspace /workspaces/workspaces/{workspace}/workspace.dsl
```

### Promotion fails

1. Verify On-Premises is running: `curl http://localhost:20000/health`
2. Check workspace credentials: `./cli secrets:list -e local`
3. Verify workspace ID exists in On-Premises

### Runner not picking up jobs

1. Check runner status: `./svc.sh status`
2. Verify labels match: `self-hosted, structurizr, nerdctl`
3. Check GitHub runner page for errors

### List available quarters

```bash
./cli workspace:list
```

## References

- [Structurizr Lite](https://docs.structurizr.com/lite)
- [Structurizr On-Premises](https://docs.structurizr.com/onpremises)
- [Structurizr CLI](https://docs.structurizr.com/cli)
- [Structurizr DSL](https://docs.structurizr.com/dsl)
- [GitHub Actions Self-Hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
