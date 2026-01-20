/**
 * Workspace Merge Algorithm
 *
 * Performs three-way merge of Structurizr workspaces.
 */

import type {
  StructurizrWorkspace,
  MergeResult,
  MergeConflict,
  MergeStrategy,
} from '../../types';

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Get element ID for matching
 */
function getElementId(element: Record<string, unknown>): string {
  return (element.id as string) || (element.name as string) || '';
}

/**
 * Check if two values are equal
 */
function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Merge two arrays of elements using three-way merge
 */
function mergeElementArrays(
  basePath: string,
  base: Record<string, unknown>[],
  ours: Record<string, unknown>[],
  theirs: Record<string, unknown>[],
  strategy: MergeStrategy,
  conflicts: MergeConflict[]
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  // Create maps for quick lookup
  const baseMap = new Map<string, Record<string, unknown>>();
  const oursMap = new Map<string, Record<string, unknown>>();
  const theirsMap = new Map<string, Record<string, unknown>>();

  for (const el of base) baseMap.set(getElementId(el), el);
  for (const el of ours) oursMap.set(getElementId(el), el);
  for (const el of theirs) theirsMap.set(getElementId(el), el);

  // Collect all unique IDs
  const allIds = new Set([...baseMap.keys(), ...oursMap.keys(), ...theirsMap.keys()]);

  for (const id of allIds) {
    const baseEl = baseMap.get(id);
    const oursEl = oursMap.get(id);
    const theirsEl = theirsMap.get(id);

    // Case 1: Element only in ours (we added it)
    if (oursEl && !baseEl && !theirsEl) {
      result.push(deepClone(oursEl));
      continue;
    }

    // Case 2: Element only in theirs (they added it)
    if (theirsEl && !baseEl && !oursEl) {
      result.push(deepClone(theirsEl));
      continue;
    }

    // Case 3: Element in base but not in ours (we deleted it)
    if (baseEl && !oursEl && theirsEl) {
      // If theirs is same as base, our deletion wins
      if (isEqual(baseEl, theirsEl)) {
        continue; // Keep deleted
      }
      // They modified it after we deleted - conflict
      if (strategy === 'ours') {
        continue; // Keep deleted
      } else if (strategy === 'theirs') {
        result.push(deepClone(theirsEl));
      } else {
        conflicts.push({
          type: 'element',
          path: `${basePath}/${id}`,
          description: `Element deleted in ours but modified in theirs`,
          base: baseEl,
          ours: null,
          theirs: theirsEl,
        });
        result.push(deepClone(theirsEl)); // Default to theirs for safety
      }
      continue;
    }

    // Case 4: Element in base but not in theirs (they deleted it)
    if (baseEl && oursEl && !theirsEl) {
      // If ours is same as base, their deletion wins
      if (isEqual(baseEl, oursEl)) {
        continue; // Keep deleted
      }
      // We modified it after they deleted - conflict
      if (strategy === 'ours') {
        result.push(deepClone(oursEl));
      } else if (strategy === 'theirs') {
        continue; // Keep deleted
      } else {
        conflicts.push({
          type: 'element',
          path: `${basePath}/${id}`,
          description: `Element modified in ours but deleted in theirs`,
          base: baseEl,
          ours: oursEl,
          theirs: null,
        });
        result.push(deepClone(oursEl)); // Default to ours for safety
      }
      continue;
    }

    // Case 5: Element deleted in both
    if (baseEl && !oursEl && !theirsEl) {
      continue; // Both deleted
    }

    // Case 6: Element exists in all three
    if (baseEl && oursEl && theirsEl) {
      // If ours == theirs, no conflict
      if (isEqual(oursEl, theirsEl)) {
        result.push(deepClone(oursEl));
        continue;
      }
      // If ours == base, theirs wins (they changed, we didn't)
      if (isEqual(oursEl, baseEl)) {
        result.push(deepClone(theirsEl));
        continue;
      }
      // If theirs == base, ours wins (we changed, they didn't)
      if (isEqual(theirsEl, baseEl)) {
        result.push(deepClone(oursEl));
        continue;
      }
      // Both changed differently - conflict
      if (strategy === 'ours') {
        result.push(deepClone(oursEl));
      } else if (strategy === 'theirs') {
        result.push(deepClone(theirsEl));
      } else {
        conflicts.push({
          type: 'element',
          path: `${basePath}/${id}`,
          description: `Element modified differently in both branches`,
          base: baseEl,
          ours: oursEl,
          theirs: theirsEl,
        });
        result.push(deepClone(oursEl)); // Default to ours
      }
      continue;
    }

    // Case 7: Both added same element (not in base)
    if (!baseEl && oursEl && theirsEl) {
      if (isEqual(oursEl, theirsEl)) {
        result.push(deepClone(oursEl));
      } else if (strategy === 'ours') {
        result.push(deepClone(oursEl));
      } else if (strategy === 'theirs') {
        result.push(deepClone(theirsEl));
      } else {
        conflicts.push({
          type: 'element',
          path: `${basePath}/${id}`,
          description: `Same element added differently in both branches`,
          base: null,
          ours: oursEl,
          theirs: theirsEl,
        });
        result.push(deepClone(oursEl)); // Default to ours
      }
    }
  }

  return result;
}

/**
 * Get elements from a model section
 */
function getModelElements(model: Record<string, unknown> | undefined, type: string): Record<string, unknown>[] {
  if (!model) return [];
  const elements = model[type] as Record<string, unknown>[] | undefined;
  return Array.isArray(elements) ? elements : [];
}

/**
 * Get views from a views section
 */
function getViews(views: Record<string, unknown> | undefined, type: string): Record<string, unknown>[] {
  if (!views) return [];
  const viewList = views[type] as Record<string, unknown>[] | undefined;
  return Array.isArray(viewList) ? viewList : [];
}

/**
 * Merge model sections
 */
function mergeModels(
  base: Record<string, unknown> | undefined,
  ours: Record<string, unknown> | undefined,
  theirs: Record<string, unknown> | undefined,
  strategy: MergeStrategy,
  conflicts: MergeConflict[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Merge people
  result.people = mergeElementArrays(
    'model/people',
    getModelElements(base, 'people'),
    getModelElements(ours, 'people'),
    getModelElements(theirs, 'people'),
    strategy,
    conflicts
  );

  // Merge software systems
  result.softwareSystems = mergeElementArrays(
    'model/softwareSystems',
    getModelElements(base, 'softwareSystems'),
    getModelElements(ours, 'softwareSystems'),
    getModelElements(theirs, 'softwareSystems'),
    strategy,
    conflicts
  );

  // Merge deployment nodes
  result.deploymentNodes = mergeElementArrays(
    'model/deploymentNodes',
    getModelElements(base, 'deploymentNodes'),
    getModelElements(ours, 'deploymentNodes'),
    getModelElements(theirs, 'deploymentNodes'),
    strategy,
    conflicts
  );

  return result;
}

/**
 * Merge views sections
 */
function mergeViews(
  base: Record<string, unknown> | undefined,
  ours: Record<string, unknown> | undefined,
  theirs: Record<string, unknown> | undefined,
  strategy: MergeStrategy,
  conflicts: MergeConflict[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const viewTypes = [
    'systemLandscapeViews',
    'systemContextViews',
    'containerViews',
    'componentViews',
    'dynamicViews',
    'deploymentViews',
    'filteredViews',
    'customViews',
  ];

  for (const viewType of viewTypes) {
    result[viewType] = mergeElementArrays(
      `views/${viewType}`,
      getViews(base, viewType),
      getViews(ours, viewType),
      getViews(theirs, viewType),
      strategy,
      conflicts
    );
  }

  // Preserve configuration if present
  if (ours?.configuration || theirs?.configuration || base?.configuration) {
    result.configuration = ours?.configuration || theirs?.configuration || base?.configuration;
  }

  return result;
}

/**
 * Merge configuration/styles
 */
function mergeConfiguration(
  base: Record<string, unknown> | undefined,
  ours: Record<string, unknown> | undefined,
  theirs: Record<string, unknown> | undefined,
  strategy: MergeStrategy,
  conflicts: MergeConflict[]
): Record<string, unknown> {
  // For now, use simple preference-based merge for configuration
  // Styles are less likely to conflict in practice
  if (strategy === 'ours') {
    return ours ? deepClone(ours) : (theirs ? deepClone(theirs) : {});
  } else if (strategy === 'theirs') {
    return theirs ? deepClone(theirs) : (ours ? deepClone(ours) : {});
  }

  // Recursive merge - prefer ours for conflicts
  const result: Record<string, unknown> = {};

  const allKeys = new Set([
    ...Object.keys(base || {}),
    ...Object.keys(ours || {}),
    ...Object.keys(theirs || {}),
  ]);

  for (const key of allKeys) {
    const baseVal = base?.[key];
    const oursVal = ours?.[key];
    const theirsVal = theirs?.[key];

    if (isEqual(oursVal, theirsVal)) {
      result[key] = deepClone(oursVal ?? theirsVal);
    } else if (isEqual(oursVal, baseVal)) {
      result[key] = deepClone(theirsVal);
    } else if (isEqual(theirsVal, baseVal)) {
      result[key] = deepClone(oursVal);
    } else {
      // Both changed - conflict, prefer ours
      if (oursVal !== undefined && theirsVal !== undefined) {
        conflicts.push({
          type: 'style',
          path: `configuration/${key}`,
          description: `Configuration key '${key}' modified differently in both branches`,
          base: baseVal,
          ours: oursVal,
          theirs: theirsVal,
        });
      }
      result[key] = deepClone(oursVal ?? theirsVal);
    }
  }

  return result;
}

/**
 * Perform three-way merge of Structurizr workspaces
 *
 * @param base - Common ancestor workspace (parent at branch time)
 * @param ours - Child workspace current state
 * @param theirs - Parent workspace current state
 * @param strategy - Merge strategy for conflict resolution
 * @returns Merge result with merged workspace and any conflicts
 */
export function mergeWorkspaces(
  base: StructurizrWorkspace,
  ours: StructurizrWorkspace,
  theirs: StructurizrWorkspace,
  strategy: MergeStrategy = 'recursive'
): MergeResult {
  const conflicts: MergeConflict[] = [];

  // Start with a clone of ours as the base
  const merged: StructurizrWorkspace = deepClone(ours);

  // Merge model
  merged.model = mergeModels(
    base.model as Record<string, unknown> | undefined,
    ours.model as Record<string, unknown> | undefined,
    theirs.model as Record<string, unknown> | undefined,
    strategy,
    conflicts
  );

  // Merge views
  merged.views = mergeViews(
    base.views as Record<string, unknown> | undefined,
    ours.views as Record<string, unknown> | undefined,
    theirs.views as Record<string, unknown> | undefined,
    strategy,
    conflicts
  );

  // Merge configuration
  merged.configuration = mergeConfiguration(
    base.configuration as Record<string, unknown> | undefined,
    ours.configuration as Record<string, unknown> | undefined,
    theirs.configuration as Record<string, unknown> | undefined,
    strategy,
    conflicts
  );

  // Merge documentation (simple array merge)
  const baseDocs = (base.documentation as Record<string, unknown>)?.sections as Record<string, unknown>[] || [];
  const oursDocs = (ours.documentation as Record<string, unknown>)?.sections as Record<string, unknown>[] || [];
  const theirsDocs = (theirs.documentation as Record<string, unknown>)?.sections as Record<string, unknown>[] || [];

  const mergedDocs = mergeElementArrays(
    'documentation/sections',
    baseDocs,
    oursDocs,
    theirsDocs,
    strategy,
    conflicts
  );

  if (mergedDocs.length > 0) {
    merged.documentation = { sections: mergedDocs };
  }

  // Calculate stats
  const stats = {
    added: 0,
    modified: 0,
    removed: 0,
    conflictsResolved: conflicts.length,
  };

  // TODO: Calculate actual stats by comparing merged to ours

  return {
    success: true,
    merged,
    conflicts,
    stats,
  };
}

/**
 * Apply conflict resolutions to a merge result
 */
export function applyConflictResolutions(
  mergeResult: MergeResult,
  resolutions: Map<MergeConflict, 'ours' | 'theirs'>
): MergeResult {
  // For now, conflicts are resolved during merge based on strategy
  // This function would be used for interactive resolution
  return mergeResult;
}
