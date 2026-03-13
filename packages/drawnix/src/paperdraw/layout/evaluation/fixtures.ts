import type {
  AnalysisResult,
  FlowRelation,
  ModuleGroup,
  PipelineTemplateId,
} from '../../types/analyzer';
import type { PipelineLayoutFixture } from './types';

type FixtureNode = {
  id: string;
  label: string;
  confidence?: number;
};

type FixtureRelation = FlowRelation;

type FixtureModule = {
  id: string;
  label: string;
  entityIds: string[];
  order: number;
};

function createAnalysis(
  nodes: FixtureNode[],
  relations: FixtureRelation[],
  modules: FixtureModule[]
): AnalysisResult {
  const entities = nodes.map((node) => ({
    id: node.id,
    label: node.label,
    confidence: node.confidence ?? 0.9,
  }));
  const weights = Object.fromEntries(
    entities.map((entity, index) => [entity.id, 0.65 + index * 0.04])
  );

  return {
    entities,
    relations,
    modules: modules.map(
      (moduleItem) =>
        ({
          id: moduleItem.id,
          label: moduleItem.label,
          entityIds: moduleItem.entityIds,
          order: moduleItem.order,
        }) satisfies ModuleGroup
    ),
    weights,
    warnings: [],
  };
}

function createFixture(input: {
  id: string;
  category: PipelineLayoutFixture['category'];
  title: string;
  nodes: FixtureNode[];
  relations: FixtureRelation[];
  modules: FixtureModule[];
  expectedTemplateId: PipelineTemplateId;
  expectedStructure: PipelineLayoutFixture['expectation']['expectedStructure'];
  metricThresholds?: Partial<PipelineLayoutFixture['expectation']['metricThresholds']>;
}): PipelineLayoutFixture {
  return {
    id: input.id,
    category: input.category,
    title: input.title,
    analysis: createAnalysis(input.nodes, input.relations, input.modules),
    expectation: {
      expectedTemplateId: input.expectedTemplateId,
      expectedStructure: input.expectedStructure,
      metricThresholds: {
        maxEdgeCrossings: 0,
        maxBendCount: 14,
        maxRouteLength: 2600,
        maxHardConstraintViolations: 30,
        maxNodeCrossings: 5,
        maxModuleCrossings: 10,
        ...input.metricThresholds,
      },
    },
  };
}

export const PIPELINE_LAYOUT_FIXTURES: PipelineLayoutFixture[] = [
  createFixture({
    id: 'A-1',
    category: 'A',
    title: '左输入容器到右输出主干',
    nodes: [
      { id: 'a1', label: 'Image Input' },
      { id: 'a2', label: 'Image Feature Extractor' },
      { id: 'a3', label: 'Core Encoder' },
      { id: 'a4', label: 'Fusion Module' },
      { id: 'a5', label: 'Final Output' },
    ],
    relations: [
      { id: 'a-r1', type: 'sequential', source: 'a1', target: 'a2' },
      { id: 'a-r2', type: 'sequential', source: 'a2', target: 'a3' },
      { id: 'a-r3', type: 'sequential', source: 'a3', target: 'a4' },
      { id: 'a-r4', type: 'sequential', source: 'a4', target: 'a5' },
    ],
    modules: [
      { id: 'a-m1', label: 'Input Stage', entityIds: ['a1', 'a2'], order: 1 },
      { id: 'a-m2', label: 'Core Stage', entityIds: ['a3', 'a4'], order: 2 },
      { id: 'a-m3', label: 'Output Stage', entityIds: ['a5'], order: 3 },
    ],
    expectedTemplateId: 'input-core-output',
    expectedStructure: {
      minSpineLength: 2,
      requireInputLeft: true,
      requireOutputRight: true,
    },
    metricThresholds: {
      maxHardConstraintViolations: 16,
      maxNodeCrossings: 4,
      maxModuleCrossings: 2,
      maxBendCount: 4,
      maxRouteLength: 500,
    },
  }),
  createFixture({
    id: 'A-2',
    category: 'A',
    title: '原始数据到结果输出',
    nodes: [
      { id: 'a21', label: 'Raw Input' },
      { id: 'a22', label: 'Feature Extractor' },
      { id: 'a23', label: 'Core Aggregator' },
      { id: 'a24', label: 'Result Output' },
    ],
    relations: [
      { id: 'a2-r1', type: 'sequential', source: 'a21', target: 'a22' },
      { id: 'a2-r2', type: 'sequential', source: 'a22', target: 'a23' },
      { id: 'a2-r3', type: 'sequential', source: 'a23', target: 'a24' },
    ],
    modules: [
      { id: 'a2-m1', label: 'Input Stage', entityIds: ['a21'], order: 1 },
      { id: 'a2-m2', label: 'Core Stage', entityIds: ['a22', 'a23'], order: 2 },
      { id: 'a2-m3', label: 'Output Stage', entityIds: ['a24'], order: 3 },
    ],
    expectedTemplateId: 'input-core-output',
    expectedStructure: {
      minSpineLength: 3,
      requireInputLeft: true,
      requireOutputRight: true,
    },
    metricThresholds: {
      maxHardConstraintViolations: 16,
      maxNodeCrossings: 5,
      maxModuleCrossings: 3,
      maxBendCount: 4,
      maxRouteLength: 500,
    },
  }),
  createFixture({
    id: 'B-1',
    category: 'B',
    title: '主干带下方解码支路',
    nodes: [
      { id: 'b1', label: 'Input Image' },
      { id: 'b2', label: 'Core Encoder' },
      { id: 'b3', label: 'Fusion Module' },
      { id: 'b4', label: 'Result Output' },
      { id: 'b5', label: 'Contact Decoder' },
      { id: 'b6', label: 'Aux Branch Output' },
    ],
    relations: [
      { id: 'b-r1', type: 'sequential', source: 'b1', target: 'b2' },
      { id: 'b-r2', type: 'sequential', source: 'b2', target: 'b3' },
      { id: 'b-r3', type: 'sequential', source: 'b3', target: 'b4' },
      { id: 'b-r4', type: 'sequential', source: 'b2', target: 'b5' },
      { id: 'b-r5', type: 'sequential', source: 'b5', target: 'b6' },
    ],
    modules: [
      { id: 'b-m1', label: 'Input Stage', entityIds: ['b1'], order: 1 },
      { id: 'b-m2', label: 'Core Stage', entityIds: ['b2', 'b3'], order: 2 },
      { id: 'b-m3', label: 'Aux Stage', entityIds: ['b5', 'b6'], order: 3 },
      { id: 'b-m4', label: 'Output Stage', entityIds: ['b4'], order: 4 },
    ],
    expectedTemplateId: 'spine-lower-branch',
    expectedStructure: {
      minSpineLength: 4,
      minBranchCount: 1,
      requireInputLeft: true,
      requireAuxBottom: true,
      requireSeparatedNonSpine: true,
    },
    metricThresholds: {
      maxHardConstraintViolations: 23,
      maxNodeCrossings: 0,
      maxModuleCrossings: 7,
      maxBendCount: 10,
      maxRouteLength: 1600,
    },
  }),
  createFixture({
    id: 'B-2',
    category: 'B',
    title: '规划主链带预测支路',
    nodes: [
      { id: 'b21', label: 'Sensor Input' },
      { id: 'b22', label: 'Planner Core' },
      { id: 'b23', label: 'Aggregate Fusion' },
      { id: 'b24', label: 'Final Output' },
      { id: 'b25', label: 'Regression Head' },
      { id: 'b26', label: 'Aux Prediction' },
    ],
    relations: [
      { id: 'b2-r1', type: 'sequential', source: 'b21', target: 'b22' },
      { id: 'b2-r2', type: 'sequential', source: 'b22', target: 'b23' },
      { id: 'b2-r3', type: 'sequential', source: 'b23', target: 'b24' },
      { id: 'b2-r4', type: 'sequential', source: 'b22', target: 'b25' },
      { id: 'b2-r5', type: 'sequential', source: 'b25', target: 'b26' },
    ],
    modules: [
      { id: 'b2-m1', label: 'Input Stage', entityIds: ['b21'], order: 1 },
      { id: 'b2-m2', label: 'Core Stage', entityIds: ['b22', 'b23'], order: 2 },
      { id: 'b2-m3', label: 'Auxiliary Stage', entityIds: ['b25', 'b26'], order: 3 },
      { id: 'b2-m4', label: 'Output Stage', entityIds: ['b24'], order: 4 },
    ],
    expectedTemplateId: 'split-merge',
    expectedStructure: {
      minSpineLength: 4,
      minBranchCount: 1,
      minMergeCount: 1,
      requireInputLeft: true,
      requireAuxBottom: true,
      requireSeparatedNonSpine: true,
    },
    metricThresholds: {
      maxHardConstraintViolations: 23,
      maxNodeCrossings: 0,
      maxModuleCrossings: 7,
      maxBendCount: 10,
      maxRouteLength: 1600,
    },
  }),
  createFixture({
    id: 'C-1',
    category: 'C',
    title: '标准分裂汇聚',
    nodes: [
      { id: 'c1', label: 'Input Frame' },
      { id: 'c2', label: 'Shared Encoder' },
      { id: 'c3', label: 'Spatial Branch' },
      { id: 'c4', label: 'Temporal Branch' },
      { id: 'c5', label: 'Merge Fusion' },
      { id: 'c6', label: 'Final Output' },
    ],
    relations: [
      { id: 'c-r1', type: 'sequential', source: 'c1', target: 'c2' },
      { id: 'c-r2', type: 'sequential', source: 'c2', target: 'c3' },
      { id: 'c-r3', type: 'sequential', source: 'c2', target: 'c4' },
      { id: 'c-r4', type: 'sequential', source: 'c3', target: 'c5' },
      { id: 'c-r5', type: 'sequential', source: 'c4', target: 'c5' },
      { id: 'c-r6', type: 'sequential', source: 'c5', target: 'c6' },
    ],
    modules: [
      { id: 'c-m1', label: 'Input Stage', entityIds: ['c1'], order: 1 },
      { id: 'c-m2', label: 'Core Stage', entityIds: ['c2'], order: 2 },
      { id: 'c-m3', label: 'Aux Branch A', entityIds: ['c3'], order: 3 },
      { id: 'c-m4', label: 'Aux Branch B', entityIds: ['c4'], order: 4 },
      { id: 'c-m5', label: 'Output Stage', entityIds: ['c5', 'c6'], order: 5 },
    ],
    expectedTemplateId: 'split-merge',
    expectedStructure: {
      minSpineLength: 5,
      minBranchCount: 1,
      minMergeCount: 1,
      requireInputLeft: true,
      requireOutputRight: true,
      requireSeparatedNonSpine: true,
    },
    metricThresholds: {
      maxHardConstraintViolations: 23,
      maxNodeCrossings: 0,
      maxModuleCrossings: 6,
      maxBendCount: 12,
      maxRouteLength: 2300,
    },
  }),
  createFixture({
    id: 'C-2',
    category: 'C',
    title: '多路汇聚到输出',
    nodes: [
      { id: 'c21', label: 'Raw Input' },
      { id: 'c22', label: 'Core Encoder' },
      { id: 'c23', label: 'Descriptor Branch' },
      { id: 'c24', label: 'Predictor Branch' },
      { id: 'c25', label: 'Aggregate Merge' },
      { id: 'c26', label: 'Prediction Output' },
    ],
    relations: [
      { id: 'c2-r1', type: 'sequential', source: 'c21', target: 'c22' },
      { id: 'c2-r2', type: 'sequential', source: 'c22', target: 'c23' },
      { id: 'c2-r3', type: 'sequential', source: 'c22', target: 'c24' },
      { id: 'c2-r4', type: 'sequential', source: 'c23', target: 'c25' },
      { id: 'c2-r5', type: 'sequential', source: 'c24', target: 'c25' },
      { id: 'c2-r6', type: 'sequential', source: 'c25', target: 'c26' },
    ],
    modules: [
      { id: 'c2-m1', label: 'Input Stage', entityIds: ['c21'], order: 1 },
      { id: 'c2-m2', label: 'Core Stage', entityIds: ['c22'], order: 2 },
      { id: 'c2-m3', label: 'Auxiliary Stage A', entityIds: ['c23'], order: 3 },
      { id: 'c2-m4', label: 'Auxiliary Stage B', entityIds: ['c24'], order: 4 },
      { id: 'c2-m5', label: 'Output Stage', entityIds: ['c25', 'c26'], order: 5 },
    ],
    expectedTemplateId: 'split-merge',
    expectedStructure: {
      minSpineLength: 5,
      minBranchCount: 1,
      minMergeCount: 1,
      requireInputLeft: true,
      requireOutputRight: true,
      requireSeparatedNonSpine: true,
    },
    metricThresholds: {
      maxHardConstraintViolations: 23,
      maxNodeCrossings: 0,
      maxModuleCrossings: 6,
      maxBendCount: 12,
      maxRouteLength: 2300,
    },
  }),
  createFixture({
    id: 'D-1',
    category: 'D',
    title: '状态更新与物理模拟',
    nodes: [
      { id: 'd1', label: 'Current State' },
      { id: 'd2', label: 'Force Decoder' },
      { id: 'd3', label: 'Physics Simulation' },
      { id: 'd4', label: 'Updated State' },
    ],
    relations: [
      { id: 'd-r1', type: 'sequential', source: 'd1', target: 'd3' },
      { id: 'd-r2', type: 'sequential', source: 'd2', target: 'd3' },
      { id: 'd-r3', type: 'sequential', source: 'd3', target: 'd4' },
    ],
    modules: [
      { id: 'd-m1', label: 'Input Stage', entityIds: ['d1'], order: 1 },
      { id: 'd-m2', label: 'Auxiliary Stage', entityIds: ['d2'], order: 2 },
      { id: 'd-m3', label: 'Core Stage', entityIds: ['d3'], order: 3 },
      { id: 'd-m4', label: 'Output Stage', entityIds: ['d4'], order: 4 },
    ],
    expectedTemplateId: 'input-core-output',
    expectedStructure: {
      minSpineLength: 3,
      minMergeCount: 1,
      requireInputLeft: true,
      requireOutputRight: true,
    },
    metricThresholds: {
      maxHardConstraintViolations: 12,
      maxNodeCrossings: 0,
      maxModuleCrossings: 2,
      maxBendCount: 8,
      maxRouteLength: 1300,
    },
  }),
  createFixture({
    id: 'D-2',
    category: 'D',
    title: '初始状态到下一状态',
    nodes: [
      { id: 'd21', label: 'Initial State' },
      { id: 'd22', label: 'Condition Parameter' },
      { id: 'd23', label: 'Dynamics Simulation' },
      { id: 'd24', label: 'Next State' },
    ],
    relations: [
      { id: 'd2-r1', type: 'sequential', source: 'd21', target: 'd23' },
      { id: 'd2-r2', type: 'sequential', source: 'd22', target: 'd23' },
      { id: 'd2-r3', type: 'sequential', source: 'd23', target: 'd24' },
    ],
    modules: [
      { id: 'd2-m1', label: 'Input Stage', entityIds: ['d21'], order: 1 },
      { id: 'd2-m2', label: 'Control Stage', entityIds: ['d22'], order: 2 },
      { id: 'd2-m3', label: 'Core Stage', entityIds: ['d23'], order: 3 },
      { id: 'd2-m4', label: 'Output Stage', entityIds: ['d24'], order: 4 },
    ],
    expectedTemplateId: 'input-core-output',
    expectedStructure: {
      minSpineLength: 3,
      minMergeCount: 1,
      requireInputLeft: true,
      requireOutputRight: true,
      requireControlTop: true,
    },
    metricThresholds: {
      maxHardConstraintViolations: 12,
      maxNodeCrossings: 0,
      maxModuleCrossings: 2,
      maxBendCount: 8,
      maxRouteLength: 1300,
    },
  }),
  createFixture({
    id: 'E-1',
    category: 'E',
    title: '上控制下辅助的主干结构',
    nodes: [
      { id: 'e1', label: 'Input Frame' },
      { id: 'e2', label: 'Core Encoder' },
      { id: 'e3', label: 'Fusion Module' },
      { id: 'e4', label: 'Final Output' },
      { id: 'e5', label: 'Prompt Parameter' },
      { id: 'e6', label: 'Decoder Head' },
      { id: 'e7', label: 'Aux Prediction' },
    ],
    relations: [
      { id: 'e-r1', type: 'sequential', source: 'e1', target: 'e2' },
      { id: 'e-r2', type: 'sequential', source: 'e2', target: 'e3' },
      { id: 'e-r3', type: 'sequential', source: 'e3', target: 'e4' },
      { id: 'e-r4', type: 'annotative', source: 'e5', target: 'e3' },
      { id: 'e-r5', type: 'sequential', source: 'e2', target: 'e6' },
      { id: 'e-r6', type: 'sequential', source: 'e6', target: 'e7' },
    ],
    modules: [
      { id: 'e-m1', label: 'Input Stage', entityIds: ['e1'], order: 1 },
      { id: 'e-m2', label: 'Control Stage', entityIds: ['e5'], order: 2 },
      { id: 'e-m3', label: 'Core Stage', entityIds: ['e2', 'e3'], order: 3 },
      { id: 'e-m4', label: 'Auxiliary Stage', entityIds: ['e6', 'e7'], order: 4 },
      { id: 'e-m5', label: 'Output Stage', entityIds: ['e4'], order: 5 },
    ],
    expectedTemplateId: 'spine-lower-branch',
    expectedStructure: {
      minSpineLength: 4,
      minBranchCount: 1,
      requireInputLeft: true,
      requireControlTop: true,
      requireAuxBottom: true,
      requireSeparatedNonSpine: true,
    },
    metricThresholds: {
      maxHardConstraintViolations: 29,
      maxNodeCrossings: 0,
      maxModuleCrossings: 9,
      maxBendCount: 12,
      maxRouteLength: 2300,
    },
  }),
  createFixture({
    id: 'E-2',
    category: 'E',
    title: '条件控制与辅助验证',
    nodes: [
      { id: 'e21', label: 'Sensor Input' },
      { id: 'e22', label: 'Planner Core' },
      { id: 'e23', label: 'Aggregate Fusion' },
      { id: 'e24', label: 'Result Output' },
      { id: 'e25', label: 'Condition Parameter' },
      { id: 'e26', label: 'Verifier Decoder' },
      { id: 'e27', label: 'Aux Result' },
    ],
    relations: [
      { id: 'e2-r1', type: 'sequential', source: 'e21', target: 'e22' },
      { id: 'e2-r2', type: 'sequential', source: 'e22', target: 'e23' },
      { id: 'e2-r3', type: 'sequential', source: 'e23', target: 'e24' },
      { id: 'e2-r4', type: 'annotative', source: 'e25', target: 'e22' },
      { id: 'e2-r5', type: 'sequential', source: 'e23', target: 'e26' },
      { id: 'e2-r6', type: 'sequential', source: 'e26', target: 'e27' },
    ],
    modules: [
      { id: 'e2-m1', label: 'Input Stage', entityIds: ['e21'], order: 1 },
      { id: 'e2-m2', label: 'Control Stage', entityIds: ['e25'], order: 2 },
      { id: 'e2-m3', label: 'Core Stage', entityIds: ['e22', 'e23'], order: 3 },
      { id: 'e2-m4', label: 'Auxiliary Stage', entityIds: ['e26', 'e27'], order: 4 },
      { id: 'e2-m5', label: 'Output Stage', entityIds: ['e24'], order: 5 },
    ],
    expectedTemplateId: 'split-merge',
    expectedStructure: {
      minSpineLength: 3,
      minMergeCount: 1,
      requireInputLeft: true,
      requireControlTop: true,
      requireAuxBottom: true,
      requireSeparatedNonSpine: true,
    },
    metricThresholds: {
      maxHardConstraintViolations: 30,
      maxNodeCrossings: 0,
      maxModuleCrossings: 9,
      maxBendCount: 12,
      maxRouteLength: 2300,
    },
  }),
  createFixture({
    id: 'F-1',
    category: 'F',
    title: '输出反馈回核心',
    nodes: [
      { id: 'f1', label: 'Input Frame' },
      { id: 'f2', label: 'Core Encoder' },
      { id: 'f3', label: 'Fusion Module' },
      { id: 'f4', label: 'Final Output' },
    ],
    relations: [
      { id: 'f-r1', type: 'sequential', source: 'f1', target: 'f2' },
      { id: 'f-r2', type: 'sequential', source: 'f2', target: 'f3' },
      { id: 'f-r3', type: 'sequential', source: 'f3', target: 'f4' },
      { id: 'f-r4', type: 'sequential', source: 'f4', target: 'f2' },
    ],
    modules: [
      { id: 'f-m1', label: 'Input Stage', entityIds: ['f1'], order: 1 },
      { id: 'f-m2', label: 'Core Stage', entityIds: ['f2', 'f3'], order: 2 },
      { id: 'f-m3', label: 'Output Stage', entityIds: ['f4'], order: 3 },
    ],
    expectedTemplateId: 'outer-feedback-loop',
    expectedStructure: {
      minSpineLength: 3,
      minFeedbackCount: 1,
      requireInputLeft: true,
      requireOutputRight: true,
      requireOuterFeedback: true,
      requireSeparatedNonSpine: true,
    },
    metricThresholds: {
      maxHardConstraintViolations: 14,
      maxNodeCrossings: 0,
      maxModuleCrossings: 5,
      maxBendCount: 8,
      maxRouteLength: 1300,
    },
  }),
  createFixture({
    id: 'F-2',
    category: 'F',
    title: '状态反馈回规划器',
    nodes: [
      { id: 'f21', label: 'Sensor Input' },
      { id: 'f22', label: 'Planner Core' },
      { id: 'f23', label: 'Physics Simulation' },
      { id: 'f24', label: 'Updated State' },
    ],
    relations: [
      { id: 'f2-r1', type: 'sequential', source: 'f21', target: 'f22' },
      { id: 'f2-r2', type: 'sequential', source: 'f22', target: 'f23' },
      { id: 'f2-r3', type: 'sequential', source: 'f23', target: 'f24' },
      { id: 'f2-r4', type: 'sequential', source: 'f24', target: 'f22' },
    ],
    modules: [
      { id: 'f2-m1', label: 'Input Stage', entityIds: ['f21'], order: 1 },
      { id: 'f2-m2', label: 'Core Stage', entityIds: ['f22', 'f23'], order: 2 },
      { id: 'f2-m3', label: 'Output Stage', entityIds: ['f24'], order: 3 },
    ],
    expectedTemplateId: 'outer-feedback-loop',
    expectedStructure: {
      minSpineLength: 3,
      minFeedbackCount: 1,
      requireInputLeft: true,
      requireOutputRight: true,
      requireOuterFeedback: true,
      requireSeparatedNonSpine: true,
    },
    metricThresholds: {
      maxHardConstraintViolations: 14,
      maxNodeCrossings: 0,
      maxModuleCrossings: 5,
      maxBendCount: 8,
      maxRouteLength: 1300,
    },
  }),
];

export const PIPELINE_LAYOUT_CORE_FIXTURE_IDS = [
  'A-1',
  'B-1',
  'C-1',
  'D-1',
  'E-1',
  'F-1',
];
