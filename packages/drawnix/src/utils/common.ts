import {
  IS_APPLE,
  IS_MAC,
  PlaitBoard,
  toSvgData,
  ToImageOptions,
} from '@plait/core';
import type { ResolutionType } from './utility-types';

const BOARD_EXPORT_INLINE_STYLE_CLASS_NAMES = [
  '.extend',
  '.emojis',
  '.text',
  '.drawnix-image',
  '.image-origin',
  '.plait-text-container',
].join(',');

const BOARD_EXPORT_STYLE_NAMES = [
  'position',
  'display',
  'width',
  'height',
  'overflow',
  'object-fit',
  'z-index',
  // Text layout styles for foreignObject-based text. These must be inlined because the
  // exported SVG is rendered in isolation (no page CSS), and we also rely on them when
  // repainting text onto canvas for origin-clean raster export.
  'text-align',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'box-sizing',
  'justify-content',
  'align-items',
  'flex-direction',
];

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const TRANSPARENT_SVG_SOURCE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
const TRANSPARENT_IMAGE_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  TRANSPARENT_SVG_SOURCE
)}`;
const MAX_RASTER_CANVAS_SIZE = 16384;
const MAX_RASTER_CANVAS_AREA = 67108864;
const MAX_NESTED_SVG_SANITIZE_DEPTH = 4;

export type RasterExportFormat = 'png' | 'jpeg';

export type RasterExportOptions = ToImageOptions & {
  format?: RasterExportFormat;
  quality?: number;
};

type SvgViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Matrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

type RasterTextFragment = {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  fontWeight?: string;
  fontStyle?: string;
  fill: string;
  lineHeight: number;
  textAlign: CanvasTextAlign;
  matrix: Matrix;
};

const splitFontFamilyCandidates = (value?: string) => {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const stripFontFamilyQuotes = (value: string) => value.replace(/^['"]|['"]$/g, '');

const isGenericFamily = (value: string) => {
  const normalized = stripFontFamilyQuotes(value).toLowerCase();
  return (
    normalized === 'serif' ||
    normalized === 'sans-serif' ||
    normalized === 'monospace' ||
    normalized === 'system-ui' ||
    normalized === 'cursive' ||
    normalized === 'fantasy'
  );
};

const resolveCanvasFontFamily = (payload: {
  fontFamily: string;
  fontSize: number;
  fontWeight?: string;
  fontStyle?: string;
}) => {
  if (typeof document === 'undefined') {
    return payload.fontFamily;
  }
  const fontFaceSet = (document as unknown as { fonts?: FontFaceSet }).fonts;
  if (!fontFaceSet || typeof fontFaceSet.check !== 'function') {
    return payload.fontFamily;
  }

  const candidates = splitFontFamilyCandidates(payload.fontFamily);
  for (const candidate of candidates) {
    if (isGenericFamily(candidate)) {
      return candidate;
    }
    const family = stripFontFamilyQuotes(candidate);
    const font = `${payload.fontStyle ? `${payload.fontStyle} ` : ''}${
      payload.fontWeight ? `${payload.fontWeight} ` : ''
    }${payload.fontSize}px "${family}"`;
    try {
      if (fontFaceSet.check(font)) {
        return `"${family}"`;
      }
    } catch {
      // ignore and continue
    }
  }
  return payload.fontFamily;
};

export const isPromiseLike = (
  value: any
): value is Promise<ResolutionType<typeof value>> => {
  return (
    !!value &&
    typeof value === 'object' &&
    'then' in value &&
    'catch' in value &&
    'finally' in value
  );
};

// taken from Radix UI
// https://github.com/radix-ui/primitives/blob/main/packages/core/primitive/src/primitive.tsx
export const composeEventHandlers = <E>(
  originalEventHandler?: (event: E) => void,
  ourEventHandler?: (event: E) => void,
  { checkForDefaultPrevented = true } = {}
) => {
  return function handleEvent(event: E) {
    originalEventHandler?.(event);

    if (
      !checkForDefaultPrevented ||
      !(event as unknown as Event)?.defaultPrevented
    ) {
      return ourEventHandler?.(event);
    }
  };
};

export const base64ToBlob = (base64: string) => {
  const arr = base64.split(',');
  const fileType = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let l = bstr.length;
  const u8Arr = new Uint8Array(l);

  while (l--) {
    u8Arr[l] = bstr.charCodeAt(l);
  }
  return new Blob([u8Arr], {
    type: fileType,
  });
};

const readBlobAsDataUrl = (blob: Blob) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('无法读取导出图片资源'));
    };
    reader.onerror = () => {
      reject(reader.error || new Error('无法读取导出图片资源'));
    };
    reader.readAsDataURL(blob);
  });
};

const isSvgDataUrl = (href: string) => {
  return /^data:image\/svg\+xml(?:[;,]|$)/i.test(href);
};

const decodeSvgDataUrl = (href: string) => {
  const commaIndex = href.indexOf(',');
  if (commaIndex === -1) {
    return '';
  }

  const meta = href.slice(0, commaIndex);
  const payload = href.slice(commaIndex + 1);
  if (/;base64/i.test(meta)) {
    try {
      return atob(payload);
    } catch {
      return '';
    }
  }

  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
};

const encodeSvgDataUrl = (svgData: string) => {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
};

const sanitizeSvgDataUrl = async (href: string, depth: number) => {
  if (depth >= MAX_NESTED_SVG_SANITIZE_DEPTH) {
    return href;
  }

  const svgData = decodeSvgDataUrl(href);
  if (!svgData) {
    return TRANSPARENT_IMAGE_DATA_URL;
  }

  try {
    const sanitized = await sanitizeSvgForRasterExport(
      svgData,
      depth + 1,
      false
    );
    return encodeSvgDataUrl(sanitized.svgData);
  } catch {
    return TRANSPARENT_IMAGE_DATA_URL;
  }
};

const inlineImageHref = async (href: string, depth = 0): Promise<string> => {
  if (!href) {
    return href;
  }
  if (isSvgDataUrl(href)) {
    return sanitizeSvgDataUrl(href, depth);
  }
  if (href.startsWith('data:')) {
    return href;
  }

  try {
    const response = await fetch(href);
    if (!response.ok) {
      return TRANSPARENT_IMAGE_DATA_URL;
    }
    const blob = await response.blob();
    const dataUrl = await readBlobAsDataUrl(blob);
    if (isSvgDataUrl(dataUrl) || /image\/svg\+xml/i.test(blob.type)) {
      return sanitizeSvgDataUrl(dataUrl, depth);
    }
    return dataUrl;
  } catch {
    return TRANSPARENT_IMAGE_DATA_URL;
  }
};

const createTransparentImageResponse = () => {
  return new Response(
    new Blob([TRANSPARENT_SVG_SOURCE], { type: 'image/svg+xml' }),
    { status: 200 }
  );
};

const runWithImageFetchFallback = async <T>(task: () => Promise<T>) => {
  const target = typeof window === 'undefined' ? globalThis : window;
  const originalFetch = target.fetch?.bind(target);
  if (!originalFetch || typeof Response === 'undefined') {
    return task();
  }

  const previousFetch = target.fetch;
  target.fetch = (async (...args: Parameters<typeof fetch>) => {
    try {
      return await originalFetch(...args);
    } catch {
      return createTransparentImageResponse();
    }
  }) as typeof fetch;

  try {
    return await task();
  } finally {
    target.fetch = previousFetch;
  }
};

const getSvgImageHref = (element: Element) => {
  return (
    element.getAttribute('href') ||
    element.getAttributeNS(XLINK_NS, 'href') ||
    element.getAttribute('xlink:href') ||
    ''
  );
};

const setSvgImageHref = (element: SVGImageElement, href: string) => {
  element.setAttribute('href', href);
  element.setAttributeNS(XLINK_NS, 'xlink:href', href);
};

const setSvgHref = (element: Element, href: string) => {
  element.setAttribute('href', href);
  element.setAttributeNS(XLINK_NS, 'xlink:href', href);
};

const copyAttribute = (
  source: Element,
  target: Element,
  attributeName: string
) => {
  const value = source.getAttribute(attributeName);
  if (value !== null) {
    target.setAttribute(attributeName, value);
  }
};

const parseStyleAttribute = (element: Element | null) => {
  const result: Record<string, string> = {};
  const style = element?.getAttribute('style') || '';
  for (const declaration of style.split(';')) {
    const separatorIndex = declaration.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }
    const name = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const value = declaration.slice(separatorIndex + 1).trim();
    if (name && value) {
      result[name] = value;
    }
  }
  return result;
};

const toSvgNumber = (value: string | null, fallback = 0) => {
  const parsed = Number.parseFloat(value || '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toCssPx = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parsePadding = (value: string) => {
  const tokens = value
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const nums = tokens.map((token) => toCssPx(token));
  if (nums.length === 1) {
    return { top: nums[0], right: nums[0], bottom: nums[0], left: nums[0] };
  }
  if (nums.length === 2) {
    return { top: nums[0], right: nums[1], bottom: nums[0], left: nums[1] };
  }
  if (nums.length === 3) {
    return { top: nums[0], right: nums[1], bottom: nums[2], left: nums[1] };
  }
  if (nums.length >= 4) {
    return { top: nums[0], right: nums[1], bottom: nums[2], left: nums[3] };
  }
  return { top: 0, right: 0, bottom: 0, left: 0 };
};

const identityMatrix = (): Matrix => ({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
});

const multiplyMatrix = (left: Matrix, right: Matrix): Matrix => {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
};

const parseTransformNumbers = (value: string) => {
  return value
    .trim()
    .split(/[,\s]+/)
    .map((item) => Number.parseFloat(item))
    .filter((item) => Number.isFinite(item));
};

const getTranslateMatrix = (x = 0, y = 0): Matrix => ({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: x,
  f: y,
});

const getRotateMatrix = (angle: number, cx = 0, cy = 0): Matrix => {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotate = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
  if (!cx && !cy) {
    return rotate;
  }
  return multiplyMatrix(
    multiplyMatrix(getTranslateMatrix(cx, cy), rotate),
    getTranslateMatrix(-cx, -cy)
  );
};

const parseTransform = (transform: string | null): Matrix => {
  if (!transform) {
    return identityMatrix();
  }

  let matrix = identityMatrix();
  const pattern = /([a-zA-Z]+)\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(transform))) {
    const [, name, rawValue] = match;
    const values = parseTransformNumbers(rawValue);
    let current = identityMatrix();
    if (name === 'matrix' && values.length >= 6) {
      current = {
        a: values[0],
        b: values[1],
        c: values[2],
        d: values[3],
        e: values[4],
        f: values[5],
      };
    }
    if (name === 'translate') {
      current = getTranslateMatrix(values[0] || 0, values[1] || 0);
    }
    if (name === 'scale') {
      const sx = values[0] ?? 1;
      const sy = values[1] ?? sx;
      current = { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
    }
    if (name === 'rotate') {
      current = getRotateMatrix(values[0] || 0, values[1] || 0, values[2] || 0);
    }
    matrix = multiplyMatrix(matrix, current);
  }
  return matrix;
};

const getCumulativeTransform = (element: Element, root: Element): Matrix => {
  const elements: Element[] = [];
  let current: Element | null = element;
  while (current && current !== root) {
    elements.unshift(current);
    current = current.parentElement;
  }
  return elements.reduce(
    (matrix, item) =>
      multiplyMatrix(matrix, parseTransform(item.getAttribute('transform'))),
    identityMatrix()
  );
};

const getTextStyleNodes = (foreignObject: Element) => {
  const selectors = [
    '[data-slate-node="text"]',
    '[data-slate-leaf="true"]',
    '[data-slate-string="true"]',
    '[style]',
  ];
  const nodes: Element[] = [];
  for (const selector of selectors) {
    nodes.push(...Array.from(foreignObject.querySelectorAll(selector)));
  }
  // Dedup while preserving order.
  const seen = new Set<Element>();
  return nodes.filter((node) => {
    if (seen.has(node)) return false;
    seen.add(node);
    return true;
  });
};

const getDominantTextStyleNode = (foreignObject: Element) => {
  const candidates = getTextStyleNodes(foreignObject);
  if (!candidates.length) {
    return null;
  }
  // Prefer the node that carries the most text content; this avoids picking an
  // emoji/decoration leaf as the "representative" style for the entire block.
  let best = candidates[0]!;
  let bestScore = (best.textContent || '').trim().length;
  for (const candidate of candidates) {
    const score = (candidate.textContent || '').trim().length;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
};

const getInheritedStyle = (element: Element | null, property: string) => {
  let current = element;
  while (current) {
    const style = parseStyleAttribute(current);
    if (style[property]) {
      return style[property];
    }
    current = current.parentElement;
  }
  return '';
};

const normalizeForeignObjectText = (value: string) => {
  // Preserve line breaks so multi-line HTML text (common with Slate) doesn't collapse into
  // a single line in raster export. Collapse only intra-line whitespace.
  const normalized = value.replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n');
  const lines = normalized
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter((line) => line.length > 0);
  return lines.join('\n');
};

const getForeignObjectTextFragment = (
  foreignObject: Element,
  root: SVGSVGElement
): RasterTextFragment | null => {
  if (foreignObject.querySelector('img')) {
    return null;
  }

  const text = normalizeForeignObjectText(foreignObject.textContent || '');
  if (!text) {
    return null;
  }

  const styleNode = getDominantTextStyleNode(foreignObject);
  const style = parseStyleAttribute(styleNode);
  const fontSize =
    toSvgNumber(
      style['font-size'] || styleNode?.getAttribute('plait-font-size') || null,
      14
    ) || 14;
  const lineHeightValue = toSvgNumber(style['line-height'], fontSize * 1.5);
  const textAlignStyle =
    getInheritedStyle(styleNode, 'text-align') ||
    getInheritedStyle(foreignObject, 'text-align');

  const displayStyle =
    getInheritedStyle(styleNode, 'display') ||
    getInheritedStyle(foreignObject, 'display');
  const flexDirection =
    getInheritedStyle(styleNode, 'flex-direction') ||
    getInheritedStyle(foreignObject, 'flex-direction') ||
    'row';
  const alignItems =
    getInheritedStyle(styleNode, 'align-items') ||
    getInheritedStyle(foreignObject, 'align-items');
  const justifyContent =
    getInheritedStyle(styleNode, 'justify-content') ||
    getInheritedStyle(foreignObject, 'justify-content');
  const isFlex = /\bflex\b/i.test(displayStyle);
  const horizontalCenter =
    isFlex &&
    ((flexDirection === 'column' ? alignItems : justifyContent) || '') ===
      'center';
  const verticalCenter =
    isFlex &&
    ((flexDirection === 'column' ? justifyContent : alignItems) || '') ===
      'center';

  const textAlign: CanvasTextAlign =
    textAlignStyle === 'center' || horizontalCenter
      ? 'center'
      : textAlignStyle === 'right' || textAlignStyle === 'end'
      ? 'right'
      : 'left';

  const paddingStyle =
    getInheritedStyle(styleNode, 'padding') ||
    getInheritedStyle(foreignObject, 'padding');
  const basePadding = paddingStyle ? parsePadding(paddingStyle) : null;
  const padding = {
    top: toCssPx(getInheritedStyle(styleNode, 'padding-top')) || basePadding?.top || 0,
    right:
      toCssPx(getInheritedStyle(styleNode, 'padding-right')) ||
      basePadding?.right ||
      0,
    bottom:
      toCssPx(getInheritedStyle(styleNode, 'padding-bottom')) ||
      basePadding?.bottom ||
      0,
    left:
      toCssPx(getInheritedStyle(styleNode, 'padding-left')) ||
      basePadding?.left ||
      0,
  };

  const rawX = toSvgNumber(foreignObject.getAttribute('x'));
  const rawY = toSvgNumber(foreignObject.getAttribute('y'));
  const rawWidth = toSvgNumber(foreignObject.getAttribute('width'), 999);
  const rawHeight = toSvgNumber(foreignObject.getAttribute('height'), 999);
  const lines = text.split('\n').filter(Boolean);
  const blockHeight = (lines.length || 1) * (lineHeightValue || fontSize * 1.5);
  const innerWidth = Math.max(0, rawWidth - padding.left - padding.right);
  const innerHeight = Math.max(0, rawHeight - padding.top - padding.bottom);
  const offsetY = verticalCenter ? Math.max(0, (innerHeight - blockHeight) / 2) : 0;

  const rawFontFamily =
    style['font-family'] ||
    getInheritedStyle(styleNode, 'font-family') ||
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Noto Sans", "Noto Sans CJK SC", "Microsoft Yahei", "Hiragino Sans GB", Arial, sans-serif';
  const fontFamily = resolveCanvasFontFamily({
    fontFamily: rawFontFamily,
    fontSize,
    fontStyle:
      style['font-style'] ||
      (styleNode?.hasAttribute('plait-italic') ? 'italic' : undefined),
    fontWeight:
      style['font-weight'] ||
      (styleNode?.hasAttribute('plait-bold') ? 'bold' : undefined),
  });

  return {
    text,
    x: rawX + padding.left,
    y: rawY + padding.top + offsetY,
    width: innerWidth || rawWidth,
    fontSize,
    fontFamily,
    fontWeight:
      style['font-weight'] ||
      (styleNode?.hasAttribute('plait-bold') ? 'bold' : undefined),
    fontStyle:
      style['font-style'] ||
      (styleNode?.hasAttribute('plait-italic') ? 'italic' : undefined),
    fill: style.color || style.fill || '#000000',
    lineHeight: lineHeightValue || fontSize * 1.5,
    textAlign,
    matrix: getCumulativeTransform(foreignObject, root),
  };
};

const getTextLeafElements = (element: Element) => {
  const selectors = ['[data-slate-leaf="true"]', '[data-slate-node="text"]', 'span[style]'];
  const nodes: Element[] = [];
  for (const selector of selectors) {
    nodes.push(...Array.from(element.querySelectorAll(selector)));
  }
  const seen = new Set<Element>();
  const deduped = nodes.filter((node) => {
    if (seen.has(node)) {
      return false;
    }
    seen.add(node);
    return Boolean(node.textContent && node.textContent.length > 0);
  });
  // Slate often nests wrappers like data-slate-node="text" > data-slate-leaf="true" > data-slate-string.
  // If we keep every matched wrapper, one visual leaf becomes multiple tspans and text appears duplicated.
  return deduped.filter(
    (node) => !deduped.some((other) => other !== node && node.contains(other))
  );
};

const getParagraphElements = (foreignObject: Element) => {
  const paragraphs = Array.from(
    foreignObject.querySelectorAll('[data-slate-node="element"]')
  ).filter((element) => getTextLeafElements(element).length > 0);
  return paragraphs.length ? paragraphs : [foreignObject];
};

const getLeafFontWeight = (leaf: Element) => {
  const style = parseStyleAttribute(leaf);
  return (
    style['font-weight'] ||
    (leaf.hasAttribute('plait-bold') || leaf.querySelector('strong,b')
      ? 'bold'
      : undefined)
  );
};

const getLeafFontStyle = (leaf: Element) => {
  const style = parseStyleAttribute(leaf);
  return (
    style['font-style'] ||
    (leaf.hasAttribute('plait-italic') || leaf.querySelector('em,i')
      ? 'italic'
      : undefined)
  );
};

const getLeafTextDecoration = (leaf: Element) => {
  const style = parseStyleAttribute(leaf);
  if (style['text-decoration']) {
    return style['text-decoration'];
  }
  const decorations: string[] = [];
  if (leaf.hasAttribute('plait-underlined') || leaf.querySelector('u')) {
    decorations.push('underline');
  }
  if (leaf.hasAttribute('plait-strike') || leaf.querySelector('s,strike,del')) {
    decorations.push('line-through');
  }
  return decorations.join(' ') || undefined;
};

const applyLeafStyleToSvgText = (
  target: SVGTextElement | SVGTSpanElement,
  leaf: Element
) => {
  const style = parseStyleAttribute(leaf);
  const fontSize = style['font-size'] || leaf.getAttribute('plait-font-size') || '';
  const styleMap = [
    ['font-family', style['font-family'] || getInheritedStyle(leaf, 'font-family')],
    ['font-size', fontSize],
    ['font-weight', getLeafFontWeight(leaf)],
    ['font-style', getLeafFontStyle(leaf)],
    ['text-decoration', getLeafTextDecoration(leaf)],
    ['letter-spacing', style['letter-spacing'] || getInheritedStyle(leaf, 'letter-spacing')],
    ['opacity', style.opacity || getInheritedStyle(leaf, 'opacity')],
  ] as const;
  for (const [name, value] of styleMap) {
    if (value) {
      target.setAttribute(name, value);
    }
  }
  const fill =
    style.color ||
    style.fill ||
    getInheritedStyle(leaf, 'color') ||
    getInheritedStyle(leaf, 'fill');
  if (fill) {
    target.setAttribute('fill', fill);
  }
};

const extractTextForeignObjects = (root: SVGSVGElement) => {
  const textFragments: RasterTextFragment[] = [];
  const foreignObjects = Array.from(root.querySelectorAll('foreignObject'));
  for (const foreignObject of foreignObjects) {
    const fragment = getForeignObjectTextFragment(foreignObject, root);
    if (fragment) {
      textFragments.push(fragment);
      foreignObject.remove();
    }
  }
  return textFragments;
};

const applyTextStyle = (
  target: SVGTextElement | SVGTSpanElement,
  styleNode: Element | null
) => {
  const style = parseStyleAttribute(styleNode);
  const fontSize =
    style['font-size'] || styleNode?.getAttribute('plait-font-size') || '';
  const styleMap = [
    ['font-family', style['font-family']],
    ['font-size', fontSize],
    ['font-weight', style['font-weight']],
    ['font-style', style['font-style']],
    ['text-decoration', style['text-decoration']],
    ['letter-spacing', style['letter-spacing']],
    ['opacity', style.opacity],
  ] as const;

  for (const [name, value] of styleMap) {
    if (value) {
      target.setAttribute(name, value);
    }
  }

  const fill = style.color || style.fill;
  if (fill) {
    target.setAttribute('fill', fill);
  }
};

const replaceTextForeignObjects = (root: SVGSVGElement) => {
  const foreignObjects = Array.from(root.querySelectorAll('foreignObject'));
  for (const foreignObject of foreignObjects) {
    const fragment = getForeignObjectTextFragment(foreignObject, root);
    if (!fragment) {
      foreignObject.remove();
      continue;
    }

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('dominant-baseline', 'hanging');
    text.setAttribute('xml:space', 'preserve');
    text.setAttribute(
      'text-anchor',
      fragment.textAlign === 'center'
        ? 'middle'
        : fragment.textAlign === 'right' || fragment.textAlign === 'end'
          ? 'end'
          : 'start'
    );
    applyTextStyle(text, getDominantTextStyleNode(foreignObject));

    const paragraphElements = getParagraphElements(foreignObject);
    let currentY = fragment.y;
    let hasContent = false;
    for (const paragraph of paragraphElements) {
      const leaves = getTextLeafElements(paragraph);
      if (!leaves.length) {
        continue;
      }
      const paragraphLineHeight = leaves.reduce((max, leaf) => {
        const style = parseStyleAttribute(leaf);
        return Math.max(
          max,
          toSvgNumber(style['line-height'], fragment.lineHeight) || fragment.lineHeight
        );
      }, fragment.lineHeight);
      let isFirstLeaf = true;
      for (const leaf of leaves) {
        const content = leaf.textContent || '';
        if (!content) {
          continue;
        }
        const tspan = document.createElementNS(SVG_NS, 'tspan');
        if (isFirstLeaf) {
          const x =
            fragment.textAlign === 'center'
              ? fragment.x + fragment.width / 2
              : fragment.textAlign === 'right' || fragment.textAlign === 'end'
                ? fragment.x + fragment.width
                : fragment.x;
          tspan.setAttribute('x', `${x}`);
          tspan.setAttribute('y', `${currentY}`);
          isFirstLeaf = false;
        }
        tspan.textContent = content;
        applyLeafStyleToSvgText(tspan, leaf);
        text.appendChild(tspan);
        hasContent = true;
      }
      currentY += paragraphLineHeight;
    }

    if (!hasContent) {
      foreignObject.remove();
      continue;
    }
    copyAttribute(foreignObject, text, 'transform');
    copyAttribute(foreignObject, text, 'opacity');
    copyAttribute(foreignObject, text, 'clip-path');
    foreignObject.replaceWith(text);
  }
};

const ensureCanvasFontsReady = async (textFragments: RasterTextFragment[]) => {
  if (
    typeof document === 'undefined' ||
    !(document as unknown as { fonts?: FontFaceSet }).fonts ||
    textFragments.length === 0
  ) {
    return;
  }

  const fontFaceSet = (document as unknown as { fonts: FontFaceSet }).fonts;
  if (typeof fontFaceSet.load !== 'function') {
    return;
  }

  const uniqueFonts = new Set<string>();
  for (const fragment of textFragments) {
    // Load a few concrete families instead of the whole fallback stack to reduce parser quirks
    // and improve the odds that the primary family becomes available for canvas text.
    const families = splitFontFamilyCandidates(fragment.fontFamily).slice(0, 3);
    for (const family of families) {
      uniqueFonts.add(
        `${fragment.fontStyle ? `${fragment.fontStyle} ` : ''}${
          fragment.fontWeight ? `${fragment.fontWeight} ` : ''
        }${fragment.fontSize}px ${family}`
      );
    }
  }

  const loads = Array.from(uniqueFonts).map((font) => fontFaceSet.load(font).catch(() => []));
  await Promise.allSettled(loads);

  // Avoid blocking forever if some fonts never load.
  await Promise.race([
    fontFaceSet.ready.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 1200)),
  ]);
};

const replaceImageForeignObjects = (root: SVGSVGElement) => {
  const foreignObjects = Array.from(root.querySelectorAll('foreignObject'));
  for (const foreignObject of foreignObjects) {
    const image = foreignObject.querySelector('img');
    const href = image?.getAttribute('src');
    if (!href) {
      continue;
    }

    const svgImage = document.createElementNS(SVG_NS, 'image');
    setSvgImageHref(svgImage, href);
    copyAttribute(foreignObject, svgImage, 'x');
    copyAttribute(foreignObject, svgImage, 'y');
    copyAttribute(foreignObject, svgImage, 'width');
    copyAttribute(foreignObject, svgImage, 'height');
    copyAttribute(foreignObject, svgImage, 'transform');
    copyAttribute(foreignObject, svgImage, 'opacity');
    copyAttribute(foreignObject, svgImage, 'clip-path');
    svgImage.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    foreignObject.replaceWith(svgImage);
  }
};

const removeResidualForeignObjects = (root: SVGSVGElement) => {
  // Any remaining foreignObject can embed HTML that triggers cross-origin subresource loading
  // (iframe, css url(), fonts, etc.). That will taint the canvas when the SVG is rendered
  // into an <img> and drawn onto a canvas. For raster export, prefer a clean canvas over
  // partially-rendered HTML content.
  const residual = Array.from(root.querySelectorAll('foreignObject'));
  for (const foreignObject of residual) {
    foreignObject.remove();
  }
};

const stripExternalCssUrls = (root: SVGSVGElement) => {
  const replaceExternalUrl = (cssText: string) => {
    // Keep internal url(#id) references; replace only external url(http...) references.
    return cssText.replace(
      /url\(\s*(['"]?)(https?:\/\/|\/\/)[^)]+?\1\s*\)/gi,
      `url(${TRANSPARENT_IMAGE_DATA_URL})`
    );
  };

  for (const node of Array.from(root.querySelectorAll('style'))) {
    if (node.textContent) {
      node.textContent = replaceExternalUrl(node.textContent);
    }
  }

  for (const node of Array.from(root.querySelectorAll('[style]'))) {
    const style = node.getAttribute('style');
    if (style && /url\(/i.test(style) && /(https?:\/\/|\/\/)/i.test(style)) {
      node.setAttribute('style', replaceExternalUrl(style));
    }
  }
};

const inlineSvgResourceHrefs = async (root: SVGSVGElement, depth: number) => {
  // <feImage> (filters) and <use> can also reference external resources via href/xlink:href.
  // If they remain external, rendering the SVG into a canvas will taint it.
  const candidates = Array.from(root.querySelectorAll('*')).filter((node) => {
    const name = node.tagName.toLowerCase();
    return name === 'feimage' || name === 'use';
  });

  await Promise.all(
    candidates.map(async (node) => {
      const href = getSvgImageHref(node);
      if (!href || href.startsWith('#')) {
        return;
      }
      const nextHref = await inlineImageHref(href, depth);
      setSvgHref(node, nextHref || TRANSPARENT_IMAGE_DATA_URL);
    })
  );
};

const inlineSvgImages = async (root: SVGSVGElement, depth: number) => {
  const images = Array.from(root.querySelectorAll('image'));
  await Promise.all(
    images.map(async (image) => {
      const href = getSvgImageHref(image);
      const nextHref = await inlineImageHref(href, depth);
      setSvgImageHref(
        image as SVGImageElement,
        nextHref || TRANSPARENT_IMAGE_DATA_URL
      );
    })
  );
};

const inlineForeignObjectImages = async (
  root: SVGSVGElement,
  depth: number
) => {
  // Some export pipelines place <img> tags inside <foreignObject> (often XHTML namespaced).
  // If any of these images remain as http(s) URLs, the SVG->Image->Canvas path will taint the
  // canvas and break export (toBlob/toDataURL). Inline them aggressively.
  const imgs = Array.from(root.querySelectorAll('foreignObject img'));
  await Promise.all(
    imgs.map(async (img) => {
      const href = img.getAttribute('src') || '';
      const nextHref = await inlineImageHref(href, depth);
      img.setAttribute('src', nextHref || TRANSPARENT_IMAGE_DATA_URL);
    })
  );
};

const sanitizeSvgForRasterExport = async (
  svgData: string,
  depth = 0,
  keepTextForCanvas = true
) => {
  const documentParser = new DOMParser();
  const parsed = documentParser.parseFromString(svgData, 'image/svg+xml');
  const parseError = parsed.querySelector('parsererror');
  const root = parsed.documentElement as unknown as SVGSVGElement | null;
  if (parseError || !root || root.tagName.toLowerCase() !== 'svg') {
    throw new Error('无法解析导出 SVG');
  }

  stripExternalCssUrls(root);
  await inlineForeignObjectImages(root, depth);
  replaceImageForeignObjects(root);
  const textFragments = keepTextForCanvas
    ? extractTextForeignObjects(root)
    : [];
  if (!keepTextForCanvas) {
    replaceTextForeignObjects(root);
  }
  await inlineSvgResourceHrefs(root, depth);
  await inlineSvgImages(root, depth);
  removeResidualForeignObjects(root);
  return {
    svgData: new XMLSerializer().serializeToString(root),
    textFragments,
  };
};

const getSvgViewport = (svgData: string): SvgViewport => {
  const parsed = new DOMParser().parseFromString(svgData, 'image/svg+xml');
  const root = parsed.documentElement;
  const width = Number.parseFloat(root.getAttribute('width') || '');
  const height = Number.parseFloat(root.getAttribute('height') || '');
  const viewBox = (root.getAttribute('viewBox') || '')
    .split(/[,\s]+/)
    .map((value) => Number.parseFloat(value));
  if (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  ) {
    return {
      x: Number.isFinite(viewBox[0]) ? viewBox[0] : 0,
      y: Number.isFinite(viewBox[1]) ? viewBox[1] : 0,
      width: Number.isFinite(viewBox[2]) && viewBox[2] > 0 ? viewBox[2] : width,
      height:
        Number.isFinite(viewBox[3]) && viewBox[3] > 0 ? viewBox[3] : height,
    };
  }

  return {
    x: Number.isFinite(viewBox[0]) ? viewBox[0] : 0,
    y: Number.isFinite(viewBox[1]) ? viewBox[1] : 0,
    width: Number.isFinite(viewBox[2]) && viewBox[2] > 0 ? viewBox[2] : 1,
    height: Number.isFinite(viewBox[3]) && viewBox[3] > 0 ? viewBox[3] : 1,
  };
};

const getSvgSize = (svgData: string) => {
  const parsed = new DOMParser().parseFromString(svgData, 'image/svg+xml');
  const root = parsed.documentElement;
  const width = Number.parseFloat(root.getAttribute('width') || '');
  const height = Number.parseFloat(root.getAttribute('height') || '');
  if (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  ) {
    return { width, height };
  }
  const viewport = getSvgViewport(svgData);
  return { width: viewport.width, height: viewport.height };
};

const loadImageElement = (src: string) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    // Keep canvas "origin-clean" when the SVG triggers subresource fetching.
    // This mirrors @plait/core's export path and prevents SecurityError on toBlob/toDataURL.
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法加载导出 SVG 图像'));
    image.src = src;
  });
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
) => {
  return new Promise<Blob>((resolve, reject) => {
    const fallbackToDataUrl = () => {
      try {
        const image = canvas.toDataURL(type, quality);
        if (!image || image === 'data:,') {
          reject(new Error('无法生成导出图片'));
          return;
        }
        resolve(base64ToBlob(image));
      } catch (error) {
        reject(error);
      }
    };

    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            fallbackToDataUrl();
            return;
          }
          resolve(blob);
        },
        type,
        quality
      );
    } catch {
      fallbackToDataUrl();
    }
  });
};

const getSafeRasterRatio = (width: number, height: number, ratio: number) => {
  const safeRatio = Math.max(0.01, ratio);
  const maxWidthRatio = MAX_RASTER_CANVAS_SIZE / width;
  const maxHeightRatio = MAX_RASTER_CANVAS_SIZE / height;
  const maxAreaRatio = Math.sqrt(MAX_RASTER_CANVAS_AREA / (width * height));
  return Math.min(safeRatio, maxWidthRatio, maxHeightRatio, maxAreaRatio);
};

const paintTextFragments = (
  context: CanvasRenderingContext2D,
  textFragments: RasterTextFragment[],
  viewport: SvgViewport,
  outputWidth: number,
  outputHeight: number
) => {
  if (!textFragments.length) {
    return;
  }

  const scaleX = outputWidth / viewport.width;
  const scaleY = outputHeight / viewport.height;
  for (const fragment of textFragments) {
    context.save();
    context.setTransform(
      scaleX,
      0,
      0,
      scaleY,
      -viewport.x * scaleX,
      -viewport.y * scaleY
    );
    context.transform(
      fragment.matrix.a,
      fragment.matrix.b,
      fragment.matrix.c,
      fragment.matrix.d,
      fragment.matrix.e,
      fragment.matrix.f
    );
    context.font = `${fragment.fontStyle ? `${fragment.fontStyle} ` : ''}${
      fragment.fontWeight ? `${fragment.fontWeight} ` : ''
    }${fragment.fontSize}px ${fragment.fontFamily}`;
    context.fillStyle = fragment.fill;
    context.textAlign = fragment.textAlign;
    context.textBaseline = 'top';
    const x =
      fragment.textAlign === 'center'
        ? fragment.x + fragment.width / 2
        : fragment.textAlign === 'right' || fragment.textAlign === 'end'
        ? fragment.x + fragment.width
        : fragment.x;
    fragment.text.split('\n').forEach((line, index) => {
      context.fillText(line, x, fragment.y + index * fragment.lineHeight);
    });
    context.restore();
  }
};

export const exportBoardToRasterBlob = async (
  board: PlaitBoard,
  options: RasterExportOptions = {}
) => {
  const {
    format = 'png',
    quality,
    ratio = 4,
    fillStyle = 'transparent',
    ...svgOptions
  } = options;
  const svgData = await runWithImageFetchFallback(() =>
    toSvgData(board, {
      padding: 20,
      ratio,
      ...svgOptions,
      fillStyle,
      inlineStyleClassNames: BOARD_EXPORT_INLINE_STYLE_CLASS_NAMES,
      styleNames: BOARD_EXPORT_STYLE_NAMES,
    })
  );
  const { svgData: sanitizedSvgData, textFragments } =
    await sanitizeSvgForRasterExport(svgData, 0, false);
  const { width, height } = getSvgSize(sanitizedSvgData);
  const viewport = getSvgViewport(sanitizedSvgData);
  const outputRatio = getSafeRasterRatio(width, height, ratio);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法创建导出画布');
  }

  const outputWidth = Math.max(1, Math.floor(width * outputRatio));
  const outputHeight = Math.max(1, Math.floor(height * outputRatio));
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  canvas.style.width = `${outputWidth}px`;
  canvas.style.height = `${outputHeight}px`;

  if (format === 'jpeg') {
    context.fillStyle = fillStyle === 'transparent' ? '#ffffff' : fillStyle;
    context.fillRect(0, 0, outputWidth, outputHeight);
  }

  const svgBlob = new Blob([sanitizedSvgData], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const objectUrl = window.URL.createObjectURL(svgBlob);
  try {
    await ensureCanvasFontsReady(textFragments);
    const image = await loadImageElement(objectUrl);
    context.drawImage(image, 0, 0, outputWidth, outputHeight);
    paintTextFragments(
      context,
      textFragments,
      viewport,
      outputWidth,
      outputHeight
    );
    return await canvasToBlob(
      canvas,
      format === 'jpeg' ? 'image/jpeg' : 'image/png',
      quality
    );
  } finally {
    window.URL.revokeObjectURL(objectUrl);
  }
};

export const boardToImage = (
  board: PlaitBoard,
  options: ToImageOptions = {}
) => {
  return exportBoardToRasterBlob(board, options).then((blob) =>
    readBlobAsDataUrl(blob)
  );
};

export function download(blob: Blob | MediaSource, filename: string) {
  const a = document.createElement('a');
  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}

export const splitRows = <T>(shapes: T[], cols: number) => {
  const result = [];
  for (let i = 0; i < shapes.length; i += cols) {
    result.push(shapes.slice(i, i + cols));
  }
  return result;
};

export const getShortcutKey = (shortcut: string): string => {
  shortcut = shortcut
    .replace(/\bAlt\b/i, 'Alt')
    .replace(/\bShift\b/i, 'Shift')
    .replace(/\b(Enter|Return)\b/i, 'Enter');
  if (IS_APPLE || IS_MAC) {
    return shortcut
      .replace(/\bCtrlOrCmd\b/gi, 'Cmd')
      .replace(/\bAlt\b/i, 'Option');
  }
  return shortcut.replace(/\bCtrlOrCmd\b/gi, 'Ctrl');
};
