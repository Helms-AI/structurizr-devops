#!/usr/bin/env node

import { Command } from 'commander';
import { registerValidateCommand } from './commands/workspace-validate';
import { registerPromoteCommand } from './commands/workspace-promote';
import { registerWorkspaceCreateCommand } from './commands/workspace-create';
import { registerWorkspaceDemoteCommand } from './commands/workspace-demote';
import { registerWorkspaceDeleteCommand } from './commands/workspace-delete';
import { registerWorkspaceBranchCommand } from './commands/workspace-branch';
import { registerWorkspaceLineageCommand } from './commands/workspace-lineage';
import { registerWorkspaceDiffCommand } from './commands/workspace-diff';
import { registerWorkspaceMergeCommand } from './commands/workspace-merge';
import { registerAdminGenerateKeyCommand } from './commands/admin-generate-key';
import { registerListCommand } from './commands/workspace-list';
import { registerSecretsListCommand } from './commands/secrets-list';
import { registerSecretsGetCommand } from './commands/secrets-get';
import { registerSecretsSetCommand } from './commands/secrets-set';
import { registerSecretsSyncCommand } from './commands/secrets-sync';
import { registerSecretsInitCommand } from './commands/secrets-init';
import { registerVariablesListCommand } from './commands/variables-list';
import { registerVariablesGetCommand } from './commands/variables-get';
import { registerVariablesSetCommand } from './commands/variables-set';
import { registerSystemStartCommand } from './commands/system-start';
import { registerSystemStopCommand } from './commands/system-stop';
import { registerSystemRestartCommand } from './commands/system-restart';
import { registerSystemLogsCommand } from './commands/system-logs';

const program = new Command();

program
  .name('structurizr-devops')
  .description('CLI tool for managing Structurizr DevOps operations')
  .version('2.0.0');

// Workspace commands
registerListCommand(program);
registerValidateCommand(program);
registerPromoteCommand(program);
registerWorkspaceCreateCommand(program);
registerWorkspaceDemoteCommand(program);
registerWorkspaceDeleteCommand(program);
registerWorkspaceBranchCommand(program);
registerWorkspaceLineageCommand(program);
registerWorkspaceDiffCommand(program);
registerWorkspaceMergeCommand(program);

// Secrets commands
registerSecretsListCommand(program);
registerSecretsGetCommand(program);
registerSecretsSetCommand(program);
registerSecretsSyncCommand(program);
registerSecretsInitCommand(program);

// Variables commands
registerVariablesListCommand(program);
registerVariablesGetCommand(program);
registerVariablesSetCommand(program);

// Admin commands
registerAdminGenerateKeyCommand(program);

// System commands
registerSystemStartCommand(program);
registerSystemStopCommand(program);
registerSystemRestartCommand(program);
registerSystemLogsCommand(program);

program.parse(process.argv);
