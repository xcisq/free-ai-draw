import type { Point } from '@plait/core';
import { PAPERDRAW_LAYOUT_DEFAULTS } from '../config/defaults';
import type {
  LayoutEdge,
  LayoutIntent,
  LayoutNode,
  LayoutResult,
  ModuleRole,
  PipelineBlueprint,
  PipelineBlueprintLaneKind,
  PipelineTemplateId,
  RailPreference,
} from '../types/analyzer';
import { recomputeLayoutGroups } from './optimize-layout';
import type { PipelineTemplateMatch } from './pipeline-template-matcher';

interface BlockLayout {
  id: string;
  type: 'module' | 'standalone';
  role: ModuleRole | 'standalone';
  preferredRail: RailPreference;
  laneKind: PipelineBlueprintLaneKind;
  members: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  order: number;
}

interface BranchBlockAttachment {
  blockId: string;
  groupId: string;
  attachToId: string;
  side: 'top' | 'bottom' | 'left' | 'right';
}

function isMainStructureRole(role: string | undefined) {
  return role !== 'parameter' && role !== 'decoder' && role !== 'annotation';
}

function getMixedRoleStackRank(role: string | undefined) {
  if (role === 'parameter') {
    return 0;
  }
  if (isMainStructureRole(role)) {
    return 1;
  }
  if (role === 'decoder') {
    return 2;
  }
  return 3;
}

function getConnectionPoint(node: LayoutNode, connection: [number, number]): Point {
  return [
    node.x + node.width * connection[0],
    node.y + node.height * connection[1],
  ];
}

function getLaneKindPriority(laneKind: PipelineBlueprintLaneKind) {
  switch (laneKind) {
    case 'control':
      return 0;
    case 'auxiliary':
      return 1;
    case 'input':
      return 2;
    case 'output':
      return 3;
    case 'branch':
      return 4;
    case 'feedback':
      return 5;
    case 'annotation':
      return 6;
    case 'main':
    default:
      return 7;
  }
}

function getPreferredRailFromLaneKind(
  laneKind: PipelineBlueprintLaneKind,
  fallback: RailPreference
): RailPreference {
  switch (laneKind) {
    case 'input':
      return 'left_input_rail';
    case 'control':
      return 'top_control_rail';
    case 'auxiliary':
      return 'bottom_aux_rail';
    case 'output':
      return 'right_output_rail';
    default:
      return fallback;
  }
}

function getFallbackLaneKind(
  role: ModuleRole | 'standalone',
  preferredRail?: RailPreference
): PipelineBlueprintLaneKind | null {
  if (role === 'input_stage' || preferredRail === 'left_input_rail') {
    return 'input';
  }
  if (role === 'control_stage' || preferredRail === 'top_control_rail') {
    return 'control';
  }
  if (role === 'auxiliary_stage' || preferredRail === 'bottom_aux_rail') {
    return 'auxiliary';
  }
  if (role === 'output_stage' || preferredRail === 'right_output_rail') {
    return 'output';
  }
  return null;
}

function buildNodeLaneKinds(blueprint: PipelineBlueprint) {
  const nodeLaneKinds = new Map<string, PipelineBlueprintLaneKind[]>();
  blueprint.lanes.forEach((lane) => {
    lane.nodeIds.forEach((nodeId) => {
      nodeLaneKinds.set(nodeId, [...(nodeLaneKinds.get(nodeId) ?? []), lane.kind]);
    });
  });
  return nodeLaneKinds;
}

function resolvePrimaryLaneKind(
  memberIds: string[],
  nodeLaneKinds: Map<string, PipelineBlueprintLaneKind[]>,
  role: ModuleRole | 'standalone',
  preferredRail?: RailPreference
): PipelineBlueprintLaneKind {
  const explicitRoleLaneKind = getFallbackLaneKind(role, preferredRail);
  const laneKinds = memberIds.flatMap((memberId) => nodeLaneKinds.get(memberId) ?? []);
  if (!laneKinds.length) {
    return explicitRoleLaneKind ?? 'main';
  }
  const primaryLaneKind = [...laneKinds].sort(
    (left, right) => getLaneKindPriority(left) - getLaneKindPriority(right)
  )[0];
  if (primaryLaneKind === 'main') {
    return explicitRoleLaneKind ?? primaryLaneKind;
  }
  return primaryLaneKind;
}

function createBlockLayouts(
  baseLayout: LayoutResult,
  intent: LayoutIntent,
  blueprint: PipelineBlueprint
) {
  const baseNodeMap = new Map(baseLayout.nodes.map((node) => [node.id, node]));
  const intentNodeMap = new Map(intent.nodes.map((node) => [node.id, node]));
  const nodeLaneKinds = buildNodeLaneKinds(blueprint);
  const groupedNodeIds = new Set(intent.modules.flatMap((moduleItem) => moduleItem.members));

  const blocks: BlockLayout[] = intent.modules.map((moduleItem, index) => {
    const memberNodes = moduleItem.members
      .map((id) => baseNodeMap.get(id))
      .filter((node): node is LayoutNode => Boolean(node));
    const maxWidth = Math.max(
      ...memberNodes.map((node) => {
        const primitive = intentNodeMap.get(node.id)?.primitive;
        if (primitive === 'media-card') {
          return node.width + 40;
        }
        if (primitive === 'simulator') {
          return node.width + 32;
        }
        return node.width;
      }),
      PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth
    );
    const totalHeight =
      memberNodes.length * PAPERDRAW_LAYOUT_DEFAULTS.nodeHeight +
      Math.max(memberNodes.length - 1, 0) * PAPERDRAW_LAYOUT_DEFAULTS.nodeGapY * 0.85 +
      PAPERDRAW_LAYOUT_DEFAULTS.modulePaddingY * 2 +
      PAPERDRAW_LAYOUT_DEFAULTS.moduleTitleHeight;
    const laneKind = resolvePrimaryLaneKind(
      moduleItem.members,
      nodeLaneKinds,
      moduleItem.role,
      moduleItem.preferredRail
    );

    return {
      id: moduleItem.id,
      type: 'module',
      role: moduleItem.role,
      preferredRail: getPreferredRailFromLaneKind(
        laneKind,
        moduleItem.preferredRail ?? 'main_rail'
      ),
      laneKind,
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
      const intentNode = intentNodeMap.get(node.id);
      const laneKind = resolvePrimaryLaneKind(
        [node.id],
        nodeLaneKinds,
        'standalone',
        intentNode?.preferredRail
      );
      blocks.push({
        id: node.id,
        type: 'standalone',
        role: 'standalone',
        preferredRail: getPreferredRailFromLaneKind(
          laneKind,
          intentNode?.preferredRail ?? 'main_rail'
        ),
        laneKind,
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

function buildBlockMaps(blocks: BlockLayout[]) {
  const nodeToBlock = new Map<string, string>();
  const blockMap = new Map(blocks.map((block) => [block.id, block]));
  blocks.forEach((block) => {
    block.members.forEach((memberId) => nodeToBlock.set(memberId, block.id));
  });
  return { nodeToBlock, blockMap };
}

function getSpineBlockIds(blueprint: PipelineBlueprint, nodeToBlock: Map<string, string>) {
  const seen = new Set<string>();
  const spineBlockIds: string[] = [];
  blueprint.spineNodeIds.forEach((nodeId) => {
    const blockId = nodeToBlock.get(nodeId) ?? nodeId;
    if (!seen.has(blockId)) {
      seen.add(blockId);
      spineBlockIds.push(blockId);
    }
  });
  return spineBlockIds;
}

function getBranchBlockIds(blueprint: PipelineBlueprint, nodeToBlock: Map<string, string>) {
  return [
    ...new Set(
      blueprint.branchGroups
        .flatMap((group) => group.nodeIds.map((nodeId) => nodeToBlock.get(nodeId)))
        .filter(Boolean)
    ),
  ] as string[];
}

function getMergeBlockIds(blueprint: PipelineBlueprint, nodeToBlock: Map<string, string>) {
  return [
    ...new Set(
      blueprint.mergeGroups.map((item) => nodeToBlock.get(item.mergeNodeId)).filter(Boolean)
    ),
  ] as string[];
}

function buildBranchBlockAttachments(
  blueprint: PipelineBlueprint,
  nodeToBlock: Map<string, string>
) {
  const attachments: BranchBlockAttachment[] = [];
  blueprint.branchGroups.forEach((group) => {
    const blockIds = [
      ...new Set(group.nodeIds.map((nodeId) => nodeToBlock.get(nodeId)).filter(Boolean)),
    ] as string[];
    const attachToId = nodeToBlock.get(group.attachToId) ?? group.attachToId;
    blockIds.forEach((blockId) => {
      attachments.push({
        blockId,
        groupId: group.id,
        attachToId,
        side: group.side,
      });
    });
  });
  return attachments;
}

function placeStack(
  blocks: BlockLayout[],
  x: number,
  startY: number,
  gapY: number
) {
  blocks.forEach((block, index) => {
    block.x = x;
    block.y = startY + index * (block.height + gapY);
  });
}

function getCenteredOffset(index: number, total: number, gap: number) {
  return (index - (total - 1) / 2) * gap;
}

function placeAttachedBranchBlocks(
  branchBlocks: BlockLayout[],
  blockMap: Map<string, BlockLayout>,
  branchAttachments: BranchBlockAttachment[],
  leftZoneX: number,
  topY: number,
  mainY: number,
  bottomY: number,
  rightBaseX: number
) {
  const branchTopY = Math.max(topY + 24, mainY - 180);
  const branchBottomY = Math.min(bottomY - 120, mainY + 150);
  const attachmentsByBlockId = new Map(
    branchAttachments.map((attachment) => [
      attachment.blockId,
      attachment,
    ])
  );
  const groupedBranchBlocks = new Map<string, Map<string, BlockLayout[]>>();

  [...branchBlocks]
    .sort((left, right) => left.order - right.order)
    .forEach((block) => {
      const attachment = attachmentsByBlockId.get(block.id);
      const side = attachment?.side ?? 'bottom';
      const key = `${attachment?.attachToId ?? block.id}:${side}`;
      const groupId = attachment?.groupId ?? block.id;
      const branchGroups = groupedBranchBlocks.get(key) ?? new Map<string, BlockLayout[]>();
      branchGroups.set(groupId, [...(branchGroups.get(groupId) ?? []), block]);
      groupedBranchBlocks.set(key, branchGroups);
    });

  groupedBranchBlocks.forEach((branchGroups, key) => {
    const [attachToId = '', side = 'bottom'] = key.split(':');
    const anchorBlock = blockMap.get(attachToId);
    const horizontalGap = PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX * 0.9;
    const verticalGap = PAPERDRAW_LAYOUT_DEFAULTS.moduleGapY * 0.8;

    [...branchGroups.values()].forEach((groupBlocks, groupIndex) => {
      const centeredOffset =
        side === 'top' || side === 'bottom'
          ? getCenteredOffset(groupIndex, branchGroups.size, horizontalGap)
          : getCenteredOffset(groupIndex, branchGroups.size, verticalGap);

      groupBlocks.forEach((block, index) => {
        switch (side) {
          case 'top':
            block.x = anchorBlock ? anchorBlock.x + centeredOffset : rightBaseX * 0.45 + centeredOffset;
            block.y = branchTopY + index * (block.height + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapY * 0.45);
            break;
          case 'left':
            block.x = anchorBlock
              ? anchorBlock.x - block.width - PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX * 0.7 - index * (block.width + 20)
              : leftZoneX + 140 - index * (block.width + 20);
            block.y = anchorBlock ? anchorBlock.y + centeredOffset : mainY + centeredOffset;
            break;
          case 'right':
            block.x = anchorBlock
              ? anchorBlock.x + anchorBlock.width + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX * 0.7 + index * (block.width + 20)
              : rightBaseX + index * (block.width + 20);
            block.y = anchorBlock ? anchorBlock.y + centeredOffset : mainY + centeredOffset;
            break;
          case 'bottom':
          default:
            block.x = anchorBlock ? anchorBlock.x + centeredOffset : 520 + centeredOffset;
            block.y = branchBottomY + index * (block.height + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapY * 0.45);
            break;
        }
      });
    });
  });
}

function positionMergeBundles(
  blocks: BlockLayout[],
  blueprint: PipelineBlueprint,
  nodeToBlock: Map<string, string>,
  mainY: number
) {
  const blockMap = new Map(blocks.map((block) => [block.id, block]));

  blueprint.mergeGroups.forEach((mergeGroup, index) => {
    const mergeBlockId = nodeToBlock.get(mergeGroup.mergeNodeId);
    const mergeBlock = mergeBlockId ? blockMap.get(mergeBlockId) : undefined;
    if (!mergeBlock) {
      return;
    }

    const sourceBlockIds = [
      ...new Set(
        mergeGroup.sourceIds
          .map((sourceId) => nodeToBlock.get(sourceId))
          .filter((blockId): blockId is string => Boolean(blockId) && blockId !== mergeBlock.id)
      ),
    ];
    if (!sourceBlockIds.length) {
      return;
    }

    const maxSourceX = Math.max(
      ...sourceBlockIds.map((blockId) => {
        const sourceBlock = blockMap.get(blockId);
        return sourceBlock ? sourceBlock.x + sourceBlock.width : 0;
      }),
      mergeBlock.x
    );
    mergeBlock.x = Math.max(
      mergeBlock.x,
      maxSourceX + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX * 0.9 + index * 24
    );
    mergeBlock.y = mainY;
  });
}

function positionMainSpine(
  blocks: BlockLayout[],
  spineBlockIds: string[],
  templateId: PipelineTemplateId,
  nodeToBlock: Map<string, string>,
  intent: LayoutIntent,
  blueprint: PipelineBlueprint
) {
  const blockMap = new Map(blocks.map((block) => [block.id, block]));
  const branchBlockIds = new Set(getBranchBlockIds(blueprint, nodeToBlock));
  const mergeBlockIds = new Set(getMergeBlockIds(blueprint, nodeToBlock));
  const mainY = 250;
  const splitAttachBlockId =
    templateId === 'split-merge'
      ? nodeToBlock.get(blueprint.branchGroups[0]?.attachToId ?? '')
      : undefined;
  const mergeBlockId =
    templateId === 'split-merge'
      ? nodeToBlock.get(blueprint.mergeGroups[0]?.mergeNodeId ?? '')
      : undefined;
  const splitAnchorIndex = splitAttachBlockId ? spineBlockIds.indexOf(splitAttachBlockId) : -1;
  const mergeBlockIndex = mergeBlockId ? spineBlockIds.indexOf(mergeBlockId) : -1;
  let xCursor = 360;
  let branchColumnX = 0;

  spineBlockIds.forEach((blockId, index) => {
    const block = blockMap.get(blockId);
    if (!block) {
      return;
    }

    if (
      templateId === 'split-merge' &&
      splitAnchorIndex >= 0 &&
      index === splitAnchorIndex + 1 &&
      branchBlockIds.size > 0
    ) {
      branchColumnX = xCursor;
      xCursor += PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX;
    }

    if (
      templateId === 'input-core-output' &&
      block.role === 'output_stage' &&
      index === spineBlockIds.length - 1
    ) {
      block.x = xCursor + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX * 0.7;
    } else if (
      templateId === 'paired-state-simulator' &&
      block.members.some((memberId) =>
        intent.nodes.find((node) => node.id === memberId)?.role === 'simulator'
      )
    ) {
      block.x = Math.max(xCursor, 760);
    } else {
      block.x = xCursor;
    }

    block.y = mainY;
    xCursor = block.x + block.width + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX;

    if (
      templateId === 'split-merge' &&
      mergeBlockIndex >= 0 &&
      index < mergeBlockIndex &&
      mergeBlockIds.has(block.id)
    ) {
      xCursor += PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX;
    }
  });

  if (templateId === 'split-merge' && branchColumnX) {
    Array.from(branchBlockIds).forEach((blockId, index) => {
      const block = blockMap.get(blockId);
      if (!block) {
        return;
      }
      block.x = branchColumnX;
      block.y = 110 + index * (block.height + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapY * 0.5);
    });

    if (mergeBlockId) {
      const mergeBlock = blockMap.get(mergeBlockId);
      if (mergeBlock) {
        mergeBlock.x = branchColumnX + PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX;
        mergeBlock.y = mainY;
      }
    }
  }
}

function positionSpecialRails(
  blocks: BlockLayout[],
  intent: LayoutIntent,
  templateId: PipelineTemplateId,
  blueprint: PipelineBlueprint
) {
  const isTopControlMainBottomAux = templateId === 'top-control-main-bottom-aux';
  const blockMap = new Map(blocks.map((block) => [block.id, block]));
  const { nodeToBlock } = buildBlockMaps(blocks);
  const spineBlockIds = getSpineBlockIds(blueprint, nodeToBlock);
  const branchBlockAttachments = buildBranchBlockAttachments(blueprint, nodeToBlock);
  const attachedBranchBlockIds = new Set(branchBlockAttachments.map((attachment) => attachment.blockId));
  const splitMergeBranchBlockIds =
    templateId === 'split-merge'
      ? new Set(getBranchBlockIds(blueprint, nodeToBlock))
      : new Set<string>();
  const splitMergeMergeBlockIds =
    templateId === 'split-merge'
      ? new Set(getMergeBlockIds(blueprint, nodeToBlock))
      : new Set<string>();
  positionMainSpine(blocks, spineBlockIds, templateId, nodeToBlock, intent, blueprint);

  const spineBlockSet = new Set(spineBlockIds);
  const mainBlocks = spineBlockIds.map((blockId) => blockMap.get(blockId)).filter(Boolean) as BlockLayout[];
  const coreAnchorBlocks = mainBlocks.filter(
    (block) => block.role === 'core_stage' || block.role === 'standalone'
  );
  const nonTerminalMainBlocks = mainBlocks.filter(
    (block) => block.role !== 'input_stage' && block.role !== 'output_stage'
  );
  const railAnchorBlocks =
    isTopControlMainBottomAux && coreAnchorBlocks.length
      ? coreAnchorBlocks
      : isTopControlMainBottomAux && nonTerminalMainBlocks.length
        ? nonTerminalMainBlocks
        : mainBlocks;
  const leftZoneX = 40;
  const topY = isTopControlMainBottomAux ? 40 : 70;
  const bottomY = isTopControlMainBottomAux ? 560 : 520;
  const mainY = 250;
  const rightBaseX =
    Math.max(...mainBlocks.map((block) => block.x + block.width), 780) +
    PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX;

  const inputBlocks = blocks.filter(
    (block) =>
      block.laneKind === 'input' &&
      !attachedBranchBlockIds.has(block.id) &&
      (!spineBlockSet.has(block.id) || block.role === 'input_stage')
  );
  const controlBlocks = blocks.filter(
    (block) =>
      block.laneKind === 'control' &&
      !attachedBranchBlockIds.has(block.id) &&
      !spineBlockSet.has(block.id)
  );
  const auxBlocks = blocks.filter(
    (block) =>
      block.laneKind === 'auxiliary' &&
      !attachedBranchBlockIds.has(block.id) &&
      !spineBlockSet.has(block.id) &&
      !splitMergeBranchBlockIds.has(block.id) &&
      !splitMergeMergeBlockIds.has(block.id)
  );
  const outputBlocks = blocks.filter(
    (block) =>
      block.laneKind === 'output' &&
      !attachedBranchBlockIds.has(block.id) &&
      (!spineBlockSet.has(block.id) || templateId === 'input-core-output')
  );
  const branchBlocks = blocks.filter((block) => {
    const isAttachedBranch = attachedBranchBlockIds.has(block.id);
    return (
      isAttachedBranch &&
      !spineBlockSet.has(block.id) &&
      !inputBlocks.includes(block) &&
      !controlBlocks.includes(block) &&
      !auxBlocks.includes(block) &&
      !outputBlocks.includes(block) &&
      !splitMergeBranchBlockIds.has(block.id) &&
      !splitMergeMergeBlockIds.has(block.id)
    );
  });
  const freeBlocks = blocks.filter(
    (block) =>
      !spineBlockSet.has(block.id) &&
      !inputBlocks.includes(block) &&
      !controlBlocks.includes(block) &&
      !auxBlocks.includes(block) &&
      !outputBlocks.includes(block) &&
      !branchBlocks.includes(block) &&
      !splitMergeBranchBlockIds.has(block.id) &&
      !splitMergeMergeBlockIds.has(block.id)
  );

  placeStack(inputBlocks, leftZoneX, templateId === 'paired-state-simulator' ? 170 : 170, 28);
  placeStack(outputBlocks, rightBaseX, templateId === 'paired-state-simulator' ? 210 : mainY - 10, 28);

  controlBlocks.forEach((block, index) => {
    const attachment = intent.branchAttachments.find(
      (item) => nodeToBlock.get(item.branchRootId) === block.id
    );
    const anchorBlock = attachment
      ? blockMap.get(nodeToBlock.get(attachment.attachToId) ?? '')
      : railAnchorBlocks[Math.min(index, Math.max(railAnchorBlocks.length - 1, 0))];
    block.x = anchorBlock ? anchorBlock.x : rightBaseX * 0.45;
    block.y = topY + index * (block.height + (isTopControlMainBottomAux ? 24 : 18));
  });

  auxBlocks.forEach((block, index) => {
    const attachment = intent.branchAttachments.find(
      (item) => nodeToBlock.get(item.branchRootId) === block.id
    );
    const anchorBlock = attachment
      ? blockMap.get(nodeToBlock.get(attachment.attachToId) ?? '')
      : railAnchorBlocks[Math.min(index, Math.max(railAnchorBlocks.length - 1, 0))];
    block.x = anchorBlock ? anchorBlock.x : 520;
    block.y = bottomY + index * (block.height + (isTopControlMainBottomAux ? 32 : 28));
  });

  placeAttachedBranchBlocks(
    branchBlocks,
    blockMap,
    branchBlockAttachments,
    leftZoneX,
    topY,
    mainY,
    bottomY,
    rightBaseX
  );

  freeBlocks.forEach((block, index) => {
    block.x = rightBaseX * 0.55 + index * (block.width + 24);
    block.y = mainY;
  });

  if (templateId === 'split-merge') {
    const branchBlockIds = new Set(getBranchBlockIds(blueprint, nodeToBlock));
    const mergeBlockIds = new Set(getMergeBlockIds(blueprint, nodeToBlock));
    const maxBranchX = Math.max(
      ...blocks
        .filter((block) => branchBlockIds.has(block.id))
        .map((block) => block.x + block.width),
      0
    );

    blocks
      .filter((block) => mergeBlockIds.has(block.id))
      .forEach((block, index) => {
        block.x = Math.max(
          block.x,
          maxBranchX + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX + index * 48
        );
        block.y = mainY;
      });
  }

  if (templateId === 'paired-state-simulator') {
    const simulatorBlock = blocks.find((block) =>
      block.members.some((memberId) =>
        intent.nodes.find((node) => node.id === memberId)?.role === 'simulator'
      )
    );
    const statePair = intent.statePairs[0];
    const currentBlock = statePair ? blockMap.get(nodeToBlock.get(statePair.currentId) ?? '') : undefined;
    const nextBlock = statePair ? blockMap.get(nodeToBlock.get(statePair.nextId) ?? '') : undefined;

    if (simulatorBlock) {
      simulatorBlock.x = 760;
      simulatorBlock.y = mainY;
      if (currentBlock && currentBlock.id !== simulatorBlock.id) {
        currentBlock.x = simulatorBlock.x - currentBlock.width - PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX;
        currentBlock.y = mainY;
      }
      if (nextBlock && nextBlock.id !== simulatorBlock.id) {
        nextBlock.x = simulatorBlock.x + simulatorBlock.width + PAPERDRAW_LAYOUT_DEFAULTS.moduleGapX;
        nextBlock.y = mainY;
      }
      inputBlocks.forEach((block, index) => {
        block.x = 80;
        block.y = 110 + index * (block.height + 24);
      });
      auxBlocks.forEach((block, index) => {
        block.x = simulatorBlock.x - 40 + index * 140;
        block.y = bottomY;
      });
    }
  }

  positionMergeBundles(blocks, blueprint, nodeToBlock, mainY);
}

function placeNodesInsideBlocks(
  baseLayout: LayoutResult,
  blocks: BlockLayout[],
  intent: LayoutIntent,
  templateMatch: PipelineTemplateMatch
) {
  const baseNodeMap = new Map(baseLayout.nodes.map((node) => [node.id, node]));
  const intentNodeMap = new Map(intent.nodes.map((node) => [node.id, node]));
  const nextNodes: LayoutNode[] = [];

  blocks.forEach((block) => {
    const memberNodes = block.members
      .map((id) => baseNodeMap.get(id))
      .filter((node): node is LayoutNode => Boolean(node));
    const memberRoles = memberNodes.map((node) => intentNodeMap.get(node.id)?.role);
    const hasControlOverMain =
      templateMatch.localTemplateIds.includes('control-over-main') &&
      memberRoles.some((role) => role === 'parameter') &&
      memberRoles.some((role) => isMainStructureRole(role));
    const hasAuxUnderMain =
      templateMatch.localTemplateIds.includes('aux-under-main') &&
      memberRoles.some((role) => role === 'decoder') &&
      memberRoles.some((role) => isMainStructureRole(role));
    const orderedMemberNodes =
      hasControlOverMain || hasAuxUnderMain
        ? [...memberNodes].sort((left, right) => {
            const leftRole = intentNodeMap.get(left.id)?.role;
            const rightRole = intentNodeMap.get(right.id)?.role;
            const rankDiff =
              getMixedRoleStackRank(leftRole) - getMixedRoleStackRank(rightRole);
            if (rankDiff !== 0) {
              return rankDiff;
            }
            return left.id.localeCompare(right.id);
          })
        : memberNodes;

    const forceHorizontalPair =
      templateMatch.localTemplateIds.includes('horizontal-pair') &&
      orderedMemberNodes.length === 2 &&
      (block.role === 'output_stage' || block.role === 'core_stage');
    const forceVerticalPair =
      templateMatch.localTemplateIds.includes('vertical-pair') &&
      orderedMemberNodes.length === 2 &&
      (block.role === 'control_stage' || block.role === 'auxiliary_stage');
    const forceRoleStack = hasControlOverMain || hasAuxUnderMain;
    const useTwoColumns =
      forceHorizontalPair ||
      (!forceVerticalPair &&
        !forceRoleStack &&
        (orderedMemberNodes.length >= 4 ||
          orderedMemberNodes.some((node) => intentNodeMap.get(node.id)?.primitive === 'media-card')));
    const columns = useTwoColumns ? 2 : 1;

    orderedMemberNodes.forEach((node, index) => {
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
          column * (PAPERDRAW_LAYOUT_DEFAULTS.nodeWidth + PAPERDRAW_LAYOUT_DEFAULTS.nodeGapX * 0.55),
        y:
          block.y +
          offsetY +
          row * (PAPERDRAW_LAYOUT_DEFAULTS.nodeHeight + PAPERDRAW_LAYOUT_DEFAULTS.nodeGapY * 0.72),
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
  blueprint: PipelineBlueprint,
  templateMatch: PipelineTemplateMatch
): LayoutResult {
  const blocks = createBlockLayouts(baseLayout, intent, blueprint);
  positionSpecialRails(blocks, intent, templateMatch.rootTemplateId, blueprint);
  const nodes = placeNodesInsideBlocks(baseLayout, blocks, intent, templateMatch);
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
