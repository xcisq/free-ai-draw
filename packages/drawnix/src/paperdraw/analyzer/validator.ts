import {
  AnalysisResult,
  AnnotativeRelation,
  EdgeRole,
  Entity,
  ExtractionResult,
  FlowRelation,
  ModularRelation,
  ModuleGroup,
  ModuleRole,
  NodeRole,
  SequentialRelation,
} from '../types/analyzer';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const DEFAULT_CONFIDENCE = 0.5;
const COMPLEX_FLOW_ENTITY_THRESHOLD = 5;
const MIN_COMPLEX_FLOW_MODULES = 2;
const MAX_MODULES = 5;
const PREFERRED_MODULE_SIZE = 3;
const MODULE_SIZE_MIN = 2;
const MODULE_SIZE_MAX = 6;
const MODULE_LABEL_STOPWORDS = new Set([
  '模块',
  '阶段',
  '流程',
  '方法',
  '系统',
  '模型',
  '数据',
  '输入',
  '输出',
  '步骤',
  '论文',
]);
const VALID_NODE_ROLES = new Set<NodeRole>([
  'input',
  'process',
  'state',
  'parameter',
  'decoder',
  'aggregator',
  'simulator',
  'output',
  'annotation',
  'media',
]);
const VALID_EDGE_ROLES = new Set<EdgeRole>([
  'main',
  'auxiliary',
  'control',
  'feedback',
  'annotation',
]);
const VALID_MODULE_ROLES = new Set<ModuleRole>([
  'input_stage',
  'core_stage',
  'auxiliary_stage',
  'control_stage',
  'output_stage',
]);

interface NormalizedEntities {
  aliases: Map<string, string>;
  entities: Entity[];
}

function normalizeLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_CONFIDENCE;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeNodeRoleCandidate(value: unknown): NodeRole | undefined {
  return typeof value === 'string' && VALID_NODE_ROLES.has(value as NodeRole)
    ? (value as NodeRole)
    : undefined;
}

function normalizeEdgeRoleCandidate(value: unknown): EdgeRole | undefined {
  return typeof value === 'string' && VALID_EDGE_ROLES.has(value as EdgeRole)
    ? (value as EdgeRole)
    : undefined;
}

function normalizeModuleRoleCandidate(value: unknown): ModuleRole | undefined {
  return typeof value === 'string' && VALID_MODULE_ROLES.has(value as ModuleRole)
    ? (value as ModuleRole)
    : undefined;
}

function assertObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new ValidationError(`${name} must be an object`);
  }
}

function tokenizeText(text: string) {
  return (text.match(/[A-Za-z0-9]+|[\u4e00-\u9fa5]{2,}/g) ?? [])
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function dedupeFlowRelations(relations: FlowRelation[]): FlowRelation[] {
  const seen = new Set<string>();
  return relations.filter((relation) => {
    const key = `${relation.type}:${relation.source}:${relation.target}:${relation.label ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getEntityIdAliases(entities: unknown, warnings: string[]): NormalizedEntities {
  if (!Array.isArray(entities)) {
    throw new ValidationError('entities must be an array');
  }

  const aliases = new Map<string, string>();
  const uniqueByLabel = new Map<string, Entity>();
  let fallbackIndex = 1;

  for (const entity of entities) {
    assertObject(entity, 'entity');
    const label = typeof entity.label === 'string' ? entity.label.trim() : '';
    if (!label) {
      warnings.push('跳过了缺少 label 的实体');
      continue;
    }

    const incomingId =
      typeof entity.id === 'string' && entity.id.trim()
        ? entity.id.trim()
        : `e${fallbackIndex++}`;
    const key = normalizeLabel(label);
    const normalized: Entity = {
      id: incomingId,
      label,
      evidence:
        typeof entity.evidence === 'string' && entity.evidence.trim()
          ? entity.evidence.trim()
          : undefined,
      confidence: clampConfidence(entity.confidence),
      roleCandidate: normalizeNodeRoleCandidate(entity.roleCandidate),
    };

    const existed = uniqueByLabel.get(key);
    if (!existed) {
      uniqueByLabel.set(key, normalized);
      aliases.set(incomingId, normalized.id);
      continue;
    }

    aliases.set(incomingId, existed.id);
    warnings.push(`实体 "${label}" 重复，已自动合并`);
    if ((normalized.confidence ?? DEFAULT_CONFIDENCE) > (existed.confidence ?? DEFAULT_CONFIDENCE)) {
      existed.evidence = normalized.evidence ?? existed.evidence;
      existed.confidence = normalized.confidence;
    }
  }

  const normalizedEntities = Array.from(uniqueByLabel.values()).map((entity, index) => ({
    ...entity,
    id: `e${index + 1}`,
  }));

  const normalizedAliasMap = new Map<string, string>();
  for (const entity of normalizedEntities) {
    normalizedAliasMap.set(entity.id, entity.id);
  }
  for (const [oldId, tempId] of aliases.entries()) {
    const labelKey = Array.from(uniqueByLabel.entries()).find(
      ([, value]) => value.id === tempId
    )?.[0];
    const target = normalizedEntities.find(
      (entity) => normalizeLabel(entity.label) === labelKey
    );
    if (target) {
      normalizedAliasMap.set(oldId, target.id);
    }
  }

  return {
    aliases: normalizedAliasMap,
    entities: normalizedEntities,
  };
}

function buildSequentialFallback(entities: Entity[]): SequentialRelation[] {
  const fallback: SequentialRelation[] = [];
  for (let index = 0; index < entities.length - 1; index += 1) {
    fallback.push({
      id: `r-fallback-${index + 1}`,
      type: 'sequential',
      source: entities[index].id,
      target: entities[index + 1].id,
      confidence: DEFAULT_CONFIDENCE,
    });
  }
  return fallback;
}

function topologicalSort(entities: Entity[], relations: FlowRelation[]) {
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const entity of entities) {
    indegree.set(entity.id, 0);
    outgoing.set(entity.id, []);
  }

  for (const relation of relations) {
    if (relation.type !== 'sequential') {
      continue;
    }
    indegree.set(relation.target, (indegree.get(relation.target) || 0) + 1);
    outgoing.get(relation.source)?.push(relation.target);
  }

  const queue = entities
    .filter((entity) => (indegree.get(entity.id) || 0) === 0)
    .map((entity) => entity.id);
  const orderedIds: string[] = [];

  while (queue.length) {
    const currentId = queue.shift()!;
    orderedIds.push(currentId);
    for (const target of outgoing.get(currentId) ?? []) {
      const nextIndegree = (indegree.get(target) || 0) - 1;
      indegree.set(target, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(target);
      }
    }
  }

  const fallbackIds = entities
    .map((entity) => entity.id)
    .filter((entityId) => !orderedIds.includes(entityId));

  return [...orderedIds, ...fallbackIds]
    .map((entityId) => entities.find((entity) => entity.id === entityId))
    .filter((entity): entity is Entity => Boolean(entity));
}

function normalizeRawFlowRelations(
  relations: unknown,
  aliases: Map<string, string>,
  entityIds: Set<string>,
  warnings: string[]
) {
  if (!Array.isArray(relations)) {
    throw new ValidationError('relations must be an array');
  }

  const flowRelations: FlowRelation[] = [];
      const legacyModules: ModularRelation[] = [];
  let relationIndex = 1;

  for (const relation of relations) {
    assertObject(relation, 'relation');
    const relationId =
      typeof relation.id === 'string' && relation.id.trim()
        ? relation.id.trim()
        : `r${relationIndex}`;

    if (relation.type === 'modular') {
      const moduleLabel =
        typeof relation.moduleLabel === 'string' ? relation.moduleLabel.trim() : '';
      if (!moduleLabel || !Array.isArray(relation.entityIds)) {
        warnings.push(`模块关系 ${relationId} 无效，已跳过`);
        continue;
      }

      const entityIdsInModule = relation.entityIds
        .map((entityId) => (typeof entityId === 'string' ? aliases.get(entityId) : undefined))
        .filter((entityId): entityId is string => Boolean(entityId && entityIds.has(entityId)));
      const dedupedEntityIds = Array.from(new Set(entityIdsInModule));
      if (dedupedEntityIds.length < MODULE_SIZE_MIN) {
        warnings.push(`模块关系 ${relationId} 有效实体不足，已跳过`);
        continue;
      }

      legacyModules.push({
        id: `legacy-${legacyModules.length + 1}`,
        type: 'modular',
        moduleLabel,
        entityIds: dedupedEntityIds,
        confidence: clampConfidence(relation.confidence),
        evidence:
          typeof relation.evidence === 'string' ? relation.evidence.trim() || undefined : undefined,
      });
      continue;
    }

    const source = typeof relation.source === 'string' ? aliases.get(relation.source) : undefined;
    const target = typeof relation.target === 'string' ? aliases.get(relation.target) : undefined;
    if (!source || !target || !entityIds.has(source) || !entityIds.has(target)) {
      warnings.push(`关系 ${relationId} 引用了不存在的实体，已跳过`);
      continue;
    }
    if (source === target) {
      warnings.push(`关系 ${relationId} 形成自环，已跳过`);
      continue;
    }

    const common = {
      id: `r${relationIndex++}`,
      label: typeof relation.label === 'string' ? relation.label.trim() || undefined : undefined,
      evidence:
        typeof relation.evidence === 'string' ? relation.evidence.trim() || undefined : undefined,
      confidence: clampConfidence(relation.confidence),
      roleCandidate: normalizeEdgeRoleCandidate(relation.roleCandidate),
    };

    if (relation.type === 'sequential') {
      flowRelations.push({
        ...common,
        type: 'sequential',
        source,
        target,
      });
      continue;
    }

    if (relation.type === 'annotative') {
      flowRelations.push({
        ...common,
        type: 'annotative',
        source,
        target,
      } as AnnotativeRelation);
      continue;
    }

    warnings.push(`关系 ${relationId} 的类型 ${String(relation.type)} 无效，已跳过`);
  }

  return {
    relations: flowRelations,
    legacyModules,
  };
}

function normalizeModulesInput(
  modulesInput: unknown,
  aliases: Map<string, string>,
  entityIds: Set<string>,
  warnings: string[]
) {
  if (!Array.isArray(modulesInput)) {
    return [];
  }

  const modules: ModuleGroup[] = [];

  for (const moduleItem of modulesInput) {
    assertObject(moduleItem, 'module');
    const label =
      typeof moduleItem.label === 'string'
        ? moduleItem.label.trim()
        : typeof moduleItem.moduleLabel === 'string'
          ? moduleItem.moduleLabel.trim()
          : '';
    if (!label || !Array.isArray(moduleItem.entityIds)) {
      warnings.push('跳过了无效的模块定义');
      continue;
    }

    const normalizedEntityIds = Array.from(
      new Set(
        moduleItem.entityIds
          .map((entityId) => (typeof entityId === 'string' ? aliases.get(entityId) : undefined))
          .filter((entityId): entityId is string => Boolean(entityId && entityIds.has(entityId)))
      )
    );

    if (normalizedEntityIds.length < MODULE_SIZE_MIN) {
      warnings.push(`模块 "${label}" 有效实体不足，已降级为普通节点`);
      continue;
    }

    modules.push({
      id:
        typeof moduleItem.id === 'string' && moduleItem.id.trim()
          ? moduleItem.id.trim()
          : `m${modules.length + 1}`,
      label,
      entityIds: normalizedEntityIds,
      order:
        typeof moduleItem.order === 'number' && Number.isFinite(moduleItem.order)
          ? moduleItem.order
          : undefined,
      confidence: clampConfidence(moduleItem.confidence),
      evidence:
        typeof moduleItem.evidence === 'string' ? moduleItem.evidence.trim() || undefined : undefined,
      roleCandidate: normalizeModuleRoleCandidate(moduleItem.roleCandidate),
    });
  }

  return modules;
}

function mergeModules(explicitModules: ModuleGroup[], legacyModules: ModularRelation[]) {
  const merged = new Map<string, ModuleGroup>();

  for (const moduleItem of explicitModules) {
    merged.set(normalizeLabel(moduleItem.label), {
      ...moduleItem,
      entityIds: [...moduleItem.entityIds],
    });
  }

  for (const legacyModule of legacyModules) {
    const key = normalizeLabel(legacyModule.moduleLabel);
    const existed = merged.get(key);
    if (!existed) {
      merged.set(key, {
        id: `m${merged.size + 1}`,
        label: legacyModule.moduleLabel,
        entityIds: [...legacyModule.entityIds],
        confidence: legacyModule.confidence,
        evidence: legacyModule.evidence,
        roleCandidate: undefined,
      });
      continue;
    }

    existed.entityIds = Array.from(new Set([...existed.entityIds, ...legacyModule.entityIds]));
    existed.confidence = Math.max(
      existed.confidence ?? DEFAULT_CONFIDENCE,
      legacyModule.confidence ?? DEFAULT_CONFIDENCE
    );
    existed.evidence = existed.evidence ?? legacyModule.evidence;
  }

  return Array.from(merged.values());
}

function normalizeModuleOverlap(modules: ModuleGroup[], warnings: string[]) {
  const sorted = [...modules]
    .map((moduleItem, index) => ({ moduleItem, index }))
    .sort((left, right) => {
      const confidenceDiff =
        (right.moduleItem.confidence ?? DEFAULT_CONFIDENCE) -
        (left.moduleItem.confidence ?? DEFAULT_CONFIDENCE);
      if (confidenceDiff !== 0) {
        return confidenceDiff;
      }
      const leftOrder = left.moduleItem.order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.moduleItem.order ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.index - right.index;
    });

  const claimedEntities = new Map<string, string>();
  const normalized: ModuleGroup[] = [];

  for (const { moduleItem } of sorted) {
    const nextEntityIds = moduleItem.entityIds.filter((entityId) => {
      const owner = claimedEntities.get(entityId);
      if (!owner) {
        claimedEntities.set(entityId, moduleItem.id);
        return true;
      }
      warnings.push(`实体 ${entityId} 同时属于多个模块，已保留更高优先级模块`);
      return false;
    });

    if (nextEntityIds.length < MODULE_SIZE_MIN) {
      warnings.push(`模块 "${moduleItem.label}" 过滤重复成员后实体不足，已移除`);
      continue;
    }

    normalized.push({
      ...moduleItem,
      entityIds: nextEntityIds,
    });
  }

  return normalized;
}

function deriveModuleLabel(entities: Entity[], index: number) {
  const tokenCounts = new Map<string, number>();

  for (const entity of entities) {
    const source = `${entity.label} ${entity.evidence ?? ''}`;
    for (const token of tokenizeText(source)) {
      if (MODULE_LABEL_STOPWORDS.has(token)) {
        continue;
      }
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    }
  }

  const sortedTokens = Array.from(tokenCounts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return right[0].length - left[0].length;
  });

  if (sortedTokens.length && sortedTokens[0][1] > 1) {
    return sortedTokens[0][0];
  }

  return `阶段 ${index + 1}`;
}

function buildChunkSizes(total: number, desiredCount: number) {
  const sizes = Array.from({ length: desiredCount }, () => Math.floor(total / desiredCount));
  let remainder = total % desiredCount;

  for (let index = 0; index < sizes.length; index += 1) {
    if (remainder > 0) {
      sizes[index] += 1;
      remainder -= 1;
    }
  }

  for (let index = sizes.length - 1; index > 0; index -= 1) {
    if (sizes[index] >= MODULE_SIZE_MIN) {
      continue;
    }
    const shortage = MODULE_SIZE_MIN - sizes[index];
    sizes[index] += shortage;
    sizes[index - 1] -= shortage;
  }

  return sizes.filter((size) => size >= MODULE_SIZE_MIN && size <= MODULE_SIZE_MAX);
}

function rebuildModules(
  entities: Entity[],
  relations: FlowRelation[],
  warnings: string[]
) {
  if (entities.length < COMPLEX_FLOW_ENTITY_THRESHOLD) {
    return [];
  }

  const orderedEntities = topologicalSort(entities, relations);
  const desiredCount = Math.max(
    MIN_COMPLEX_FLOW_MODULES,
    Math.min(MAX_MODULES, Math.round(orderedEntities.length / PREFERRED_MODULE_SIZE))
  );
  const chunkSizes = buildChunkSizes(orderedEntities.length, desiredCount);
  const rebuiltModules: ModuleGroup[] = [];
  let cursor = 0;

  for (let index = 0; index < chunkSizes.length; index += 1) {
    const members = orderedEntities.slice(cursor, cursor + chunkSizes[index]);
    cursor += chunkSizes[index];
    if (members.length < MODULE_SIZE_MIN) {
      continue;
    }
    rebuiltModules.push({
      id: `m${rebuiltModules.length + 1}`,
      label: deriveModuleLabel(members, rebuiltModules.length),
      entityIds: members.map((entity) => entity.id),
      order: rebuiltModules.length + 1,
      confidence: DEFAULT_CONFIDENCE,
      evidence: members.map((entity) => entity.label).join(' -> '),
      roleCandidate: undefined,
    });
  }

  if (rebuiltModules.length >= MIN_COMPLEX_FLOW_MODULES) {
    warnings.push('模块候选不足，已按主链自动重建模块结构');
  }

  return rebuiltModules;
}

function finalizeModules(
  entities: Entity[],
  relations: FlowRelation[],
  modules: ModuleGroup[],
  warnings: string[]
) {
  let normalizedModules = normalizeModuleOverlap(modules, warnings)
    .filter((moduleItem) => moduleItem.entityIds.length >= MODULE_SIZE_MIN);

  if (
    entities.length >= COMPLEX_FLOW_ENTITY_THRESHOLD &&
    normalizedModules.length < MIN_COMPLEX_FLOW_MODULES
  ) {
    normalizedModules = rebuildModules(entities, relations, warnings);
  }

  return normalizedModules.map((moduleItem, index) => ({
    ...moduleItem,
    id: `m${index + 1}`,
    order: moduleItem.order ?? index + 1,
  }));
}

function normalizeSpineCandidate(
  spineCandidate: unknown,
  entityIds: Set<string>
) {
  if (!Array.isArray(spineCandidate)) {
    return undefined;
  }

  const normalized = spineCandidate
    .map((entityId) => (typeof entityId === 'string' ? entityId.trim() : ''))
    .filter((entityId): entityId is string => Boolean(entityId && entityIds.has(entityId)));
  const deduped = Array.from(new Set(normalized));
  return deduped.length >= 2 ? deduped : undefined;
}

function normalizeWeights(entities: Entity[], weightsInput: Record<string, unknown>) {
  return entities.reduce<Record<string, number>>((accumulator, entity) => {
    accumulator[entity.id] = clampConfidence(weightsInput[entity.id]);
    return accumulator;
  }, {});
}

export function normalizeExtractionResult(data: unknown): ExtractionResult {
  assertObject(data, 'ExtractionResult');
  const warnings: string[] = [];
  const { aliases, entities } = getEntityIdAliases(data.entities, warnings);
  const entityIds = new Set(entities.map((entity) => entity.id));

  if (!entities.length) {
    throw new ValidationError('ExtractionResult must contain at least one entity');
  }

  const { relations: parsedRelations, legacyModules } = normalizeRawFlowRelations(
    data.relations,
    aliases,
    entityIds,
    warnings
  );

  let relations = dedupeFlowRelations(parsedRelations);
  if (!relations.some((relation) => relation.type === 'sequential') && entities.length > 1) {
    warnings.push('未检测到顺序关系，已按实体顺序自动补全主链');
    relations = dedupeFlowRelations([
      ...relations,
      ...buildSequentialFallback(entities),
    ]);
  }

  const explicitModules = normalizeModulesInput(data.modules, aliases, entityIds, warnings);
  const modules = finalizeModules(
    entities,
    relations,
    mergeModules(explicitModules, legacyModules),
    warnings
  );
  const spineCandidate = normalizeSpineCandidate(data.spineCandidate, entityIds);

  return {
    entities,
    relations,
    modules,
    spineCandidate,
    warnings,
  };
}

export function validateExtractionResult(data: unknown): ExtractionResult {
  return normalizeExtractionResult(data);
}

export function validateAnalysisResult(data: unknown): AnalysisResult {
  assertObject(data, 'AnalysisResult');

  const extraction = normalizeExtractionResult({
    entities: data.entities,
    relations: data.relations,
    modules: data.modules,
  });

  const weightsInput =
    typeof data.weights === 'object' && data.weights !== null
      ? { ...(data.weights as Record<string, unknown>) }
      : {};

  return {
    entities: extraction.entities,
    relations: extraction.relations,
    weights: normalizeWeights(extraction.entities, weightsInput),
    modules: extraction.modules,
    spineCandidate: normalizeSpineCandidate(
      data.spineCandidate ?? extraction.spineCandidate,
      new Set(extraction.entities.map((entity) => entity.id))
    ),
    warnings: extraction.warnings,
  };
}
