/**
 * 对话历史列表组件
 * 支持滚动和自动定位
 */

import { useEffect, useRef } from 'react';
import type { Message } from '../../types';
import { MessageItem } from './message-item';
import './message-list.scss';

export interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  onRegenerate?: () => void;
  onQuickReply?: (content: string) => void;
  disabled?: boolean;
}

export const MessageList = ({
  messages,
  isStreaming,
  onRegenerate,
  onQuickReply,
  disabled = false,
}: MessageListProps) => {
  const listEndRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages[messages.length - 1];
  const loadingText = lastMessage?.metadata?.streamingMermaidCode
    ? '已抓到 Mermaid 候选，正在继续补全...'
    : 'AI 正在思考...';
  const suggestions = [
    '整体从左到右，中间两路并行，最后汇聚到评估模块',
    '主干放中间，上方是控制信息，下方是辅助支路',
    '想要论文图风格，主流程清晰，反馈边走外圈',
  ];

  // 自动滚动到底部
  useEffect(() => {
    if (listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' });
    }
  }, [messages, isStreaming]);

  return (
    <div className="message-list">
      {messages.length === 0 && !isStreaming && (
        <div className="message-list-empty">
          <div>先贴原始文本，或直接说你想要的图结构。</div>
          <div className="message-list-suggestions">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                className="message-list-suggestion"
                onClick={() => onQuickReply?.(suggestion)}
                disabled={disabled}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
      {messages.map((message, index) => (
        <MessageItem
          key={message.id}
          message={message}
          isLastAssistant={message.role === 'assistant' && index === messages.length - 1}
          onRegenerate={message.role === 'assistant' && index === messages.length - 1 ? onRegenerate : undefined}
          onQuickReply={onQuickReply}
          disabled={disabled}
        />
      ))}
      {isStreaming && (
        <div className="message-list-loading">{loadingText}</div>
      )}
      <div ref={listEndRef} />
    </div>
  );
};
