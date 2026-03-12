export const PAPERDRAW_LOW_CONFIDENCE_THRESHOLD = 0.6;

export const PAPERDRAW_LAYOUT_DEFAULTS = {
  direction: 'LR' as const,
  nodeWidth: 220,
  nodeHeight: 72,
  nodeGapX: 96,
  nodeGapY: 88,
  moduleGapX: 140,
  moduleGapY: 112,
  modulePaddingX: 24,
  modulePaddingY: 24,
  moduleTitleHeight: 28,
  moduleGridThreshold: 4,
  moduleGridColumns: 2,
  optimizedModuleGapX: 180,
  optimizedGapPerCrossEdge: 36,
  routeLaneSpacing: 36,
  routeOuterMargin: 48,
  routeInnerMargin: 32,
};

export const PAPERDRAW_THEME = {
  nodeFill: '#ffffff',
  nodeStrokeColor: '#3b4a68',
  nodeStrokeWidth: 1.5,
  moduleFill: '#f5f8ff',
  moduleStrokeColor: '#a4b2d3',
  moduleStrokeWidth: 1,
  sequentialStrokeColor: '#3b4a68',
  annotativeStrokeColor: '#8b95a7',
  edgeStrokeWidth: 1.5,
};
