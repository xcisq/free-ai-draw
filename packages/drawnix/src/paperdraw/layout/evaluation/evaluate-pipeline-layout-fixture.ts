import type { PlaitElement } from '@plait/core';
import type { LayoutIntent, LayoutNode, RailPreference } from '../../types/analyzer';
import { basicLayout } from '../basic-layout';
import { computeOptimizedLayoutV2 } from '../layout-optimizer-v2';
import { buildLayoutIntent } from '../pipeline-layout-intent';
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

function getNodesByRail(
  intent: LayoutIntent,
  layoutNodes: LayoutNode[],
  rail: RailPreference
) {
  const nodeIds = new Set(
    intent.nodes
      .filter((node) => node.preferredRail === rail)
      .map((node) => node.id)
  );
  return layoutNodes.filter((node) => nodeIds.has(node.id));
}

function getSpineNodes(intent: LayoutIntent, layoutNodes: LayoutNode[]) {
  const spineIdSet = new Set(intent.dominantSpine);
  return layoutNodes.filter((node) => spineIdSet.has(node.id));
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

function hasSeparatedNonSpine(intent: LayoutIntent, layoutNodes: LayoutNode[]) {
  const spineNodes = getSpineNodes(intent, layoutNodes);
  const nonSpineNodes = layoutNodes.filter(
    (node) => !intent.dominantSpine.includes(node.id)
  );
  const spineCenter = getAverageCenter(spineNodes);
  if (
    intent.branchRoots.length > 0 ||
    intent.mergeNodes.length > 0 ||
    intent.feedbackEdges.length > 0
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
  optimizedLayout: PipelineLayoutEvaluationResult['optimizedLayout']
): PipelineLayoutStructureChecks {
  const spineNodes = getSpineNodes(intent, optimizedLayout.nodes);
  const inputNodes = getNodesByRail(intent, optimizedLayout.nodes, 'left_input_rail');
  const outputNodes = getNodesByRail(intent, optimizedLayout.nodes, 'right_output_rail');
  const auxNodes = getNodesByRail(intent, optimizedLayout.nodes, 'bottom_aux_rail');
  const controlNodes = getNodesByRail(intent, optimizedLayout.nodes, 'top_control_rail');

  return {
    templateMatched: optimizedLayout.templateId === fixture.expectation.expectedTemplateId,
    spineLength: intent.dominantSpine.length,
    branchCount: intent.branchRoots.length,
    mergeCount: intent.mergeNodes.length,
    feedbackCount: intent.feedbackEdges.length,
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
    hasSeparatedNonSpine: hasSeparatedNonSpine(intent, optimizedLayout.nodes),
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
    structure: computeStructureChecks(fixture, intent, optimizedLayout),
    trace,
  };
}
