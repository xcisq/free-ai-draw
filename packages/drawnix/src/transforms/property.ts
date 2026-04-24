import { PropertyTransforms } from '@plait/common';
import {
  getSelectedElements,
  isNullOrUndefined,
  Path,
  PlaitBoard,
  PlaitElement,
  RectangleClient,
  Transforms,
} from '@plait/core';
import { getMemorizeKey } from '@plait/draw';
import {
  BasicShapes,
  isDrawElementsIncludeText,
  PlaitDrawElement,
} from '@plait/draw';
import {
  applyOpacityToHex,
  hexAlphaToOpacity,
  isFullyOpaque,
  isNoColor,
  isValidColor,
  removeHexAlpha,
} from '../utils/color';
import { MindElement } from '@plait/mind';
import {
  getCurrentFill,
  getCurrentStrokeColor,
  isClosedElement,
} from '../utils/property';
import { DEFAULT_FONT_SIZE, TextTransforms } from '@plait/text-plugins';
import {
  buildTextFragmentDataUrl,
  isTextFragmentMetadata,
} from '../scene-import/text-fragment';
import {
  normalizeFontFamilyStack,
  resolveFontFamilyForRole,
  type FontRoleFamilyConfig,
} from '../constants/font';

export const setFillColorOpacity = (board: PlaitBoard, fillOpacity: number) => {
  PropertyTransforms.setFillColor(board, null, {
    getMemorizeKey,
    callback: (element: PlaitElement, path: Path) => {
      if (!isClosedElement(board, element)) {
        return;
      }
      const currentFill = getCurrentFill(board, element);
      if (!isValidColor(currentFill)) {
        return;
      }
      const currentFillColor = removeHexAlpha(currentFill);
      const newFill = isFullyOpaque(fillOpacity)
        ? currentFillColor
        : applyOpacityToHex(currentFillColor, fillOpacity);
      Transforms.setNode(board, { fill: newFill }, path);
    },
  });
};

export const setFillColor = (board: PlaitBoard, fillColor: string) => {
  PropertyTransforms.setFillColor(board, null, {
    getMemorizeKey,
    callback: (element: PlaitElement, path: Path) => {
      if (!isClosedElement(board, element)) {
        return;
      }
      const currentFill = getCurrentFill(board, element);
      const currentOpacity = hexAlphaToOpacity(currentFill);
      if (isNoColor(fillColor)) {
        Transforms.setNode(board, { fill: null }, path);
      } else {
        if (
          isNullOrUndefined(currentOpacity) ||
          isFullyOpaque(currentOpacity)
        ) {
          Transforms.setNode(board, { fill: fillColor }, path);
        } else {
          Transforms.setNode(
            board,
            { fill: applyOpacityToHex(fillColor, currentOpacity) },
            path
          );
        }
      }
    },
  });
};

export const setStrokeColorOpacity = (
  board: PlaitBoard,
  fillOpacity: number
) => {
  PropertyTransforms.setStrokeColor(board, null, {
    getMemorizeKey,
    callback: (element: PlaitElement, path: Path) => {
      const currentStrokeColor = getCurrentStrokeColor(board, element);
      const currentStrokeColorValue = removeHexAlpha(currentStrokeColor);
      const newStrokeColor = isFullyOpaque(fillOpacity)
        ? currentStrokeColorValue
        : applyOpacityToHex(currentStrokeColorValue, fillOpacity);
      Transforms.setNode(board, { strokeColor: newStrokeColor }, path);
    },
  });
};

export const setStrokeColor = (board: PlaitBoard, newColor: string) => {
  PropertyTransforms.setStrokeColor(board, null, {
    getMemorizeKey,
    callback: (element: PlaitElement, path: Path) => {
      const currentStrokeColor = getCurrentStrokeColor(board, element);
      const currentOpacity = hexAlphaToOpacity(currentStrokeColor);
      if (isNoColor(newColor)) {
        Transforms.setNode(board, { strokeColor: null }, path);
      } else {
        if (
          isNullOrUndefined(currentOpacity) ||
          isFullyOpaque(currentOpacity)
        ) {
          Transforms.setNode(board, { strokeColor: newColor }, path);
        } else {
          Transforms.setNode(
            board,
            { strokeColor: applyOpacityToHex(newColor, currentOpacity) },
            path
          );
        }
      }
    },
  });
};

export const setTextColor = (
  board: PlaitBoard,
  currentColor: string,
  newColor: string
) => {
  const currentOpacity = hexAlphaToOpacity(currentColor);
  if (isNoColor(newColor)) {
    TextTransforms.setTextColor(board, null);
  } else {
    TextTransforms.setTextColor(
      board,
      applyOpacityToHex(newColor, currentOpacity)
    );
  }
};

export const setTextColorOpacity = (
  board: PlaitBoard,
  currentColor: string,
  opacity: number
) => {
  const currentFontColorValue = removeHexAlpha(currentColor);
  const newFontColor = isFullyOpaque(opacity)
    ? currentFontColorValue
    : applyOpacityToHex(currentFontColorValue, opacity);
  TextTransforms.setTextColor(board, newFontColor);
};

export const setTextFontSize = (board: PlaitBoard, size: number) => {
  if (!Number.isFinite(size) || size <= 0) {
    return;
  }
  TextTransforms.setFontSize(board, String(size) as any, DEFAULT_FONT_SIZE);
};

const isRectangleCornerRadiusElement = (element: PlaitElement) => {
  if (!PlaitDrawElement.isDrawElement(element)) {
    return false;
  }
  const shape = (element as { shape?: string }).shape;
  return (
    shape === BasicShapes.rectangle || shape === BasicShapes.roundRectangle
  );
};

const getRectangleCornerRadiusLimit = (element: PlaitElement) => {
  const points = (element as { points?: [number, number][] }).points;
  if (!Array.isArray(points) || points.length === 0) {
    return 0;
  }
  const rectangle = RectangleClient.getRectangleByPoints(points);
  const width = Math.abs(rectangle.width || 0);
  const height = Math.abs(rectangle.height || 0);
  const limit = Math.min(width, height) / 2;
  return Number.isFinite(limit) && limit > 0 ? limit : 0;
};

export const setRectangleCornerRadius = (
  board: PlaitBoard,
  radius: number
) => {
  if (!Number.isFinite(radius)) {
    return;
  }

  getSelectedElements(board).forEach((element) => {
    if (!isRectangleCornerRadiusElement(element)) {
      return;
    }

    const path = PlaitBoard.findPath(board, element);
    const limit = getRectangleCornerRadiusLimit(element);
    const nextRadius = Math.min(limit, Math.max(0, radius));
    const nextShape =
      nextRadius > 0 ? BasicShapes.roundRectangle : BasicShapes.rectangle;

    Transforms.setNode(
      board,
      {
        shape: nextShape,
        radius: nextRadius,
      },
      path
    );
  });
};

type BoardElementEntry = {
  element: PlaitElement;
  path: Path;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
};

const collectBoardElementEntries = (
  elements: PlaitElement[],
  parentPath: Path = []
): BoardElementEntry[] => {
  return elements.flatMap((element, index) => {
    const path = [...parentPath, index];
    const children = Array.isArray((element as Record<string, unknown>)['children'])
      ? collectBoardElementEntries(
          (element as Record<string, unknown>)['children'] as PlaitElement[],
          path
        )
      : [];
    return [{ element, path }, ...children];
  });
};

const patchTextLeavesFontFamily = (value: unknown, fontFamily: string): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => patchTextLeavesFontFamily(item, fontFamily));
  }
  if (!isRecord(value)) {
    return value;
  }

  const next: Record<string, unknown> = { ...value };
  if (typeof next['text'] === 'string') {
    next['font-family'] = fontFamily;
    next['fontFamily'] = fontFamily;
    return next;
  }
  if (Array.isArray(next['children'])) {
    next['children'] = (next['children'] as unknown[]).map((child) =>
      patchTextLeavesFontFamily(child, fontFamily)
    );
  }
  return next;
};

const getElementTextRole = (element: PlaitElement) => {
  const rawElement = element as Record<string, unknown>;
  const svgImportMetadata = rawElement['svgImportMetadata'];
  if (
    isRecord(svgImportMetadata) &&
    typeof svgImportMetadata['textRole'] === 'string' &&
    svgImportMetadata['textRole'].trim()
  ) {
    return svgImportMetadata['textRole'] as string;
  }
  const fragmentMetadata = rawElement['sceneImportMetadata'];
  if (isTextFragmentMetadata(fragmentMetadata) && fragmentMetadata.textRole) {
    return fragmentMetadata.textRole;
  }
  return 'plain';
};

const buildTextStyleFontFamilyPatch = (
  existingTextStyle: Record<string, unknown>,
  fontFamily: string
) => {
  return {
    ...existingTextStyle,
    fontFamily,
    ['font-family']: fontFamily,
  };
};

const buildTextPropertiesFontFamilyPatch = (
  existingTextProperties: Record<string, unknown>,
  fontFamily: string
) => {
  return {
    ...existingTextProperties,
    fontFamily,
    ['font-family']: fontFamily,
  };
};

const applyFontFamilyPatch = (
  board: PlaitBoard,
  entry: BoardElementEntry,
  fontFamily: string
) => {
  const normalized = normalizeFontFamilyStack(fontFamily);
  if (!normalized) {
    return;
  }

  const rawElement = entry.element as Record<string, unknown>;
  const fragmentMetadata = rawElement['sceneImportMetadata'];
  if (isTextFragmentMetadata(fragmentMetadata)) {
    const nextMetadata = {
      ...fragmentMetadata,
      style: {
        ...fragmentMetadata.style,
        fontFamily: normalized,
      },
    };
    Transforms.setNode(
      board,
      {
        url: buildTextFragmentDataUrl(nextMetadata, {
          fontFamily: normalized,
        }),
        sceneImportMetadata: nextMetadata,
      },
      entry.path
    );
    return;
  }

  if (!supportsTextFontFamily(board, entry.element)) {
    return;
  }

  const existingTextStyle =
    rawElement['textStyle'] && typeof rawElement['textStyle'] === 'object'
      ? (rawElement['textStyle'] as Record<string, unknown>)
      : {};
  const patch: Record<string, unknown> = {
    textStyle: buildTextStyleFontFamilyPatch(existingTextStyle, normalized),
  };
  const existingTextProperties =
    rawElement['textProperties'] && typeof rawElement['textProperties'] === 'object'
      ? (rawElement['textProperties'] as Record<string, unknown>)
      : {};
  patch['textProperties'] = buildTextPropertiesFontFamilyPatch(
    existingTextProperties,
    normalized
  );

  if (rawElement['text']) {
    patch['text'] = patchTextLeavesFontFamily(rawElement['text'], normalized);
  }

  Transforms.setNode(board, patch, entry.path);
};

const applyFontFamilyToEntries = (
  board: PlaitBoard,
  entries: BoardElementEntry[],
  resolveFontFamily: (entry: BoardElementEntry) => string | undefined
) => {
  for (const entry of entries) {
    const fontFamily = resolveFontFamily(entry);
    if (!fontFamily) {
      continue;
    }
    applyFontFamilyPatch(board, entry, fontFamily);
  }
};

export const setTextFontFamily = (board: PlaitBoard, fontFamily: string) => {
  const normalized = fontFamily.trim();
  if (!normalized) {
    return;
  }

  const maybeSetFontFamily = (TextTransforms as any).setFontFamily;
  if (typeof maybeSetFontFamily === 'function') {
    maybeSetFontFamily(board, normalized);
  }

  const selectedIds = new Set(getSelectedElements(board).map((element) => element.id));
  const entries = collectBoardElementEntries(board.children).filter((entry) =>
    selectedIds.has(entry.element.id)
  );
  applyFontFamilyToEntries(board, entries, () => normalized);
};

export const applyFontSchemeToCanvas = (
  board: PlaitBoard,
  scheme: FontRoleFamilyConfig
) => {
  const entries = collectBoardElementEntries(board.children).filter((entry) => {
    const rawElement = entry.element as Record<string, unknown>;
    return (
      supportsTextFontFamily(board, entry.element) ||
      isTextFragmentMetadata(rawElement['sceneImportMetadata'])
    );
  });

  applyFontFamilyToEntries(board, entries, (entry) => {
    const textRole = getElementTextRole(entry.element);
    const configured =
      scheme[textRole as keyof FontRoleFamilyConfig] ||
      scheme.plain ||
      resolveFontFamilyForRole(textRole);
    return configured ? normalizeFontFamilyStack(configured) : undefined;
  });
};

const supportsTextFontFamily = (board: PlaitBoard, element: PlaitElement) => {
  if (MindElement.isMindElement(board, element)) {
    return true;
  }
  if (PlaitDrawElement.isDrawElement(element)) {
    return isDrawElementsIncludeText([element]);
  }
  const fragmentMetadata = (element as any)?.sceneImportMetadata;
  if (isTextFragmentMetadata(fragmentMetadata)) {
    return true;
  }
  return false;
};
