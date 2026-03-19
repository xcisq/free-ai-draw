import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('./llm-chat-service', () => ({
  LLMChatError: class LLMChatError extends Error {
    code?: string;
    statusCode?: number;

    constructor(message: string, mockCode?: string, mockStatusCode?: number) {
      super(message);
      this.code = mockCode;
      this.statusCode = mockStatusCode;
    }
  },
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

import { LLMChatError, llmChatService } from './llm-chat-service';
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
            "node.input": { "fill": "#f5f8ff", "stroke": "#2b5fb3", "strokeWidth": 2 },
            "node.output": { "fill": "#fef3c7", "stroke": "#d97706", "glow": true, "glowColor": "#f59e0b" },
            "line.main": { "stroke": "#2b5fb3", "strokeStyle": "dashed", "targetMarker": "solid-triangle" },
            "text.title": { "color": "#0f172a", "fontSize": 16, "fontWeight": 600 }
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
    expect(result[0]?.styles['node.input']?.fill).toBe('#f5f8ff');
    expect(result[0]?.styles['node.output']?.glow).toBe(true);
    expect(result[0]?.styles['line.main']?.targetMarker).toBe('solid-triangle');
    expect(result[0]?.styles['text.title']?.fontWeight).toBe(600);
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
        { id: 'shape-1', type: 'geometry', shape: 'rectangle', text: '输入', fill: '#fff', strokeColor: '#333' } as any,
        { id: 'shape-2', type: 'geometry', shape: 'rectangle', text: '输出', textStyle: { fontSize: 16 } } as any,
        {
          id: 'line-1',
          type: 'arrow-line',
          shape: 'straight',
          strokeColor: '#555',
          source: { boundId: 'shape-1' },
          target: { boundId: 'shape-2' },
        } as any,
        { id: 'text-1', type: 'geometry', shape: 'text' } as any,
      ]
    );

    expect(summary.total).toBe(4);
    expect(summary.originalTotal).toBe(4);
    expect(summary.shapeCount).toBe(2);
    expect(summary.lineCount).toBe(1);
    expect(summary.textCount).toBe(1);
    expect(summary.relatedLineCount).toBe(0);
    expect(summary.includeConnectedLines).toBe(false);
    expect(summary.fills).toContain('#fff');
    expect(summary.fontSizes).toContain(16);
    expect(summary.semanticNodeCounts?.input).toBe(1);
    expect(summary.semanticNodeCounts?.output).toBe(1);
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
            "line.main": { "stroke": "#2b5fb3", "lineShape": "curve" }
          }
        }
      ]
    }`);

    expect(result[0]?.styles['line.main']?.stroke).toBe('#2b5fb3');
    expect(result[0]?.styles['line.main']?.lineShape).toBeUndefined();
  });

  it('半截 JSON 时应该返回明确的截断错误', () => {
    const service = new BoardStyleService();

    expect(() =>
      service.parseSchemes('前置说明 {"schemes":[{"id":"scheme-1","styles":{"shape":{"fill":"#fff"}}}')
    ).toThrow('样式方案生成失败：返回内容不完整，JSON 被截断');
  });

  it('找不到 JSON 时应该返回明确错误', () => {
    const service = new BoardStyleService();

    expect(() =>
      service.parseSchemes('服务暂时不可用，请稍后再试')
    ).toThrow('样式方案生成失败：模型未返回 JSON');
  });

  it('服务端 500 时应该转成用户可理解的样式失败提示', async () => {
    (llmChatService.chat as jest.MockedFunction<typeof llmChatService.chat>).mockRejectedValue(
      new LLMChatError('LLM 服务请求失败（500）：服务端返回了非 JSON 错误页', undefined, 500)
    );

    const service = new BoardStyleService();

    await expect(
      service.generateMultipleSchemes(
        null,
        [{ id: 'shape-1', type: 'geometry', shape: 'rectangle' } as any]
      )
    ).rejects.toThrow('样式方案生成失败：样式服务暂时不可用，请稍后重试');
  });
});
