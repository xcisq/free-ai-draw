import type { Point } from '@plait/core';
import { PAPERDRAW_LAYOUT_DEFAULTS } from '../config/defaults';
import type {
  LayoutCandidate,
  LayoutConstraintModel,
  LayoutEdge,
  LayoutGroup,
  LayoutNode,
  LayoutResult,
} from '../types/analyzer';
import { getLayoutVariants, type LayoutVariant } from './layout-grammar';
import { withLayoutMetrics } from './layout-metrics';
import { recomputeLayoutGroups } from './optimize-layout';

interface BlockNodeLayout {
  id: string;
  nodeIds: string[];
  isGroup: boolean;
  label: string;
  order: number;
  width: number;
  height: number;
  x: number;
  y: number;
  layer: number;
}

interface BlockRelation {
  sourceId: string;
  targetId: string;
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

function buildBlocks(model: LayoutConstraintModel) {
  const groupedNodeIds = new Set(model.groups.flatMap((group) => group.entityIds));
  const groupBlocks = model.groups.map((group) => ({
    id: group.id,
    nodeIds: [...group.entityIds],
    isGroup: true,
    label: group.moduleLabel,
    order: group.order,
    width: group.width,
    height: group.height,
  }));
  const standaloneBlocks = model.nodes
    .filter((node) => !groupedNodeIds.has(node.id))
    .map((node, index) => ({
      id: node.id,
      nodeIds: [node.id],
      isGroup: false,
      label: node.label,
      order: model.groups.length + index + 1,
      width: node.width,
      height: node.height,
    }));

  return [...groupBlocks, ...standaloneBlocks];
}

function buildBlockRelations(model: LayoutConstraintModel, blockLayouts: BlockNodeLayout[]) {
  const nodeToBlock = new Map<string, string>();
  blockLayouts.forEach((block) => {
    block.nodeIds.forEach((nodeId) => {
      nodeToBlock.set(nodeId, block.id);
    });
  });

  const relations: BlockRelation[] = [];
  const seen = new Set<string>();
  model.sequentialEdges.forEach((edge) => {
    const sourceBlock = nodeToBlock.get(edge.sourceId) ?? edge.sourceId;
    const targetBlock = nodeToBlock.get(edge.targetId) ?? edge.targetId;
    if (sourceBlock === targetBlock) {
      return;
    }
    const key = `${sourceBlock}->${targetBlock}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    relations.push({ sourceId: sourceBlock, targetId: targetBlock });
  });
  return relations;
}

function assignLayers(blocks: BlockNodeLayout[], relations: BlockRelation[]) {
  const indegree = new Map(blocks.map((block) => [block.id, 0]));
  const outgoing = new Map(blocks.map((block) => [block.id, new Set<string>()]));

  relations.forEach((relation) => {
    outgoing.get(relation.sourceId)?.add(relation.targetId);
    indegree.set(relation.targetId, (indegree.get(relation.targetId) ?? 0) + 1);
  });

  const queue = blocks
    .filter((block) => (indegree.get(block.id) ?? 0) === 0)
    .sort((left, right) => left.order - right.order)
    .map((block) => block.id);
  const layers = new Map<string, number>();

  while (queue.length) {
    const currentId = queue.shift()!;
    const currentLayer = layers.get(currentId) ?? 0;
    for (const nextId of outgoing.get(currentId) ?? []) {
      layers.set(nextId, Math.max(layers.get(nextId) ?? 0, currentLayer + 1));
      const nextIndegree = (indegree.get(nextId) ?? 0) - 1;
      indegree.set(nextId, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(nextId);
      }
    }
  }

  blocks.forEach((block) => {
    block.layer = layers.get(block.id) ?? 0;
  });
}

function measureInternalGroup(
  nodes: LayoutNode[],
  variant: LayoutVariant
) {
  const useGrid = nodes.length > PAPERDRAW_LAYOUT_DEFAULTS.moduleGridThreshold;
  const columns =
    useGrid || variant.gridBias === 'compact'
      ? PAPERDRAW_LAYOUT_DEFAULTS.moduleGridColumns
      : 1;
  const rows = Math.ceil(nodes.length / columns);
  const width =
    columns * PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth +
    Math.max(columns - 1, 0) * PAPERDRAW_LAYOUT_DEFAULTS.nodeGapX * variant.secondarySpacingScale;
  const height =
    rows * PAPERDRAW_LAYOUT_DEFAULTS.nodeHeight +
    Math.max(rows - 1, 0) * PAPERDRAW_LAYOUT_DEFAULTS.nodeGapY * variant.secondarySpacingScale +
    PAPERDRAW_LAYOUT_DEFAULTS.moduleTitleHeight +
    PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingY * 2;

  return { columns, rows, width, height };
}

function layoutGroupNodes(
  baseNodes: LayoutNode[],
  group: LayoutGroup | null,
  originX: number,
  originY: number,
  variant: LayoutVariant
) {
  const { columns } = measureInternalGroup(baseNodes, variant);
  const offsetX = group ? PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingX : 0;
  const offsetY = group
    ? PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingY + PAPERDRAW_LAYOUT_DEFAULTS.moduleTitleHeight
    : 0;

  return baseNodes.map((node, index) => {
    const column = columns > 1 ? index % columns : 0;
    const row = columns > 1 ? Math.floor(index / columns) : index;
    return {
      ...node,
      x:
        originX +
        offsetX +
        column *
          (PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth +
            PAPERDRAW_LAYOUT_DEFAULTS.nodeGapX * variant.secondarySpacingScale),
      y:
        originY +
        offsetY +
        row *
          (PAPERDRAW_LAYOUT_DEFAULTS.nodeHeight +
            PAPERDRAW_LAYOUT_DEFAULTS.nodeGapY * variant.secondarySpacingScale),
      row,
      column,
    };
  });
}

function placeBlocks(
  blockLayouts: BlockNodeLayout[],
  variant: LayoutVariant
) {
  const layers = new Map<number, BlockNodeLayout[]>();
  blockLayouts.forEach((block) => {
    layers.set(block.layer, [...(layers.get(block.layer) ?? []), block]);
  });

  const orderedLayers = [...layers.entries()].sort((left, right) => left[0] - right[0]);
  let primaryCursor = 0;

  orderedLayers.forEach(([layerIndex, layerBlocks]) => {
    layerBlocks.sort((left, right) => left.order - right.order);
    let secondaryCursor = 0;
    const maxLayerSpan = Math.max(
      ...layerBlocks.map((block) =>
        variant.mainDirection === 'LR' ? block.height : block.width
      ),
      0
    );

    layerBlocks.forEach((block, blockIndex) => {
      const diagonalOffset =
        variant.branchStyle === 'diagonal' ? layerIndex * PAPERDRAW_LAYOUT_DEFAULTS.nodeGapY * 0.25 : 0;
      if (variant.mainDirection === 'LR') {
        block.x = primaryCursor;
        block.y = secondaryCursor + diagonalOffset * (blockIndex % 2 === 0 ? 1 : -1);
        secondaryCursor +=
          block.height + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapY * variant.spacingScale;
      } else {
        block.x = secondaryCursor + diagonalOffset * (blockIndex % 2 === 0 ? 1 : -1);
        block.y = primaryCursor;
        secondaryCursor +=
          block.width + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX * variant.spacingScale;
      }
    });

    primaryCursor +=
      maxLayerSpan +
      (variant.mainDirection === 'LR'
        ? PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX * variant.spacingScale
        : PAPERDRAW_LAYOUT_DEFAULTS.moduleGapY * variant.spacingScale);
  });
}

function getCandidateConnections(
  edge: LayoutEdge,
  nodeMap: Map<string, LayoutNode>,
  mainDirection: 'LR' | 'TB'
) {
  const sourceNode = nodeMap.get(edge.sourceId)!;
  const targetNode = nodeMap.get(edge.targetId)!;

  if (edge.type === 'annotative') {
    const targetBelow = targetNode.y > sourceNode.y + sourceNode.height * 0.5;
    return targetBelow
      ? {
          sourceConnection: [0.5, 1] as [number, number],
          targetConnection: [0.5, 0] as [number, number],
        }
      : {
          sourceConnection: [1, 0.5] as [number, number],
          targetConnection: [0, 0.5] as [number, number],
        };
  }

  if (mainDirection === 'TB') {
    const targetBelow = targetNode.y >= sourceNode.y;
    return targetBelow
      ? {
          sourceConnection: [0.5, 1] as [number, number],
          targetConnection: [0.5, 0] as [number, number],
        }
      : {
          sourceConnection: [0.5, 0] as [number, number],
          targetConnection: [0.5, 1] as [number, number],
        };
  }

  const targetRight = targetNode.x >= sourceNode.x;
  return targetRight
    ? {
        sourceConnection: [1, 0.5] as [number, number],
        targetConnection: [0, 0.5] as [number, number],
      }
    : {
        sourceConnection: [0, 0.5] as [number, number],
        targetConnection: [1, 0.5] as [number, number],
      };
}

function createEdgeSkeleton(
  model: LayoutConstraintModel,
  nodes: LayoutNode[],
  direction: 'LR' | 'TB'
) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  return model.edges.map((edge) => {
    const connections = getCandidateConnections(edge, nodeMap, direction);
    const start = getConnectionPoint(nodeMap.get(edge.sourceId)!, connections.sourceConnection);
    const end = getConnectionPoint(nodeMap.get(edge.targetId)!, connections.targetConnection);
    return {
      ...edge,
      shape: edge.type === 'annotative' ? 'elbow' : edge.shape,
      sourceConnection: connections.sourceConnection,
      targetConnection: connections.targetConnection,
      points: [start, end] as [Point, Point],
      routing: undefined,
    };
  });
}

function buildCandidateLayout(
  model: LayoutConstraintModel,
  variant: LayoutVariant
): LayoutResult {
  const blocks = buildBlocks(model).map((block) => ({
    ...block,
    x: 0,
    y: 0,
    layer: 0,
  }));
  const blockRelations = buildBlockRelations(model, blocks);
  assignLayers(blocks, blockRelations);

  const nodeMap = new Map(model.nodes.map((node) => [node.id, node]));
  blocks.forEach((block) => {
    if (block.isGroup) {
      const memberNodes = block.nodeIds
        .map((nodeId) => nodeMap.get(nodeId))
        .filter((node): node is LayoutNode => Boolean(node));
      const measured = measureInternalGroup(memberNodes, variant);
      block.width =
        measured.width + PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingX * 2;
      block.height = measured.height;
    } else {
      const node = nodeMap.get(block.nodeIds[0])!;
      block.width = node.width;
      block.height = node.height;
    }
  });

  placeBlocks(blocks, variant);

  const nextNodes: LayoutNode[] = [];
  blocks.forEach((block) => {
    if (block.isGroup) {
      const group = model.groups.find((groupItem) => groupItem.id === block.id) ?? null;
      const memberNodes = block.nodeIds
        .map((nodeId) => nodeMap.get(nodeId))
        .filter((node): node is LayoutNode => Boolean(node));
      nextNodes.push(...layoutGroupNodes(memberNodes, group, block.x, block.y, variant));
    } else {
      const node = nodeMap.get(block.nodeIds[0]);
      if (!node) {
        return;
      }
      nextNodes.push({
        ...node,
        x: block.x,
        y: block.y,
        row: 0,
        column: 0,
      });
    }
  });

  const nextNodeMap = new Map(nextNodes.map((node) => [node.id, node]));
  const nextGroups = recomputeLayoutGroups(model.groups, nextNodeMap);
  const edges = createEdgeSkeleton(model, nextNodes, variant.mainDirection);

  return {
    nodes: nextNodes,
    edges,
    groups: nextGroups,
    direction: variant.mainDirection,
  };
}

export function generateLayoutCandidates(
  model: LayoutConstraintModel,
  limit: number
): LayoutCandidate[] {
  const variants = getLayoutVariants(model.mainFlowDirection, limit);

  return variants.map((variant) => {
    const layout = buildCandidateLayout(model, variant);
    const withMetrics = withLayoutMetrics(layout, model);
    return {
      id: variant.id,
      grammar: variant.grammar,
      layout: withMetrics,
      metrics: withMetrics.metrics!,
    };
  });
}
