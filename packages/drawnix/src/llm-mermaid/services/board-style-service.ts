import type {
  Message,
  BoardArrowMarker,
  BoardLineShape,
  BoardStrokeStyle,
  BoardStyleSelector,
  BoardStyleScheme,
  BoardStyleSchemeOption,
  SelectedElementsSummary,
} from '../types';
import type { PlaitBoard, PlaitElement } from '@plait/core';
import { LLMChatError, llmChatService } from './llm-chat-service';
import {
  getBoardStyleMultipleSchemesPrompt,
} from './prompt-templates';
import { summarizeBoardStyleSelection } from '../utils/board-style-selection';

type BoardStyleParseFailureReason =
  | 'missing_json'
  | 'truncated_json'
  | 'invalid_json'
  | 'invalid_structure'
  | 'empty_schemes';

class BoardStyleParseError extends Error {
  constructor(
    message: string,
    public reason: BoardStyleParseFailureReason
  ) {
    super(message);
    this.name = 'BoardStyleParseError';
  }
}

export class BoardStyleService {
  async generateMultipleSchemes(
    board: PlaitBoard | null,
    elements: PlaitElement[],
    request: string = '',
    count: number = 3,
    summary?: SelectedElementsSummary
  ): Promise<BoardStyleSchemeOption[]> {
    if (!elements.length) {
      return [];
    }

    if (!llmChatService.isConfigured()) {
      throw new Error('LLM API 未配置，请先在 .env.local 中配置 VITE_LLM_MERMAID_API_KEY');
    }

    const resolvedSummary = summary || summarizeSelectedElements(board, elements);
    const prompt = getBoardStyleMultipleSchemesPrompt(resolvedSummary, request, count);
    const messages: Message[] = [
      {
        id: 'board-style-system',
        role: 'system',
        content:
          '你是一个专业的白板图表样式设计助手。你必须严格输出 JSON，不能输出 markdown、解释或额外文本。',
        timestamp: Date.now(),
        type: 'text',
      },
      {
        id: 'board-style-user',
        role: 'user',
        content: prompt,
        timestamp: Date.now(),
        type: 'text',
      },
    ];

    try {
      const response = await llmChatService.chat(messages, {
        temperature: 0.9,
        maxTokens: 2500,
      });
      return this.parseSchemes(response, count);
    } catch (error) {
      if (error instanceof BoardStyleParseError) {
        throw error;
      }

      if (error instanceof LLMChatError) {
        if (typeof error.statusCode === 'number' && error.statusCode >= 500) {
          throw new Error('样式方案生成失败：样式服务暂时不可用，请稍后重试');
        }

        throw new Error(`样式方案生成失败：${error.message}`);
      }

      throw error;
    }
  }

  parseSchemes(response: string, count: number = 3): BoardStyleSchemeOption[] {
    const extractedJson = extractCompleteStyleSchemesJson(response);
    if (extractedJson.status === 'missing') {
      throw new BoardStyleParseError('样式方案生成失败：模型未返回 JSON', 'missing_json');
    }
    if (extractedJson.status === 'truncated') {
      throw new BoardStyleParseError(
        '样式方案生成失败：返回内容不完整，JSON 被截断',
        'truncated_json'
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(extractedJson.jsonText);
    } catch (error) {
      throw new BoardStyleParseError(
        '样式方案生成失败：返回的 JSON 结构无效',
        'invalid_json'
      );
    }

    const rawSchemes = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed['schemes'])
      ? parsed['schemes']
      : null;

    if (!rawSchemes) {
      throw new BoardStyleParseError(
        '样式方案生成失败：返回的 JSON 结构无效，缺少 schemes 数组',
        'invalid_structure'
      );
    }

    const normalizedSchemes = rawSchemes
      .slice(0, count)
      .map((item, index) => normalizeScheme(item, index))
      .filter((scheme) => Object.keys(scheme.styles).length > 0);

    if (normalizedSchemes.length === 0) {
      throw new BoardStyleParseError(
        '样式方案生成失败：未返回可用样式方案',
        'empty_schemes'
      );
    }

    return normalizedSchemes;
  }
}

export const boardStyleService = new BoardStyleService();

export function summarizeSelectedElements(
  board: PlaitBoard | null,
  elements: PlaitElement[]
): SelectedElementsSummary {
  return summarizeBoardStyleSelection(board, elements, elements.length, 0, false);
}

function normalizeScheme(item: unknown, index: number): BoardStyleSchemeOption {
  const rawScheme = isRecord(item) ? item : {};
  const rawStyles = isRecord(rawScheme['styles']) ? rawScheme['styles'] : {};
  const normalizedStyles = Object.entries(rawStyles).reduce<Partial<Record<BoardStyleSelector, BoardStyleScheme>>>(
    (styles, [selector, value]) => {
      if (!isBoardStyleSelector(selector)) {
        return styles;
      }

      const normalized = normalizeStyle(selector, value);
      if (normalized) {
        styles[selector] = normalized;
      }

      return styles;
    },
    {}
  );

  return {
    id: typeof rawScheme['id'] === 'string' ? rawScheme['id'] : `scheme-${index + 1}`,
    name: typeof rawScheme['name'] === 'string' ? rawScheme['name'] : `方案 ${index + 1}`,
    description:
      typeof rawScheme['description'] === 'string'
        ? rawScheme['description']
        : 'AI 生成的样式方案',
    styles: normalizedStyles,
  };
}

function extractCompleteStyleSchemesJson(text: string): {
  status: 'missing' | 'truncated' | 'complete';
  jsonText: string;
} {
  const fencedMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/i);
  const source = fencedMatch?.[1]?.trim() || text.trim();
  const candidates = findJsonStartIndexes(source);
  let truncatedCandidate: string | null = null;

  for (const startIndex of candidates) {
    const result = extractBalancedJsonFromIndex(source, startIndex);
    if (result.status === 'complete' && looksLikeTopLevelSchemeJson(result.jsonText)) {
      return result;
    }
    if (result.status === 'truncated' && !truncatedCandidate) {
      truncatedCandidate = result.jsonText;
    }
  }

  if (truncatedCandidate) {
    return {
      status: 'truncated',
      jsonText: truncatedCandidate,
    };
  }

  return {
    status: 'missing',
    jsonText: '',
  };
}

function findJsonStartIndexes(text: string): number[] {
  const indexes: number[] = [];

  for (let index = 0; index < text.length; index++) {
    if (text[index] === '{' || text[index] === '[') {
      indexes.push(index);
    }
  }

  return indexes;
}

function extractBalancedJsonFromIndex(
  text: string,
  startIndex: number
): {
  status: 'truncated' | 'complete';
  jsonText: string;
} {
  const startToken = text[startIndex];
  const stack = [startToken];
  let inString = false;
  let escaped = false;

  for (let index = startIndex + 1; index < text.length; index++) {
    const current = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (current === '\\') {
        escaped = true;
        continue;
      }

      if (current === '"') {
        inString = false;
      }
      continue;
    }

    if (current === '"') {
      inString = true;
      continue;
    }

    if (current === '{' || current === '[') {
      stack.push(current);
      continue;
    }

    if (current === '}' || current === ']') {
      const expected = current === '}' ? '{' : '[';
      if (stack[stack.length - 1] !== expected) {
        return {
          status: 'truncated',
          jsonText: text.slice(startIndex).trim(),
        };
      }

      stack.pop();
      if (stack.length === 0) {
        return {
          status: 'complete',
          jsonText: text.slice(startIndex, index + 1).trim(),
        };
      }
    }
  }

  return {
    status: 'truncated',
    jsonText: text.slice(startIndex).trim(),
  };
}

function looksLikeTopLevelSchemeJson(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith('[')) {
    return true;
  }

  return /^\{\s*"schemes"\s*:/u.test(trimmed);
}

function normalizeStyle(selector: BoardStyleSelector, style: unknown) {
  if (!isRecord(style)) {
    return null;
  }

  const domain = getSelectorDomain(selector);
  const nextStyle: BoardStyleScheme = {
    ...(supportsField(domain, 'fill') && typeof style['fill'] === 'string'
      ? { fill: style['fill'] }
      : {}),
    ...(supportsField(domain, 'stroke') && typeof style['stroke'] === 'string'
      ? { stroke: style['stroke'] }
      : {}),
    ...(supportsField(domain, 'strokeWidth') && typeof style['strokeWidth'] === 'number'
      ? { strokeWidth: style['strokeWidth'] }
      : {}),
    ...(supportsField(domain, 'color') && typeof style['color'] === 'string'
      ? { color: style['color'] }
      : {}),
    ...(supportsField(domain, 'fontSize') && typeof style['fontSize'] === 'number'
      ? { fontSize: style['fontSize'] }
      : {}),
    ...(supportsField(domain, 'fontWeight') && typeof style['fontWeight'] === 'number'
      ? { fontWeight: style['fontWeight'] }
      : {}),
    ...(typeof style['opacity'] === 'number' ? { opacity: style['opacity'] } : {}),
    ...(supportsField(domain, 'shadow') && typeof style['shadow'] === 'boolean'
      ? { shadow: style['shadow'] }
      : {}),
    ...(supportsField(domain, 'shadowBlur') && typeof style['shadowBlur'] === 'number'
      ? { shadowBlur: style['shadowBlur'] }
      : {}),
    ...(supportsField(domain, 'shadowColor') && typeof style['shadowColor'] === 'string'
      ? { shadowColor: style['shadowColor'] }
      : {}),
    ...(supportsField(domain, 'glow') && typeof style['glow'] === 'boolean'
      ? { glow: style['glow'] }
      : {}),
    ...(supportsField(domain, 'glowColor') && typeof style['glowColor'] === 'string'
      ? { glowColor: style['glowColor'] }
      : {}),
    ...(supportsField(domain, 'glowBlur') && typeof style['glowBlur'] === 'number'
      ? { glowBlur: style['glowBlur'] }
      : {}),
    ...(supportsField(domain, 'strokeStyle') && toBoardStrokeStyle(style['strokeStyle'])
      ? { strokeStyle: toBoardStrokeStyle(style['strokeStyle']) }
      : {}),
    ...(supportsField(domain, 'lineShape') && toBoardLineShape(style['lineShape'])
      ? { lineShape: toBoardLineShape(style['lineShape']) }
      : {}),
    ...(supportsField(domain, 'sourceMarker') && toBoardArrowMarker(style['sourceMarker'])
      ? { sourceMarker: toBoardArrowMarker(style['sourceMarker']) }
      : {}),
    ...(supportsField(domain, 'targetMarker') && toBoardArrowMarker(style['targetMarker'])
      ? { targetMarker: toBoardArrowMarker(style['targetMarker']) }
      : {}),
  };

  return Object.keys(nextStyle).length > 0 ? nextStyle : null;
}

function isBoardStyleSelector(value: string): value is BoardStyleSelector {
  return value === '*'
    || value === 'shape'
    || value === 'line'
    || value === 'text'
    || /^node\.(input|process|output|decision|annotation|module|grouped|ungrouped)$/u.test(value)
    || /^line\.(main|secondary)$/u.test(value)
    || /^text\.(title|body)$/u.test(value);
}

function getSelectorDomain(selector: BoardStyleSelector): 'global' | 'shape' | 'line' | 'text' {
  if (selector === '*') {
    return 'global';
  }
  if (selector === 'line' || selector.startsWith('line.')) {
    return 'line';
  }
  if (selector === 'text' || selector.startsWith('text.')) {
    return 'text';
  }
  return 'shape';
}

function supportsField(
  domain: 'global' | 'shape' | 'line' | 'text',
  field: string
) {
  if (domain === 'global') {
    return true;
  }

  if (domain === 'line') {
    return [
      'stroke',
      'strokeWidth',
      'opacity',
      'strokeStyle',
      'lineShape',
      'sourceMarker',
      'targetMarker',
      'shadow',
      'shadowBlur',
      'shadowColor',
      'glow',
      'glowColor',
      'glowBlur',
    ].includes(field);
  }

  if (domain === 'text') {
    return [
      'color',
      'fontSize',
      'fontWeight',
      'opacity',
      'shadow',
      'shadowBlur',
      'shadowColor',
      'glow',
      'glowColor',
      'glowBlur',
    ].includes(field);
  }

  return [
    'fill',
    'stroke',
    'strokeWidth',
    'color',
    'fontSize',
    'fontWeight',
    'opacity',
    'strokeStyle',
    'shadow',
    'shadowBlur',
    'shadowColor',
    'glow',
    'glowColor',
    'glowBlur',
  ].includes(field);
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

function toBoardStrokeStyle(value: unknown): BoardStrokeStyle | undefined {
  if (value === 'solid' || value === 'dashed' || value === 'dotted') {
    return value;
  }

  return undefined;
}

function toBoardLineShape(value: unknown): BoardLineShape | undefined {
  if (value === 'straight' || value === 'elbow') {
    return value;
  }

  return undefined;
}

function toBoardArrowMarker(value: unknown): BoardArrowMarker | undefined {
  if (
    value === 'arrow'
    || value === 'none'
    || value === 'open-triangle'
    || value === 'solid-triangle'
    || value === 'sharp-arrow'
    || value === 'hollow-triangle'
  ) {
    return value;
  }

  return undefined;
}
