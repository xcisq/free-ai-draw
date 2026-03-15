/**
 * Chat Panel 主组件
 * 集成消息列表、输入框和预设表单
 */

import { useEffect } from 'react';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';
import { StructuredInputForm } from './structured-input-form';
import { useLLMChat } from '../../hooks/use-llm-chat';
import type { GenerationContext } from '../../types';
import './index.scss';

export interface ChatPanelProps {
  onContextChange?: (context: Partial<GenerationContext>) => void;
  onMermaidGenerated?: (code: string) => void;
  disabled?: boolean;
}

export const ChatPanel = ({
  onContextChange,
  onMermaidGenerated,
  disabled = false,
}: ChatPanelProps) => {
  const { messages, isStreaming, error, sendMessage, regenerate, clearError } = useLLMChat();

  // 处理上下文变化
  const handleContextChange = (context: Partial<GenerationContext>) => {
    onContextChange?.(context);
  };

  // 处理发送消息
  const handleSend = async (content: string) => {
    try {
      await sendMessage(content);
      // 检查是否生成了 Mermaid 代码
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.metadata?.mermaidCode) {
        onMermaidGenerated?.(lastMessage.metadata.mermaidCode);
      }
    } catch (err) {
      // 错误已由 useLLMChat Hook 处理
      console.error('Send message failed:', err);
    }
  };

  // 处理重新生成
  const handleRegenerate = async () => {
    try {
      await regenerate();
      // 检查是否生成了 Mermaid 代码
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.metadata?.mermaidCode) {
        onMermaidGenerated?.(lastMessage.metadata.mermaidCode);
      }
    } catch (err) {
      console.error('Regenerate failed:', err);
    }
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

  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <h3 className="chat-panel-title">AI 对话</h3>
        <button
          className="chat-panel-clear"
          onClick={() => {
            // 清空对话的回调
            window.location.reload();
          }}
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
        <StructuredInputForm
          onContextChange={handleContextChange}
          disabled={disabled || isStreaming}
        />

        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          onRegenerate={handleRegenerate}
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
          placeholder="描述你想生成的流程图... (Ctrl/Cmd + Enter 发送)"
        />
      </div>
    </div>
  );
};
