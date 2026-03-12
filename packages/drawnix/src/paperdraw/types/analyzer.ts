import type { PlaitElement, Point } from '@plait/core';

/**
 * PaperDraw 文本解析与草图生成核心类型
 */

export interface Entity {
  id: string;
  label: string;
  evidence?: string;
  confidence?: number;
}

export interface SequentialRelation {
  id: string;
  type: 'sequential';
  source: string;
  target: string;
  label?: string;
  evidence?: string;
  confidence?: number;
}

/**
 * 兼容旧输出使用。进入 validator 后会被统一归并为 modules。
 */
export interface ModularRelation {
  id: string;
  type: 'modular';
  moduleLabel: string;
  entityIds: string[];
  confidence?: number;
  evidence?: string;
}

export interface AnnotativeRelation {
  id: string;
  type: 'annotative';
  source: string;
  target: string;
  label?: string;
  evidence?: string;
  confidence?: number;
}

export interface ModuleGroup {
  id: string;
  label: string;
  entityIds: string[];
  order?: number;
  confidence?: number;
  evidence?: string;
}

export type PromptRelationType = 'sequential' | 'modular' | 'annotative';
export type FlowRelation = SequentialRelation | AnnotativeRelation;
export type RawRelation = FlowRelation | ModularRelation;

export interface ExtractionResult {
  entities: Entity[];
  relations: FlowRelation[];
  modules: ModuleGroup[];
  warnings?: string[];
}

export interface AnalysisResult {
  entities: Entity[];
  relations: FlowRelation[];
  weights: Record<string, number>;
  modules: ModuleGroup[];
  warnings?: string[];
}

export interface CRSQuestion {
  id: string;
  type: 'module_grouping' | 'low_confidence' | 'importance_ranking';
  question: string;
  options: string[];
  multiSelect: boolean;
  relatedEntityIds?: string[];
  moduleId?: string;
  moduleLabel?: string;
  entityId?: string;
}

export interface CRSAnswer {
  questionId: string;
  selectedOptions: string[];
}

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface PaperDrawEnvConfig extends LLMConfig {
  isConfigured: boolean;
}

export interface StreamProgress {
  rawText: string;
}

export type PaperDrawStreamPhase =
  | 'idle'
  | 'streaming'
  | 'parsing'
  | 'completed'
  | 'error';

export interface PaperDrawStreamState {
  phase: PaperDrawStreamPhase;
  rawText: string;
  finalJson: string;
  error?: string;
}

export interface PaperDrawPromptConfig {
  finalJsonStart: string;
  finalJsonEnd: string;
  relationTypes: Array<{
    type: PromptRelationType;
    description: string;
  }>;
  extractionSystemPrompt: string;
}

export type LayoutDirection = 'LR' | 'TB';

export interface LayoutNode {
  id: string;
  label: string;
  moduleId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  weight: number;
  confidence: number;
  row?: number;
  column?: number;
}

export interface LayoutEdge {
  id: string;
  type: 'sequential' | 'annotative';
  sourceId: string;
  targetId: string;
  shape: 'straight' | 'elbow';
  sourceConnection: [number, number];
  targetConnection: [number, number];
  points: [Point, Point];
  label?: string;
}

export interface LayoutGroup {
  id: string;
  moduleLabel: string;
  entityIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  order: number;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  groups: LayoutGroup[];
  direction: LayoutDirection;
}

export interface DraftFlowchartState {
  analysis: AnalysisResult;
  layout: LayoutResult;
  elements: PlaitElement[];
}

export type PaperDrawPhase =
  | 'input'
  | 'analyzing'
  | 'qa'
  | 'draft_flowchart'
  | 'optimizing'
  | 'editing'
  | 'styling';
