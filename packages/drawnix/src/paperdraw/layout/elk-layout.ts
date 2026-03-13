import type { Point } from '@plait/core';
import ELK, {
  type ElkEdgeSection,
  type ElkExtendedEdge,
  type ElkNode,
  type ElkPoint,
  type LayoutOptions,
} from 'elkjs';
import { PAPERDRAW_LAYOUT_DEFAULTS } from '../config/defaults';
import type {
  LayoutConstraintModel,
  LayoutEdge,
  LayoutGroup,
  LayoutNode,
  LayoutResult,
} from '../types/analyzer';

const ROOT_ID = 'paperdraw-root';

function getElkOptions(model: LayoutConstraintModel): LayoutOptions {
  return {
    'elk.algorithm': 'layered',
    'elk.direction': model.mainFlowDirection === 'LR' ? 'RIGHT' : 'DOWN',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.portConstraints': 'FIXED_SIDE',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.nodePlacement.favorStraightEdges': 'true',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.layered.unnecessaryBendpoints': 'false',
    'elk.layered.spacing.nodeNodeBetweenLayers': String(
      PAPERDRAW_LAYOUT_DEFAULTS.nodeGapX
    ),
    'elk.spacing.nodeNode': String(PAPERDRAW_LAYOUT_DEFAULTS.nodeGapY),
    'elk.padding': '[left=24, top=24, right=24, bottom=24]',
  };
}

function toPoint(point: ElkPoint): Point {
  return [point.x, point.y];
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
    child.edges?.forEach((edge) => result.set(edge.id, edge));
    collectElkEdges(child, result);
  });
  return result;
}

function buildElkGraph(layout: LayoutResult, model: LayoutConstraintModel): ElkNode {
  const groupedNodeIds = new Set(layout.groups.flatMap((group) => group.entityIds));
  const children = [
    ...layout.groups
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
      })),
    ...layout.nodes
      .filter((node) => !groupedNodeIds.has(node.id))
      .map((node) => ({
        id: node.id,
        width: node.width,
        height: node.height,
      })),
  ];

  return {
    id: ROOT_ID,
    layoutOptions: getElkOptions(model),
    children,
    edges: layout.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.sourceId],
      targets: [edge.targetId],
    })),
  };
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
  const routing = [
    toPoint(section.startPoint),
    ...(section.bendPoints ?? []).map(toPoint),
    toPoint(section.endPoint),
  ];
  return {
    start: toPoint(section.startPoint),
    end: toPoint(section.endPoint),
    routing,
  };
}

function updateEdgeEndpoints(
  edge: LayoutEdge,
  nodeMap: Map<string, LayoutNode>,
  route: ReturnType<typeof extractEdgeRoute> | null
) {
  const sourceNode = nodeMap.get(edge.sourceId);
  const targetNode = nodeMap.get(edge.targetId);
  if (!sourceNode || !targetNode || !route) {
    return edge;
  }

  return {
    ...edge,
    shape: 'elbow' as const,
    sourceConnection: resolveRelativeConnection(sourceNode, route.start),
    targetConnection: resolveRelativeConnection(targetNode, route.end),
    points: [route.start, route.end] as [Point, Point],
    routing: route.routing.length > 2 ? route.routing : undefined,
  };
}

function mapElkLayout(layout: LayoutResult, elkGraph: ElkNode): LayoutResult {
  const elkNodeMap = collectElkNodes(elkGraph);
  const elkEdgeMap = collectElkEdges(elkGraph);

  const nodes = layout.nodes.map((node) => {
    const elkNode = elkNodeMap.get(node.id);
    if (elkNode?.x === undefined || elkNode?.y === undefined) {
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
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const groups = layout.groups.map((group) => {
    const elkGroup = elkNodeMap.get(group.id);
    if (
      elkGroup?.x === undefined ||
      elkGroup?.y === undefined ||
      elkGroup.width === undefined ||
      elkGroup.height === undefined
    ) {
      return group;
    }
    return {
      ...group,
      x: elkGroup.x,
      y: elkGroup.y,
      width: elkGroup.width,
      height: elkGroup.height,
    };
  });

  const edges = layout.edges.map((edge) => {
    const elkEdge = elkEdgeMap.get(edge.id);
    return updateEdgeEndpoints(edge, nodeMap, elkEdge ? extractEdgeRoute(elkEdge) : null);
  });

  return {
    ...layout,
    nodes,
    groups,
    edges,
  };
}

export async function refineLayoutWithElk(
  layout: LayoutResult,
  model: LayoutConstraintModel
): Promise<LayoutResult> {
  const elk = new ELK();
  const graph = buildElkGraph(layout, model);
  const result = await elk.layout(graph);
  return mapElkLayout(layout, result);
}
