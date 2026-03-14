import type { AnalysisResult } from '../types/analyzer';
import { basicLayout } from './basic-layout';
import { buildLayoutIntent } from './pipeline-layout-intent';

const analysis: AnalysisResult = {
  entities: [
    { id: 'n1', label: 'Image Input', confidence: 0.95 },
    { id: 'n2', label: 'Encoder LSTM', confidence: 0.92 },
    { id: 'n3', label: 'Contact Decoder', confidence: 0.86 },
    { id: 'n4', label: 'Physics Simulation', confidence: 0.96 },
    { id: 'n5', label: 'Current State', confidence: 0.84 },
    { id: 'n6', label: 'Updated State', confidence: 0.93 },
  ],
  relations: [
    { id: 'r1', type: 'sequential', source: 'n1', target: 'n2' },
    { id: 'r2', type: 'sequential', source: 'n2', target: 'n4' },
    { id: 'r3', type: 'sequential', source: 'n2', target: 'n3' },
    { id: 'r4', type: 'sequential', source: 'n3', target: 'n4' },
    { id: 'r5', type: 'sequential', source: 'n2', target: 'n5' },
    { id: 'r6', type: 'sequential', source: 'n5', target: 'n4' },
    { id: 'r7', type: 'sequential', source: 'n4', target: 'n6' },
    { id: 'r8', type: 'sequential', source: 'n6', target: 'n2' },
  ],
  weights: {
    n1: 0.95,
    n2: 0.92,
    n3: 0.42,
    n4: 0.98,
    n5: 0.4,
    n6: 0.9,
  },
  modules: [
    {
      id: 'm1',
      label: 'Input Stage',
      entityIds: ['n1', 'n2'],
      order: 1,
    },
    {
      id: 'm2',
      label: 'Aux Decoder',
      entityIds: ['n3'],
      order: 2,
    },
    {
      id: 'm3',
      label: 'Core Simulation',
      entityIds: ['n4'],
      order: 3,
    },
    {
      id: 'm4',
      label: 'Output State',
      entityIds: ['n5', 'n6'],
      order: 4,
    },
  ],
};

describe('pipeline-layout-intent', () => {
  it('infers roles, dominant spine, branches, merges, and feedback edges', () => {
    const layout = basicLayout(analysis);
    const intent = buildLayoutIntent(analysis, layout);
    const nodeMap = new Map(intent.nodes.map((node) => [node.id, node]));
    const edgeMap = new Map(intent.edges.map((edge) => [edge.id, edge]));
    const moduleMap = new Map(intent.modules.map((moduleItem) => [moduleItem.id, moduleItem]));

    expect(nodeMap.get('n1')?.role).toBe('media');
    expect(nodeMap.get('n3')?.role).toBe('decoder');
    expect(nodeMap.get('n4')?.role).toBe('simulator');
    expect(nodeMap.get('n6')?.role).toBe('state');
    expect(moduleMap.get('m2')?.role).toBe('auxiliary_stage');
    expect(moduleMap.get('m4')?.role).toBe('output_stage');

    expect(intent.dominantSpine[0]).toBe('n1');
    expect(intent.dominantSpine[1]).toBe('n2');
    expect(intent.dominantSpine.at(-2)).toBe('n4');
    expect(intent.dominantSpine.at(-1)).toBe('n6');
    expect(intent.spineSegments).toEqual(
      expect.arrayContaining([
        ['n1', 'n2'],
        ['n4'],
        ['n6'],
      ])
    );
    expect(intent.branchRoots).toContain('n5');
    expect(intent.branchAttachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          branchRootId: 'n5',
          attachToId: 'n2',
          side: 'right',
        }),
      ])
    );
    expect(intent.mergeNodes).toContain('n4');
    expect(intent.mergeClusters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mergeNodeId: 'n4',
          sourceIds: expect.arrayContaining(['n2', 'n3']),
        }),
      ])
    );
    expect(intent.feedbackEdges).toContain('r8');
    expect(intent.statePairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currentId: 'n5',
          nextId: 'n6',
        }),
      ])
    );
    expect(intent.inputContainers).toContain('n1');
    expect(intent.zoneScores.inputZoneScore).toBeGreaterThan(0.2);
    expect(intent.zoneScores.outputZoneScore).toBeGreaterThan(0.2);
    expect(edgeMap.get('r8')?.role).toBe('feedback');
  });

  it('prefers explicit semantic candidates over keyword-only inference', () => {
    const semanticAnalysis: AnalysisResult = {
      entities: [
        {
          id: 's1',
          label: 'Latent Vector',
          roleCandidate: 'parameter',
        },
        {
          id: 's2',
          label: 'Feature Mixer',
          roleCandidate: 'aggregator',
        },
        {
          id: 's3',
          label: 'Next Output',
          roleCandidate: 'output',
        },
      ],
      relations: [
        {
          id: 'sr1',
          type: 'sequential',
          source: 's1',
          target: 's2',
          roleCandidate: 'control',
        },
        {
          id: 'sr2',
          type: 'sequential',
          source: 's2',
          target: 's3',
          roleCandidate: 'main',
        },
      ],
      weights: {
        s1: 0.7,
        s2: 0.88,
        s3: 0.9,
      },
      modules: [
        {
          id: 'sm1',
          label: 'Guidance',
          entityIds: ['s1', 's2'],
          order: 1,
          roleCandidate: 'control_stage',
        },
        {
          id: 'sm2',
          label: 'Result',
          entityIds: ['s3', 's2'],
          order: 2,
          roleCandidate: 'output_stage',
        },
      ],
      spineCandidate: ['s2', 's3'],
    };

    const layout = basicLayout(semanticAnalysis);
    const intent = buildLayoutIntent(semanticAnalysis, layout);
    const nodeMap = new Map(intent.nodes.map((node) => [node.id, node]));
    const edgeMap = new Map(intent.edges.map((edge) => [edge.id, edge]));
    const moduleMap = new Map(intent.modules.map((moduleItem) => [moduleItem.id, moduleItem]));

    expect(nodeMap.get('s1')?.role).toBe('parameter');
    expect(nodeMap.get('s2')?.role).toBe('aggregator');
    expect(moduleMap.get('sm1')?.role).toBe('control_stage');
    expect(edgeMap.get('sr1')?.role).toBe('control');
    expect(intent.dominantSpine).toEqual(['s2', 's3']);
  });

  it('keeps explicit feedback edges in feedback sets even when topology is forward', () => {
    const explicitFeedbackAnalysis: AnalysisResult = {
      entities: [
        { id: 'f1', label: 'Input' },
        { id: 'f2', label: 'Current State', roleCandidate: 'state' },
        { id: 'f3', label: 'Update Gate', roleCandidate: 'process' },
      ],
      relations: [
        {
          id: 'fr1',
          type: 'sequential',
          source: 'f1',
          target: 'f2',
          roleCandidate: 'main',
        },
        {
          id: 'fr2',
          type: 'sequential',
          source: 'f2',
          target: 'f3',
          roleCandidate: 'feedback',
        },
      ],
      weights: {
        f1: 0.9,
        f2: 0.85,
        f3: 0.8,
      },
      modules: [
        {
          id: 'fm1',
          label: 'State Update',
          entityIds: ['f1', 'f2', 'f3'],
          order: 1,
        },
      ],
    };

    const layout = basicLayout(explicitFeedbackAnalysis);
    const intent = buildLayoutIntent(explicitFeedbackAnalysis, layout);
    const edgeMap = new Map(intent.edges.map((edge) => [edge.id, edge]));

    expect(intent.feedbackEdges).toContain('fr2');
    expect(edgeMap.get('fr2')?.role).toBe('feedback');
    expect(intent.layoutHints).toContain('has_feedback');
  });

  it('promotes explicit aggregator nodes into merge clusters using attached branch roots', () => {
    const aggregatorAnalysis: AnalysisResult = {
      entities: [
        { id: 'a1', label: 'Input' },
        { id: 'a2', label: 'Main Stage' },
        { id: 'a3', label: 'Aux Branch' },
        { id: 'a4', label: 'Fusion Node', roleCandidate: 'aggregator' },
        { id: 'a5', label: 'Output' },
      ],
      relations: [
        { id: 'ar1', type: 'sequential', source: 'a1', target: 'a2' },
        { id: 'ar2', type: 'sequential', source: 'a2', target: 'a3' },
        { id: 'ar3', type: 'sequential', source: 'a2', target: 'a4' },
        { id: 'ar4', type: 'sequential', source: 'a4', target: 'a5' },
      ],
      weights: {
        a1: 0.9,
        a2: 0.88,
        a3: 0.62,
        a4: 0.91,
        a5: 0.86,
      },
      modules: [
        { id: 'am1', label: 'Input', entityIds: ['a1'], order: 1 },
        { id: 'am2', label: 'Core', entityIds: ['a2', 'a4'], order: 2 },
        { id: 'am3', label: 'Aux Branch', entityIds: ['a3'], order: 3 },
        { id: 'am4', label: 'Output', entityIds: ['a5'], order: 4 },
      ],
      spineCandidate: ['a1', 'a2', 'a4', 'a5'],
    };

    const layout = basicLayout(aggregatorAnalysis);
    const intent = buildLayoutIntent(aggregatorAnalysis, layout);

    expect(intent.branchRoots).toContain('a3');
    expect(intent.mergeNodes).toContain('a4');
    expect(intent.mergeClusters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mergeNodeId: 'a4',
          sourceIds: expect.arrayContaining(['a2', 'a3']),
        }),
      ])
    );
    expect(intent.layoutHints).toContain('has_merge_cluster');
  });

  it('keeps mixed control and auxiliary modules on core stages instead of keyword-only rails', () => {
    const mixedModuleAnalysis: AnalysisResult = {
      entities: [
        { id: 'm1', label: 'Input', roleCandidate: 'input' },
        { id: 'm2', label: 'Guidance Token', roleCandidate: 'parameter' },
        { id: 'm3', label: 'Feature Mixer', roleCandidate: 'aggregator' },
        { id: 'm4', label: 'Core Simulator', roleCandidate: 'simulator' },
        { id: 'm5', label: 'Aux Decoder', roleCandidate: 'decoder' },
        { id: 'm6', label: 'Output', roleCandidate: 'output' },
      ],
      relations: [
        { id: 'mr1', type: 'sequential', source: 'm1', target: 'm3', roleCandidate: 'main' },
        { id: 'mr2', type: 'annotative', source: 'm2', target: 'm3', roleCandidate: 'control' },
        { id: 'mr3', type: 'sequential', source: 'm3', target: 'm4', roleCandidate: 'main' },
        { id: 'mr4', type: 'sequential', source: 'm4', target: 'm5', roleCandidate: 'auxiliary' },
        { id: 'mr5', type: 'sequential', source: 'm4', target: 'm6', roleCandidate: 'main' },
      ],
      weights: {
        m1: 0.9,
        m2: 0.72,
        m3: 0.88,
        m4: 0.9,
        m5: 0.68,
        m6: 0.91,
      },
      modules: [
        { id: 'mm1', label: 'Input Stage', entityIds: ['m1'], order: 1 },
        { id: 'mm2', label: 'Control Guidance', entityIds: ['m2', 'm3'], order: 2 },
        { id: 'mm3', label: 'Aux Decoder', entityIds: ['m4', 'm5'], order: 3 },
        { id: 'mm4', label: 'Output Stage', entityIds: ['m6'], order: 4 },
      ],
      spineCandidate: ['m1', 'm3', 'm4', 'm6'],
    };

    const layout = basicLayout(mixedModuleAnalysis);
    const intent = buildLayoutIntent(mixedModuleAnalysis, layout);
    const nodeMap = new Map(intent.nodes.map((node) => [node.id, node]));
    const moduleMap = new Map(intent.modules.map((moduleItem) => [moduleItem.id, moduleItem]));

    expect(moduleMap.get('mm2')?.role).toBe('core_stage');
    expect(moduleMap.get('mm3')?.role).toBe('core_stage');
    expect(nodeMap.get('m2')?.preferredRail).toBe('top_control_rail');
    expect(nodeMap.get('m3')?.preferredRail).toBe('main_rail');
    expect(nodeMap.get('m4')?.preferredRail).toBe('main_rail');
    expect(nodeMap.get('m5')?.preferredRail).toBe('bottom_aux_rail');
  });

  it('does not overwrite explicit node roles inside explicit control or auxiliary modules', () => {
    const explicitRoleAnalysis: AnalysisResult = {
      entities: [
        { id: 'e1', label: 'Control Token', roleCandidate: 'parameter' },
        { id: 'e2', label: 'Fusion Core', roleCandidate: 'aggregator' },
        { id: 'e3', label: 'Aux Decoder', roleCandidate: 'decoder' },
        { id: 'e4', label: 'Core Simulator', roleCandidate: 'simulator' },
      ],
      relations: [
        { id: 'er1', type: 'annotative', source: 'e1', target: 'e2', roleCandidate: 'control' },
        { id: 'er2', type: 'sequential', source: 'e2', target: 'e4', roleCandidate: 'main' },
        { id: 'er3', type: 'sequential', source: 'e4', target: 'e3', roleCandidate: 'auxiliary' },
      ],
      weights: {
        e1: 0.7,
        e2: 0.89,
        e3: 0.66,
        e4: 0.91,
      },
      modules: [
        {
          id: 'em1',
          label: 'Control Stage',
          entityIds: ['e1', 'e2'],
          order: 1,
          roleCandidate: 'control_stage',
        },
        {
          id: 'em2',
          label: 'Auxiliary Stage',
          entityIds: ['e3', 'e4'],
          order: 2,
          roleCandidate: 'auxiliary_stage',
        },
      ],
      spineCandidate: ['e2', 'e4'],
    };

    const layout = basicLayout(explicitRoleAnalysis);
    const intent = buildLayoutIntent(explicitRoleAnalysis, layout);
    const nodeMap = new Map(intent.nodes.map((node) => [node.id, node]));

    expect(nodeMap.get('e1')?.role).toBe('parameter');
    expect(nodeMap.get('e2')?.role).toBe('aggregator');
    expect(nodeMap.get('e3')?.role).toBe('decoder');
    expect(nodeMap.get('e4')?.role).toBe('simulator');
  });

  it('does not let explicit auxiliary edges stretch the dominant spine into a long chain', () => {
    const explicitAuxAnalysis: AnalysisResult = {
      entities: [
        { id: 'x1', label: 'Input' },
        { id: 'x2', label: 'Core Parser' },
        { id: 'x3', label: 'Main Output' },
        { id: 'x4', label: 'Aux Layout Draft' },
        { id: 'x5', label: 'Aux Router' },
      ],
      relations: [
        { id: 'xr1', type: 'sequential', source: 'x1', target: 'x2', roleCandidate: 'main' },
        { id: 'xr2', type: 'sequential', source: 'x2', target: 'x3', roleCandidate: 'main' },
        { id: 'xr3', type: 'sequential', source: 'x2', target: 'x4', roleCandidate: 'auxiliary' },
        { id: 'xr4', type: 'sequential', source: 'x4', target: 'x5', roleCandidate: 'auxiliary' },
      ],
      weights: {
        x1: 0.82,
        x2: 0.9,
        x3: 0.84,
        x4: 0.97,
        x5: 0.96,
      },
      modules: [
        { id: 'xm1', label: 'Input', entityIds: ['x1'], order: 1 },
        { id: 'xm2', label: 'Core', entityIds: ['x2'], order: 2 },
        { id: 'xm3', label: 'Output', entityIds: ['x3'], order: 3 },
        { id: 'xm4', label: 'Aux Branch', entityIds: ['x4', 'x5'], order: 4 },
      ],
    };

    const layout = basicLayout(explicitAuxAnalysis);
    const intent = buildLayoutIntent(explicitAuxAnalysis, layout);
    const edgeMap = new Map(intent.edges.map((edge) => [edge.id, edge]));

    expect(intent.dominantSpine).toEqual(['x1', 'x2', 'x3']);
    expect(intent.branchRoots).toContain('x4');
    expect(edgeMap.get('xr3')?.role).toBe('auxiliary');
  });
});
