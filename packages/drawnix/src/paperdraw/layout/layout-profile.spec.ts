import type { LayoutEdge, LayoutGroup, LayoutNode } from '../types/analyzer';
import { getLayoutProfileById, resolveLayoutProfile } from './layout-profile';

describe('layout-profile', () => {
  it('returns explicit profile when requested', () => {
    expect(getLayoutProfileById('single').id).toBe('single');
    expect(getLayoutProfileById('double').id).toBe('double');
  });

  it('chooses double profile when module count is high', () => {
    const nodes: LayoutNode[] = Array.from({ length: 4 }).map((_, index) => ({
      id: `n${index + 1}`,
      label: `N${index + 1}`,
      x: index * 100,
      y: 0,
      width: 220,
      height: 72,
      weight: 0.5,
      confidence: 0.8,
      moduleId: `m${index + 1}`,
    }));
    const groups: LayoutGroup[] = Array.from({ length: 4 }).map((_, index) => ({
      id: `m${index + 1}`,
      moduleLabel: `M${index + 1}`,
      entityIds: [`n${index + 1}`],
      x: index * 100,
      y: 0,
      width: 260,
      height: 120,
      order: index + 1,
    }));
    const edges: LayoutEdge[] = [
      {
        id: 'e1',
        type: 'sequential',
        sourceId: 'n1',
        targetId: 'n2',
        shape: 'elbow',
        sourceConnection: [1, 0.5],
        targetConnection: [0, 0.5],
        points: [[220, 36], [320, 36]],
      },
    ];

    expect(resolveLayoutProfile('auto', nodes, groups, edges).id).toBe('double');
  });

  it('chooses single profile for narrow deep structures', () => {
    const nodes: LayoutNode[] = [
      {
        id: 'n1',
        label: 'A',
        x: 0,
        y: 0,
        width: 220,
        height: 72,
        weight: 0.5,
        confidence: 0.8,
      },
      {
        id: 'n2',
        label: 'B',
        x: 0,
        y: 140,
        width: 220,
        height: 72,
        weight: 0.5,
        confidence: 0.8,
      },
    ];
    const groups: LayoutGroup[] = [];
    const edges: LayoutEdge[] = [
      {
        id: 'e1',
        type: 'sequential',
        sourceId: 'n1',
        targetId: 'n2',
        shape: 'elbow',
        sourceConnection: [0.5, 1],
        targetConnection: [0.5, 0],
        points: [[110, 72], [110, 140]],
      },
    ];

    expect(resolveLayoutProfile('auto', nodes, groups, edges).id).toBe('single');
  });
});
