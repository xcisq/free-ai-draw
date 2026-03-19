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
    >).mockImplementation(async (code: string) => {
      if (code.includes('X["修复"]') && code.includes('Y["完成"]')) {
        return [{ id: 'node-2' }] as unknown as any[];
      }

      throw new Error('parse error');
    });

    (llmChatService.repairMermaid as jest.MockedFunction<typeof llmChatService.repairMermaid>)
      .mockResolvedValue('flowchart LR\nX[修复] --> Y[完成]');

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
    expect(result.mermaidCode).toBe('flowchart LR\nX["修复"] --> Y["完成"]');
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

  it('定向修复失败时应该保留最佳候选 Mermaid 代码', async () => {
    (mermaidConverter.convertToElements as jest.MockedFunction<
      typeof mermaidConverter.convertToElements
    >).mockRejectedValue(new Error('parse error'));

    (llmChatService.repairMermaid as jest.MockedFunction<typeof llmChatService.repairMermaid>)
      .mockResolvedValue('flowchart LR\nA -->');

    const service = new MermaidStabilizerService();

    await expect(
      service.stabilizeCode('说明\nA[开始] --> B[结束', {
        allowLLMRepair: true,
      })
    ).rejects.toMatchObject({
      name: 'MermaidStabilizationError',
      stage: 'repair',
      bestEffortCode: 'flowchart LR\nA["开始"] --> B["结束"]',
    });
  });

  it('没有提取到 Mermaid 主体时不应继续发起修复请求', async () => {
    const service = new MermaidStabilizerService();

    await expect(
      service.stabilizeResponse('这是一段解释文字，没有任何图代码。', {
        allowLLMRepair: true,
      })
    ).rejects.toMatchObject({
      name: 'MermaidStabilizationError',
      stage: 'extract',
      message: 'AI 返回结果中没有可提取的 Mermaid 正文',
    });

    expect(llmChatService.repairMermaid).not.toHaveBeenCalled();
  });
});
