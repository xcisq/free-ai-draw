/**
 * LLM 对话状态管理 Hook
 * 封装流式生成和错误处理
 */

import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { GenerationContext, Message, RequestKind } from '../types';
import { llmChatService } from '../services/llm-chat-service';
import { buildMermaidUserPrompt, getInitialPrompt } from '../services/prompt-templates';
import { sanitizeUserInput, validateUserInput } from '../utils/message-validator';
import { mermaidStabilizerService, MermaidStabilizationError } from '../services/mermaid-stabilizer';
import { extractStreamingMermaidCandidate } from '../utils/mermaid-helper';

interface SendMessageOptions {
  requestContent?: string;
  generationContext?: Partial<GenerationContext>;
  requestKind?: 'generate' | 'refine';
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
      const lastMessage = history[history.length - 1];

      if (
        lastMessage &&
        lastMessage.role === 'user' &&
        lastMessage.content.toLowerCase().trim() === sanitizedContent.toLowerCase()
      ) {
        setError(new Error('请避免重复输入相同内容'));
        return;
      }

      const baseContext = mergeGenerationContext(
        getLatestKnownContext(history),
        options?.generationContext
      );
      const currentMermaid = getLatestMermaidCode(history);
      const requestKind: RequestKind =
        options?.requestKind || (currentMermaid ? 'refine' : 'generate');

      const userMessage: Message = {
        id: createId(),
        role: 'user',
        content: sanitizedContent,
        timestamp: Date.now(),
        type: 'text',
        metadata: {
          generationContext: baseContext,
          normalizedContext: baseContext,
          isComplete: true,
          interactionPhase: requestKind === 'refine' ? 'refining' : 'generating',
          requestKind,
        },
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsGenerating(true);
      setError(null);
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const normalizedContext = baseContext;
        let requestContent = options?.requestContent?.trim() || '';

        if (!requestContent) {
          requestContent = buildMermaidUserPrompt(sanitizedContent, normalizedContext, {
            currentMermaid,
            requestKind,
          });
        }

        const hydratedUserMessage: Message = {
          ...userMessage,
          metadata: {
            ...userMessage.metadata,
            requestContent,
            generationContext: normalizedContext,
            normalizedContext,
            interactionPhase: requestKind === 'refine' ? 'refining' : 'generating',
            requestKind,
          },
        };

        setMessages((prev) =>
          prev.map((message) =>
            message.id === userMessage.id ? hydratedUserMessage : message
          )
        );

        await streamAssistantResponse({
          history,
          userMessage: hydratedUserMessage,
          normalizedContext,
          requestContent,
          requestKind,
          systemPrompt: initialSystemPrompt || getInitialPrompt(),
          controller,
          setMessages,
          setError,
        });
      } catch (err) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.metadata?.isStreaming) {
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
        generationContext:
          lastUserMessage.metadata?.normalizedContext ||
          lastUserMessage.metadata?.generationContext,
        requestKind:
          lastUserMessage.metadata?.requestKind === 'refine' ? 'refine' : 'generate',
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

async function streamAssistantResponse(options: {
  history: Message[];
  userMessage: Message;
  normalizedContext: Partial<GenerationContext>;
  requestContent: string;
  requestKind: RequestKind;
  systemPrompt: string;
  controller: AbortController;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setError: Dispatch<SetStateAction<Error | null>>;
}) {
  const {
    history,
    userMessage,
    normalizedContext,
    requestContent,
    requestKind,
    systemPrompt,
    controller,
    setMessages,
    setError,
  } = options;
  const assistantMessageId = createId();
  const systemMessage: Message = {
    id: 'system',
    role: 'system',
    content: systemPrompt,
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

  const requestStartedAt = Date.now();
  let firstChunkAt: number | null = null;
  let firstCandidateAt: number | null = null;
  let lastStreamingCandidate = '';
  let lastCandidateEmitAt = 0;
  let lastMessageRenderAt = 0;
  let lastRenderedContent = '';
  let responseContent = '';

  const renderAssistantMessage = (content: string, streamingCandidate?: string) => {
    const hasStreamingCandidate = Boolean(streamingCandidate);

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.id === assistantMessageId) {
        return [
          ...prev.slice(0, -1),
          {
            ...last,
            content,
            metadata: {
              ...last.metadata,
              isStreaming: true,
              isComplete: false,
              streamingMermaidCode:
                streamingCandidate ?? last.metadata?.streamingMermaidCode,
              renderState:
                hasStreamingCandidate || last.metadata?.streamingMermaidCode
                  ? 'streaming'
                  : last.metadata?.renderState,
              timings: {
                ...last.metadata?.timings,
                firstChunkMs: firstChunkAt ? firstChunkAt - requestStartedAt : undefined,
                firstCandidateMs:
                  firstCandidateAt ? firstCandidateAt - requestStartedAt : undefined,
              },
            },
          },
        ];
      }

      return [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content,
          timestamp: Date.now(),
          type: 'text',
          metadata: {
            isStreaming: true,
            isComplete: false,
            generationContext: normalizedContext,
            normalizedContext,
            interactionPhase: requestKind === 'refine' ? 'refining' : 'generating',
            requestKind,
            streamingMermaidCode: streamingCandidate,
            renderState: hasStreamingCandidate ? 'streaming' : undefined,
            timings: {
              firstChunkMs: firstChunkAt ? firstChunkAt - requestStartedAt : undefined,
              firstCandidateMs:
                firstCandidateAt ? firstCandidateAt - requestStartedAt : undefined,
            },
          },
        },
      ];
    });
  };

  for await (const chunk of llmChatService.chatStream(chatMessages, {
    signal: controller.signal,
  })) {
    const deltaContent = chunk.choices[0]?.delta?.content || '';
    if (!deltaContent) {
      continue;
    }

    responseContent += deltaContent;
    const now = Date.now();
    firstChunkAt ??= now;
    const candidate = extractStreamingMermaidCandidate(responseContent);
    const shouldEmitCandidate =
      !!candidate &&
      candidate !== lastStreamingCandidate &&
      (lastCandidateEmitAt === 0 || now - lastCandidateEmitAt >= 180);

    if (candidate && !firstCandidateAt) {
      firstCandidateAt = now;
    }
    if (shouldEmitCandidate) {
      lastStreamingCandidate = candidate!;
      lastCandidateEmitAt = now;
    }

    const shouldRenderMessage =
      lastMessageRenderAt === 0 ||
      shouldEmitCandidate ||
      now - lastMessageRenderAt >= 72;

    if (shouldRenderMessage) {
      lastMessageRenderAt = now;
      lastRenderedContent = responseContent;
      renderAssistantMessage(
        responseContent,
        shouldEmitCandidate ? candidate! : undefined
      );
    }
  }

  if (responseContent && responseContent !== lastRenderedContent) {
    renderAssistantMessage(responseContent, lastStreamingCandidate || undefined);
  }

  let stabilizedMermaidCode: string | null = null;
  let renderState: 'stable' | 'fallback' = 'stable';
  let failureStage: 'extract' | 'validate' | 'convert' | 'repair' | undefined;
  const stabilizeStartedAt = Date.now();

  try {
    const stabilizedResult = await mermaidStabilizerService.stabilizeResponse(responseContent, {
      allowLLMRepair: false,
      originalRequest: requestContent,
      signal: controller.signal,
    });

    stabilizedMermaidCode = stabilizedResult.mermaidCode;

    if (stabilizedResult.source !== 'original') {
      console.warn('[llm-mermaid] assistant mermaid auto-repaired', {
        source: stabilizedResult.source,
        fixes: stabilizedResult.appliedFixes,
      });
    }
  } catch (stabilizationError) {
    if (stabilizationError instanceof MermaidStabilizationError) {
      console.warn('[llm-mermaid] assistant mermaid stabilization failed', {
        stage: stabilizationError.stage,
        details: stabilizationError.details,
      });

      failureStage = stabilizationError.stage;
      stabilizedMermaidCode =
        stabilizationError.bestEffortCode ||
        extractStreamingMermaidCandidate(responseContent);
      renderState = stabilizedMermaidCode ? 'fallback' : 'stable';
    }

    setError(
      stabilizationError instanceof Error
        ? stabilizationError
        : new Error('AI 返回结果中未提取到稳定的 Mermaid 代码')
    );
  }

  const finishedAt = Date.now();
  const timings = {
    firstChunkMs: firstChunkAt ? firstChunkAt - requestStartedAt : undefined,
    firstCandidateMs: firstCandidateAt ? firstCandidateAt - requestStartedAt : undefined,
    stabilizeMs: finishedAt - stabilizeStartedAt,
    totalMs: finishedAt - requestStartedAt,
  };

  console.info('[llm-mermaid] response timings', timings);

  setMessages((prev) => {
    const last = prev[prev.length - 1];
    if (last?.id !== assistantMessageId) {
      return prev;
    }

    return [
      ...prev.slice(0, -1),
      {
        ...last,
        content: stabilizedMermaidCode || responseContent,
        type: stabilizedMermaidCode ? 'mermaid' : last.type,
        metadata: {
          ...last.metadata,
          isStreaming: false,
          isComplete: true,
          mermaidCode: stabilizedMermaidCode || undefined,
          streamingMermaidCode: stabilizedMermaidCode || last.metadata?.streamingMermaidCode,
          renderState,
          failureStage,
          timings,
        },
      },
    ];
  });
}

function getLatestKnownContext(messages: Message[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const metadata = messages[index]?.metadata;
    if (metadata?.normalizedContext) {
      return metadata.normalizedContext;
    }
    if (metadata?.generationContext) {
      return metadata.generationContext;
    }
  }

  return {};
}

function getLatestMermaidCode(messages: Message[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const mermaidCode = messages[index]?.metadata?.mermaidCode;
    if (mermaidCode) {
      return mermaidCode;
    }
  }

  return '';
}

function mergeGenerationContext(
  base: Partial<GenerationContext>,
  incoming: Partial<GenerationContext> | undefined
): Partial<GenerationContext> {
  return {
    ...base,
    ...incoming,
    emphasisTargets:
      incoming?.emphasisTargets?.length || base.emphasisTargets?.length
        ? [...new Set([...(base.emphasisTargets || []), ...(incoming?.emphasisTargets || [])])]
        : [],
    layoutIntentText:
      incoming?.layoutIntentText?.trim() || base.layoutIntentText || '',
  };
}
