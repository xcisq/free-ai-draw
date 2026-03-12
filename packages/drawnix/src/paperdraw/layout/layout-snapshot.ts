import type { PlaitElement, Point } from '@plait/core';
import {
  type AnalysisResult,
  type FlowRelation,
  type LayoutEdge,
  type LayoutGroup,
  type LayoutNode,
  type LayoutResult,
  type ModuleGroup,
  type PaperDrawSelectionState,
} from '../types/analyzer';
import { recomputeLayoutGroups } from './optimize-layout';

export interface DraftLayoutSnapshot {
  layout: LayoutResult;
  modules: ModuleGroup[];
}

function getElementPoints(element: any): Point[] | null {
  if (!element || !Array.isArray(element.points) || element.points.length < 2) {
    return null;
  }
  return element.points as Point[];
}

function getElementBounds(element: any) {
  const points = getElementPoints(element);
  if (!points) {
    return null;
  }
  const [start, end] = [points[0], points[points.length - 1]];
  const minX = Math.min(start[0], end[0]);
  const minY = Math.min(start[1], end[1]);
  const maxX = Math.max(start[0], end[0]);
  const maxY = Math.max(start[1], end[1]);
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

function getModuleSkins(modules: ModuleGroup[], nodeIds: Set<string>) {
  return modules
    .map((moduleItem, index) => {
      const entityIds = moduleItem.entityIds.filter((id) => nodeIds.has(id));
      if (!entityIds.length) {
        return null;
      }
      return {
        id: moduleItem.id,
        moduleLabel: moduleItem.label,
        entityIds,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        order: moduleItem.order ?? index + 1,
      } as LayoutGroup;
    })
    .filter((group): group is LayoutGroup => Boolean(group));
}

function getDefaultEdgeConnections(
  relation: FlowRelation
): Pick<LayoutEdge, 'sourceConnection' | 'targetConnection' | 'shape'> {
  if (relation.type === 'annotative') {
    return {
      shape: 'elbow',
      sourceConnection: [1, 0.5],
      targetConnection: [0, 0.5],
    };
  }
  return {
    shape: 'elbow',
    sourceConnection: [1, 0.5],
    targetConnection: [0, 0.5],
  };
}

export function buildSnapshotFromElements(
  analysis: AnalysisResult,
  elements: PlaitElement[]
): DraftLayoutSnapshot {
  const elementMap = new Map(elements.map((element) => [element.id, element]));

  const nodes = analysis.entities
    .map((entity) => {
      const element = elementMap.get(entity.id) as any;
      const bounds = getElementBounds(element);
      if (!bounds) {
        return null;
      }

      const moduleItem = analysis.modules.find((item) =>
        item.entityIds.includes(entity.id)
      );

      return {
        id: entity.id,
        label: entity.label,
        moduleId: moduleItem?.id,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        weight: analysis.weights[entity.id] ?? 0.5,
        confidence: entity.confidence ?? 0.5,
      } as LayoutNode;
    })
    .filter((node): node is LayoutNode => Boolean(node));

  const nodeIds = new Set(nodes.map((node) => node.id));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const groups = recomputeLayoutGroups(
    getModuleSkins(analysis.modules, nodeIds),
    nodeMap
  );

  const relationMap = new Map(analysis.relations.map((relation) => [relation.id, relation]));
  const edges = analysis.relations
    .filter((relation) => nodeIds.has(relation.source) && nodeIds.has(relation.target))
    .filter((relation) => elementMap.has(relation.id))
    .map((relation) => {
      const element = elementMap.get(relation.id) as any;
      const points = getElementPoints(element);
      const defaults = getDefaultEdgeConnections(relation);
      const firstPoint = points?.[0];
      const lastPoint = points?.[points.length - 1];
      const routing = points && points.length > 2 ? points : undefined;

      return {
        id: relation.id,
        type: relation.type,
        sourceId: relation.source,
        targetId: relation.target,
        shape: element?.shape === 'straight' ? 'straight' : defaults.shape,
        sourceConnection:
          (element?.source?.connection as [number, number] | undefined) ??
          defaults.sourceConnection,
        targetConnection:
          (element?.target?.connection as [number, number] | undefined) ??
          defaults.targetConnection,
        points: [
          (firstPoint ?? [0, 0]) as Point,
          (lastPoint ?? [0, 0]) as Point,
        ] as [Point, Point],
        routing,
        label: relationMap.get(relation.id)?.label,
      } as LayoutEdge;
    });

  return {
    layout: {
      direction: 'LR',
      nodes,
      groups,
      edges,
    },
    modules: analysis.modules,
  };
}

export function getSelectionNodeIds(
  selection: PaperDrawSelectionState | undefined,
  analysis: AnalysisResult,
  layout: LayoutResult
) {
  if (!selection) {
    return new Set<string>();
  }

  const nodeIds = new Set<string>();
  const availableNodeIds = new Set(layout.nodes.map((node) => node.id));
  const moduleMap = new Map(analysis.modules.map((moduleItem) => [moduleItem.id, moduleItem]));

  selection.geometryIds.forEach((id) => {
    if (availableNodeIds.has(id)) {
      nodeIds.add(id);
      return;
    }
    const moduleItem = moduleMap.get(id);
    moduleItem?.entityIds.forEach((entityId) => {
      if (availableNodeIds.has(entityId)) {
        nodeIds.add(entityId);
      }
    });
  });

  return nodeIds;
}

export function isValidSelectionForOptimize(
  selection: PaperDrawSelectionState | undefined,
  analysis: AnalysisResult,
  elements: PlaitElement[]
) {
  const snapshot = buildSnapshotFromElements(analysis, elements);
  return getSelectionNodeIds(selection, analysis, snapshot.layout).size >= 2;
}
