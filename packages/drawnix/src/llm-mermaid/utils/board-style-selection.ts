import type { PlaitBoard, PlaitElement } from '@plait/core';
import { PlaitDrawElement } from '@plait/draw';
import { MindElement } from '@plait/mind';
import type { SelectedElementsSummary } from '../types';

export interface ResolveBoardStyleSelectionOptions {
  includeConnectedLines?: boolean;
}

export interface BoardStyleSelectionResult {
  originalElements: PlaitElement[];
  targetElements: PlaitElement[];
  relatedLines: PlaitElement[];
  summary: SelectedElementsSummary;
}

export function resolveBoardStyleSelection(
  board: PlaitBoard | null,
  selectedElements: PlaitElement[],
  options: ResolveBoardStyleSelectionOptions = {}
): BoardStyleSelectionResult {
  const includeConnectedLines = options.includeConnectedLines ?? true;
  const originalElements = uniqueElements(selectedElements);
  const nodeIds = new Set(
    originalElements
      .filter((element) => !isLineElement(element))
      .map((element) => getElementId(element))
      .filter(Boolean)
  );
  const selectedLineIds = new Set(
    originalElements
      .filter((element) => isLineElement(element))
      .map((element) => getElementId(element))
      .filter(Boolean)
  );

  const relatedLines = includeConnectedLines && board
    ? flattenBoardElements(board.children).filter((element) => {
      if (!isLineElement(element)) {
        return false;
      }

      const elementId = getElementId(element);
      if (elementId && selectedLineIds.has(elementId)) {
        return false;
      }

      const endpoints = getLineEndpointIds(element);
      return !!endpoints.sourceId && !!endpoints.targetId
        && nodeIds.has(endpoints.sourceId)
        && nodeIds.has(endpoints.targetId);
    })
    : [];

  const targetElements = uniqueElements([...originalElements, ...relatedLines]);

  return {
    originalElements,
    targetElements,
    relatedLines,
    summary: summarizeBoardStyleSelection(
      board,
      targetElements,
      originalElements.length,
      relatedLines.length,
      includeConnectedLines
    ),
  };
}

export function summarizeBoardStyleSelection(
  board: PlaitBoard | null,
  elements: PlaitElement[],
  originalTotal: number,
  relatedLineCount: number,
  includeConnectedLines: boolean
): SelectedElementsSummary {
  const fills = new Set<string>();
  const strokes = new Set<string>();
  let shapeCount = 0;
  let lineCount = 0;
  let textCount = 0;

  elements.forEach((element) => {
    const rawElement = element as Record<string, unknown>;

    if (board && MindElement.isMindElement(board, element)) {
      shapeCount++;
    } else if (isLineElement(element)) {
      lineCount++;
    } else if (PlaitDrawElement.isText(element)) {
      textCount++;
    } else if (PlaitDrawElement.isShapeElement(element)) {
      shapeCount++;
    }

    if (typeof rawElement['fill'] === 'string' && rawElement['fill']) {
      fills.add(rawElement['fill']);
    }

    const strokeColor = getStrokeColor(rawElement);
    if (strokeColor) {
      strokes.add(strokeColor);
    }
  });

  return {
    total: elements.length,
    originalTotal,
    shapeCount,
    lineCount,
    textCount,
    relatedLineCount,
    includeConnectedLines,
    fills: Array.from(fills).slice(0, 4),
    strokes: Array.from(strokes).slice(0, 4),
  };
}

function flattenBoardElements(elements: PlaitElement[]): PlaitElement[] {
  return elements.flatMap((element) => {
    const childElements = Array.isArray((element as Record<string, unknown>)['children'])
      ? flattenBoardElements((element as Record<string, unknown>)['children'] as PlaitElement[])
      : [];

    return [element, ...childElements];
  });
}

function uniqueElements(elements: PlaitElement[]): PlaitElement[] {
  const seen = new Set<string>();

  return elements.filter((element) => {
    const id = getElementId(element);
    if (!id) {
      return true;
    }

    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

function getElementId(element: PlaitElement): string | null {
  const rawElement = element as Record<string, unknown>;
  return typeof rawElement['id'] === 'string' ? rawElement['id'] : null;
}

function isLineElement(element: PlaitElement) {
  return PlaitDrawElement.isArrowLine(element) || PlaitDrawElement.isVectorLine(element);
}

function getLineEndpointIds(element: PlaitElement): {
  sourceId: string | null;
  targetId: string | null;
} {
  const rawElement = element as Record<string, unknown>;
  const source = rawElement['source'] as Record<string, unknown> | undefined;
  const target = rawElement['target'] as Record<string, unknown> | undefined;

  return {
    sourceId: typeof source?.['boundId'] === 'string'
      ? (source['boundId'] as string)
      : typeof rawElement['sourceId'] === 'string'
      ? (rawElement['sourceId'] as string)
      : null,
    targetId: typeof target?.['boundId'] === 'string'
      ? (target['boundId'] as string)
      : typeof rawElement['targetId'] === 'string'
      ? (rawElement['targetId'] as string)
      : null,
  };
}

function getStrokeColor(rawElement: Record<string, unknown>): string | null {
  if (typeof rawElement['strokeColor'] === 'string' && rawElement['strokeColor']) {
    return rawElement['strokeColor'] as string;
  }

  if (typeof rawElement['stroke'] === 'string' && rawElement['stroke']) {
    return rawElement['stroke'] as string;
  }

  return null;
}
