/**
 * 单条消息显示组件
 * 支持文本、代码、加载状态、重新生成
 */

import { useEffect, useRef } from 'react';
import type { Message } from '../../types';
import './message-item.scss';

export interface MessageItemProps {
  message: Message;
  isLastAssistant?: boolean;
  onRegenerate?: () => void;
  disabled?: boolean;
}

export const MessageItem = ({
  message,
  isLastAssistant = false,
  onRegenerate,
  disabled = false,
}: MessageItemProps) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部（用于流式更新时）
  useEffect(() => {
    if (contentRef.current && message.metadata?.isStreaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [message.metadata?.isStreaming]);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isLoading = message.metadata?.isStreaming;
  const hasMermaid = !!message.metadata?.mermaidCode;

  // 处理重新生成
  const handleRegenerate = () => {
    if (!disabled && onRegenerate) {
      onRegenerate();
    }
  };

  return (
    <div className={`message-item message-item-${message.role}`}>
      <div className="message-header">
        <div className="message-role">
          {isUser ? (
            <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M3 14c0-3 2-4 5-4s5 1 5 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
              <rect
                x="3"
                y="3"
                width="10"
                height="10"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M6 8h1M9 8h1M6 10h4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
          <span>{isUser ? '你' : 'AI 助手'}</span>
        </div>
        <div className="message-meta">
          {hasMermaid && (
            <span className="message-tag message-tag-mermaid">已生成流程图</span>
          )}
          <span className="message-time">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {isLastAssistant && !isLoading && onRegenerate && (
            <button
              className="message-regenerate"
              onClick={handleRegenerate}
              disabled={disabled}
              title="重新生成"
            >
              <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M8 2L8 6M8 6L6 4M8 6L10 4M8 10v4M8 14l-2-2M8 14l2-2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="message-content" ref={contentRef}>
        {isLoading && !message.content ? (
          <span className="message-loading">
            <span className="loading-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </span>
        ) : (
          <span className="message-text">{message.content}</span>
        )}
      </div>
      {isLoading && message.content && <span className="message-cursor">|</span>}
    </div>
  );
};
