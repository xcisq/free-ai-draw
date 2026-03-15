/**
 * Mermaid 辅助工具函数
 */

import { extractMermaidCode, validateMermaidCode } from '../services/prompt-templates';

/**
 * 修复 Mermaid 代码中的常见问题
 */
export function fixMermaidCode(code: string): string {
  let fixedCode = code.trim();

  // 修复 1: 移除 markdown 代码块标记
  fixedCode = extractMermaidCode(fixedCode);

  // 修复 2: 确保有类型声明
  if (!/^flowchart|graph|stateDiagram|classDiagram|sequenceDiagram|erDiagram|gantt|pie|journey/.test(fixedCode)) {
    // 如果没有类型声明，尝试添加默认的 flowchart LR
    fixedCode = `flowchart LR\n${fixedCode}`;
  }

  // 修复 3: 替换双引号为单引号（避免转义问题）
  fixedCode = fixedCode.replace(/"/g, "'");

  // 修复 4: 移除多余的空行
  fixedCode = fixedCode.replace(/\n{3,}/g, '\n\n');

  // 修复 5: 确保节点名称不含特殊字符
  // 将包含特殊字符的节点名称用引号包裹
  fixedCode = fixNodeNames(fixedCode);

  return fixedCode;
}

/**
 * 修复节点名称中的特殊字符
 */
function fixNodeNames(code: string): string {
  // 查找可能包含特殊字符的节点（如中文、空格等）
  // 并使用引号包裹
  return code.replace(/\[([^\[\]]*?)\]/g, (match, content) => {
    // 如果内容包含非 ASCII 字符或空格，使用引号包裹
    if (/[^a-zA-Z0-9_]/.test(content)) {
      return `["${content}"]`;
    }
    return match;
  });
}

/**
 * 检查是否为有效 Mermaid 代码
 */
export function isValidMermaid(code: string): boolean {
  const result = validateMermaidCode(code);
  return result.isValid;
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
  const classDefRegex = /classDef\s+(\w+)\s*\{([^}]+)\}/g;
  let match;

  while ((match = classDefRegex.exec(code)) !== null) {
    const className = match[1];
    const stylesContent = match[2];

    const styleProps: Record<string, string> = {};
    const styleRegex = /(\w+):\s*([^;]+);?/g;
    let styleMatch;

    while ((styleMatch = styleRegex.exec(stylesContent)) !== null) {
      styleProps[styleMatch[1]] = styleMatch[2].trim();
    }

    styles.push({ className, styles: styleProps });
  }

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
  return code.replace(/classDef\s+\w+\s*\{[^}]*\}/g, '');
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
