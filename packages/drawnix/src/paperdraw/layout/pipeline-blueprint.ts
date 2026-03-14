import type {
  AnalysisResult,
  LayoutIntent,
  LayoutIntentBranchAttachment,
  PipelineBlueprint,
  PipelineBlueprintBranchGroup,
  PipelineBlueprintEdgePolicy,
  PipelineBlueprintLane,
  PipelineBlueprintLaneKind,
} from '../types/analyzer';

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function resolveBranchLaneKind(
  side: LayoutIntentBranchAttachment['side'],
  preferredRail?: LayoutIntent['nodes'][number]['preferredRail']
): PipelineBlueprintLaneKind {
  if (preferredRail === 'top_control_rail' || side === 'top') {
    return 'control';
  }
  if (preferredRail === 'bottom_aux_rail' || side === 'bottom') {
    return 'auxiliary';
  }
  if (preferredRail === 'left_input_rail' || side === 'left') {
    return 'input';
  }
  if (preferredRail === 'right_output_rail' || side === 'right') {
    return 'output';
  }
  return 'branch';
}

function buildBranchGroups(
  intent: LayoutIntent
): PipelineBlueprintBranchGroup[] {
  const nodeMap = new Map(intent.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  intent.edges
    .filter((edge) => edge.role !== 'feedback' && edge.role !== 'annotation')
    .forEach((edge) => {
      outgoing.set(edge.sourceId, [...(outgoing.get(edge.sourceId) ?? []), edge.targetId]);
    });

  const spineSet = new Set(intent.dominantSpine);
  const mergeSet = new Set(intent.mergeNodes);

  return intent.branchAttachments.map((attachment, index) => {
    const visited = new Set<string>();
    const queue = [attachment.branchRootId];

    while (queue.length) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) {
        continue;
      }
      if (nodeId !== attachment.branchRootId && (spineSet.has(nodeId) || mergeSet.has(nodeId))) {
        continue;
      }
      visited.add(nodeId);

      (outgoing.get(nodeId) ?? []).forEach((targetId) => {
        if (visited.has(targetId) || spineSet.has(targetId) || mergeSet.has(targetId)) {
          return;
        }
        queue.push(targetId);
      });
    }

    const rootNode = nodeMap.get(attachment.branchRootId);
    const laneKind = resolveBranchLaneKind(attachment.side, rootNode?.preferredRail);
    const laneId =
      laneKind === 'branch'
        ? `lane:branch:${attachment.attachToId}:${attachment.side}:${attachment.branchRootId}`
        : `lane:${laneKind}:${attachment.attachToId}:${attachment.side}:${attachment.branchRootId}`;

    return {
      id: `branch-group-${index + 1}`,
      rootId: attachment.branchRootId,
      attachToId: attachment.attachToId,
      side: attachment.side,
      nodeIds: [...visited],
      laneId,
      laneKind,
    };
  });
}

function buildLanes(
  intent: LayoutIntent,
  branchGroups: PipelineBlueprintBranchGroup[]
): PipelineBlueprintLane[] {
  const nodeMap = new Map(intent.nodes.map((node) => [node.id, node]));
  const branchNodeIds = new Set(branchGroups.flatMap((group) => group.nodeIds));
  const lanes: PipelineBlueprintLane[] = [];

  const buildLane = (id: string, kind: PipelineBlueprintLaneKind, nodeIds: string[]) => {
    if (!nodeIds.length) {
      return;
    }
    lanes.push({
      id,
      kind,
      nodeIds,
      moduleIds: unique(
        nodeIds
          .map((nodeId) => nodeMap.get(nodeId)?.moduleId)
          .filter((moduleId): moduleId is string => Boolean(moduleId))
      ),
    });
  };

  buildLane('lane:main', 'main', intent.dominantSpine);

  const offSpineNodes = intent.nodes.filter(
    (node) => !intent.dominantSpine.includes(node.id) && !branchNodeIds.has(node.id)
  );
  buildLane(
    'lane:input',
    'input',
    offSpineNodes
      .filter((node) => node.preferredRail === 'left_input_rail')
      .map((node) => node.id)
  );
  buildLane(
    'lane:control',
    'control',
    offSpineNodes
      .filter((node) => node.preferredRail === 'top_control_rail')
      .map((node) => node.id)
  );
  buildLane(
    'lane:auxiliary',
    'auxiliary',
    offSpineNodes
      .filter((node) => node.preferredRail === 'bottom_aux_rail')
      .map((node) => node.id)
  );
  buildLane(
    'lane:output',
    'output',
    offSpineNodes
      .filter((node) => node.preferredRail === 'right_output_rail')
      .map((node) => node.id)
  );

  branchGroups.forEach((group) => {
    buildLane(group.laneId, group.laneKind, group.nodeIds);
  });

  if (intent.feedbackEdges.length) {
    lanes.push({
      id: 'lane:feedback',
      kind: 'feedback',
      nodeIds: [],
      moduleIds: [],
    });
  }

  const occupiedNodeIds = new Set(lanes.flatMap((lane) => lane.nodeIds));
  const genericBranchNodes = [...branchNodeIds].filter((nodeId) => !occupiedNodeIds.has(nodeId));
  buildLane('lane:branch:generic', 'branch', genericBranchNodes);

  return lanes;
}

function buildEdgePolicies(
  intent: LayoutIntent,
  branchGroups: PipelineBlueprintBranchGroup[]
): PipelineBlueprintEdgePolicy[] {
  const branchGroupByNodeId = new Map<string, PipelineBlueprintBranchGroup>();
  branchGroups.forEach((group) => {
    group.nodeIds.forEach((nodeId) => {
      if (!branchGroupByNodeId.has(nodeId)) {
        branchGroupByNodeId.set(nodeId, group);
      }
    });
  });
  const mergeTargetIds = new Set(intent.mergeClusters.map((cluster) => cluster.mergeNodeId));

  return intent.edges.map((edge) => {
    const sourceBranchGroup = branchGroupByNodeId.get(edge.sourceId);
    const targetBranchGroup = branchGroupByNodeId.get(edge.targetId);
    const branchGroup = sourceBranchGroup ?? targetBranchGroup;
    const mergeCluster = intent.mergeClusters.find(
      (cluster) =>
        cluster.mergeNodeId === edge.targetId &&
        cluster.sourceIds.includes(edge.sourceId)
    );

    if (edge.role === 'feedback') {
      return {
        edgeId: edge.id,
        role: edge.role,
        priority: edge.priority,
        routeLane: 'feedback',
        bundleKey: 'feedback',
      };
    }

    if (edge.role === 'annotation') {
      return {
        edgeId: edge.id,
        role: edge.role,
        priority: edge.priority,
        routeLane: 'annotation',
        bundleKey: 'annotation',
      };
    }

    if (mergeCluster || mergeTargetIds.has(edge.targetId)) {
      return {
        edgeId: edge.id,
        role: edge.role,
        priority: edge.priority,
        routeLane: branchGroup?.laneKind ?? (edge.role === 'control' ? 'control' : 'auxiliary'),
        bundleKey: `merge:${edge.targetId}`,
      };
    }

    if (edge.role === 'main') {
      return {
        edgeId: edge.id,
        role: edge.role,
        priority: edge.priority,
        routeLane: 'main',
        bundleKey: 'spine',
      };
    }

    if (edge.role === 'control') {
      return {
        edgeId: edge.id,
        role: edge.role,
        priority: edge.priority,
        routeLane: branchGroup?.laneKind ?? 'control',
        bundleKey: branchGroup?.laneId ?? 'control',
      };
    }

    return {
      edgeId: edge.id,
      role: edge.role,
      priority: edge.priority,
      routeLane: branchGroup?.laneKind ?? 'auxiliary',
      bundleKey: branchGroup?.laneId ?? edge.role,
    };
  });
}

export function buildPipelineBlueprint(
  _analysis: AnalysisResult,
  intent: LayoutIntent
): PipelineBlueprint {
  const branchGroups = buildBranchGroups(intent);
  const lanes = buildLanes(intent, branchGroups);
  const mergeGroups = intent.mergeClusters.map((cluster) => ({
    mergeNodeId: cluster.mergeNodeId,
    sourceIds: [...cluster.sourceIds],
    bundleKey: `merge:${cluster.mergeNodeId}`,
  }));
  const feedbackLoops = intent.feedbackEdges
    .map((edgeId) => intent.edges.find((edge) => edge.id === edgeId))
    .filter((edge): edge is LayoutIntent['edges'][number] => Boolean(edge))
    .map((edge) => ({
      edgeId: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      laneId: 'lane:feedback',
    }));

  return {
    lanes,
    spineNodeIds: [...intent.dominantSpine],
    branchGroups,
    mergeGroups,
    feedbackLoops,
    edgePolicies: buildEdgePolicies(intent, branchGroups),
    layoutHints: [...intent.layoutHints],
    zoneScores: { ...intent.zoneScores },
  };
}
