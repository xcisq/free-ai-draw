import type { Point } from '@plait/core';
import { PAPERDRAW_LAYOUT_DEFAULTS } from '../config/defaults';
import type {
  LayoutEdge,
  LayoutIntent,
  LayoutNode,
  LayoutResult,
  ModuleRole,
  PipelineTemplateId,
} from '../types/analyzer';
import { recomputeLayoutGroups } from './optimize-layout';
import type { PipelineTemplateMatch } from './pipeline-template-matcher';

interface BlockLayout {
  id: string;
  type: 'module' | 'standalone';
  role: ModuleRole | 'standalone';
  members: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  order: number;
}

function getConnectionPoint(node: LayoutNode, connection: [number, number]): Point {
  return [
    node.x + node.width * connection[0],
    node.y + node.height * connection[1],
  ];
}

function createBlockLayouts(baseLayout: LayoutResult, intent: LayoutIntent) {
  const groupedNodeIds = new Set(intent.modules.flatMap((moduleItem) => moduleItem.members));
  const blocks: BlockLayout[] = intent.modules.map((moduleItem, index) => {
    const memberNodes = baseLayout.nodes.filter((node) => moduleItem.members.includes(node.id));
    const maxWidth = Math.max(...memberNodes.map((node) => node.width), PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth);
    const totalHeight =
      memberNodes.length * PAPERDRAW_LAYOUT_DEFAULTS.nodeHeight +
      Math.max(memberNodes.length - 1, 0) * PAPERDRAW_LAYOUT_DEFAULTS.nodeGapY +
      PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingY * 2 +
      PAPERDRAW_LAYOUT_DEFAULTS.moduleTitleHeight;
    return {
      id: moduleItem.id,
      type: 'module',
      role: moduleItem.role,
      members: [...moduleItem.members],
      x: 0,
      y: 0,
      width: maxWidth + PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingX * 2,
      height: totalHeight,
      order: index,
    };
  });

  baseLayout.nodes
    .filter((node) => !groupedNodeIds.has(node.id))
    .forEach((node, index) => {
      blocks.push({
        id: node.id,
        type: 'standalone',
        role: 'standalone',
        members: [node.id],
        x: 0,
        y: 0,
        width: node.width,
        height: node.height,
        order: intent.modules.length + index,
      });
    });

  return blocks;
}

function getModuleOrder(intent: LayoutIntent) {
  const nodeToModule = new Map<string, string>();
  intent.modules.forEach((moduleItem) => {
    moduleItem.members.forEach((member) => nodeToModule.set(member, moduleItem.id));
  });

  const order = new Map<string, number>();
  intent.dominantSpine.forEach((nodeId, index) => {
    const moduleId = nodeToModule.get(nodeId) ?? nodeId;
    if (!order.has(moduleId)) {
      order.set(moduleId, index);
    }
  });

  return order;
}

function positionBlocks(
  blocks: BlockLayout[],
  intent: LayoutIntent,
  templateId: PipelineTemplateId
) {
  const moduleOrder = getModuleOrder(intent);
  const mainY = 220;
  const controlY = 40;
  const auxY = 520;
  const currentStateY = 260;
  const mainBlocks = blocks
    .filter((block) =>
      block.role === 'core_stage' ||
      block.role === 'output_stage' ||
      block.role === 'standalone'
    )
    .sort((left, right) => (moduleOrder.get(left.id) ?? left.order) - (moduleOrder.get(right.id) ?? right.order));
  const inputBlocks = blocks.filter((block) => block.role === 'input_stage');
  const controlBlocks = blocks.filter((block) => block.role === 'control_stage');
  const auxBlocks = blocks.filter((block) => block.role === 'auxiliary_stage');
  const outputBlocks = blocks.filter((block) => block.role === 'output_stage');

  const inputWidth = inputBlocks.reduce(
    (width, block) => Math.max(width, block.width),
    0
  );
  const mainStartX =
    (inputBlocks.length ? inputWidth + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX : 0) + 40;

  mainBlocks.forEach((block, index) => {
    block.x =
      mainStartX +
      index * (PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX);
    block.y = templateId === 'paired-state-simulator' ? currentStateY : mainY;
  });

  inputBlocks.forEach((block, index) => {
    block.x = 0;
    block.y =
      templateId === 'paired-state-simulator'
        ? currentStateY - index * (block.height + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapY * 0.5)
        : mainY - index * (block.height + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapY * 0.5);
  });

  controlBlocks.forEach((block, index) => {
    const anchorBlock = mainBlocks[Math.min(index, Math.max(mainBlocks.length - 1, 0))];
    block.x = anchorBlock ? anchorBlock.x : mainStartX;
    block.y = controlY;
  });

  auxBlocks.forEach((block, index) => {
    const anchorBlock = mainBlocks[Math.min(index + 1, Math.max(mainBlocks.length - 1, 0))];
    block.x = anchorBlock ? anchorBlock.x : mainStartX;
    block.y = templateId === 'split-merge' ? auxY + index * 160 : auxY;
  });

  if (templateId === 'split-merge' && auxBlocks.length > 1) {
    auxBlocks.forEach((block, index) => {
      block.x = mainStartX + PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX;
      block.y = 120 + index * 180;
    });
  }

  if (templateId === 'input-core-output' && outputBlocks.length) {
    outputBlocks.forEach((block, index) => {
      block.x =
        Math.max(...mainBlocks.map((item) => item.x + item.width), mainStartX) +
        PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX +
        index * (block.width + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX * 0.5);
      block.y = mainY;
    });
  }

  if (templateId === 'paired-state-simulator') {
    const simulatorBlock = mainBlocks.find((block) =>
      block.members.some((member) =>
        intent.nodes.find((node) => node.id === member)?.role === 'simulator'
      )
    );
    const stateBlocks = [...inputBlocks, ...outputBlocks];
    if (simulatorBlock) {
      stateBlocks.forEach((block, index) => {
        block.x =
          index === 0
            ? Math.max(simulatorBlock.x - block.width - PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX, 0)
            : simulatorBlock.x + simulatorBlock.width + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX;
        block.y = currentStateY;
      });
      auxBlocks.forEach((block, index) => {
        block.x = simulatorBlock.x - PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth * 0.5 + index * 120;
        block.y = auxY;
      });
    }
  }
}

function placeNodesInsideBlocks(
  baseLayout: LayoutResult,
  blocks: BlockLayout[],
  intent: LayoutIntent
) {
  const baseNodeMap = new Map(baseLayout.nodes.map((node) => [node.id, node]));
  const intentNodeMap = new Map(intent.nodes.map((node) => [node.id, node]));
  const nextNodes: LayoutNode[] = [];

  blocks.forEach((block) => {
    const memberNodes = block.members
      .map((id) => baseNodeMap.get(id))
      .filter((node): node is LayoutNode => Boolean(node));

    const useTwoColumns =
      memberNodes.length >= 4 ||
      memberNodes.some((node) => intentNodeMap.get(node.id)?.primitive === 'media-card');
    const columns = useTwoColumns ? 2 : 1;

    memberNodes.forEach((node, index) => {
      const column = columns > 1 ? index % columns : 0;
      const row = columns > 1 ? Math.floor(index / columns) : index;
      const offsetX = block.type === 'module' ? PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingX : 0;
      const offsetY =
        block.type === 'module'
          ? PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingY + PAPERDRAW_LAYOUT_DEFAULTS.moduleTitleHeight
          : 0;
      nextNodes.push({
        ...node,
        x:
          block.x +
          offsetX +
          column * (PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth + PAPERDRAW_LAYOUT_DEFAULTS.nodeGapX * 0.6),
        y:
          block.y +
          offsetY +
          row * (PAPERDRAW_LAYOUT_DEFAULTS.nodeHeight + PAPERDRAW_LAYOUT_DEFAULTS.nodeGapY * 0.8),
        row,
        column,
      });
    });
  });

  return nextNodes;
}

function createEdgeSkeleton(
  baseLayout: LayoutResult,
  nodes: LayoutNode[]
): LayoutEdge[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  return baseLayout.edges.map((edge) => {
    const sourceNode = nodeMap.get(edge.sourceId)!;
    const targetNode = nodeMap.get(edge.targetId)!;
    const dx = targetNode.x - sourceNode.x;
    const dy = targetNode.y - sourceNode.y;

    const sourceConnection: [number, number] =
      Math.abs(dx) >= Math.abs(dy)
        ? dx >= 0
          ? [1, 0.5]
          : [0, 0.5]
        : dy >= 0
          ? [0.5, 1]
          : [0.5, 0];
    const targetConnection: [number, number] =
      Math.abs(dx) >= Math.abs(dy)
        ? dx >= 0
          ? [0, 0.5]
          : [1, 0.5]
        : dy >= 0
          ? [0.5, 0]
          : [0.5, 1];

    return {
      ...edge,
      shape: 'elbow',
      sourceConnection,
      targetConnection,
      points: [
        getConnectionPoint(sourceNode, sourceConnection),
        getConnectionPoint(targetNode, targetConnection),
      ],
      routing: undefined,
    };
  });
}

export function generatePipelineSkeletonLayout(
  baseLayout: LayoutResult,
  intent: LayoutIntent,
  templateMatch: PipelineTemplateMatch
): LayoutResult {
  const blocks = createBlockLayouts(baseLayout, intent);
  positionBlocks(blocks, intent, templateMatch.rootTemplateId);
  const nodes = placeNodesInsideBlocks(baseLayout, blocks, intent);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const groups = recomputeLayoutGroups(baseLayout.groups, nodeMap);
  const edges = createEdgeSkeleton(baseLayout, nodes);

  return {
    nodes,
    groups,
    edges,
    direction: 'LR',
    engine: 'pipeline_v1',
    templateId: templateMatch.rootTemplateId,
  };
}
