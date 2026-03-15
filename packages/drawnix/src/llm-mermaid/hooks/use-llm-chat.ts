/**
 * LLM 对话状态管理 Hook
 * 封装对话消息、流式响应和错误处理
 */

import { useCallback, useRef, useState } from 'react';
import type { GenerationContext, Message } from '../types';
import { llmChatService } from '../services/llm-chat-service';
import {
  buildMermaidUserPrompt,
  extractMermaidCode,
  getInitialPrompt,
  validateMermaidCode,
} from '../services/prompt-templates';
import { sanitizeUserInput, validateUserInput } from '../utils/message-validator';

interface SendMessageOptions {
  requestContent?: string;
  generationContext?: Partial<GenerationContext>;
}

function createId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export interface UseLLMChatResult {
  messages: Message[];
  isStreaming: boolean;
  error: Error | null;
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
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
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setError(null);
    setIsGenerating(false);
  }, []);

  const sendMessageInternal = useCallback(
    async (
      content: string,
      options?: SendMessageOptions,
      history: Message[] = messages
    ) => {
      const validation = validateUserInput(content);
      if (!validation.isValid) {
        setError(new Error(validation.errors.join(', ')));
        return;
      }

      const sanitizedContent = sanitizeUserInput(content);
      const requestContent =
        options?.requestContent?.trim() ||
        buildMermaidUserPrompt(sanitizedContent, options?.generationContext);
      const lastMessage = history[history.length - 1];

      if (
        lastMessage &&
        lastMessage.role === 'user' &&
        lastMessage.content.toLowerCase().trim() === sanitizedContent.toLowerCase()
      ) {
        setError(new Error('请避免重复输入相同内容'));
        return;
      }

      const userMessage: Message = {
        id: createId(),
        role: 'user',
        content: sanitizedContent,
        timestamp: Date.now(),
        type: 'text',
        metadata: {
          requestContent,
          generationContext: options?.generationContext,
          isComplete: true,
        },
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsGenerating(true);
      setError(null);
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const assistantMessageId = createId();

      try {
        const systemMessage: Message = {
          id: 'system',
          role: 'system',
          content: initialSystemPrompt || getInitialPrompt(),
          timestamp: Date.now(),
          type: 'text',
        };

        const chatMessages = [systemMessage, ...history, userMessage].map((message) => {
          if (message.role === 'user' && message.metadata?.requestContent) {
            return {
              ...message,
              content: message.metadata.requestContent,
            };
          }

          return message;
        });

        let responseContent = '';

        for await (const chunk of llmChatService.chatStream(chatMessages, {
          signal: controller.signal,
        })) {
          const deltaContent = chunk.choices[0]?.delta?.content || '';

          if (!deltaContent) {
            continue;
          }

          responseContent += deltaContent;

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.id === assistantMessageId) {
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  content: responseContent,
                  metadata: {
                    ...last.metadata,
                    isStreaming: true,
                    isComplete: false,
                  },
                },
              ];
            }

            const assistantMessage: Message = {
              id: assistantMessageId,
              role: 'assistant',
              content: responseContent,
              timestamp: Date.now(),
              type: 'text',
              metadata: {
                isStreaming: true,
                isComplete: false,
                generationContext: options?.generationContext,
              },
            };

            return [...prev, assistantMessage];
          });
        }

        const extractedMermaidCode = extractMermaidCode(responseContent);
        const mermaidValidation = validateMermaidCode(extractedMermaidCode);
        const hasValidMermaidCode = mermaidValidation.isValid;

        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id !== assistantMessageId) {
            return prev;
          }

          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content: hasValidMermaidCode ? extractedMermaidCode : responseContent,
              type: hasValidMermaidCode ? 'mermaid' : 'text',
              metadata: {
                ...last.metadata,
                isStreaming: false,
                isComplete: true,
                mermaidCode: hasValidMermaidCode ? extractedMermaidCode : undefined,
              },
            },
          ];
        });

        if (!hasValidMermaidCode) {
          setError(
            new Error(
              mermaidValidation.errors.length > 0
                ? `生成结果不是有效的 Mermaid 代码：${mermaidValidation.errors.join('，')}`
                : 'AI 返回结果中未提取到 Mermaid 代码，请重试或补充更明确的描述'
            )
          );
        }
      } catch (err) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id === assistantMessageId) {
            return prev.slice(0, -1);
          }
          return prev;
        });

        if (!(err instanceof Error && err.name === 'AbortError')) {
          setError(err instanceof Error ? err : new Error('发送消息失败'));
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setIsGenerating(false);
      }
    },
    [initialSystemPrompt, messages]
  );

  const sendMessage = useCallback(
    async (content: string, options?: SendMessageOptions) => {
      await sendMessageInternal(content, options, messages);
    },
    [messages, sendMessageInternal]
  );

  const regenerate = useCallback(async () => {
    const lastUserIndex = [...messages]
      .map((message, index) => ({ message, index }))
      .reverse()
      .find(({ message }) => message.role === 'user')?.index;

    if (lastUserIndex === undefined) {
      setError(new Error('没有可以重新生成的内容'));
      return;
    }

    const lastUserMessage = messages[lastUserIndex];
    const history = messages.slice(0, lastUserIndex);

    setMessages(history);
    await sendMessageInternal(
      lastUserMessage.content,
      {
        requestContent: lastUserMessage.metadata?.requestContent,
        generationContext: lastUserMessage.metadata?.generationContext,
      },
      history
    );
  }, [messages, sendMessageInternal]);

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
