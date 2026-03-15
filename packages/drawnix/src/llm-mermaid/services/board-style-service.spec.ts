import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('./llm-chat-service', () => ({
  llmChatService: {
    isConfigured: jest.fn(),
    chat: jest.fn(),
  },
}));

jest.mock('@plait/draw', () => ({
  PlaitDrawElement: {
    isArrowLine: (value: any) => value?.type === 'arrow-line',
    isVectorLine: (value: any) => value?.type === 'vector-line',
    isText: (value: any) => value?.shape === 'text',
    isShapeElement: (value: any) => value?.type === 'geometry',
  },
}));

jest.mock('@plait/mind', () => ({
  MindElement: {
    isMindElement: () => false,
  },
}));

import { llmChatService } from './llm-chat-service';
import { BoardStyleService, summarizeSelectedElements } from './board-style-service';

describe('BoardStyleService', () => {
  beforeEach(() => {
    (llmChatService.chat as jest.MockedFunction<typeof llmChatService.chat>).mockReset();
    (llmChatService.isConfigured as jest.MockedFunction<typeof llmChatService.isConfigured>).mockReset();
    (llmChatService.isConfigured as jest.MockedFunction<typeof llmChatService.isConfigured>).mockReturnValue(true);
  });

  it('应该解析多方案 JSON 响应', async () => {
    (llmChatService.chat as jest.MockedFunction<typeof llmChatService.chat>).mockResolvedValue(`{
      "schemes": [
        {
          "id": "scheme-1",
          "name": "专业蓝",
          "description": "适合技术流程图",
          "styles": {
            "shape": { "fill": "#f5f8ff", "stroke": "#2b5fb3", "strokeWidth": 2 },
            "line": { "stroke": "#2b5fb3", "strokeStyle": "dashed", "targetMarker": "solid-triangle" }
          }
        }
      ]
    }`);

    const service = new BoardStyleService();
    const result = await service.generateMultipleSchemes(
      null,
      [
        { id: 'shape-1', type: 'geometry', shape: 'rectangle', fill: '#fff' } as any,
        { id: 'line-1', type: 'arrow-line', shape: 'straight', strokeColor: '#333' } as any,
      ],
      '更专业一点',
      3
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.styles.shape?.fill).toBe('#f5f8ff');
    expect(llmChatService.chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user', content: expect.stringContaining('更专业一点') }),
      ]),
      expect.objectContaining({ maxTokens: 2500 })
    );
  });

  it('未配置 API 时应该报错', async () => {
    (llmChatService.isConfigured as jest.MockedFunction<typeof llmChatService.isConfigured>).mockReturnValue(false);

    const service = new BoardStyleService();

    await expect(
      service.generateMultipleSchemes(
        null,
        [{ id: 'shape-1', type: 'geometry', shape: 'rectangle' } as any]
      )
    ).rejects.toThrow('VITE_LLM_MERMAID_API_KEY');
  });

  it('应该生成选中元素摘要', () => {
    const summary = summarizeSelectedElements(
      null,
      [
        { id: 'shape-1', type: 'geometry', shape: 'rectangle', fill: '#fff', strokeColor: '#333' } as any,
        { id: 'line-1', type: 'arrow-line', shape: 'straight', strokeColor: '#555' } as any,
        { id: 'text-1', type: 'geometry', shape: 'text' } as any,
      ]
    );

    expect(summary.total).toBe(3);
    expect(summary.originalTotal).toBe(3);
    expect(summary.shapeCount).toBe(1);
    expect(summary.lineCount).toBe(1);
    expect(summary.textCount).toBe(1);
    expect(summary.relatedLineCount).toBe(0);
    expect(summary.includeConnectedLines).toBe(false);
    expect(summary.fills).toContain('#fff');
  });

  it('应该忽略不稳定的 curve 连线样式', () => {
    const service = new BoardStyleService();

    const result = service.parseSchemes(`{
      "schemes": [
        {
          "id": "scheme-1",
          "name": "曲线方案",
          "description": "包含危险曲线",
          "styles": {
            "line": { "stroke": "#2b5fb3", "lineShape": "curve" }
          }
        }
      ]
    }`);

    expect(result[0]?.styles.line?.stroke).toBe('#2b5fb3');
    expect(result[0]?.styles.line?.lineShape).toBeUndefined();
  });
});
