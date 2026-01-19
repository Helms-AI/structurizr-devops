# Structurizr DevOps CLI

A unified CLI tool for managing Structurizr DevOps operations including workspace creation, promotion, validation, and quarterly management.

## Installation

```bash
cd command-line
npm install
npm run build
```

## Usage

From the project root, use the `./cli` wrapper (auto-builds on first run):

```bash
./cli <command> [options]
```

Or run directly from the command-line directory:

```bash
cd command-line
npx ./cli <command> [options]
```

## Commands

### validate

Validate domain workspace(s) DSL files.

```bash
# Validate all domains
./cli validate

# Validate specific domain
./cli validate platform
```

### promote

Promote a domain to Structurizr On-Premises.

```bash
# Basic promotion
./cli promote platform

# With validation first
./cli promote platform --validate-ssl

# With explicit workspace ID
./cli promote platform --workspace-id 1
```

**Environment Variables:**
- `STRUCTURIZR_URL` - On-Premises API URL
- `STRUCTURIZR_WORKSPACE_ID` or `STRUCTURIZR_{DOMAIN}_WORKSPACE_ID`
- `STRUCTURIZR_WORKSPACE_KEY` or `STRUCTURIZR_{DOMAIN}_WORKSPACE_KEY`
- `STRUCTURIZR_WORKSPACE_SECRET` or `STRUCTURIZR_{DOMAIN}_WORKSPACE_SECRET`

### workspace:init

Initialize a new workspace in Structurizr On-Premises via the Admin API.

```bash
# Create workspace
./cli workspace:init platform

# Create and save credentials to .env
./cli workspace:init platform --save
```

**Environment Variables:**
- `STRUCTURIZR_URL` - On-Premises URL
- `STRUCTURIZR_ADMIN_API_KEY` - Admin API key (required)

### workspace:create

Scaffold a new domain workspace with starter files.

```bash
# Basic creation
./cli workspace:create inventory

# With metadata
./cli workspace:create inventory --owner "Warehouse Team" --description "Inventory management"
```

### quarter:rollover

Manage quarterly git branch transitions.

```bash
./cli quarter:rollover q1-2025 q2-2025
```

This command:
1. Creates a final tag for the previous quarter
2. Merges the previous quarter release branch to main
3. Creates a new release branch for the new quarter
4. Optionally merges any existing planning branch

### quarter:snapshot

Create Structurizr workspace branch snapshots for all domains.

```bash
# Create snapshots
./cli quarter:snapshot q1-2025

# Dry run
./cli quarter:snapshot q1-2025 --dry-run
```

### admin:generate-key

Generate a bcrypt API key for the Admin API.

```bash
# Generate random key
./cli admin:generate-key

# Hash a specific key
./cli admin:generate-key my-secret-key
```

### list

List all available domains.

```bash
# Basic list
./cli list

# Detailed view
./cli list --verbose
```

## Configuration

The CLI loads configuration from `containers/.env` relative to the project root. You can override settings with environment variables.

### Required Environment Variables

For promotion operations:
```bash
export STRUCTURIZR_URL=http://localhost:20000/api
export STRUCTURIZR_WORKSPACE_ID=1
export STRUCTURIZR_WORKSPACE_KEY=your-key
export STRUCTURIZR_WORKSPACE_SECRET=your-secret
```

For Admin API operations:
```bash
export STRUCTURIZR_ADMIN_API_KEY=your-admin-key
```

### Domain-Specific Credentials

You can configure credentials per-domain:
```bash
export STRUCTURIZR_PLATFORM_WORKSPACE_ID=1
export STRUCTURIZR_PLATFORM_WORKSPACE_KEY=key1
export STRUCTURIZR_PLATFORM_WORKSPACE_SECRET=secret1

export STRUCTURIZR_ORDERS_WORKSPACE_ID=2
export STRUCTURIZR_ORDERS_WORKSPACE_KEY=key2
export STRUCTURIZR_ORDERS_WORKSPACE_SECRET=secret2
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Clean
npm run clean
```

## Requirements

- Node.js >= 18.0.0
- nerdctl or docker (for container operations)
- Git (for quarterly operations)
