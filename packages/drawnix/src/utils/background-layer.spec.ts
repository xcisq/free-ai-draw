import {
  isBackgroundLayerElement,
  moveSelectionOneStepPreservingBackground,
  moveSelectionToEdgePreservingBackground,
} from './background-layer';

const mockMoveElementsToNewPath = jest.fn();
const mockGetOneMoveOptions = jest.fn();
const mockGetAllMoveOptions = jest.fn();
const mockGetSelectedElements = jest.fn();

jest.mock('@plait/core', () => ({
  getAllMoveOptions: (...args: unknown[]) => mockGetAllMoveOptions(...args),
  getOneMoveOptions: (...args: unknown[]) => mockGetOneMoveOptions(...args),
  getSelectedElements: (...args: unknown[]) => mockGetSelectedElements(...args),
  moveElementsToNewPath: (...args: unknown[]) => mockMoveElementsToNewPath(...args),
}));

describe('background-layer', () => {
  const background = { id: 'svg-base-layer' } as any;
  const shape = { id: 'shape-1' } as any;
  const board = {
    children: [background, shape, { id: 'shape-2' }],
  } as any;

  beforeEach(() => {
    mockMoveElementsToNewPath.mockReset();
    mockGetOneMoveOptions.mockReset();
    mockGetAllMoveOptions.mockReset();
    mockGetSelectedElements.mockReset();
    mockGetSelectedElements.mockReturnValue([shape]);
  });

  it('应识别 svg 背景层元素', () => {
    expect(isBackgroundLayerElement(background)).toBe(true);
    expect(isBackgroundLayerElement(shape)).toBe(false);
  });

  it('下移一层时不应把普通元素压到背景层下面', () => {
    mockGetOneMoveOptions.mockReturnValue([
      {
        element: shape,
        newPath: [0],
      },
    ]);

    moveSelectionOneStepPreservingBackground(board, 'down');

    expect(mockMoveElementsToNewPath).toHaveBeenCalledWith(board, [
      {
        element: shape,
        newPath: [1],
      },
    ]);
  });

  it('置底时应停在背景层之上', () => {
    mockGetAllMoveOptions.mockReturnValue([
      {
        element: shape,
        newPath: [0],
      },
    ]);

    moveSelectionToEdgePreservingBackground(board, 'down');

    expect(mockMoveElementsToNewPath).toHaveBeenCalledWith(board, [
      {
        element: shape,
        newPath: [1],
      },
    ]);
  });

  it('选中背景层时不应执行层级调整', () => {
    mockGetSelectedElements.mockReturnValue([background]);
    mockGetOneMoveOptions.mockReturnValue([
      {
        element: background,
        newPath: [1],
      },
    ]);

    moveSelectionOneStepPreservingBackground(board, 'up');

    expect(mockMoveElementsToNewPath).not.toHaveBeenCalled();
  });
});
