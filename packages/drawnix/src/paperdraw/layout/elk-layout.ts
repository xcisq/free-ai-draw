import type { PlaitElement, Point } from '@plait/core';
import ELK, {
  type ElkEdgeSection,
  type ElkExtendedEdge,
  type ElkNode,
  type ElkPoint,
  type LayoutOptions,
} from 'elkjs';
import { PAPERDRAW_LAYOUT_DEFAULTS } from '../config/defaults';
import {
  type AnalysisResult,
  type ElkLayoutOptions,
  type LayoutEdge,
  type LayoutGroup,
  type LayoutNode,
  type LayoutResult,
} from '../types/analyzer';
import {
  buildSnapshotFromElements,
  getSelectionNodeIds,
} from './layout-snapshot';
import {
  buildOptimizedEdgeRoutes,
  recomputeLayoutGroups,
  simplifyOrthogonalRoute,
} from './optimize-layout';

const ROOT_ID = 'paperdraw-root';

const DEFAULT_ELK_LAYOUT_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.spacing.nodeNode': '60',
  'elk.padding': '[left=24, top=24, right=24, bottom=24]',
};


function buildElkChildren(layout: LayoutResult) {
  const groupedNodeIds = new Set(
    layout.groups.flatMap((group) => group.entityIds)
  );

  const groupChildren = layout.groups
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((group) => ({
      id: group.id,
      layoutOptions: {
        'elk.padding': `[left=${PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingX}, top=${
          PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingY +
          PAPERDRAW_LAYOUT_DEFAULTS.moduleTitleHeight
        }, right=${PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingX}, bottom=${PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingY}]`,
      },
      children: group.entityIds
        .map((entityId) => layout.nodes.find((node) => node.id === entityId))
        .filter((node): node is LayoutNode => Boolean(node))
        .map((node) => ({
          id: node.id,
          width: node.width,
          height: node.height,
        })),
    }));

  const standaloneChildren = layout.nodes
    .filter((node) => !groupedNodeIds.has(node.id))
    .map((node) => ({
      id: node.id,
      width: node.width,
      height: node.height,
    }));

  return {
    children: [...groupChildren, ...standaloneChildren],
  };
}

function buildElkEdges(layout: LayoutResult) {
  return layout.edges.map((edge) => ({
    id: edge.id,
    sources: [edge.sourceId],
    targets: [edge.targetId],
  })) as ElkExtendedEdge[];
}

function buildElkGraph(layout: LayoutResult): ElkNode {
  const { children } = buildElkChildren(layout);
  return {
    id: ROOT_ID,
    layoutOptions: DEFAULT_ELK_LAYOUT_OPTIONS,
    children,
    edges: buildElkEdges(layout),
  };
}

function collectElkNodes(root: ElkNode, result = new Map<string, ElkNode>()) {
  root.children?.forEach((child) => {
    result.set(child.id, child);
    collectElkNodes(child, result);
  });
  return result;
}

function collectElkEdges(root: ElkNode, result = new Map<string, ElkExtendedEdge>()) {
  root.edges?.forEach((edge) => {
    result.set(edge.id, edge);
  });
  root.children?.forEach((child) => {
    if (child.edges) {
      child.edges.forEach((edge) => result.set(edge.id, edge));
    }
    collectElkEdges(child, result);
  });
  return result;
}

function toPoint(point: ElkPoint): Point {
  return [point.x, point.y];
}

function resolveRelativeConnection(
  node: LayoutNode,
  point: Point
): [number, number] {
  const width = Math.max(node.width, 1);
  const height = Math.max(node.height, 1);
  const xRatio = Math.min(Math.max((point[0] - node.x) / width, 0), 1);
  const yRatio = Math.min(Math.max((point[1] - node.y) / height, 0), 1);
  const distances = [
    { side: 'left', value: Math.abs(point[0] - node.x) },
    { side: 'right', value: Math.abs(point[0] - (node.x + node.width)) },
    { side: 'top', value: Math.abs(point[1] - node.y) },
    { side: 'bottom', value: Math.abs(point[1] - (node.y + node.height)) },
  ].sort((left, right) => left.value - right.value);

  switch (distances[0].side) {
    case 'left':
      return [0, yRatio];
    case 'right':
      return [1, yRatio];
    case 'top':
      return [xRatio, 0];
    default:
      return [xRatio, 1];
  }
}

function extractEdgeRoute(edge: ElkExtendedEdge) {
  const section = edge.sections?.[0] as ElkEdgeSection | undefined;
  if (!section) {
    return null;
  }
  const routing = simplifyOrthogonalRoute([
    toPoint(section.startPoint),
    ...(section.bendPoints ?? []).map(toPoint),
    toPoint(section.endPoint),
  ]);
  return {
    start: toPoint(section.startPoint),
    end: toPoint(section.endPoint),
    routing,
  };
}

function mapElkLayout(
  baseLayout: LayoutResult,
  elkGraph: ElkNode
): LayoutResult {
  const elkNodeMap = collectElkNodes(elkGraph);
  const elkEdgeMap = collectElkEdges(elkGraph);

  const nextNodes = baseLayout.nodes.map((node) => {
    const elkNode = elkNodeMap.get(node.id);
    if (!elkNode || elkNode.x === undefined || elkNode.y === undefined) {
      return node;
    }
    return {
      ...node,
      x: elkNode.x,
      y: elkNode.y,
      width: elkNode.width ?? node.width,
      height: elkNode.height ?? node.height,
    };
  });

  const nextNodeMap = new Map(nextNodes.map((node) => [node.id, node]));
  const nextGroups = baseLayout.groups.map((group) => {
    const elkGroup = elkNodeMap.get(group.id);
    if (
      elkGroup &&
      elkGroup.x !== undefined &&
      elkGroup.y !== undefined &&
      elkGroup.width !== undefined &&
      elkGroup.height !== undefined
    ) {
      return {
        ...group,
        x: elkGroup.x,
        y: elkGroup.y,
        width: elkGroup.width,
        height: elkGroup.height,
      };
    }
    return group;
  });

  const nextEdges = baseLayout.edges.map((edge) => {
    const elkEdge = elkEdgeMap.get(edge.id);
    if (!elkEdge) {
      return edge;
    }

    const route = extractEdgeRoute(elkEdge);
    if (!route) {
      return edge;
    }

    const sourceNode = nextNodeMap.get(edge.sourceId);
    const targetNode = nextNodeMap.get(edge.targetId);
    if (!sourceNode || !targetNode) {
      return edge;
    }

    return {
      ...edge,
      shape: 'elbow' as const,
      sourceConnection: resolveRelativeConnection(sourceNode, route.start),
      targetConnection: resolveRelativeConnection(targetNode, route.end),
      points: [route.start, route.end] as [Point, Point],
      routing: route.routing,
    };
  });

  return {
    ...baseLayout,
    nodes: nextNodes,
    groups: nextGroups,
    edges: nextEdges,
  };
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
      ] as [Point, Point],
      routing: edge.routing?.map((point) => [point[0] + deltaX, point[1] + deltaY]),
    })),
  };
}

function getBounds(nodes: LayoutNode[]) {
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return {
    minX,
    minY,
    maxX,
    maxY,
  };
}

async function runElkLayout(layout: LayoutResult) {
  const elk = new ELK();
  const graph = buildElkGraph(layout);
  return elk.layout(graph);
}

function buildSelectionSubLayout(
  layout: LayoutResult,
  selectedNodeIds: Set<string>
): LayoutResult {
  const selectedNodes = layout.nodes.filter((node) => selectedNodeIds.has(node.id));
  const selectedNodeSet = new Set(selectedNodes.map((node) => node.id));
  const selectedGroups = layout.groups
    .map((group) => ({
      ...group,
      entityIds: group.entityIds.filter((entityId) => selectedNodeSet.has(entityId)),
    }))
    .filter((group) => group.entityIds.length > 0);
  const selectedNodeMap = new Map(selectedNodes.map((node) => [node.id, node]));
  const recomputedGroups = recomputeLayoutGroups(selectedGroups, selectedNodeMap);
  const selectedEdges = layout.edges.filter(
    (edge) => selectedNodeSet.has(edge.sourceId) && selectedNodeSet.has(edge.targetId)
  );

  return {
    direction: layout.direction,
    nodes: selectedNodes,
    groups: recomputedGroups,
    edges: selectedEdges,
  };
}

function mergeSelectionLayout(
  baseLayout: LayoutResult,
  optimizedSelectionLayout: LayoutResult,
  selectedNodeIds: Set<string>
): LayoutResult {
  const optimizedNodeMap = new Map(
    optimizedSelectionLayout.nodes.map((node) => [node.id, node])
  );
  const optimizedEdgeMap = new Map(
    optimizedSelectionLayout.edges.map((edge) => [edge.id, edge])
  );

  const nextNodes = baseLayout.nodes.map((node) =>
    selectedNodeIds.has(node.id) ? optimizedNodeMap.get(node.id) ?? node : node
  );
  const nextNodeMap = new Map(nextNodes.map((node) => [node.id, node]));
  const nextGroups = recomputeLayoutGroups(baseLayout.groups, nextNodeMap);

  const boundaryEdgeIds = new Set<string>();
  const nextEdges = baseLayout.edges.map((edge) => {
    const sourceSelected = selectedNodeIds.has(edge.sourceId);
    const targetSelected = selectedNodeIds.has(edge.targetId);
    if (sourceSelected && targetSelected) {
      return optimizedEdgeMap.get(edge.id) ?? edge;
    }
    if (sourceSelected || targetSelected) {
      boundaryEdgeIds.add(edge.id);
    }
    return {
      ...edge,
      points: edge.points,
    };
  });

  return {
    ...baseLayout,
    nodes: nextNodes,
    groups: nextGroups,
    edges: buildOptimizedEdgeRoutes(nextEdges, nextNodes, nextGroups, boundaryEdgeIds),
  };
}

export async function computeElkOptimizedLayout(
  analysis: AnalysisResult,
  elements: PlaitElement[],
  options: ElkLayoutOptions
): Promise<LayoutResult> {
  const snapshot = buildSnapshotFromElements(analysis, elements);

  if (options.mode === 'selection') {
    const selectedNodeIds = getSelectionNodeIds(
      options.selection,
      analysis,
      snapshot.layout
    );

    if (selectedNodeIds.size < 2) {
      throw new Error('INVALID_SELECTION');
    }

    const selectionLayout = buildSelectionSubLayout(snapshot.layout, selectedNodeIds);
    const originalBounds = getBounds(selectionLayout.nodes);
    const optimizedSelection = mapElkLayout(
      selectionLayout,
      await runElkLayout(selectionLayout)
    );
    const optimizedBounds = getBounds(optimizedSelection.nodes);
    const translatedSelection = translateLayout(
      optimizedSelection,
      originalBounds.minX - optimizedBounds.minX,
      originalBounds.minY - optimizedBounds.minY
    );

    return mergeSelectionLayout(
      snapshot.layout,
      translatedSelection,
      selectedNodeIds
    );
  }

  const elkLayout = mapElkLayout(snapshot.layout, await runElkLayout(snapshot.layout));
  const edgeIdsToRoute = new Set(
    elkLayout.edges
      .filter((edge) => !edge.routing || edge.routing.length <= 2)
      .map((edge) => edge.id)
  );

  return {
    ...elkLayout,
    edges: buildOptimizedEdgeRoutes(
      elkLayout.edges,
      elkLayout.nodes,
      elkLayout.groups,
      edgeIdsToRoute.size ? edgeIdsToRoute : undefined
    ),
  };
}
