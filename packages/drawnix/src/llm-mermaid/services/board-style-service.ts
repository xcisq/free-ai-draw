import type {
  Message,
  BoardArrowMarker,
  BoardLineShape,
  BoardStrokeStyle,
  BoardStyleScheme,
  BoardStyleSchemeOption,
  SelectedElementsSummary,
} from '../types';
import type { PlaitBoard, PlaitElement } from '@plait/core';
import { llmChatService } from './llm-chat-service';
import {
  extractJsonBlock,
  getBoardStyleMultipleSchemesPrompt,
} from './prompt-templates';
import { summarizeBoardStyleSelection } from '../utils/board-style-selection';

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

    const response = await llmChatService.chat(messages, {
      temperature: 0.9,
      maxTokens: 2500,
    });

    return this.parseSchemes(response, count);
  }

  parseSchemes(response: string, count: number = 3): BoardStyleSchemeOption[] {
    const jsonText = extractJsonBlock(response);
    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(
        `样式方案解析失败: ${error instanceof Error ? error.message : '无效 JSON'}`
      );
    }

    const rawSchemes = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed['schemes'])
      ? parsed['schemes']
      : null;

    if (!rawSchemes || rawSchemes.length === 0) {
      throw new Error('样式方案为空');
    }

    return rawSchemes.slice(0, count).map((item, index) => normalizeScheme(item, index));
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

  return {
    id: typeof rawScheme['id'] === 'string' ? rawScheme['id'] : `scheme-${index + 1}`,
    name: typeof rawScheme['name'] === 'string' ? rawScheme['name'] : `方案 ${index + 1}`,
    description:
      typeof rawScheme['description'] === 'string'
        ? rawScheme['description']
        : 'AI 生成的样式方案',
    styles: {
      ...(normalizeStyle(rawStyles['*']) ? { '*': normalizeStyle(rawStyles['*'])! } : {}),
      ...(normalizeStyle(rawStyles['shape']) ? { shape: normalizeStyle(rawStyles['shape'])! } : {}),
      ...(normalizeStyle(rawStyles['line']) ? { line: normalizeStyle(rawStyles['line'])! } : {}),
      ...(normalizeStyle(rawStyles['text']) ? { text: normalizeStyle(rawStyles['text'])! } : {}),
    },
  };
}

function normalizeStyle(style: unknown) {
  if (!isRecord(style)) {
    return null;
  }

  const nextStyle: BoardStyleScheme = {
    ...(typeof style['fill'] === 'string' ? { fill: style['fill'] } : {}),
    ...(typeof style['stroke'] === 'string' ? { stroke: style['stroke'] } : {}),
    ...(typeof style['strokeWidth'] === 'number' ? { strokeWidth: style['strokeWidth'] } : {}),
    ...(typeof style['color'] === 'string' ? { color: style['color'] } : {}),
    ...(typeof style['fontSize'] === 'number' ? { fontSize: style['fontSize'] } : {}),
    ...(typeof style['opacity'] === 'number' ? { opacity: style['opacity'] } : {}),
    ...(toBoardStrokeStyle(style['strokeStyle']) ? { strokeStyle: toBoardStrokeStyle(style['strokeStyle']) } : {}),
    ...(toBoardLineShape(style['lineShape']) ? { lineShape: toBoardLineShape(style['lineShape']) } : {}),
    ...(toBoardArrowMarker(style['sourceMarker']) ? { sourceMarker: toBoardArrowMarker(style['sourceMarker']) } : {}),
    ...(toBoardArrowMarker(style['targetMarker']) ? { targetMarker: toBoardArrowMarker(style['targetMarker']) } : {}),
  };

  return Object.keys(nextStyle).length > 0 ? nextStyle : null;
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
