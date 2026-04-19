import {
  alignSelection,
  canDistributeSelection,
  distributeSelection,
  getArrangeableSelectionCount,
} from './arrange';

const mockAlignLeft = jest.fn();
const mockAlignHorizontalCenter = jest.fn();
const mockAlignRight = jest.fn();
const mockAlignTop = jest.fn();
const mockAlignVerticalCenter = jest.fn();
const mockAlignBottom = jest.fn();
const mockDistributeHorizontal = jest.fn();
const mockDistributeVertical = jest.fn();
const mockGetHighestSelectedElements = jest.fn();
const mockGetElementsInGroup = jest.fn();
const mockGetViewBox = jest.fn();
const mockFindPath = jest.fn();
const mockSetNode = jest.fn();
const mockMergingSet = jest.fn();

jest.mock('@plait/common', () => ({
  AlignTransform: {
    alignLeft: (...args: unknown[]) => mockAlignLeft(...args),
    alignHorizontalCenter: (...args: unknown[]) =>
      mockAlignHorizontalCenter(...args),
    alignRight: (...args: unknown[]) => mockAlignRight(...args),
    alignTop: (...args: unknown[]) => mockAlignTop(...args),
    alignVerticalCenter: (...args: unknown[]) =>
      mockAlignVerticalCenter(...args),
    alignBottom: (...args: unknown[]) => mockAlignBottom(...args),
    distributeHorizontal: (...args: unknown[]) =>
      mockDistributeHorizontal(...args),
    distributeVertical: (...args: unknown[]) => mockDistributeVertical(...args),
  },
}));

jest.mock('@plait/core', () => ({
  getElementsInGroup: (...args: unknown[]) => mockGetElementsInGroup(...args),
  getHighestSelectedElements: (...args: unknown[]) =>
    mockGetHighestSelectedElements(...args),
  getViewBox: (...args: unknown[]) => mockGetViewBox(...args),
  MERGING: {
    set: (...args: unknown[]) => mockMergingSet(...args),
  },
  PlaitBoard: {
    findPath: (...args: unknown[]) => mockFindPath(...args),
  },
  PlaitGroupElement: {
    isGroup: (element: { type?: string }) => element?.type === 'group',
  },
  Transforms: {
    setNode: (...args: unknown[]) => mockSetNode(...args),
  },
}));

describe('arrange transforms', () => {
  const rect = {
    id: 'rect-1',
    points: [
      [100, 40],
      [150, 100],
    ],
  };
  const secondRect = {
    id: 'rect-2',
    points: [
      [200, 60],
      [260, 120],
    ],
  };
  const thirdRect = {
    id: 'rect-3',
    points: [
      [280, 80],
      [340, 140],
    ],
  };
  const group = { id: 'group-1', type: 'group' };
  const groupChildA = {
    id: 'group-child-a',
    points: [
      [20, 20],
      [60, 60],
    ],
  };
  const groupChildB = {
    id: 'group-child-b',
    points: [
      [80, 40],
      [120, 80],
    ],
  };
  const board = {
    getRectangle: jest.fn((element: { id?: string }) => {
      if (element?.id === 'group-1') {
        return { x: 20, y: 20, width: 100, height: 60 };
      }
      return { x: 100, y: 40, width: 50, height: 60 };
    }),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetViewBox.mockReturnValue({ x: 0, y: 0, width: 400, height: 300 });
    mockFindPath.mockImplementation((_board, element: { id?: string }) => [
      element?.id ?? 'unknown',
    ]);
    mockGetElementsInGroup.mockReturnValue([groupChildA, groupChildB]);
  });

  it('单选时应按当前画布视口执行对齐', () => {
    mockGetHighestSelectedElements.mockReturnValue([rect]);

    alignSelection(board, 'center');

    expect(mockSetNode).toHaveBeenCalledWith(
      board,
      {
        points: [
          [175, 40],
          [225, 100],
        ],
      },
      ['rect-1']
    );
    expect(mockMergingSet).toHaveBeenNthCalledWith(1, board, true);
    expect(mockMergingSet).toHaveBeenNthCalledWith(2, board, false);
  });

  it('单选分组时应移动组内所有图元', () => {
    mockGetHighestSelectedElements.mockReturnValue([group]);

    alignSelection(board, 'left');

    expect(mockSetNode).toHaveBeenNthCalledWith(
      1,
      board,
      {
        points: [
          [0, 20],
          [40, 60],
        ],
      },
      ['group-child-a']
    );
    expect(mockSetNode).toHaveBeenNthCalledWith(
      2,
      board,
      {
        points: [
          [60, 40],
          [100, 80],
        ],
      },
      ['group-child-b']
    );
  });

  it('多选时应复用原生对齐逻辑', () => {
    mockGetHighestSelectedElements.mockReturnValue([rect, secondRect]);

    alignSelection(board, 'bottom');

    expect(mockAlignBottom).toHaveBeenCalledWith(board);
    expect(mockSetNode).not.toHaveBeenCalled();
  });

  it('三个以上元素才允许等间距分布', () => {
    mockGetHighestSelectedElements.mockReturnValue([rect, secondRect]);
    expect(canDistributeSelection(board)).toBe(false);

    distributeSelection(board, 'horizontal');
    expect(mockDistributeHorizontal).not.toHaveBeenCalled();

    mockGetHighestSelectedElements.mockReturnValue([
      rect,
      secondRect,
      thirdRect,
    ]);
    expect(canDistributeSelection(board)).toBe(true);

    distributeSelection(board, 'vertical');
    expect(mockDistributeVertical).toHaveBeenCalledWith(board);
  });

  it('只统计可移动的选中元素', () => {
    mockGetHighestSelectedElements.mockReturnValue([
      rect,
      { id: 'mind-1' },
      group,
    ]);

    expect(getArrangeableSelectionCount(board)).toBe(2);
  });
});
