const mockGetSelectedElements = jest.fn();
const mockSetNode = jest.fn();
const mockSetFontFamily = jest.fn();

const patchNodeAtPath = (
  children: Record<string, unknown>[],
  path: number[],
  patch: Record<string, unknown>
) => {
  const [index, ...rest] = path;
  if (index === undefined) {
    return;
  }
  if (rest.length === 0) {
    Object.assign(children[index]!, patch);
    return;
  }
  const target = children[index] as Record<string, unknown>;
  const nestedChildren = target['children'] as Record<string, unknown>[];
  patchNodeAtPath(nestedChildren, rest, patch);
};

jest.mock('@plait/common', () => ({
  PropertyTransforms: {
    setFillColor: jest.fn(),
    setStrokeColor: jest.fn(),
  },
}));

jest.mock('@plait/core', () => ({
  getSelectedElements: (...args: unknown[]) => mockGetSelectedElements(...args),
  isNullOrUndefined: (value: unknown) => value === null || value === undefined,
  Path: {},
  PlaitBoard: {
    findPath: jest.fn(),
  },
  PlaitElement: {},
  Transforms: {
    setNode: (...args: unknown[]) => mockSetNode(...args),
  },
}));

jest.mock('@plait/draw', () => ({
  getMemorizeKey: jest.fn(),
  isDrawElementsIncludeText: (elements: Array<Record<string, unknown>>) =>
    elements.some((element) => Boolean(element.text)),
  PlaitDrawElement: {
    isDrawElement: (element: Record<string, unknown>) =>
      ['geometry', 'image'].includes(String(element.type || '')),
  },
}));

jest.mock('@plait/mind', () => ({
  MindElement: {
    isMindElement: () => false,
  },
}));

jest.mock('@plait/text-plugins', () => ({
  DEFAULT_FONT_SIZE: 16,
  TextTransforms: {
    setTextColor: jest.fn(),
    setFontSize: jest.fn(),
    setFontFamily: (...args: unknown[]) => mockSetFontFamily(...args),
  },
}));

jest.mock('../utils/color', () => ({
  applyOpacityToHex: jest.fn(),
  hexAlphaToOpacity: jest.fn(),
  isFullyOpaque: jest.fn(),
  isNoColor: jest.fn(),
  isValidColor: jest.fn(),
  removeHexAlpha: jest.fn(),
}));

jest.mock('../utils/property', () => ({
  getCurrentFill: jest.fn(),
  getCurrentStrokeColor: jest.fn(),
  isClosedElement: jest.fn(),
}));

import {
  applyFontSchemeToCanvas,
  setTextFontFamily,
} from './property';

describe('property font family transforms', () => {
  beforeEach(() => {
    mockGetSelectedElements.mockReset();
    mockSetNode.mockReset();
    mockSetFontFamily.mockReset();
    mockSetNode.mockImplementation(
      (
        board: { children: Record<string, unknown>[] },
        patch: Record<string, unknown>,
        path: number[]
      ) => {
        patchNodeAtPath(board.children, path, patch);
      }
    );
  });

  it('updates both native text leaves and svg-import fragments when setting a font family', () => {
    const nativeText = {
      id: 'native',
      type: 'geometry',
      shape: 'text',
      text: {
        type: 'paragraph',
        children: [
          {
            text: 'Hello',
            ['font-family']: 'Arial, sans-serif',
            fontWeight: 'bold',
          },
        ],
      },
      textStyle: {
        fontFamily: 'Arial, sans-serif',
        ['font-family']: 'Arial, sans-serif',
        fontSize: 16,
      },
      textProperties: {
        fontFamily: 'Arial, sans-serif',
        ['font-family']: 'Arial, sans-serif',
        ['font-size']: '16',
      },
      svgImportMetadata: {
        source: 'svg-import',
        importMode: 'native',
        sourceFontSize: 16,
        sourceRotation: 0,
        textRole: 'title',
        isPlaceholder: false,
      },
    } as any;
    const fragmentText = {
      id: 'fragment',
      type: 'image',
      url: 'data:image/svg+xml;charset=utf-8,old',
      sceneImportMetadata: {
        kind: 'text-fragment',
        source: 'svg-import',
        sourceElementId: 'fragment',
        sourceText: 'Caption',
        text: 'Caption',
        textRole: 'annotation',
        classList: [],
        hasEmoji: false,
        hasDecorativeSymbol: false,
        hasTspan: false,
        hasTransform: false,
        fontFamilies: [],
        style: {
          fontFamily: 'Arial, sans-serif',
          fontSize: 12,
          fill: '#111111',
        },
        layout: {
          width: 120,
          height: 24,
        },
      },
      svgImportMetadata: {
        source: 'svg-import',
        importMode: 'fragment',
        sourceFontSize: 12,
        sourceRotation: 0,
        textRole: 'annotation',
        isPlaceholder: false,
      },
    } as any;
    const board = {
      children: [nativeText, fragmentText],
    } as any;

    mockGetSelectedElements.mockReturnValue([nativeText, fragmentText]);

    setTextFontFamily(board, 'Georgia, serif');

    expect(mockSetFontFamily).toHaveBeenCalled();
    expect(nativeText.textStyle.fontFamily).toContain('Georgia');
    expect(nativeText.textProperties.fontFamily).toContain('Georgia');
    expect(nativeText.textProperties['font-family']).toContain('Georgia');
    expect(nativeText.text.children[0]['font-family']).toContain('Georgia');
    expect(fragmentText.sceneImportMetadata.style.fontFamily).toContain('Georgia');
    expect(decodeURIComponent(fragmentText.url)).toContain('Georgia');
  });

  it('applies the current font scheme across the whole canvas by text role', () => {
    const nativeTitle = {
      id: 'title',
      type: 'geometry',
      shape: 'text',
      text: {
        type: 'paragraph',
        children: [{ text: 'Title', ['font-family']: 'Arial, sans-serif' }],
      },
      textStyle: {
        fontFamily: 'Arial, sans-serif',
        ['font-family']: 'Arial, sans-serif',
        fontSize: 18,
      },
      textProperties: {
        fontFamily: 'Arial, sans-serif',
        ['font-family']: 'Arial, sans-serif',
        ['font-size']: '18',
      },
      svgImportMetadata: {
        source: 'svg-import',
        importMode: 'native',
        sourceFontSize: 18,
        sourceRotation: 0,
        textRole: 'title',
        isPlaceholder: false,
      },
    } as any;
    const plainText = {
      id: 'plain',
      type: 'geometry',
      shape: 'text',
      text: {
        type: 'paragraph',
        children: [{ text: 'Body', ['font-family']: 'Arial, sans-serif' }],
      },
      textStyle: {
        fontFamily: 'Arial, sans-serif',
        ['font-family']: 'Arial, sans-serif',
        fontSize: 14,
      },
      textProperties: {
        fontFamily: 'Arial, sans-serif',
        ['font-family']: 'Arial, sans-serif',
        ['font-size']: '14',
      },
    } as any;
    const fragmentAnnotation = {
      id: 'annotation',
      type: 'image',
      url: 'data:image/svg+xml;charset=utf-8,old',
      sceneImportMetadata: {
        kind: 'text-fragment',
        source: 'svg-import',
        sourceElementId: 'annotation',
        sourceText: '(note)',
        text: '(note)',
        textRole: 'annotation',
        classList: [],
        hasEmoji: false,
        hasDecorativeSymbol: false,
        hasTspan: false,
        hasTransform: false,
        fontFamilies: [],
        style: {
          fontFamily: 'Arial, sans-serif',
          fontSize: 12,
          fill: '#111111',
        },
        layout: {
          width: 160,
          height: 28,
        },
      },
      svgImportMetadata: {
        source: 'svg-import',
        importMode: 'fragment',
        sourceFontSize: 12,
        sourceRotation: 0,
        textRole: 'annotation',
        isPlaceholder: false,
      },
    } as any;
    const board = {
      children: [nativeTitle, plainText, fragmentAnnotation],
    } as any;

    applyFontSchemeToCanvas(board, {
      title: '"Times New Roman", serif',
      annotation: 'Georgia, serif',
      plain: 'Verdana, sans-serif',
    });

    expect(nativeTitle.textStyle.fontFamily).toContain('Times New Roman');
    expect(nativeTitle.textStyle.fontSize).toBe(18);
    expect(nativeTitle.textProperties.fontFamily).toContain('Times New Roman');
    expect(nativeTitle.text.children[0]['font-family']).toContain('Times New Roman');

    expect(plainText.textStyle.fontFamily).toContain('Verdana');
    expect(plainText.textProperties.fontFamily).toContain('Verdana');
    expect(plainText.text.children[0]['font-family']).toContain('Verdana');

    expect(fragmentAnnotation.sceneImportMetadata.style.fontFamily).toContain('Georgia');
    expect(decodeURIComponent(fragmentAnnotation.url)).toContain('Georgia');
  });
});
