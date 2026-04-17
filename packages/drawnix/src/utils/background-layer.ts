import {
  getAllMoveOptions,
  getOneMoveOptions,
  getSelectedElements,
  moveElementsToNewPath,
  PlaitBoard,
  PlaitElement,
} from '@plait/core';

const getSceneSemanticRole = (element: PlaitElement) => {
  const rawElement = element as PlaitElement & {
    sceneImportMetadata?: { semanticRole?: string };
  };
  return rawElement.sceneImportMetadata?.semanticRole;
};

export const isBackgroundLayerElement = (
  element: PlaitElement | null | undefined
) => {
  if (!element) {
    return false;
  }
  return element.id === 'svg-base-layer' || getSceneSemanticRole(element) === 'background';
};

const hasBackgroundInSelection = (board: PlaitBoard) => {
  return getSelectedElements(board).some((element) => isBackgroundLayerElement(element));
};

const clampMoveOptionsAboveBackground = (
  board: PlaitBoard,
  moveOptions: { element: PlaitElement; newPath: number[] }[] | undefined
) => {
  if (!moveOptions?.length) {
    return [];
  }
  const backgroundFloor = board.children.filter((element) =>
    isBackgroundLayerElement(element)
  ).length;
  if (backgroundFloor <= 0) {
    return moveOptions;
  }
  return moveOptions.map((option) => ({
    ...option,
    newPath: [Math.max(backgroundFloor, option.newPath[0] ?? backgroundFloor)],
  }));
};

export const moveSelectionOneStepPreservingBackground = (
  board: PlaitBoard,
  direction: 'up' | 'down'
) => {
  if (hasBackgroundInSelection(board)) {
    return;
  }

  const moveOptions = getOneMoveOptions(board, direction);
  if (!moveOptions?.length) {
    return;
  }

  moveElementsToNewPath(
    board,
    direction === 'down'
      ? clampMoveOptionsAboveBackground(board, moveOptions)
      : moveOptions
  );
};

export const moveSelectionToEdgePreservingBackground = (
  board: PlaitBoard,
  direction: 'up' | 'down'
) => {
  if (hasBackgroundInSelection(board)) {
    return;
  }

  const moveOptions = getAllMoveOptions(board, direction);
  if (!moveOptions?.length) {
    return;
  }

  moveElementsToNewPath(
    board,
    direction === 'down'
      ? clampMoveOptionsAboveBackground(board, moveOptions)
      : moveOptions
  );
};
