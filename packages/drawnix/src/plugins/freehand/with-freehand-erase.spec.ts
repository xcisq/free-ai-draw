import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { withFreehandErase } from './with-freehand-erase';

const mockIsInPointer = jest.fn();
const mockToHostPoint = jest.fn();
const mockToViewBoxPoint = jest.fn();
const mockThrottleRAF = jest.fn();
const mockRemoveElements = jest.fn();
const mockGetElementG = jest.fn();
const mockIsDrawingMode = jest.fn();
const mockIsHitFreehand = jest.fn();
const mockIsTwoFingerMode = jest.fn();
const mockGetSingleSelectedRasterImageElement = jest.fn();
const mockFindImageElementById = jest.fn();
const mockAppendImageEraseStroke = jest.fn();
const mockBuildImageEraseStroke = jest.fn();
const mockGetImageEraseViewBoxRadius = jest.fn();
const mockLaserInit = jest.fn();
const mockLaserDestroy = jest.fn();

jest.mock('@plait/core', () => ({
  DEFAULT_COLOR: '#000',
  ThemeColorMode: {
    default: 'default',
    colorful: 'colorful',
    soft: 'soft',
    retro: 'retro',
    dark: 'dark',
    starry: 'starry',
  },
  PlaitBoard: {
    isInPointer: (...args: unknown[]) => mockIsInPointer(...args),
  },
  PlaitElement: {
    getElementG: (...args: unknown[]) => mockGetElementG(...args),
  },
  CoreTransforms: {
    removeElements: (...args: unknown[]) => mockRemoveElements(...args),
  },
  toHostPoint: (...args: unknown[]) => mockToHostPoint(...args),
  toViewBoxPoint: (...args: unknown[]) => mockToViewBoxPoint(...args),
  throttleRAF: (...args: unknown[]) => mockThrottleRAF(...args),
}));

jest.mock('@plait/common', () => ({
  isDrawingMode: (...args: unknown[]) => mockIsDrawingMode(...args),
}));

jest.mock('./utils', () => ({
  isHitFreehand: (...args: unknown[]) => mockIsHitFreehand(...args),
}));

jest.mock('@plait-board/react-board', () => ({
  isTwoFingerMode: (...args: unknown[]) => mockIsTwoFingerMode(...args),
}));

jest.mock('../../utils/image-element', () => ({
  getSingleSelectedRasterImageElement: (...args: unknown[]) =>
    mockGetSingleSelectedRasterImageElement(...args),
  findImageElementById: (...args: unknown[]) =>
    mockFindImageElementById(...args),
  appendImageEraseStroke: (...args: unknown[]) =>
    mockAppendImageEraseStroke(...args),
}));

jest.mock('../../utils/image-erase', () => ({
  buildImageEraseStroke: (...args: unknown[]) =>
    mockBuildImageEraseStroke(...args),
  getImageEraseViewBoxRadius: (...args: unknown[]) =>
    mockGetImageEraseViewBoxRadius(...args),
}));

jest.mock('../../utils/laser-pointer', () => ({
  LaserPointer: jest.fn().mockImplementation(() => ({
    init: (...args: unknown[]) => mockLaserInit(...args),
    destroy: (...args: unknown[]) => mockLaserDestroy(...args),
  })),
}));

describe('withFreehandErase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsInPointer.mockReturnValue(true);
    mockToHostPoint.mockImplementation(
      (_board: unknown, x: number, y: number) => [x, y]
    );
    mockToViewBoxPoint.mockImplementation(
      (_board: unknown, point: [number, number]) => point
    );
    mockThrottleRAF.mockImplementation(
      (_board: unknown, _key: string, fn: () => void) => fn()
    );
    mockIsDrawingMode.mockReturnValue(true);
    mockIsHitFreehand.mockReturnValue(true);
    mockIsTwoFingerMode.mockReturnValue(false);
    mockGetSingleSelectedRasterImageElement.mockReturnValue(null);
    mockFindImageElementById.mockReturnValue(null);
    mockBuildImageEraseStroke.mockReturnValue(null);
    mockGetImageEraseViewBoxRadius.mockReturnValue(12);
    mockGetElementG.mockReturnValue({ style: {} });
  });

  it('单选栅格图时应追加图片擦痕而不是删 freehand', () => {
    const imageElement = {
      id: 'image-1',
      type: 'image',
      url: 'demo.png',
      points: [
        [0, 0],
        [100, 100],
      ],
    };
    const stroke = { points: [[0.1, 0.1]], radius: 0.08 };
    mockGetSingleSelectedRasterImageElement.mockReturnValue(imageElement);
    mockFindImageElementById.mockReturnValue(imageElement);
    mockBuildImageEraseStroke.mockReturnValue(stroke);

    const board = withFreehandErase({
      children: [],
      pointerDown: jest.fn(),
      pointerMove: jest.fn(),
      pointerUp: jest.fn(),
      globalPointerUp: jest.fn(),
      touchStart: jest.fn(),
    } as any);

    board.pointerDown({ x: 10, y: 20 });
    board.pointerMove({ x: 30, y: 40 });
    board.pointerUp({ x: 30, y: 40 });

    expect(mockAppendImageEraseStroke).toHaveBeenCalledWith(
      board,
      'image-1',
      stroke
    );
    expect(mockRemoveElements).not.toHaveBeenCalled();
    expect(board.pointerDown).toBeDefined();
  });

  it('非单选栅格图时应继续沿用当前 freehand 删除逻辑', () => {
    const freehandElement = { id: 'freehand-1', type: 'freehand' };
    const board = withFreehandErase({
      children: [freehandElement],
      pointerDown: jest.fn(),
      pointerMove: jest.fn(),
      pointerUp: jest.fn(),
      globalPointerUp: jest.fn(),
      touchStart: jest.fn(),
    } as any);

    board.pointerDown({ x: 10, y: 20 });
    board.pointerMove({ x: 30, y: 40 });
    board.pointerUp({ x: 30, y: 40 });

    expect(mockRemoveElements).toHaveBeenCalledWith(board, [freehandElement]);
    expect(mockAppendImageEraseStroke).not.toHaveBeenCalled();
  });
});
