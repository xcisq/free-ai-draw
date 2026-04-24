import {
  PlaitBoard,
  PlaitElement,
  Point,
  throttleRAF,
  toHostPoint,
  toViewBoxPoint,
} from '@plait/core';
import { isDrawingMode } from '@plait/common';
import { isHitFreehand } from './utils';
import { Freehand, FreehandShape } from './type';
import { CoreTransforms } from '@plait/core';
import { LaserPointer } from '../../utils/laser-pointer';
import { isTwoFingerMode } from '@plait-board/react-board';
import {
  appendImageEraseStroke,
  findImageElementById,
  getSingleSelectedRasterImageElement,
} from '../../utils/image-element';
import {
  buildImageEraseStroke,
  getImageEraseViewBoxRadius,
} from '../../utils/image-erase';

export const withFreehandErase = (board: PlaitBoard) => {
  const { pointerDown, pointerMove, pointerUp, globalPointerUp, touchStart } =
    board;

  const laserPointer = new LaserPointer();

  let isErasing = false;
  let imageEraseTargetId: string | null = null;
  let imageErasePoints: Point[] = [];
  let imageEraseRadius = 0;
  const elementsToDelete = new Set<string>();

  const checkAndMarkFreehandElementsForDeletion = (point: Point) => {
    const viewBoxPoint = toViewBoxPoint(
      board,
      toHostPoint(board, point[0], point[1])
    );

    const freehandElements = board.children.filter((element) =>
      Freehand.isFreehand(element)
    ) as Freehand[];

    freehandElements.forEach((element) => {
      if (
        !elementsToDelete.has(element.id) &&
        isHitFreehand(board, element, viewBoxPoint)
      ) {
        PlaitElement.getElementG(element).style.opacity = '0.2';
        elementsToDelete.add(element.id);
      }
    });
  };

  const deleteMarkedElements = () => {
    if (elementsToDelete.size > 0) {
      const elementsToRemove = board.children.filter((element) =>
        elementsToDelete.has(element.id)
      );

      if (elementsToRemove.length > 0) {
        CoreTransforms.removeElements(board, elementsToRemove);
      }
    }
  };

  const complete = () => {
    if (isErasing) {
      if (imageEraseTargetId) {
        const imageElement = findImageElementById(board, imageEraseTargetId);
        if (imageElement) {
          const stroke = buildImageEraseStroke(
            board,
            imageElement,
            imageErasePoints,
            imageEraseRadius
          );
          if (stroke) {
            appendImageEraseStroke(board, imageEraseTargetId, stroke);
          }
        }
      } else {
        deleteMarkedElements();
      }
      isErasing = false;
      imageEraseTargetId = null;
      imageErasePoints = [];
      imageEraseRadius = 0;
      elementsToDelete.clear();
      laserPointer.destroy();
    }
  };

  board.touchStart = (event: TouchEvent) => {
    const isEraserPointer = PlaitBoard.isInPointer(board, [
      FreehandShape.eraser,
    ]);
    if (isEraserPointer && isDrawingMode(board)) {
      return event.preventDefault();
    }
    touchStart(event);
  };

  board.pointerDown = (event: PointerEvent) => {
    const isEraserPointer = PlaitBoard.isInPointer(board, [
      FreehandShape.eraser,
    ]);

    if (isEraserPointer && isDrawingMode(board)) {
      isErasing = true;
      elementsToDelete.clear();
      const screenPoint: Point = [event.x, event.y];
      const selectedImage = getSingleSelectedRasterImageElement(board);
      if (selectedImage) {
        imageEraseTargetId = selectedImage.id;
        imageErasePoints = [
          toViewBoxPoint(board, toHostPoint(board, screenPoint[0], screenPoint[1])),
        ];
        imageEraseRadius = getImageEraseViewBoxRadius(board, screenPoint);
      } else {
        const currentPoint: Point = [event.x, event.y];
        checkAndMarkFreehandElementsForDeletion(currentPoint);
      }
      laserPointer.init(board);
      return;
    }

    pointerDown(event);
  };

  board.pointerMove = (event: PointerEvent) => {
    if (isErasing && !isTwoFingerMode(board)) {
      throttleRAF(board, 'with-freehand-erase', () => {
        if (imageEraseTargetId) {
          imageErasePoints.push(
            toViewBoxPoint(board, toHostPoint(board, event.x, event.y))
          );
          return;
        }

        const currentPoint: Point = [event.x, event.y];
        checkAndMarkFreehandElementsForDeletion(currentPoint);
      });
      return;
    }
    if (isErasing && isTwoFingerMode(board)) {
      complete();
      return;
    }
    pointerMove(event);
  };

  board.pointerUp = (event: PointerEvent) => {
    if (isErasing) {
      complete();
      return;
    }

    pointerUp(event);
  };

  board.globalPointerUp = (event: PointerEvent) => {
    if (isErasing) {
      complete();
      return;
    }

    globalPointerUp(event);
  };

  return board;
};
