import { withSelectionHit } from './with-selection-hit';

const mockRotateAntiPointsByElement = jest.fn();
const mockGetRectangleByPoints = jest.fn();
const mockIsPointInRectangle = jest.fn();
const mockIsGeometry = jest.fn();
const mockIsText = jest.fn();

jest.mock('@plait/core', () => ({
  RectangleClient: {
    getRectangleByPoints: (...args: unknown[]) =>
      mockGetRectangleByPoints(...args),
    isPointInRectangle: (...args: unknown[]) => mockIsPointInRectangle(...args),
  },
  rotateAntiPointsByElement: (...args: unknown[]) =>
    mockRotateAntiPointsByElement(...args),
}));

jest.mock('@plait/draw', () => ({
  BasicShapes: {
    rectangle: 'rectangle',
  },
  PlaitDrawElement: {
    isGeometry: (...args: unknown[]) => mockIsGeometry(...args),
    isText: (...args: unknown[]) => mockIsText(...args),
  },
}));

describe('withSelectionHit', () => {
  const point: [number, number] = [120, 80];
  const rectangleElement = {
    type: 'geometry',
    shape: 'rectangle',
    points: [
      [100, 40],
      [150, 100],
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRotateAntiPointsByElement.mockReturnValue(point);
    mockGetRectangleByPoints.mockReturnValue({
      x: 100,
      y: 40,
      width: 50,
      height: 60,
    });
    mockIsPointInRectangle.mockReturnValue(true);
    mockIsGeometry.mockReturnValue(true);
    mockIsText.mockReturnValue(false);
  });

  it('原始命中成功时应直接复用原结果', () => {
    const board = withSelectionHit({
      isHit: jest.fn(() => true),
    } as any);

    expect(board.isHit(rectangleElement as any, point)).toBe(true);
    expect(mockIsPointInRectangle).not.toHaveBeenCalled();
  });

  it('矩形边框未命中时应回退到内部区域命中', () => {
    const board = withSelectionHit({
      isHit: jest.fn(() => false),
    } as any);

    expect(board.isHit(rectangleElement as any, point)).toBe(true);
    expect(mockGetRectangleByPoints).toHaveBeenCalledWith(
      rectangleElement.points
    );
    expect(mockIsPointInRectangle).toHaveBeenCalledWith(
      {
        x: 100,
        y: 40,
        width: 50,
        height: 60,
      },
      point
    );
  });

  it('非矩形图元不应触发内部命中兜底', () => {
    const board = withSelectionHit({
      isHit: jest.fn(() => false),
    } as any);

    expect(
      board.isHit(
        {
          ...rectangleElement,
          shape: 'ellipse',
        } as any,
        point
      )
    ).toBe(false);
    expect(mockIsPointInRectangle).not.toHaveBeenCalled();
  });
});
