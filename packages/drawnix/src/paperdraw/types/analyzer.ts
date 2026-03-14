import type { PlaitElement, Point } from '@plait/core';

/**
 * PaperDraw 文本解析与草图生成核心类型
 */

export interface Entity {
  id: string;
  label: string;
  evidence?: string;
  confidence?: number;
  roleCandidate?: NodeRole;
}

export interface SequentialRelation {
  id: string;
  type: 'sequential';
  source: string;
  target: string;
  label?: string;
  evidence?: string;
  confidence?: number;
  roleCandidate?: Exclude<EdgeRole, 'annotation'>;
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
  roleCandidate?: EdgeRole;
}

export interface ModuleGroup {
  id: string;
  label: string;
  entityIds: string[];
  order?: number;
  confidence?: number;
  evidence?: string;
  roleCandidate?: ModuleRole;
}

export type PromptRelationType = 'sequential' | 'modular' | 'annotative';
export type FlowRelation = SequentialRelation | AnnotativeRelation;
export type RawRelation = FlowRelation | ModularRelation;

export interface ExtractionResult {
  entities: Entity[];
  relations: FlowRelation[];
  modules: ModuleGroup[];
  spineCandidate?: string[];
  warnings?: string[];
}

export interface AnalysisResult {
  entities: Entity[];
  relations: FlowRelation[];
  weights: Record<string, number>;
  modules: ModuleGroup[];
  spineCandidate?: string[];
  warnings?: string[];
}

export interface CRSQuestion {
  id: string;
  type:
    | 'module_grouping'
    | 'low_confidence'
    | 'importance_ranking'
    | 'spine_selection'
    | 'relation_pruning'
    | 'module_role_assignment';
  question: string;
  options: string[];
  multiSelect: boolean;
  relatedEntityIds?: string[];
  relatedRelationIds?: string[];
  relatedModuleIds?: string[];
  moduleId?: string;
  moduleLabel?: string;
  entityId?: string;
  targetRoleCandidate?: ModuleRole;
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
export type LayoutEngine = 'pipeline_v1' | 'legacy_v2';

export type NodeRole =
  | 'input'
  | 'process'
  | 'state'
  | 'parameter'
  | 'decoder'
  | 'aggregator'
  | 'simulator'
  | 'output'
  | 'annotation'
  | 'media';

export type EdgeRole =
  | 'main'
  | 'auxiliary'
  | 'control'
  | 'feedback'
  | 'annotation';

export type ModuleRole =
  | 'input_stage'
  | 'core_stage'
  | 'auxiliary_stage'
  | 'control_stage'
  | 'output_stage';

export type RailPreference =
  | 'left_input_rail'
  | 'main_rail'
  | 'top_control_rail'
  | 'bottom_aux_rail'
  | 'right_output_rail'
  | 'outer_feedback_rail';

export type VisualPrimitive =
  | 'container'
  | 'block'
  | 'small-block'
  | 'state-card'
  | 'media-card'
  | 'aggregator'
  | 'simulator';

export type PipelineTemplateId =
  | 'linear-spine'
  | 'input-core-output'
  | 'spine-lower-branch'
  | 'split-merge'
  | 'paired-state-simulator'
  | 'outer-feedback-loop';

export type PipelineLocalTemplateId =
  | 'input-container-stack'
  | 'horizontal-pair'
  | 'vertical-pair'
  | 'small-fan-out'
  | 'small-fan-in'
  | 'media-with-caption'
  | 'state-before-after';

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
  routing?: Point[];
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

export type LayoutProfileId = 'single' | 'double' | 'auto';

export interface LayoutProfile {
  id: 'single' | 'double';
  targetAspectRatio: number;
  maxWidth: number;
  maxHeight: number;
  scale: number;
}

export interface LayoutMetrics {
  blankSpaceScore: number;
  vifScore: number;
  aspectRatioPenalty: number;
  alignmentPenalty: number;
  groupingPenalty: number;
  estimatedCrossings: number;
  nodeCrossings: number;
  moduleCrossings: number;
  edgeCrossings: number;
  bends: number;
  bendCount: number;
  routeLength: number;
  hardConstraintViolations: number;
  totalScore: number;
}

export interface LayoutIntentNode {
  id: string;
  role: NodeRole;
  primitive: VisualPrimitive;
  importance: number;
  moduleId?: string;
  preferredRail?: RailPreference;
  isMainSpineCandidate: boolean;
}

export interface LayoutIntentEdge {
  id: string;
  role: EdgeRole;
  sourceId: string;
  targetId: string;
  priority: number;
}

export interface LayoutIntentBranchAttachment {
  branchRootId: string;
  attachToId: string;
  side: 'top' | 'bottom' | 'left' | 'right';
}

export interface LayoutIntentMergeCluster {
  mergeNodeId: string;
  sourceIds: string[];
}

export interface LayoutIntentStatePair {
  currentId: string;
  nextId: string;
  viaId?: string;
}

export interface LayoutIntentZoneScores {
  inputZoneScore: number;
  controlZoneScore: number;
  auxZoneScore: number;
  outputZoneScore: number;
}

export interface LayoutIntentModule {
  id: string;
  role: ModuleRole;
  preferredRail?: RailPreference;
  members: string[];
}

export interface LayoutIntent {
  nodes: LayoutIntentNode[];
  edges: LayoutIntentEdge[];
  modules: LayoutIntentModule[];
  dominantSpine: string[];
  spineSegments: string[][];
  branchRoots: string[];
  branchAttachments: LayoutIntentBranchAttachment[];
  mergeNodes: string[];
  mergeClusters: LayoutIntentMergeCluster[];
  feedbackEdges: string[];
  statePairs: LayoutIntentStatePair[];
  inputContainers: string[];
  zoneScores: LayoutIntentZoneScores;
  layoutHints: string[];
}

export interface TemplateFitFeatures {
  spineLength: number;
  spineSegmentCount: number;
  branchCount: number;
  branchAttachmentCount: number;
  mergeCount: number;
  mergeClusterCount: number;
  feedbackCount: number;
  inputContainerCount: number;
  inputModuleCount: number;
  stateNodeCount: number;
  statePairCount: number;
  simulatorNodeCount: number;
  topControlCount: number;
  bottomAuxCount: number;
  outputNodeCount: number;
  inputZoneScore: number;
  controlZoneScore: number;
  auxZoneScore: number;
  outputZoneScore: number;
}

export interface SkeletonLayout {
  rootTemplateId: PipelineTemplateId;
  localTemplateIds: PipelineLocalTemplateId[];
  rails: Record<string, RailPreference>;
  blockSequence: string[];
  branchAttachments: Array<{
    branchRootId: string;
    attachToId: string;
    side: 'top' | 'bottom' | 'left' | 'right';
  }>;
  mergeTargets: string[];
  feedbackLoops: string[];
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  groups: LayoutGroup[];
  direction: LayoutDirection;
  metrics?: LayoutMetrics;
  engine?: LayoutEngine;
  fallbackFrom?: LayoutEngine;
  templateId?: PipelineTemplateId;
  routingEngine?: 'pipeline_v3' | 'orthogonal_v1';
  routeFallbackFrom?: 'pipeline_v3';
}

export interface LayoutConstraintModel {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  groups: LayoutGroup[];
  sequentialEdges: LayoutEdge[];
  annotativeEdges: LayoutEdge[];
  pinnedNodeIds: string[];
  pinnedGroupIds: string[];
  profile: LayoutProfile;
  mainFlowDirection: LayoutDirection;
}

export interface LayoutCandidate {
  id: string;
  grammar: 'H' | 'V' | 'D' | 'COMPOSITE';
  layout: LayoutResult;
  metrics: LayoutMetrics;
}

export type OptimizeMode = 'selection' | 'global';

export interface PaperDrawSelectionState {
  elementIds: string[];
  geometryIds: string[];
  edgeIds: string[];
}

export interface LayoutOptimizeOptions {
  mode: OptimizeMode;
  engine?: LayoutEngine;
  selection?: PaperDrawSelectionState;
  profile?: LayoutProfileId;
  quality?: 'quality';
  timeoutMs?: number;
}

export type ElkLayoutOptions = LayoutOptimizeOptions;

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
