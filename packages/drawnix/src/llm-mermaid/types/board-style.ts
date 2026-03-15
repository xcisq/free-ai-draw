import type { StyleScheme } from './style';

export type BoardStyleSelector = '*' | 'shape' | 'line' | 'text';

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
}
