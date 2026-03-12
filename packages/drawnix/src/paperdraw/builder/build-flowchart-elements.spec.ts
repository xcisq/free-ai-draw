jest.mock('@plait/draw', () => ({
  ArrowLineMarkerType: {
    none: 'none',
    arrow: 'arrow',
  },
  ArrowLineShape: {
    straight: 'straight',
    elbow: 'elbow',
  },
  BasicShapes: {
    rectangle: 'rectangle',
    roundRectangle: 'roundRectangle',
  },
  createArrowLineElement: (
    shape: string,
    points: [[number, number], [number, number]],
    source: { boundId: string; connection: [number, number]; marker: string },
    target: { boundId: string; connection: [number, number]; marker: string },
    texts?: unknown,
    options?: Record<string, unknown>
  ) => ({
    id: '',
    type: 'arrow-line',
    shape,
    points,
    source,
    target,
    texts: texts ?? [],
    opacity: 1,
    ...options,
  }),
  createGeometryElementWithText: (
    shape: string,
    points: [[number, number], [number, number]],
    text: string,
    options?: Record<string, unknown>
  ) => ({
    id: '',
    type: 'geometry',
    shape,
    points,
    text,
    ...options,
  }),
}));

import { buildFlowchartElements } from './build-flowchart-elements';
import { LayoutResult } from '../types/analyzer';

const baseLayout: LayoutResult = {
  direction: 'LR',
  groups: [],
  nodes: [
    {
      id: 'n1',
      label: '节点 1',
      x: 0,
      y: 0,
      width: 220,
      height: 72,
      weight: 0.8,
      confidence: 0.9,
    },
    {
      id: 'n2',
      label: '节点 2',
      x: 320,
      y: 0,
      width: 220,
      height: 72,
      weight: 0.7,
      confidence: 0.9,
    },
  ],
  edges: [],
};

describe('buildFlowchartElements', () => {
  it('builds elbow arrow lines with explicit side connections', () => {
    const layout: LayoutResult = {
      ...baseLayout,
      edges: [
        {
          id: 'edge-elbow',
          type: 'sequential',
          sourceId: 'n1',
          targetId: 'n2',
          shape: 'elbow',
          sourceConnection: [1, 0.35],
          targetConnection: [0, 0.65],
          points: [
            [220, 25.2],
            [320, 46.8],
          ],
        },
      ],
    };

    const elements = buildFlowchartElements(layout);
    const edge = elements.find((element) => element.id === 'edge-elbow') as any;

    expect(edge.type).toBe('arrow-line');
    expect(edge.shape).toBe('elbow');
    expect(edge.source.connection).toEqual([1, 0.35]);
    expect(edge.target.connection).toEqual([0, 0.65]);
  });

  it('keeps straight arrow lines when layout marks the edge as straight', () => {
    const layout: LayoutResult = {
      ...baseLayout,
      edges: [
        {
          id: 'edge-straight',
          type: 'annotative',
          sourceId: 'n1',
          targetId: 'n2',
          shape: 'straight',
          sourceConnection: [0.5, 1],
          targetConnection: [0.5, 0],
          points: [
            [110, 72],
            [430, 0],
          ],
        },
      ],
    };

    const elements = buildFlowchartElements(layout);
    const edge = elements.find((element) => element.id === 'edge-straight') as any;

    expect(edge.type).toBe('arrow-line');
    expect(edge.shape).toBe('straight');
    expect(edge.source.connection).toEqual([0.5, 1]);
    expect(edge.target.connection).toEqual([0.5, 0]);
  });
});
