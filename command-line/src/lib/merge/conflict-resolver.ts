/**
 * Conflict Resolver
 *
 * Interactive conflict resolution for workspace merges.
 */

import * as readline from 'readline';
import type { MergeConflict } from '../../types';

/**
 * Format a value for display
 */
function formatValue(value: unknown, maxLength: number = 80): string {
  if (value === null || value === undefined) {
    return '(deleted)';
  }
  const str = JSON.stringify(value, null, 2);
  if (str.length > maxLength) {
    return str.substring(0, maxLength - 3) + '...';
  }
  return str;
}

/**
 * Display conflict details
 */
export function displayConflict(conflict: MergeConflict, index: number, total: number): void {
  console.log('');
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`Conflict ${index + 1} of ${total}: ${conflict.type}`);
  console.log(`Path: ${conflict.path}`);
  console.log(`Description: ${conflict.description}`);
  console.log(`───────────────────────────────────────────────────────────────`);
  console.log('Base (common ancestor):');
  console.log(formatValue(conflict.base));
  console.log('───────────────────────────────────────────────────────────────');
  console.log('Ours (child workspace):');
  console.log(formatValue(conflict.ours));
  console.log('───────────────────────────────────────────────────────────────');
  console.log('Theirs (parent workspace):');
  console.log(formatValue(conflict.theirs));
  console.log(`═══════════════════════════════════════════════════════════════`);
}

/**
 * Prompt for a single conflict resolution
 */
async function promptForResolution(): Promise<'ours' | 'theirs' | 'skip'> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Keep [o]urs, [t]heirs, or [s]kip? ', (answer) => {
      rl.close();
      const lower = answer.toLowerCase().trim();
      if (lower === 'o' || lower === 'ours') {
        resolve('ours');
      } else if (lower === 't' || lower === 'theirs') {
        resolve('theirs');
      } else {
        resolve('skip');
      }
    });
  });
}

/**
 * Resolve conflicts interactively
 *
 * @param conflicts - Array of conflicts to resolve
 * @returns Map of conflict to resolution choice
 */
export async function resolveConflictsInteractively(
  conflicts: MergeConflict[]
): Promise<Map<MergeConflict, 'ours' | 'theirs'>> {
  const resolutions = new Map<MergeConflict, 'ours' | 'theirs'>();

  if (conflicts.length === 0) {
    console.log('No conflicts to resolve.');
    return resolutions;
  }

  console.log('');
  console.log(`Found ${conflicts.length} conflict(s) to resolve.`);
  console.log('For each conflict, choose:');
  console.log('  [o]urs   - Keep the child workspace version');
  console.log('  [t]heirs - Use the parent workspace version');
  console.log('  [s]kip   - Skip this conflict (defaults to ours)');
  console.log('');

  for (let i = 0; i < conflicts.length; i++) {
    const conflict = conflicts[i];
    displayConflict(conflict, i, conflicts.length);

    const resolution = await promptForResolution();

    if (resolution === 'ours' || resolution === 'theirs') {
      resolutions.set(conflict, resolution);
      console.log(`  → Resolved: ${resolution}`);
    } else {
      resolutions.set(conflict, 'ours'); // Default to ours
      console.log(`  → Skipped (defaulting to ours)`);
    }
  }

  console.log('');
  console.log(`All ${conflicts.length} conflicts resolved.`);

  return resolutions;
}

/**
 * Summarize conflicts
 */
export function summarizeConflicts(conflicts: MergeConflict[]): string {
  const lines: string[] = [];

  const byType: Record<string, MergeConflict[]> = {};
  for (const conflict of conflicts) {
    if (!byType[conflict.type]) {
      byType[conflict.type] = [];
    }
    byType[conflict.type].push(conflict);
  }

  lines.push(`Total conflicts: ${conflicts.length}`);
  lines.push('');
  lines.push('By type:');
  for (const [type, typeConflicts] of Object.entries(byType)) {
    lines.push(`  ${type}: ${typeConflicts.length}`);
    for (const conflict of typeConflicts) {
      lines.push(`    - ${conflict.path}`);
    }
  }

  return lines.join('\n');
}

/**
 * Auto-resolve conflicts using a strategy
 */
export function autoResolveConflicts(
  conflicts: MergeConflict[],
  strategy: 'ours' | 'theirs'
): Map<MergeConflict, 'ours' | 'theirs'> {
  const resolutions = new Map<MergeConflict, 'ours' | 'theirs'>();

  for (const conflict of conflicts) {
    resolutions.set(conflict, strategy);
  }

  return resolutions;
}
