import { Point } from '@plait/core';
import {
  ArrowLineMarkerType,
  ArrowLineShape,
  BasicShapes,
  createArrowLineElement,
  createGeometryElementWithText,
} from '@plait/draw';
import { PAPERDRAW_THEME } from '../config/defaults';
import { LayoutDirection, LayoutGroup, LayoutNode, LayoutResult } from '../types/analyzer';

const createNodePoints = (node: LayoutNode): [Point, Point] => {
  return [
    [node.x, node.y],
    [node.x + node.width, node.y + node.height],
  ];
};

const createGroupPoints = (group: LayoutGroup): [Point, Point] => {
  return [
    [group.x, group.y],
    [group.x + group.width, group.y + group.height],
  ];
};

const getConnectionPoint = (
  direction: LayoutDirection,
  handle: 'source' | 'target'
): [number, number] => {
  if (direction === 'TB') {
    return handle === 'source' ? [0.5, 1] : [0.5, 0];
  }
  return handle === 'source' ? [1, 0.5] : [0, 0.5];
};

export function buildFlowchartElements(layout: LayoutResult) {
  const groups = layout.groups.map((group) => {
    const element = createGeometryElementWithText(
      BasicShapes.roundRectangle,
      createGroupPoints(group),
      group.moduleLabel,
      {
        fill: PAPERDRAW_THEME.moduleFill,
        strokeColor: PAPERDRAW_THEME.moduleStrokeColor,
        strokeWidth: PAPERDRAW_THEME.moduleStrokeWidth,
      }
    );
    element.id = group.id;
    return element;
  });

  const nodes = layout.nodes.map((node) => {
    const element = createGeometryElementWithText(
      BasicShapes.rectangle,
      createNodePoints(node),
      node.label,
      {
        fill: PAPERDRAW_THEME.nodeFill,
        strokeColor: PAPERDRAW_THEME.nodeStrokeColor,
        strokeWidth: PAPERDRAW_THEME.nodeStrokeWidth,
      }
    );
    element.id = node.id;
    return element;
  });

  const edges = layout.edges.map((edge) => {
    const strokeColor =
      edge.type === 'annotative'
        ? PAPERDRAW_THEME.annotativeStrokeColor
        : PAPERDRAW_THEME.sequentialStrokeColor;

    const element = createArrowLineElement(
      ArrowLineShape.straight,
      edge.points,
      {
        boundId: edge.sourceId,
        connection: getConnectionPoint(layout.direction, 'source'),
        marker: ArrowLineMarkerType.none,
      },
      {
        boundId: edge.targetId,
        connection: getConnectionPoint(layout.direction, 'target'),
        marker: ArrowLineMarkerType.arrow,
      },
      undefined,
      {
        strokeColor,
        strokeWidth: PAPERDRAW_THEME.edgeStrokeWidth,
      }
    );
    element.id = edge.id;
    return element;
  });

  return [...groups, ...nodes, ...edges];
}
