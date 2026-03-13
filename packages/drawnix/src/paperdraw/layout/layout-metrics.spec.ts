import type { LayoutResult } from '../types/analyzer';
import { buildLayoutConstraintModel } from './constraint-model';
import { computeLayoutMetrics, withLayoutMetrics } from './layout-metrics';

function createLayout(nodeBX: number): LayoutResult {
  return {
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
        id: 'b',
        label: 'B',
        x: nodeBX,
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
          [nodeBX, 36],
        ],
      },
    ],
  };
}

describe('layout-metrics', () => {
  it('gives sparse layouts a higher blank-space penalty', () => {
    const compactLayout = createLayout(280);
    const sparseLayout = createLayout(640);
    const compactModel = buildLayoutConstraintModel(compactLayout, {
      mode: 'global',
      profile: 'double',
      quality: 'quality',
    });
    const sparseModel = buildLayoutConstraintModel(sparseLayout, {
      mode: 'global',
      profile: 'double',
      quality: 'quality',
    });

    const compactMetrics = computeLayoutMetrics(compactLayout, compactModel);
    const sparseMetrics = computeLayoutMetrics(sparseLayout, sparseModel);

    expect(sparseMetrics.blankSpaceScore).toBeGreaterThan(compactMetrics.blankSpaceScore);
  });

  it('counts edge penetration through unrelated nodes as a hard violation', () => {
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
          x: 300,
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

    const metrics = computeLayoutMetrics(layout, model);

    expect(metrics.hardConstraintViolations).toBeGreaterThan(0);
  });

  it('attaches computed metrics to the layout result', () => {
    const layout = createLayout(320);
    const model = buildLayoutConstraintModel(layout, {
      mode: 'global',
      profile: 'double',
      quality: 'quality',
    });

    const withMetricsLayout = withLayoutMetrics(layout, model);

    expect(withMetricsLayout.metrics).toBeDefined();
    expect(withMetricsLayout.metrics!.totalScore).toBeGreaterThanOrEqual(0);
  });
});
