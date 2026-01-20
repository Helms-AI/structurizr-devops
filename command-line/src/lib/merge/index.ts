/**
 * Workspace Merge Library
 *
 * Provides diff, merge, and conflict resolution for Structurizr workspaces.
 */

export {
  diffWorkspaces,
  isDiffEmpty,
  formatDiff,
  hashWorkspace,
} from './workspace-diff';

export {
  mergeWorkspaces,
  applyConflictResolutions,
} from './workspace-merge';

export {
  resolveConflictsInteractively,
  summarizeConflicts,
  autoResolveConflicts,
  displayConflict,
} from './conflict-resolver';
