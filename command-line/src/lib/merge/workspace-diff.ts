/**
 * Workspace Diff Algorithm
 *
 * Compares two Structurizr workspaces and generates a detailed diff.
 */

import type { StructurizrWorkspace, WorkspaceDiff, ElementDiff } from '../../types';
import * as crypto from 'crypto';

/**
 * Generate a hash for a workspace JSON for merge base tracking
 */
export function hashWorkspace(workspace: StructurizrWorkspace): string {
  const normalized = JSON.stringify(workspace, Object.keys(workspace).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

/**
 * Get elements from a model section by type
 */
function getModelElements(model: Record<string, unknown> | undefined, type: string): Record<string, unknown>[] {
  if (!model) return [];
  const elements = model[type] as Record<string, unknown>[] | undefined;
  return Array.isArray(elements) ? elements : [];
}

/**
 * Get views from a views section by type
 */
function getViews(views: Record<string, unknown> | undefined, type: string): Record<string, unknown>[] {
  if (!views) return [];
  const viewList = views[type] as Record<string, unknown>[] | undefined;
  return Array.isArray(viewList) ? viewList : [];
}

/**
 * Get the ID of an element (for comparison)
 */
function getElementId(element: Record<string, unknown>): string {
  return (element.id as string) || (element.name as string) || JSON.stringify(element);
}

/**
 * Compare two arrays of elements and return diffs
 */
function diffElements(
  sourcePath: string,
  sourceElements: Record<string, unknown>[],
  targetElements: Record<string, unknown>[]
): ElementDiff[] {
  const diffs: ElementDiff[] = [];

  const sourceMap = new Map<string, Record<string, unknown>>();
  const targetMap = new Map<string, Record<string, unknown>>();

  for (const el of sourceElements) {
    sourceMap.set(getElementId(el), el);
  }
  for (const el of targetElements) {
    targetMap.set(getElementId(el), el);
  }

  // Find added elements (in target but not source)
  for (const [id, el] of targetMap) {
    if (!sourceMap.has(id)) {
      diffs.push({
        type: 'added',
        path: `${sourcePath}/${id}`,
        after: el,
      });
    }
  }

  // Find removed elements (in source but not target)
  for (const [id, el] of sourceMap) {
    if (!targetMap.has(id)) {
      diffs.push({
        type: 'removed',
        path: `${sourcePath}/${id}`,
        before: el,
      });
    }
  }

  // Find modified elements (in both but different)
  for (const [id, sourceEl] of sourceMap) {
    const targetEl = targetMap.get(id);
    if (targetEl) {
      const sourceJson = JSON.stringify(sourceEl, Object.keys(sourceEl).sort());
      const targetJson = JSON.stringify(targetEl, Object.keys(targetEl).sort());
      if (sourceJson !== targetJson) {
        diffs.push({
          type: 'modified',
          path: `${sourcePath}/${id}`,
          before: sourceEl,
          after: targetEl,
        });
      }
    }
  }

  return diffs;
}

/**
 * Get relationships from model
 */
function getRelationships(model: Record<string, unknown> | undefined): Record<string, unknown>[] {
  if (!model) return [];

  const relationships: Record<string, unknown>[] = [];

  // Collect relationships from all software systems
  const systems = getModelElements(model, 'softwareSystems');
  for (const system of systems) {
    const systemRels = system.relationships as Record<string, unknown>[] | undefined;
    if (Array.isArray(systemRels)) {
      relationships.push(...systemRels);
    }

    // Also check containers
    const containers = system.containers as Record<string, unknown>[] | undefined;
    if (Array.isArray(containers)) {
      for (const container of containers) {
        const containerRels = container.relationships as Record<string, unknown>[] | undefined;
        if (Array.isArray(containerRels)) {
          relationships.push(...containerRels);
        }
      }
    }
  }

  // Collect relationships from people
  const people = getModelElements(model, 'people');
  for (const person of people) {
    const personRels = person.relationships as Record<string, unknown>[] | undefined;
    if (Array.isArray(personRels)) {
      relationships.push(...personRels);
    }
  }

  return relationships;
}

/**
 * Get styles from configuration
 */
function getStyles(config: Record<string, unknown> | undefined): Record<string, unknown>[] {
  if (!config) return [];
  const styles = config.styles as Record<string, unknown> | undefined;
  if (!styles) return [];

  const result: Record<string, unknown>[] = [];

  const elements = styles.elements as Record<string, unknown>[] | undefined;
  if (Array.isArray(elements)) {
    result.push(...elements.map((e) => ({ ...e, _type: 'element' })));
  }

  const relationships = styles.relationships as Record<string, unknown>[] | undefined;
  if (Array.isArray(relationships)) {
    result.push(...relationships.map((r) => ({ ...r, _type: 'relationship' })));
  }

  return result;
}

/**
 * Get documentation sections
 */
function getDocumentation(doc: Record<string, unknown> | undefined): Record<string, unknown>[] {
  if (!doc) return [];
  const sections = doc.sections as Record<string, unknown>[] | undefined;
  return Array.isArray(sections) ? sections : [];
}

/**
 * Compare two Structurizr workspaces and return a detailed diff
 */
export function diffWorkspaces(
  source: StructurizrWorkspace,
  target: StructurizrWorkspace
): WorkspaceDiff {
  const sourceModel = source.model as Record<string, unknown> | undefined;
  const targetModel = target.model as Record<string, unknown> | undefined;
  const sourceViews = source.views as Record<string, unknown> | undefined;
  const targetViews = target.views as Record<string, unknown> | undefined;
  const sourceConfig = source.configuration as Record<string, unknown> | undefined;
  const targetConfig = target.configuration as Record<string, unknown> | undefined;
  const sourceDoc = source.documentation as Record<string, unknown> | undefined;
  const targetDoc = target.documentation as Record<string, unknown> | undefined;

  // Diff model elements
  const peopleDiffs = diffElements(
    'model/people',
    getModelElements(sourceModel, 'people'),
    getModelElements(targetModel, 'people')
  );

  const systemsDiffs = diffElements(
    'model/softwareSystems',
    getModelElements(sourceModel, 'softwareSystems'),
    getModelElements(targetModel, 'softwareSystems')
  );

  const deploymentDiffs = diffElements(
    'model/deploymentNodes',
    getModelElements(sourceModel, 'deploymentNodes'),
    getModelElements(targetModel, 'deploymentNodes')
  );

  // Diff relationships
  const relationshipDiffs = diffElements(
    'relationships',
    getRelationships(sourceModel),
    getRelationships(targetModel)
  );

  // Diff views
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

  const viewDiffs: Record<string, ElementDiff[]> = {};
  for (const viewType of viewTypes) {
    const key = viewType.replace('Views', '');
    viewDiffs[key] = diffElements(
      `views/${viewType}`,
      getViews(sourceViews, viewType),
      getViews(targetViews, viewType)
    );
  }

  // Diff styles
  const stylesDiffs = diffElements(
    'configuration/styles',
    getStyles(sourceConfig),
    getStyles(targetConfig)
  );

  // Diff documentation
  const docDiffs = diffElements(
    'documentation/sections',
    getDocumentation(sourceDoc),
    getDocumentation(targetDoc)
  );

  // Calculate stats
  const allDiffs = [
    ...peopleDiffs,
    ...systemsDiffs,
    ...deploymentDiffs,
    ...relationshipDiffs,
    ...Object.values(viewDiffs).flat(),
    ...stylesDiffs,
    ...docDiffs,
  ];

  const stats = {
    added: allDiffs.filter((d) => d.type === 'added').length,
    removed: allDiffs.filter((d) => d.type === 'removed').length,
    modified: allDiffs.filter((d) => d.type === 'modified').length,
  };

  return {
    model: {
      people: peopleDiffs,
      softwareSystems: systemsDiffs,
      deploymentNodes: deploymentDiffs,
    },
    relationships: relationshipDiffs,
    views: {
      systemLandscape: viewDiffs.systemLandscape || [],
      systemContext: viewDiffs.systemContext || [],
      container: viewDiffs.container || [],
      component: viewDiffs.component || [],
      dynamic: viewDiffs.dynamic || [],
      deployment: viewDiffs.deployment || [],
      filtered: viewDiffs.filtered || [],
      custom: viewDiffs.custom || [],
    },
    styles: stylesDiffs,
    documentation: docDiffs,
    stats,
  };
}

/**
 * Check if a diff is empty (no changes)
 */
export function isDiffEmpty(diff: WorkspaceDiff): boolean {
  return diff.stats.added === 0 && diff.stats.removed === 0 && diff.stats.modified === 0;
}

/**
 * Format a diff for display
 */
export function formatDiff(diff: WorkspaceDiff, format: 'summary' | 'detailed' = 'summary'): string {
  const lines: string[] = [];

  if (format === 'summary') {
    lines.push(`Changes: +${diff.stats.added} ~${diff.stats.modified} -${diff.stats.removed}`);
    lines.push('');

    const sections = [
      { name: 'Model (People)', diffs: diff.model.people },
      { name: 'Model (Systems)', diffs: diff.model.softwareSystems },
      { name: 'Model (Deployment)', diffs: diff.model.deploymentNodes },
      { name: 'Relationships', diffs: diff.relationships },
      { name: 'Views (Landscape)', diffs: diff.views.systemLandscape },
      { name: 'Views (Context)', diffs: diff.views.systemContext },
      { name: 'Views (Container)', diffs: diff.views.container },
      { name: 'Views (Component)', diffs: diff.views.component },
      { name: 'Views (Dynamic)', diffs: diff.views.dynamic },
      { name: 'Views (Deployment)', diffs: diff.views.deployment },
      { name: 'Styles', diffs: diff.styles },
      { name: 'Documentation', diffs: diff.documentation },
    ];

    for (const section of sections) {
      if (section.diffs.length > 0) {
        const added = section.diffs.filter((d) => d.type === 'added').length;
        const removed = section.diffs.filter((d) => d.type === 'removed').length;
        const modified = section.diffs.filter((d) => d.type === 'modified').length;
        lines.push(`  ${section.name}: +${added} ~${modified} -${removed}`);
      }
    }
  } else {
    // Detailed format
    const allDiffs = [
      ...diff.model.people,
      ...diff.model.softwareSystems,
      ...diff.model.deploymentNodes,
      ...diff.relationships,
      ...diff.views.systemLandscape,
      ...diff.views.systemContext,
      ...diff.views.container,
      ...diff.views.component,
      ...diff.views.dynamic,
      ...diff.views.deployment,
      ...diff.styles,
      ...diff.documentation,
    ];

    for (const d of allDiffs) {
      const symbol = d.type === 'added' ? '+' : d.type === 'removed' ? '-' : '~';
      lines.push(`${symbol} ${d.path}`);
    }
  }

  return lines.join('\n');
}
