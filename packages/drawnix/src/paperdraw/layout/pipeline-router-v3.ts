import type { Point } from '@plait/core';
import { PAPERDRAW_LAYOUT_DEFAULTS } from '../config/defaults';
import type {
  LayoutConstraintModel,
  LayoutEdge,
  LayoutGroup,
  LayoutIntent,
  LayoutNode,
  LayoutResult,
  PipelineTemplateId,
  RailPreference,
} from '../types/analyzer';
import { simplifyOrthogonalRoute } from './optimize-layout';
import { routeLayoutOrthogonally } from './orthogonal-router';

export type RouteEdgeClass =
  | 'spine'
  | 'merge'
  | 'aux'
  | 'control'
  | 'feedback'
  | 'annotation';

export interface RouteObstacle {
  id: string;
  kind: 'node' | 'group';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RouteCorridor {
  id:
    | 'main_spine_corridor'
    | 'merge_corridor'
    | 'control_top_corridor'
    | 'aux_bottom_corridor'
    | 'feedback_outer_corridor'
    | 'annotation_side_corridor';
  axis: 'x' | 'y';
  value: number;
}

export interface RoutePath {
  edgeId: string;
  points: Point[];
  edgeClass: RouteEdgeClass;
}

export interface RouteDebugMetrics {
  failedEdgeIds: string[];
  fallbackEdgeIds: string[];
}

export interface RouteIntent {
  edgeClasses: Map<string, RouteEdgeClass>;
  nodeRails: Map<string, RailPreference | undefined>;
  nodeRoles: Map<string, string>;
  nodeToGroup: Map<string, string>;
  corridors: RouteCorridor[];
  spineEdgeIds: Set<string>;
  mergeTargetIds: Set<string>;
  templateId?: PipelineTemplateId;
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GridNode {
  id: string;
  point: Point;
}

interface RouteSegment {
  start: Point;
  end: Point;
  edgeId: string;
}

interface RouteGuide {
  preferredXs: number[];
  preferredYs: number[];
  classPenalty: number;
}

interface RouteFrame {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  mainY: number;
  topControlY: number;
  bottomAuxY: number;
  annotationSideX: number;
  feedbackTopY: number;
  feedbackRightX: number;
}

interface PipelineRouteV3Options {
  edgeIdsToRoute?: Set<string>;
  templateId?: PipelineTemplateId;
}

type ConnectionSide = 'left' | 'right' | 'top' | 'bottom';
type SegmentDirection = 'start' | 'horizontal' | 'vertical';

const SIDE_PORTS = {
  left: [0.18, 0.34, 0.5, 0.66, 0.82],
  right: [0.18, 0.34, 0.5, 0.66, 0.82],
  top: [0.18, 0.34, 0.5, 0.66, 0.82],
  bottom: [0.18, 0.34, 0.5, 0.66, 0.82],
};

const EDGE_PRIORITY: Record<RouteEdgeClass, number> = {
  spine: 0,
  merge: 1,
  control: 2,
  aux: 3,
  feedback: 4,
  annotation: 5,
};

function pointKey(point: Point) {
  return `${point[0]}:${point[1]}`;
}

function getNodeRect(node: LayoutNode): Rectangle {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
}

function getGroupRect(group: LayoutGroup): Rectangle {
  return {
    x: group.x,
    y: group.y,
    width: group.width,
    height: group.height,
  };
}

function expandRect(rect: Rectangle, padding: number): Rectangle {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function getNodeCenter(node: LayoutNode): Point {
  return [node.x + node.width / 2, node.y + node.height / 2];
}

function getConnectionPoint(node: LayoutNode, connection: [number, number]): Point {
  return [
    node.x + node.width * connection[0],
    node.y + node.height * connection[1],
  ];
}

function getConnectionSide(connection: [number, number]): ConnectionSide {
  if (connection[0] === 0) {
    return 'left';
  }
  if (connection[0] === 1) {
    return 'right';
  }
  if (connection[1] === 0) {
    return 'top';
  }
  return 'bottom';
}

function pointInsideRect(point: Point, rect: Rectangle) {
  return (
    point[0] > rect.x &&
    point[0] < rect.x + rect.width &&
    point[1] > rect.y &&
    point[1] < rect.y + rect.height
  );
}

function segmentIntersectsRect(start: Point, end: Point, rect: Rectangle) {
  if (Math.abs(start[0] - end[0]) < 1e-6) {
    const x = start[0];
    const minY = Math.min(start[1], end[1]);
    const maxY = Math.max(start[1], end[1]);
    return (
      x > rect.x &&
      x < rect.x + rect.width &&
      maxY > rect.y &&
      minY < rect.y + rect.height
    );
  }

  if (Math.abs(start[1] - end[1]) < 1e-6) {
    const y = start[1];
    const minX = Math.min(start[0], end[0]);
    const maxX = Math.max(start[0], end[0]);
    return (
      y > rect.y &&
      y < rect.y + rect.height &&
      maxX > rect.x &&
      minX < rect.x + rect.width
    );
  }

  return false;
}

function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point) {
  if (Math.abs(a1[0] - a2[0]) < 1e-6 && Math.abs(b1[1] - b2[1]) < 1e-6) {
    const verticalX = a1[0];
    const horizontalY = b1[1];
    return (
      verticalX > Math.min(b1[0], b2[0]) &&
      verticalX < Math.max(b1[0], b2[0]) &&
      horizontalY > Math.min(a1[1], a2[1]) &&
      horizontalY < Math.max(a1[1], a2[1])
    );
  }

  if (Math.abs(a1[1] - a2[1]) < 1e-6 && Math.abs(b1[0] - b2[0]) < 1e-6) {
    return segmentsIntersect(b1, b2, a1, a2);
  }

  return false;
}

function getSegmentDirection(from: Point, to: Point): SegmentDirection {
  if (Math.abs(from[0] - to[0]) < 1e-6) {
    return 'vertical';
  }
  if (Math.abs(from[1] - to[1]) < 1e-6) {
    return 'horizontal';
  }
  return 'start';
}

function getRoutePoints(edge: LayoutEdge): Point[] {
  return edge.routing && edge.routing.length > 1 ? edge.routing : edge.points;
}

function buildRouteFrame(layout: LayoutResult, intent: LayoutIntent): RouteFrame {
  const allRects = [
    ...layout.nodes.map(getNodeRect),
    ...layout.groups.map(getGroupRect),
  ];
  const minX = Math.min(...allRects.map((rect) => rect.x));
  const minY = Math.min(...allRects.map((rect) => rect.y));
  const maxX = Math.max(...allRects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...allRects.map((rect) => rect.y + rect.height));
  const spineNodeIds = new Set(intent.dominantSpine);
  const spineNodes = layout.nodes.filter((node) => spineNodeIds.has(node.id));
  const spineCentersY = spineNodes.length
    ? spineNodes.reduce((sum, node) => sum + node.y + node.height / 2, 0) /
      spineNodes.length
    : (minY + maxY) / 2;

  return {
    minX,
    minY,
    maxX,
    maxY,
    mainY: spineCentersY,
    topControlY:
      minY -
      PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin -
      PAPERDRAW_LAYOUT_DEFAULTS.routePipelineCorridorOffset,
    bottomAuxY:
      maxY +
      PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin +
      PAPERDRAW_LAYOUT_DEFAULTS.routePipelineCorridorOffset,
    annotationSideX:
      maxX +
      PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin +
      PAPERDRAW_LAYOUT_DEFAULTS.routePipelineCorridorOffset,
    feedbackTopY:
      minY -
      PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin -
      PAPERDRAW_LAYOUT_DEFAULTS.routePipelineFeedbackOffset,
    feedbackRightX:
      maxX +
      PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin +
      PAPERDRAW_LAYOUT_DEFAULTS.routePipelineFeedbackOffset,
  };
}

function buildPipelineRouteIntent(
  layout: LayoutResult,
  intent: LayoutIntent,
  templateId?: PipelineTemplateId
): RouteIntent {
  const nodeRails = new Map(intent.nodes.map((node) => [node.id, node.preferredRail]));
  const nodeRoles = new Map(intent.nodes.map((node) => [node.id, node.role]));
  const nodeToGroup = new Map<string, string>();
  layout.groups.forEach((group) => {
    group.entityIds.forEach((entityId) => nodeToGroup.set(entityId, group.id));
  });
  const mergeClusterSourceIds = new Map<string, Set<string>>();
  intent.mergeClusters.forEach((cluster) => {
    mergeClusterSourceIds.set(cluster.mergeNodeId, new Set(cluster.sourceIds));
  });
  const spineEdgeIds = new Set<string>();
  for (let index = 0; index < intent.dominantSpine.length - 1; index += 1) {
    const sourceId = intent.dominantSpine[index];
    const targetId = intent.dominantSpine[index + 1];
    const edge = intent.edges.find(
      (candidate) =>
        candidate.sourceId === sourceId && candidate.targetId === targetId
    );
    if (edge) {
      spineEdgeIds.add(edge.id);
    }
  }

  const edgeClasses = new Map<string, RouteEdgeClass>();
  intent.edges.forEach((edge) => {
    if (edge.role === 'feedback' || intent.feedbackEdges.includes(edge.id)) {
      edgeClasses.set(edge.id, 'feedback');
      return;
    }
    if (edge.role === 'annotation') {
      edgeClasses.set(edge.id, 'annotation');
      return;
    }
    if (edge.role === 'control') {
      edgeClasses.set(edge.id, 'control');
      return;
    }
    if (
      mergeClusterSourceIds.get(edge.targetId)?.has(edge.sourceId) ||
      intent.mergeNodes.includes(edge.targetId)
    ) {
      edgeClasses.set(edge.id, 'merge');
      return;
    }
    if (edge.role === 'auxiliary') {
      edgeClasses.set(edge.id, 'aux');
      return;
    }
    if (spineEdgeIds.has(edge.id)) {
      edgeClasses.set(edge.id, 'spine');
      return;
    }
    edgeClasses.set(edge.id, 'aux');
  });

  const frame = buildRouteFrame(layout, intent);
  const corridors: RouteCorridor[] = [
    { id: 'main_spine_corridor', axis: 'y', value: frame.mainY },
    { id: 'merge_corridor', axis: 'x', value: frame.mainY },
    { id: 'control_top_corridor', axis: 'y', value: frame.topControlY },
    { id: 'aux_bottom_corridor', axis: 'y', value: frame.bottomAuxY },
    { id: 'feedback_outer_corridor', axis: 'x', value: frame.feedbackRightX },
    { id: 'feedback_outer_corridor', axis: 'y', value: frame.feedbackTopY },
    { id: 'annotation_side_corridor', axis: 'x', value: frame.annotationSideX },
  ];

  return {
    edgeClasses,
    nodeRails,
    nodeRoles,
    nodeToGroup,
    corridors,
    spineEdgeIds,
    mergeTargetIds: new Set(intent.mergeNodes),
    templateId,
  };
}

function getEdgeClass(routeIntent: RouteIntent, edgeId: string): RouteEdgeClass {
  return routeIntent.edgeClasses.get(edgeId) ?? 'aux';
}

function sortEdgesForRouting(layout: LayoutResult, routeIntent: RouteIntent) {
  return [...layout.edges].sort((left, right) => {
    const leftClass = getEdgeClass(routeIntent, left.id);
    const rightClass = getEdgeClass(routeIntent, right.id);
    if (EDGE_PRIORITY[leftClass] !== EDGE_PRIORITY[rightClass]) {
      return EDGE_PRIORITY[leftClass] - EDGE_PRIORITY[rightClass];
    }
    return left.id.localeCompare(right.id);
  });
}

function resolveConnectionsForClass(
  edge: LayoutEdge,
  edgeClass: RouteEdgeClass,
  sourceNode: LayoutNode,
  targetNode: LayoutNode,
  routeIntent: RouteIntent,
  model: LayoutConstraintModel
) {
  const dx = targetNode.x - sourceNode.x;
  const dy = targetNode.y - sourceNode.y;
  const sourceRail = routeIntent.nodeRails.get(edge.sourceId);
  const targetRail = routeIntent.nodeRails.get(edge.targetId);

  if (edgeClass === 'feedback') {
    return {
      sourceConnection: [1, 0.34] as [number, number],
      targetConnection: [0, 0.34] as [number, number],
    };
  }

  if (edgeClass === 'annotation') {
    return Math.abs(dx) >= Math.abs(dy)
      ? dx >= 0
        ? {
            sourceConnection: [1, 0.5] as [number, number],
            targetConnection: [0, 0.5] as [number, number],
          }
        : {
            sourceConnection: [0, 0.5] as [number, number],
            targetConnection: [1, 0.5] as [number, number],
          }
      : dy >= 0
        ? {
            sourceConnection: [0.5, 1] as [number, number],
            targetConnection: [0.5, 0] as [number, number],
          }
        : {
            sourceConnection: [0.5, 0] as [number, number],
            targetConnection: [0.5, 1] as [number, number],
          };
  }

  if (
    edgeClass === 'control' ||
    sourceRail === 'top_control_rail' ||
    targetRail === 'top_control_rail'
  ) {
    return {
      sourceConnection: [0.5, 1] as [number, number],
      targetConnection: [0.5, 0] as [number, number],
    };
  }

  if (
    edgeClass === 'aux' &&
    (sourceRail === 'bottom_aux_rail' || targetRail === 'bottom_aux_rail' || dy < 0)
  ) {
    return {
      sourceConnection: [0.5, 0] as [number, number],
      targetConnection: [0.5, 1] as [number, number],
    };
  }

  if (edgeClass === 'merge') {
    if (Math.abs(dy) > Math.abs(dx)) {
      return dy >= 0
        ? {
            sourceConnection: [0.5, 1] as [number, number],
            targetConnection: [0.5, 0] as [number, number],
          }
        : {
            sourceConnection: [0.5, 0] as [number, number],
            targetConnection: [0.5, 1] as [number, number],
          };
    }

    return dx >= 0
      ? {
          sourceConnection: [1, 0.5] as [number, number],
          targetConnection: [0, 0.5] as [number, number],
        }
      : {
          sourceConnection: [0, 0.5] as [number, number],
          targetConnection: [1, 0.5] as [number, number],
        };
  }

  if (model.mainFlowDirection === 'TB' && Math.abs(dy) >= Math.abs(dx)) {
    return dy >= 0
      ? {
          sourceConnection: [0.5, 1] as [number, number],
          targetConnection: [0.5, 0] as [number, number],
        }
      : {
          sourceConnection: [0.5, 0] as [number, number],
          targetConnection: [0.5, 1] as [number, number],
        };
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? {
          sourceConnection: [1, 0.5] as [number, number],
          targetConnection: [0, 0.5] as [number, number],
        }
      : {
          sourceConnection: [0, 0.5] as [number, number],
          targetConnection: [1, 0.5] as [number, number],
        };
  }

  return dy >= 0
    ? {
        sourceConnection: [0.5, 1] as [number, number],
        targetConnection: [0.5, 0] as [number, number],
      }
    : {
        sourceConnection: [0.5, 0] as [number, number],
        targetConnection: [0.5, 1] as [number, number],
      };
}

function assignConnectionsByClass(
  layout: LayoutResult,
  routeIntent: RouteIntent,
  model: LayoutConstraintModel,
  edgeIdsToRoute?: Set<string>
) {
  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));
  const usage = new Map<string, number>();

  return sortEdgesForRouting(layout, routeIntent).map((edge) => {
    if (edgeIdsToRoute && !edgeIdsToRoute.has(edge.id)) {
      return edge;
    }

    const sourceNode = nodeMap.get(edge.sourceId)!;
    const targetNode = nodeMap.get(edge.targetId)!;
    const base = resolveConnectionsForClass(
      edge,
      getEdgeClass(routeIntent, edge.id),
      sourceNode,
      targetNode,
      routeIntent,
      model
    );
    const sourceSide = getConnectionSide(base.sourceConnection);
    const targetSide = getConnectionSide(base.targetConnection);
    const sourceUsageKey = `${sourceNode.id}:${sourceSide}`;
    const targetUsageKey = `${targetNode.id}:${targetSide}`;
    const sourceIndex = usage.get(sourceUsageKey) ?? 0;
    const targetIndex = usage.get(targetUsageKey) ?? 0;
    usage.set(sourceUsageKey, sourceIndex + 1);
    usage.set(targetUsageKey, targetIndex + 1);

    const sourceConnection =
      sourceSide === 'left' || sourceSide === 'right'
        ? [base.sourceConnection[0], SIDE_PORTS[sourceSide][sourceIndex % SIDE_PORTS[sourceSide].length]] as [number, number]
        : [SIDE_PORTS[sourceSide][sourceIndex % SIDE_PORTS[sourceSide].length], base.sourceConnection[1]] as [number, number];
    const targetConnection =
      targetSide === 'left' || targetSide === 'right'
        ? [base.targetConnection[0], SIDE_PORTS[targetSide][targetIndex % SIDE_PORTS[targetSide].length]] as [number, number]
        : [SIDE_PORTS[targetSide][targetIndex % SIDE_PORTS[targetSide].length], base.targetConnection[1]] as [number, number];

    return {
      ...edge,
      sourceConnection,
      targetConnection,
      points: [
        getConnectionPoint(sourceNode, sourceConnection),
        getConnectionPoint(targetNode, targetConnection),
      ] as [Point, Point],
      routing: undefined,
    };
  });
}

function buildObstacles(
  layout: LayoutResult,
  edge: LayoutEdge,
  routeIntent: RouteIntent
) {
  const sourceGroupId = routeIntent.nodeToGroup.get(edge.sourceId);
  const targetGroupId = routeIntent.nodeToGroup.get(edge.targetId);
  const obstacles: RouteObstacle[] = [];

  layout.nodes.forEach((node) => {
    if (node.id === edge.sourceId || node.id === edge.targetId) {
      return;
    }
    obstacles.push({
      id: node.id,
      kind: 'node',
      ...expandRect(
        getNodeRect(node),
        PAPERDRAW_LAYOUT_DEFAULTS.routeNodeObstaclePadding
      ),
    });
  });

  layout.groups.forEach((group) => {
    if (group.id === sourceGroupId || group.id === targetGroupId) {
      return;
    }
    obstacles.push({
      id: group.id,
      kind: 'group',
      ...expandRect(
        getGroupRect(group),
        PAPERDRAW_LAYOUT_DEFAULTS.routeGroupObstaclePadding
      ),
    });
  });

  return obstacles;
}

function buildRouteGuide(
  edge: LayoutEdge,
  edgeClass: RouteEdgeClass,
  frame: RouteFrame
): RouteGuide {
  const start = edge.points[0];
  const end = edge.points[1];
  switch (edgeClass) {
    case 'spine':
      return {
        preferredXs: [],
        preferredYs: [frame.mainY],
        classPenalty: PAPERDRAW_LAYOUT_DEFAULTS.routePipelineGuideLoosePenalty,
      };
    case 'control':
      return {
        preferredXs: [],
        preferredYs: [frame.topControlY],
        classPenalty: PAPERDRAW_LAYOUT_DEFAULTS.routePipelineGuidePenalty,
      };
    case 'aux':
      return {
        preferredXs: [],
        preferredYs: [frame.bottomAuxY],
        classPenalty: PAPERDRAW_LAYOUT_DEFAULTS.routePipelineGuidePenalty,
      };
    case 'feedback':
      return {
        preferredXs: [frame.feedbackRightX],
        preferredYs: [frame.feedbackTopY],
        classPenalty: PAPERDRAW_LAYOUT_DEFAULTS.routePipelineGuidePenalty + 12,
      };
    case 'annotation':
      return {
        preferredXs: [frame.annotationSideX],
        preferredYs: [],
        classPenalty: PAPERDRAW_LAYOUT_DEFAULTS.routePipelineGuidePenalty,
      };
    case 'merge':
    default:
      return {
        preferredXs: [Math.min(start[0], end[0]) + Math.abs(end[0] - start[0]) / 2],
        preferredYs: [end[1]],
        classPenalty: PAPERDRAW_LAYOUT_DEFAULTS.routePipelineGuideLoosePenalty + 4,
      };
  }
}

function buildGridCoordinates(
  start: Point,
  end: Point,
  obstacles: RouteObstacle[],
  guide: RouteGuide,
  frame: RouteFrame
) {
  const minX = frame.minX - PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin;
  const maxX = frame.maxX + PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin;
  const minY = frame.minY - PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin;
  const maxY = frame.maxY + PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin;
  const xSet = new Set<number>([
    start[0],
    end[0],
    minX,
    maxX,
    ...guide.preferredXs,
  ]);
  const ySet = new Set<number>([
    start[1],
    end[1],
    minY,
    maxY,
    ...guide.preferredYs,
  ]);

  obstacles.forEach((obstacle) => {
    xSet.add(obstacle.x - PAPERDRAW_LAYOUT_DEFAULTS.routeGridMargin);
    xSet.add(obstacle.x);
    xSet.add(obstacle.x + obstacle.width);
    xSet.add(
      obstacle.x +
        obstacle.width +
        PAPERDRAW_LAYOUT_DEFAULTS.routeGridMargin
    );
    ySet.add(obstacle.y - PAPERDRAW_LAYOUT_DEFAULTS.routeGridMargin);
    ySet.add(obstacle.y);
    ySet.add(obstacle.y + obstacle.height);
    ySet.add(
      obstacle.y +
        obstacle.height +
        PAPERDRAW_LAYOUT_DEFAULTS.routeGridMargin
    );
  });

  return {
    xs: [...xSet].sort((left, right) => left - right),
    ys: [...ySet].sort((left, right) => left - right),
  };
}

function buildGridGraph(
  start: Point,
  end: Point,
  xs: number[],
  ys: number[],
  obstacles: RouteObstacle[]
) {
  const startKey = pointKey(start);
  const endKey = pointKey(end);
  const nodes: GridNode[] = [];
  const nodeMap = new Map<string, GridNode>();

  xs.forEach((x) => {
    ys.forEach((y) => {
      const point = [x, y] as Point;
      const key = pointKey(point);
      const blocked =
        key !== startKey &&
        key !== endKey &&
        obstacles.some((obstacle) => pointInsideRect(point, obstacle));
      if (blocked) {
        return;
      }
      const node = { id: key, point };
      nodes.push(node);
      nodeMap.set(key, node);
    });
  });

  const adjacency = new Map<string, string[]>();
  const byX = new Map<number, GridNode[]>();
  const byY = new Map<number, GridNode[]>();

  nodes.forEach((node) => {
    byX.set(node.point[0], [...(byX.get(node.point[0]) ?? []), node]);
    byY.set(node.point[1], [...(byY.get(node.point[1]) ?? []), node]);
    adjacency.set(node.id, []);
  });

  byX.forEach((column) => {
    column.sort((left, right) => left.point[1] - right.point[1]);
    for (let index = 0; index < column.length - 1; index += 1) {
      const top = column[index];
      const bottom = column[index + 1];
      const blocked = obstacles.some((obstacle) =>
        segmentIntersectsRect(top.point, bottom.point, obstacle)
      );
      if (!blocked) {
        adjacency.get(top.id)?.push(bottom.id);
        adjacency.get(bottom.id)?.push(top.id);
      }
    }
  });

  byY.forEach((row) => {
    row.sort((left, right) => left.point[0] - right.point[0]);
    for (let index = 0; index < row.length - 1; index += 1) {
      const left = row[index];
      const right = row[index + 1];
      const blocked = obstacles.some((obstacle) =>
        segmentIntersectsRect(left.point, right.point, obstacle)
      );
      if (!blocked) {
        adjacency.get(left.id)?.push(right.id);
        adjacency.get(right.id)?.push(left.id);
      }
    }
  });

  return { nodeMap, adjacency };
}

function countCrossingsWithExisting(
  start: Point,
  end: Point,
  routedSegments: RouteSegment[]
) {
  return routedSegments.reduce((count, segment) => {
    if (segmentsIntersect(start, end, segment.start, segment.end)) {
      return count + 1;
    }
    return count;
  }, 0);
}

function countCongestionWithExisting(
  start: Point,
  end: Point,
  routedSegments: RouteSegment[]
) {
  return routedSegments.reduce((count, segment) => {
    const sameVertical =
      Math.abs(start[0] - end[0]) < 1e-6 &&
      Math.abs(segment.start[0] - segment.end[0]) < 1e-6 &&
      start[0] === segment.start[0] &&
      Math.max(Math.min(start[1], end[1]), Math.min(segment.start[1], segment.end[1])) <
        Math.min(Math.max(start[1], end[1]), Math.max(segment.start[1], segment.end[1]));
    const sameHorizontal =
      Math.abs(start[1] - end[1]) < 1e-6 &&
      Math.abs(segment.start[1] - segment.end[1]) < 1e-6 &&
      start[1] === segment.start[1] &&
      Math.max(Math.min(start[0], end[0]), Math.min(segment.start[0], segment.end[0])) <
        Math.min(Math.max(start[0], end[0]), Math.max(segment.start[0], segment.end[0]));
    return sameVertical || sameHorizontal ? count + 1 : count;
  }, 0);
}

function matchesGuideLine(value: number, guides: number[]) {
  return guides.some((guideValue) => Math.abs(guideValue - value) < 1e-6);
}

function computeGuidePenalty(
  from: Point,
  to: Point,
  guide: RouteGuide,
  previousDirection: SegmentDirection
) {
  const direction = getSegmentDirection(from, to);
  const onPreferredX =
    direction === 'vertical' &&
    matchesGuideLine(from[0], guide.preferredXs) &&
    matchesGuideLine(to[0], guide.preferredXs);
  const onPreferredY =
    direction === 'horizontal' &&
    matchesGuideLine(from[1], guide.preferredYs) &&
    matchesGuideLine(to[1], guide.preferredYs);

  if (onPreferredX || onPreferredY) {
    return 0;
  }

  if (previousDirection === 'start') {
    return PAPERDRAW_LAYOUT_DEFAULTS.routePipelineGuideLoosePenalty;
  }

  return guide.classPenalty;
}

function computeRouteCost(
  from: Point,
  to: Point,
  previousDirection: SegmentDirection,
  edgeClass: RouteEdgeClass,
  model: LayoutConstraintModel,
  routedSegments: RouteSegment[],
  guide: RouteGuide
) {
  const direction = getSegmentDirection(from, to);
  const length = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]);
  const bendPenalty =
    previousDirection !== 'start' && previousDirection !== direction ? 32 : 0;
  const crossings = countCrossingsWithExisting(from, to, routedSegments);
  const congestion = countCongestionWithExisting(from, to, routedSegments);
  const guidePenalty = computeGuidePenalty(from, to, guide, previousDirection);
  let reverseFlow = 0;

  if (edgeClass === 'spine' || edgeClass === 'merge') {
    if (model.mainFlowDirection === 'LR' && to[0] < from[0]) {
      reverseFlow = 200;
    }
    if (model.mainFlowDirection === 'TB' && to[1] < from[1]) {
      reverseFlow = 200;
    }
  }

  return (
    length +
    bendPenalty +
    crossings * 120 +
    reverseFlow +
    congestion * 40 +
    guidePenalty
  );
}

function reconstructPath(
  cameFrom: Map<string, string>,
  endStateKey: string,
  statePoints: Map<string, Point>
) {
  const points: Point[] = [];
  let currentKey: string | undefined = endStateKey;
  while (currentKey) {
    points.push(statePoints.get(currentKey)!);
    currentKey = cameFrom.get(currentKey);
  }
  return points.reverse();
}

function routeEdgeWithAStar(
  edge: LayoutEdge,
  edgeClass: RouteEdgeClass,
  model: LayoutConstraintModel,
  layout: LayoutResult,
  routeIntent: RouteIntent,
  frame: RouteFrame,
  routedSegments: RouteSegment[]
) {
  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));
  const sourceNode = nodeMap.get(edge.sourceId)!;
  const targetNode = nodeMap.get(edge.targetId)!;
  const start = getConnectionPoint(sourceNode, edge.sourceConnection);
  const end = getConnectionPoint(targetNode, edge.targetConnection);
  const guide = buildRouteGuide(edge, edgeClass, frame);
  const obstacles = buildObstacles(layout, edge, routeIntent);
  const { xs, ys } = buildGridCoordinates(start, end, obstacles, guide, frame);
  const { nodeMap: gridNodeMap, adjacency } = buildGridGraph(start, end, xs, ys, obstacles);
  const startKey = pointKey(start);
  const endKey = pointKey(end);

  const open: Array<{ key: string; dir: SegmentDirection; f: number }> = [
    { key: `${startKey}|start`, dir: 'start', f: 0 },
  ];
  const gScore = new Map<string, number>([[`${startKey}|start`, 0]]);
  const cameFrom = new Map<string, string>();
  const statePoints = new Map<string, Point>([[`${startKey}|start`, start]]);

  while (open.length) {
    open.sort((left, right) => left.f - right.f);
    const current = open.shift()!;
    const currentPoint = statePoints.get(current.key)!;
    if (pointKey(currentPoint) === endKey) {
      return simplifyOrthogonalRoute(reconstructPath(cameFrom, current.key, statePoints));
    }

    for (const nextPointKey of adjacency.get(pointKey(currentPoint)) ?? []) {
      const nextPoint = gridNodeMap.get(nextPointKey)?.point;
      if (!nextPoint) {
        continue;
      }
      const nextDir = getSegmentDirection(currentPoint, nextPoint);
      const nextStateKey = `${nextPointKey}|${nextDir}`;
      const tentativeG =
        (gScore.get(current.key) ?? Number.POSITIVE_INFINITY) +
        computeRouteCost(
          currentPoint,
          nextPoint,
          current.dir,
          edgeClass,
          model,
          routedSegments,
          guide
        );

      if (tentativeG >= (gScore.get(nextStateKey) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }

      cameFrom.set(nextStateKey, current.key);
      gScore.set(nextStateKey, tentativeG);
      statePoints.set(nextStateKey, nextPoint);
      const heuristic =
        Math.abs(end[0] - nextPoint[0]) + Math.abs(end[1] - nextPoint[1]);
      open.push({
        key: nextStateKey,
        dir: nextDir,
        f: tentativeG + heuristic,
      });
    }
  }

  return null;
}

function buildPathFromPartialRoute(
  edge: LayoutEdge,
  points: Point[]
): LayoutEdge {
  const simplified = simplifyOrthogonalRoute(points);
  return {
    ...edge,
    shape: simplified.length > 2 ? 'elbow' : 'straight',
    points: [simplified[0], simplified[simplified.length - 1]] as [Point, Point],
    routing: simplified.length > 2 ? simplified : undefined,
  };
}

function getEdgeIdsForFallback(
  layout: LayoutResult,
  failedEdgeIds: Set<string>,
  edgeIdsToRoute?: Set<string>
) {
  if (!failedEdgeIds.size) {
    return undefined;
  }
  if (!edgeIdsToRoute) {
    return failedEdgeIds;
  }
  return new Set(
    [...layout.edges]
      .filter((edge) => edgeIdsToRoute.has(edge.id) && failedEdgeIds.has(edge.id))
      .map((edge) => edge.id)
  );
}

export function routePipelineLayoutV3(
  layout: LayoutResult,
  model: LayoutConstraintModel,
  intent: LayoutIntent,
  options: PipelineRouteV3Options = {}
): LayoutResult {
  const routeIntent = buildPipelineRouteIntent(
    layout,
    intent,
    options.templateId ?? layout.templateId
  );
  const frame = buildRouteFrame(layout, intent);
  const assignedEdges = assignConnectionsByClass(
    layout,
    routeIntent,
    model,
    options.edgeIdsToRoute
  );
  const nextLayout: LayoutResult = {
    ...layout,
    edges: assignedEdges,
    routingEngine: 'pipeline_v3',
  };
  const routedSegments: RouteSegment[] = [];
  const failedEdgeIds = new Set<string>();

  const routedEdges = sortEdgesForRouting(nextLayout, routeIntent).map((edge) => {
    if (options.edgeIdsToRoute && !options.edgeIdsToRoute.has(edge.id)) {
      const points = getRoutePoints(edge);
      for (let index = 0; index < points.length - 1; index += 1) {
        routedSegments.push({
          start: points[index] as Point,
          end: points[index + 1] as Point,
          edgeId: edge.id,
        });
      }
      return edge;
    }

    const edgeClass = getEdgeClass(routeIntent, edge.id);
    const points = routeEdgeWithAStar(
      edge,
      edgeClass,
      model,
      nextLayout,
      routeIntent,
      frame,
      routedSegments
    );

    if (!points) {
      failedEdgeIds.add(edge.id);
      return edge;
    }

    const nextEdge = buildPathFromPartialRoute(edge, points);
    const routePoints = getRoutePoints(nextEdge);
    for (let index = 0; index < routePoints.length - 1; index += 1) {
      routedSegments.push({
        start: routePoints[index] as Point,
        end: routePoints[index + 1] as Point,
        edgeId: edge.id,
      });
    }
    return nextEdge;
  });

  const routedMap = new Map(routedEdges.map((edge) => [edge.id, edge]));
  const partiallyRoutedLayout: LayoutResult = {
    ...nextLayout,
    edges: nextLayout.edges.map((edge) => routedMap.get(edge.id) ?? edge),
  };

  const fallbackEdgeIds = getEdgeIdsForFallback(
    nextLayout,
    failedEdgeIds,
    options.edgeIdsToRoute
  );
  if (!fallbackEdgeIds?.size) {
    return partiallyRoutedLayout;
  }

  const fallbackRouted = routeLayoutOrthogonally(
    {
      ...partiallyRoutedLayout,
      routingEngine: 'orthogonal_v1',
      routeFallbackFrom: 'pipeline_v3',
    },
    model,
    fallbackEdgeIds
  );

  return {
    ...fallbackRouted,
    routingEngine: 'orthogonal_v1',
    routeFallbackFrom: 'pipeline_v3',
  };
}
