import type { AnalysisResult } from '../types/analyzer';
import { basicLayout } from './basic-layout';
import { buildLayoutIntent } from './pipeline-layout-intent';
import { buildPipelineBlueprint } from './pipeline-blueprint';

describe('pipeline-blueprint', () => {
  it('compiles branch groups, merge groups and edge policies from semantic intent', () => {
    const analysis: AnalysisResult = {
      entities: [
        { id: 'n1', label: 'Input Image', roleCandidate: 'media' },
        { id: 'n2', label: 'Main Encoder' },
        { id: 'n3', label: 'Aux Decoder', roleCandidate: 'decoder' },
        { id: 'n4', label: 'Fusion Node', roleCandidate: 'aggregator' },
        { id: 'n5', label: 'Output State', roleCandidate: 'output' },
        { id: 'n6', label: 'Current State', roleCandidate: 'state' },
      ],
      relations: [
        { id: 'r1', type: 'sequential', source: 'n1', target: 'n2', roleCandidate: 'main' },
        { id: 'r2', type: 'sequential', source: 'n2', target: 'n4', roleCandidate: 'main' },
        { id: 'r3', type: 'sequential', source: 'n2', target: 'n3', roleCandidate: 'auxiliary' },
        { id: 'r4', type: 'sequential', source: 'n3', target: 'n4', roleCandidate: 'auxiliary' },
        { id: 'r5', type: 'sequential', source: 'n4', target: 'n5', roleCandidate: 'main' },
        { id: 'r6', type: 'sequential', source: 'n5', target: 'n6', roleCandidate: 'feedback' },
      ],
      weights: {
        n1: 0.92,
        n2: 0.9,
        n3: 0.68,
        n4: 0.94,
        n5: 0.88,
        n6: 0.77,
      },
      modules: [
        { id: 'm1', label: 'Input', entityIds: ['n1'], order: 1, roleCandidate: 'input_stage' },
        { id: 'm2', label: 'Core', entityIds: ['n2', 'n4'], order: 2, roleCandidate: 'core_stage' },
        { id: 'm3', label: 'Aux Decoder', entityIds: ['n3'], order: 3, roleCandidate: 'auxiliary_stage' },
        { id: 'm4', label: 'Output', entityIds: ['n5', 'n6'], order: 4, roleCandidate: 'output_stage' },
      ],
      spineCandidate: ['n1', 'n2', 'n4', 'n5'],
    };

    const baseLayout = basicLayout(analysis);
    const intent = buildLayoutIntent(analysis, baseLayout);
    const blueprint = buildPipelineBlueprint(analysis, intent);

    expect(blueprint.spineNodeIds).toEqual(['n1', 'n2', 'n4', 'n5']);
    expect(blueprint.branchGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rootId: 'n3',
          attachToId: 'n2',
          laneKind: 'auxiliary',
        }),
      ])
    );
    expect(blueprint.lanes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'lane:auxiliary:n2:bottom:n3',
          kind: 'auxiliary',
          nodeIds: expect.arrayContaining(['n3']),
        }),
      ])
    );
    expect(blueprint.mergeGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mergeNodeId: 'n4',
          bundleKey: 'merge:n4',
        }),
      ])
    );
    expect(blueprint.feedbackLoops).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          edgeId: 'r6',
          laneId: 'lane:feedback',
        }),
      ])
    );
    expect(blueprint.edgePolicies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          edgeId: 'r1',
          routeLane: 'main',
          bundleKey: 'spine',
        }),
        expect.objectContaining({
          edgeId: 'r4',
          bundleKey: 'merge:n4',
        }),
      ])
    );
  });

  it('builds dedicated branch lanes for generic off-spine groups', () => {
    const analysis: AnalysisResult = {
      entities: [
        { id: 'b1', label: 'Input' },
        { id: 'b2', label: 'Core Parser' },
        { id: 'b3', label: 'Branch Draft A' },
        { id: 'b4', label: 'Branch Detail A' },
        { id: 'b5', label: 'Branch Draft B' },
        { id: 'b6', label: 'Branch Detail B' },
        { id: 'b7', label: 'Output' },
      ],
      relations: [
        { id: 'br1', type: 'sequential', source: 'b1', target: 'b2', roleCandidate: 'main' },
        { id: 'br2', type: 'sequential', source: 'b2', target: 'b7', roleCandidate: 'main' },
        { id: 'br3', type: 'sequential', source: 'b2', target: 'b3', roleCandidate: 'auxiliary' },
        { id: 'br4', type: 'sequential', source: 'b3', target: 'b4', roleCandidate: 'auxiliary' },
        { id: 'br5', type: 'sequential', source: 'b2', target: 'b5', roleCandidate: 'auxiliary' },
        { id: 'br6', type: 'sequential', source: 'b5', target: 'b6', roleCandidate: 'auxiliary' },
      ],
      weights: {
        b1: 0.9,
        b2: 0.88,
        b3: 0.71,
        b4: 0.68,
        b5: 0.7,
        b6: 0.67,
        b7: 0.91,
      },
      modules: [
        { id: 'bm1', label: 'Input', entityIds: ['b1'], order: 1 },
        { id: 'bm2', label: 'Core', entityIds: ['b2'], order: 2 },
        { id: 'bm3', label: 'Branch A', entityIds: ['b3', 'b4'], order: 3 },
        { id: 'bm4', label: 'Branch B', entityIds: ['b5', 'b6'], order: 4 },
        { id: 'bm5', label: 'Output', entityIds: ['b7'], order: 5 },
      ],
      spineCandidate: ['b1', 'b2', 'b7'],
    };

    const baseLayout = basicLayout(analysis);
    const intent = buildLayoutIntent(analysis, baseLayout);
    const blueprint = buildPipelineBlueprint(analysis, intent);

    expect(
      blueprint.lanes.some(
        (lane) =>
          lane.id.startsWith('lane:auxiliary:') &&
          lane.nodeIds.length >= 2
      )
    ).toBe(true);
    expect(blueprint.branchGroups).toHaveLength(2);
    expect(
      blueprint.edgePolicies.filter((policy) => policy.bundleKey !== 'spine').length
    ).toBeGreaterThanOrEqual(2);
  });
});
