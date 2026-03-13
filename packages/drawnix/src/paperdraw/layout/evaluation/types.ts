import type {
  AnalysisResult,
  LayoutIntent,
  LayoutMetrics,
  LayoutResult,
  PipelineTemplateId,
} from '../../types/analyzer';

export type PipelineLayoutFixtureCategory =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F';

export interface PipelineLayoutExpectedStructure {
  minSpineLength: number;
  minBranchCount?: number;
  minMergeCount?: number;
  minFeedbackCount?: number;
  requireInputLeft?: boolean;
  requireOutputRight?: boolean;
  requireAuxBottom?: boolean;
  requireControlTop?: boolean;
  requireOuterFeedback?: boolean;
  requireSeparatedNonSpine?: boolean;
}

export interface PipelineLayoutMetricThresholds {
  maxEdgeCrossings: number;
  maxBendCount: number;
  maxRouteLength: number;
  maxHardConstraintViolations?: number;
  maxNodeCrossings?: number;
  maxModuleCrossings?: number;
  requireZeroHardViolations?: boolean;
  requireZeroNodeCrossings?: boolean;
  requireZeroModuleCrossings?: boolean;
}

export interface PipelineLayoutExpectation {
  expectedTemplateId: PipelineTemplateId;
  expectedStructure: PipelineLayoutExpectedStructure;
  metricThresholds: PipelineLayoutMetricThresholds;
}

export interface PipelineLayoutFixture {
  id: string;
  category: PipelineLayoutFixtureCategory;
  title: string;
  analysis: AnalysisResult;
  expectation: PipelineLayoutExpectation;
}

export interface PipelineLayoutStructureChecks {
  templateMatched: boolean;
  spineLength: number;
  branchCount: number;
  mergeCount: number;
  feedbackCount: number;
  hasInputLeft: boolean;
  hasOutputRight: boolean;
  hasAuxBottom: boolean;
  hasControlTop: boolean;
  hasOuterFeedback: boolean;
  hasSeparatedNonSpine: boolean;
}

export interface PipelineLayoutEvaluationResult {
  fixtureId: string;
  category: PipelineLayoutFixtureCategory;
  optimizedLayout: LayoutResult;
  intent: LayoutIntent;
  metrics: LayoutMetrics;
  structure: PipelineLayoutStructureChecks;
}
