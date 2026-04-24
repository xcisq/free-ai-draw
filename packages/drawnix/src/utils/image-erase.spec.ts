import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  buildImageEraseStroke,
  buildImageEraseCacheKey,
} from './image-erase';

const mockGetRectangleByPoints = jest.fn();
const mockRotateAntiPointsByElement = jest.fn();

jest.mock('@plait/core', () => ({
  RectangleClient: {
    getRectangleByPoints: (...args: unknown[]) =>
      mockGetRectangleByPoints(...args),
  },
  rotateAntiPointsByElement: (...args: unknown[]) =>
    mockRotateAntiPointsByElement(...args),
}));

describe('image-erase utils', () => {
  beforeEach(() => {
    mockGetRectangleByPoints.mockReset();
    mockRotateAntiPointsByElement.mockReset();
    mockGetRectangleByPoints.mockReturnValue({
      x: 100,
      y: 40,
      width: 200,
      height: 100,
    });
    mockRotateAntiPointsByElement.mockImplementation(
      (_board: unknown, point: [number, number]) => point
    );
  });

  it('会把图片局部路径归一化到 0..1', () => {
    const stroke = buildImageEraseStroke(
      {} as any,
      {
        id: 'image-1',
        type: 'image',
        url: 'demo.png',
        points: [
          [100, 40],
          [300, 140],
        ],
      } as any,
      [
        [100, 40],
        [200, 90],
        [300, 140],
      ],
      10
    );

    expect(stroke).toEqual({
      points: [
        [0, 0],
        [0.5, 0.5],
        [1, 1],
      ],
      radius: 0.1,
    });
  });

  it('会基于反旋转后的点计算擦痕坐标', () => {
    mockRotateAntiPointsByElement.mockReturnValue([150, 90]);

    const stroke = buildImageEraseStroke(
      {} as any,
      {
        id: 'image-2',
        type: 'image',
        url: 'demo.png',
        points: [
          [100, 40],
          [300, 140],
        ],
        angle: 30,
      } as any,
      [[180, 120]],
      8
    );

    expect(stroke).toEqual({
      points: [[0.25, 0.5]],
      radius: 0.08,
    });
  });

  it('会为相同 url 和蒙版生成稳定缓存键', () => {
    const key = buildImageEraseCacheKey('demo.png', {
      version: 1,
      strokes: [{ points: [[0.2, 0.3]], radius: 0.1 }],
    });

    expect(key).toBe(
      'demo.png::{"version":1,"strokes":[{"points":[[0.2,0.3]],"radius":0.1}]}'
    );
  });
});
