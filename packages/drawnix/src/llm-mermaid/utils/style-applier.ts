import type { PlaitElement } from '@plait/core';
import type { StyleScheme } from '../types';
import { extractStyles } from './mermaid-helper';

const DEFAULT_STYLE: Omit<StyleScheme, 'nodeId'> = {
  fill: '#ffffff',
  stroke: '#333333',
  strokeWidth: 1,
  color: '#333333',
  fontSize: 14,
  shadow: false,
  shadowBlur: 0,
};

/**
 * 从 Mermaid 代码中提取可用的样式方案
 */
export function extractStyleSchemesFromMermaid(code: string): StyleScheme[] {
  return extractStyles(code).map(({ className, styles }) => ({
    nodeId: className,
    fill: styles.fill || DEFAULT_STYLE.fill,
    stroke: styles.stroke || DEFAULT_STYLE.stroke,
    strokeWidth: parsePxValue(styles['stroke-width'], DEFAULT_STYLE.strokeWidth),
    color: styles.color || DEFAULT_STYLE.color,
    fontSize: parsePxValue(styles.fontSize, DEFAULT_STYLE.fontSize),
    shadow: false,
    shadowBlur: 0,
    strokeDasharray: styles['stroke-dasharray'],
  }));
}

/**
 * 将样式方案序列化为 Mermaid classDef
 */
export function serializeStyleScheme(styleScheme: StyleScheme): string {
  const segments = [
    `fill:${styleScheme.fill}`,
    `stroke:${styleScheme.stroke}`,
    `stroke-width:${styleScheme.strokeWidth}px`,
    `color:${styleScheme.color}`,
    `fontSize:${styleScheme.fontSize}px`,
  ];

  if (styleScheme.strokeDasharray) {
    segments.push(`stroke-dasharray:${styleScheme.strokeDasharray}`);
  }

  return `classDef ${styleScheme.nodeId} ${segments.join(',')}`;
}

/**
 * 批量序列化样式方案
 */
export function serializeStyleSchemes(styleSchemes: StyleScheme[]): string {
  return styleSchemes.map(serializeStyleScheme).join('\n');
}

/**
 * 对转换后的元素做轻量样式补充
 */
export function applyStyleSchemesToElements(
  elements: PlaitElement[],
  styleSchemes: StyleScheme[]
): PlaitElement[] {
  if (styleSchemes.length === 0) {
    return elements;
  }

  return elements.map((element) => {
    const styleScheme = matchStyleScheme(element, styleSchemes);
    if (!styleScheme) {
      return element;
    }

    const nextElement = {
      ...(element as Record<string, unknown>),
      fill: styleScheme.fill,
      strokeColor: styleScheme.stroke,
      strokeWidth: styleScheme.strokeWidth,
    } as Record<string, unknown>;

    const existingTextStyle = isRecord(nextElement['textStyle'])
      ? nextElement['textStyle']
      : {};

    nextElement['textStyle'] = {
      ...existingTextStyle,
      color: styleScheme.color,
      fontSize: styleScheme.fontSize,
      ...(styleScheme.fontWeight ? { fontWeight: styleScheme.fontWeight } : {}),
    };

    if (styleScheme.shadow) {
      nextElement['shadow'] = {
        color: styleScheme.stroke,
        blur: styleScheme.shadowBlur,
      };
    }

    return nextElement as PlaitElement;
  });
}

function parsePxValue(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value.replace(/px$/i, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function matchStyleScheme(
  element: PlaitElement,
  styleSchemes: StyleScheme[]
): StyleScheme | null {
  const rawElement = element as Record<string, unknown>;
  const elementId = typeof rawElement['id'] === 'string' ? rawElement['id'] : '';
  const elementText = getElementText(rawElement).toLowerCase();

  return (
    styleSchemes.find((styleScheme) => styleScheme.nodeId === '*')
    || styleSchemes.find((styleScheme) => styleScheme.nodeId === elementId)
    || styleSchemes.find((styleScheme) =>
      styleScheme.nodeId && elementText.includes(styleScheme.nodeId.toLowerCase())
    )
    || null
  );
}

function getElementText(element: Record<string, unknown>): string {
  const candidates = [element['text'], element['label'], element['content']];
  const value = candidates.find((item) => typeof item === 'string');
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
