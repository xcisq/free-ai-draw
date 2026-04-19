import {
  PlaitBoard,
  PlaitElement,
  RectangleClient,
  rotateAntiPointsByElement,
} from '@plait/core';
import { BasicShapes, PlaitDrawElement } from '@plait/draw';

const isRectangleGeometry = (element: PlaitElement) => {
  return (
    PlaitDrawElement.isGeometry(element) &&
    !PlaitDrawElement.isText(element) &&
    (element as { shape?: string }).shape === BasicShapes.rectangle
  );
};

export const withSelectionHit = (board: PlaitBoard) => {
  const { isHit } = board;

  board.isHit = (element, point, isStrict?: boolean) => {
    const result = isHit(element, point, isStrict);
    if (result || !isRectangleGeometry(element)) {
      return result;
    }

    const rawPoints = (element as { points?: [number, number][] }).points;
    if (!rawPoints || rawPoints.length === 0) {
      return result;
    }

    // Some rectangle geometries only react to the painted stroke. Fall back to
    // the axis-aligned shape bounds so clicking the interior still selects it.
    const antiPoint = rotateAntiPointsByElement(board, point, element) || point;
    const rectangle = RectangleClient.getRectangleByPoints(rawPoints);
    return RectangleClient.isPointInRectangle(rectangle, antiPoint);
  };

  return board;
};
