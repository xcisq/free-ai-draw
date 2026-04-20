import { act, render } from '@testing-library/react';
import { Image } from './image';
import {
  resetImageGenerationTasks,
  syncImageGenerationTasks,
} from '../../image-edit/image-generation-store';

describe('Image', () => {
  beforeEach(() => {
    localStorage.setItem('language', 'zh');
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
});
