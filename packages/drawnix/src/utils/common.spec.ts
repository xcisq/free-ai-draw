import { boardToImage, exportBoardToRasterBlob } from './common';
import { toSvgData } from '@plait/core';

jest.mock('@plait/core', () => ({
  IS_APPLE: false,
  IS_MAC: false,
  toSvgData: jest.fn(),
}));

describe('raster export', () => {
  const toSvgDataMock = toSvgData as jest.MockedFunction<typeof toSvgData>;
  const originalImage = globalThis.Image;
  const originalCreateObjectURL = window.URL.createObjectURL;
  const originalRevokeObjectURL = window.URL.revokeObjectURL;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const exportedSvgBlobs: Blob[] = [];
  const drawImageMock = jest.fn();
  const fillTextMock = jest.fn();
  const fillRectMock = jest.fn();
  const saveMock = jest.fn();
  const restoreMock = jest.fn();
  const setTransformMock = jest.fn();
  const transformMock = jest.fn();
  const canvasContext = {
    drawImage: drawImageMock,
    fillText: fillTextMock,
    fillRect: fillRectMock,
    save: saveMock,
    restore: restoreMock,
    setTransform: setTransformMock,
    transform: transformMock,
    fillStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D;

  const imageSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 100 80">
      <foreignObject x="10" y="12" width="40" height="30" transform="translate(2 3)">
        <div xmlns="http://www.w3.org/1999/xhtml">
          <img src="data:image/png;base64,abc" />
        </div>
      </foreignObject>
    </svg>
  `;

  const readBlobText = (blob: Blob) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () =>
        reject(reader.error || new Error('Failed to read exported SVG blob'));
      reader.readAsText(blob);
    });
  };

  beforeEach(() => {
    exportedSvgBlobs.length = 0;
    drawImageMock.mockReset();
    fillTextMock.mockReset();
    fillRectMock.mockReset();
    saveMock.mockReset();
    restoreMock.mockReset();
    setTransformMock.mockReset();
    transformMock.mockReset();
    toSvgDataMock.mockReset();
    toSvgDataMock.mockResolvedValue(imageSvg);

    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn((blob: Blob | MediaSource) => {
        exportedSvgBlobs.push(blob as Blob);
        return `blob:drawnix-export-${exportedSvgBlobs.length}`;
      }),
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: jest.fn(() => canvasContext),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: jest.fn((callback: BlobCallback, type?: string) => {
        callback(new Blob(['raster'], { type: type || 'image/png' }));
      }),
    });
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      value: class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          this.onload?.();
        }
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      value: originalImage,
    });
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: originalRevokeObjectURL,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: originalGetContext,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: originalToBlob,
    });
  });

  it('converts foreignObject images to native SVG images before canvas export', async () => {
    const board = { children: [] } as any;

    const blob = await exportBoardToRasterBlob(board, {
      fillStyle: 'transparent',
    });

    expect(blob.type).toBe('image/png');
    expect(toSvgDataMock).toHaveBeenCalledWith(
      board,
      expect.objectContaining({
        fillStyle: 'transparent',
        inlineStyleClassNames:
          '.extend,.emojis,.text,.drawnix-image,.image-origin,.plait-text-container',
        styleNames: expect.arrayContaining([
          'position',
          'display',
          'width',
          'height',
          'overflow',
          'object-fit',
          'z-index',
        ]),
        padding: 20,
        ratio: 4,
      })
    );
    // JSDOM's Blob may not implement .text() depending on runtime/polyfills.
    const exportedSvg = await readBlobText(exportedSvgBlobs[0]);
    expect(exportedSvg).toContain('<image');
    expect(exportedSvg).toContain('x="10"');
    expect(exportedSvg).toContain('y="12"');
    expect(exportedSvg).toContain('width="40"');
    expect(exportedSvg).toContain('height="30"');
    expect(exportedSvg).toContain('transform="translate(2 3)"');
    expect(exportedSvg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(exportedSvg).not.toContain('foreignObject');
  });

  it('converts top-level text foreignObjects into SVG text/tspan so canvas stays origin-clean', async () => {
    const board = { children: [] } as any;
    toSvgDataMock.mockResolvedValue(`
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60">
        <foreignObject x="8" y="9" width="80" height="24" transform="rotate(5)">
          <div xmlns="http://www.w3.org/1999/xhtml" class="plait-text-container">
            <span data-slate-node="text" style="font-size: 18px; font-family: Arial; font-weight: 700; color: rgb(1, 2, 3); line-height: 22px;">Hello</span>
          </div>
        </foreignObject>
      </svg>
    `);

    await exportBoardToRasterBlob(board);

    const exportedSvg = await readBlobText(exportedSvgBlobs[0]);
    expect(exportedSvg).not.toContain('foreignObject');
    expect(exportedSvg).toContain('<text');
    expect(exportedSvg).toContain('<tspan');
    expect(exportedSvg).toContain('font-family="Arial"');
    expect(exportedSvg).toContain('font-size="18px"');
    expect(fillTextMock).not.toHaveBeenCalled();
  });

  it('converts multi-line text foreignObjects into multiple tspans', async () => {
    const board = { children: [] } as any;
    toSvgDataMock.mockResolvedValue(`
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">
        <foreignObject x="10" y="12" width="120" height="60">
          <div xmlns="http://www.w3.org/1999/xhtml" class="plait-text-container">
            <div data-slate-node="element">
              <span data-slate-node="text" style="font-size: 16px; font-family: Arial; color: #111827; line-height: 20px;">Line 1</span>
            </div>
            <div data-slate-node="element">
              <span data-slate-node="text" style="font-size: 16px; font-family: Arial; color: #111827; line-height: 20px;">Line 2</span>
            </div>
          </div>
        </foreignObject>
      </svg>
    `);

    await exportBoardToRasterBlob(board);

    const exportedSvg = await readBlobText(exportedSvgBlobs[0]);
    expect(exportedSvg).not.toContain('foreignObject');
    expect(exportedSvg).toContain('Line 1');
    expect(exportedSvg).toContain('Line 2');
    expect((exportedSvg.match(/<tspan/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(fillTextMock).not.toHaveBeenCalled();
  });

  it('preserves per-leaf font-family in svg tspan conversion', async () => {
    const board = { children: [] } as any;
    toSvgDataMock.mockResolvedValue(`
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60">
        <foreignObject x="10" y="10" width="180" height="30">
          <div xmlns="http://www.w3.org/1999/xhtml" class="plait-text-container">
            <div data-slate-node="element">
              <span data-slate-node="text" style="font-size: 16px; font-family: Arial;">Hello </span>
              <span data-slate-node="text" style="font-size: 16px; font-family: &quot;Noto Serif SC&quot;;">World</span>
            </div>
          </div>
        </foreignObject>
      </svg>
    `);

    await exportBoardToRasterBlob(board);

    const exportedSvg = await readBlobText(exportedSvgBlobs[0]);
    expect(exportedSvg).toContain('font-family="Arial"');
    expect(exportedSvg).toContain('font-family="&quot;Noto Serif SC&quot;"');
    expect(fillTextMock).not.toHaveBeenCalled();
  });

  it('does not duplicate text when foreignObject contains nested slate wrappers', async () => {
    const board = { children: [] } as any;
    toSvgDataMock.mockResolvedValue(`
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60">
        <foreignObject x="10" y="10" width="180" height="30">
          <div xmlns="http://www.w3.org/1999/xhtml" class="plait-text-container">
            <div data-slate-node="element">
              <span data-slate-node="text">
                <span data-slate-leaf="true" style="font-size: 16px; font-family: Arial;">
                  <span data-slate-string="true">Hello</span>
                </span>
              </span>
            </div>
          </div>
        </foreignObject>
      </svg>
    `);

    await exportBoardToRasterBlob(board);

    const exportedSvg = await readBlobText(exportedSvgBlobs[0]);
    expect((exportedSvg.match(/Hello/g) || []).length).toBe(1);
    expect((exportedSvg.match(/<tspan/g) || []).length).toBe(1);
  });

  it('sanitizes nested SVG data URL images before canvas export', async () => {
    const board = { children: [] } as any;
    const nestedSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 40 20">
        <foreignObject x="1" y="2" width="38" height="16">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <span data-slate-node="text" style="font-size: 12px; font-family: Arial; color: #111827;">Nested</span>
          </div>
        </foreignObject>
      </svg>
    `;
    const nestedDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      nestedSvg
    )}`;
    toSvgDataMock.mockResolvedValue(`
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 100 80">
        <image x="10" y="12" width="40" height="20" href="${nestedDataUrl}" />
      </svg>
    `);

    await exportBoardToRasterBlob(board);

    const exportedSvg = await readBlobText(exportedSvgBlobs[0]);
    const href = exportedSvg.match(/href="([^"]+)"/)?.[1] || '';
    const decodedHref = decodeURIComponent(href.slice(href.indexOf(',') + 1));
    expect(exportedSvg).not.toContain(encodeURIComponent('foreignObject'));
    expect(decodedHref).not.toContain('foreignObject');
    expect(decodedHref).toContain('<text');
    expect(decodedHref).toContain('Nested');
  });

  it('removes residual foreignObjects (e.g. iframes) to avoid tainting the export canvas', async () => {
    const board = { children: [] } as any;
    toSvgDataMock.mockResolvedValue(`
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 100 80">
        <foreignObject x="0" y="0" width="100" height="80">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <iframe src="https://example.com"></iframe>
          </div>
        </foreignObject>
      </svg>
    `);

    await exportBoardToRasterBlob(board);

    const exportedSvg = await readBlobText(exportedSvgBlobs[0]);
    expect(exportedSvg).not.toContain('foreignObject');
  });

  it('exports real jpeg blobs with an opaque background', async () => {
    const board = { children: [] } as any;

    const blob = await exportBoardToRasterBlob(board, {
      fillStyle: '#f7f8fb',
      format: 'jpeg',
    });

    expect(blob.type).toBe('image/jpeg');
    expect(fillRectMock).toHaveBeenCalledWith(0, 0, 400, 320);
    expect(canvasContext.fillStyle).toBe('#f7f8fb');
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      undefined
    );
  });

  it('downscales very large boards to stay within browser canvas limits', async () => {
    const board = { children: [] } as any;
    toSvgDataMock.mockResolvedValue(`
      <svg xmlns="http://www.w3.org/2000/svg" width="20000" height="10000" viewBox="0 0 20000 10000">
        <rect x="0" y="0" width="20000" height="10000" fill="#fff" />
      </svg>
    `);

    await exportBoardToRasterBlob(board, { ratio: 4 });

    const [, , outputWidth, outputHeight] = drawImageMock.mock.calls[0];
    expect(outputWidth).toBeLessThanOrEqual(16384);
    expect(outputHeight).toBeLessThanOrEqual(16384);
    expect(outputWidth * outputHeight).toBeLessThanOrEqual(67108864);
  });

  it('passes selected elements through to SVG export', async () => {
    const board = { children: [] } as any;
    const selectedElements = [{ id: 'shape-1' }];

    await exportBoardToRasterBlob(board, {
      elements: selectedElements as any,
    });

    expect(toSvgDataMock).toHaveBeenCalledWith(
      board,
      expect.objectContaining({
        elements: selectedElements,
      })
    );
  });

  it('keeps boardToImage compatible by returning a PNG data URL', async () => {
    const board = { children: [] } as any;

    const image = await boardToImage(board, { fillStyle: 'transparent' });

    expect(image).toMatch(/^data:image\/png;base64,/);
  });
});
