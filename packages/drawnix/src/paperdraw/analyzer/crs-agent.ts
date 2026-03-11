/**
 * 本地 QA 与分析结果合并
 * 默认不再调用第二次 LLM，直接基于 ExtractionResult 生成问题和最终分析
 */

import {
  AnalysisResult,
  CRSAnswer,
  CRSQuestion,
  Entity,
  ExtractionResult,
  LLMConfig,
  ModularRelation,
  Relation,
} from '../types/analyzer';

const DEFAULT_WEIGHT = 0.5;
const IMPORTANT_WEIGHT = 0.9;
const ROOT_WEIGHT = 0.65;

const getEntityByLabel = (entities: Entity[], label: string) => {
  return entities.find((entity) => entity.label === label);
};

const getSequentialStats = (relations: Relation[]) => {
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

const getModuleQuestions = (extraction: ExtractionResult): CRSQuestion[] => {
  return extraction.relations
    .filter((relation): relation is ModularRelation => relation.type === 'modular')
    .slice(0, 2)
    .map((relation, index) => ({
      id: `q-module-${index + 1}`,
      type: 'module_grouping' as const,
      question: `以下实体是否属于模块「${relation.moduleLabel}」？`,
      options: relation.entityIds
        .map((entityId) => extraction.entities.find((entity) => entity.id === entityId)?.label)
        .filter((label): label is string => Boolean(label)),
      multiSelect: true,
      relatedEntityIds: relation.entityIds,
      moduleLabel: relation.moduleLabel,
    }))
    .filter((question) => question.options.length > 1);
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

export function generateQuestions(extraction: ExtractionResult, _config?: LLMConfig): CRSQuestion[] {
  return [...getModuleQuestions(extraction), ...getImportanceQuestion(extraction)];
}

const buildDefaultWeights = (entities: Entity[], relations: Relation[]) => {
  const { indegree, outdegree } = getSequentialStats(relations);
  return entities.reduce<Record<string, number>>((accumulator, entity) => {
    const isRoot = (indegree.get(entity.id) || 0) === 0;
    accumulator[entity.id] = isRoot || (outdegree.get(entity.id) || 0) > 0
      ? ROOT_WEIGHT
      : DEFAULT_WEIGHT;
    return accumulator;
  }, {});
};

const buildModules = (
  extraction: ExtractionResult,
  answers: CRSAnswer[],
  questions: CRSQuestion[]
): ModularRelation[] => {
  const defaultModules = extraction.relations
    .filter((relation): relation is ModularRelation => relation.type === 'modular')
    .map((relation, index) => ({
      id: `m${index + 1}`,
      type: 'modular' as const,
      moduleLabel: relation.moduleLabel,
      entityIds: [...relation.entityIds],
      confidence: relation.confidence,
    }));

  const nextModules = defaultModules.map((module) => ({ ...module }));

  for (const question of questions) {
    if (question.type !== 'module_grouping' || !question.moduleLabel) {
      continue;
    }
    const answer = answers.find((item) => item.questionId === question.id);
    if (!answer) {
      continue;
    }
    const entityIds = answer.selectedOptions
      .map((label) => getEntityByLabel(extraction.entities, label)?.id)
      .filter((entityId): entityId is string => Boolean(entityId));

    const existing = nextModules.find((module) => module.moduleLabel === question.moduleLabel);
    if (!existing) {
      if (entityIds.length > 1) {
        nextModules.push({
          id: `m${nextModules.length + 1}`,
          type: 'modular',
          moduleLabel: question.moduleLabel,
          entityIds,
          confidence: DEFAULT_WEIGHT,
        });
      }
      continue;
    }

    if (entityIds.length > 1) {
      existing.entityIds = Array.from(new Set(entityIds));
    } else {
      existing.entityIds = [];
    }
  }

  return nextModules.filter((module) => module.entityIds.length > 1);
};

const mergeModularRelations = (relations: Relation[], modules: ModularRelation[]): Relation[] => {
  const nonModularRelations = relations.filter((relation) => relation.type !== 'modular');
  return [...nonModularRelations, ...modules.map((module, index) => ({ ...module, id: `r-mod-${index + 1}` }))];
};

export function refineWithAnswers(
  extraction: ExtractionResult,
  answers: CRSAnswer[],
  questions: CRSQuestion[],
  _config?: LLMConfig
): AnalysisResult {
  const weights = buildDefaultWeights(extraction.entities, extraction.relations);
  const modules = buildModules(extraction, answers, questions);

  for (const question of questions) {
    if (question.type !== 'importance_ranking') {
      continue;
    }
    const answer = answers.find((item) => item.questionId === question.id);
    const selectedLabel = answer?.selectedOptions[0];
    if (!selectedLabel) {
      continue;
    }
    const selectedEntity = getEntityByLabel(extraction.entities, selectedLabel);
    if (!selectedEntity) {
      continue;
    }
    weights[selectedEntity.id] = IMPORTANT_WEIGHT;
  }

  return {
    entities: extraction.entities,
    relations: mergeModularRelations(extraction.relations, modules),
    weights,
    modules,
    warnings: extraction.warnings,
  };
}

export const mergeLocalAnswers = refineWithAnswers;

export function generateDefaultAnalysis(
  extraction: ExtractionResult,
  _config?: LLMConfig
): AnalysisResult {
  const modules = extraction.relations.filter(
    (relation): relation is ModularRelation => relation.type === 'modular'
  );

  return {
    entities: extraction.entities,
    relations: extraction.relations,
    weights: buildDefaultWeights(extraction.entities, extraction.relations),
    modules: modules.map((module, index) => ({
      ...module,
      id: `m${index + 1}`,
    })),
    warnings: extraction.warnings,
  };
}
