/**
 * PaperDraw Text Analyzer 核心类型定义
 */

// ========== 实体 ==========

/** 实体 — 统一为矩形节点 */
export interface Entity {
  id: string;
  /** 实体名称（显示在矩形中） */
  label: string;
  /** 原文溯源片段 */
  evidence?: string;
}

// ========== 关系 ==========

/** 顺序关系 — 有向箭头连接 */
export interface SequentialRelation {
  id: string;
  type: 'sequential';
  /** 源实体 id */
  source: string;
  /** 目标实体 id */
  target: string;
  /** 连接线上的文字 */
  label?: string;
}

/** 模块关系 — 边界框包含 */
export interface ModularRelation {
  id: string;
  type: 'modular';
  /** 模块名称 */
  moduleLabel: string;
  /** 包含的实体 id 列表 */
  entityIds: string[];
}

/** 注释关系 — 虚线连接 */
export interface AnnotativeRelation {
  id: string;
  type: 'annotative';
  source: string;
  target: string;
  label?: string;
}

export type Relation = SequentialRelation | ModularRelation | AnnotativeRelation;

// ========== 结果 ==========

/** LLM 初步提取结果 */
export interface ExtractionResult {
  entities: Entity[];
  relations: Relation[];
}

/** 经 CRS 确认后的完整分析结果 */
export interface AnalysisResult {
  entities: Entity[];
  relations: Relation[];
  /** 实体 id → 重要性权重 0-1 */
  weights: Record<string, number>;
  /** 确认后的模块分组 */
  modules: ModularRelation[];
}

// ========== CRS 对话 ==========

export interface CRSQuestion {
  id: string;
  type: 'module_grouping' | 'importance_ranking';
  question: string;
  /** 可选实体标签 */
  options: string[];
  /** 模块分组允许多选 */
  multiSelect: boolean;
}

export interface CRSAnswer {
  questionId: string;
  selectedOptions: string[];
}

// ========== LLM 配置 ==========

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

// ========== 状态机 ==========

export type PaperDrawPhase =
  | 'input'
  | 'analyzing'
  | 'qa'
  | 'draft_flowchart'
  | 'optimizing'
  | 'editing'
  | 'styling';
