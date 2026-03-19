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
import { createBoardStyleSemanticIndex } from './board-style-selection';

export type BoardStyleSnapshot = Record<
  string,
  Partial<{
    fill: string | null;
    strokeColor: string | null;
    strokeWidth: number | undefined;
    strokeStyle: StrokeStyle | undefined;
    opacity: number | undefined;
    textStyle: Record<string, unknown> | undefined;
    shadow: Record<string, unknown> | null | undefined;
    glow: Record<string, unknown> | null | undefined;
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
    const semanticIndex = createBoardStyleSemanticIndex(board, elements);

    elements.forEach((element) => {
      const metadata = semanticIndex.metadataByElement.get(element);
      const styleScheme = resolveStyleScheme(
        styleMap,
        metadata?.selectors || getFallbackSelectors(board, element)
      );
      const textStyle = resolveStyleScheme(
        styleMap,
        metadata?.textSelectors || getFallbackTextSelectors(board, element)
      );

      if (Object.keys(styleScheme).length === 0 && Object.keys(textStyle).length === 0) {
        return;
      }

      const patch = buildElementPatch(board, element, styleScheme, textStyle);
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
      textStyle: isRecord(rawElement['textStyle'])
        ? { ...(rawElement['textStyle'] as Record<string, unknown>) }
        : undefined,
      shadow: isRecord(rawElement['shadow'])
        ? { ...(rawElement['shadow'] as Record<string, unknown>) }
        : rawElement['shadow'] === null
        ? null
        : undefined,
      glow: isRecord(rawElement['glow'])
        ? { ...(rawElement['glow'] as Record<string, unknown>) }
        : rawElement['glow'] === null
        ? null
        : undefined,
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
        textStyle: state.textStyle,
        shadow: state.shadow ?? null,
        glow: state.glow ?? null,
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

function resolveStyleScheme(
  styleMap: ElementStyleMap,
  selectors: string[]
): BoardStyleScheme {
  return selectors.reduceRight<BoardStyleScheme>(
    (merged, selector) => mergeStyleSchemes(merged, styleMap[selector as keyof ElementStyleMap]),
    {}
  );
}

function buildElementPatch(
  board: PlaitBoard,
  element: PlaitElement,
  styleScheme: BoardStyleScheme,
  textStyle: BoardStyleScheme
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const rawElement = element as Record<string, unknown>;
  const effectiveTextStyle = mergeStyleSchemes(styleScheme, textStyle);

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

  if (hasTextTarget(board, element)) {
    const nextTextStyle = buildTextStylePatch(rawElement, effectiveTextStyle);
    if (nextTextStyle) {
      patch['textStyle'] = nextTextStyle;
    }
  }

  const shadowPatch = buildShadowPatch(styleScheme);
  if (shadowPatch !== undefined) {
    patch['shadow'] = shadowPatch;
  }

  const glowPatch = buildGlowPatch(styleScheme);
  if (glowPatch !== undefined) {
    patch['glow'] = glowPatch;
    if (!shadowPatch && glowPatch) {
      patch['shadow'] = {
        color: glowPatch['color'],
        blur: glowPatch['blur'],
      };
      if (typeof styleScheme.strokeWidth !== 'number') {
        const currentStrokeWidth = typeof rawElement['strokeWidth'] === 'number'
          ? (rawElement['strokeWidth'] as number)
          : 1;
        patch['strokeWidth'] = Math.max(currentStrokeWidth, 2);
      }
      if (!styleScheme.stroke && typeof glowPatch['color'] === 'string') {
        patch['strokeColor'] = glowPatch['color'];
      }
    }
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

function buildTextStylePatch(
  rawElement: Record<string, unknown>,
  styleScheme: BoardStyleScheme
): Record<string, unknown> | null {
  const existingTextStyle = isRecord(rawElement['textStyle'])
    ? (rawElement['textStyle'] as Record<string, unknown>)
    : {};
  const nextTextStyle: Record<string, unknown> = {};

  if (styleScheme.color) {
    nextTextStyle['color'] = styleScheme.color;
  }
  if (typeof styleScheme.fontSize === 'number') {
    nextTextStyle['fontSize'] = styleScheme.fontSize;
  }
  if (typeof styleScheme.fontWeight === 'number') {
    nextTextStyle['fontWeight'] = styleScheme.fontWeight;
  }

  return Object.keys(nextTextStyle).length > 0
    ? {
      ...existingTextStyle,
      ...nextTextStyle,
    }
    : null;
}

function buildShadowPatch(styleScheme: BoardStyleScheme): Record<string, unknown> | null | undefined {
  if (typeof styleScheme.shadow !== 'boolean') {
    return undefined;
  }

  if (!styleScheme.shadow) {
    return null;
  }

  return {
    color: styleScheme.shadowColor || styleScheme.stroke || 'rgba(15, 23, 42, 0.18)',
    blur: styleScheme.shadowBlur || 10,
  };
}

function buildGlowPatch(styleScheme: BoardStyleScheme): Record<string, unknown> | null | undefined {
  if (typeof styleScheme.glow !== 'boolean') {
    return undefined;
  }

  if (!styleScheme.glow) {
    return null;
  }

  return {
    color: styleScheme.glowColor || styleScheme.stroke || styleScheme.fill || '#3b82f6',
    blur: styleScheme.glowBlur || Math.max(styleScheme.shadowBlur || 10, 12),
  };
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

function getFallbackSelectors(board: PlaitBoard, element: PlaitElement): string[] {
  if (PlaitDrawElement.isArrowLine(element)) {
    return ['line', '*'];
  }

  if (PlaitDrawElement.isText(element)) {
    return ['text', '*'];
  }

  if (hasTextTarget(board, element)) {
    return ['shape', '*'];
  }

  return ['shape', '*'];
}

function getFallbackTextSelectors(board: PlaitBoard, element: PlaitElement): string[] {
  if (PlaitDrawElement.isText(element)) {
    return ['text', '*'];
  }

  if (hasTextTarget(board, element)) {
    return ['text.body', 'text', '*'];
  }

  return ['*'];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
