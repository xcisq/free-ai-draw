import { render, screen } from '@testing-library/react';
import type { Message } from '../../types';
import { MessageItem } from './message-item';

function createAssistantMessage(
  overrides: Partial<Message> = {},
  metadata: Message['metadata'] = {}
): Message {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content: 'flowchart LR\nA --> B',
    timestamp: Date.now(),
    type: 'text',
    metadata,
    ...overrides,
  };
}

describe('MessageItem', () => {
  it('流式阶段应提示已经抓到 Mermaid 候选', () => {
    render(
      <MessageItem
        message={createAssistantMessage(
          {},
          {
            isStreaming: true,
            streamingMermaidCode: 'flowchart LR\nA --> B',
            timings: {
              firstCandidateMs: 320,
            },
          }
        )}
      />
    );

    expect(screen.getByText('已抓到 Mermaid 候选 · 320ms')).toBeTruthy();
  });

  it('回退阶段应提示已保留可编辑候选', () => {
    render(
      <MessageItem
        message={createAssistantMessage(
          {},
          {
            mermaidCode: 'flowchart LR\nA --> B',
            renderState: 'fallback',
            failureStage: 'repair',
          }
        )}
      />
    );

    expect(screen.getByText('自动稳定失败，已保留可编辑候选 · 自动修复失败')).toBeTruthy();
  });
});
