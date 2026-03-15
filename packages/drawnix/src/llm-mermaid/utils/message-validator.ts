/**
 * 消息验证工具
 * 验证用户输入和边界检查
 */

import type { Message } from '../types';
import { estimateNodeCount, isNodeCountExceeded } from './mermaid-helper';

/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 最大对话历史轮数
 */
const MAX_CONVERSATION_ROUNDS = 20;

/**
 * 最大节点数量
 */
const MAX_NODE_COUNT = 50;

/**
 * 最小输入长度
 */
const MIN_INPUT_LENGTH = 1;

/**
 * 最大输入长度
 */
const MAX_INPUT_LENGTH = 5000;

/**
 * 验证用户输入消息
 */
export function validateUserInput(input: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const trimmed = input.trim();

  // 检查是否为空
  if (trimmed.length === 0) {
    errors.push('请输入内容');
  }

  // 检查最小长度
  if (trimmed.length > 0 && trimmed.length < MIN_INPUT_LENGTH) {
    errors.push(`输入内容至少需要 ${MIN_INPUT_LENGTH} 个字符`);
  }

  // 检查最大长度
  if (trimmed.length > MAX_INPUT_LENGTH) {
    warnings.push(`输入内容过长，建议不超过 ${MAX_INPUT_LENGTH} 个字符`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证对话历史
 */
export function validateConversationHistory(messages: Message[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查消息数量
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length > MAX_CONVERSATION_ROUNDS) {
    warnings.push(
      `对话历史较长（${userMessages.length} 轮），较早的记录可能被摘要存储`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证 Mermaid 代码生成结果
 */
export function validateMermaidGenerationResult(code: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!code || code.trim().length === 0) {
    errors.push('生成的 Mermaid 代码为空');
  }

  // 检查节点数量
  if (isNodeCountExceeded(code, MAX_NODE_COUNT)) {
    warnings.push(
      `生成的节点数量较多（${estimateNodeCount(code)} 个），可能会影响可读性`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 检查是否需要摘要存储对话历史
 */
export function needsSummary(messages: Message[]): boolean {
  const userMessages = messages.filter(m => m.role === 'user');
  return userMessages.length > MAX_CONVERSATION_ROUNDS;
}

/**
 * 生成对话摘要（简单实现）
 */
export function summarizeMessages(messages: Message[]): string {
  const lastN = messages.slice(-10); // 保留最近 10 条
  const userMessageCount = messages.filter(m => m.role === 'user').length;

  return `[对话摘要] 共 ${userMessageCount} 轮对话，以下是最近的记录：\n${lastN
    .map(m => `${m.role}: ${m.content.slice(0, 50)}...`)
    .join('\n')}`;
}

/**
 * 清理和标准化用户输入
 */
export function sanitizeUserInput(input: string): string {
  return input.trim().slice(0, MAX_INPUT_LENGTH);
}

/**
 * 检测是否为重复输入
 */
export function detectRepetition(messages: Message[]): boolean {
  if (messages.length < 3) return false;

  const lastThree = messages.slice(-3);
  const contents = lastThree.map(m => m.content.toLowerCase().trim());

  // 检查最后三条消息是否相同或非常相似
  if (contents[0] === contents[1] && contents[1] === contents[2]) {
    return true;
  }

  return false;
}

/**
 * 验证样式调整请求
 */
export function validateStyleRequest(request: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const trimmed = request.trim();

  if (trimmed.length === 0) {
    errors.push('请描述您想要的样式调整');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 提取样式调整请求中的关键信息
 */
export function extractStyleInfo(request: string): {
  wantsColor: boolean;
  wantsBorder: boolean;
  wantsShadow: boolean;
  wantsFontSize: boolean;
} {
  const lower = request.toLowerCase();

  return {
    wantsColor: lower.includes('颜色') || lower.includes('color') || /#[0-9a-fA-F]{3,6}/.test(request),
    wantsBorder: lower.includes('边框') || lower.includes('border') || lower.includes('粗细'),
    wantsShadow: lower.includes('阴影') || lower.includes('shadow'),
    wantsFontSize: lower.includes('字体') || lower.includes('font') || lower.includes('大小'),
  };
}
