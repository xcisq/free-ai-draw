import type { LayoutResult } from '../types/analyzer';
import { buildLayoutConstraintModel } from './constraint-model';
import { computeLayoutMetrics } from './layout-metrics';
import { routeLayoutOrthogonally } from './orthogonal-router';

describe('orthogonal-router', () => {
  it('reroutes edges so they do not pass through unrelated nodes', () => {
    const layout: LayoutResult = {
      direction: 'LR',
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
          id: 'c',
          label: 'C',
          x: 280,
          y: 0,
          width: 220,
          height: 72,
          weight: 0.8,
          confidence: 0.9,
        },
        {
          id: 'b',
          label: 'B',
          x: 620,
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
            [620, 36],
          ],
        },
      ],
    };
    const model = buildLayoutConstraintModel(layout, {
      mode: 'global',
      profile: 'double',
      quality: 'quality',
    });

    const routed = routeLayoutOrthogonally(layout, model);
    const metrics = computeLayoutMetrics(routed, model);

    expect(routed.edges[0].routing).toBeDefined();
    expect(routed.edges[0].routing!.length).toBeGreaterThan(2);
    expect(metrics.hardConstraintViolations).toBe(0);
  });

  it('treats unrelated modules as hard obstacles for cross-module edges', () => {
    const layout: LayoutResult = {
      direction: 'LR',
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
          id: 'c',
          label: 'C',
          moduleId: 'g-mid',
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
          moduleId: 'g2',
          x: 720,
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
          moduleLabel: '模块一',
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
          entityIds: ['c'],
          x: 280,
          y: -40,
          width: 300,
          height: 160,
          order: 2,
        },
        {
          id: 'g2',
          moduleLabel: '模块二',
          entityIds: ['b'],
          x: 680,
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
            [720, 36],
          ],
        },
      ],
    };
    const model = buildLayoutConstraintModel(layout, {
      mode: 'global',
      profile: 'double',
      quality: 'quality',
    });

    const routed = routeLayoutOrthogonally(layout, model);
    const metrics = computeLayoutMetrics(routed, model);

    expect(routed.edges[0].routing).toBeDefined();
    expect(metrics.hardConstraintViolations).toBe(0);
  });
});
