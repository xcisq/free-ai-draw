/**
 * LLM 输出校验器
 * 确保 LLM 返回的 JSON 结构合法、引用关系正确
 */

import {
  Entity,
  Relation,
  ExtractionResult,
  AnalysisResult,
  ModularRelation,
} from '../types/analyzer';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * 校验实体列表
 */
function validateEntities(entities: unknown): asserts entities is Entity[] {
  if (!Array.isArray(entities)) {
    throw new ValidationError('entities must be an array');
  }
  const ids = new Set<string>();
  for (const entity of entities) {
    if (typeof entity !== 'object' || entity === null) {
      throw new ValidationError('Each entity must be an object');
    }
    const e = entity as Record<string, unknown>;
    if (typeof e.id !== 'string' || !e.id) {
      throw new ValidationError('Entity must have a non-empty string id');
    }
    if (typeof e.label !== 'string' || !e.label) {
      throw new ValidationError(`Entity ${e.id} must have a non-empty string label`);
    }
    if (ids.has(e.id)) {
      throw new ValidationError(`Duplicate entity id: ${e.id}`);
    }
    ids.add(e.id);
  }
}

/**
 * 校验关系列表
 */
function validateRelations(
  relations: unknown,
  entityIds: Set<string>
): asserts relations is Relation[] {
  if (!Array.isArray(relations)) {
    throw new ValidationError('relations must be an array');
  }
  for (const rel of relations) {
    if (typeof rel !== 'object' || rel === null) {
      throw new ValidationError('Each relation must be an object');
    }
    const r = rel as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id) {
      throw new ValidationError('Relation must have a non-empty string id');
    }

    switch (r.type) {
      case 'sequential':
      case 'annotative':
        if (typeof r.source !== 'string' || !entityIds.has(r.source)) {
          throw new ValidationError(
            `Relation ${r.id}: source "${r.source}" not found in entities`
          );
        }
        if (typeof r.target !== 'string' || !entityIds.has(r.target)) {
          throw new ValidationError(
            `Relation ${r.id}: target "${r.target}" not found in entities`
          );
        }
        break;
      case 'modular':
        if (typeof r.moduleLabel !== 'string' || !r.moduleLabel) {
          throw new ValidationError(
            `Relation ${r.id}: modular relation must have moduleLabel`
          );
        }
        if (!Array.isArray(r.entityIds)) {
          throw new ValidationError(
            `Relation ${r.id}: modular relation must have entityIds array`
          );
        }
        for (const eid of r.entityIds as string[]) {
          if (!entityIds.has(eid)) {
            throw new ValidationError(
              `Relation ${r.id}: entityId "${eid}" not found in entities`
            );
          }
        }
        break;
      default:
        throw new ValidationError(
          `Relation ${r.id}: unknown type "${r.type}"`
        );
    }
  }
}

/**
 * 校验 LLM 返回的 ExtractionResult
 * 对无效数据抛出 ValidationError
 */
export function validateExtractionResult(data: unknown): ExtractionResult {
  if (typeof data !== 'object' || data === null) {
    throw new ValidationError('ExtractionResult must be an object');
  }
  const d = data as Record<string, unknown>;

  validateEntities(d.entities);
  const entityIds = new Set((d.entities as Entity[]).map((e) => e.id));
  validateRelations(d.relations, entityIds);

  return d as unknown as ExtractionResult;
}

/**
 * 校验 AnalysisResult
 */
export function validateAnalysisResult(data: unknown): AnalysisResult {
  if (typeof data !== 'object' || data === null) {
    throw new ValidationError('AnalysisResult must be an object');
  }
  const d = data as Record<string, unknown>;

  validateEntities(d.entities);
  const entityIds = new Set((d.entities as Entity[]).map((e) => e.id));
  validateRelations(d.relations, entityIds);

  // 校验 weights
  if (typeof d.weights !== 'object' || d.weights === null) {
    throw new ValidationError('weights must be an object');
  }
  const weights = d.weights as Record<string, unknown>;
  for (const [key, val] of Object.entries(weights)) {
    if (!entityIds.has(key)) {
      // 非致命：只警告，不阻断
      console.warn(`Weight key "${key}" not found in entities, will be ignored`);
    }
    if (typeof val !== 'number' || val < 0 || val > 1) {
      throw new ValidationError(
        `Weight for "${key}" must be a number between 0 and 1, got ${val}`
      );
    }
  }

  // 补充缺失的 weights 为默认 0.5
  for (const eid of entityIds) {
    if (!(eid in weights)) {
      (weights as Record<string, number>)[eid] = 0.5;
    }
  }

  // 校验 modules
  if (!Array.isArray(d.modules)) {
    throw new ValidationError('modules must be an array');
  }
  for (const mod of d.modules as ModularRelation[]) {
    if (typeof mod.moduleLabel !== 'string' || !mod.moduleLabel) {
      throw new ValidationError('Module must have moduleLabel');
    }
    if (!Array.isArray(mod.entityIds)) {
      throw new ValidationError('Module must have entityIds array');
    }
  }

  return d as unknown as AnalysisResult;
}
