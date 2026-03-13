import type {
  AnalysisResult,
  EdgeRole,
  LayoutIntent,
  LayoutIntentEdge,
  LayoutIntentModule,
  LayoutIntentNode,
  LayoutResult,
  ModuleRole,
  NodeRole,
  RailPreference,
  VisualPrimitive,
} from '../types/analyzer';

const NODE_ROLE_PATTERNS: Array<{ role: NodeRole; patterns: RegExp[] }> = [
  {
    role: 'simulator',
    patterns: [/simulation/i, /simulator/i, /physics/i, /solver/i, /optimizer/i, /仿真/, /模拟/, /求解/, /优化/],
  },
  {
    role: 'aggregator',
    patterns: [/fusion/i, /merge/i, /aggregate/i, /concat/i, /融合/, /汇聚/, /聚合/, /合并/],
  },
  {
    role: 'decoder',
    patterns: [/decoder/i, /head/i, /regressor/i, /预测头/, /解码/, /回归/],
  },
  {
    role: 'output',
    patterns: [/output/i, /result/i, /prediction/i, /updated/i, /输出/, /结果/, /预测/, /更新后/],
  },
  {
    role: 'state',
    patterns: [/state/i, /memory/i, /状态/, /记忆/],
  },
  {
    role: 'input',
    patterns: [/input/i, /raw/i, /source/i, /initial/i, /frame/i, /history/i, /输入/, /原始/, /初始/, /历史/, /数据/],
  },
  {
    role: 'parameter',
    patterns: [/parameter/i, /condition/i, /prompt/i, /embedding/i, /force/i, /rubric/i, /参数/, /条件/, /嵌入/, /力/],
  },
  {
    role: 'media',
    patterns: [/image/i, /video/i, /frame/i, /feature map/i, /图像/, /视频/, /帧/, /特征图/],
  },
];

const MODULE_ROLE_PATTERNS: Array<{ role: ModuleRole; patterns: RegExp[] }> = [
  { role: 'input_stage', patterns: [/input/i, /source/i, /输入/, /原始/, /数据/] },
  { role: 'auxiliary_stage', patterns: [/aux/i, /decoder/i, /branch/i, /辅助/, /解码/, /分支/] },
  { role: 'control_stage', patterns: [/control/i, /condition/i, /parameter/i, /控制/, /参数/, /条件/] },
  { role: 'output_stage', patterns: [/output/i, /result/i, /updated/i, /输出/, /结果/, /更新/] },
];

function getLabelScore(patterns: RegExp[], label: string) {
  return patterns.some((pattern) => pattern.test(label)) ? 1 : 0;
}

function getGraphStats(analysis: AnalysisResult) {
  const indegree = new Map<string, number>();
  const outdegree = new Map<string, number>();
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  analysis.entities.forEach((entity) => {
    indegree.set(entity.id, 0);
    outdegree.set(entity.id, 0);
    incoming.set(entity.id, []);
    outgoing.set(entity.id, []);
  });

  analysis.relations
    .filter((relation) => relation.type === 'sequential')
    .forEach((relation) => {
      indegree.set(relation.target, (indegree.get(relation.target) ?? 0) + 1);
      outdegree.set(relation.source, (outdegree.get(relation.source) ?? 0) + 1);
      incoming.set(relation.target, [...(incoming.get(relation.target) ?? []), relation.source]);
      outgoing.set(relation.source, [...(outgoing.get(relation.source) ?? []), relation.target]);
    });

  return { indegree, outdegree, incoming, outgoing };
}

function inferNodeRole(
  label: string,
  indegree: number,
  outdegree: number
): NodeRole {
  for (const candidate of NODE_ROLE_PATTERNS) {
    if (getLabelScore(candidate.patterns, label)) {
      if (candidate.role === 'input' && indegree > 0 && outdegree === 0) {
        continue;
      }
      return candidate.role;
    }
  }

  if (indegree === 0) {
    return 'input';
  }
  if (outdegree === 0) {
    return 'output';
  }
  if (indegree >= 2) {
    return 'aggregator';
  }
  if (outdegree >= 2) {
    return 'aggregator';
  }

  return 'process';
}

function inferVisualPrimitive(role: NodeRole): VisualPrimitive {
  switch (role) {
    case 'input':
      return 'container';
    case 'parameter':
      return 'small-block';
    case 'state':
    case 'output':
      return 'state-card';
    case 'media':
      return 'media-card';
    case 'aggregator':
      return 'aggregator';
    case 'simulator':
      return 'simulator';
    default:
      return 'block';
  }
}

function inferPreferredRail(role: NodeRole): RailPreference {
  switch (role) {
    case 'input':
    case 'media':
      return 'left_input_rail';
    case 'parameter':
      return 'top_control_rail';
    case 'decoder':
      return 'bottom_aux_rail';
    case 'state':
    case 'output':
      return 'right_output_rail';
    default:
      return 'main_rail';
  }
}

function buildNonFeedbackOrder(analysis: AnalysisResult, layout: LayoutResult) {
  const positionOrder = [...layout.nodes]
    .sort((left, right) => {
      if (left.x !== right.x) {
        return left.x - right.x;
      }
      return left.y - right.y;
    })
    .map((node) => node.id);
  const orderMap = new Map(positionOrder.map((id, index) => [id, index]));
  return orderMap;
}

function inferFeedbackEdges(
  analysis: AnalysisResult,
  roleMap: Map<string, NodeRole>,
  orderMap: Map<string, number>
) {
  return analysis.relations
    .filter((relation) => relation.type === 'sequential')
    .filter((relation) => {
      const sourceOrder = orderMap.get(relation.source) ?? 0;
      const targetOrder = orderMap.get(relation.target) ?? 0;
      const sourceRole = roleMap.get(relation.source);
      const targetRole = roleMap.get(relation.target);

      if (targetOrder < sourceOrder) {
        return true;
      }
      return (
        (sourceRole === 'output' || sourceRole === 'state') &&
        (targetRole === 'process' || targetRole === 'simulator' || targetRole === 'aggregator')
      );
    })
    .map((relation) => relation.id);
}

function buildSequentialGraph(
  analysis: AnalysisResult,
  feedbackEdgeIds: Set<string>
) {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  analysis.entities.forEach((entity) => {
    incoming.set(entity.id, []);
    outgoing.set(entity.id, []);
  });

  analysis.relations
    .filter((relation) => relation.type === 'sequential' && !feedbackEdgeIds.has(relation.id))
    .forEach((relation) => {
      incoming.set(relation.target, [...(incoming.get(relation.target) ?? []), relation.source]);
      outgoing.set(relation.source, [...(outgoing.get(relation.source) ?? []), relation.target]);
    });

  return { incoming, outgoing };
}

function computeDominantSpine(
  analysis: AnalysisResult,
  roleMap: Map<string, NodeRole>,
  feedbackEdgeIds: Set<string>,
  orderMap: Map<string, number>
) {
  const { incoming, outgoing } = buildSequentialGraph(analysis, feedbackEdgeIds);
  const nodeWeight = new Map(
    analysis.entities.map((entity) => [
      entity.id,
      (analysis.weights[entity.id] ?? 0.5) +
        (roleMap.get(entity.id) === 'simulator' ? 0.2 : 0) +
        (roleMap.get(entity.id) === 'aggregator' ? 0.1 : 0),
    ])
  );

  const orderedNodeIds = [...analysis.entities]
    .sort(
      (left, right) =>
        (orderMap.get(left.id) ?? 0) - (orderMap.get(right.id) ?? 0)
    )
    .map((entity) => entity.id);
  const dp = new Map<string, number>();
  const prev = new Map<string, string | null>();

  orderedNodeIds.forEach((nodeId) => {
    const parents = incoming.get(nodeId) ?? [];
    let bestScore = nodeWeight.get(nodeId) ?? 0.5;
    let bestParent: string | null = null;
    parents.forEach((parentId) => {
      const score =
        (dp.get(parentId) ?? 0) +
        (nodeWeight.get(nodeId) ?? 0.5) +
        (parentId !== nodeId ? 0.1 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestParent = parentId;
      }
    });
    dp.set(nodeId, bestScore);
    prev.set(nodeId, bestParent);
  });

  const endNodeId =
    orderedNodeIds.sort((left, right) => (dp.get(right) ?? 0) - (dp.get(left) ?? 0))[0] ??
    analysis.entities[0]?.id;
  if (!endNodeId) {
    return [];
  }

  const path: string[] = [];
  let current: string | null | undefined = endNodeId;
  while (current) {
    path.unshift(current);
    current = prev.get(current) ?? null;
  }

  if (path.length <= 1 && orderedNodeIds.length) {
    const sortedByWeight = [...orderedNodeIds].sort(
      (left, right) => (nodeWeight.get(right) ?? 0) - (nodeWeight.get(left) ?? 0)
    );
    return sortedByWeight.slice(0, Math.min(orderedNodeIds.length, 2));
  }

  return path;
}

function inferModuleRole(label: string, memberRoles: NodeRole[]): ModuleRole {
  for (const candidate of MODULE_ROLE_PATTERNS) {
    if (getLabelScore(candidate.patterns, label)) {
      return candidate.role;
    }
  }

  if (memberRoles.some((role) => role === 'input' || role === 'media')) {
    return 'input_stage';
  }
  if (memberRoles.some((role) => role === 'decoder')) {
    return 'auxiliary_stage';
  }
  if (memberRoles.some((role) => role === 'parameter')) {
    return 'control_stage';
  }
  if (memberRoles.every((role) => role === 'output' || role === 'state')) {
    return 'output_stage';
  }
  return 'core_stage';
}

function inferModuleRail(role: ModuleRole): RailPreference {
  switch (role) {
    case 'input_stage':
      return 'left_input_rail';
    case 'auxiliary_stage':
      return 'bottom_aux_rail';
    case 'control_stage':
      return 'top_control_rail';
    case 'output_stage':
      return 'right_output_rail';
    default:
      return 'main_rail';
  }
}

export function buildLayoutIntent(
  analysis: AnalysisResult,
  layout: LayoutResult
): LayoutIntent {
  const { indegree, outdegree, incoming } = getGraphStats(analysis);
  const orderMap = buildNonFeedbackOrder(analysis, layout);

  const nodeRoleMap = new Map<string, NodeRole>();
  const nodes: LayoutIntentNode[] = analysis.entities.map((entity) => {
    const role = inferNodeRole(
      entity.label,
      indegree.get(entity.id) ?? 0,
      outdegree.get(entity.id) ?? 0
    );
    nodeRoleMap.set(entity.id, role);

    const moduleId = analysis.modules.find((module) =>
      module.entityIds.includes(entity.id)
    )?.id;

    return {
      id: entity.id,
      role,
      primitive: inferVisualPrimitive(role),
      importance: analysis.weights[entity.id] ?? 0.5,
      moduleId,
      preferredRail: inferPreferredRail(role),
      isMainSpineCandidate: role !== 'annotation' && role !== 'parameter',
    };
  });

  const feedbackEdgeIds = new Set(
    inferFeedbackEdges(analysis, nodeRoleMap, orderMap)
  );
  const dominantSpine = computeDominantSpine(
    analysis,
    nodeRoleMap,
    feedbackEdgeIds,
    orderMap
  );
  const dominantSpineSet = new Set(dominantSpine);

  const edges: LayoutIntentEdge[] = analysis.relations.map((relation) => {
    let role: EdgeRole = relation.type === 'annotative' ? 'annotation' : 'main';
    if (relation.type === 'annotative') {
      const sourceRole = nodeRoleMap.get(relation.source);
      role = sourceRole === 'parameter' ? 'control' : 'annotation';
    } else if (feedbackEdgeIds.has(relation.id)) {
      role = 'feedback';
    } else if (
      !dominantSpineSet.has(relation.source) ||
      !dominantSpineSet.has(relation.target)
    ) {
      role = nodeRoleMap.get(relation.source) === 'parameter' ? 'control' : 'auxiliary';
    }

    return {
      id: relation.id,
      role,
      sourceId: relation.source,
      targetId: relation.target,
      priority:
        role === 'main'
          ? 1
          : role === 'feedback'
            ? 0.95
            : role === 'control'
              ? 0.7
              : 0.6,
    };
  });

  const branchRoots = nodes
    .filter((node) => !dominantSpineSet.has(node.id))
    .filter((node) =>
      (incoming.get(node.id) ?? []).some((parentId) => dominantSpineSet.has(parentId))
    )
    .map((node) => node.id);

  const mergeNodes = nodes
    .filter(
      (node) =>
        (incoming.get(node.id)?.length ?? 0) >= 2 ||
        node.role === 'aggregator' ||
        node.role === 'simulator'
    )
    .map((node) => node.id);

  const modules: LayoutIntentModule[] = analysis.modules.map((moduleItem) => {
    const memberRoles = moduleItem.entityIds
      .map((entityId) => nodeRoleMap.get(entityId))
      .filter((role): role is NodeRole => Boolean(role));
    const role = inferModuleRole(moduleItem.label, memberRoles);
    return {
      id: moduleItem.id,
      role,
      preferredRail: inferModuleRail(role),
      members: [...moduleItem.entityIds],
    };
  });

  const layoutHints = [
    modules.some((moduleItem) => moduleItem.role === 'input_stage')
      ? 'has_input_stage'
      : null,
    branchRoots.length > 0 ? 'has_branch' : null,
    mergeNodes.length > 0 ? 'has_merge' : null,
    feedbackEdgeIds.size > 0 ? 'has_feedback' : null,
  ].filter((hint): hint is string => Boolean(hint));

  return {
    nodes,
    edges,
    modules,
    dominantSpine,
    branchRoots,
    mergeNodes,
    feedbackEdges: [...feedbackEdgeIds],
    layoutHints,
  };
}
