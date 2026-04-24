import { act, render, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { Image } from './image';
import {
  resetImageGenerationTasks,
  syncImageGenerationTasks,
} from '../../image-edit/image-generation-store';

const mockApplyImageEraseMask = jest.fn<
  (_sourceUrl: string, _eraseMask?: unknown) => Promise<string>
>();

jest.mock('../../utils/image-erase', () => {
  return {
    buildImageEraseCacheKey: (sourceUrl: string, eraseMask?: unknown) =>
      `${sourceUrl}::${JSON.stringify(eraseMask || null)}`,
    applyImageEraseMask: (sourceUrl: string, eraseMask?: unknown) =>
      mockApplyImageEraseMask(sourceUrl, eraseMask),
  };
});

describe('Image', () => {
  beforeEach(() => {
    localStorage.setItem('language', 'zh');
    mockApplyImageEraseMask.mockReset();
  });

  afterEach(() => {
    act(() => {
      resetImageGenerationTasks();
    });
    localStorage.removeItem('language');
  });

  it('renders generation overlay when the image has an active task', () => {
    const { container } = render(
      <Image
        board={{} as any}
        imageItem={{ url: 'https://example.com/demo.png' } as any}
        element={{ id: 'image-1' } as any}
        getRectangle={() => ({ x: 0, y: 0, width: 100, height: 80 } as any)}
      />
    );

    expect(container.querySelector('.drawnix-image--generating')).toBeNull();
    expect(
      container.querySelector('.drawnix-image__transparent-grid')
    ).toBeNull();

    act(() => {
      syncImageGenerationTasks({
        'image-1': {
          targetId: 'image-1',
          jobId: 'job-1',
          backendUrl: 'http://127.0.0.1:8001',
          status: 'running',
        },
      });
    });

    expect(container.querySelector('.drawnix-image--generating')).not.toBeNull();
    expect(
      container.querySelector('.drawnix-image__generation-mask')
    ).not.toBeNull();
    expect(
      container.querySelector('.drawnix-image__generation-label')?.textContent
    ).toBe('正在编辑');
  });

  it('内联图片尺寸样式，保证导出快照不依赖外部 CSS', () => {
    const { container } = render(
      <Image
        board={{} as any}
        imageItem={{ url: 'https://example.com/export.png' } as any}
        element={{ id: 'image-export' } as any}
        getRectangle={() => ({ x: 0, y: 0, width: 100, height: 80 } as any)}
      />
    );

    const imageContainer = container.querySelector(
      '.drawnix-image'
    ) as HTMLDivElement;
    const image = container.querySelector('.image-origin') as HTMLImageElement;

    expect(imageContainer.style.display).toBe('flex');
    expect(imageContainer.style.width).toBe('100%');
    expect(imageContainer.style.height).toBe('100%');
    expect(imageContainer.style.overflow).toBe('hidden');
    expect(image.style.display).toBe('block');
    expect(image.style.width).toBe('100%');
    expect(image.style.height).toBe('100%');
    expect(image.style.objectFit).toBe('contain');
  });

  it('有擦除蒙版时会异步渲染合成后的图片 url', async () => {
    mockApplyImageEraseMask.mockResolvedValue('data:image/png;base64,masked');

    const { container } = render(
      <Image
        board={{} as any}
        imageItem={{ url: 'https://example.com/demo.png' } as any}
        element={{
          id: 'image-2',
          eraseMask: {
            version: 1,
            strokes: [{ points: [[0.2, 0.4]], radius: 0.1 }],
          },
        } as any}
        getRectangle={() => ({ x: 0, y: 0, width: 100, height: 80 } as any)}
      />
    );

    await waitFor(() => {
      expect(
        (container.querySelector('.image-origin') as HTMLImageElement)?.getAttribute(
          'src'
        )
      ).toBe('data:image/png;base64,masked');
    });

    expect(mockApplyImageEraseMask).toHaveBeenCalledWith(
      'https://example.com/demo.png',
      {
        version: 1,
        strokes: [{ points: [[0.2, 0.4]], radius: 0.1 }],
      }
    );
  });

  it('合成失败时会回退到原图 url', async () => {
    mockApplyImageEraseMask.mockRejectedValue(new Error('mask failed'));

    const { container } = render(
      <Image
        board={{} as any}
        imageItem={{ url: 'https://example.com/fallback.png' } as any}
        element={{
          id: 'image-3',
          eraseMask: {
            version: 1,
            strokes: [{ points: [[0.3, 0.5]], radius: 0.08 }],
          },
        } as any}
        getRectangle={() => ({ x: 0, y: 0, width: 100, height: 80 } as any)}
      />
    );

    await waitFor(() => {
      expect(
        (container.querySelector('.image-origin') as HTMLImageElement)?.getAttribute(
          'src'
        )
      ).toBe('https://example.com/fallback.png');
    });
  });
});
