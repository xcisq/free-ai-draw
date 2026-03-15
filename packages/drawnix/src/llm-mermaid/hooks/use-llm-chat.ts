/**
 * LLM 对话状态管理 Hook
 * 封装对话消息、流式响应和错误处理
 */

import { useState, useCallback, useRef } from 'react';
import type { Message, MessageRole, ChatOptions } from '../types';
import { llmChatService, LLMChatError } from '../services/llm-chat-service';
import { getInitialPrompt } from '../services/prompt-templates';
import { validateUserInput, detectRepetition } from '../utils/message-validator';

export interface UseLLMChatResult {
  messages: Message[];
  isStreaming: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<void>;
  regenerate: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export function useLLMChat(initialSystemPrompt?: string): UseLLMChatResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setIsGenerating(false);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      // 验证输入
      const validation = validateUserInput(content);
      if (!validation.isValid) {
        setError(new Error(validation.errors.join(', ')));
        return;
      }

      // 检测重复输入
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.content.toLowerCase().trim() === content.toLowerCase().trim()) {
        setError(new Error('请避免重复输入相同内容'));
        return;
      }

      // 添加用户消息
      const userMessage: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        content,
        timestamp: Date.now(),
        type: 'text',
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsGenerating(true);
      setError(null);

      // 创建 AbortController 用于取消请求
      abortControllerRef.current = new AbortController();

      try {
        // 准备消息历史（包含系统提示）
        const systemMessage: Message = {
          id: 'system',
          role: 'system',
          content: initialSystemPrompt || getInitialPrompt(),
          timestamp: Date.now(),
          type: 'text',
        };

        const chatMessages = [systemMessage, ...messages, userMessage];

        // 调用 LLM API
        let responseContent = '';

        // 使用流式响应
        for await (const chunk of llmChatService.chatStream(chatMessages)) {
          if (chunk.choices[0]?.delta?.content) {
            responseContent += chunk.choices[0].delta.content;
          }

          // 更新正在生成的消息
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant' && last.type === 'text' && !last.metadata?.isComplete) {
              // 更新现有消息
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + chunk.choices[0].delta.content },
              ];
            } else {
              // 创建新消息
              const assistantMessage: Message = {
                id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                role: 'assistant',
                content: responseContent,
                timestamp: Date.now(),
                type: 'text',
                metadata: { isStreaming: true },
              };
              return [...prev, assistantMessage];
            }
          });
        }

        // 消息生成完成
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...last, metadata: { isComplete: true } },
            ];
          }
          return prev;
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setError(new Error('请求已取消'));
        } else {
          setError(err instanceof Error ? err : new Error('发送消息失败'));
        }
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [messages, initialSystemPrompt]
  );

  const regenerate = useCallback(async () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) {
      setError(new Error('没有可以重新生成的内容'));
      return;
    }

    // 移除最后的助手消息（如果有）
    const messagesToKeep = messages.filter(m => !(m.role === 'assistant' && m.metadata?.isStreaming));

    // 重新发送最后的用户消息
    setMessages(messagesToKeep);

    // 使用 setTimeout 避免状态更新冲突
    setTimeout(() => {
      sendMessage(lastUserMessage.content);
    }, 0);
  }, [messages, sendMessage]);

  return {
    messages,
    isStreaming: isGenerating,
    error,
    sendMessage,
    regenerate,
    clearError,
    reset,
  };
}
