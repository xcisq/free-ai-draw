import type { LayoutResult } from '../types/analyzer';
import { buildLayoutConstraintModel } from './constraint-model';
import { generateLayoutCandidates } from './candidate-generator';

function createLayout(): LayoutResult {
  const nodes = Array.from({ length: 7 }).map((_, index) => {
    const id = `n${index + 1}`;
    const moduleId = index < 5 ? 'm1' : 'm2';
    return {
      id,
      label: id.toUpperCase(),
      moduleId,
      x: index * 60,
      y: 0,
      width: 220,
      height: 72,
      weight: 0.7,
      confidence: 0.85,
    };
  });

  return {
    direction: 'LR',
    nodes,
    groups: [
      {
        id: 'm1',
        moduleLabel: '模块一',
        entityIds: ['n1', 'n2', 'n3', 'n4', 'n5'],
        x: 0,
        y: 0,
        width: 520,
        height: 320,
        order: 1,
      },
      {
        id: 'm2',
        moduleLabel: '模块二',
        entityIds: ['n6', 'n7'],
        x: 620,
        y: 0,
        width: 320,
        height: 220,
        order: 2,
      },
    ],
    edges: [
      {
        id: 'e1',
        type: 'sequential',
        sourceId: 'n1',
        targetId: 'n2',
        shape: 'elbow',
        sourceConnection: [1, 0.5],
        targetConnection: [0, 0.5],
        points: [
          [220, 36],
          [280, 36],
        ],
      },
      {
        id: 'e2',
        type: 'sequential',
        sourceId: 'n2',
        targetId: 'n3',
        shape: 'elbow',
        sourceConnection: [1, 0.5],
        targetConnection: [0, 0.5],
        points: [
          [280, 36],
          [340, 36],
        ],
      },
      {
        id: 'e3',
        type: 'sequential',
        sourceId: 'n3',
        targetId: 'n6',
        shape: 'elbow',
        sourceConnection: [1, 0.5],
        targetConnection: [0, 0.5],
        points: [
          [340, 36],
          [620, 36],
        ],
      },
      {
        id: 'e4',
        type: 'annotative',
        sourceId: 'n4',
        targetId: 'n5',
        shape: 'elbow',
        sourceConnection: [1, 0.5],
        targetConnection: [0, 0.5],
        points: [
          [400, 36],
          [460, 36],
        ],
      },
    ],
  };
}

describe('candidate-generator', () => {
  it('generates multiple grammar variants for the optimizer', () => {
    const model = buildLayoutConstraintModel(createLayout(), {
      mode: 'global',
      profile: 'double',
      quality: 'quality',
    });

    const candidates = generateLayoutCandidates(model, 6);
    const grammars = new Set(candidates.map((candidate) => candidate.grammar));

    expect(candidates).toHaveLength(6);
    expect(grammars.has('H')).toBe(true);
    expect(grammars.has('COMPOSITE')).toBe(true);
    expect(grammars.has('D')).toBe(true);
  });

  it('switches large modules to a compact multi-column arrangement', () => {
    const model = buildLayoutConstraintModel(createLayout(), {
      mode: 'global',
      profile: 'double',
      quality: 'quality',
    });

    const [candidate] = generateLayoutCandidates(model, 1);
    const moduleNodes = candidate.layout.nodes.filter((node) => node.moduleId === 'm1');

    expect(Math.max(...moduleNodes.map((node) => node.column ?? 0))).toBeGreaterThan(0);
    expect(Math.max(...moduleNodes.map((node) => node.row ?? 0))).toBeGreaterThan(0);
  });
});
