import type { Point } from '@plait/core';
import {
  ArrowLineMarkerType,
  ArrowLineShape,
  BasicShapes,
  createArrowLineElement,
  createGeometryElementWithText,
} from '@plait/draw';
import { PAPERDRAW_THEME } from '../config/defaults';
import { LayoutGroup, LayoutNode, LayoutResult } from '../types/analyzer';

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
      edge.shape === 'elbow' ? ArrowLineShape.elbow : ArrowLineShape.straight,
      edge.points,
      {
        boundId: edge.sourceId,
        connection: edge.sourceConnection,
        marker: ArrowLineMarkerType.none,
      },
      {
        boundId: edge.targetId,
        connection: edge.targetConnection,
        marker: ArrowLineMarkerType.arrow,
      },
      undefined,
      {
        strokeColor,
        strokeWidth: PAPERDRAW_THEME.edgeStrokeWidth,
      }
    );
    element.id = edge.id;
    if (edge.routing && edge.routing.length > 2) {
      element.points = edge.routing;
    }
    return element;
  });

  return [...groups, ...nodes, ...edges];
}
