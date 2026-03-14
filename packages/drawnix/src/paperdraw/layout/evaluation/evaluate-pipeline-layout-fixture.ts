import type { PlaitElement } from '@plait/core';
import type {
  LayoutIntent,
  LayoutNode,
  PipelineBlueprint,
  PipelineBlueprintLaneKind,
} from '../../types/analyzer';
import { basicLayout } from '../basic-layout';
import { computeOptimizedLayoutV2 } from '../layout-optimizer-v2';
import { buildLayoutIntent } from '../pipeline-layout-intent';
import { buildPipelineBlueprint } from '../pipeline-blueprint';
import type {
  PipelineLayoutEvaluationResult,
  PipelineLayoutFixture,
  PipelineLayoutStructureChecks,
  PipelineLayoutTrace,
} from './types';

function createDraftElementsFromLayout(layout: ReturnType<typeof basicLayout>): PlaitElement[] {
  const nodeElements = layout.nodes.map((node) => ({
    id: node.id,
    points: [
      [node.x, node.y],
      [node.x + node.width, node.y + node.height],
    ],
  }));
  const edgeElements = layout.edges.map((edge) => ({
    id: edge.id,
    shape: edge.shape,
    source: {
      connection: edge.sourceConnection,
    },
    target: {
      connection: edge.targetConnection,
    },
    points: edge.routing ?? edge.points,
  }));

  return [...nodeElements, ...edgeElements] as PlaitElement[];
}

function getNodeCenter(node: LayoutNode) {
  return [node.x + node.width / 2, node.y + node.height / 2] as const;
}

function getAverageCenter(nodes: LayoutNode[]) {
  if (!nodes.length) {
    return null;
  }
  const sum = nodes.reduce<[number, number]>(
    (acc, node) => {
      const [x, y] = getNodeCenter(node);
      return [acc[0] + x, acc[1] + y];
    },
    [0, 0]
  );
  return [sum[0] / nodes.length, sum[1] / nodes.length] as const;
}

function getNodesByLaneKind(
  blueprint: PipelineBlueprint,
  layoutNodes: LayoutNode[],
  laneKind: PipelineBlueprintLaneKind
) {
  const nodeIds = new Set(
    blueprint.lanes
      .filter((lane) => lane.kind === laneKind)
      .flatMap((lane) => lane.nodeIds)
  );
  return layoutNodes.filter((node) => nodeIds.has(node.id));
}

function getSpineNodes(blueprint: PipelineBlueprint, layoutNodes: LayoutNode[]) {
  const spineIdSet = new Set(blueprint.spineNodeIds);
  return layoutNodes.filter((node) => spineIdSet.has(node.id));
}

function getSpineEndpointNodes(
  blueprint: PipelineBlueprint,
  layoutNodes: LayoutNode[],
  side: 'start' | 'end'
) {
  const nodeId =
    side === 'start'
      ? blueprint.spineNodeIds[0]
      : blueprint.spineNodeIds[blueprint.spineNodeIds.length - 1];
  if (!nodeId) {
    return [];
  }
  return layoutNodes.filter((node) => node.id === nodeId);
}

function mergeLayoutNodes(...groups: LayoutNode[][]) {
  const seen = new Set<string>();
  const merged: LayoutNode[] = [];
  groups.flat().forEach((node) => {
    if (seen.has(node.id)) {
      return;
    }
    seen.add(node.id);
    merged.push(node);
  });
  return merged;
}

function hasRelativeZonePosition(
  zoneNodes: LayoutNode[],
  spineNodes: LayoutNode[],
  direction: 'left' | 'right' | 'top' | 'bottom'
) {
  const zoneCenter = getAverageCenter(zoneNodes);
  const spineCenter = getAverageCenter(spineNodes);
  if (!zoneCenter || !spineCenter) {
    return false;
  }

  if (direction === 'left') {
    return zoneCenter[0] < spineCenter[0] - 40;
  }
  if (direction === 'right') {
    return zoneCenter[0] > spineCenter[0] + 40;
  }
  if (direction === 'top') {
    return zoneCenter[1] < spineCenter[1] - 40;
  }
  return zoneCenter[1] > spineCenter[1] + 40;
}

function hasZonePresence(zoneNodes: LayoutNode[]) {
  return zoneNodes.length > 0;
}

function hasSeparatedNonSpine(
  intent: LayoutIntent,
  blueprint: PipelineBlueprint,
  layoutNodes: LayoutNode[]
) {
  const spineNodes = getSpineNodes(blueprint, layoutNodes);
  const nonSpineNodes = layoutNodes.filter(
    (node) => !blueprint.spineNodeIds.includes(node.id)
  );
  const spineCenter = getAverageCenter(spineNodes);
  if (
    blueprint.branchGroups.length > 0 ||
    blueprint.mergeGroups.length > 0 ||
    blueprint.feedbackLoops.length > 0
  ) {
    return true;
  }

  if (!spineNodes.length || !nonSpineNodes.length || !spineCenter) {
    return false;
  }

  return nonSpineNodes.some((node) => {
    const [, y] = getNodeCenter(node);
    return Math.abs(y - spineCenter[1]) > 48;
  });
}

function hasOuterFeedback(intent: LayoutIntent, optimizedLayout: PipelineLayoutEvaluationResult['optimizedLayout']) {
  const feedbackEdgeIds = new Set(intent.feedbackEdges);
  if (!feedbackEdgeIds.size) {
    return false;
  }
  const minX = Math.min(...optimizedLayout.nodes.map((node) => node.x));
  const minY = Math.min(...optimizedLayout.nodes.map((node) => node.y));
  const maxX = Math.max(...optimizedLayout.nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...optimizedLayout.nodes.map((node) => node.y + node.height));

  return optimizedLayout.edges
    .filter((edge) => feedbackEdgeIds.has(edge.id))
    .some((edge) =>
      (edge.routing ?? edge.points).some(
        (point) =>
          point[0] < minX ||
          point[0] > maxX ||
          point[1] < minY ||
          point[1] > maxY
      )
    );
}

function computeStructureChecks(
  fixture: PipelineLayoutFixture,
  intent: LayoutIntent,
  blueprint: PipelineBlueprint,
  optimizedLayout: PipelineLayoutEvaluationResult['optimizedLayout']
): PipelineLayoutStructureChecks {
  const spineNodes = getSpineNodes(blueprint, optimizedLayout.nodes);
  const inputNodes = mergeLayoutNodes(
    getNodesByLaneKind(blueprint, optimizedLayout.nodes, 'input'),
    getSpineEndpointNodes(blueprint, optimizedLayout.nodes, 'start')
  );
  const outputNodes = mergeLayoutNodes(
    getNodesByLaneKind(blueprint, optimizedLayout.nodes, 'output'),
    getSpineEndpointNodes(blueprint, optimizedLayout.nodes, 'end')
  );
  const auxNodes = getNodesByLaneKind(blueprint, optimizedLayout.nodes, 'auxiliary');
  const controlNodes = getNodesByLaneKind(blueprint, optimizedLayout.nodes, 'control');

  return {
    templateMatched: optimizedLayout.templateId === fixture.expectation.expectedTemplateId,
    spineLength: blueprint.spineNodeIds.length,
    branchCount: blueprint.branchGroups.length,
    mergeCount: blueprint.mergeGroups.length,
    feedbackCount: blueprint.feedbackLoops.length,
    hasInputLeft:
      hasRelativeZonePosition(inputNodes, spineNodes, 'left') ||
      hasZonePresence(inputNodes),
    hasOutputRight:
      hasRelativeZonePosition(outputNodes, spineNodes, 'right') ||
      hasZonePresence(outputNodes),
    hasAuxBottom:
      hasRelativeZonePosition(auxNodes, spineNodes, 'bottom') ||
      hasZonePresence(auxNodes),
    hasControlTop:
      hasRelativeZonePosition(controlNodes, spineNodes, 'top') ||
      hasZonePresence(controlNodes),
    hasOuterFeedback: hasOuterFeedback(intent, optimizedLayout),
    hasSeparatedNonSpine: hasSeparatedNonSpine(intent, blueprint, optimizedLayout.nodes),
  };
}

function buildTrace(
  fixture: PipelineLayoutFixture,
  draftLayout: ReturnType<typeof basicLayout>,
  draftIntent: LayoutIntent,
  optimizedLayout: PipelineLayoutEvaluationResult['optimizedLayout'],
  optimizedIntent: LayoutIntent
): PipelineLayoutTrace {
  return {
    draft: {
      layout: draftLayout,
      intent: draftIntent,
    },
    optimized: {
      layout: optimizedLayout,
      intent: optimizedIntent,
    },
    summary: {
      expectedTemplateId: fixture.expectation.expectedTemplateId,
      optimizedTemplateId: optimizedLayout.templateId,
      draftRoutingEngine: draftLayout.routingEngine,
      optimizedRoutingEngine: optimizedLayout.routingEngine,
      draftSpineLength: draftIntent.dominantSpine.length,
      optimizedSpineLength: optimizedIntent.dominantSpine.length,
      draftBranchCount: draftIntent.branchRoots.length,
      optimizedBranchCount: optimizedIntent.branchRoots.length,
      draftMergeCount: draftIntent.mergeNodes.length,
      optimizedMergeCount: optimizedIntent.mergeNodes.length,
      draftFeedbackCount: draftIntent.feedbackEdges.length,
      optimizedFeedbackCount: optimizedIntent.feedbackEdges.length,
      templateMatched:
        optimizedLayout.templateId === fixture.expectation.expectedTemplateId,
    },
  };
}

export async function evaluatePipelineLayoutFixture(
  fixture: PipelineLayoutFixture
): Promise<PipelineLayoutEvaluationResult> {
  const draftLayout = basicLayout(fixture.analysis);
  const draftIntent = buildLayoutIntent(fixture.analysis, draftLayout);
  const draftElements = createDraftElementsFromLayout(draftLayout);
  const optimizedLayout = await computeOptimizedLayoutV2(
    fixture.analysis,
    draftElements,
    {
      engine: 'pipeline_v1',
      mode: 'global',
      profile: 'auto',
      quality: 'quality',
      timeoutMs: 4000,
    }
  );
  const intent = buildLayoutIntent(fixture.analysis, optimizedLayout);
  const blueprint = buildPipelineBlueprint(fixture.analysis, intent);
  const metrics = optimizedLayout.metrics!;
  const trace = buildTrace(
    fixture,
    draftLayout,
    draftIntent,
    optimizedLayout,
    intent
  );

  return {
    fixtureId: fixture.id,
    category: fixture.category,
    optimizedLayout,
    intent,
    metrics,
    structure: computeStructureChecks(fixture, intent, blueprint, optimizedLayout),
    trace,
  };
}
