import type { LayoutIntent, LayoutResult, PipelineBlueprint } from '../types/analyzer';
import { buildLayoutConstraintModel } from './constraint-model';
import { computeLayoutMetrics } from './layout-metrics';
import { routePipelineLayoutV3 } from './pipeline-router-v3';

function createIntent(
  layout: LayoutResult,
  options: {
    dominantSpine?: string[];
    edgeRoles?: Record<string, LayoutIntent['edges'][number]['role']>;
    feedbackEdges?: string[];
    mergeNodes?: string[];
    mergeClusters?: LayoutIntent['mergeClusters'];
    nodeRails?: Record<string, LayoutIntent['nodes'][number]['preferredRail']>;
  } = {}
): LayoutIntent {
  const dominantSpine = options.dominantSpine ?? layout.nodes.map((node) => node.id);
  return {
    nodes: layout.nodes.map((node) => ({
      id: node.id,
      role: 'process',
      primitive: 'block',
      importance: node.weight,
      moduleId: node.moduleId,
      preferredRail: options.nodeRails?.[node.id] ?? 'main_rail',
      isMainSpineCandidate: true,
    })),
    edges: layout.edges.map((edge) => ({
      id: edge.id,
      role: options.edgeRoles?.[edge.id] ?? 'main',
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      priority: 1,
    })),
    modules: layout.groups.map((group) => ({
      id: group.id,
      role: 'core_stage',
      preferredRail: 'main_rail',
      members: [...group.entityIds],
    })),
    dominantSpine,
    spineSegments: [dominantSpine],
    branchRoots: [],
    branchAttachments: [],
    mergeNodes: options.mergeNodes ?? [],
    mergeClusters: options.mergeClusters ?? [],
    feedbackEdges: options.feedbackEdges ?? [],
    statePairs: [],
    inputContainers: [],
    zoneScores: {
      inputZoneScore: 0,
      controlZoneScore: 0,
      auxZoneScore: 0,
      outputZoneScore: 0,
    },
    layoutHints: [],
  };
}

function createBlueprint(
  partial: Partial<PipelineBlueprint> = {}
): PipelineBlueprint {
  return {
    lanes: [],
    spineNodeIds: [],
    branchGroups: [],
    mergeGroups: [],
    feedbackLoops: [],
    edgePolicies: [],
    layoutHints: [],
    zoneScores: {
      inputZoneScore: 0,
      controlZoneScore: 0,
      auxZoneScore: 0,
      outputZoneScore: 0,
    },
    ...partial,
  };
}

describe('pipeline-router-v3', () => {
  it('routes spine edges around unrelated nodes without node crossings', () => {
    const layout: LayoutResult = {
      direction: 'LR',
      templateId: 'linear-spine',
      engine: 'pipeline_v1',
      nodes: [
        {
          id: 'a',
          label: 'A',
          x: 0,
          y: 0,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
        {
          id: 'blocker',
          label: 'Blocker',
          x: 320,
          y: 0,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
        {
          id: 'b',
          label: 'B',
          x: 720,
          y: 0,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
      ],
      groups: [],
      edges: [
        {
          id: 'ab',
          type: 'sequential',
          sourceId: 'a',
          targetId: 'b',
          shape: 'straight',
          sourceConnection: [1, 0.5],
          targetConnection: [0, 0.5],
          points: [
            [220, 36],
            [720, 36],
          ],
        },
      ],
    };
    const intent = createIntent(layout, {
      dominantSpine: ['a', 'b'],
    });
    const model = buildLayoutConstraintModel(layout, {
      mode: 'global',
      engine: 'pipeline_v1',
      profile: 'double',
      quality: 'quality',
    });

    const routed = routePipelineLayoutV3(layout, model, intent, {
      templateId: 'linear-spine',
    });
    const metrics = computeLayoutMetrics(routed, model);

    expect(routed.routingEngine).toBe('pipeline_v3');
    expect(routed.edges[0].routing).toBeDefined();
    expect(metrics.nodeCrossings).toBe(0);
  });

  it('keeps cross-module spine edges out of unrelated modules', () => {
    const layout: LayoutResult = {
      direction: 'LR',
      templateId: 'input-core-output',
      engine: 'pipeline_v1',
      nodes: [
        {
          id: 'a',
          label: 'A',
          moduleId: 'g1',
          x: 0,
          y: 0,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
        {
          id: 'm',
          label: 'Middle',
          moduleId: 'g-mid',
          x: 360,
          y: 0,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
        {
          id: 'b',
          label: 'B',
          moduleId: 'g2',
          x: 860,
          y: 0,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
      ],
      groups: [
        {
          id: 'g1',
          moduleLabel: '输入模块',
          entityIds: ['a'],
          x: -40,
          y: -40,
          width: 300,
          height: 160,
          order: 1,
        },
        {
          id: 'g-mid',
          moduleLabel: '中间模块',
          entityIds: ['m'],
          x: 320,
          y: -40,
          width: 300,
          height: 160,
          order: 2,
        },
        {
          id: 'g2',
          moduleLabel: '输出模块',
          entityIds: ['b'],
          x: 820,
          y: -40,
          width: 300,
          height: 160,
          order: 3,
        },
      ],
      edges: [
        {
          id: 'ab',
          type: 'sequential',
          sourceId: 'a',
          targetId: 'b',
          shape: 'straight',
          sourceConnection: [1, 0.5],
          targetConnection: [0, 0.5],
          points: [
            [220, 36],
            [860, 36],
          ],
        },
      ],
    };
    const intent = createIntent(layout, {
      dominantSpine: ['a', 'b'],
    });
    const model = buildLayoutConstraintModel(layout, {
      mode: 'global',
      engine: 'pipeline_v1',
      profile: 'double',
      quality: 'quality',
    });

    const routed = routePipelineLayoutV3(layout, model, intent, {
      templateId: 'input-core-output',
    });
    const metrics = computeLayoutMetrics(routed, model);

    expect(routed.edges[0].routing).toBeDefined();
    expect(metrics.moduleCrossings).toBe(0);
  });

  it('spreads multiple outgoing edges across distinct side ports', () => {
    const layout: LayoutResult = {
      direction: 'LR',
      templateId: 'linear-spine',
      engine: 'pipeline_v1',
      nodes: [
        {
          id: 'a',
          label: 'Source',
          x: 0,
          y: 120,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
        {
          id: 'b',
          label: 'Main',
          x: 420,
          y: 120,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
        {
          id: 'c',
          label: 'Branch',
          x: 420,
          y: 320,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
      ],
      groups: [],
      edges: [
        {
          id: 'ab',
          type: 'sequential',
          sourceId: 'a',
          targetId: 'b',
          shape: 'straight',
          sourceConnection: [1, 0.5],
          targetConnection: [0, 0.5],
          points: [
            [220, 156],
            [420, 156],
          ],
        },
        {
          id: 'ac',
          type: 'sequential',
          sourceId: 'a',
          targetId: 'c',
          shape: 'straight',
          sourceConnection: [1, 0.5],
          targetConnection: [0, 0.5],
          points: [
            [220, 156],
            [420, 356],
          ],
        },
      ],
    };
    const intent = createIntent(layout, {
      dominantSpine: ['a', 'b'],
    });
    const model = buildLayoutConstraintModel(layout, {
      mode: 'global',
      engine: 'pipeline_v1',
      profile: 'double',
      quality: 'quality',
    });

    const routed = routePipelineLayoutV3(layout, model, intent, {
      templateId: 'linear-spine',
    });
    const mainEdge = routed.edges.find((edge) => edge.id === 'ab')!;
    const branchEdge = routed.edges.find((edge) => edge.id === 'ac')!;

    expect(mainEdge.sourceConnection[0]).toBe(1);
    expect(branchEdge.sourceConnection[0]).toBe(1);
    expect(mainEdge.sourceConnection[1]).toBe(0.18);
    expect(branchEdge.sourceConnection[1]).toBe(0.34);
    expect(mainEdge.points[0][1]).not.toBe(branchEdge.points[0][1]);
  });

  it('prefers the outer feedback corridor for feedback edges', () => {
    const layout: LayoutResult = {
      direction: 'LR',
      templateId: 'outer-feedback-loop',
      engine: 'pipeline_v1',
      nodes: [
        {
          id: 'a',
          label: 'Start',
          x: 0,
          y: 120,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
        {
          id: 'b',
          label: 'Middle',
          x: 360,
          y: 120,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
        {
          id: 'c',
          label: 'Output',
          x: 760,
          y: 120,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
      ],
      groups: [],
      edges: [
        {
          id: 'ab',
          type: 'sequential',
          sourceId: 'a',
          targetId: 'b',
          shape: 'straight',
          sourceConnection: [1, 0.5],
          targetConnection: [0, 0.5],
          points: [
            [220, 156],
            [360, 156],
          ],
        },
        {
          id: 'bc',
          type: 'sequential',
          sourceId: 'b',
          targetId: 'c',
          shape: 'straight',
          sourceConnection: [1, 0.5],
          targetConnection: [0, 0.5],
          points: [
            [580, 156],
            [760, 156],
          ],
        },
        {
          id: 'fb',
          type: 'sequential',
          sourceId: 'c',
          targetId: 'a',
          shape: 'straight',
          sourceConnection: [1, 0.5],
          targetConnection: [0, 0.5],
          points: [
            [980, 156],
            [0, 156],
          ],
        },
      ],
    };
    const intent = createIntent(layout, {
      dominantSpine: ['a', 'b', 'c'],
      edgeRoles: {
        ab: 'main',
        bc: 'main',
        fb: 'feedback',
      },
      feedbackEdges: ['fb'],
      nodeRails: {
        a: 'main_rail',
        b: 'main_rail',
        c: 'right_output_rail',
      },
    });
    const model = buildLayoutConstraintModel(layout, {
      mode: 'global',
      engine: 'pipeline_v1',
      profile: 'double',
      quality: 'quality',
    });

    const routed = routePipelineLayoutV3(layout, model, intent, {
      templateId: 'outer-feedback-loop',
    });
    const feedbackRoute = routed.edges.find((edge) => edge.id === 'fb')!.routing!;
    const maxX = Math.max(...layout.nodes.map((node) => node.x + node.width));
    const minY = Math.min(...layout.nodes.map((node) => node.y));

    expect(feedbackRoute.length).toBeGreaterThan(2);
    expect(
      feedbackRoute.some((point) => point[0] > maxX || point[1] < minY)
    ).toBe(true);
  });

  it('bundles merge edges through a shared merge bus before the target', () => {
    const layout: LayoutResult = {
      direction: 'LR',
      templateId: 'split-merge',
      engine: 'pipeline_v1',
      nodes: [
        {
          id: 'a',
          label: 'Branch A',
          x: 0,
          y: 20,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
        {
          id: 'b',
          label: 'Branch B',
          x: 0,
          y: 300,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
        {
          id: 'm',
          label: 'Merge',
          x: 620,
          y: 160,
          width: 220,
          height: 72,
          weight: 0.9,
          confidence: 0.92,
        },
        {
          id: 'o',
          label: 'Output',
          x: 1040,
          y: 160,
          width: 220,
          height: 72,
          weight: 0.88,
          confidence: 0.9,
        },
      ],
      groups: [],
      edges: [
        {
          id: 'am',
          type: 'sequential',
          sourceId: 'a',
          targetId: 'm',
          shape: 'straight',
          sourceConnection: [1, 0.5],
          targetConnection: [0, 0.5],
          points: [
            [220, 56],
            [620, 196],
          ],
        },
        {
          id: 'bm',
          type: 'sequential',
          sourceId: 'b',
          targetId: 'm',
          shape: 'straight',
          sourceConnection: [1, 0.5],
          targetConnection: [0, 0.5],
          points: [
            [220, 336],
            [620, 196],
          ],
        },
        {
          id: 'mo',
          type: 'sequential',
          sourceId: 'm',
          targetId: 'o',
          shape: 'straight',
          sourceConnection: [1, 0.5],
          targetConnection: [0, 0.5],
          points: [
            [840, 196],
            [1040, 196],
          ],
        },
      ],
    };
    const intent = createIntent(layout, {
      dominantSpine: ['a', 'm', 'o'],
      mergeNodes: ['m'],
      mergeClusters: [
        {
          mergeNodeId: 'm',
          sourceIds: ['a', 'b'],
        },
      ],
      edgeRoles: {
        am: 'main',
        bm: 'auxiliary',
        mo: 'main',
      },
    });
    const model = buildLayoutConstraintModel(layout, {
      mode: 'global',
      engine: 'pipeline_v1',
      profile: 'double',
      quality: 'quality',
    });

    const routed = routePipelineLayoutV3(layout, model, intent, {
      templateId: 'split-merge',
    });
    const mergeA = routed.edges.find((edge) => edge.id === 'am')!.routing!;
    const mergeB = routed.edges.find((edge) => edge.id === 'bm')!.routing!;

    const getVerticalBusXs = (points: number[][]) =>
      points
        .slice(0, -1)
        .flatMap((point, index) => {
          const next = points[index + 1];
          if (!next || point[0] !== next[0]) {
            return [];
          }
          return [point[0]];
        });

    const mergeABusXs = getVerticalBusXs(mergeA as number[][]);
    const mergeBBusXs = getVerticalBusXs(mergeB as number[][]);
    const sharedBusXs = mergeABusXs.filter((x) => mergeBBusXs.includes(x));

    expect(sharedBusXs.length).toBeGreaterThan(0);
  });

  it('uses blueprint edge policy to treat merge bundles as merge routes', () => {
    const layout: LayoutResult = {
      direction: 'LR',
      templateId: 'split-merge',
      engine: 'pipeline_v1',
      nodes: [
        {
          id: 'a',
          label: 'Branch A',
          x: 0,
          y: 20,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
        {
          id: 'b',
          label: 'Branch B',
          x: 0,
          y: 300,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
        {
          id: 'm',
          label: 'Merge',
          x: 620,
          y: 160,
          width: 220,
          height: 72,
          weight: 0.9,
          confidence: 0.92,
        },
      ],
      groups: [],
      edges: [
        {
          id: 'am',
          type: 'sequential',
          sourceId: 'a',
          targetId: 'm',
          shape: 'straight',
          sourceConnection: [1, 0.5],
          targetConnection: [0, 0.5],
          points: [
            [220, 56],
            [620, 196],
          ],
        },
        {
          id: 'bm',
          type: 'sequential',
          sourceId: 'b',
          targetId: 'm',
          shape: 'straight',
          sourceConnection: [1, 0.5],
          targetConnection: [0, 0.5],
          points: [
            [220, 336],
            [620, 196],
          ],
        },
      ],
    };
    const intent = createIntent(layout, {
      dominantSpine: ['a', 'm'],
      edgeRoles: {
        am: 'main',
        bm: 'main',
      },
    });
    const blueprint = createBlueprint({
      spineNodeIds: ['a', 'm'],
      mergeGroups: [
        {
          mergeNodeId: 'm',
          sourceIds: ['a', 'b'],
          bundleKey: 'merge:m',
        },
      ],
      edgePolicies: [
        {
          edgeId: 'am',
          role: 'main',
          priority: 1,
          routeLane: 'auxiliary',
          bundleKey: 'merge:m',
        },
        {
          edgeId: 'bm',
          role: 'auxiliary',
          priority: 0.9,
          routeLane: 'auxiliary',
          bundleKey: 'merge:m',
        },
      ],
    });
    const model = buildLayoutConstraintModel(layout, {
      mode: 'global',
      engine: 'pipeline_v1',
      profile: 'double',
      quality: 'quality',
    });

    const routedWithoutBlueprint = routePipelineLayoutV3(layout, model, intent, {
      templateId: 'split-merge',
    });
    const routed = routePipelineLayoutV3(layout, model, intent, {
      templateId: 'split-merge',
      blueprint,
    });
    const mergeBWithoutBlueprint = routedWithoutBlueprint.edges.find((edge) => edge.id === 'bm')!;
    const mergeA = routed.edges.find((edge) => edge.id === 'am')!;
    const mergeB = routed.edges.find((edge) => edge.id === 'bm')!;

    expect(mergeA.targetConnection[0]).toBe(0);
    expect(mergeB.targetConnection[0]).toBe(0);
    expect(mergeBWithoutBlueprint.targetConnection[0]).not.toBe(0);
    expect(mergeB.points[0][0]).toBeGreaterThan(mergeBWithoutBlueprint.points[0][0]);
  });

  it('stabilizes distinct auxiliary bundles onto different guide rows', () => {
    const layout: LayoutResult = {
      direction: 'LR',
      templateId: 'top-control-main-bottom-aux',
      engine: 'pipeline_v1',
      nodes: [
        {
          id: 'm1',
          label: 'Main 1',
          x: 320,
          y: 160,
          width: 220,
          height: 72,
          weight: 0.88,
          confidence: 0.9,
        },
        {
          id: 'm2',
          label: 'Main 2',
          x: 760,
          y: 160,
          width: 220,
          height: 72,
          weight: 0.88,
          confidence: 0.9,
        },
        {
          id: 'a1',
          label: 'Aux 1',
          x: 320,
          y: 420,
          width: 220,
          height: 72,
          weight: 0.7,
          confidence: 0.86,
        },
        {
          id: 'a2',
          label: 'Aux 2',
          x: 760,
          y: 420,
          width: 220,
          height: 72,
          weight: 0.7,
          confidence: 0.86,
        },
      ],
      groups: [],
      edges: [
        {
          id: 'm1m2',
          type: 'sequential',
          sourceId: 'm1',
          targetId: 'm2',
          shape: 'straight',
          sourceConnection: [1, 0.5],
          targetConnection: [0, 0.5],
          points: [
            [540, 196],
            [760, 196],
          ],
        },
        {
          id: 'a1m1',
          type: 'sequential',
          sourceId: 'a1',
          targetId: 'm2',
          shape: 'straight',
          sourceConnection: [0.5, 0],
          targetConnection: [0.5, 1],
          points: [
            [430, 420],
            [870, 232],
          ],
        },
        {
          id: 'a2m2',
          type: 'sequential',
          sourceId: 'a2',
          targetId: 'm1',
          shape: 'straight',
          sourceConnection: [0.5, 0],
          targetConnection: [0.5, 1],
          points: [
            [870, 420],
            [430, 232],
          ],
        },
      ],
    };
    const intent = createIntent(layout, {
      dominantSpine: ['m1', 'm2'],
      edgeRoles: {
        m1m2: 'main',
        a1m1: 'auxiliary',
        a2m2: 'auxiliary',
      },
    });
    const blueprint = createBlueprint({
      spineNodeIds: ['m1', 'm2'],
      lanes: [
        {
          id: 'lane:main',
          kind: 'main',
          nodeIds: ['m1', 'm2'],
          moduleIds: [],
        },
        {
          id: 'lane:auxiliary:a1',
          kind: 'auxiliary',
          nodeIds: ['a1'],
          moduleIds: [],
        },
        {
          id: 'lane:auxiliary:a2',
          kind: 'auxiliary',
          nodeIds: ['a2'],
          moduleIds: [],
        },
      ],
      edgePolicies: [
        {
          edgeId: 'm1m2',
          role: 'main',
          priority: 1,
          routeLane: 'main',
          bundleKey: 'spine',
        },
        {
          edgeId: 'a1m1',
          role: 'auxiliary',
          priority: 0.68,
          routeLane: 'auxiliary',
          bundleKey: 'lane:auxiliary:a1',
        },
        {
          edgeId: 'a2m2',
          role: 'auxiliary',
          priority: 0.68,
          routeLane: 'auxiliary',
          bundleKey: 'lane:auxiliary:a2',
        },
      ],
    });
    const model = buildLayoutConstraintModel(layout, {
      mode: 'global',
      engine: 'pipeline_v1',
      profile: 'double',
      quality: 'quality',
    });

    const routed = routePipelineLayoutV3(layout, model, intent, {
      templateId: 'top-control-main-bottom-aux',
      blueprint,
    });
    const aux1 = routed.edges.find((edge) => edge.id === 'a1m1')!;
    const aux2 = routed.edges.find((edge) => edge.id === 'a2m2')!;
    const getHorizontalRows = (points: number[][]) =>
      points
        .slice(0, -1)
        .flatMap((point, index) => {
          const next = points[index + 1];
          if (!next || point[1] !== next[1]) {
            return [];
          }
          return [point[1]];
        })
        .filter((value) => value !== 196);

    const aux1Rows = getHorizontalRows((aux1.routing ?? aux1.points) as number[][]);
    const aux2Rows = getHorizontalRows((aux2.routing ?? aux2.points) as number[][]);

    expect(aux1Rows.length).toBeGreaterThan(0);
    expect(aux2Rows.length).toBeGreaterThan(0);
    expect(aux1Rows[0]).not.toBe(aux2Rows[0]);
  });
});
