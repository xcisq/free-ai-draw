import { PlaitElement, Point } from '@plait/core';

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

export interface ModularRelation {
  id: string;
  type: 'modular';
  moduleLabel: string;
  entityIds: string[];
  confidence?: number;
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

export type Relation =
  | SequentialRelation
  | ModularRelation
  | AnnotativeRelation;

export interface ExtractionResult {
  entities: Entity[];
  relations: Relation[];
  warnings?: string[];
}

export interface AnalysisResult {
  entities: Entity[];
  relations: Relation[];
  weights: Record<string, number>;
  modules: ModularRelation[];
  warnings?: string[];
}

export interface CRSQuestion {
  id: string;
  type: 'module_grouping' | 'importance_ranking';
  question: string;
  options: string[];
  multiSelect: boolean;
  relatedEntityIds?: string[];
  moduleLabel?: string;
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
    type: Relation['type'];
    description: string;
  }>;
  extractionSystemPrompt: string;
}

export type LayoutDirection = 'LR' | 'TB';

export interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  weight: number;
  confidence: number;
}

export interface LayoutEdge {
  id: string;
  type: 'sequential' | 'annotative';
  sourceId: string;
  targetId: string;
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
