import { memorizeLatest } from '@plait/common';
import type { PlaitBoard } from '@plait/core';
import { MemorizeKey } from '@plait/draw';

export const DEFAULT_DRAW_STROKE_COLOR = '#000000';

export const DEFAULT_DRAW_MEMORIZE_KEYS = [
  MemorizeKey.basicShape,
  MemorizeKey.flowchart,
  MemorizeKey.UML,
  MemorizeKey.arrowLine,
] as const;

export const applyDefaultDrawStrokeColor = (
  strokeColor: string = DEFAULT_DRAW_STROKE_COLOR
) => {
  DEFAULT_DRAW_MEMORIZE_KEYS.forEach((memorizeKey) => {
    memorizeLatest(memorizeKey, 'strokeColor', strokeColor);
  });
};

export const withDefaultDrawStyle = (board: PlaitBoard) => {
  applyDefaultDrawStrokeColor();
  return board;
};
