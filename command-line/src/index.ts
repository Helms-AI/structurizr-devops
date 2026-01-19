#!/usr/bin/env node

import { Command } from 'commander';
import { registerValidateCommand } from './commands/validate';
import { registerPromoteCommand } from './commands/promote';
import { registerWorkspaceInitCommand } from './commands/workspace-init';
import { registerWorkspaceCreateCommand } from './commands/workspace-create';
import { registerQuarterRolloverCommand } from './commands/quarter-rollover';
import { registerQuarterSnapshotCommand } from './commands/quarter-snapshot';
import { registerAdminGenerateKeyCommand } from './commands/admin-generate-key';
import { registerListCommand } from './commands/list';
import { registerSecretsListCommand } from './commands/secrets-list';
import { registerSecretsGetCommand } from './commands/secrets-get';
import { registerSecretsSetCommand } from './commands/secrets-set';
import { registerSecretsSyncCommand } from './commands/secrets-sync';
import { registerSecretsInitCommand } from './commands/secrets-init';
import { registerVariablesListCommand } from './commands/variables-list';
import { registerVariablesGetCommand } from './commands/variables-get';
import { registerVariablesSetCommand } from './commands/variables-set';

const program = new Command();

program
  .name('structurizr-devops')
  .description('CLI tool for managing Structurizr DevOps operations')
  .version('2.0.0');

// Core commands
registerValidateCommand(program);
registerPromoteCommand(program);
registerListCommand(program);

// Workspace commands
registerWorkspaceInitCommand(program);
registerWorkspaceCreateCommand(program);

// Quarter commands
registerQuarterRolloverCommand(program);
registerQuarterSnapshotCommand(program);

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

program.parse(process.argv);
