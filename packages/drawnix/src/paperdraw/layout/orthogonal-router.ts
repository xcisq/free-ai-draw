import type { Point } from '@plait/core';
import { PAPERDRAW_LAYOUT_DEFAULTS } from '../config/defaults';
import type {
  LayoutConstraintModel,
  LayoutEdge,
  LayoutGroup,
  LayoutNode,
  LayoutResult,
} from '../types/analyzer';
import { simplifyOrthogonalRoute } from './optimize-layout';

type ConnectionSide = 'left' | 'right' | 'top' | 'bottom';
type SegmentDirection = 'start' | 'horizontal' | 'vertical';

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Obstacle extends Rectangle {
  id: string;
  kind: 'node' | 'group';
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

const SIDE_PORTS = {
  left: [0.2, 0.35, 0.5, 0.65, 0.8],
  right: [0.2, 0.35, 0.5, 0.65, 0.8],
  top: [0.2, 0.35, 0.5, 0.65, 0.8],
  bottom: [0.2, 0.35, 0.5, 0.65, 0.8],
};

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

function pointKey(point: Point) {
  return `${point[0]}:${point[1]}`;
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

function getRoutePoints(edge: LayoutEdge): Point[] {
  return edge.routing && edge.routing.length > 1 ? edge.routing : edge.points;
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

function pointInsideRect(point: Point, rect: Rectangle) {
  return (
    point[0] > rect.x &&
    point[0] < rect.x + rect.width &&
    point[1] > rect.y &&
    point[1] < rect.y + rect.height
  );
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

function sortEdgesForRouting(layout: LayoutResult, nodeToGroup: Map<string, string>) {
  return [...layout.edges].sort((left, right) => {
    const leftCrossModule = nodeToGroup.get(left.sourceId) !== nodeToGroup.get(left.targetId);
    const rightCrossModule = nodeToGroup.get(right.sourceId) !== nodeToGroup.get(right.targetId);
    const leftPriority =
      left.type === 'sequential' ? (leftCrossModule ? 0 : 1) : 2;
    const rightPriority =
      right.type === 'sequential' ? (rightCrossModule ? 0 : 1) : 2;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return left.id.localeCompare(right.id);
  });
}

function chooseBaseConnections(
  edge: LayoutEdge,
  sourceNode: LayoutNode,
  targetNode: LayoutNode,
  model: LayoutConstraintModel
) {
  const dx = targetNode.x - sourceNode.x;
  const dy = targetNode.y - sourceNode.y;

  if (edge.type === 'annotative') {
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

  if (model.mainFlowDirection === 'TB') {
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

function assignConnections(
  layout: LayoutResult,
  model: LayoutConstraintModel,
  edgeIdsToRoute?: Set<string>
) {
  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));
  const nodeToGroup = new Map<string, string>();
  layout.groups.forEach((group) => {
    group.entityIds.forEach((entityId) => nodeToGroup.set(entityId, group.id));
  });
  const usage = new Map<string, number>();

  return sortEdgesForRouting(layout, nodeToGroup).map((edge) => {
    if (edgeIdsToRoute && !edgeIdsToRoute.has(edge.id)) {
      return edge;
    }

    const sourceNode = nodeMap.get(edge.sourceId)!;
    const targetNode = nodeMap.get(edge.targetId)!;
    const base = chooseBaseConnections(edge, sourceNode, targetNode, model);

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
  nodeToGroup: Map<string, string>
) {
  const sourceGroupId = nodeToGroup.get(edge.sourceId);
  const targetGroupId = nodeToGroup.get(edge.targetId);
  const obstacles: Obstacle[] = [];

  layout.nodes.forEach((node) => {
    if (node.id === edge.sourceId || node.id === edge.targetId) {
      return;
    }
    obstacles.push({
      id: node.id,
      kind: 'node',
      ...expandRect(getNodeRect(node), PAPERDRAW_LAYOUT_DEFAULTS.routeNodeObstaclePadding),
    });
  });

  layout.groups.forEach((group) => {
    if (group.id === sourceGroupId || group.id === targetGroupId) {
      return;
    }
    obstacles.push({
      id: group.id,
      kind: 'group',
      ...expandRect(getGroupRect(group), PAPERDRAW_LAYOUT_DEFAULTS.routeGroupObstaclePadding),
    });
  });

  return obstacles;
}

function buildGridCoordinates(
  layout: LayoutResult,
  start: Point,
  end: Point,
  obstacles: Obstacle[]
) {
  const bboxRects = [
    ...layout.nodes.map(getNodeRect),
    ...layout.groups.map(getGroupRect),
  ];
  const minX =
    Math.min(start[0], end[0], ...bboxRects.map((rect) => rect.x)) -
    PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin;
  const maxX =
    Math.max(start[0], end[0], ...bboxRects.map((rect) => rect.x + rect.width)) +
    PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin;
  const minY =
    Math.min(start[1], end[1], ...bboxRects.map((rect) => rect.y)) -
    PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin;
  const maxY =
    Math.max(start[1], end[1], ...bboxRects.map((rect) => rect.y + rect.height)) +
    PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin;

  const xSet = new Set<number>([start[0], end[0], minX, maxX]);
  const ySet = new Set<number>([start[1], end[1], minY, maxY]);

  obstacles.forEach((obstacle) => {
    xSet.add(obstacle.x - PAPERDRAW_LAYOUT_DEFAULTS.routeGridMargin);
    xSet.add(obstacle.x);
    xSet.add(obstacle.x + obstacle.width);
    xSet.add(obstacle.x + obstacle.width + PAPERDRAW_LAYOUT_DEFAULTS.routeGridMargin);
    ySet.add(obstacle.y - PAPERDRAW_LAYOUT_DEFAULTS.routeGridMargin);
    ySet.add(obstacle.y);
    ySet.add(obstacle.y + obstacle.height);
    ySet.add(obstacle.y + obstacle.height + PAPERDRAW_LAYOUT_DEFAULTS.routeGridMargin);
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
  obstacles: Obstacle[]
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
      const left = column[index];
      const right = column[index + 1];
      const blocked = obstacles.some((obstacle) =>
        segmentIntersectsRect(left.point, right.point, obstacle)
      );
      if (!blocked) {
        adjacency.get(left.id)?.push(right.id);
        adjacency.get(right.id)?.push(left.id);
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

function getSegmentDirection(from: Point, to: Point): SegmentDirection {
  if (Math.abs(from[0] - to[0]) < 1e-6) {
    return 'vertical';
  }
  if (Math.abs(from[1] - to[1]) < 1e-6) {
    return 'horizontal';
  }
  return 'start';
}

function computeRouteCost(
  from: Point,
  to: Point,
  previousDirection: SegmentDirection,
  edge: LayoutEdge,
  model: LayoutConstraintModel,
  routedSegments: RouteSegment[]
) {
  const direction = getSegmentDirection(from, to);
  const length = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]);
  const bendPenalty =
    previousDirection !== 'start' && previousDirection !== direction ? 32 : 0;
  const crossings = countCrossingsWithExisting(from, to, routedSegments);
  const congestion = countCongestionWithExisting(from, to, routedSegments);
  let reverseFlow = 0;

  if (edge.type === 'sequential') {
    if (model.mainFlowDirection === 'LR' && to[0] < from[0]) {
      reverseFlow = 200;
    }
    if (model.mainFlowDirection === 'TB' && to[1] < from[1]) {
      reverseFlow = 200;
    }
  }

  return length + bendPenalty + crossings * 120 + reverseFlow + congestion * 40;
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

function routeWithAStar(
  edge: LayoutEdge,
  model: LayoutConstraintModel,
  nodeMap: Map<string, LayoutNode>,
  layout: LayoutResult,
  routedSegments: RouteSegment[],
  nodeToGroup: Map<string, string>
) {
  const sourceNode = nodeMap.get(edge.sourceId)!;
  const targetNode = nodeMap.get(edge.targetId)!;
  const start = getConnectionPoint(sourceNode, edge.sourceConnection);
  const end = getConnectionPoint(targetNode, edge.targetConnection);
  const obstacles = buildObstacles(layout, edge, nodeToGroup);
  const { xs, ys } = buildGridCoordinates(layout, start, end, obstacles);
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
        computeRouteCost(currentPoint, nextPoint, current.dir, edge, model, routedSegments);

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

function fallbackRoute(
  edge: LayoutEdge,
  layout: LayoutResult,
  nodeMap: Map<string, LayoutNode>
) {
  const sourceNode = nodeMap.get(edge.sourceId)!;
  const targetNode = nodeMap.get(edge.targetId)!;
  const start = getConnectionPoint(sourceNode, edge.sourceConnection);
  const end = getConnectionPoint(targetNode, edge.targetConnection);
  const allRects = [
    ...layout.nodes.map(getNodeRect),
    ...layout.groups.map(getGroupRect),
  ];
  const top = Math.min(...allRects.map((rect) => rect.y)) - PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin;
  const bottom =
    Math.max(...allRects.map((rect) => rect.y + rect.height)) +
    PAPERDRAW_LAYOUT_DEFAULTS.routeOuterMargin;

  const route =
    edge.type === 'annotative'
      ? [start, [start[0], bottom] as Point, [end[0], bottom] as Point, end]
      : [start, [start[0], top] as Point, [end[0], top] as Point, end];
  return simplifyOrthogonalRoute(route);
}

export function routeLayoutOrthogonally(
  layout: LayoutResult,
  model: LayoutConstraintModel,
  edgeIdsToRoute?: Set<string>
): LayoutResult {
  const assignedEdges = assignConnections(layout, model, edgeIdsToRoute);
  const nextLayout: LayoutResult = {
    ...layout,
    edges: assignedEdges,
  };
  const nodeMap = new Map(nextLayout.nodes.map((node) => [node.id, node]));
  const nodeToGroup = new Map<string, string>();
  nextLayout.groups.forEach((group) => {
    group.entityIds.forEach((entityId) => nodeToGroup.set(entityId, group.id));
  });
  const routedSegments: RouteSegment[] = [];

  const routedEdges: LayoutEdge[] = sortEdgesForRouting(nextLayout, nodeToGroup).map(
    (edge): LayoutEdge => {
    if (edgeIdsToRoute && !edgeIdsToRoute.has(edge.id)) {
      getRoutePoints(edge).forEach((point: Point, index: number, points: Point[]) => {
        if (index < points.length - 1) {
          routedSegments.push({
            start: point,
            end: points[index + 1],
            edgeId: edge.id,
          });
        }
      });
      return edge;
    }

    const routedPoints =
      routeWithAStar(edge, model, nodeMap, nextLayout, routedSegments, nodeToGroup) ??
      fallbackRoute(edge, nextLayout, nodeMap);
    const simplified = simplifyOrthogonalRoute(routedPoints);

    for (let index = 0; index < simplified.length - 1; index += 1) {
      routedSegments.push({
        start: simplified[index] as Point,
        end: simplified[index + 1] as Point,
        edgeId: edge.id,
      });
    }

    return {
      ...edge,
      shape: simplified.length > 2 ? ('elbow' as const) : ('straight' as const),
      points: [simplified[0], simplified[simplified.length - 1]] as [Point, Point],
      routing: simplified.length > 2 ? simplified : undefined,
    };
    }
  );

  const routedEdgeMap = new Map(routedEdges.map((edge) => [edge.id, edge]));
  return {
    ...nextLayout,
    edges: nextLayout.edges.map((edge) => routedEdgeMap.get(edge.id) ?? edge),
  };
}
