import { getElementOfFocusedImage } from '@plait/common';
import {
  getSelectedElements,
  PlaitBoard,
  PlaitElement,
  PlaitHistoryBoard,
  Transforms,
} from '@plait/core';
import { PlaitDrawElement } from '@plait/draw';

export type DrawnixImageElement = PlaitElement & {
  id: string;
  url: string;
  children?: PlaitElement[];
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
