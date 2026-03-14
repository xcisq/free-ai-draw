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
});
