import { DEFAULT_FONT_SIZE, TextTransforms } from '@plait/text-plugins';
import {
  getElementById,
  PlaitBoard,
  PlaitElement,
  PlaitHistoryBoard,
  Transforms,
} from '@plait/core';
import {
  ArrowLineMarkerType,
  ArrowLineShape,
  PlaitDrawElement,
} from '@plait/draw';
import type { StrokeStyle } from '@plait/common';
import { MindElement } from '@plait/mind';
import type { BoardStyleScheme, ElementStyleMap } from '../types';

export type BoardStyleSnapshot = Record<
  string,
  Partial<{
    fill: string | null;
    strokeColor: string | null;
    strokeWidth: number | undefined;
    strokeStyle: StrokeStyle | undefined;
    opacity: number | undefined;
    shape: ArrowLineShape | undefined;
    sourceMarker: ArrowLineMarkerType | undefined;
    targetMarker: ArrowLineMarkerType | undefined;
  }>
>;

export function applyStyleToElements(
  board: PlaitBoard,
  elements: PlaitElement[],
  styleMap: ElementStyleMap,
  options: {
    saveToHistory?: boolean;
  } = {}
): void {
  if (elements.length === 0) {
    return;
  }

  const run = () => {
    const textStyle = resolveTextStyle(styleMap);
    if (textStyle.color) {
      TextTransforms.setTextColor(board, textStyle.color);
    }
    if (textStyle.fontSize) {
      TextTransforms.setFontSize(board, String(textStyle.fontSize) as any, DEFAULT_FONT_SIZE);
    }

    elements.forEach((element) => {
      const styleScheme = resolveStyleScheme(board, element, styleMap);
      if (!styleScheme) {
        return;
      }

      const patch = buildElementPatch(board, element, styleScheme);
      if (Object.keys(patch).length === 0) {
        return;
      }

      const path = PlaitBoard.findPath(board, element);
      Transforms.setNode(board, patch, path);
    });
  };

  if (options.saveToHistory === false) {
    PlaitHistoryBoard.withoutSaving(board, run);
    return;
  }

  run();
}

export function createStyleSnapshot(elements: PlaitElement[]): BoardStyleSnapshot {
  return elements.reduce<BoardStyleSnapshot>((snapshot, element) => {
    const rawElement = element as Record<string, unknown>;
    const elementId = typeof rawElement['id'] === 'string' ? rawElement['id'] : '';
    if (!elementId) {
      return snapshot;
    }

    snapshot[elementId] = {
      fill: (rawElement['fill'] as string | null | undefined) ?? null,
      strokeColor: (rawElement['strokeColor'] as string | null | undefined) ?? null,
      strokeWidth: rawElement['strokeWidth'] as number | undefined,
      strokeStyle: rawElement['strokeStyle'] as StrokeStyle | undefined,
      opacity: rawElement['opacity'] as number | undefined,
      shape: rawElement['shape'] as ArrowLineShape | undefined,
      sourceMarker: (rawElement['source'] as { marker?: ArrowLineMarkerType } | undefined)?.marker,
      targetMarker: (rawElement['target'] as { marker?: ArrowLineMarkerType } | undefined)?.marker,
    };

    return snapshot;
  }, {});
}

export function restoreStyleSnapshot(
  board: PlaitBoard,
  snapshot: BoardStyleSnapshot,
  options: {
    saveToHistory?: boolean;
  } = {}
): void {
  const run = () => {
    Object.entries(snapshot).forEach(([elementId, state]) => {
      const element = getElementById(board, elementId);
      if (!element) {
        return;
      }

      const path = PlaitBoard.findPath(board, element);
      const patch: Record<string, unknown> = {
        fill: state.fill ?? null,
        strokeColor: state.strokeColor ?? null,
        strokeWidth: state.strokeWidth,
        strokeStyle: state.strokeStyle,
        opacity: state.opacity,
      };

      if (PlaitDrawElement.isArrowLine(element)) {
        patch['shape'] = state.shape;
        patch['source'] = {
          ...element.source,
          marker: state.sourceMarker ?? element.source?.marker,
        };
        patch['target'] = {
          ...element.target,
          marker: state.targetMarker ?? element.target?.marker,
        };
      }

      Transforms.setNode(board, patch, path);
    });
  };

  if (options.saveToHistory === false) {
    PlaitHistoryBoard.withoutSaving(board, run);
    return;
  }

  run();
}

function resolveTextStyle(styleMap: ElementStyleMap): BoardStyleScheme {
  return mergeStyleSchemes(styleMap['*'], styleMap['text']);
}

function resolveStyleScheme(
  board: PlaitBoard,
  element: PlaitElement,
  styleMap: ElementStyleMap
): BoardStyleScheme {
  if (PlaitDrawElement.isArrowLine(element)) {
    return mergeStyleSchemes(styleMap['*'], styleMap['line']);
  }

  if (PlaitDrawElement.isText(element)) {
    return mergeStyleSchemes(styleMap['*'], styleMap['text']);
  }

  if (hasTextTarget(board, element)) {
    return mergeStyleSchemes(styleMap['*'], styleMap['shape']);
  }

  return mergeStyleSchemes(styleMap['*'], styleMap['shape']);
}

function buildElementPatch(
  board: PlaitBoard,
  element: PlaitElement,
  styleScheme: BoardStyleScheme
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (styleScheme.fill && supportsFill(board, element)) {
    patch['fill'] = styleScheme.fill;
  }
  if (styleScheme.stroke) {
    patch['strokeColor'] = styleScheme.stroke;
  }
  if (typeof styleScheme.strokeWidth === 'number') {
    patch['strokeWidth'] = styleScheme.strokeWidth;
  }
  if (styleScheme.strokeStyle) {
    patch['strokeStyle'] = mapStrokeStyle(styleScheme.strokeStyle);
  }
  if (typeof styleScheme.opacity === 'number') {
    patch['opacity'] = styleScheme.opacity;
  }

  if (PlaitDrawElement.isArrowLine(element)) {
    const nextShape = resolveSafeLineShape(element, styleScheme.lineShape);
    if (nextShape) {
      patch['shape'] = nextShape;
    }
    if (styleScheme.sourceMarker) {
      patch['source'] = {
        ...element.source,
        marker: mapArrowMarker(styleScheme.sourceMarker),
      };
    }
    if (styleScheme.targetMarker) {
      patch['target'] = {
        ...element.target,
        marker: mapArrowMarker(styleScheme.targetMarker),
      };
    }
  }

  return patch;
}

function supportsFill(board: PlaitBoard, element: PlaitElement) {
  if (MindElement.isMindElement(board, element)) {
    return true;
  }

  return (
    PlaitDrawElement.isShapeElement(element)
    && !PlaitDrawElement.isImage(element)
    && !PlaitDrawElement.isText(element)
  );
}

function hasTextTarget(board: PlaitBoard, element: PlaitElement) {
  if (MindElement.isMindElement(board, element)) {
    return true;
  }

  return (
    PlaitDrawElement.isText(element)
    || (
      PlaitDrawElement.isShapeElement(element)
      && !PlaitDrawElement.isImage(element)
    )
  );
}

function mergeStyleSchemes(
  base: BoardStyleScheme | undefined,
  override: BoardStyleScheme | undefined
): BoardStyleScheme {
  return {
    ...(base || {}),
    ...(override || {}),
  } as BoardStyleScheme;
}

function mapStrokeStyle(strokeStyle: BoardStyleScheme['strokeStyle']): StrokeStyle | undefined {
  if (strokeStyle === 'dashed') {
    return 'dashed' as StrokeStyle;
  }
  if (strokeStyle === 'dotted') {
    return 'dotted' as StrokeStyle;
  }
  if (strokeStyle === 'solid') {
    return 'solid' as StrokeStyle;
  }
  return undefined;
}

function resolveSafeLineShape(
  element: PlaitElement,
  lineShape: BoardStyleScheme['lineShape']
): ArrowLineShape | undefined {
  if (!PlaitDrawElement.isArrowLine(element) || !lineShape) {
    return undefined;
  }

  // AI 样式优化不切换到 curve，避免底层 points-on-curve 在异常控制点下递归炸栈。
  if (lineShape === 'elbow') {
    return ArrowLineShape.elbow;
  }
  if (lineShape === 'straight') {
    return ArrowLineShape.straight;
  }
  return undefined;
}

function mapArrowMarker(marker: BoardStyleScheme['sourceMarker']): ArrowLineMarkerType | undefined {
  switch (marker) {
    case 'none':
      return ArrowLineMarkerType.none;
    case 'open-triangle':
      return ArrowLineMarkerType.openTriangle;
    case 'solid-triangle':
      return ArrowLineMarkerType.solidTriangle;
    case 'sharp-arrow':
      return ArrowLineMarkerType.sharpArrow;
    case 'hollow-triangle':
      return ArrowLineMarkerType.hollowTriangle;
    case 'arrow':
      return ArrowLineMarkerType.arrow;
    default:
      return undefined;
  }
}
