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

    expect(nodeMap.get('n1')?.role).toBe('input');
    expect(nodeMap.get('n3')?.role).toBe('decoder');
    expect(nodeMap.get('n4')?.role).toBe('simulator');
    expect(nodeMap.get('n6')?.role).toBe('output');
    expect(moduleMap.get('m2')?.role).toBe('auxiliary_stage');
    expect(moduleMap.get('m4')?.role).toBe('output_stage');

    expect(intent.dominantSpine).toEqual(['n1', 'n2', 'n3', 'n4', 'n6']);
    expect(intent.branchRoots).toContain('n5');
    expect(intent.mergeNodes).toContain('n4');
    expect(intent.feedbackEdges).toContain('r8');
    expect(edgeMap.get('r8')?.role).toBe('feedback');
  });
});
