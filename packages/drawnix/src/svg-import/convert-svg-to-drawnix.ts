import type { PlaitElement, Point } from '@plait/core';
import {
  ArrowLineMarkerType,
  ArrowLineShape,
  BasicShapes,
  createArrowLineElement,
  createGeometryElementWithText,
} from '@plait/draw';
import type { SvgAssetPackage } from './parse-svg-package';

type CssStyleMap = Record<string, string>;

interface SvgImportTextItem {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily?: string;
  textAnchor?: string;
  fill?: string;
}

interface SvgImportArrowItem {
  id: string;
  points: Point[];
  strokeColor?: string;
  strokeWidth?: number;
}

interface SvgImportImageItem {
  id: string;
  url: string;
  points: Point[];
}

export interface SvgImportSummary {
  textCount: number;
  arrowCount: number;
  componentCount: number;
  ignoredBackgroundCount: number;
  warnings: string[];
}

export interface SvgImportResult {
  elements: PlaitElement[];
  summary: SvgImportSummary;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_FONT_FAMILY = 'Arial, sans-serif';
const DEFAULT_STROKE = '#231F20';
const DEFAULT_STROKE_WIDTH = 2;

const parseNumber = (value: string | null | undefined, fallback = 0) => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeColor = (value: string | null | undefined) => {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized || normalized === 'none') {
    return undefined;
  }
  return normalized;
};

const parseInlineStyle = (value: string | null | undefined): CssStyleMap => {
  if (!value) {
    return {};
  }

  return value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<CssStyleMap>((styles, item) => {
      const [key, rawValue] = item.split(':');
      if (!key || !rawValue) {
        return styles;
      }
      styles[key.trim()] = rawValue.trim();
      return styles;
    }, {});
};

const parseClassStyles = (root: SVGSVGElement) => {
  const styles: Record<string, CssStyleMap> = {};
  const styleNodes = Array.from(root.querySelectorAll('style'));

  for (const styleNode of styleNodes) {
    const content = styleNode.textContent || '';
    const matches = content.matchAll(/\.([\w-]+)\s*\{([^}]+)\}/g);

    for (const match of matches) {
      const className = match[1]?.trim();
      const declarations = match[2]?.trim();
      if (!className || !declarations) {
        continue;
      }
      styles[className] = {
        ...(styles[className] || {}),
        ...parseInlineStyle(declarations),
      };
    }
  }

  return styles;
};

const resolveStyle = (
  element: Element,
  classStyles: Record<string, CssStyleMap>
): CssStyleMap => {
  const resolved: CssStyleMap = {};
  const classNames = (element.getAttribute('class') || '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const className of classNames) {
    Object.assign(resolved, classStyles[className] || {});
  }

  Object.assign(resolved, parseInlineStyle(element.getAttribute('style')));

  for (const attr of [
    'fill',
    'stroke',
    'stroke-width',
    'font-size',
    'font-family',
    'text-anchor',
    'opacity',
  ]) {
    const value = element.getAttribute(attr);
    if (value) {
      resolved[attr] = value;
    }
  }

  return resolved;
};

const getRootViewport = (root: SVGSVGElement) => {
  const viewBox = root.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map((item) => Number.parseFloat(item));
    if (parts.length === 4 && parts.every((item) => Number.isFinite(item))) {
      const [, , width, height] = parts;
      return { width, height };
    }
  }

  return {
    width: parseNumber(root.getAttribute('width'), 800),
    height: parseNumber(root.getAttribute('height'), 600),
  };
};

const isWhiteLike = (value: string | undefined) => {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '#fff'
    || normalized === '#ffffff'
    || normalized === 'white'
    || normalized === 'rgb(255,255,255)'
    || normalized === 'rgb(255, 255, 255)';
};

const isBackgroundRect = (
  element: Element,
  rootWidth: number,
  rootHeight: number,
  resolvedStyle: CssStyleMap
) => {
  if (element.tagName.toLowerCase() !== 'rect') {
    return false;
  }

  const widthAttr = element.getAttribute('width') || '';
  const heightAttr = element.getAttribute('height') || '';
  const x = parseNumber(element.getAttribute('x'));
  const y = parseNumber(element.getAttribute('y'));
  const width = widthAttr.includes('%') ? rootWidth : parseNumber(widthAttr);
  const height = heightAttr.includes('%') ? rootHeight : parseNumber(heightAttr);
  const fill = normalizeColor(resolvedStyle['fill'] || element.getAttribute('fill'));

  return width >= rootWidth * 0.95
    && height >= rootHeight * 0.95
    && Math.abs(x) < 20
    && Math.abs(y) < 20
    && isWhiteLike(fill);
};

const tokenizePath = (d: string) => d.match(/[MLHVQZmlhvqz]|-?\d*\.?\d+/g) || [];

const isSimplePath = (d: string) => /^[\s,0-9.\-MLHVQmlhvqzZ]+$/.test(d.trim());

const hasDiagonalArrowHead = (d: string) => /l-?\d+\.?\d*,-?\d+\.?\d*/i.test(d)
  || /m-?\d+\.?\d*,-?\d+\.?\d*/i.test(d);

const buildTextElement = (item: SvgImportTextItem) => {
  const width = Math.max(item.text.length * item.fontSize * 0.6, item.fontSize);
  const height = Math.max(item.fontSize * 1.4, 24);
  let left = item.x;

  if (item.textAnchor === 'middle') {
    left = item.x - width / 2;
  } else if (item.textAnchor === 'end') {
    left = item.x - width;
  }

  const top = item.y - item.fontSize;

  const element = createGeometryElementWithText(
    BasicShapes.text,
    [
      [left, top],
      [left + width, top + height],
    ],
    item.text,
    {
      fill: 'transparent',
      strokeColor: 'transparent',
      textStyle: {
        fontSize: item.fontSize,
        color: item.fill || '#000000',
        fontFamily: item.fontFamily || DEFAULT_FONT_FAMILY,
      },
    } as any
  ) as PlaitElement & { id: string };

  element.id = item.id;
  return element;
};

const buildArrowElement = (item: SvgImportArrowItem) => {
  const element = createArrowLineElement(
    ArrowLineShape.straight,
    item.points,
    { marker: ArrowLineMarkerType.none } as any,
    { marker: ArrowLineMarkerType.arrow } as any,
    undefined,
    {
      strokeColor: item.strokeColor || DEFAULT_STROKE,
      strokeWidth: item.strokeWidth || DEFAULT_STROKE_WIDTH,
    }
  ) as PlaitElement & { id: string };

  element.id = item.id;
  return element;
};

const buildImageElement = (item: SvgImportImageItem) => {
  return {
    id: item.id,
    type: 'image',
    url: item.url,
    points: item.points,
  } as unknown as PlaitElement;
};

const serializeSvgNodes = (
  root: SVGSVGElement,
  nodes: Element[],
  width: number,
  height: number
) => {
  const nextRoot = document.createElementNS(SVG_NS, 'svg');
  nextRoot.setAttribute('xmlns', SVG_NS);
  nextRoot.setAttribute('width', `${width}`);
  nextRoot.setAttribute('height', `${height}`);
  nextRoot.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const styleNodes = Array.from(root.querySelectorAll('style'));
  for (const styleNode of styleNodes) {
    nextRoot.appendChild(styleNode.cloneNode(true));
  }

  for (const node of nodes) {
    nextRoot.appendChild(node.cloneNode(true));
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    new XMLSerializer().serializeToString(nextRoot)
  )}`;
};

const collectTextNodes = (
  root: SVGSVGElement,
  classStyles: Record<string, CssStyleMap>
) => {
  const texts: SvgImportTextItem[] = [];

  for (const node of Array.from(root.querySelectorAll('text'))) {
    const text = (node.textContent || '').trim();
    if (!text) {
      continue;
    }
    const style = resolveStyle(node, classStyles);
    texts.push({
      id: node.getAttribute('id') || `svg-text-${texts.length + 1}`,
      text,
      x: parseNumber(node.getAttribute('x')),
      y: parseNumber(node.getAttribute('y')),
      fontSize: parseNumber(style['font-size'], DEFAULT_FONT_SIZE),
      fontFamily: style['font-family'] || DEFAULT_FONT_FAMILY,
      textAnchor: style['text-anchor'] || 'start',
      fill: normalizeColor(style['fill']) || '#000000',
    });
  }

  return texts;
};

const extractMainArrowPointsFromPath = (d: string): Point[] => {
  const tokens = tokenizePath(d);
  const points: Point[] = [];
  let command = '';
  let index = 0;
  let x = 0;
  let y = 0;
  let firstSubpathFinished = false;

  const pushPoint = (nextX: number, nextY: number) => {
    x = nextX;
    y = nextY;
    const last = points[points.length - 1];
    if (!last || last[0] !== nextX || last[1] !== nextY) {
      points.push([nextX, nextY]);
    }
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (!token) {
      break;
    }

    if (/^[MLHVQZmlhvqz]$/.test(token)) {
      if ((token === 'm' || token === 'M') && points.length > 1) {
        firstSubpathFinished = true;
      }
      command = token;
      index += 1;
      if (firstSubpathFinished) {
        break;
      }
      continue;
    }

    switch (command) {
      case 'M':
      case 'L':
        pushPoint(Number.parseFloat(token), Number.parseFloat(tokens[index + 1] || '0'));
        index += 2;
        break;
      case 'm':
      case 'l':
        pushPoint(x + Number.parseFloat(token), y + Number.parseFloat(tokens[index + 1] || '0'));
        index += 2;
        break;
      case 'H':
        pushPoint(Number.parseFloat(token), y);
        index += 1;
        break;
      case 'h':
        pushPoint(x + Number.parseFloat(token), y);
        index += 1;
        break;
      case 'V':
        pushPoint(x, Number.parseFloat(token));
        index += 1;
        break;
      case 'v':
        pushPoint(x, y + Number.parseFloat(token));
        index += 1;
        break;
      case 'Q':
        pushPoint(Number.parseFloat(tokens[index + 2] || '0'), Number.parseFloat(tokens[index + 3] || '0'));
        index += 4;
        break;
      case 'q':
        pushPoint(x + Number.parseFloat(tokens[index + 2] || '0'), y + Number.parseFloat(tokens[index + 3] || '0'));
        index += 4;
        break;
      default:
        index += 1;
        break;
    }
  }

  while (points.length > 2) {
    const last = points[points.length - 1]!;
    const prev = points[points.length - 2]!;
    const deltaX = Math.abs(last[0] - prev[0]);
    const deltaY = Math.abs(last[1] - prev[1]);
    const isShortTail = Math.max(deltaX, deltaY) <= 12;
    const isDiagonal = deltaX > 0 && deltaY > 0;
    if (!isShortTail && !isDiagonal) {
      break;
    }
    points.pop();
  }

  return points;
};

const classifyPathNode = (node: Element, style: CssStyleMap) => {
  const className = node.getAttribute('class') || '';
  const d = node.getAttribute('d') || '';
  const fill = normalizeColor(style['fill']);

  if (className.includes('fill-arrow')) {
    return 'preserve-arrow' as const;
  }

  if (!className.includes('stroke-main') || !d || !hasDiagonalArrowHead(d)) {
    return 'other' as const;
  }

  if (!fill && isSimplePath(d)) {
    return 'convert-arrow' as const;
  }

  return 'preserve-arrow' as const;
};

const measureBBoxByDom = (root: SVGSVGElement, node: Element) => {
  if (typeof document === 'undefined' || !document.body) {
    return null;
  }

  const mount = document.createElement('div');
  mount.style.cssText = 'position:absolute;left:-99999px;top:-99999px;width:0;height:0;overflow:hidden;';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  const { width, height } = getRootViewport(root);
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  for (const styleNode of Array.from(root.querySelectorAll('style'))) {
    svg.appendChild(styleNode.cloneNode(true));
  }
  const clonedNode = node.cloneNode(true) as SVGGraphicsElement;
  svg.appendChild(clonedNode);
  mount.appendChild(svg);
  document.body.appendChild(mount);

  try {
    if (typeof clonedNode.getBBox !== 'function') {
      return null;
    }
    const bbox = clonedNode.getBBox();
    return {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    };
  } catch {
    return null;
  } finally {
    mount.remove();
  }
};

const collectPackageBoundImages = (
  root: SVGSVGElement,
  componentAssets: SvgAssetPackage['componentAssets'],
  consumedIds: Set<string>
) => {
  const items: SvgImportImageItem[] = [];

  for (const node of Array.from(root.querySelectorAll('image[id]'))) {
    const id = node.getAttribute('id') || '';
    if (!id.startsWith('icon_')) {
      continue;
    }
    const x = parseNumber(node.getAttribute('x'));
    const y = parseNumber(node.getAttribute('y'));
    const width = parseNumber(node.getAttribute('width'));
    const height = parseNumber(node.getAttribute('height'));
    const asset = componentAssets[id];
    const url = asset?.url || node.getAttribute('href') || node.getAttribute('xlink:href') || '';

    if (!url || width <= 0 || height <= 0) {
      continue;
    }

    items.push({
      id,
      url,
      points: [
        [x, y],
        [x + width, y + height],
      ],
    });
    consumedIds.add(id);
  }

  return items;
};

const collectArrowItems = (
  root: SVGSVGElement,
  classStyles: Record<string, CssStyleMap>,
  consumedIds: Set<string>
) => {
  const converted: SvgImportArrowItem[] = [];
  const preserved: SvgImportImageItem[] = [];

  for (const node of Array.from(root.querySelectorAll('line, polyline, path'))) {
    const id = node.getAttribute('id') || '';
    const tagName = node.tagName.toLowerCase();
    const style = resolveStyle(node, classStyles);

    if (tagName === 'path') {
      const classification = classifyPathNode(node, style);
      if (classification === 'convert-arrow') {
        const points = extractMainArrowPointsFromPath(node.getAttribute('d') || '');
        if (points.length >= 2) {
          converted.push({
            id: id || `svg-arrow-${converted.length + 1}`,
            points,
            strokeColor: normalizeColor(style.stroke) || DEFAULT_STROKE,
            strokeWidth: parseNumber(style['stroke-width'], DEFAULT_STROKE_WIDTH),
          });
          if (id) {
            consumedIds.add(id);
          }
        }
      } else if (classification === 'preserve-arrow') {
        const bbox = measureBBoxByDom(root, node);
        if (bbox && bbox.width > 0 && bbox.height > 0) {
          preserved.push({
            id: id || `svg-arrow-image-${preserved.length + 1}`,
            url: serializeSvgNodes(root, [node], bbox.width, bbox.height),
            points: [
              [bbox.x, bbox.y],
              [bbox.x + bbox.width, bbox.y + bbox.height],
            ],
          });
          if (id) {
            consumedIds.add(id);
          }
        }
      }
      continue;
    }

    const hasMarker = !!node.getAttribute('marker-end') || !!node.getAttribute('marker-start');
    const className = node.getAttribute('class') || '';
    if (!hasMarker && !className.includes('arrow')) {
      continue;
    }

    const points: Point[] = [];
    if (tagName === 'line') {
      points.push(
        [parseNumber(node.getAttribute('x1')), parseNumber(node.getAttribute('y1'))],
        [parseNumber(node.getAttribute('x2')), parseNumber(node.getAttribute('y2'))]
      );
    } else if (tagName === 'polyline') {
      const values = (node.getAttribute('points') || '')
        .trim()
        .split(/[\s,]+/)
        .map((item) => Number.parseFloat(item))
        .filter((item) => Number.isFinite(item));
      for (let index = 0; index < values.length - 1; index += 2) {
        points.push([values[index]!, values[index + 1]!]);
      }
    }

    if (points.length >= 2) {
      converted.push({
        id: id || `svg-arrow-${converted.length + 1}`,
        points,
        strokeColor: normalizeColor(style.stroke) || DEFAULT_STROKE,
        strokeWidth: parseNumber(style['stroke-width'], DEFAULT_STROKE_WIDTH),
      });
      if (id) {
        consumedIds.add(id);
      }
    }
  }

  return { converted, preserved };
};

const buildBaseLayer = (
  root: SVGSVGElement,
  width: number,
  height: number,
  classStyles: Record<string, CssStyleMap>,
  consumedIds: Set<string>
) => {
  let ignoredBackgroundCount = 0;
  const layerRoot = root.querySelector('g') || root;
  const nodes = Array.from(layerRoot.children).filter((node) => {
    const resolvedStyle = resolveStyle(node, classStyles);
    if (isBackgroundRect(node, width, height, resolvedStyle)) {
      ignoredBackgroundCount += 1;
      return false;
    }
    const id = node.getAttribute('id') || '';
    return !consumedIds.has(id) && node.tagName.toLowerCase() !== 'text';
  });

  return {
    ignoredBackgroundCount,
    image: nodes.length
      ? ({
          id: 'svg-base-layer',
          url: serializeSvgNodes(root, nodes, width, height),
          points: [
            [0, 0],
            [width, height],
          ],
        } satisfies SvgImportImageItem)
      : null,
  };
};

export const convertSvgAssetPackageToDrawnix = (
  assetPackage: SvgAssetPackage
): SvgImportResult => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(assetPackage.svgText, 'image/svg+xml');
  const root = doc.documentElement;

  if (!root || root.tagName.toLowerCase() !== 'svg' || root.querySelector('parsererror')) {
    throw new Error('Invalid SVG content');
  }

  const classStyles = parseClassStyles(root);
  const { width, height } = getRootViewport(root);
  const consumedIds = new Set<string>();
  const texts = collectTextNodes(root, classStyles);
  const externalComponents = collectPackageBoundImages(root, assetPackage.componentAssets, consumedIds);
  const arrowItems = collectArrowItems(root, classStyles, consumedIds);

  for (const text of texts) {
    consumedIds.add(text.id);
  }

  const baseLayer = buildBaseLayer(root, width, height, classStyles, consumedIds);
  const warnings: string[] = [];

  if (arrowItems.preserved.length) {
    warnings.push('部分箭头保留为原 SVG 图片形态导入。');
  }
  if (Object.keys(assetPackage.componentAssets).length && !externalComponents.length) {
    warnings.push('未在总 SVG 中匹配到组件占位节点，请检查文件命名规则。');
  }

  const elements: PlaitElement[] = [
    ...(baseLayer.image ? [buildImageElement(baseLayer.image)] : []),
    ...externalComponents.map(buildImageElement),
    ...arrowItems.preserved.map(buildImageElement),
    ...arrowItems.converted.map(buildArrowElement),
    ...texts.map(buildTextElement),
  ];

  return {
    elements,
    summary: {
      textCount: texts.length,
      arrowCount: arrowItems.converted.length,
      componentCount:
        externalComponents.length
        + arrowItems.preserved.length
        + (baseLayer.image ? 1 : 0),
      ignoredBackgroundCount: baseLayer.ignoredBackgroundCount,
      warnings,
    },
  };
};

export const convertSvgToDrawnix = (svgText: string): SvgImportResult => {
  return convertSvgAssetPackageToDrawnix({
    fileName: 'inline.svg',
    svgText,
    componentAssets: {},
  });
};
