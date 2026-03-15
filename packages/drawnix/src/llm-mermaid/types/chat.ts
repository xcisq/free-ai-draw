/**
 * 对话相关类型定义
 */

import type { GenerationContext } from './config';
import type { StyleScheme } from './style';

/**
 * 聊天消息角色
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * 聊天消息类型
 */
export type MessageType = 'text' | 'mermaid' | 'style';

/**
 * 聊天消息
 */
export interface Message {
  /** 消息唯一标识 */
  id: string;
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
  /** 时间戳（Unix ms） */
  timestamp: number;
  /** 消息类型 */
  type: MessageType;
  /** 消息元数据 */
  metadata?: MessageMetadata;
}

/**
 * 消息元数据
 */
export interface MessageMetadata {
  /** Mermaid 代码 */
  mermaidCode?: string;
  /** 样式方案 */
  styleScheme?: StyleScheme;
  /** 生成上下文 */
  generationContext?: Partial<GenerationContext>;
  /** 实际发送给 LLM 的请求内容 */
  requestContent?: string;
  /** 是否正在流式生成 */
  isStreaming?: boolean;
  /** 是否已完成 */
  isComplete?: boolean;
}

/**
 * LLM 聊天响应块
 */
export interface ChatChunk {
  id: string;
  choices: Array<{
    delta: {
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

/**
 * 聊天选项
 */
export interface ChatOptions {
  /** 是否流式响应 */
  stream?: boolean;
  /** 温度参数 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 中断信号 */
  signal?: AbortSignal;
}
