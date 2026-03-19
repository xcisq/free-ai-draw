/**
 * PromptTemplates 服务单元测试
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildMermaidIntentPlanningPrompt,
  buildMermaidUserPrompt,
  extractJsonBlock,
  getInitialPrompt,
  getBoardStyleMultipleSchemesPrompt,
  getMermaidGenerationPrompt,
  getDefaultStyleRecommendationPrompt,
  getStyleOptimizationPrompt,
  extractMermaidCode,
  validateMermaidCode,
  getStyleAdjustmentPrompt,
  getMermaidRepairPrompt,
} from './prompt-templates';
import type { GenerationContext, GraphInfo } from '../types';

describe('PromptTemplates', () => {
  describe('getInitialPrompt', () => {
    it('应该返回非空的系统提示词', () => {
      const prompt = getInitialPrompt();
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toContain('Mermaid');
      expect(prompt).toContain('原始文本');
      expect(prompt).toContain('第一行必须是 flowchart LR 或 flowchart TB');
      expect(prompt).toContain('不要输出 markdown 代码块标记');
    });
  });

  describe('getMermaidGenerationPrompt', () => {
    it('应该根据上下文生成提示词', () => {
      const context: GenerationContext = {
        layoutDirection: 'LR',
        usageScenario: 'paper',
        nodeCount: 5,
        theme: 'academic',
        layoutArea: 'medium',
        density: 'balanced',
        structurePattern: 'branched',
        layoutIntentText: '整体从左到右，但局部两路并行后汇聚',
        emphasisTargets: ['评估阶段'],
        clarificationStatus: 'resolved',
      };

      const prompt = getMermaidGenerationPrompt(context);
      expect(prompt).toContain('整体从左到右');
      expect(prompt).toContain('学术论文插图');
      expect(prompt).toContain('约 5 个');
      expect(prompt).toContain('学术风格');
      expect(prompt).toContain('局部存在并行');
      expect(prompt).toContain('两路并行后汇聚');
      expect(prompt).toContain('评估阶段');
      expect(prompt).toContain('第一行必须直接输出 flowchart LR');
      expect(prompt).toContain('不要输出 markdown 代码块');
    });

    it('应该处理 TB 布局方向', () => {
      const context: GenerationContext = {
        layoutDirection: 'TB',
        usageScenario: 'presentation',
        nodeCount: 3,
        theme: 'professional',
        structurePattern: 'mixed',
        emphasisTargets: [],
        clarificationStatus: 'none',
      };

      const prompt = getMermaidGenerationPrompt(context);
      expect(prompt).toContain('整体从上到下');
    });
  });

  describe('getStyleOptimizationPrompt', () => {
    it('应该生成样式优化提示词', () => {
      const graphInfo: GraphInfo = {
        nodes: [
          { id: '1', label: 'Node 1', inDegree: 0, outDegree: 1, type: 'input' },
          { id: '2', label: 'Node 2', inDegree: 1, outDegree: 1, type: 'process' },
          { id: '3', label: 'Node 3', inDegree: 1, outDegree: 0, type: 'output' },
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' },
        ],
        groups: [],
        depth: 2,
        avgDegree: 1.33,
        nodeCount: 3,
      };

      const prompt = getStyleOptimizationPrompt(graphInfo, '输入节点用蓝色，输出节点用红色');
      expect(prompt).toContain('3');
      expect(prompt).toContain('2');
      expect(prompt).toContain('输入节点用蓝色，输出节点用红色');
      expect(prompt).toContain('classDef');
    });
  });

  describe('getDefaultStyleRecommendationPrompt', () => {
    it('应该生成完整 Mermaid 样式推荐提示词', () => {
      const graphInfo: GraphInfo = {
        nodes: [
          { id: 'A', label: 'Input', inDegree: 0, outDegree: 1, type: 'input' },
          { id: 'B', label: 'Encoder', inDegree: 1, outDegree: 1, type: 'process' },
        ],
        edges: [{ id: 'e1', source: 'A', target: 'B' }],
        groups: [{ id: 'g1', label: 'Encoder', memberIds: ['B'] }],
        depth: 2,
        avgDegree: 1,
        nodeCount: 2,
      };

      const prompt = getDefaultStyleRecommendationPrompt(
        'flowchart LR\nA[Input] --> B[Encoder]',
        graphInfo,
        {
          usageScenario: 'paper',
          theme: 'academic',
        }
      );

      expect(prompt).toContain('学术论文插图');
      expect(prompt).toContain('学术风格');
      expect(prompt).toContain('完整 Mermaid 代码');
      expect(prompt).toContain('flowchart LR');
    });
  });

  describe('extractMermaidCode', () => {
    it('应该从 markdown 代码块中提取 Mermaid 代码', () => {
      const text = '```mermaid\nflowchart LR\nA --> B\n```';
      const code = extractMermaidCode(text);
      expect(code).toBe('flowchart LR\nA --> B');
    });

    it('应该从无语言标记的代码块中提取代码', () => {
      const text = '```\nflowchart LR\nA --> B\n```';
      const code = extractMermaidCode(text);
      expect(code).toBe('flowchart LR\nA --> B');
    });

    it('应该从纯文本中提取 Mermaid 代码', () => {
      const text = '这是我的图：\nflowchart LR\nA --> B\n结束';
      const code = extractMermaidCode(text);
      expect(code).toBe('flowchart LR\nA --> B');
    });

    it('应该忽略 Mermaid 代码后的说明文字', () => {
      const text = 'flowchart LR\nA[开始] --> B[结束]\n说明：这是一个简单流程图';
      const code = extractMermaidCode(text);
      expect(code).toBe('flowchart LR\nA[开始] --> B[结束]');
    });

    it('应该忽略 Mermaid 前面的说明文字，并提取主体代码', () => {
      const text = '这是 Mermaid 代码：\nA[开始] --> B[结束]\nB --> C[评估]';
      const code = extractMermaidCode(text);
      expect(code).toBe('A[开始] --> B[结束]\nB --> C[评估]');
    });

    it('没有 Mermaid 主体时应该返回空字符串', () => {
      const code = extractMermaidCode('这是模型的解释文字，但没有任何图代码。');
      expect(code).toBe('');
    });
  });

  describe('getBoardStyleMultipleSchemesPrompt', () => {
    it('应该生成 JSON 方案提示词', () => {
      const prompt = getBoardStyleMultipleSchemesPrompt(
        {
          total: 6,
          originalTotal: 4,
          shapeCount: 4,
          lineCount: 2,
          textCount: 0,
          relatedLineCount: 2,
          includeConnectedLines: true,
          fills: ['#ffffff'],
          strokes: ['#333333'],
          fontSizes: [14, 16],
          semanticNodeCounts: { input: 1, process: 2, output: 1, module: 1 },
          lineRoleCounts: { main: 1, secondary: 1 },
          textRoleCounts: { title: 1, body: 3 },
          groupedShapeCount: 3,
          ungroupedShapeCount: 1,
          moduleCount: 1,
          branchingNodeCount: 1,
          mergeNodeCount: 1,
          layoutBias: 'horizontal',
          roleLabelExamples: {
            input: ['输入图像'],
            process: ['特征提取', '分类器'],
            output: ['预测结果'],
            module: ['编码模块'],
          },
        },
        '更专业一点',
        3
      );

      expect(prompt).toContain('严格输出 JSON');
      expect(prompt).toContain('原始选中数：4');
      expect(prompt).toContain('实际优化数：6');
      expect(prompt).toContain('自动补入关联线：2');
      expect(prompt).toContain('更专业一点');
      expect(prompt).toContain('"schemes"');
      expect(prompt).toContain('lineShape');
      expect(prompt).toContain('straight / elbow');
      expect(prompt).toContain('不要使用 curve');
      expect(prompt).toContain('node.input');
      expect(prompt).toContain('node.module');
      expect(prompt).toContain('node.grouped');
      expect(prompt).toContain('line.main');
      expect(prompt).toContain('text.title');
      expect(prompt).toContain('不要把所有矩形节点设成同一种填充色');
      expect(prompt).toContain('同一模块内元素一个相近的基础色家族');
      expect(prompt).toContain('模块内相似、模块间可分、全图统一');
      expect(prompt).toContain('muted palette');
    });
  });

  describe('extractJsonBlock', () => {
    it('应该从 json 代码块中提取 JSON', () => {
      const json = extractJsonBlock('```json\n{"schemes":[]}\n```');
      expect(json).toBe('{"schemes":[]}');
    });

    it('应该从纯文本中提取对象内容', () => {
      const json = extractJsonBlock('说明文字 {"schemes":[{"id":"1"}]}');
      expect(json).toBe('{"schemes":[{"id":"1"}]}');
    });
  });

  describe('buildMermaidUserPrompt', () => {
    it('应该把结构化上下文和用户需求拼成完整请求', () => {
      const prompt = buildMermaidUserPrompt('突出评估阶段', {
        layoutDirection: 'TB',
        usageScenario: 'presentation',
        theme: 'professional',
        nodeCount: 6,
        structurePattern: 'convergent',
        clarificationStatus: 'resolved',
      });

      expect(prompt).toContain('整体从上到下');
      expect(prompt).toContain('演示文稿');
      expect(prompt).toContain('突出评估阶段');
      expect(prompt).toContain('用户原始文本');
      expect(prompt).toContain('<<<USER_TEXT');
      expect(prompt).toContain('请基于上面的用户原始文本生成对应图表');
      expect(prompt).toContain('不要输出任何额外解释');
      expect(prompt).toContain('第一行必须直接是 flowchart TB');
    });

    it('应该明确要求模型基于用户文本抽取流程关系', () => {
      const prompt = buildMermaidUserPrompt('本文方法首先进行特征提取，然后做分类预测。');

      expect(prompt).toContain('抽取流程阶段、模块、输入输出和依赖关系');
      expect(prompt).toContain('不要脱离这段文本另起一套通用流程图');
    });

    it('细化当前 Mermaid 时应包含增量调整语义', () => {
      const prompt = buildMermaidUserPrompt(
        '把评估支路放到下方并在末端汇聚',
        {
          layoutDirection: 'LR',
          structurePattern: 'mixed',
          clarificationStatus: 'resolved',
        },
        {
          requestKind: 'refine',
          currentMermaid: 'flowchart LR\nA --> B\nB --> C',
        }
      );

      expect(prompt).toContain('当前已有 Mermaid');
      expect(prompt).toContain('增量细化');
      expect(prompt).toContain('flowchart LR');
    });
  });

  describe('buildMermaidIntentPlanningPrompt', () => {
    it('应该明确要求先输出 JSON 而不是 Mermaid', () => {
      const prompt = buildMermaidIntentPlanningPrompt({
        userInput: '整体从左到右，但中间两路并行，最后汇聚到评估模块',
        currentContext: {
          layoutDirection: 'LR',
          structurePattern: 'mixed',
        },
        requestKind: 'generate',
      });

      expect(prompt).toContain('不要直接输出 Mermaid');
      expect(prompt).toContain('严格输出 JSON');
      expect(prompt).toContain('最新用户输入');
      expect(prompt).toContain('两路并行');
    });
  });

  describe('validateMermaidCode', () => {
    it('应该验证有效的 Mermaid 代码', () => {
      const validCode = 'flowchart LR\nA --> B\nB --> C';
      const result = validateMermaidCode(validCode);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('应该检测空的代码', () => {
      const emptyCode = '';
      const result = validateMermaidCode(emptyCode);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Mermaid 代码为空');
    });

    it('应该检测缺少类型声明', () => {
      const invalidCode = 'A --> B\nB --> C';
      const result = validateMermaidCode(invalidCode);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('类型声明'))).toBe(true);
    });

    it('应该检测括号不匹配', () => {
      const invalidCode = 'flowchart LR\nA --> B\n[B --> C';
      const result = validateMermaidCode(invalidCode);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('方括号不匹配');
    });

    it('应该检测未完整的连接语句', () => {
      const invalidCode = 'flowchart LR\nA -->';
      const result = validateMermaidCode(invalidCode);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('存在未完整的连接语句');
    });
  });

  describe('getStyleAdjustmentPrompt', () => {
    it('应该生成样式调整提示词', () => {
      const currentMermaid = 'flowchart LR\nA --> B\nB --> C';
      const prompt = getStyleAdjustmentPrompt(currentMermaid, '把 A 节点改成蓝色');
      expect(prompt).toContain(currentMermaid);
      expect(prompt).toContain('把 A 节点改成蓝色');
    });

    it('应该携带图表信息并要求返回完整 Mermaid 代码', () => {
      const prompt = getStyleAdjustmentPrompt(
        'flowchart LR\nA --> B',
        '给 Encoder 模块加个虚线边框',
        {
          nodes: [
            { id: 'A', label: 'Input', inDegree: 0, outDegree: 1, type: 'input' },
            { id: 'B', label: 'Encoder', inDegree: 1, outDegree: 0, type: 'process' },
          ],
          edges: [{ id: 'e1', source: 'A', target: 'B' }],
          groups: [{ id: 'g1', label: 'Encoder', memberIds: ['B'] }],
          depth: 2,
          avgDegree: 1,
          nodeCount: 2,
        }
      );

      expect(prompt).toContain('图表信息');
      expect(prompt).toContain('stroke-dasharray');
      expect(prompt).toContain('完整 Mermaid 代码');
    });
  });

  describe('getMermaidRepairPrompt', () => {
    it('应该要求只返回修复后的 Mermaid 代码', () => {
      const prompt = getMermaidRepairPrompt({
        brokenMermaid: 'A[开始] --> B[结束',
        errors: ['缺少 Mermaid 类型声明', '方括号不匹配'],
        originalRequest: '生成一个简单流程图',
      });

      expect(prompt).toContain('生成一个简单流程图');
      expect(prompt).toContain('缺少 Mermaid 类型声明');
      expect(prompt).toContain('方括号不匹配');
      expect(prompt).toContain('只输出完整 Mermaid 代码');
    });
  });
});
