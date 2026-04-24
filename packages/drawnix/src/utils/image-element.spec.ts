import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  appendImageEraseStroke,
  clearImageEraseMask,
  findBoardElementById,
  getSingleSelectedImageElement,
  getSingleSelectedRasterImageElement,
  isEditableRasterImageElement,
  isEditableRasterImageUrl,
  replaceImageElementUrl,
} from './image-element';

const mockGetSelectedElements = jest.fn();
const mockGetElementOfFocusedImage = jest.fn(() => null);
const mockFindPath = jest.fn(() => [0]);
const mockWithNewBatch = jest.fn((_: unknown, fn: () => void) => fn());
const mockSetNode = jest.fn();

jest.mock('@plait/common', () => ({
  getElementOfFocusedImage: (...args: unknown[]) =>
    mockGetElementOfFocusedImage(...args),
}));

jest.mock('@plait/core', () => ({
  getSelectedElements: (...args: unknown[]) => mockGetSelectedElements(...args),
  PlaitBoard: {
    findPath: (...args: unknown[]) => mockFindPath(...args),
  },
  PlaitHistoryBoard: {
    withNewBatch: (...args: unknown[]) => mockWithNewBatch(...args),
  },
  Transforms: {
    setNode: (...args: unknown[]) => mockSetNode(...args),
  },
}));

jest.mock('@plait/draw', () => ({
  PlaitDrawElement: {
    isImage: (value: any) => value?.type === 'image',
  },
}));

describe('image-element utils', () => {
  beforeEach(() => {
    mockGetSelectedElements.mockReset();
    mockGetElementOfFocusedImage.mockReset();
    mockFindPath.mockReset();
    mockWithNewBatch.mockReset();
    mockSetNode.mockReset();

    mockGetSelectedElements.mockReturnValue([]);
    mockGetElementOfFocusedImage.mockReturnValue(null);
    mockFindPath.mockReturnValue([0]);
    mockWithNewBatch.mockImplementation((_: unknown, fn: () => void) => fn());
  });

  it('优先返回单选中的图片元素', () => {
    const imageElement = { id: 'image-1', type: 'image', url: 'a.png' };
    mockGetSelectedElements.mockReturnValue([imageElement]);

    expect(getSingleSelectedImageElement({} as any)).toEqual(imageElement);
  });

  it('没有单选图片时会回退到 focused image', () => {
    const imageElement = { id: 'image-2', type: 'image', url: 'b.png' };
    mockGetElementOfFocusedImage.mockReturnValue(imageElement);

    expect(getSingleSelectedImageElement({} as any)).toEqual(imageElement);
  });

  it('可以递归查找分组里的图片元素', () => {
    const result = findBoardElementById(
      [
        {
          id: 'group-1',
          children: [{ id: 'image-3', type: 'image', url: 'c.png' }],
        } as any,
      ],
      'image-3'
    );

    expect(result).toEqual({ id: 'image-3', type: 'image', url: 'c.png' });
  });

  it('支持按目标 id 原位替换图片 url', () => {
    const board = {
      children: [{ id: 'image-4', type: 'image', url: 'old.png' }],
    } as any;

    replaceImageElementUrl(board, 'image-4', 'new.png');

    expect(mockSetNode).toHaveBeenCalledWith(board, { url: 'new.png' }, [0]);
  });

  it('只把 png/jpg/webp 识别为可编辑栅格图', () => {
    expect(isEditableRasterImageUrl('https://example.com/demo.png')).toBe(true);
    expect(isEditableRasterImageUrl('data:image/jpeg;base64,abc')).toBe(true);
    expect(isEditableRasterImageUrl('data:image/svg+xml;base64,abc')).toBe(
      false
    );
    expect(isEditableRasterImageUrl('https://example.com/demo.svg')).toBe(
      false
    );
  });

  it('可以判断图片元素是否属于可编辑栅格图', () => {
    expect(
      isEditableRasterImageElement({
        id: 'image-5',
        type: 'image',
        url: 'figure.webp',
      } as any)
    ).toBe(true);
    expect(
      isEditableRasterImageElement({
        id: 'image-6',
        type: 'image',
        url: 'fragment.svg',
      } as any)
    ).toBe(false);
  });

  it('只在直接单选栅格图时返回图片元素', () => {
    const imageElement = { id: 'image-7', type: 'image', url: 'a.png' };
    mockGetSelectedElements.mockReturnValue([imageElement]);

    expect(getSingleSelectedRasterImageElement({} as any)).toEqual(imageElement);

    mockGetSelectedElements.mockReturnValue([
      imageElement,
      { id: 'shape-1', type: 'geometry' },
    ]);
    expect(getSingleSelectedRasterImageElement({} as any)).toBeNull();
  });

  it('支持给图片追加一条擦除笔迹', () => {
    const board = {
      children: [{ id: 'image-8', type: 'image', url: 'old.png' }],
    } as any;

    appendImageEraseStroke(board, 'image-8', {
      points: [[0.1, 0.2]],
      radius: 0.05,
    });

    expect(mockSetNode).toHaveBeenCalledWith(
      board,
      {
        eraseMask: {
          version: 1,
          strokes: [{ points: [[0.1, 0.2]], radius: 0.05 }],
        },
      },
      [0]
    );
  });

  it('支持清空图片擦除蒙版', () => {
    const board = {
      children: [
        {
          id: 'image-9',
          type: 'image',
          url: 'old.png',
          eraseMask: {
            version: 1,
            strokes: [{ points: [[0.1, 0.2]], radius: 0.05 }],
          },
        },
      ],
    } as any;

    clearImageEraseMask(board, 'image-9');

    expect(mockSetNode).toHaveBeenCalledWith(
      board,
      { eraseMask: undefined },
      [0]
    );
  });
});
