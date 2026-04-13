import { zipSync } from 'fflate';
import {
  convertSvgAssetPackageToDrawnix,
  convertSvgToDrawnix,
} from './convert-svg-to-drawnix';
import { parseSvgAssetPackage } from './parse-svg-package';

const encodeUtf8 = (value: string) =>
  new Uint8Array(Array.from(value).map((char) => char.charCodeAt(0)));

jest.mock('@plait/draw', () => ({
  ArrowLineMarkerType: {
    none: 'none',
    arrow: 'arrow',
  },
  ArrowLineShape: {
    straight: 'straight',
  },
  BasicShapes: {
    text: 'text',
  },
  createArrowLineElement: (
    shape: string,
    points: [number, number][],
    source: Record<string, unknown>,
    target: Record<string, unknown>,
    texts?: unknown,
    options?: Record<string, unknown>
  ) => ({
    id: '',
    type: 'arrow-line',
    shape,
    points,
    source,
    target,
    texts: texts ?? [],
    ...options,
  }),
  createGeometryElementWithText: (
    shape: string,
    points: [number, number][],
    text: string,
    options?: Record<string, unknown>
  ) => ({
    id: '',
    type: 'geometry',
    shape,
    points,
    text,
    ...options,
  }),
}));

describe('convertSvgToDrawnix', () => {
  const originalGetBBox = (globalThis as any).SVGElement?.prototype?.getBBox;

  beforeAll(() => {
    if (!(globalThis as any).SVGElement) {
      return;
    }
    (globalThis as any).SVGElement.prototype.getBBox = function () {
      const encoded = this.getAttribute?.('data-bbox');
      if (encoded) {
        const [x, y, width, height] = encoded
          .split(/[\s,]+/)
          .map((item: string) => Number.parseFloat(item));
        return { x, y, width, height };
      }
      const tagName = this.tagName?.toLowerCase?.() || '';
      if (tagName === 'text') {
        const x = Number(this.getAttribute?.('x') || 0);
        const fontSize = Number(this.getAttribute?.('font-size') || 16);
        const text = this.textContent || '';
        return {
          x,
          y: Number(this.getAttribute?.('y') || 0) - fontSize,
          width: Math.max(text.length * fontSize * 0.6, fontSize),
          height: Math.max(fontSize * 1.2, 20),
        };
      }
      return { x: 0, y: 0, width: 10, height: 10 };
    };
  });

  afterAll(() => {
    if (!(globalThis as any).SVGElement) {
      return;
    }
    (globalThis as any).SVGElement.prototype.getBBox = originalGetBBox;
  });

  it('extracts text, converts connector arrow, and keeps component image on svg coordinates', () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
        <style>
          .stroke-main { fill: none; stroke: #111; stroke-width: 2; }
          .fill-box { fill: #dbeafe; stroke: #111; stroke-width: 2; }
          .text-label { font-size: 20px; text-anchor: middle; fill: #222; }
        </style>
        <g>
          <rect id="bg" width="100%" height="100%" fill="#ffffff" />
          <rect id="box" class="fill-box" x="20" y="20" width="120" height="80" />
          <text id="label" class="text-label" x="80" y="70" data-bbox="32 44 96 26">Hello</text>
          <path id="arrow" class="stroke-main" d="m170,60l110,0l-5,-5m5,5l-5,5" />
          <image id="icon_AF04" x="300" y="10" width="50" height="60" href="data:image/png;base64,old" />
        </g>
      </svg>
    `;

    const result = convertSvgAssetPackageToDrawnix({
      fileName: 'final.svg',
      svgText: input,
      componentAssets: {
        icon_AF04: {
          id: 'icon_AF04',
          fileName: 'icon_AF04_nobg.png',
          url: 'data:image/png;base64,new',
        },
      },
    });

    expect(result.summary.ignoredBackgroundCount).toBe(1);
    expect(result.summary.textCount).toBe(1);
    expect(result.summary.arrowCount).toBe(1);
    expect(result.summary.componentCount).toBe(2);
    expect(result.elements[0]).toEqual(
      expect.objectContaining({
        id: 'svg-base-layer',
        type: 'image',
      })
    );
    expect(result.elements[1]).toEqual(
      expect.objectContaining({
        id: 'icon_AF04',
        type: 'image',
        url: 'data:image/png;base64,new',
        points: [
          [300, 10],
          [350, 70],
        ],
      })
    );
    expect(result.elements[2]).toEqual(
      expect.objectContaining({
        id: 'arrow',
        type: 'arrow-line',
      })
    );
    expect(result.elements[3]).toEqual(
      expect.objectContaining({
        id: 'label',
        type: 'geometry',
        shape: 'text',
        text: 'Hello',
        points: [
          [32, 44],
          [128, 70],
        ],
      })
    );
  });

  it('keeps unsupported path arrows inside component image', () => {
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">
        <style>
          .fill-arrow { fill: #E8E3D9; stroke: #111; stroke-width: 4; }
        </style>
        <g>
          <path id="fancy-arrow" class="fill-arrow" data-bbox="10 20 120 50" d="M10 50 Q 60 0 120 50" />
        </g>
      </svg>
    `;

    const result = convertSvgToDrawnix(input);

    expect(result.summary.arrowCount).toBe(0);
    expect(result.summary.componentCount).toBe(1);
    expect(result.elements[0]).toEqual(
      expect.objectContaining({
        id: 'fancy-arrow',
        type: 'image',
      })
    );
    expect(decodeURIComponent((result.elements[0] as any).url)).toContain('viewBox="6 16 128 58"');
  });

  it('parses zip package and prefers _nobg component asset', async () => {
    const archive = zipSync({
      'pic/final.svg': encodeUtf8('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      'pic/components/icon_AF04.png': new Uint8Array([1, 2, 3]),
      'pic/components/icon_AF04_nobg.png': new Uint8Array([4, 5, 6]),
    });

    const file = new File([archive], 'assets.zip', { type: 'application/zip' });
    const result = await parseSvgAssetPackage(file);

    expect(result.fileName).toBe('final.svg');
    expect(result.svgText).toContain('<svg');
    expect(Object.keys(result.componentAssets)).toEqual(['icon_AF04']);
    expect(result.componentAssets.icon_AF04.fileName).toBe('icon_AF04_nobg.png');
    expect(result.componentAssets.icon_AF04.url).toContain('data:image/png;base64');
  });
});
