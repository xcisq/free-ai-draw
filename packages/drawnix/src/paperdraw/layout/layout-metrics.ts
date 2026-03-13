import type { Point } from '@plait/core';
import type {
  LayoutConstraintModel,
  LayoutEdge,
  LayoutGroup,
  LayoutMetrics,
  LayoutNode,
  LayoutResult,
} from '../types/analyzer';

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EMPTY_METRICS: LayoutMetrics = {
  blankSpaceScore: 0,
  vifScore: 0,
  aspectRatioPenalty: 0,
  alignmentPenalty: 0,
  groupingPenalty: 0,
  estimatedCrossings: 0,
  bends: 0,
  routeLength: 0,
  hardConstraintViolations: 0,
  totalScore: 0,
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

function rectContainsRect(outer: Rectangle, inner: Rectangle) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function rectsOverlap(left: Rectangle, right: Rectangle) {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

function getBoundingBox(nodes: LayoutNode[], groups: LayoutGroup[]) {
  const rects = [
    ...nodes.map(getNodeRect),
    ...groups.map(getGroupRect),
  ];
  if (!rects.length) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getNodeCenter(node: LayoutNode): Point {
  return [node.x + node.width / 2, node.y + node.height / 2];
}

function getRoutePoints(edge: LayoutEdge) {
  return edge.routing && edge.routing.length > 1 ? edge.routing : edge.points;
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
    const minY = Math.min(start[1], end[1]);
    const maxY = Math.max(start[1], end[1]);
    const x = start[0];
    return (
      x > rect.x &&
      x < rect.x + rect.width &&
      maxY > rect.y &&
      minY < rect.y + rect.height
    );
  }

  if (Math.abs(start[1] - end[1]) < 1e-6) {
    const minX = Math.min(start[0], end[0]);
    const maxX = Math.max(start[0], end[0]);
    const y = start[1];
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

function getEdgeSegments(edge: LayoutEdge): Array<[Point, Point]> {
  const points = getRoutePoints(edge);
  const segments: Array<[Point, Point]> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push([points[index] as Point, points[index + 1] as Point]);
  }
  return segments;
}

function computeBlankSpaceScore(layout: LayoutResult) {
  const bbox = getBoundingBox(layout.nodes, layout.groups);
  const bboxArea = Math.max(bbox.width * bbox.height, 1);
  const occupiedArea = layout.nodes.reduce(
    (sum, node) => sum + node.width * node.height,
    0
  );
  return Math.max(0, 1 - occupiedArea / bboxArea);
}

function computeVifScore(layout: LayoutResult, model: LayoutConstraintModel) {
  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));
  let penalty = 0;

  model.sequentialEdges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);
    if (!sourceNode || !targetNode) {
      return;
    }
    const [sx, sy] = getNodeCenter(sourceNode);
    const [tx, ty] = getNodeCenter(targetNode);
    const dx = tx - sx;
    const dy = ty - sy;
    const length = Math.max(Math.abs(dx) + Math.abs(dy), 1);

    if (model.mainFlowDirection === 'LR') {
      if (dx < 0) {
        penalty += 1;
      }
      penalty += Math.abs(dy) / length;
    } else {
      if (dy < 0) {
        penalty += 1;
      }
      penalty += Math.abs(dx) / length;
    }
  });

  return penalty / Math.max(model.sequentialEdges.length, 1);
}

function computeAspectRatioPenalty(layout: LayoutResult, model: LayoutConstraintModel) {
  const bbox = getBoundingBox(layout.nodes, layout.groups);
  const ratio = bbox.width / Math.max(bbox.height, 1);
  return Math.abs(ratio - model.profile.targetAspectRatio) / model.profile.targetAspectRatio;
}

function computeAlignmentPenalty(layout: LayoutResult) {
  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));
  let penalty = 0;
  let comparisons = 0;

  layout.groups.forEach((group) => {
    const nodes = group.entityIds
      .map((entityId) => nodeMap.get(entityId))
      .filter((node): node is LayoutNode => Boolean(node));
    const rows = new Map<number, number[]>();
    const columns = new Map<number, number[]>();

    nodes.forEach((node) => {
      rows.set(node.row ?? 0, [...(rows.get(node.row ?? 0) ?? []), node.y]);
      columns.set(
        node.column ?? 0,
        [...(columns.get(node.column ?? 0) ?? []), node.x]
      );
    });

    rows.forEach((values) => {
      if (values.length < 2) {
        return;
      }
      const baseline = values[0];
      values.slice(1).forEach((value) => {
        penalty += Math.abs(value - baseline);
        comparisons += 1;
      });
    });

    columns.forEach((values) => {
      if (values.length < 2) {
        return;
      }
      const baseline = values[0];
      values.slice(1).forEach((value) => {
        penalty += Math.abs(value - baseline);
        comparisons += 1;
      });
    });
  });

  return comparisons ? penalty / comparisons : 0;
}

function computeGroupingPenalty(layout: LayoutResult) {
  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));
  let totalPenalty = 0;

  layout.groups.forEach((group) => {
    const memberNodes = group.entityIds
      .map((entityId) => nodeMap.get(entityId))
      .filter((node): node is LayoutNode => Boolean(node));
    if (memberNodes.length <= 1) {
      return;
    }
    const centerX =
      memberNodes.reduce((sum, node) => sum + node.x + node.width / 2, 0) /
      memberNodes.length;
    const centerY =
      memberNodes.reduce((sum, node) => sum + node.y + node.height / 2, 0) /
      memberNodes.length;
    const spread =
      memberNodes.reduce((sum, node) => {
        const dx = node.x + node.width / 2 - centerX;
        const dy = node.y + node.height / 2 - centerY;
        return sum + Math.sqrt(dx * dx + dy * dy);
      }, 0) / memberNodes.length;

    totalPenalty += spread / Math.max(group.width + group.height, 1);
  });

  return totalPenalty / Math.max(layout.groups.length, 1);
}

function computeEstimatedCrossings(layout: LayoutResult) {
  let crossings = 0;
  for (let index = 0; index < layout.edges.length; index += 1) {
    const leftEdge = layout.edges[index];
    const leftSegments = getEdgeSegments(leftEdge);
    for (let inner = index + 1; inner < layout.edges.length; inner += 1) {
      const rightEdge = layout.edges[inner];
      if (
        leftEdge.sourceId === rightEdge.sourceId ||
        leftEdge.sourceId === rightEdge.targetId ||
        leftEdge.targetId === rightEdge.sourceId ||
        leftEdge.targetId === rightEdge.targetId
      ) {
        continue;
      }
      const rightSegments = getEdgeSegments(rightEdge);
      if (
        leftSegments.some(([a1, a2]) =>
          rightSegments.some(([b1, b2]) => segmentsIntersect(a1, a2, b1, b2))
        )
      ) {
        crossings += 1;
      }
    }
  }
  return crossings;
}

function computeRouteStats(layout: LayoutResult) {
  let bends = 0;
  let routeLength = 0;

  layout.edges.forEach((edge) => {
    const points = getRoutePoints(edge);
    bends += Math.max(points.length - 2, 0);
    for (let index = 0; index < points.length - 1; index += 1) {
      routeLength +=
        Math.abs(points[index + 1][0] - points[index][0]) +
        Math.abs(points[index + 1][1] - points[index][1]);
    }
  });

  return { bends, routeLength };
}

function countHardConstraintViolations(
  layout: LayoutResult,
  model: LayoutConstraintModel
) {
  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));
  const groupMap = new Map(layout.groups.map((group) => [group.id, group]));
  const nodeToGroup = new Map<string, string>();
  layout.groups.forEach((group) => {
    group.entityIds.forEach((entityId) => nodeToGroup.set(entityId, group.id));
  });

  let violations = 0;

  for (let index = 0; index < layout.nodes.length; index += 1) {
    const left = getNodeRect(layout.nodes[index]);
    for (let inner = index + 1; inner < layout.nodes.length; inner += 1) {
      const right = getNodeRect(layout.nodes[inner]);
      if (rectsOverlap(left, right)) {
        violations += 1;
      }
    }
  }

  layout.groups.forEach((group) => {
    const groupRect = getGroupRect(group);
    group.entityIds.forEach((entityId) => {
      const node = nodeMap.get(entityId);
      if (node && !rectContainsRect(groupRect, getNodeRect(node))) {
        violations += 1;
      }
    });
  });

  model.sequentialEdges.forEach((edge) => {
    const source = nodeMap.get(edge.sourceId);
    const target = nodeMap.get(edge.targetId);
    if (!source || !target) {
      return;
    }
    const [sx, sy] = getNodeCenter(source);
    const [tx, ty] = getNodeCenter(target);
    if (model.mainFlowDirection === 'LR' && tx < sx) {
      violations += 1;
    }
    if (model.mainFlowDirection === 'TB' && ty < sy) {
      violations += 1;
    }
  });

  const bbox = getBoundingBox(layout.nodes, layout.groups);
  if (bbox.width > model.profile.maxWidth || bbox.height > model.profile.maxHeight) {
    violations += 1;
  }

  layout.edges.forEach((edge) => {
    const sourceGroupId = nodeToGroup.get(edge.sourceId);
    const targetGroupId = nodeToGroup.get(edge.targetId);
    const edgeSegments = getEdgeSegments(edge);

    edgeSegments.forEach(([start, end]) => {
      layout.nodes.forEach((node) => {
        if (node.id === edge.sourceId || node.id === edge.targetId) {
          return;
        }
        if (
          segmentIntersectsRect(start, end, getNodeRect(node)) ||
          pointInsideRect(start, getNodeRect(node)) ||
          pointInsideRect(end, getNodeRect(node))
        ) {
          violations += 1;
        }
      });

      layout.groups.forEach((group) => {
        if (group.id === sourceGroupId || group.id === targetGroupId) {
          return;
        }
        if (!groupMap.has(group.id)) {
          return;
        }
        if (segmentIntersectsRect(start, end, getGroupRect(group))) {
          violations += 1;
        }
      });
    });
  });

  return violations;
}

export function computeLayoutMetrics(
  layout: LayoutResult,
  model: LayoutConstraintModel
): LayoutMetrics {
  const blankSpaceScore = computeBlankSpaceScore(layout);
  const vifScore = computeVifScore(layout, model);
  const aspectRatioPenalty = computeAspectRatioPenalty(layout, model);
  const alignmentPenalty = computeAlignmentPenalty(layout);
  const groupingPenalty = computeGroupingPenalty(layout);
  const estimatedCrossings = computeEstimatedCrossings(layout);
  const { bends, routeLength } = computeRouteStats(layout);
  const hardConstraintViolations = countHardConstraintViolations(layout, model);
  const totalScore =
    0.25 * blankSpaceScore +
    0.25 * vifScore +
    0.15 * aspectRatioPenalty +
    0.15 * alignmentPenalty +
    0.1 * groupingPenalty +
    0.1 * estimatedCrossings +
    hardConstraintViolations * 10;

  return {
    ...EMPTY_METRICS,
    blankSpaceScore,
    vifScore,
    aspectRatioPenalty,
    alignmentPenalty,
    groupingPenalty,
    estimatedCrossings,
    bends,
    routeLength,
    hardConstraintViolations,
    totalScore,
  };
}

export function withLayoutMetrics(
  layout: LayoutResult,
  model: LayoutConstraintModel
): LayoutResult {
  return {
    ...layout,
    metrics: computeLayoutMetrics(layout, model),
  };
}
