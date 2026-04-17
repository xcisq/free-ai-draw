import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import AutodrawDialog from './autodraw-dialog';
import { importBundlePackage } from '../../scene-import/import-bundle-package';

const mockInsertFragment = jest.fn();
const mockSetAppState = jest.fn();
const mockBoardContainer = {
  getBoundingClientRect: () => ({
    width: 1200,
    height: 800,
    top: 0,
    left: 0,
    right: 1200,
    bottom: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }),
};

const mockBoard = {
  viewport: {
    zoom: 1,
  },
  children: [],
  insertFragment: (...args: unknown[]) => mockInsertFragment(...args),
} as any;

const createJsonResponse = (data: unknown) =>
  ({
    ok: true,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);

const createBlobResponse = (blob: Blob) =>
  ({
    ok: true,
    blob: async () => blob,
    text: async () => '',
  } as Response);

const createBundleImportResult = () => ({
  importKind: 'svg' as const,
  fallbackReason: undefined,
  descriptionLines: [],
  summary: {
    textCount: 1,
    arrowCount: 1,
    rectCount: 1,
    componentCount: 1,
    ignoredBackgroundCount: 0,
    warnings: [],
  },
  elements: [
    {
      id: 'shape-1',
      type: 'shape',
      shape: 'rectangle',
      points: [
        [0, 0],
        [120, 80],
      ],
    },
    {
      id: 'image-1',
      type: 'image',
      points: [
        [150, 10],
        [230, 90],
      ],
    },
    {
      id: 'arrow-1',
      type: 'arrow-line',
      points: [
        [120, 40],
        [150, 40],
      ],
    },
    {
      id: 'text-1',
      type: 'shape',
      shape: 'text',
      text: [{ text: 'pipeline' }],
      textStyle: { fontSize: 14 },
      points: [
        [20, 100],
        [180, 130],
      ],
    },
  ] as any[],
});

const createLayerSensitiveBundleImportResult = () => ({
  importKind: 'svg' as const,
  fallbackReason: undefined,
  descriptionLines: [],
  summary: {
    textCount: 1,
    arrowCount: 1,
    rectCount: 2,
    componentCount: 1,
    ignoredBackgroundCount: 0,
    warnings: [],
  },
  elements: [
    {
      id: 'background-rect',
      type: 'shape',
      shape: 'rectangle',
      points: [
        [0, 0],
        [300, 180],
      ],
    },
    {
      id: 'icon-foreground',
      type: 'image',
      points: [
        [40, 40],
        [120, 120],
      ],
    },
    {
      id: 'label-backdrop',
      type: 'shape',
      shape: 'rectangle',
      points: [
        [140, 30],
        [260, 90],
      ],
    },
    {
      id: 'label-text',
      type: 'shape',
      shape: 'text',
      text: [{ text: 'label' }],
      textStyle: { fontSize: 14 },
      points: [
        [150, 45],
        [240, 75],
      ],
    },
    {
      id: 'connector',
      type: 'arrow-line',
      points: [
        [120, 80],
        [180, 80],
      ],
    },
  ] as any[],
});

jest.mock('@plait-board/react-board', () => ({
  useBoard: () => mockBoard,
}));

jest.mock('@plait/core', () => ({
  getViewportOrigination: () => [0, 0],
  PlaitBoard: {
    getBoardContainer: () => mockBoardContainer,
    findPath: () => [0],
  },
  PlaitElement: {},
  PlaitGroupElement: {
    isGroup: () => false,
  },
  PlaitHistoryBoard: {
    withNewBatch: (_board: unknown, callback: () => void) => callback(),
  },
  RectangleClient: {
    getRectangleByPoints: (points: [number, number][]) => {
      const xs = points.map((point) => point[0]);
      const ys = points.map((point) => point[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    },
    getBoundingRectangle: (
      rectangles: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
      }>
    ) => {
      const xs = rectangles.flatMap((rectangle) => [
        rectangle.x,
        rectangle.x + rectangle.width,
      ]);
      const ys = rectangles.flatMap((rectangle) => [
        rectangle.y,
        rectangle.y + rectangle.height,
      ]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    },
  },
  Transforms: {
    setNode: jest.fn(),
  },
  WritableClipboardOperationType: {
    paste: 'paste',
  },
}));

jest.mock('../../hooks/use-drawnix', () => ({
  DialogType: {
    autodraw: 'autodraw',
  },
  useDrawnix: () => ({
    appState: {
      openDialogType: 'autodraw',
      pointer: 'selection',
      isMobile: false,
      isPencilMode: false,
      openCleanConfirm: false,
    },
    setAppState: mockSetAppState,
  }),
}));

jest.mock('../../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../scene-import/import-bundle-package', () => ({
  importBundlePackage: jest.fn(),
}));

describe('AutodrawDialog import semantics', () => {
  const mockFetch = jest.fn();
  const importBundlePackageMock = importBundlePackage as jest.MockedFunction<
    typeof importBundlePackage
  >;
  const clipboardWriteText = jest.fn();
  const originalFetch = global.fetch;
  const originalMatchMedia = window.matchMedia;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    mockInsertFragment.mockReset();
    mockSetAppState.mockReset();
    importBundlePackageMock.mockReset();
    clipboardWriteText.mockReset();
    mockFetch.mockReset();
    // AutodrawDialog mounts and auto-requests the runtime job list.
    mockFetch.mockResolvedValue(createJsonResponse([]));
    localStorage.clear();
    global.fetch = mockFetch as typeof fetch;
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  });

  it('keeps assembly preview but inserts the imported bundle only once', async () => {
    const bundleBlob = new Blob(['zip'], { type: 'application/zip' });
    mockFetch
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockResolvedValueOnce(
        createJsonResponse({
          job_id: 'job-1',
          status: 'succeeded',
          bundle_url: '/bundle.zip',
          current_stage: 4,
          failed_stage: null,
          artifacts: [
            {
              name: 'figure.png',
              path: 'figure.png',
              kind: 'figure',
              size_bytes: 100,
              download_url: '/api/jobs/job-1/artifacts/figure.png',
            },
            {
              name: 'final.svg',
              path: 'final.svg',
              kind: 'final_svg',
              size_bytes: 100,
              download_url: '/api/jobs/job-1/artifacts/final.svg',
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          job_id: 'job-1',
          offset: 0,
          next_offset: 0,
          completed: true,
          lines: ['done'],
        })
      )
      .mockResolvedValueOnce(createBlobResponse(bundleBlob));

    importBundlePackageMock.mockResolvedValue(createBundleImportResult());

    render(<AutodrawDialog />);

    fireEvent.change(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder'),
      {
        target: {
          value: 'job-1',
        },
      }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(importBundlePackageMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(
      () => {
        expect(mockInsertFragment.mock.calls.length).toBeGreaterThan(1);
      },
      { timeout: 1500 }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.returnWorkbench' })
      );
      await Promise.resolve();
    });

    expect(
      screen.getByRole('button', { name: 'dialog.autodraw.resume' })
    ).toBeTruthy();
    expect(
      screen.getAllByRole('button', { name: 'dialog.autodraw.copyJobId' })
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: 'dialog.autodraw.viewFlow' }).length
    ).toBeGreaterThan(0);
    expect(screen.getByText('figure.png')).toBeTruthy();
  });

  it('imports a local zip directly without requesting backend job data', async () => {
    importBundlePackageMock.mockResolvedValue(createBundleImportResult());

    const { container } = render(<AutodrawDialog />);
    const zipInput = container.querySelector('#bundle-zip') as HTMLInputElement;
    const file = new File(['zip'], 'bundle.zip', { type: 'application/zip' });

    await act(async () => {
      fireEvent.change(zipInput, {
        target: {
          files: [file],
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(importBundlePackageMock).toHaveBeenCalledWith(file);
    });

    await waitFor(() => {
      expect(mockInsertFragment.mock.calls.length).toBeGreaterThan(1);
    });

    // Only the runtime jobs list request should be sent.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).toContain('/api/jobs?limit=20');
  });

  it('keeps imported element order stable across animated insertion batches', async () => {
    importBundlePackageMock.mockResolvedValue(
      createLayerSensitiveBundleImportResult()
    );

    const { container } = render(<AutodrawDialog />);
    const zipInput = container.querySelector('#bundle-zip') as HTMLInputElement;
    const file = new File(['zip'], 'bundle.zip', { type: 'application/zip' });

    await act(async () => {
      fireEvent.change(zipInput, {
        target: {
          files: [file],
        },
      });
      await Promise.resolve();
    });

    let insertedIds: Array<string | undefined> = [];
    await waitFor(() => {
      insertedIds = mockInsertFragment.mock.calls.flatMap((call) => {
        const fragment = call[0] as { elements?: Array<{ id?: string }> };
        return (fragment.elements || []).map((element) => element.id);
      });
      expect(insertedIds).toHaveLength(5);
    }, { timeout: 4000 });

    expect(insertedIds).toEqual([
      'background-rect',
      'icon-foreground',
      'label-backdrop',
      'label-text',
      'connector',
    ]);
  });

  it('lists runtime jobs in history and lets the user load them', async () => {
    const bundleBlob = new Blob(['zip'], { type: 'application/zip' });
    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            job_id: 'job-list-1',
            status: 'succeeded',
            created_at: '2026-04-16T10:00:00.000Z',
            current_stage: 5,
            failed_stage: null,
            artifacts: [
              {
                name: 'figure.png',
                path: 'figure.png',
                kind: 'figure',
                size_bytes: 100,
                download_url: '/api/jobs/job-list-1/artifacts/figure.png',
              },
            ],
            bundle_url: '/api/jobs/job-list-1/bundle',
          },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          job_id: 'job-list-1',
          status: 'succeeded',
          bundle_url: '/bundle.zip',
          current_stage: 4,
          failed_stage: null,
          artifacts: [
            {
              name: 'figure.png',
              path: 'figure.png',
              kind: 'figure',
              size_bytes: 100,
              download_url: '/api/jobs/job-list-1/artifacts/figure.png',
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          job_id: 'job-list-1',
          offset: 0,
          next_offset: 0,
          completed: true,
          lines: ['done'],
        })
      )
      .mockResolvedValueOnce(createBlobResponse(bundleBlob));

    importBundlePackageMock.mockResolvedValue(createBundleImportResult());

    const { container } = render(<AutodrawDialog />);

    await waitFor(() => {
      expect(
        container.querySelectorAll('.autodraw-history-card').length
      ).toBeGreaterThan(0);
    });

    await act(async () => {
      fireEvent.click(
        screen.getAllByRole('button', { name: 'dialog.autodraw.viewFlow' })[0]
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(importBundlePackageMock).toHaveBeenCalledTimes(1);
    });
  });

  it('copies the current job id after a successful load', async () => {
    const bundleBlob = new Blob(['zip'], { type: 'application/zip' });
    mockFetch
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockResolvedValueOnce(
        createJsonResponse({
          job_id: 'job-9',
          status: 'succeeded',
          bundle_url: '/bundle.zip',
          current_stage: 4,
          failed_stage: null,
          artifacts: [
            {
              name: 'figure.png',
              path: 'figure.png',
              kind: 'figure',
              size_bytes: 100,
              download_url: '/api/jobs/job-9/artifacts/figure.png',
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          job_id: 'job-9',
          offset: 0,
          next_offset: 0,
          completed: true,
          lines: ['done'],
        })
      )
      .mockResolvedValueOnce(createBlobResponse(bundleBlob));

    importBundlePackageMock.mockResolvedValue(createBundleImportResult());

    const { container } = render(<AutodrawDialog />);

    fireEvent.change(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder'),
      {
        target: {
          value: 'job-9',
        },
      }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.returnWorkbench' })
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.returnWorkbench' })
      );
      await Promise.resolve();
    });

    await act(async () => {
      const currentJobCopyButton = container.querySelector(
        '.autodraw-dialog__job-actions .autodraw-button--secondary'
      ) as HTMLButtonElement | null;
      expect(currentJobCopyButton).toBeTruthy();
      fireEvent.click(currentJobCopyButton as HTMLButtonElement);
      await Promise.resolve();
    });

    expect(clipboardWriteText).toHaveBeenCalledWith('job-9');
    expect(
      screen.getByRole('button', { name: 'dialog.autodraw.copied' })
    ).toBeTruthy();
  });

  it('restores the persisted draft when the dialog opens again', () => {
    localStorage.setItem(
      'drawnix:autodraw-draft:v2',
      JSON.stringify({
        methodText: 'restored pipeline',
        jobId: 'job-persisted',
        jobIdInput: 'job-persisted',
        provider: 'qingyun',
        showAdvanced: true,
      })
    );

    render(<AutodrawDialog />);

    expect(
      screen.getByPlaceholderText('dialog.autodraw.placeholder')
    ).toMatchObject({
      value: 'restored pipeline',
    });
    expect(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder')
    ).toMatchObject({
      value: 'job-persisted',
    });
  });

  it('keeps prior history entries when a new job snapshot is persisted', async () => {
    const bundleBlob = new Blob(['zip'], { type: 'application/zip' });
    localStorage.setItem(
      'drawnix:autodraw-history:v1',
      JSON.stringify([
        {
          id: 'job:old-job:1',
          type: 'job',
          title: 'old-job',
          subtitle: 'Generated job',
          status: 'succeeded',
          createdAt: '2026-04-15T10:00:00.000Z',
          jobId: 'old-job',
        },
      ])
    );

    mockFetch
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockResolvedValueOnce(
        createJsonResponse({
          job_id: 'job-20',
          status: 'succeeded',
          bundle_url: '/bundle.zip',
          current_stage: 4,
          failed_stage: null,
          artifacts: [
            {
              name: 'figure.png',
              path: 'figure.png',
              kind: 'figure',
              size_bytes: 100,
              download_url: '/api/jobs/job-20/artifacts/figure.png',
            },
          ],
          created_at: '2026-04-16T12:00:00.000Z',
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          job_id: 'job-20',
          offset: 0,
          next_offset: 0,
          completed: true,
          lines: ['done'],
        })
      )
      .mockResolvedValueOnce(createBlobResponse(bundleBlob));

    importBundlePackageMock.mockResolvedValue(createBundleImportResult());

    render(<AutodrawDialog />);

    fireEvent.change(
      screen.getByPlaceholderText('dialog.autodraw.existingJobPlaceholder'),
      {
        target: {
          value: 'job-20',
        },
      }
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.loadJob' })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'dialog.autodraw.returnWorkbench' })
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'dialog.autodraw.returnWorkbench' })
      );
      await Promise.resolve();
    });

    expect(screen.getByText('old-job')).toBeTruthy();
    expect(screen.getAllByText('job-20').length).toBeGreaterThan(0);
  });
});
