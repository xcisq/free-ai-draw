/**
 * Chat Panel 主组件
 * 负责自然对话、澄清回复和 Mermaid 生成
 */

import { useEffect } from 'react';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';
import { useLLMChat } from '../../hooks/use-llm-chat';
import type { GenerationContext } from '../../types';
import './index.scss';

export interface ChatPanelProps {
  generationContext?: Partial<GenerationContext>;
  onContextResolved?: (context: Partial<GenerationContext>) => void;
  onMermaidGenerated?: (code: string) => void;
  onReset?: () => void;
  disabled?: boolean;
}

export const ChatPanel = ({
  generationContext,
  onContextResolved,
  onMermaidGenerated,
  onReset,
  disabled = false,
}: ChatPanelProps) => {
  const { messages, isStreaming, error, sendMessage, regenerate, clearError, reset } = useLLMChat();

  // 处理发送消息
  const handleSend = async (content: string) => {
    try {
      await sendMessage(content, {
        generationContext,
      });
    } catch (err) {
      // 错误已由 useLLMChat Hook 处理
      console.error('Send message failed:', err);
    }
  };

  // 处理重新生成
  const handleRegenerate = async () => {
    try {
      await regenerate();
    } catch (err) {
      console.error('Regenerate failed:', err);
    }
  };

  const handleClear = () => {
    reset();
    onMermaidGenerated?.('');
    onReset?.();
  };

  // 检测 Mermaid 代码生成
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage?.role === 'assistant' &&
      !isStreaming &&
      lastMessage.metadata?.mermaidCode
    ) {
      onMermaidGenerated?.(lastMessage.metadata.mermaidCode);
    }
  }, [messages, isStreaming, onMermaidGenerated]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.metadata?.normalizedContext) {
      onContextResolved?.(lastMessage.metadata.normalizedContext);
    }
  }, [messages, onContextResolved]);

  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <div className="chat-panel-header-copy">
          <h3 className="chat-panel-title">结构对话</h3>
          <p className="chat-panel-subtitle">先说原始文本，再补充你想要的论文图构图方式。</p>
        </div>
        <button
          className="chat-panel-clear"
          onClick={handleClear}
          disabled={disabled || isStreaming}
          title="清空对话"
        >
          <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4 4L12 12M4 12L12 4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="chat-panel-content">
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          onRegenerate={handleRegenerate}
          onQuickReply={handleSend}
          disabled={disabled}
        />

        {error && (
          <div className="chat-panel-error">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error.message}</span>
            <button
              className="error-dismiss"
              onClick={clearError}
              disabled={disabled}
            >
              关闭
            </button>
          </div>
        )}
      </div>

      <div className="chat-panel-footer">
        <MessageInput
          onSend={handleSend}
          disabled={disabled || isStreaming}
          placeholder="输入原始文本，或直接描述你希望的论文图构图方式... (Ctrl/Cmd + Enter 发送)"
        />
      </div>
    </div>
  );
};
