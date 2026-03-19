import type { StyleScheme } from './style';

export type BoardNodeSemanticRole =
  | 'input'
  | 'process'
  | 'output'
  | 'decision'
  | 'annotation'
  | 'module';

export type BoardLineSemanticRole = 'main' | 'secondary';

export type BoardTextSemanticRole = 'title' | 'body';

export type BoardStyleSelector =
  | '*'
  | 'shape'
  | 'line'
  | 'text'
  | `node.${BoardNodeSemanticRole}`
  | 'node.grouped'
  | 'node.ungrouped'
  | `line.${BoardLineSemanticRole}`
  | `text.${BoardTextSemanticRole}`;

export type BoardStrokeStyle = 'solid' | 'dashed' | 'dotted';

export type BoardLineShape = 'straight' | 'elbow';

export type BoardArrowMarker =
  | 'arrow'
  | 'none'
  | 'open-triangle'
  | 'solid-triangle'
  | 'sharp-arrow'
  | 'hollow-triangle';

export interface BoardStyleScheme extends Partial<StyleScheme> {
  opacity?: number;
  strokeStyle?: BoardStrokeStyle;
  lineShape?: BoardLineShape;
  sourceMarker?: BoardArrowMarker;
  targetMarker?: BoardArrowMarker;
  shadowColor?: string;
  glow?: boolean;
  glowColor?: string;
  glowBlur?: number;
}

export type ElementStyleMap = Partial<Record<BoardStyleSelector, BoardStyleScheme>>;

export interface BoardStyleSchemeOption {
  id: string;
  name: string;
  description: string;
  styles: ElementStyleMap;
}

export interface BoardStyleSchemesResult {
  schemes: BoardStyleSchemeOption[];
  usedPrompt: string;
}

export interface SelectedElementsSummary {
  total: number;
  originalTotal: number;
  shapeCount: number;
  lineCount: number;
  textCount: number;
  relatedLineCount: number;
  includeConnectedLines: boolean;
  fills: string[];
  strokes: string[];
  fontSizes?: number[];
  semanticNodeCounts?: Partial<Record<BoardNodeSemanticRole, number>>;
  lineRoleCounts?: Partial<Record<BoardLineSemanticRole, number>>;
  textRoleCounts?: Partial<Record<BoardTextSemanticRole, number>>;
  groupedShapeCount?: number;
  ungroupedShapeCount?: number;
  moduleCount?: number;
  branchingNodeCount?: number;
  mergeNodeCount?: number;
  layoutBias?: 'horizontal' | 'vertical' | 'mixed' | 'unknown';
  roleLabelExamples?: Partial<Record<BoardNodeSemanticRole, string[]>>;
}
