import { zipSync } from 'fflate';
import { setProjectFontRoleFamilies } from '../constants/font';
import { importScenePackage } from './import-scene-package';

const encodeUtf8 = (value: string) =>
  new Uint8Array(Array.from(value).map((char) => char.charCodeAt(0)));

jest.mock('@plait/draw', () => ({
  ArrowLineMarkerType: {
    none: 'none',
    arrow: 'arrow',
  },
  ArrowLineShape: {
    straight: 'straight',
    elbow: 'elbow',
  },
  BasicShapes: {
    text: 'text',
    rectangle: 'rectangle',
    roundRectangle: 'roundRectangle',
    ellipse: 'ellipse',
    diamond: 'diamond',
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
    options?: Record<string, unknown>,
    textProperties?: Record<string, unknown>
  ) => ({
    id: '',
    type: 'geometry',
    shape,
    points,
    text,
    textProperties,
    ...options,
  }),
}));

describe('importScenePackage', () => {
  afterEach(() => {
    setProjectFontRoleFamilies(undefined);
  });

  it('prefers configured role fonts over source font-family during scene import', async () => {
    setProjectFontRoleFamilies({
      title: 'Georgia, serif',
      plain: 'Verdana, sans-serif',
    });

    const archive = zipSync({
      'scene.json': encodeUtf8(
        JSON.stringify({
          type: 'drawnix-scene',
          version: '1.0.0',
          assets: [],
          elements: [
            {
              id: 'title',
              kind: 'text',
              text: 'Hello',
              layout: {
                x: 20,
                y: 30,
                width: 180,
                height: 40,
                anchor: 'start',
                baseline: 'alphabetic',
                rotation: 0,
                wrapMode: 'none',
              },
              style: {
                fontFamily: 'Courier New, monospace',
                fontSize: 24,
                fill: '#111111',
              },
              metadata: {
                textRole: 'title',
                fontFamilies: ['Courier New', 'monospace'],
              },
            },
          ],
        })
      ),
    });

    const file = new File([archive], 'scene.zip', { type: 'application/zip' });
    const result = await importScenePackage(file);
    const title = result.elements[0] as any;

    expect(title.textStyle.fontFamily).toContain('Georgia');
    expect(title.textProperties['font-family']).toContain('Georgia');
  });
});
