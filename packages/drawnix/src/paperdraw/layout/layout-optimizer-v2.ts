import type { PlaitElement } from '@plait/core';
import { PAPERDRAW_LAYOUT_DEFAULTS } from '../config/defaults';
import type {
  AnalysisResult,
  LayoutCandidate,
  LayoutEdge,
  LayoutGroup,
  LayoutNode,
  LayoutOptimizeOptions,
  LayoutResult,
} from '../types/analyzer';
import {
  buildConstraintSnapshot,
  buildLayoutConstraintModel,
  getSelectionBaseNodeIds,
  getPinnedIdsForSelection,
  getSelectionOptimizationNodeIds,
} from './constraint-model';
import { generateLayoutCandidates } from './candidate-generator';
import { refineLayoutWithElk } from './elk-layout';
import { withLayoutMetrics } from './layout-metrics';
import { routeLayoutOrthogonally } from './orthogonal-router';
import { buildLayoutIntent } from './pipeline-layout-intent';
import { buildPipelineBlueprint } from './pipeline-blueprint';
import { computePipelineLayoutV1 } from './pipeline-layout-v1';
import { routePipelineLayoutV3 } from './pipeline-router-v3';

function pickBestCandidate(candidates: LayoutCandidate[]) {
  return [...candidates].sort((left, right) => {
    if (
      left.metrics.hardConstraintViolations !== right.metrics.hardConstraintViolations
    ) {
      return (
        left.metrics.hardConstraintViolations - right.metrics.hardConstraintViolations
      );
    }
    return left.metrics.totalScore - right.metrics.totalScore;
  })[0];
}

function getBounds(nodes: LayoutNode[]) {
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return { minX, minY, maxX, maxY };
}

function translateLayout(layout: LayoutResult, deltaX: number, deltaY: number): LayoutResult {
  return {
    ...layout,
    nodes: layout.nodes.map((node) => ({
      ...node,
      x: node.x + deltaX,
      y: node.y + deltaY,
    })),
    groups: layout.groups.map((group) => ({
      ...group,
      x: group.x + deltaX,
      y: group.y + deltaY,
    })),
    edges: layout.edges.map((edge) => ({
      ...edge,
      points: [
        [edge.points[0][0] + deltaX, edge.points[0][1] + deltaY],
        [edge.points[1][0] + deltaX, edge.points[1][1] + deltaY],
      ] as [[number, number], [number, number]],
      routing: edge.routing?.map((point) => [
        point[0] + deltaX,
        point[1] + deltaY,
      ] as [number, number]),
    })),
  };
}

function buildSelectionSubLayout(
  layout: LayoutResult,
  movableNodeIds: Set<string>
): LayoutResult {
  const nodes = layout.nodes.filter((node) => movableNodeIds.has(node.id));
  const nodeSet = new Set(nodes.map((node) => node.id));
  const groups = layout.groups
    .map((group) => ({
      ...group,
      entityIds: group.entityIds.filter((entityId) => nodeSet.has(entityId)),
    }))
    .filter((group) => group.entityIds.length > 0);
  const groupSet = new Set(groups.map((group) => group.id));
  const edges = layout.edges.filter(
    (edge) => nodeSet.has(edge.sourceId) && nodeSet.has(edge.targetId)
  );

  return {
    direction: layout.direction,
    nodes,
    groups,
    edges,
    metrics: layout.metrics,
  };
}

function mergeSelectionLayout(
  baseLayout: LayoutResult,
  optimizedSelectionLayout: LayoutResult,
  movableNodeIds: Set<string>
): LayoutResult {
  const optimizedNodeMap = new Map(
    optimizedSelectionLayout.nodes.map((node) => [node.id, node])
  );
  const optimizedGroupMap = new Map(
    optimizedSelectionLayout.groups.map((group) => [group.id, group])
  );
  const optimizedEdgeMap = new Map(
    optimizedSelectionLayout.edges.map((edge) => [edge.id, edge])
  );

  const nodes = baseLayout.nodes.map((node) =>
    movableNodeIds.has(node.id) ? optimizedNodeMap.get(node.id) ?? node : node
  );
  const groups = baseLayout.groups.map((group) =>
    optimizedGroupMap.get(group.id)
      ? {
          ...group,
          ...optimizedGroupMap.get(group.id)!,
        }
      : group
  );
  const edges = baseLayout.edges.map((edge) =>
    optimizedEdgeMap.get(edge.id) ?? edge
  );

  return {
    ...baseLayout,
    nodes,
    groups,
    edges,
  };
}

async function runOptimizationPipeline(
  analysis: AnalysisResult,
  layout: LayoutResult,
  options: LayoutOptimizeOptions,
  candidateLimit: number
) {
  if (options.engine === 'pipeline_v1') {
    return computePipelineLayoutV1(analysis, layout, options);
  }

  const model = buildLayoutConstraintModel(layout, options);
  const candidates = generateLayoutCandidates(model, candidateLimit);
  const bestCandidate = pickBestCandidate(candidates);
  if (!bestCandidate) {
    throw new Error('NO_LAYOUT_CANDIDATE');
  }

  const refined = await refineLayoutWithElk(bestCandidate.layout, model);
  const routed = routeLayoutOrthogonally(refined, model);
  return withLayoutMetrics(
    {
      ...routed,
      engine: 'legacy_v2',
    },
    model
  );
}

async function runOptimizationPipelineWithFallback(
  analysis: AnalysisResult,
  layout: LayoutResult,
  options: LayoutOptimizeOptions,
  candidateLimit: number
) {
  try {
    return await runOptimizationPipeline(analysis, layout, options, candidateLimit);
  } catch (error: any) {
    if (options.engine !== 'pipeline_v1' || error?.message === 'INVALID_SELECTION') {
      throw error;
    }

    const fallbackLayout = await runOptimizationPipeline(
      analysis,
      layout,
      {
        ...options,
        engine: 'legacy_v2',
      },
      candidateLimit
    );

    return {
      ...fallbackLayout,
      fallbackFrom: 'pipeline_v1' as const,
    };
  }
}

function buildSelectionSubAnalysis(
  analysis: AnalysisResult,
  movableNodeIds: Set<string>
): AnalysisResult {
  const entities = analysis.entities.filter((entity) => movableNodeIds.has(entity.id));
  const entityIdSet = new Set(entities.map((entity) => entity.id));
  const relations = analysis.relations.filter(
    (relation) => entityIdSet.has(relation.source) && entityIdSet.has(relation.target)
  );
  const modules = analysis.modules
    .map((moduleItem) => ({
      ...moduleItem,
      entityIds: moduleItem.entityIds.filter((entityId) => entityIdSet.has(entityId)),
    }))
    .filter((moduleItem) => moduleItem.entityIds.length > 0);

  const weights = Object.fromEntries(
    Object.entries(analysis.weights).filter(([entityId]) => entityIdSet.has(entityId))
  );

  return {
    entities,
    relations,
    modules,
    weights,
    warnings: analysis.warnings,
  };
}

function getSelectionEdgeIdsToRoute(
  layout: LayoutResult,
  movableNodeIds: Set<string>
) {
  return new Set(
    layout.edges
      .filter(
        (edge) =>
          movableNodeIds.has(edge.sourceId) || movableNodeIds.has(edge.targetId)
      )
      .map((edge) => edge.id)
  );
}

export async function computeOptimizedLayoutV2(
  analysis: AnalysisResult,
  elements: PlaitElement[],
  options: LayoutOptimizeOptions
): Promise<LayoutResult> {
  const snapshot = buildConstraintSnapshot(analysis, elements);
  const normalizedOptions: LayoutOptimizeOptions = {
    engine: 'legacy_v2',
    profile: 'auto',
    quality: 'quality',
    timeoutMs:
      options.timeoutMs ??
      (options.mode === 'selection'
        ? PAPERDRAW_LAYOUT_DEFAULTS.optimizerSelectionTimeoutMs
        : PAPERDRAW_LAYOUT_DEFAULTS.optimizerGlobalTimeoutMs),
    ...options,
  };

  if (normalizedOptions.mode === 'selection') {
    const selectedNodeIds = getSelectionBaseNodeIds(
      normalizedOptions.selection,
      analysis,
      snapshot.layout
    );
    if (selectedNodeIds.size < 2) {
      throw new Error('INVALID_SELECTION');
    }

    const movableNodeIds = getSelectionOptimizationNodeIds(
      normalizedOptions.selection,
      analysis,
      snapshot.layout
    );
    const selectionAnalysis = buildSelectionSubAnalysis(analysis, movableNodeIds);

    const selectionLayout = buildSelectionSubLayout(snapshot.layout, movableNodeIds);
    const originalBounds = getBounds(selectionLayout.nodes);
    const optimizedSelectionLayout = await runOptimizationPipelineWithFallback(
      selectionAnalysis,
      selectionLayout,
      normalizedOptions,
      PAPERDRAW_LAYOUT_DEFAULTS.optimizerSelectionCandidateCount
    );
    const optimizedBounds = getBounds(optimizedSelectionLayout.nodes);
    const translatedSelection = translateLayout(
      optimizedSelectionLayout,
      originalBounds.minX - optimizedBounds.minX,
      originalBounds.minY - optimizedBounds.minY
    );

    const merged = mergeSelectionLayout(
      snapshot.layout,
      translatedSelection,
      movableNodeIds
    );
    const { pinnedNodeIds, pinnedGroupIds } = getPinnedIdsForSelection(
      merged,
      movableNodeIds
    );
    const mergedModel = buildLayoutConstraintModel(
      merged,
      normalizedOptions,
      pinnedNodeIds,
      pinnedGroupIds
    );
    const mergedEdgeIdsToRoute = getSelectionEdgeIdsToRoute(merged, movableNodeIds);

    if ((optimizedSelectionLayout.engine ?? normalizedOptions.engine) === 'pipeline_v1') {
      const mergedIntent = buildLayoutIntent(analysis, merged);
      const mergedBlueprint = buildPipelineBlueprint(analysis, mergedIntent);
      return withLayoutMetrics(
        routePipelineLayoutV3(
          {
            ...merged,
            engine: optimizedSelectionLayout.engine ?? normalizedOptions.engine,
            templateId: optimizedSelectionLayout.templateId,
            fallbackFrom: optimizedSelectionLayout.fallbackFrom,
          },
          mergedModel,
          mergedIntent,
          {
            edgeIdsToRoute: mergedEdgeIdsToRoute,
            blueprint: mergedBlueprint,
            templateId: optimizedSelectionLayout.templateId,
          }
        ),
        mergedModel
      );
    }

    return withLayoutMetrics(
      routeLayoutOrthogonally(
        {
          ...merged,
          engine: optimizedSelectionLayout.engine ?? normalizedOptions.engine,
          templateId: optimizedSelectionLayout.templateId,
          fallbackFrom: optimizedSelectionLayout.fallbackFrom,
        },
        mergedModel,
        mergedEdgeIdsToRoute
      ),
      mergedModel
    );
  }

  return runOptimizationPipelineWithFallback(
    analysis,
    snapshot.layout,
    normalizedOptions,
    PAPERDRAW_LAYOUT_DEFAULTS.optimizerGlobalCandidateCount
  );
}
