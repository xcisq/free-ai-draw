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
  onQuickReply?: (content: string) => void;
  disabled?: boolean;
}

export const MessageItem = ({
  message,
  isLastAssistant = false,
  onRegenerate,
  onQuickReply,
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
  const hasQuickReplies =
    isAssistant &&
    message.metadata?.interactionPhase === 'clarifying' &&
    !!message.metadata?.quickReplies?.length;
  const assistantStatus = isAssistant ? getAssistantStatus(message) : null;

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
      {assistantStatus && (
        <div className={`message-status message-status-${assistantStatus.tone}`}>
          {assistantStatus.text}
        </div>
      )}
      {hasQuickReplies && (
        <div className="message-quick-replies">
          {message.metadata?.quickReplies?.map((reply) => (
            <button
              key={reply}
              className="message-quick-reply"
              onClick={() => onQuickReply?.(reply)}
              disabled={disabled}
            >
              {reply}
            </button>
          ))}
        </div>
      )}
      {isLoading && message.content && <span className="message-cursor">|</span>}
    </div>
  );
};

function getAssistantStatus(message: Message) {
  const metadata = message.metadata;
  if (!metadata) {
    return null;
  }

  if (metadata.interactionPhase === 'clarifying') {
    return {
      tone: 'clarify' as const,
      text: '等待你补充一个关键结构偏好',
    };
  }

  if (metadata.isStreaming) {
    return {
      tone: 'streaming' as const,
      text: metadata.streamingMermaidCode
        ? `已抓到 Mermaid 候选${formatTiming(metadata.timings?.firstCandidateMs)}`
        : '正在生成 Mermaid...',
    };
  }

  if (metadata.renderState === 'fallback') {
    const failureStageText = getFailureStageText(metadata.failureStage);
    return {
      tone: 'fallback' as const,
      text: failureStageText
        ? `自动稳定失败，已保留可编辑候选 · ${failureStageText}`
        : '自动稳定失败，已保留可编辑候选',
    };
  }

  if (metadata.mermaidCode) {
    const timingParts = [
      formatTiming(metadata.timings?.firstCandidateMs, '首个候选'),
      formatTiming(metadata.timings?.totalMs, '总耗时'),
    ].filter(Boolean);

    return {
      tone: 'stable' as const,
      text: timingParts.length > 0
        ? `已稳定预览 · ${timingParts.join(' · ')}`
        : '已稳定预览',
    };
  }

  return null;
}

function formatTiming(value?: number, prefix?: string) {
  if (value === undefined) {
    return '';
  }

  const formatted =
    value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}s`;

  return prefix ? `${prefix} ${formatted}` : ` · ${formatted}`;
}

function getFailureStageText(
  stage?: 'extract' | 'validate' | 'convert' | 'repair'
) {
  switch (stage) {
    case 'extract':
      return '提取阶段失败';
    case 'validate':
      return '语法校验失败';
    case 'convert':
      return '预览转换失败';
    case 'repair':
      return '自动修复失败';
    default:
      return '';
  }
}
