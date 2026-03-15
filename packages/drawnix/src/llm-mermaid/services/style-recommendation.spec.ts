import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('./llm-chat-service', () => ({
  llmChatService: {
    generateStyle: jest.fn(),
    repairMermaid: jest.fn(),
  },
}));

import { llmChatService } from './llm-chat-service';
import { StyleRecommendationService } from './style-recommendation';
import type { GraphInfo } from '../types';

const graphInfo: GraphInfo = {
  nodes: [
    { id: 'A', label: '输入', inDegree: 0, outDegree: 1, type: 'input' },
    { id: 'B', label: '编码器', inDegree: 1, outDegree: 1, type: 'process' },
    { id: 'C', label: '输出', inDegree: 1, outDegree: 0, type: 'output' },
  ],
  edges: [
    { id: 'e1', source: 'A', target: 'B' },
    { id: 'e2', source: 'B', target: 'C' },
  ],
  groups: [{ id: 'encoder', label: 'Encoder', memberIds: ['B'] }],
  depth: 3,
  avgDegree: 1.33,
  nodeCount: 3,
};

describe('StyleRecommendationService', () => {
  beforeEach(() => {
    (llmChatService.generateStyle as jest.MockedFunction<typeof llmChatService.generateStyle>).mockReset();
    (llmChatService.repairMermaid as jest.MockedFunction<typeof llmChatService.repairMermaid>).mockReset();
  });

  it('推荐默认样式时应该返回完整 Mermaid 和解析后的样式', async () => {
    (llmChatService.generateStyle as jest.MockedFunction<typeof llmChatService.generateStyle>)
      .mockResolvedValue(`flowchart LR
A[输入]:::input --> B[编码器]:::process --> C[输出]:::output
classDef input fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#ffffff
classDef process fill:#ffffff,stroke:#333333,stroke-width:1px,color:#333333
classDef output fill:#E94B35,stroke:#A33525,stroke-width:2px,color:#ffffff`);

    const service = new StyleRecommendationService();
    const result = await service.recommendDefault(
      graphInfo,
      'flowchart LR\nA[输入]:::input --> B[编码器]:::process --> C[输出]:::output',
      { usageScenario: 'paper', theme: 'academic' }
    );

    expect(llmChatService.generateStyle).toHaveBeenCalledWith(
      expect.stringContaining('学术风格')
    );
    expect(result.mermaidCode).toContain('flowchart LR');
    expect(result.styleSchemes.map((style) => style.nodeId)).toEqual(
      expect.arrayContaining(['input', 'process', 'output'])
    );
  });

  it('样式结果无效时应该抛出错误', async () => {
    (llmChatService.generateStyle as jest.MockedFunction<typeof llmChatService.generateStyle>)
      .mockResolvedValue('这是解释文字，不是 Mermaid 代码');
    (llmChatService.repairMermaid as jest.MockedFunction<typeof llmChatService.repairMermaid>)
      .mockResolvedValue('flowchart LR\nA -->');

    const service = new StyleRecommendationService();

    await expect(
      service.adjustStyle(graphInfo, 'flowchart LR\nA --> B', '把 A 改成蓝色')
    ).rejects.toThrow('未从样式优化结果中解析到 classDef 定义');
  });
});
