import { AlignTransform } from '@plait/common';
import {
  getElementsInGroup,
  getHighestSelectedElements,
  getViewBox,
  MERGING,
  PlaitBoard,
  PlaitElement,
  PlaitGroupElement,
  RectangleClient,
  Transforms,
} from '@plait/core';

export type AlignType =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom';

export type DistributeType = 'horizontal' | 'vertical';

type RectangleLike = Pick<RectangleClient, 'x' | 'y' | 'width' | 'height'>;

const canArrangeElement = (element: PlaitElement) => {
  return (
    PlaitGroupElement.isGroup(element) ||
    (Array.isArray((element as { points?: unknown[] }).points) &&
      (element as { points?: unknown[] }).points!.length > 0)
  );
};

const getArrangeableElements = (board: PlaitBoard) => {
  return getHighestSelectedElements(board).filter(canArrangeElement);
};

const getAlignOffset = (
  target: RectangleLike,
  current: RectangleLike,
  type: AlignType
) => {
  switch (type) {
    case 'left':
      return [target.x - current.x, 0] as const;
    case 'center':
      return [
        target.x + target.width / 2 - (current.x + current.width / 2),
        0,
      ] as const;
    case 'right':
      return [
        target.x + target.width - (current.x + current.width),
        0,
      ] as const;
    case 'top':
      return [0, target.y - current.y] as const;
    case 'middle':
      return [
        0,
        target.y + target.height / 2 - (current.y + current.height / 2),
      ] as const;
    case 'bottom':
      return [
        0,
        target.y + target.height - (current.y + current.height),
      ] as const;
  }
};

const translateElement = (
  board: PlaitBoard,
  element: PlaitElement,
  offset: readonly [number, number]
) => {
  const [offsetX, offsetY] = offset;
  if (offsetX === 0 && offsetY === 0) {
    return;
  }

  const updateElements = PlaitGroupElement.isGroup(element)
    ? getElementsInGroup(board, element, true, false)
    : [element];

  updateElements.forEach((item) => {
    const points = (item as { points?: [number, number][] }).points;
    if (!points || points.length === 0) {
      return;
    }
    const path = PlaitBoard.findPath(board, item);
    Transforms.setNode(
      board,
      {
        points: points.map(([x, y]) => [x + offsetX, y + offsetY]),
      },
      path
    );
  });
};

const alignSingleSelectionToCanvas = (board: PlaitBoard, type: AlignType) => {
  const [element] = getArrangeableElements(board);
  if (!element) {
    return;
  }

  const rectangle = board.getRectangle(element);
  if (!rectangle) {
    return;
  }

  const viewBox = getViewBox(board);
  const offset = getAlignOffset(viewBox, rectangle, type);
  MERGING.set(board, true);
  try {
    translateElement(board, element, offset);
  } finally {
    MERGING.set(board, false);
  }
};

export const getArrangeableSelectionCount = (board: PlaitBoard) => {
  return getArrangeableElements(board).length;
};

export const canArrangeSelection = (board: PlaitBoard) => {
  return getArrangeableSelectionCount(board) > 0;
};

export const canDistributeSelection = (board: PlaitBoard) => {
  return getArrangeableSelectionCount(board) > 2;
};

export const alignSelection = (board: PlaitBoard, type: AlignType) => {
  const count = getArrangeableSelectionCount(board);
  if (count === 0) {
    return;
  }
  if (count === 1) {
    alignSingleSelectionToCanvas(board, type);
    return;
  }

  switch (type) {
    case 'left':
      AlignTransform.alignLeft(board);
      return;
    case 'center':
      AlignTransform.alignHorizontalCenter(board);
      return;
    case 'right':
      AlignTransform.alignRight(board);
      return;
    case 'top':
      AlignTransform.alignTop(board);
      return;
    case 'middle':
      AlignTransform.alignVerticalCenter(board);
      return;
    case 'bottom':
      AlignTransform.alignBottom(board);
      return;
  }
};

export const distributeSelection = (
  board: PlaitBoard,
  type: DistributeType
) => {
  if (!canDistributeSelection(board)) {
    return;
  }

  if (type === 'horizontal') {
    AlignTransform.distributeHorizontal(board);
    return;
  }
  AlignTransform.distributeVertical(board);
};
