/**
 * Mermaid 辅助工具函数
 */

import { extractMermaidCode, validateMermaidCode } from '../services/prompt-templates';
import type { ValidationResult } from '../types';

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
  if (
    !/^(flowchart|graph|stateDiagram|classDiagram|sequenceDiagram|erDiagram|gantt|pie|journey)\b/m.test(
      fixedCode
    )
  ) {
    // 如果没有类型声明，尝试添加默认的 flowchart LR
    fixedCode = `flowchart LR\n${fixedCode}`;
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
 * 修复节点名称中的特殊字符
 */
function fixNodeNames(code: string): string {
  // 查找可能包含特殊字符的节点（如中文、空格等）
  // 并使用引号包裹
  return code.replace(/\[([^\[\]]*?)\]/g, (match, content) => {
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
  const match = code.match(/^(flowchart|graph|stateDiagram|classDiagram|sequenceDiagram|erDiagram|gantt|pie|journey)/);
  return match ? match[1] : null;
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
 * 从 Mermaid 代码中提取样式定义
 */
export function extractStyles(code: string): Array<{
  className: string;
  styles: Record<string, string>;
}> {
  const styles: Array<{ className: string; styles: Record<string, string> }> = [];
  const classDefLines = code
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('classDef '));

  classDefLines.forEach((line) => {
    const inlineMatch = line.match(/^classDef\s+(\w+)\s+(.+)$/);
    if (!inlineMatch) {
      return;
    }

    const className = inlineMatch[1];
    const stylesContent = inlineMatch[2]
      .replace(/^\{/, '')
      .replace(/\}$/, '');

    const styleProps: Record<string, string> = {};
    const styleRegex = /([\w-]+):\s*([^,;]+)\s*[,;]?/g;
    let styleMatch: RegExpExecArray | null;

    while ((styleMatch = styleRegex.exec(stylesContent)) !== null) {
      styleProps[styleMatch[1]] = styleMatch[2].trim();
    }

    styles.push({ className, styles: styleProps });
  });

  return styles;
}

/**
 * 应用样式到 Mermaid 代码
 */
export function applyStylesToCode(code: string, styleScheme: {
  nodeId: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  color: string;
  fontSize: number;
  shadow: boolean;
  shadowBlur: number;
}): string {
  const { nodeId, fill, stroke, strokeWidth, color, fontSize } = styleScheme;

  // 如果代码中已有 classDef，则更新；否则添加
  const classDefString = `classDef ${nodeId} fill:${fill} stroke:${stroke} stroke-width:${strokeWidth}px color:${color} fontSize:${fontSize}px`;

  if (code.includes('classDef')) {
    // 在现有 classDef 后添加新的
    return `${code}\n${classDefString}`;
  } else {
    // 添加 classDef 并为节点应用样式
    return `${code}\n\n${classDefString}`;
  }
}

/**
 * 清理 Mermaid 代码中的样式定义
 */
export function clearStyles(code: string): string {
  return code
    .split('\n')
    .filter((line) => !line.trim().startsWith('classDef '))
    .join('\n')
    .trim();
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
export function isNodeCountExceeded(code: string, limit: number = 50): boolean {
  return estimateNodeCount(code) > limit;
}
