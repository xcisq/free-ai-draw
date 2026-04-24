import { getElementOfFocusedImage } from '@plait/common';
import {
  getSelectedElements,
  PlaitBoard,
  PlaitElement,
  PlaitHistoryBoard,
  Point,
  Transforms,
} from '@plait/core';
import { PlaitDrawElement } from '@plait/draw';

export type DrawnixImageEraseStroke = {
  points: Point[];
  radius: number;
};

export type DrawnixImageEraseMask = {
  version: 1;
  strokes: DrawnixImageEraseStroke[];
};

export type DrawnixImageElement = PlaitElement & {
  id: string;
  url: string;
  points: [Point, Point];
  angle?: number;
  eraseMask?: DrawnixImageEraseMask;
  children?: PlaitElement[];
};

const RASTER_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const RASTER_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

export const isEditableRasterImageUrl = (value: string | null | undefined) => {
  if (!value) {
    return false;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return false;
  }

  const dataUrlMatch = trimmedValue.match(/^data:([^;,]+)[;,]/i);
  if (dataUrlMatch) {
    return RASTER_IMAGE_MIME_TYPES.has(dataUrlMatch[1].toLowerCase());
  }

  const normalizedValue = trimmedValue.split('#')[0].split('?')[0];
  const extensionMatch = normalizedValue.match(/\.([a-z0-9]+)$/i);
  if (!extensionMatch) {
    return false;
  }

  return RASTER_IMAGE_EXTENSIONS.has(extensionMatch[1].toLowerCase());
};

export const isEditableRasterImageElement = (
  value: PlaitElement | null | undefined
): value is DrawnixImageElement => {
  return (
    !!value &&
    PlaitDrawElement.isImage(value) &&
    isEditableRasterImageUrl((value as DrawnixImageElement).url)
  );
};

export const getSingleSelectedImageElement = (
  board: PlaitBoard
): DrawnixImageElement | null => {
  const selectedElements = getSelectedElements(board);
  if (selectedElements.length === 1 && PlaitDrawElement.isImage(selectedElements[0])) {
    return selectedElements[0] as DrawnixImageElement;
  }
  const focusedImage = getElementOfFocusedImage(board);
  if (focusedImage && PlaitDrawElement.isImage(focusedImage)) {
    return focusedImage as DrawnixImageElement;
  }
  return null;
};

export const getSingleSelectedRasterImageElement = (
  board: PlaitBoard
): DrawnixImageElement | null => {
  const selectedElements = getSelectedElements(board);
  if (
    selectedElements.length === 1 &&
    isEditableRasterImageElement(selectedElements[0])
  ) {
    return selectedElements[0] as DrawnixImageElement;
  }
  return null;
};

export const findBoardElementById = (
  elements: PlaitElement[],
  targetId: string
): PlaitElement | null => {
  for (const element of elements) {
    if ((element as { id?: string }).id === targetId) {
      return element;
    }
    const children = (element as { children?: PlaitElement[] }).children;
    if (Array.isArray(children)) {
      const matched = findBoardElementById(children, targetId);
      if (matched) {
        return matched;
      }
    }
  }
  return null;
};

export const findImageElementById = (
  board: PlaitBoard,
  targetId: string
): DrawnixImageElement | null => {
  const matched = findBoardElementById(board.children, targetId);
  if (matched && PlaitDrawElement.isImage(matched)) {
    return matched as DrawnixImageElement;
  }
  return null;
};

export const replaceImageElementUrl = (
  board: PlaitBoard,
  targetId: string,
  nextUrl: string
) => {
  const imageElement = findImageElementById(board, targetId);
  if (!imageElement) {
    throw new Error(`Image element not found: ${targetId}`);
  }
  const path = PlaitBoard.findPath(board, imageElement as any);
  PlaitHistoryBoard.withNewBatch(board, () => {
    Transforms.setNode(board, { url: nextUrl }, path);
  });
  return imageElement;
};

export const appendImageEraseStroke = (
  board: PlaitBoard,
  targetId: string,
  stroke: DrawnixImageEraseStroke
) => {
  if (!stroke.points.length) {
    return null;
  }

  const imageElement = findImageElementById(board, targetId);
  if (!imageElement) {
    throw new Error(`Image element not found: ${targetId}`);
  }

  const path = PlaitBoard.findPath(board, imageElement as any);
  const nextEraseMask: DrawnixImageEraseMask = {
    version: 1,
    strokes: [...(imageElement.eraseMask?.strokes || []), stroke],
  };

  PlaitHistoryBoard.withNewBatch(board, () => {
    Transforms.setNode(board, { eraseMask: nextEraseMask }, path);
  });

  return imageElement;
};

export const clearImageEraseMask = (board: PlaitBoard, targetId: string) => {
  const imageElement = findImageElementById(board, targetId);
  if (!imageElement) {
    throw new Error(`Image element not found: ${targetId}`);
  }

  const path = PlaitBoard.findPath(board, imageElement as any);
  PlaitHistoryBoard.withNewBatch(board, () => {
    Transforms.setNode(board, { eraseMask: undefined }, path);
  });

  return imageElement;
};
