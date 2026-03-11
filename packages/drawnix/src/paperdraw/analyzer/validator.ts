import {
  AnalysisResult,
  AnnotativeRelation,
  Entity,
  ExtractionResult,
  ModularRelation,
  Relation,
  SequentialRelation,
} from '../types/analyzer';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const DEFAULT_CONFIDENCE = 0.5;

function normalizeLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_CONFIDENCE;
  }
  return Math.max(0, Math.min(1, value));
}

function assertObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new ValidationError(`${name} must be an object`);
  }
}

function getEntityIdAliases(entities: unknown, warnings: string[]) {
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

  const canonicalIdByOldId = new Map<string, string>();
  for (const entity of normalizedEntities) {
    canonicalIdByOldId.set(entity.id, entity.id);
  }
  for (const [oldId, tempId] of aliases.entries()) {
    const labelKey = Array.from(uniqueByLabel.entries()).find(
      ([, value]) => value.id === tempId
    )?.[0];
    const target = normalizedEntities.find(
      (entity) => normalizeLabel(entity.label) === labelKey
    );
    if (target) {
      canonicalIdByOldId.set(oldId, target.id);
    }
  }

  return {
    aliases: canonicalIdByOldId,
    entities: normalizedEntities,
  };
}

function dedupeRelations(relations: Relation[]): Relation[] {
  const seen = new Set<string>();
  return relations.filter((relation) => {
    const key =
      relation.type === 'modular'
        ? `${relation.type}:${relation.moduleLabel}:${[...relation.entityIds].sort().join('|')}`
        : `${relation.type}:${relation.source}:${relation.target}:${relation.label ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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

export function normalizeExtractionResult(data: unknown): ExtractionResult {
  assertObject(data, 'ExtractionResult');
  const warnings: string[] = [];
  const { aliases, entities } = getEntityIdAliases(data.entities, warnings);
  const entityIds = new Set(entities.map((entity) => entity.id));

  if (!entities.length) {
    throw new ValidationError('ExtractionResult must contain at least one entity');
  }

  if (!Array.isArray(data.relations)) {
    throw new ValidationError('relations must be an array');
  }

  const normalizedRelations: Relation[] = [];
  let relationIndex = 1;

  for (const relation of data.relations) {
    assertObject(relation, 'relation');
    const relationId =
      typeof relation.id === 'string' && relation.id.trim()
        ? relation.id.trim()
        : `r${relationIndex++}`;

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
      if (dedupedEntityIds.length < 2) {
        warnings.push(`模块关系 ${relationId} 有效实体不足，已跳过`);
        continue;
      }
      normalizedRelations.push({
        id: `r${relationIndex++}`,
        type: 'modular',
        moduleLabel,
        entityIds: dedupedEntityIds,
        confidence: clampConfidence(relation.confidence),
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
    };

    if (relation.type === 'sequential') {
      normalizedRelations.push({
        ...common,
        type: 'sequential',
        source,
        target,
      });
      continue;
    }

    if (relation.type === 'annotative') {
      normalizedRelations.push({
        ...common,
        type: 'annotative',
        source,
        target,
      } as AnnotativeRelation);
      continue;
    }

    warnings.push(`关系 ${relationId} 的类型 ${String(relation.type)} 无效，已跳过`);
  }

  let dedupedRelations = dedupeRelations(normalizedRelations);

  if (!dedupedRelations.some((relation) => relation.type === 'sequential') && entities.length > 1) {
    warnings.push('未检测到顺序关系，已按实体顺序自动补全主链');
    dedupedRelations = dedupeRelations([
      ...dedupedRelations,
      ...buildSequentialFallback(entities),
    ]);
  }

  return {
    entities,
    relations: dedupedRelations,
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
  });

  const entityIds = new Set(extraction.entities.map((entity) => entity.id));
  const weights =
    typeof data.weights === 'object' && data.weights !== null
      ? { ...(data.weights as Record<string, unknown>) }
      : {};

  const normalizedWeights = extraction.entities.reduce<Record<string, number>>(
    (accumulator, entity) => {
      accumulator[entity.id] = clampConfidence(weights[entity.id]);
      return accumulator;
    },
    {}
  );

  const modulesInput = Array.isArray(data.modules) ? data.modules : [];
  const modules: ModularRelation[] = [];

  for (const moduleItem of modulesInput) {
    assertObject(moduleItem, 'module');
    const moduleLabel =
      typeof moduleItem.moduleLabel === 'string'
        ? moduleItem.moduleLabel.trim()
        : '';
    if (!moduleLabel || !Array.isArray(moduleItem.entityIds)) {
      continue;
    }
    const entityIdsInModule = Array.from(
      new Set(
        moduleItem.entityIds.filter(
          (entityId): entityId is string =>
            typeof entityId === 'string' && entityIds.has(entityId)
        )
      )
    );
    if (entityIdsInModule.length < 2) {
      continue;
    }
    modules.push({
      id: typeof moduleItem.id === 'string' ? moduleItem.id : `m${modules.length + 1}`,
      type: 'modular',
      moduleLabel,
      entityIds: entityIdsInModule,
      confidence: clampConfidence(moduleItem.confidence),
    });
  }

  return {
    entities: extraction.entities,
    relations: extraction.relations,
    weights: normalizedWeights,
    modules,
    warnings: extraction.warnings,
  };
}
