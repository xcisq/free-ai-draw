import type { Point } from '@plait/core';
import type {
  LayoutEdge,
  LayoutGroup,
  LayoutIntent,
  LayoutNode,
  LayoutResult,
} from '../../types/analyzer';
import type { PipelineLayoutEvaluationResult } from './types';

interface SerializedLayoutNode {
  id: string;
  label: string;
  moduleId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  row?: number;
  column?: number;
}

interface SerializedLayoutGroup {
  id: string;
  moduleLabel: string;
  entityIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  order: number;
}

interface SerializedLayoutEdge {
  id: string;
  type: LayoutEdge['type'];
  sourceId: string;
  targetId: string;
  shape: LayoutEdge['shape'];
  routingPointCount: number;
  points: Point[];
}

interface SerializedLayoutIntent {
  dominantSpine: string[];
  branchRoots: string[];
  mergeNodes: string[];
  feedbackEdges: string[];
  layoutHints: string[];
  templateId?: LayoutResult['templateId'];
  routingEngine?: LayoutResult['routingEngine'];
}

interface SerializedLayoutStage {
  layout: {
    direction: LayoutResult['direction'];
    engine?: LayoutResult['engine'];
    templateId?: LayoutResult['templateId'];
    routingEngine?: LayoutResult['routingEngine'];
    fallbackFrom?: LayoutResult['fallbackFrom'];
    routeFallbackFrom?: LayoutResult['routeFallbackFrom'];
    nodes: SerializedLayoutNode[];
    groups: SerializedLayoutGroup[];
    edges: SerializedLayoutEdge[];
  };
  intent: SerializedLayoutIntent;
}

export interface SerializedPipelineLayoutEvaluationResult {
  fixtureId: string;
  category: PipelineLayoutEvaluationResult['category'];
  structure: PipelineLayoutEvaluationResult['structure'];
  metrics: PipelineLayoutEvaluationResult['metrics'];
  trace: {
    summary: PipelineLayoutEvaluationResult['trace']['summary'];
    draft: SerializedLayoutStage;
    optimized: SerializedLayoutStage;
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function sortById<T extends { id: string }>(items: T[]) {
  return [...items].sort((left, right) => left.id.localeCompare(right.id));
}

function serializePoint(point: Point): Point {
  return [round(point[0]), round(point[1])];
}

function serializeNodes(nodes: LayoutNode[]): SerializedLayoutNode[] {
  return sortById(nodes).map((node) => ({
    id: node.id,
    label: node.label,
    moduleId: node.moduleId,
    x: round(node.x),
    y: round(node.y),
    width: round(node.width),
    height: round(node.height),
    row: node.row,
    column: node.column,
  }));
}

function serializeGroups(groups: LayoutGroup[]): SerializedLayoutGroup[] {
  return sortById(groups).map((group) => ({
    id: group.id,
    moduleLabel: group.moduleLabel,
    entityIds: [...group.entityIds].sort(),
    x: round(group.x),
    y: round(group.y),
    width: round(group.width),
    height: round(group.height),
    order: group.order,
  }));
}

function serializeEdges(edges: LayoutEdge[]): SerializedLayoutEdge[] {
  return sortById(edges).map((edge) => {
    const routePoints = edge.routing && edge.routing.length > 1 ? edge.routing : edge.points;
    return {
      id: edge.id,
      type: edge.type,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      shape: edge.shape,
      routingPointCount: routePoints.length,
      points: routePoints.map(serializePoint),
    };
  });
}

function serializeIntent(
  intent: LayoutIntent,
  layout: LayoutResult
): SerializedLayoutIntent {
  return {
    dominantSpine: [...intent.dominantSpine],
    branchRoots: [...intent.branchRoots].sort(),
    mergeNodes: [...intent.mergeNodes].sort(),
    feedbackEdges: [...intent.feedbackEdges].sort(),
    layoutHints: [...intent.layoutHints].sort(),
    templateId: layout.templateId,
    routingEngine: layout.routingEngine,
  };
}

function serializeStage(
  layout: LayoutResult,
  intent: LayoutIntent
): SerializedLayoutStage {
  return {
    layout: {
      direction: layout.direction,
      engine: layout.engine,
      templateId: layout.templateId,
      routingEngine: layout.routingEngine,
      fallbackFrom: layout.fallbackFrom,
      routeFallbackFrom: layout.routeFallbackFrom,
      nodes: serializeNodes(layout.nodes),
      groups: serializeGroups(layout.groups),
      edges: serializeEdges(layout.edges),
    },
    intent: serializeIntent(intent, layout),
  };
}

export function serializePipelineLayoutEvaluationResult(
  result: PipelineLayoutEvaluationResult
): SerializedPipelineLayoutEvaluationResult {
  return {
    fixtureId: result.fixtureId,
    category: result.category,
    structure: result.structure,
    metrics: result.metrics,
    trace: {
      summary: result.trace.summary,
      draft: serializeStage(result.trace.draft.layout, result.trace.draft.intent),
      optimized: serializeStage(
        result.trace.optimized.layout,
        result.trace.optimized.intent
      ),
    },
  };
}
