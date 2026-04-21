/**
 * Mermaid 辅助工具函数
 */

import { extractMermaidCode, validateMermaidCode } from '../services/prompt-templates';
import type { ValidationResult } from '../types';
import { detectDiagramTypeFromCode, findDiagramDeclaration } from './diagram-capabilities';

export interface MermaidNormalizationResult {
  code: string;
  appliedFixes: string[];
}

/**
 * 修复 Mermaid 代码中的常见问题
 */
export function fixMermaidCode(code: string): string {
  return normalizeMermaidCode(code).code;
}

/**
 * 规范化 Mermaid 代码，并记录应用过的修复
 */
export function normalizeMermaidCode(code: string): MermaidNormalizationResult {
  let fixedCode = code.trim();
  const appliedFixes: string[] = [];

  // 修复 1: 移除 markdown 代码块标记
  fixedCode = extractMermaidCode(fixedCode);
  const withoutStandaloneMarker = fixedCode.replace(/^mermaid\s*\n/i, '').trim();
  if (withoutStandaloneMarker !== fixedCode) {
    fixedCode = withoutStandaloneMarker;
    appliedFixes.push('移除多余的 mermaid 标记');
  }

  // 修复 2: 确保有类型声明
  if (!findDiagramDeclaration(fixedCode)) {
    fixedCode = insertDefaultFlowchartDeclaration(fixedCode);
    appliedFixes.push('补全图类型声明');
  }

  // 修复 3: 统一换行与标点
  const normalizedWhitespace = fixedCode
    .replace(/\r\n?/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
  if (normalizedWhitespace !== fixedCode) {
    fixedCode = normalizedWhitespace;
    appliedFixes.push('统一特殊引号与换行');
  }

  // 修复 4: 移除多余的空行
  const compacted = fixedCode.replace(/\n{3,}/g, '\n\n');
  if (compacted !== fixedCode) {
    fixedCode = compacted;
    appliedFixes.push('压缩多余空行');
  }

  const balancedCode = fixedCode
    .split('\n')
    .map((line) => balanceLine(line))
    .join('\n');
  if (balancedCode !== fixedCode) {
    fixedCode = balancedCode;
    appliedFixes.push('补全明显缺失的行内括号');
  }

  // 修复 5: 确保节点名称不含特殊字符
  // 将包含特殊字符的节点名称用引号包裹
  const fixedNodeNamesCode = fixNodeNames(fixedCode);
  if (fixedNodeNamesCode !== fixedCode) {
    fixedCode = fixedNodeNamesCode;
    appliedFixes.push('规范节点标签写法');
  }

  return {
    code: fixedCode.trim(),
    appliedFixes,
  };
}

/**
 * 从流式文本中提取当前可用的 Mermaid 候选
 */
export function extractStreamingMermaidCandidate(text: string): string | null {
  const fencedOpenMatch = text.match(/```(?:mermaid)?\s*\n([\s\S]*)$/i);
  if (fencedOpenMatch?.[1]) {
    return collectStreamingCandidate(stripTrailingFence(fencedOpenMatch[1]), true);
  }

  const lines = text.split('\n');
  const startIndex = findStreamingStartIndex(lines);

  if (startIndex === -1) {
    const heuristicStartIndex = lines.findIndex((line) => isLikelyMermaidStartLine(line));
    if (heuristicStartIndex === -1) {
      return null;
    }

    return collectStreamingCandidate(lines.slice(heuristicStartIndex).join('\n'), false);
  }

  return collectStreamingCandidate(lines.slice(startIndex).join('\n'), true);
}

/**
 * 修复节点名称中的特殊字符
 */
function fixNodeNames(code: string): string {
  // 查找可能包含特殊字符的节点（如中文、空格等）
  // 并使用引号包裹
  return code.replace(/\[([^\]]*?)\]/g, (match, content) => {
    if (/^["'].+["']$/.test(content.trim())) {
      return match;
    }

    // 如果内容包含非 ASCII 字符或空格，使用引号包裹
    if (/[^a-zA-Z0-9_]/.test(content)) {
      return `["${content}"]`;
    }
    return match;
  });
}

function stripTrailingFence(code: string) {
  return code.replace(/\n?```[\s\S]*$/, '').trimEnd();
}

function collectStreamingCandidate(segment: string, startsWithDiagramType: boolean) {
  const mermaidLines: string[] = [];
  const lines = stripTrailingFence(segment).split('\n');

  for (const line of lines) {
    if (isLikelyStreamingMermaidLine(line, startsWithDiagramType && mermaidLines.length === 0)) {
      mermaidLines.push(line);
      continue;
    }

    if (mermaidLines.length > 0) {
      break;
    }
  }

  const candidate = mermaidLines.join('\n').trim();
  return candidate || null;
}

function isLikelyStreamingMermaidLine(line: string, isFirstTypedLine: boolean) {
  const trimmed = line.trim();

  if (!trimmed) {
    return true;
  }

  if (isFirstTypedLine) {
    return /^%%\{.*\}%%$/.test(trimmed) || trimmed === '---' || Boolean(findDiagramDeclaration(trimmed));
  }

  if (trimmed === '---' || /^%%\{.*\}%%$/.test(trimmed) || findDiagramDeclaration(trimmed)) {
    return true;
  }

  return /^(subgraph|end|classDef|class|style|linkStyle|click|%%)\b/.test(trimmed)
    || /-->|---|-.->|==>|==/.test(trimmed)
    || /^\w[\w-]*\s*(?:\[[^\]]*\]|\([^)]+\)|\{[^}]+\}|:::.*)?$/.test(trimmed)
    || /^\w[\w-]*\s*:::/.test(trimmed);
}

function isLikelyMermaidStartLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed) {
    return false;
  }

  return /^(subgraph|classDef|class|style|linkStyle|click|%%)\b/.test(trimmed)
    || /-->|---|-.->|==>|==/.test(trimmed)
    || /^\w[\w-]*\s*(?:\[[^\]]*\]|\([^)]+\)|\{[^}]+\}|:::.*)/.test(trimmed);
}

function balanceLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed || /^(flowchart|graph|subgraph|end|classDef|class|style|linkStyle|click|%%)\b/.test(trimmed)) {
    return line;
  }

  let nextLine = line;
  const delimiters: Array<[string, string]> = [
    ['[', ']'],
    ['(', ')'],
    ['{', '}'],
  ];

  delimiters.forEach(([open, close]) => {
    const openCount = (nextLine.match(new RegExp(`\\${open}`, 'g')) || []).length;
    const closeCount = (nextLine.match(new RegExp(`\\${close}`, 'g')) || []).length;

    if (openCount > closeCount) {
      nextLine += close.repeat(openCount - closeCount);
    }
  });

  return nextLine;
}

/**
 * 生成 Mermaid 本地修复候选
 */
export function createMermaidRepairCandidates(code: string): string[] {
  const normalized = normalizeMermaidCode(code);
  const candidates = new Set<string>();
  const baseCode = normalized.code.trim();

  if (baseCode) {
    candidates.add(baseCode);
    candidates.add(formatMermaidCode(baseCode));
  }

  if (baseCode.includes('"')) {
    candidates.add(baseCode.replace(/"/g, "'"));
  }

  if (baseCode.includes(';')) {
    candidates.add(baseCode.replace(/;+\s*$/gm, ''));
  }

  return Array.from(candidates).filter(Boolean);
}

/**
 * 检查是否为有效 Mermaid 代码
 */
export function isValidMermaid(code: string): boolean {
  const result = validateMermaidCode(code);
  return result.isValid;
}

export function getPrimaryMermaidError(validation: ValidationResult | null | undefined): string | null {
  if (!validation) {
    return null;
  }

  if (validation.errors.length > 0) {
    return validation.errors[0] || null;
  }

  if (validation.warnings.length > 0) {
    return validation.warnings[0] || null;
  }

  return null;
}

/**
 * 获取 Mermaid 图表类型
 */
export function getMermaidType(code: string): string | null {
  return detectDiagramTypeFromCode(code);
}

/**
 * 检查是否支持指定的 Mermaid 特性
 */
export function checkSupportedFeatures(code: string): {
  supportsSubgraph: boolean;
  supportsClassDef: boolean;
  supportsIcon: boolean;
  hasComplexArrow: boolean;
} {
  return {
    supportsSubgraph: code.includes('subgraph'),
    supportsClassDef: code.includes('classDef') || code.includes('class'),
    supportsIcon: /:([a-z_]+):/.test(code),
    hasComplexArrow: code.includes('--|') || code.includes('--o'),
  };
}

/**
 * 格式化 Mermaid 代码
 */
export function formatMermaidCode(code: string): string {
  const lines = code.split('\n');
  const formatted: string[] = [];
  let indentLevel = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 处理 subgraph 缩进
    if (trimmed.startsWith('subgraph ')) {
      formatted.push('  '.repeat(indentLevel) + trimmed);
      indentLevel++;
    } else if (trimmed.startsWith('end')) {
      indentLevel = Math.max(0, indentLevel - 1);
      formatted.push('  '.repeat(indentLevel) + trimmed);
    } else {
      formatted.push('  '.repeat(indentLevel) + trimmed);
    }
  }

  return formatted.join('\n');
}

/**
 * 节点数量估算（基于 Mermaid 代码）
 */
export function estimateNodeCount(code: string): number {
  // 计算方括号对的数量（代表节点）
  const matches = code.match(/\[[^\]]*\]/g);
  return matches ? matches.length : 0;
}

/**
 * 检查节点数量是否超限
 */
export function isNodeCountExceeded(code: string, limit = 50): boolean {
  return estimateNodeCount(code) > limit;
}

function insertDefaultFlowchartDeclaration(code: string) {
  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  const prefix: string[] = [];
  const body: string[] = [];
  let index = 0;

  if (lines[index]?.trim() === '---') {
    prefix.push(lines[index] || '');
    index += 1;
    while (index < lines.length) {
      prefix.push(lines[index] || '');
      if (lines[index]?.trim() === '---') {
        index += 1;
        break;
      }
      index += 1;
    }
  }

  while (index < lines.length) {
    const line = lines[index] || '';
    if (!line.trim()) {
      prefix.push(line);
      index += 1;
      continue;
    }

    if (/^%%\{.*\}%%$/.test(line.trim()) || /^%%/.test(line.trim())) {
      prefix.push(line);
      index += 1;
      continue;
    }

    break;
  }

  body.push(...lines.slice(index));

  return [...prefix, 'flowchart LR', ...body].join('\n').trim();
}

function findStreamingStartIndex(lines: string[]) {
  let insideFrontmatter = false;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim() || '';
    if (!trimmed) {
      continue;
    }

    if (!insideFrontmatter && trimmed === '---') {
      insideFrontmatter = true;
      continue;
    }

    if (insideFrontmatter) {
      if (trimmed === '---') {
        insideFrontmatter = false;
      }
      continue;
    }

    if (/^%%\{.*\}%%$/.test(trimmed) || /^%%/.test(trimmed)) {
      continue;
    }

    if (findDiagramDeclaration(trimmed)) {
      return index;
    }
  }

  return -1;
}
