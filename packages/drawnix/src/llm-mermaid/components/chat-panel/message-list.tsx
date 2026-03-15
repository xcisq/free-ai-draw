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
  disabled?: boolean;
}

export const MessageList = ({
  messages,
  isStreaming,
  onRegenerate,
  disabled = false,
}: MessageListProps) => {
  const listEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  return (
    <div className="message-list">
      {messages.length === 0 && !isStreaming && (
        <div className="message-list-empty">
          开始对话，让 AI 为你生成 Pipeline 框架图
        </div>
      )}
      {messages.map((message, index) => (
        <MessageItem
          key={message.id}
          message={message}
          isLastAssistant={message.role === 'assistant' && index === messages.length - 1}
          onRegenerate={message.role === 'assistant' && index === messages.length - 1 ? onRegenerate : undefined}
          disabled={disabled}
        />
      ))}
      {isStreaming && (
        <div className="message-list-loading">AI 正在思考...</div>
      )}
      <div ref={listEndRef} />
    </div>
  );
};
