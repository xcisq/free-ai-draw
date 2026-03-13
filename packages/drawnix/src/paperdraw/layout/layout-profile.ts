import { PAPERDRAW_LAYOUT_DEFAULTS } from '../config/defaults';
import type {
  LayoutEdge,
  LayoutGroup,
  LayoutNode,
  LayoutProfile,
  LayoutProfileId,
} from '../types/analyzer';

const SINGLE_PROFILE: LayoutProfile = {
  id: 'single',
  targetAspectRatio: PAPERDRAW_LAYOUT_DEFAULTS.profileSingleAspectRatio,
  maxWidth: PAPERDRAW_LAYOUT_DEFAULTS.profileSingleMaxWidth,
  maxHeight: PAPERDRAW_LAYOUT_DEFAULTS.profileSingleMaxHeight,
  scale: PAPERDRAW_LAYOUT_DEFAULTS.profileDefaultScale,
};

const DOUBLE_PROFILE: LayoutProfile = {
  id: 'double',
  targetAspectRatio: PAPERDRAW_LAYOUT_DEFAULTS.profileDoubleAspectRatio,
  maxWidth: PAPERDRAW_LAYOUT_DEFAULTS.profileDoubleMaxWidth,
  maxHeight: PAPERDRAW_LAYOUT_DEFAULTS.profileDoubleMaxHeight,
  scale: PAPERDRAW_LAYOUT_DEFAULTS.profileDefaultScale,
};

function getStandaloneBlockIds(nodes: LayoutNode[], groups: LayoutGroup[]) {
  const groupedNodeIds = new Set(groups.flatMap((group) => group.entityIds));
  return nodes
    .filter((node) => !groupedNodeIds.has(node.id))
    .map((node) => node.id);
}

function buildBlockRelations(
  nodes: LayoutNode[],
  groups: LayoutGroup[],
  edges: LayoutEdge[]
) {
  const nodeToGroup = new Map<string, string>();
  groups.forEach((group) => {
    group.entityIds.forEach((entityId) => {
      nodeToGroup.set(entityId, group.id);
    });
  });

  const blockIds = [
    ...groups.map((group) => group.id),
    ...getStandaloneBlockIds(nodes, groups),
  ];
  const indegree = new Map(blockIds.map((id) => [id, 0]));
  const outgoing = new Map(blockIds.map((id) => [id, new Set<string>()]));

  edges.forEach((edge) => {
    const sourceBlock = nodeToGroup.get(edge.sourceId) ?? edge.sourceId;
    const targetBlock = nodeToGroup.get(edge.targetId) ?? edge.targetId;
    if (sourceBlock === targetBlock) {
      return;
    }
    const sourceTargets = outgoing.get(sourceBlock);
    if (!sourceTargets || sourceTargets.has(targetBlock)) {
      return;
    }
    sourceTargets.add(targetBlock);
    indegree.set(targetBlock, (indegree.get(targetBlock) ?? 0) + 1);
  });

  return {
    blockIds,
    indegree,
    outgoing,
  };
}

function computeLayerStats(
  nodes: LayoutNode[],
  groups: LayoutGroup[],
  edges: LayoutEdge[]
) {
  const { blockIds, indegree, outgoing } = buildBlockRelations(nodes, groups, edges);
  if (!blockIds.length) {
    return { maxLayerWidth: 0, depth: 0 };
  }

  const queue = blockIds.filter((id) => (indegree.get(id) ?? 0) === 0);
  const layerMap = new Map<string, number>(queue.map((id) => [id, 0]));
  const ordered: string[] = [];

  while (queue.length) {
    const currentId = queue.shift()!;
    ordered.push(currentId);
    const currentLayer = layerMap.get(currentId) ?? 0;
    for (const nextId of outgoing.get(currentId) ?? []) {
      const candidateLayer = currentLayer + 1;
      layerMap.set(nextId, Math.max(layerMap.get(nextId) ?? 0, candidateLayer));
      const nextIndegree = (indegree.get(nextId) ?? 0) - 1;
      indegree.set(nextId, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(nextId);
      }
    }
  }

  if (ordered.length < blockIds.length) {
    blockIds.forEach((id) => {
      if (!layerMap.has(id)) {
        layerMap.set(id, 0);
      }
    });
  }

  const layerCounts = new Map<number, number>();
  layerMap.forEach((layer) => {
    layerCounts.set(layer, (layerCounts.get(layer) ?? 0) + 1);
  });

  return {
    maxLayerWidth: Math.max(...layerCounts.values(), 1),
    depth: Math.max(...layerMap.values(), 0) + 1,
  };
}

export function getLayoutProfileById(id: Exclude<LayoutProfileId, 'auto'>): LayoutProfile {
  return id === 'double' ? DOUBLE_PROFILE : SINGLE_PROFILE;
}

export function resolveLayoutProfile(
  requested: LayoutProfileId | undefined,
  nodes: LayoutNode[],
  groups: LayoutGroup[],
  sequentialEdges: LayoutEdge[]
): LayoutProfile {
  if (requested && requested !== 'auto') {
    return getLayoutProfileById(requested);
  }

  const { maxLayerWidth, depth } = computeLayerStats(nodes, groups, sequentialEdges);
  const shouldUseDouble = groups.length >= 4 || maxLayerWidth >= depth;
  return shouldUseDouble ? DOUBLE_PROFILE : SINGLE_PROFILE;
}
