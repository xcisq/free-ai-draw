import type {
  AnalysisResult,
  EdgeRole,
  LayoutIntent,
  LayoutIntentBranchAttachment,
  LayoutIntentEdge,
  LayoutIntentMergeCluster,
  LayoutIntentModule,
  LayoutIntentNode,
  LayoutIntentStatePair,
  LayoutIntentZoneScores,
  LayoutResult,
  ModuleRole,
  NodeRole,
  RailPreference,
  VisualPrimitive,
} from '../types/analyzer';

type SequentialGraph = {
  indegree: Map<string, number>;
  outdegree: Map<string, number>;
  incoming: Map<string, string[]>;
  outgoing: Map<string, string[]>;
};

const NODE_ROLE_PATTERNS: Array<{ role: NodeRole; patterns: RegExp[] }> = [
  {
    role: 'simulator',
    patterns: [
      /simulation/i,
      /simulator/i,
      /physics/i,
      /solver/i,
      /optimizer/i,
      /planner/i,
      /仿真/,
      /模拟/,
      /求解/,
      /优化/,
      /规划/,
    ],
  },
  {
    role: 'aggregator',
    patterns: [
      /fusion/i,
      /merge/i,
      /aggregate/i,
      /concat/i,
      /selector/i,
      /融合/,
      /汇聚/,
      /聚合/,
      /合并/,
      /拼接/,
    ],
  },
  {
    role: 'decoder',
    patterns: [
      /decoder/i,
      /head/i,
      /regressor/i,
      /predictor/i,
      /预测头/,
      /解码/,
      /回归/,
      /预测支路/,
    ],
  },
  {
    role: 'parameter',
    patterns: [
      /parameter/i,
      /condition/i,
      /prompt/i,
      /embedding/i,
      /force/i,
      /rubric/i,
      /参数/,
      /条件/,
      /嵌入/,
      /力/,
      /控制/,
    ],
  },
  {
    role: 'media',
    patterns: [
      /image/i,
      /video/i,
      /frame/i,
      /feature map/i,
      /feature/i,
      /图像/,
      /视频/,
      /帧/,
      /特征图/,
      /图片/,
    ],
  },
  {
    role: 'output',
    patterns: [
      /output/i,
      /result/i,
      /prediction/i,
      /updated/i,
      /final/i,
      /输出/,
      /结果/,
      /预测/,
      /更新后/,
      /最终/,
    ],
  },
  {
    role: 'state',
    patterns: [
      /state/i,
      /memory/i,
      /current/i,
      /initial/i,
      /next/i,
      /状态/,
      /记忆/,
      /当前/,
      /初始/,
      /下一/,
    ],
  },
  {
    role: 'input',
    patterns: [
      /input/i,
      /raw/i,
      /source/i,
      /initial/i,
      /history/i,
      /sensor/i,
      /输入/,
      /原始/,
      /历史/,
      /数据/,
      /传感/,
    ],
  },
];

const MODULE_ROLE_PATTERNS: Array<{ role: ModuleRole; patterns: RegExp[] }> = [
  {
    role: 'input_stage',
    patterns: [/input/i, /source/i, /frame/i, /输入/, /原始/, /数据/, /历史/],
  },
  {
    role: 'auxiliary_stage',
    patterns: [/aux/i, /decoder/i, /branch/i, /辅助/, /解码/, /分支/],
  },
  {
    role: 'control_stage',
    patterns: [/control/i, /condition/i, /parameter/i, /prompt/i, /控制/, /参数/, /条件/],
  },
  {
    role: 'output_stage',
    patterns: [/output/i, /result/i, /updated/i, /输出/, /结果/, /更新/],
  },
];

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function getPatternHit(role: Array<{ role: NodeRole; patterns: RegExp[] }>, label: string) {
  return role.find((candidate) => candidate.patterns.some((pattern) => pattern.test(label)))?.role;
}

function buildSequentialGraph(
  analysis: AnalysisResult,
  excludedEdgeIds: Set<string> = new Set()
): SequentialGraph {
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
    .filter((relation) => relation.type === 'sequential' && !excludedEdgeIds.has(relation.id))
    .forEach((relation) => {
      indegree.set(relation.target, (indegree.get(relation.target) ?? 0) + 1);
      outdegree.set(relation.source, (outdegree.get(relation.source) ?? 0) + 1);
      incoming.set(relation.target, [...(incoming.get(relation.target) ?? []), relation.source]);
      outgoing.set(relation.source, [...(outgoing.get(relation.source) ?? []), relation.target]);
    });

  return { indegree, outdegree, incoming, outgoing };
}

function buildNodeOrderMap(layout: LayoutResult) {
  const ordered = [...layout.nodes]
    .sort((left, right) => {
      if (left.x !== right.x) {
        return left.x - right.x;
      }
      return left.y - right.y;
    })
    .map((node) => node.id);
  return new Map(ordered.map((id, index) => [id, index]));
}

function inferInitialNodeRole(label: string, indegree: number, outdegree: number): NodeRole {
  const patternRole = getPatternHit(NODE_ROLE_PATTERNS, label);
  if (patternRole) {
    return patternRole;
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

function resolveNodeRoleCandidate(
  explicitRole: NodeRole | undefined,
  label: string,
  indegree: number,
  outdegree: number
) {
  if (explicitRole) {
    return explicitRole;
  }
  return inferInitialNodeRole(label, indegree, outdegree);
}

function inferModuleRole(
  label: string,
  memberRoles: NodeRole[],
  index: number,
  totalModules: number
): ModuleRole {
  for (const candidate of MODULE_ROLE_PATTERNS) {
    if (candidate.patterns.some((pattern) => pattern.test(label))) {
      return candidate.role;
    }
  }

  const counts = {
    input: memberRoles.filter((role) => role === 'input' || role === 'media').length,
    control: memberRoles.filter((role) => role === 'parameter').length,
    auxiliary: memberRoles.filter((role) => role === 'decoder').length,
    output: memberRoles.filter((role) => role === 'output' || role === 'state').length,
  };

  if (counts.control > 0 && counts.control >= memberRoles.length / 2) {
    return 'control_stage';
  }
  if (counts.auxiliary > 0 && counts.auxiliary >= Math.max(1, memberRoles.length / 2)) {
    return 'auxiliary_stage';
  }
  if (counts.output > 0 && (index === totalModules - 1 || counts.output === memberRoles.length)) {
    return 'output_stage';
  }
  if (counts.input > 0 && (index === 0 || counts.input === memberRoles.length)) {
    return 'input_stage';
  }

  if (index === 0 && counts.input > 0) {
    return 'input_stage';
  }
  if (index === totalModules - 1 && counts.output > 0) {
    return 'output_stage';
  }

  return 'core_stage';
}

function refineNodeRole(
  label: string,
  role: NodeRole,
  indegree: number,
  outdegree: number,
  moduleRole?: ModuleRole
): NodeRole {
  if (moduleRole === 'control_stage' && role !== 'simulator') {
    return 'parameter';
  }
  if (moduleRole === 'auxiliary_stage' && (role === 'process' || role === 'input')) {
    return 'decoder';
  }
  if (moduleRole === 'input_stage' && indegree === 0 && role !== 'simulator') {
    return role === 'media' ? 'media' : 'input';
  }
  if (moduleRole === 'output_stage') {
    if (/state|当前|初始|更新/i.test(label)) {
      return 'state';
    }
    if (outdegree === 0 || role === 'process') {
      return 'output';
    }
  }
  if (role === 'output' && outdegree > 0 && /state|当前|初始|更新/i.test(label)) {
    return 'state';
  }
  if (role === 'input' && indegree > 0 && outdegree > 0 && moduleRole !== 'input_stage') {
    return 'process';
  }
  if (role === 'process' && indegree >= 2) {
    return 'aggregator';
  }
  if (role === 'process' && outdegree === 0) {
    return 'output';
  }
  if (role === 'state' && outdegree === 0 && /updated|next|output|结果|输出/i.test(label)) {
    return 'output';
  }
  return role;
}

function inferVisualPrimitive(
  role: NodeRole,
  label: string,
  moduleRole?: ModuleRole
): VisualPrimitive {
  if (role === 'media') {
    return 'media-card';
  }
  if (role === 'parameter') {
    return 'small-block';
  }
  if (role === 'state' || role === 'output') {
    return 'state-card';
  }
  if (role === 'aggregator') {
    return 'aggregator';
  }
  if (role === 'simulator') {
    return 'simulator';
  }
  if (
    role === 'input' &&
    (moduleRole === 'input_stage' || /input|raw|image|frame|history|输入|原始|图像|帧/i.test(label))
  ) {
    return 'container';
  }
  return 'block';
}

function inferPreferredRail(role: NodeRole, moduleRole?: ModuleRole): RailPreference {
  if (moduleRole === 'control_stage') {
    return 'top_control_rail';
  }
  if (moduleRole === 'auxiliary_stage') {
    return 'bottom_aux_rail';
  }
  if (moduleRole === 'output_stage') {
    return 'right_output_rail';
  }
  if (moduleRole === 'input_stage') {
    return 'left_input_rail';
  }

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

function inferFeedbackEdges(
  analysis: AnalysisResult,
  roleMap: Map<string, NodeRole>,
  moduleRoleMap: Map<string, ModuleRole>,
  nodeToModule: Map<string, string>,
  orderMap: Map<string, number>,
  moduleOrderMap: Map<string, number>
) {
  return analysis.relations
    .filter((relation) => relation.type === 'sequential')
    .filter((relation) => {
      const sourceOrder = orderMap.get(relation.source) ?? 0;
      const targetOrder = orderMap.get(relation.target) ?? 0;
      const sourceModuleOrder =
        moduleOrderMap.get(nodeToModule.get(relation.source) ?? '') ?? sourceOrder;
      const targetModuleOrder =
        moduleOrderMap.get(nodeToModule.get(relation.target) ?? '') ?? targetOrder;
      const sourceRole = roleMap.get(relation.source);
      const targetRole = roleMap.get(relation.target);
      const sourceModuleRole = moduleRoleMap.get(nodeToModule.get(relation.source) ?? '');
      const targetModuleRole = moduleRoleMap.get(nodeToModule.get(relation.target) ?? '');

      if (targetModuleOrder < sourceModuleOrder) {
        return true;
      }
      if (targetOrder < sourceOrder) {
        return true;
      }
      return (
        (sourceRole === 'output' || sourceRole === 'state' || sourceModuleRole === 'output_stage') &&
        (targetRole === 'process' ||
          targetRole === 'simulator' ||
          targetRole === 'aggregator' ||
          targetModuleRole === 'core_stage')
      );
    })
    .map((relation) => relation.id);
}

function getRoleWeight(role: NodeRole) {
  switch (role) {
    case 'input':
      return 0.18;
    case 'process':
      return 0.08;
    case 'aggregator':
      return 0.18;
    case 'simulator':
      return 0.28;
    case 'output':
      return 0.16;
    case 'state':
      return 0.06;
    case 'decoder':
      return -0.08;
    case 'parameter':
      return -0.12;
    case 'media':
      return -0.02;
    default:
      return 0;
  }
}

function getModuleWeight(role?: ModuleRole) {
  switch (role) {
    case 'input_stage':
      return 0.06;
    case 'core_stage':
      return 0.12;
    case 'output_stage':
      return 0.08;
    case 'auxiliary_stage':
      return -0.12;
    case 'control_stage':
      return -0.18;
    default:
      return 0;
  }
}

function computeDominantSpine(
  analysis: AnalysisResult,
  roleMap: Map<string, NodeRole>,
  moduleRoleMap: Map<string, ModuleRole>,
  nodeToModule: Map<string, string>,
  feedbackEdgeIds: Set<string>,
  orderMap: Map<string, number>,
  moduleOrderMap: Map<string, number>
) {
  if (analysis.spineCandidate && analysis.spineCandidate.length >= 2) {
    return [...analysis.spineCandidate];
  }

  const { incoming } = buildSequentialGraph(analysis, feedbackEdgeIds);
  const nodeWeight = new Map(
    analysis.entities.map((entity) => {
      const moduleId = nodeToModule.get(entity.id);
      const moduleRole = moduleRoleMap.get(moduleId ?? '');
      return [
        entity.id,
        (analysis.weights[entity.id] ?? 0.5) +
          getRoleWeight(roleMap.get(entity.id) ?? 'process') +
          getModuleWeight(moduleRole),
      ];
    })
  );

  const orderedNodeIds = [...analysis.entities]
    .sort((left, right) => {
      const leftModuleOrder =
        moduleOrderMap.get(nodeToModule.get(left.id) ?? '') ?? Number.MAX_SAFE_INTEGER;
      const rightModuleOrder =
        moduleOrderMap.get(nodeToModule.get(right.id) ?? '') ?? Number.MAX_SAFE_INTEGER;
      if (leftModuleOrder !== rightModuleOrder) {
        return leftModuleOrder - rightModuleOrder;
      }
      return (orderMap.get(left.id) ?? 0) - (orderMap.get(right.id) ?? 0);
    })
    .map((entity) => entity.id);

  const dp = new Map<string, number>();
  const prev = new Map<string, string | null>();

  orderedNodeIds.forEach((nodeId) => {
    const parents = incoming.get(nodeId) ?? [];
    let bestScore = nodeWeight.get(nodeId) ?? 0.5;
    let bestParent: string | null = null;

    parents.forEach((parentId) => {
      const sourceModuleOrder =
        moduleOrderMap.get(nodeToModule.get(parentId) ?? '') ?? 0;
      const targetModuleOrder =
        moduleOrderMap.get(nodeToModule.get(nodeId) ?? '') ?? 0;
      const transitionBonus =
        targetModuleOrder > sourceModuleOrder
          ? 0.14
          : targetModuleOrder === sourceModuleOrder
            ? 0.06
            : -0.2;
      const rolePenalty =
        roleMap.get(nodeId) === 'decoder' || roleMap.get(nodeId) === 'parameter'
          ? -0.2
          : 0;
      const score =
        (dp.get(parentId) ?? 0) +
        (nodeWeight.get(nodeId) ?? 0.5) +
        transitionBonus +
        rolePenalty;

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
    return orderedNodeIds.slice(0, Math.min(orderedNodeIds.length, 2));
  }

  return path;
}

function computeSpineSegments(dominantSpine: string[], nodeToModule: Map<string, string>) {
  const segments: string[][] = [];
  let currentSegment: string[] = [];
  let currentModuleId: string | undefined;

  dominantSpine.forEach((nodeId) => {
    const moduleId = nodeToModule.get(nodeId);
    if (!currentSegment.length || moduleId === currentModuleId) {
      currentSegment.push(nodeId);
      currentModuleId = moduleId;
      return;
    }

    segments.push(currentSegment);
    currentSegment = [nodeId];
    currentModuleId = moduleId;
  });

  if (currentSegment.length) {
    segments.push(currentSegment);
  }

  return segments;
}

function inferAttachmentSide(role: NodeRole, preferredRail?: RailPreference) {
  if (preferredRail === 'top_control_rail' || role === 'parameter') {
    return 'top' as const;
  }
  if (preferredRail === 'right_output_rail' || role === 'output' || role === 'state') {
    return 'right' as const;
  }
  if (preferredRail === 'left_input_rail' || role === 'input' || role === 'media') {
    return 'left' as const;
  }
  return 'bottom' as const;
}

function computeBranchAttachments(
  nodes: LayoutIntentNode[],
  dominantSpineSet: Set<string>,
  incoming: Map<string, string[]>,
  orderMap: Map<string, number>
) {
  const branchRoots: string[] = [];
  const branchAttachments: LayoutIntentBranchAttachment[] = [];

  nodes
    .filter((node) => !dominantSpineSet.has(node.id))
    .forEach((node) => {
      const spineParents = (incoming.get(node.id) ?? [])
        .filter((parentId) => dominantSpineSet.has(parentId))
        .sort((left, right) => (orderMap.get(left) ?? 0) - (orderMap.get(right) ?? 0));

      if (!spineParents.length) {
        return;
      }

      branchRoots.push(node.id);
      branchAttachments.push({
        branchRootId: node.id,
        attachToId: spineParents[spineParents.length - 1],
        side: inferAttachmentSide(node.role, node.preferredRail),
      });
    });

  return {
    branchRoots: unique(branchRoots),
    branchAttachments,
  };
}

function computeMergeClusters(
  nodes: LayoutIntentNode[],
  incoming: Map<string, string[]>,
  feedbackEdgeIds: Set<string>,
  analysis: AnalysisResult
) {
  const feedbackEdgeSet = new Set(feedbackEdgeIds);
  const incomingMap = new Map<string, string[]>();
  analysis.relations
    .filter((relation) => relation.type === 'sequential' && !feedbackEdgeSet.has(relation.id))
    .forEach((relation) => {
      incomingMap.set(relation.target, [...(incomingMap.get(relation.target) ?? []), relation.source]);
    });

  const clusters: LayoutIntentMergeCluster[] = [];
  const mergeNodes: string[] = [];

  nodes.forEach((node) => {
    const sources = unique(incomingMap.get(node.id) ?? incoming.get(node.id) ?? []);
    const isMergeLike =
      sources.length >= 2 || (node.role === 'simulator' && sources.length >= 1);
    if (!isMergeLike || sources.length === 0) {
      return;
    }

    mergeNodes.push(node.id);
    clusters.push({
      mergeNodeId: node.id,
      sourceIds: sources,
    });
  });

  return {
    mergeNodes: unique(mergeNodes),
    mergeClusters: clusters,
  };
}

function computeStatePairs(
  nodes: LayoutIntentNode[],
  outgoing: Map<string, string[]>,
  incoming: Map<string, string[]>
) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const simulatorIds = nodes.filter((node) => node.role === 'simulator').map((node) => node.id);
  const statePairs: LayoutIntentStatePair[] = [];

  simulatorIds.forEach((simulatorId) => {
    const currentCandidates = (incoming.get(simulatorId) ?? []).filter((nodeId) => {
      const role = nodeMap.get(nodeId)?.role;
      return role === 'state' || role === 'output';
    });
    const nextCandidates = (outgoing.get(simulatorId) ?? []).filter((nodeId) => {
      const role = nodeMap.get(nodeId)?.role;
      return role === 'state' || role === 'output';
    });

    currentCandidates.forEach((currentId) => {
      nextCandidates.forEach((nextId) => {
        statePairs.push({
          currentId,
          nextId,
          viaId: simulatorId,
        });
      });
    });
  });

  if (statePairs.length) {
    return statePairs;
  }

  const stateNodes = nodes.filter((node) => node.role === 'state' || node.role === 'output');
  if (stateNodes.length >= 2) {
    return [
      {
        currentId: stateNodes[0].id,
        nextId: stateNodes[stateNodes.length - 1].id,
      },
    ];
  }

  return [];
}

function computeZoneScores(
  nodes: LayoutIntentNode[],
  modules: LayoutIntentModule[]
): LayoutIntentZoneScores {
  const nodeCount = Math.max(nodes.length, 1);
  const inputNodes = nodes.filter(
    (node) => node.preferredRail === 'left_input_rail'
  ).length;
  const controlNodes = nodes.filter(
    (node) => node.preferredRail === 'top_control_rail'
  ).length;
  const auxNodes = nodes.filter(
    (node) => node.preferredRail === 'bottom_aux_rail'
  ).length;
  const outputNodes = nodes.filter(
    (node) => node.preferredRail === 'right_output_rail'
  ).length;

  const inputModules = modules.filter((moduleItem) => moduleItem.role === 'input_stage').length;
  const controlModules = modules.filter((moduleItem) => moduleItem.role === 'control_stage').length;
  const auxModules = modules.filter((moduleItem) => moduleItem.role === 'auxiliary_stage').length;
  const outputModules = modules.filter((moduleItem) => moduleItem.role === 'output_stage').length;
  const moduleFactor = Math.max(modules.length, 1);

  return {
    inputZoneScore: clamp01(inputNodes / nodeCount + inputModules / moduleFactor * 0.35),
    controlZoneScore: clamp01(controlNodes / nodeCount + controlModules / moduleFactor * 0.35),
    auxZoneScore: clamp01(auxNodes / nodeCount + auxModules / moduleFactor * 0.35),
    outputZoneScore: clamp01(outputNodes / nodeCount + outputModules / moduleFactor * 0.35),
  };
}

export function buildLayoutIntent(
  analysis: AnalysisResult,
  layout: LayoutResult
): LayoutIntent {
  const baseGraph = buildSequentialGraph(analysis);
  const orderMap = buildNodeOrderMap(layout);
  const moduleOrderMap = new Map(
    analysis.modules.map((moduleItem, index) => [moduleItem.id, moduleItem.order ?? index + 1])
  );
  const nodeToModule = new Map<string, string>();
  analysis.modules.forEach((moduleItem) => {
    moduleItem.entityIds.forEach((entityId) => nodeToModule.set(entityId, moduleItem.id));
  });

  const initialRoleMap = new Map<string, NodeRole>();
  analysis.entities.forEach((entity) => {
    initialRoleMap.set(
      entity.id,
      resolveNodeRoleCandidate(
        entity.roleCandidate,
        entity.label,
        baseGraph.indegree.get(entity.id) ?? 0,
        baseGraph.outdegree.get(entity.id) ?? 0
      )
    );
  });

  let modules: LayoutIntentModule[] = analysis.modules.map((moduleItem, index) => ({
    id: moduleItem.id,
    role:
      moduleItem.roleCandidate ??
      inferModuleRole(
        moduleItem.label,
        moduleItem.entityIds
          .map((entityId) => initialRoleMap.get(entityId))
          .filter((role): role is NodeRole => Boolean(role)),
        index,
        analysis.modules.length
      ),
    preferredRail: undefined,
    members: [...moduleItem.entityIds],
  }));

  const moduleRoleMap = new Map(modules.map((moduleItem) => [moduleItem.id, moduleItem.role]));
  const nodeRoleMap = new Map<string, NodeRole>();

  const nodes: LayoutIntentNode[] = analysis.entities.map((entity) => {
    const moduleId = nodeToModule.get(entity.id);
    const moduleRole = moduleRoleMap.get(moduleId ?? '');
    const role = refineNodeRole(
      entity.label,
      initialRoleMap.get(entity.id) ?? 'process',
      baseGraph.indegree.get(entity.id) ?? 0,
      baseGraph.outdegree.get(entity.id) ?? 0,
      moduleRole
    );
    nodeRoleMap.set(entity.id, role);
    return {
      id: entity.id,
      role,
      primitive: inferVisualPrimitive(role, entity.label, moduleRole),
      importance: analysis.weights[entity.id] ?? 0.5,
      moduleId,
      preferredRail: inferPreferredRail(role, moduleRole),
      isMainSpineCandidate: role !== 'annotation' && role !== 'parameter',
    };
  });

  modules = analysis.modules.map((moduleItem, index) => {
    const memberRoles = moduleItem.entityIds
      .map((entityId) => nodeRoleMap.get(entityId))
      .filter((role): role is NodeRole => Boolean(role));
    const role =
      moduleItem.roleCandidate ??
      inferModuleRole(moduleItem.label, memberRoles, index, analysis.modules.length);
    return {
      id: moduleItem.id,
      role,
      preferredRail: inferPreferredRail(memberRoles[0] ?? 'process', role),
      members: [...moduleItem.entityIds],
    };
  });

  const resolvedModuleRoleMap = new Map(modules.map((moduleItem) => [moduleItem.id, moduleItem.role]));
  const feedbackEdgeIds = new Set(
    inferFeedbackEdges(
      analysis,
      nodeRoleMap,
      resolvedModuleRoleMap,
      nodeToModule,
      orderMap,
      moduleOrderMap
    )
  );
  const dominantSpine = computeDominantSpine(
    analysis,
    nodeRoleMap,
    resolvedModuleRoleMap,
    nodeToModule,
    feedbackEdgeIds,
    orderMap,
    moduleOrderMap
  );
  const dominantSpineSet = new Set(dominantSpine);
  const graphWithoutFeedback = buildSequentialGraph(analysis, feedbackEdgeIds);
  const spineSegments = computeSpineSegments(dominantSpine, nodeToModule);
  const { branchRoots, branchAttachments } = computeBranchAttachments(
    nodes,
    dominantSpineSet,
    graphWithoutFeedback.incoming,
    orderMap
  );
  const { mergeNodes, mergeClusters } = computeMergeClusters(
    nodes,
    graphWithoutFeedback.incoming,
    feedbackEdgeIds,
    analysis
  );
  const statePairs = computeStatePairs(
    nodes,
    graphWithoutFeedback.outgoing,
    graphWithoutFeedback.incoming
  );
  const inputContainers = nodes
    .filter(
      (node) =>
        node.primitive === 'container' ||
        (node.role === 'media' && node.preferredRail === 'left_input_rail')
    )
    .map((node) => node.id);
  const zoneScores = computeZoneScores(nodes, modules);

  const spineIndexMap = new Map(dominantSpine.map((nodeId, index) => [nodeId, index]));
  const edges: LayoutIntentEdge[] = analysis.relations.map((relation) => {
    let role: EdgeRole =
      relation.roleCandidate ??
      (relation.type === 'annotative' ? 'annotation' : 'main');

    if (relation.roleCandidate) {
      role = relation.roleCandidate;
    } else if (relation.type === 'annotative') {
      role = nodeRoleMap.get(relation.source) === 'parameter' ? 'control' : 'annotation';
    } else if (feedbackEdgeIds.has(relation.id)) {
      role = 'feedback';
    } else {
      const sourceOnSpine = dominantSpineSet.has(relation.source);
      const targetOnSpine = dominantSpineSet.has(relation.target);
      const sourceIndex = spineIndexMap.get(relation.source) ?? -1;
      const targetIndex = spineIndexMap.get(relation.target) ?? -1;

      if (
        sourceOnSpine &&
        targetOnSpine &&
        targetIndex === sourceIndex + 1
      ) {
        role = 'main';
      } else if (nodeRoleMap.get(relation.source) === 'parameter') {
        role = 'control';
      } else {
        role = 'auxiliary';
      }
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
              ? 0.78
              : role === 'annotation'
                ? 0.55
                : 0.68,
    };
  });

  const layoutHints = [
    inputContainers.length > 0 ? 'has_input_container' : null,
    branchAttachments.length > 0 ? 'has_branch' : null,
    mergeClusters.length > 0 ? 'has_merge_cluster' : null,
    feedbackEdgeIds.size > 0 ? 'has_feedback' : null,
    statePairs.length > 0 ? 'has_state_pair' : null,
    zoneScores.controlZoneScore > 0.2 ? 'has_control_zone' : null,
    zoneScores.auxZoneScore > 0.2 ? 'has_aux_zone' : null,
  ].filter((hint): hint is string => Boolean(hint));

  return {
    nodes,
    edges,
    modules,
    dominantSpine,
    spineSegments,
    branchRoots,
    branchAttachments,
    mergeNodes,
    mergeClusters,
    feedbackEdges: [...feedbackEdgeIds],
    statePairs,
    inputContainers,
    zoneScores,
    layoutHints,
  };
}
