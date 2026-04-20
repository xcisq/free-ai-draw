import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  findBoardElementById,
  getSingleSelectedImageElement,
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
});
