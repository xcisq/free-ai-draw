import type { Point } from '@plait/core';
import { PAPERDRAW_LAYOUT_DEFAULTS } from '../config/defaults';
import {
  AnalysisResult,
  LayoutEdge,
  LayoutGroup,
  LayoutNode,
  LayoutResult,
} from '../types/analyzer';
import { basicLayout } from './basic-layout';

interface LayoutSlot {
  id: string;
  kind: 'group' | 'standalone';
  nodeIds: string[];
  groupId?: string;
  x: number;
  width: number;
}

function getConnectionPoint(
  node: LayoutNode,
  connection: [number, number]
): Point {
  return [
    node.x + node.width * connection[0],
    node.y + node.height * connection[1],
  ];
}

function removeDuplicatePoints(points: Point[]) {
  const result: Point[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) {
      result.push(point);
    }
  }
  return result;
}

function simplifyOrthogonalRoute(points: Point[]) {
  const uniquePoints = removeDuplicatePoints(points);
  if (uniquePoints.length <= 2) {
    return uniquePoints;
  }

  const result: Point[] = [uniquePoints[0]];
  for (let index = 1; index < uniquePoints.length - 1; index += 1) {
    const previous = result[result.length - 1];
    const current = uniquePoints[index];
    const next = uniquePoints[index + 1];
    const sameX = previous[0] === current[0] && current[0] === next[0];
    const sameY = previous[1] === current[1] && current[1] === next[1];
    if (!sameX && !sameY) {
      result.push(current);
    }
  }
  result.push(uniquePoints[uniquePoints.length - 1]);
  return result;
}

function buildSlots(layout: LayoutResult): LayoutSlot[] {
  const groupedNodeIds = new Set(
    layout.groups.flatMap((group) => group.entityIds)
  );

  const groupSlots: LayoutSlot[] = layout.groups.map((group) => ({
    id: group.id,
    kind: 'group',
    nodeIds: [...group.entityIds],
    groupId: group.id,
    x: group.x,
    width: group.width,
  }));

  const standaloneSlots: LayoutSlot[] = layout.nodes
    .filter((node) => !groupedNodeIds.has(node.id))
    .map((node) => ({
      id: `slot-${node.id}`,
      kind: 'standalone',
      nodeIds: [node.id],
      x: node.x,
      width: node.width,
    }));

  return [...groupSlots, ...standaloneSlots].sort((left, right) => left.x - right.x);
}

function buildNodeToSlotIndex(slots: LayoutSlot[]) {
  const indexMap = new Map<string, number>();
  slots.forEach((slot, index) => {
    slot.nodeIds.forEach((nodeId) => {
      indexMap.set(nodeId, index);
    });
  });
  return indexMap;
}

function getCrossingEdgeCount(
  boundaryIndex: number,
  edges: LayoutEdge[],
  nodeToSlotIndex: Map<string, number>
) {
  return edges.filter((edge) => {
    const sourceSlot = nodeToSlotIndex.get(edge.sourceId);
    const targetSlot = nodeToSlotIndex.get(edge.targetId);
    if (sourceSlot === undefined || targetSlot === undefined) {
      return false;
    }
    return (
      (sourceSlot <= boundaryIndex && targetSlot > boundaryIndex) ||
      (targetSlot <= boundaryIndex && sourceSlot > boundaryIndex)
    );
  }).length;
}

function recomputeGroups(
  groups: LayoutGroup[],
  nodeMap: Map<string, LayoutNode>
): LayoutGroup[] {
  return groups.map((group) => {
    const memberNodes = group.entityIds
      .map((nodeId) => nodeMap.get(nodeId))
      .filter((node): node is LayoutNode => Boolean(node));

    if (!memberNodes.length) {
      return group;
    }

    const minX = Math.min(...memberNodes.map((node) => node.x));
    const minY = Math.min(...memberNodes.map((node) => node.y));
    const maxX = Math.max(...memberNodes.map((node) => node.x + node.width));
    const maxY = Math.max(...memberNodes.map((node) => node.y + node.height));

    return {
      ...group,
      x: minX - PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingX,
      y:
        minY -
        PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingY -
        PAPERDRAW_LAYOUT_DEFAULTS.moduleTitleHeight,
      width:
        maxX -
        minX +
        PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingX * 2,
      height:
        maxY -
        minY +
        PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingY * 2 +
        PAPERDRAW_LAYOUT_DEFAULTS.moduleTitleHeight,
    };
  });
}

function redistributeSlots(baseLayout: LayoutResult) {
  const nodes = baseLayout.nodes.map((node) => ({ ...node }));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const slots = buildSlots(baseLayout);
  const nodeToSlotIndex = buildNodeToSlotIndex(slots);
  let cursorX = slots[0]?.x ?? 0;

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const shift = cursorX - slot.x;
    if (shift !== 0) {
      slot.nodeIds.forEach((nodeId) => {
        const node = nodeMap.get(nodeId);
        if (node) {
          node.x += shift;
        }
      });
    }

    const crossingEdgeCount =
      index < slots.length - 1
        ? getCrossingEdgeCount(index, baseLayout.edges, nodeToSlotIndex)
        : 0;
    const gap =
      PAPERDRAW_LAYOUT_DEFAULTS.optimizedModuleGapX +
      crossingEdgeCount * PAPERDRAW_LAYOUT_DEFAULTS.optimizedGapPerCrossEdge;
    cursorX += slot.width + gap;
  }

  const groups = recomputeGroups(baseLayout.groups, nodeMap);
  return { nodes, groups };
}

function buildNodeToGroupMap(groups: LayoutGroup[]) {
  const mapping = new Map<string, LayoutGroup>();
  groups.forEach((group) => {
    group.entityIds.forEach((entityId) => {
      mapping.set(entityId, group);
    });
  });
  return mapping;
}

function optimizeEdges(
  edges: LayoutEdge[],
  nodes: LayoutNode[],
  groups: LayoutGroup[]
) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const nodeToGroupMap = buildNodeToGroupMap(groups);
  const routeTopBase =
    Math.min(
      ...[
        ...groups.map((group) => group.y),
        ...nodes.map((node) => node.y),
      ]
    ) - PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin;
  const routeBottomBase =
    Math.max(
      ...[
        ...groups.map((group) => group.y + group.height),
        ...nodes.map((node) => node.y + node.height),
      ]
    ) + PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin;

  let topLaneIndex = 0;
  let bottomLaneIndex = 0;
  const moduleLaneUsage = new Map<string, number>();

  return edges.map((edge) => {
    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);
    if (!sourceNode || !targetNode) {
      return edge;
    }

    const start = getConnectionPoint(sourceNode, edge.sourceConnection);
    const end = getConnectionPoint(targetNode, edge.targetConnection);
    const sourceGroup = nodeToGroupMap.get(sourceNode.id);
    const targetGroup = nodeToGroupMap.get(targetNode.id);

    if (edge.shape === 'straight') {
      return {
        ...edge,
        points: [start, end] as [Point, Point],
        routing: undefined,
      };
    }

    if (
      sourceGroup &&
      targetGroup &&
      sourceGroup.id === targetGroup.id
    ) {
      const moduleKey = sourceGroup.id;
      const laneIndex = moduleLaneUsage.get(moduleKey) ?? 0;
      moduleLaneUsage.set(moduleKey, laneIndex + 1);
      const corridorX =
        sourceGroup.x +
        sourceGroup.width +
        PAPERDRAW_LAYOUT_DEFAULTS.routeInnerMargin +
        laneIndex * PAPERDRAW_LAYOUT_DEFAULTS.routeLaneSpacing;
      const routing = simplifyOrthogonalRoute([
        start,
        [corridorX, start[1]],
        [corridorX, end[1]],
        end,
      ]);

      return {
        ...edge,
        shape: 'elbow' as const,
        points: [start, end] as [Point, Point],
        routing,
      };
    }

    if (edge.type === 'annotative') {
      const laneY =
        routeBottomBase +
        bottomLaneIndex * PAPERDRAW_LAYOUT_DEFAULTS.routeLaneSpacing;
      bottomLaneIndex += 1;
      const routing = simplifyOrthogonalRoute([
        start,
        [start[0], laneY],
        [end[0], laneY],
        end,
      ]);

      return {
        ...edge,
        shape: 'elbow' as const,
        points: [start, end] as [Point, Point],
        routing,
      };
    }

    const laneY =
      routeTopBase -
      topLaneIndex * PAPERDRAW_LAYOUT_DEFAULTS.routeLaneSpacing;
    topLaneIndex += 1;
    const routing = simplifyOrthogonalRoute([
      start,
      [start[0] + PAPERDRAW_LAYOUT_DEFAULTS.routeInnerMargin, start[1]],
      [start[0] + PAPERDRAW_LAYOUT_DEFAULTS.routeInnerMargin, laneY],
      [end[0] - PAPERDRAW_LAYOUT_DEFAULTS.routeInnerMargin, laneY],
      [end[0] - PAPERDRAW_LAYOUT_DEFAULTS.routeInnerMargin, end[1]],
      end,
    ]);

    return {
      ...edge,
      shape: 'elbow' as const,
      points: [start, end] as [Point, Point],
      routing,
    };
  });
}

export function optimizeLayout(analysis: AnalysisResult): LayoutResult {
  const baseLayout = basicLayout(analysis);
  const redistributed = redistributeSlots(baseLayout);
  const edges = optimizeEdges(
    baseLayout.edges,
    redistributed.nodes,
    redistributed.groups
  );

  return {
    ...baseLayout,
    nodes: redistributed.nodes,
    groups: redistributed.groups,
    edges,
  };
}
