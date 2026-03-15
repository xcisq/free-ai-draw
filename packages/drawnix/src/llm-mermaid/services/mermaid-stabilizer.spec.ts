import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('./llm-chat-service', () => ({
  llmChatService: {
    repairMermaid: jest.fn(),
  },
}));

jest.mock('./mermaid-converter', () => ({
  mermaidConverter: {
    convertToElements: jest.fn(),
  },
}));

import { llmChatService } from './llm-chat-service';
import { mermaidConverter } from './mermaid-converter';
import { MermaidStabilizerService } from './mermaid-stabilizer';

describe('MermaidStabilizerService', () => {
  beforeEach(() => {
    (llmChatService.repairMermaid as jest.MockedFunction<typeof llmChatService.repairMermaid>).mockReset();
    (mermaidConverter.convertToElements as jest.MockedFunction<
      typeof mermaidConverter.convertToElements
    >).mockReset();
  });

  it('应该优先通过本地修复恢复轻微语法问题', async () => {
    (mermaidConverter.convertToElements as jest.MockedFunction<
      typeof mermaidConverter.convertToElements
    >).mockResolvedValue([{ id: 'node-1' }] as unknown as any[]);

    const service = new MermaidStabilizerService();
    const result = await service.stabilizeCode('A[开始] --> B[结束');

    expect(result.mermaidCode).toContain('flowchart LR');
    expect(result.mermaidCode).toContain('B["结束"]');
    expect(result.source).toBe('local-fix');
    expect(llmChatService.repairMermaid).not.toHaveBeenCalled();
  });

  it('本地修复失败后应该进行一次定向修复重试', async () => {
    (mermaidConverter.convertToElements as jest.MockedFunction<
      typeof mermaidConverter.convertToElements
    >)
      .mockRejectedValueOnce(new Error('parse error'))
      .mockResolvedValueOnce([{ id: 'node-2' }] as unknown as any[]);

    (llmChatService.repairMermaid as jest.MockedFunction<typeof llmChatService.repairMermaid>)
      .mockResolvedValue('flowchart LR\nA[开始] --> B[结束]');

    const service = new MermaidStabilizerService();
    const result = await service.stabilizeResponse('说明文字\nA[开始] --> B[结束', {
      allowLLMRepair: true,
      originalRequest: '生成一个简单流程图',
    });

    expect(llmChatService.repairMermaid).toHaveBeenCalledWith(
      expect.stringContaining('生成一个简单流程图'),
      expect.objectContaining({
        signal: undefined,
      })
    );
    expect(result.source).toBe('llm-repair');
    expect(result.mermaidCode).toBe('flowchart LR\nA["开始"] --> B["结束"]');
  });

  it('定向修复仍失败时应该抛出明确错误', async () => {
    (mermaidConverter.convertToElements as jest.MockedFunction<
      typeof mermaidConverter.convertToElements
    >).mockRejectedValue(new Error('parse error'));

    (llmChatService.repairMermaid as jest.MockedFunction<typeof llmChatService.repairMermaid>)
      .mockResolvedValue('flowchart LR\nA -->');

    const service = new MermaidStabilizerService();

    await expect(
      service.stabilizeCode('A[开始] --> B[结束', {
        allowLLMRepair: true,
      })
    ).rejects.toMatchObject({
      name: 'MermaidStabilizationError',
      stage: 'repair',
    });
  });
});
