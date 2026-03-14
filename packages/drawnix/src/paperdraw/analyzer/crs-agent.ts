/**
 * 本地 QA 与分析结果合并
 * 默认不再调用第二次 LLM，直接基于 ExtractionResult 生成问题和最终分析
 */

import { PAPERDRAW_LOW_CONFIDENCE_THRESHOLD } from '../config/defaults';
import {
  AnalysisResult,
  CRSAnswer,
  CRSQuestion,
  Entity,
  ExtractionResult,
  FlowRelation,
  LLMConfig,
  ModuleGroup,
  ModuleRole,
} from '../types/analyzer';

const DEFAULT_WEIGHT = 0.5;
const IMPORTANT_WEIGHT = 0.9;
const ROOT_WEIGHT = 0.65;
const MAX_LOW_CONFIDENCE_QUESTIONS = 2;
const MAX_RELATION_PRUNING_OPTIONS = 6;
const MAX_MODULE_ROLE_OPTIONS = 4;
const MAX_MERGE_NODE_OPTIONS = 4;
const MAX_FEEDBACK_EDGE_OPTIONS = 4;
const MIN_LINEAR_GUARD_MODULES = 4;

const CONTROL_MODULE_PATTERNS = [
  /control/i,
  /condition/i,
  /parameter/i,
  /prompt/i,
  /控制/,
  /条件/,
  /参数/,
];
const AUXILIARY_MODULE_PATTERNS = [
  /aux/i,
  /branch/i,
  /decoder/i,
  /辅助/,
  /分支/,
  /解码/,
];

const isCoreLikeRole = (role: Entity['roleCandidate']) => {
  return role === 'process' || role === 'aggregator' || role === 'simulator';
};

const getModuleRoleSignals = (
  extraction: ExtractionResult,
  moduleItem: ModuleGroup,
  targetRole: ModuleRole
) => {
  const members = moduleItem.entityIds
    .map((entityId) => getEntityById(extraction.entities, entityId))
    .filter((entity): entity is Entity => Boolean(entity));

  const targetCount = members.filter((entity) =>
    targetRole === 'control_stage'
      ? entity.roleCandidate === 'parameter'
      : entity.roleCandidate === 'decoder'
  ).length;
  const coreCount = members.filter((entity) => isCoreLikeRole(entity.roleCandidate)).length;
  const patternHit =
    targetRole === 'control_stage'
      ? CONTROL_MODULE_PATTERNS.some((pattern) => pattern.test(`${moduleItem.label} ${moduleItem.evidence ?? ''}`))
      : AUXILIARY_MODULE_PATTERNS.some((pattern) => pattern.test(`${moduleItem.label} ${moduleItem.evidence ?? ''}`));

  return {
    members,
    targetCount,
    coreCount,
    patternHit,
    isPureTarget: targetCount > 0 && coreCount === 0,
    isMixedWithCore: targetCount > 0 && coreCount > 0,
  };
};
const MERGE_NODE_PATTERNS = [
  /merge/i,
  /fusion/i,
  /aggregate/i,
  /concat/i,
  /汇聚/,
  /融合/,
  /聚合/,
  /合并/,
  /拼接/,
];

const getEntityById = (entities: Entity[], entityId: string) => {
  return entities.find((entity) => entity.id === entityId);
};

const getEntityByLabel = (entities: Entity[], label: string) => {
  return entities.find((entity) => entity.label === label);
};

const filterSpineCandidate = (
  spineCandidate: ExtractionResult['spineCandidate'],
  allowedEntityIds: Set<string>
) => {
  if (!spineCandidate?.length) {
    return undefined;
  }

  const filtered = spineCandidate.filter((entityId) => allowedEntityIds.has(entityId));
  const deduped = Array.from(new Set(filtered));
  return deduped.length >= 2 ? deduped : undefined;
};

const getSequentialStats = (relations: FlowRelation[]) => {
  const indegree = new Map<string, number>();
  const outdegree = new Map<string, number>();

  for (const relation of relations) {
    if (relation.type !== 'sequential') {
      continue;
    }
    indegree.set(relation.target, (indegree.get(relation.target) || 0) + 1);
    outdegree.set(relation.source, (outdegree.get(relation.source) || 0) + 1);
  }

  return { indegree, outdegree };
};

const buildEntityOrderMap = (extraction: ExtractionResult) => {
  const orderedIds = extraction.spineCandidate?.length
    ? [
        ...extraction.spineCandidate,
        ...extraction.entities
          .map((entity) => entity.id)
          .filter((entityId) => !extraction.spineCandidate?.includes(entityId)),
      ]
    : extraction.entities.map((entity) => entity.id);

  return new Map(orderedIds.map((entityId, index) => [entityId, index]));
};

const getOrderedEntityIds = (
  extraction: ExtractionResult,
  entities: Entity[] = extraction.entities
) => {
  const entityOrderMap = buildEntityOrderMap(extraction);
  return [...entities]
    .sort(
      (left, right) =>
        (entityOrderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (entityOrderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    )
    .map((entity) => entity.id);
};

const getOrderedModules = (extraction: ExtractionResult) => {
  return [...extraction.modules].sort(
    (left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
  );
};

const isLikelyFlattenedLinearFlow = (extraction: ExtractionResult) => {
  if (
    extraction.entities.length < MIN_LINEAR_GUARD_MODULES + 1 ||
    extraction.modules.length < MIN_LINEAR_GUARD_MODULES
  ) {
    return false;
  }

  const sequentialRelations = extraction.relations.filter(
    (relation): relation is FlowRelation & { type: 'sequential' } =>
      relation.type === 'sequential'
  );
  if (sequentialRelations.length < extraction.entities.length - 1) {
    return false;
  }

  const { indegree, outdegree } = getSequentialStats(extraction.relations);
  const hasBranchOrMerge = extraction.entities.some(
    (entity) => (indegree.get(entity.id) ?? 0) > 1 || (outdegree.get(entity.id) ?? 0) > 1
  );
  if (hasBranchOrMerge) {
    return false;
  }

  const hasEntityStructureSignal = extraction.entities.some((entity) =>
    entity.roleCandidate === 'parameter' ||
    entity.roleCandidate === 'decoder' ||
    entity.roleCandidate === 'aggregator' ||
    entity.roleCandidate === 'simulator' ||
    entity.roleCandidate === 'state'
  );
  const hasRelationStructureSignal = extraction.relations.some(
    (relation) =>
      relation.type === 'annotative' ||
      relation.roleCandidate === 'auxiliary' ||
      relation.roleCandidate === 'control' ||
      relation.roleCandidate === 'feedback'
  );
  const hasModuleStructureSignal = extraction.modules.some(
    (moduleItem) =>
      moduleItem.roleCandidate === 'control_stage' ||
      moduleItem.roleCandidate === 'auxiliary_stage'
  );

  return !hasEntityStructureSignal && !hasRelationStructureSignal && !hasModuleStructureSignal;
};

const getSelectedIds = (
  answer: CRSAnswer | undefined,
  options: string[],
  ids: string[] | undefined
) => {
  if (!answer || !ids?.length) {
    return [];
  }

  const selectedOptions = new Set(answer.selectedOptions);
  return options.flatMap((option, index) => {
    const relatedId = ids[index];
    return selectedOptions.has(option) && relatedId ? [relatedId] : [];
  });
};

const ensureUniqueOptions = (options: string[]) => {
  const counts = new Map<string, number>();
  return options.map((option) => {
    const nextCount = (counts.get(option) ?? 0) + 1;
    counts.set(option, nextCount);
    return nextCount === 1 ? option : `${option} (${nextCount})`;
  });
};

const formatRelationOption = (
  relation: FlowRelation,
  entities: Entity[]
) => {
  const sourceLabel = getEntityById(entities, relation.source)?.label ?? relation.source;
  const targetLabel = getEntityById(entities, relation.target)?.label ?? relation.target;
  const suffix =
    relation.type === 'annotative'
      ? '（说明）'
      : relation.roleCandidate === 'auxiliary'
        ? '（辅助）'
        : relation.roleCandidate === 'control'
          ? '（控制）'
          : '';
  return `${sourceLabel} -> ${targetLabel}${suffix}`;
};

const getSpineEdgeIds = (extraction: ExtractionResult) => {
  if (!extraction.spineCandidate || extraction.spineCandidate.length < 2) {
    return new Set<string>();
  }

  const edgeIds = new Set<string>();
  for (let index = 0; index < extraction.spineCandidate.length - 1; index += 1) {
    const sourceId = extraction.spineCandidate[index];
    const targetId = extraction.spineCandidate[index + 1];
    const relation = extraction.relations.find(
      (item) =>
        item.type === 'sequential' &&
        item.source === sourceId &&
        item.target === targetId
    );
    if (relation) {
      edgeIds.add(relation.id);
    }
  }
  return edgeIds;
};

const getMainModuleSelection = (
  extraction: ExtractionResult,
  answers: CRSAnswer[],
  questions: CRSQuestion[]
) => {
  const question = questions.find((item) => item.type === 'main_module_selection');
  if (!question?.relatedModuleIds?.length) {
    return {
      selectedMiddleModuleIds: [] as string[],
      selectedMainModuleIds: new Set<string>(),
    };
  }

  const answer = answers.find((item) => item.questionId === question.id);
  const selectedMiddleModuleIds = getSelectedIds(
    answer,
    question.options,
    question.relatedModuleIds
  );
  if (!selectedMiddleModuleIds.length) {
    return {
      selectedMiddleModuleIds,
      selectedMainModuleIds: new Set<string>(),
    };
  }

  const orderedModules = getOrderedModules(extraction);
  const firstModuleId = orderedModules[0]?.id;
  const lastModuleId = orderedModules[orderedModules.length - 1]?.id;
  return {
    selectedMiddleModuleIds,
    selectedMainModuleIds: new Set(
      [firstModuleId, ...selectedMiddleModuleIds, lastModuleId].filter(
        (moduleId): moduleId is string => Boolean(moduleId)
      )
    ),
  };
};

const getMainRelationSelection = (
  answers: CRSAnswer[],
  questions: CRSQuestion[]
) => {
  const question = questions.find((item) => item.type === 'main_relation_selection');
  if (!question?.relatedRelationIds?.length) {
    return [];
  }
  const answer = answers.find((item) => item.questionId === question.id);
  return getSelectedIds(answer, question.options, question.relatedRelationIds);
};

const getFeedbackRelationCandidates = (extraction: ExtractionResult) => {
  const orderMap = buildEntityOrderMap(extraction);
  return extraction.relations
    .filter((relation) => relation.type === 'sequential')
    .filter((relation) => relation.roleCandidate !== 'main' && relation.roleCandidate !== 'feedback')
    .filter((relation) => {
      const sourceOrder = orderMap.get(relation.source);
      const targetOrder = orderMap.get(relation.target);
      if (sourceOrder === undefined || targetOrder === undefined) {
        return false;
      }
      return targetOrder < sourceOrder;
    });
};

const buildDefaultWeights = (entities: Entity[], relations: FlowRelation[]) => {
  const { indegree, outdegree } = getSequentialStats(relations);
  return entities.reduce<Record<string, number>>((accumulator, entity) => {
    const isRoot = (indegree.get(entity.id) || 0) === 0;
    accumulator[entity.id] = isRoot || (outdegree.get(entity.id) || 0) > 0
      ? ROOT_WEIGHT
      : DEFAULT_WEIGHT;
    return accumulator;
  }, {});
};

const getModuleQuestions = (extraction: ExtractionResult): CRSQuestion[] => {
  return [...extraction.modules]
    .sort((left, right) => {
      const leftPriority =
        (left.entityIds.length > 4 ? 2 : 0) +
        ((left.confidence ?? DEFAULT_WEIGHT) < PAPERDRAW_LOW_CONFIDENCE_THRESHOLD ? 1 : 0);
      const rightPriority =
        (right.entityIds.length > 4 ? 2 : 0) +
        ((right.confidence ?? DEFAULT_WEIGHT) < PAPERDRAW_LOW_CONFIDENCE_THRESHOLD ? 1 : 0);
      return rightPriority - leftPriority;
    })
    .slice(0, Math.max(2, extraction.modules.length))
    .map((moduleItem, index) => ({
      id: `q-module-${index + 1}`,
      type: 'module_grouping' as const,
      question:
        moduleItem.entityIds.length > 4
          ? `模块「${moduleItem.label}」较大，以下实体哪些应保留在这个模块中？`
          : `请确认以下实体是否属于模块「${moduleItem.label}」`,
      options: moduleItem.entityIds
        .map((entityId) => getEntityById(extraction.entities, entityId)?.label)
        .filter((label): label is string => Boolean(label)),
      multiSelect: true,
      relatedEntityIds: [...moduleItem.entityIds],
      moduleId: moduleItem.id,
      moduleLabel: moduleItem.label,
    }))
    .filter((question) => question.options.length >= 2);
};

const getLowConfidenceQuestions = (extraction: ExtractionResult): CRSQuestion[] => {
  return extraction.entities
    .filter((entity) => (entity.confidence ?? DEFAULT_WEIGHT) < PAPERDRAW_LOW_CONFIDENCE_THRESHOLD)
    .sort((left, right) => (left.confidence ?? DEFAULT_WEIGHT) - (right.confidence ?? DEFAULT_WEIGHT))
    .slice(0, MAX_LOW_CONFIDENCE_QUESTIONS)
    .map((entity, index) => ({
      id: `q-low-confidence-${index + 1}`,
      type: 'low_confidence' as const,
      question: `实体「${entity.label}」置信度较低，是否保留？`,
      options: ['保留', '忽略'],
      multiSelect: false,
      relatedEntityIds: [entity.id],
      entityId: entity.id,
    }));
};

const getImportanceQuestion = (extraction: ExtractionResult): CRSQuestion[] => {
  const { indegree, outdegree } = getSequentialStats(extraction.relations);

  const candidates = extraction.entities
    .filter((entity) => (outdegree.get(entity.id) || 0) > 0 || (indegree.get(entity.id) || 0) === 0)
    .sort((left, right) => {
      const rightScore = (outdegree.get(right.id) || 0) - (indegree.get(right.id) || 0);
      const leftScore = (outdegree.get(left.id) || 0) - (indegree.get(left.id) || 0);
      return rightScore - leftScore;
    })
    .slice(0, 4);

  if (candidates.length < 2) {
    return [];
  }

  return [
    {
      id: 'q-importance-1',
      type: 'importance_ranking',
      question: '以下实体中，哪个对整体流程最关键？',
      options: candidates.map((entity) => entity.label),
      multiSelect: false,
      relatedEntityIds: candidates.map((entity) => entity.id),
    },
  ];
};

const getSpineQuestion = (extraction: ExtractionResult): CRSQuestion[] => {
  const mainModuleCandidates = getOrderedModules(extraction).slice(1, -1);
  const flattenedLinearFlow = isLikelyFlattenedLinearFlow(extraction);
  const mainRelationCandidates = extraction.relations.filter(
    (relation): relation is Extract<FlowRelation, { type: 'sequential' }> =>
      relation.type === 'sequential'
  );
  const questions: CRSQuestion[] = [];

  if (
    flattenedLinearFlow &&
    mainModuleCandidates.length >= 2
  ) {
    questions.push({
      id: 'q-main-modules-1',
      type: 'main_module_selection',
      question:
        '当前结果更像一条顺序流程。以下中间模块中，哪些应继续留在主干上？未选模块会优先作为辅助区处理。',
      options: ensureUniqueOptions(mainModuleCandidates.map((moduleItem) => moduleItem.label)),
      multiSelect: true,
      relatedModuleIds: mainModuleCandidates.map((moduleItem) => moduleItem.id),
    });
  }

  if (flattenedLinearFlow && mainRelationCandidates.length >= 3) {
    questions.push({
      id: 'q-main-relations-1',
      type: 'main_relation_selection',
      question:
        '以下顺序连线中，哪些应继续保留在主干上？未选连线会优先降为辅助连线。',
      options: ensureUniqueOptions(
        mainRelationCandidates.map((relation) => formatRelationOption(relation, extraction.entities))
      ),
      multiSelect: true,
      relatedRelationIds: mainRelationCandidates.map((relation) => relation.id),
    });
  }

  if (questions.length) {
    return questions;
  }

  const candidateEntityIds =
    extraction.spineCandidate && extraction.spineCandidate.length >= 3
      ? extraction.spineCandidate.filter((entityId) =>
          extraction.entities.some((entity) => entity.id === entityId)
        )
      : [];

  if (candidateEntityIds.length < 3) {
    return [];
  }

  const options = candidateEntityIds
    .map((entityId) => getEntityById(extraction.entities, entityId)?.label)
    .filter((label): label is string => Boolean(label));

  if (options.length < 3) {
    return [];
  }

  return [
    {
      id: 'q-spine-1',
      type: 'spine_selection',
      question: '以下实体中，哪些应保留在主干流程中？',
      options,
      multiSelect: true,
      relatedEntityIds: candidateEntityIds,
    },
  ];
};

const getMergeNodeQuestion = (extraction: ExtractionResult): CRSQuestion[] => {
  const { indegree } = getSequentialStats(extraction.relations);
  const candidates = extraction.entities
    .map((entity) => {
      const indegreeScore = indegree.get(entity.id) ?? 0;
      const patternScore = MERGE_NODE_PATTERNS.some((pattern) => pattern.test(entity.label)) ? 2 : 0;
      const explicitScore = entity.roleCandidate === 'aggregator' ? 3 : 0;
      return {
        entity,
        score: indegreeScore * 2 + patternScore + explicitScore,
      };
    })
    .filter(({ score, entity }) => score > 0 || (indegree.get(entity.id) ?? 0) >= 2)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return (right.entity.confidence ?? DEFAULT_WEIGHT) - (left.entity.confidence ?? DEFAULT_WEIGHT);
    })
    .slice(0, MAX_MERGE_NODE_OPTIONS);

  if (!candidates.length) {
    return [];
  }

  return [
    {
      id: 'q-merge-node-1',
      type: 'merge_node_selection',
      question: '以下实体中，哪些更像汇聚或合并节点？',
      options: ensureUniqueOptions(candidates.map(({ entity }) => entity.label)),
      multiSelect: true,
      relatedEntityIds: candidates.map(({ entity }) => entity.id),
    },
  ];
};

const getFeedbackQuestion = (extraction: ExtractionResult): CRSQuestion[] => {
  const candidates = getFeedbackRelationCandidates(extraction).slice(
    0,
    MAX_FEEDBACK_EDGE_OPTIONS
  );

  if (!candidates.length) {
    return [];
  }

  return [
    {
      id: 'q-feedback-edge-1',
      type: 'feedback_edge_selection',
      question: '以下连线中，哪些属于反馈回路？',
      options: ensureUniqueOptions(
        candidates.map((relation) => formatRelationOption(relation, extraction.entities))
      ),
      multiSelect: true,
      relatedRelationIds: candidates.map((relation) => relation.id),
    },
  ];
};

const getRelationPruningQuestion = (extraction: ExtractionResult): CRSQuestion[] => {
  const spineEdgeIds = getSpineEdgeIds(extraction);
  const feedbackCandidateIds = new Set(
    getFeedbackRelationCandidates(extraction).map((relation) => relation.id)
  );
  const candidates = extraction.relations
    .filter((relation) => {
      if (relation.type === 'annotative') {
        return true;
      }
      if (spineEdgeIds.has(relation.id)) {
        return false;
      }
      if (feedbackCandidateIds.has(relation.id)) {
        return false;
      }
      return relation.roleCandidate !== 'main' && relation.roleCandidate !== 'feedback';
    })
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'annotative' ? -1 : 1;
      }
      return (left.confidence ?? DEFAULT_WEIGHT) - (right.confidence ?? DEFAULT_WEIGHT);
    })
    .slice(0, MAX_RELATION_PRUNING_OPTIONS);

  if (!candidates.length) {
    return [];
  }

  return [
    {
      id: 'q-relation-pruning-1',
      type: 'relation_pruning',
      question: '以下关系中，哪些更像说明性或辅助连线，可以弱化或省略？',
      options: ensureUniqueOptions(
        candidates.map((relation) => formatRelationOption(relation, extraction.entities))
      ),
      multiSelect: true,
      relatedRelationIds: candidates.map((relation) => relation.id),
    },
  ];
};

const getModuleRoleScore = (
  extraction: ExtractionResult,
  moduleItem: ModuleGroup,
  targetRole: ModuleRole
) => {
  const signals = getModuleRoleSignals(extraction, moduleItem, targetRole);
  const explicitScore = moduleItem.roleCandidate === targetRole ? 1 : 0;
  const purityScore = signals.isPureTarget ? 2 : 0;
  const mixedPenalty = signals.isMixedWithCore ? -2 : 0;

  return (
    (signals.patternHit ? 3 : 0) +
    signals.targetCount +
    explicitScore +
    purityScore +
    mixedPenalty
  );
};

const getModuleRoleQuestions = (extraction: ExtractionResult): CRSQuestion[] => {
  const questions: CRSQuestion[] = [];
  const roleConfigs: Array<{ targetRole: ModuleRole; question: string; id: string }> = [
    {
      targetRole: 'control_stage',
      question: '以下模块中，哪个更像控制区？',
      id: 'q-module-role-control-1',
    },
    {
      targetRole: 'auxiliary_stage',
      question: '以下模块中，哪个更像辅助区？',
      id: 'q-module-role-aux-1',
    },
  ];

  for (const roleConfig of roleConfigs) {
    const currentAssignedModules = extraction.modules.filter(
      (moduleItem) => moduleItem.roleCandidate === roleConfig.targetRole
    );
    const rankedModules = [...extraction.modules]
      .map((moduleItem) => ({
        moduleItem,
        score: getModuleRoleScore(extraction, moduleItem, roleConfig.targetRole),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return (right.moduleItem.confidence ?? DEFAULT_WEIGHT) - (left.moduleItem.confidence ?? DEFAULT_WEIGHT);
      });

    const prioritizedCandidates = rankedModules.filter(
      ({ moduleItem, score }) =>
        score > 0 || currentAssignedModules.some((assignedModule) => assignedModule.id === moduleItem.id)
    );
    const topCandidates = [...prioritizedCandidates];
    for (const rankedModule of rankedModules) {
      if (topCandidates.length >= MAX_MODULE_ROLE_OPTIONS) {
        break;
      }
      if (topCandidates.some(({ moduleItem }) => moduleItem.id === rankedModule.moduleItem.id)) {
        continue;
      }
      topCandidates.push(rankedModule);
    }

    const currentAssignedIsMixed = currentAssignedModules.some((moduleItem) =>
      getModuleRoleSignals(extraction, moduleItem, roleConfig.targetRole).isMixedWithCore
    );
    const bestCandidate = topCandidates[0];
    const shouldAsk =
      (!currentAssignedModules.length && topCandidates.length >= 2 && (bestCandidate?.score ?? 0) > 0) ||
      (currentAssignedModules.length > 0 &&
        topCandidates.length >= 2 &&
        (currentAssignedIsMixed ||
          topCandidates.some(
            ({ moduleItem, score }) =>
              !currentAssignedModules.some((assignedModule) => assignedModule.id === moduleItem.id) &&
              score >= (bestCandidate?.score ?? 0)
          )));

    if (!shouldAsk) {
      continue;
    }

    questions.push({
      id: roleConfig.id,
      type: 'module_role_assignment',
      question: roleConfig.question,
      options: ensureUniqueOptions(topCandidates.map(({ moduleItem }) => moduleItem.label)),
      multiSelect: false,
      relatedModuleIds: topCandidates.map(({ moduleItem }) => moduleItem.id),
      targetRoleCandidate: roleConfig.targetRole,
    });
  }

  return questions;
};

export function generateQuestions(extraction: ExtractionResult, _config?: LLMConfig): CRSQuestion[] {
  return [
    ...getSpineQuestion(extraction),
    ...getMergeNodeQuestion(extraction),
    ...getFeedbackQuestion(extraction),
    ...getRelationPruningQuestion(extraction),
    ...getModuleRoleQuestions(extraction),
    ...getModuleQuestions(extraction),
    ...getLowConfidenceQuestions(extraction),
    ...getImportanceQuestion(extraction),
  ];
}

function applyMainModuleSelectionAnswers(
  extraction: ExtractionResult,
  entities: Entity[],
  relations: FlowRelation[],
  answers: CRSAnswer[],
  questions: CRSQuestion[]
) {
  const { selectedMiddleModuleIds, selectedMainModuleIds } = getMainModuleSelection(
    extraction,
    answers,
    questions
  );
  const selectedMainRelationIds = new Set(
    getMainRelationSelection(answers, questions)
  );
  const allowedEntityIds = new Set(entities.map((entity) => entity.id));
  const entityToModule = new Map<string, string>();
  extraction.modules.forEach((moduleItem) => {
    moduleItem.entityIds.forEach((entityId) => entityToModule.set(entityId, moduleItem.id));
  });

  let inferredSpineCandidate = filterSpineCandidate(
    getOrderedEntityIds(extraction, entities).filter((entityId) =>
      selectedMainModuleIds.has(entityToModule.get(entityId) ?? '')
    ),
    allowedEntityIds
  );

  if (selectedMainRelationIds.size > 0) {
    const selectedMainNodeIds = getOrderedEntityIds(extraction, entities).filter((entityId) =>
      relations.some(
        (relation) =>
          relation.type === 'sequential' &&
          selectedMainRelationIds.has(relation.id) &&
          (relation.source === entityId || relation.target === entityId)
      )
    );
    const inferredFromRelations = filterSpineCandidate(selectedMainNodeIds, allowedEntityIds);
    if (inferredFromRelations?.length) {
      inferredSpineCandidate = inferredFromRelations;
    }
  }

  const spineEdgeKeys = new Set<string>();
  if (inferredSpineCandidate?.length) {
    for (let index = 0; index < inferredSpineCandidate.length - 1; index += 1) {
      const sourceId = inferredSpineCandidate[index];
      const targetId = inferredSpineCandidate[index + 1];
      spineEdgeKeys.add(`${sourceId}->${targetId}`);
    }
  }

  return {
    selectedMiddleModuleIds,
    selectedMainModuleIds,
    selectedMainRelationIds,
    inferredSpineCandidate,
    relations: relations.map((relation): FlowRelation => {
      if (relation.type !== 'sequential' || relation.roleCandidate === 'feedback') {
        return relation;
      }

      if (selectedMainRelationIds.has(relation.id)) {
        return relation.roleCandidate === 'main'
          ? relation
          : {
              ...relation,
              roleCandidate: 'main',
            };
      }

      if (spineEdgeKeys.has(`${relation.source}->${relation.target}`)) {
        return relation.roleCandidate === 'main'
          ? relation
          : {
              ...relation,
              roleCandidate: 'main',
            };
      }

      const sourceModuleId = entityToModule.get(relation.source);
      const targetModuleId = entityToModule.get(relation.target);
      const isDetachedRelation =
        selectedMainModuleIds.size > 0 &&
        (!selectedMainModuleIds.has(sourceModuleId ?? '') ||
          !selectedMainModuleIds.has(targetModuleId ?? ''));
      const isDeselectedMainRelation =
        selectedMainRelationIds.size > 0 &&
        !selectedMainRelationIds.has(relation.id);

      if (!isDetachedRelation && !isDeselectedMainRelation) {
        return relation;
      }

      return relation.roleCandidate === 'auxiliary'
        ? relation
        : {
            ...relation,
            roleCandidate: 'auxiliary',
          };
    }),
  };
}

function applyLowConfidenceAnswers(
  entities: Entity[],
  answers: CRSAnswer[],
  questions: CRSQuestion[]
) {
  const ignoredEntityIds = new Set<string>();

  for (const question of questions) {
    if (question.type !== 'low_confidence' || !question.entityId) {
      continue;
    }
    const answer = answers.find((item) => item.questionId === question.id);
    if (answer?.selectedOptions[0] === '忽略') {
      ignoredEntityIds.add(question.entityId);
    }
  }

  return {
    ignoredEntityIds,
    entities: entities.filter((entity) => !ignoredEntityIds.has(entity.id)),
  };
}

function applyMergeNodeAnswers(
  entities: Entity[],
  answers: CRSAnswer[],
  questions: CRSQuestion[]
) {
  const mergeEntityIds = new Set<string>();

  for (const question of questions) {
    if (question.type !== 'merge_node_selection') {
      continue;
    }
    const answer = answers.find((item) => item.questionId === question.id);
    getSelectedIds(answer, question.options, question.relatedEntityIds).forEach((entityId) => {
      mergeEntityIds.add(entityId);
    });
  }

  return {
    mergeEntityIds,
    entities: entities.map((entity): Entity =>
      mergeEntityIds.has(entity.id)
        ? {
            ...entity,
            roleCandidate: 'aggregator',
          }
        : entity
    ),
  };
}

function updateModules(
  extraction: ExtractionResult,
  entities: Entity[],
  answers: CRSAnswer[],
  questions: CRSQuestion[]
) {
  const allowedEntityIds = new Set(entities.map((entity) => entity.id));
  const moduleRoleAssignments = new Map<string, ModuleRole>();
  const clearedRoleAssignments = new Set<ModuleRole>();
  const { selectedMiddleModuleIds, selectedMainModuleIds } = getMainModuleSelection(
    extraction,
    answers,
    questions
  );

  for (const question of questions) {
    if (
      question.type !== 'module_role_assignment' ||
      !question.targetRoleCandidate
    ) {
      continue;
    }

    const answer = answers.find((item) => item.questionId === question.id);
    const [selectedModuleId] = getSelectedIds(
      answer,
      question.options,
      question.relatedModuleIds
    );
    if (!selectedModuleId) {
      continue;
    }
    clearedRoleAssignments.add(question.targetRoleCandidate);
    moduleRoleAssignments.set(selectedModuleId, question.targetRoleCandidate);
  }

  const nextModules = extraction.modules
    .map((moduleItem) => ({ ...moduleItem, entityIds: [...moduleItem.entityIds] }))
    .map((moduleItem) => {
      const question = questions.find(
        (item) => item.type === 'module_grouping' && item.moduleId === moduleItem.id
      );
      const answer = question
        ? answers.find((item) => item.questionId === question.id)
        : undefined;

      const entityIds = answer
        ? answer.selectedOptions
            .map((label) => getEntityByLabel(entities, label)?.id)
            .filter((entityId): entityId is string => Boolean(entityId && allowedEntityIds.has(entityId)))
        : moduleItem.entityIds.filter((entityId) => allowedEntityIds.has(entityId));

      let roleCandidate = moduleRoleAssignments.has(moduleItem.id)
        ? moduleRoleAssignments.get(moduleItem.id)
        : moduleItem.roleCandidate &&
            clearedRoleAssignments.has(moduleItem.roleCandidate)
            ? undefined
            : moduleItem.roleCandidate;

      if (selectedMiddleModuleIds.length > 0) {
        if (selectedMainModuleIds.has(moduleItem.id)) {
          if (!moduleRoleAssignments.has(moduleItem.id) && roleCandidate === 'auxiliary_stage') {
            roleCandidate = undefined;
          }
        } else if (!roleCandidate || roleCandidate === 'core_stage') {
          roleCandidate = getModuleRoleSignals(extraction, moduleItem, 'control_stage').patternHit
            ? 'control_stage'
            : 'auxiliary_stage';
        }
      }

      return {
        ...moduleItem,
        entityIds: Array.from(new Set(entityIds)),
        roleCandidate,
      };
    })
    .filter((moduleItem) => moduleItem.entityIds.length >= 2);

  return nextModules.map((moduleItem, index) => ({
    ...moduleItem,
    id: `m${index + 1}`,
    order: moduleItem.order ?? index + 1,
  }));
}

function filterRelations(relations: FlowRelation[], allowedEntityIds: Set<string>) {
  return relations.filter((relation) => {
    return allowedEntityIds.has(relation.source) && allowedEntityIds.has(relation.target);
  });
}

function applyFeedbackEdgeAnswers(
  relations: FlowRelation[],
  answers: CRSAnswer[],
  questions: CRSQuestion[]
) {
  const feedbackRelationIds = new Set<string>();

  for (const question of questions) {
    if (question.type !== 'feedback_edge_selection') {
      continue;
    }
    const answer = answers.find((item) => item.questionId === question.id);
    getSelectedIds(answer, question.options, question.relatedRelationIds).forEach((relationId) => {
      feedbackRelationIds.add(relationId);
    });
  }

  return {
    feedbackRelationIds,
    relations: relations.map((relation): FlowRelation =>
      relation.type === 'sequential' && feedbackRelationIds.has(relation.id)
        ? {
            ...relation,
            roleCandidate: 'feedback',
          }
        : relation
    ),
  };
}

function applyRelationPruningAnswers(
  relations: FlowRelation[],
  answers: CRSAnswer[],
  questions: CRSQuestion[]
) {
  const prunedRelationIds = new Set<string>();

  for (const question of questions) {
    if (question.type !== 'relation_pruning') {
      continue;
    }
    const answer = answers.find((item) => item.questionId === question.id);
    getSelectedIds(answer, question.options, question.relatedRelationIds).forEach((relationId) => {
      prunedRelationIds.add(relationId);
    });
  }

  return {
    prunedRelationIds,
    relations: relations.filter((relation) => !prunedRelationIds.has(relation.id)),
  };
}

function resolveSpineCandidate(
  extraction: ExtractionResult,
  entities: Entity[],
  inferredSpineCandidate: string[] | undefined,
  answers: CRSAnswer[],
  questions: CRSQuestion[]
) {
  const allowedEntityIds = new Set(entities.map((entity) => entity.id));
  const spineQuestion = questions.find((question) => question.type === 'spine_selection');
  const answer = spineQuestion
    ? answers.find((item) => item.questionId === spineQuestion.id)
    : undefined;
  const selectedEntityIds = spineQuestion
    ? getSelectedIds(answer, spineQuestion.options, spineQuestion.relatedEntityIds)
    : [];

  if (selectedEntityIds.length >= 2) {
    return filterSpineCandidate(selectedEntityIds, allowedEntityIds);
  }

  if (inferredSpineCandidate?.length) {
    return filterSpineCandidate(inferredSpineCandidate, allowedEntityIds);
  }

  return filterSpineCandidate(extraction.spineCandidate, allowedEntityIds);
}

export function refineWithAnswers(
  extraction: ExtractionResult,
  answers: CRSAnswer[],
  questions: CRSQuestion[],
  _config?: LLMConfig
): AnalysisResult {
  const warnings = [...(extraction.warnings ?? [])];
  const lowConfidenceResult = applyLowConfidenceAnswers(extraction.entities, answers, questions);
  const mergeNodeResult = applyMergeNodeAnswers(
    lowConfidenceResult.entities,
    answers,
    questions
  );
  const entities = mergeNodeResult.entities;
  const allowedEntityIds = new Set(entities.map((entity) => entity.id));
  const filteredRelations = filterRelations(extraction.relations, allowedEntityIds);
  const feedbackResult = applyFeedbackEdgeAnswers(
    filteredRelations,
    answers,
    questions
  );
  const { relations: prunedRelations, prunedRelationIds } = applyRelationPruningAnswers(
    feedbackResult.relations,
    answers,
    questions
  );
  const mainModuleSelectionResult = applyMainModuleSelectionAnswers(
    extraction,
    entities,
    prunedRelations,
    answers,
    questions
  );
  const modules = updateModules(extraction, entities, answers, questions);
  const spineCandidate = resolveSpineCandidate(
    extraction,
    entities,
    mainModuleSelectionResult.inferredSpineCandidate,
    answers,
    questions
  );
  const relations = mainModuleSelectionResult.relations;
  const weights = buildDefaultWeights(entities, relations);

  for (const question of questions) {
    if (question.type !== 'importance_ranking') {
      continue;
    }
    const answer = answers.find((item) => item.questionId === question.id);
    const selectedLabel = answer?.selectedOptions[0];
    if (!selectedLabel) {
      continue;
    }
    const selectedEntity = getEntityByLabel(entities, selectedLabel);
    if (!selectedEntity) {
      continue;
    }
    weights[selectedEntity.id] = IMPORTANT_WEIGHT;
  }

  if (prunedRelationIds.size > 0) {
    warnings.push(`本地 QA 已移除 ${prunedRelationIds.size} 条说明性或辅助连线`);
  }

  if (spineCandidate?.length && spineCandidate.join('|') !== extraction.spineCandidate?.join('|')) {
    warnings.push('本地 QA 已确认主干候选');
  }

  if (mainModuleSelectionResult.selectedMiddleModuleIds.length > 0) {
    warnings.push(
      `本地 QA 已确认主干模块，并将 ${
    extraction.modules.length - mainModuleSelectionResult.selectedMainModuleIds.size
      } 个模块移出主干`
    );
  }

  if (mainModuleSelectionResult.selectedMainRelationIds.size > 0) {
    warnings.push(
      `本地 QA 已确认 ${mainModuleSelectionResult.selectedMainRelationIds.size} 条主干连线`
    );
  }

  if (mergeNodeResult.mergeEntityIds.size > 0) {
    warnings.push(`本地 QA 已确认 ${mergeNodeResult.mergeEntityIds.size} 个汇聚节点`);
  }

  if (feedbackResult.feedbackRelationIds.size > 0) {
    warnings.push(`本地 QA 已确认 ${feedbackResult.feedbackRelationIds.size} 条反馈边`);
  }

  const assignedRoleCount = questions.filter(
    (question) =>
      question.type === 'module_role_assignment' &&
      Boolean(answers.find((item) => item.questionId === question.id)?.selectedOptions[0])
  ).length;
  if (assignedRoleCount > 0) {
    warnings.push(`本地 QA 已确认 ${assignedRoleCount} 个模块角色`);
  }

  return {
    entities,
    relations,
    weights,
    modules,
    spineCandidate,
    warnings,
  };
}

export const mergeLocalAnswers = refineWithAnswers;

export function generateDefaultAnalysis(
  extraction: ExtractionResult,
  _config?: LLMConfig
): AnalysisResult {
  const allowedEntityIds = new Set(extraction.entities.map((entity) => entity.id));
  const warnings = [...(extraction.warnings ?? [])];
  if (isLikelyFlattenedLinearFlow(extraction)) {
    warnings.push('当前文本更像单一路径流程，建议先确认主干模块后再生成草图');
  }
  return {
    entities: extraction.entities,
    relations: extraction.relations,
    weights: buildDefaultWeights(extraction.entities, extraction.relations),
    modules: extraction.modules.map((moduleItem, index) => ({
      ...moduleItem,
      id: `m${index + 1}`,
      order: moduleItem.order ?? index + 1,
    })),
    spineCandidate: filterSpineCandidate(
      extraction.spineCandidate,
      allowedEntityIds
    ),
    warnings,
  };
}
