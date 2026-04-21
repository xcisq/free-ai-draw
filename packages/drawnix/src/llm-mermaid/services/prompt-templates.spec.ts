/**
 * PromptTemplates 服务单元测试
 */

import { describe, expect, it } from '@jest/globals';
import {
  buildMermaidIntentPlanningPrompt,
  buildMermaidUserPrompt,
  extractJsonBlock,
  extractMermaidCode,
  getInitialPrompt,
  getMermaidGenerationPrompt,
  getMermaidRepairPrompt,
  validateMermaidCode,
} from './prompt-templates';
import type { GenerationContext } from '../types';

describe('PromptTemplates', () => {
  describe('getInitialPrompt', () => {
    it('应该返回支持多图类型与样式化输出的系统提示词', () => {
      const prompt = getInitialPrompt();

      expect(prompt).toContain('Mermaid');
      expect(prompt).toContain('原始文本');
      expect(prompt).toContain('one-shot');
      expect(prompt).toContain('classDef');
      expect(prompt).toContain('图类型声明');
      expect(prompt).toContain('Mermaid 官方解析器');
      expect(prompt).toContain('输出前请自行检查');
      expect(prompt).toContain('不要输出 markdown 代码块标记');
    });
  });

  describe('getMermaidGenerationPrompt', () => {
    it('应该根据上下文生成包含图类型与样式模式的提示词', () => {
      const context: GenerationContext = {
        layoutDirection: 'LR',
        diagramType: 'flowchart',
        usageScenario: 'paper',
        nodeCount: 5,
        theme: 'academic',
        layoutArea: 'medium',
        density: 'balanced',
        structurePattern: 'branched',
        layoutIntentText: '整体从左到右，但局部两路并行后汇聚',
        emphasisTargets: ['评估阶段'],
        styleMode: 'semantic',
        diagramStyle: 'publication',
        beautyLevel: 'enhanced',
        layoutRhythm: 'symmetrical',
        visualFocus: 'convergence',
        clarificationStatus: 'resolved',
      };

      const prompt = getMermaidGenerationPrompt(context);
      expect(prompt).toContain('图类型：流程图 / Flowchart');
      expect(prompt).toContain('图类型指令：优先生成 flowchart 类型');
      expect(prompt).toContain('整体从左到右');
      expect(prompt).toContain('学术论文插图');
      expect(prompt).toContain('约 5 个');
      expect(prompt).toContain('语义配色');
      expect(prompt).toContain('图形风格：论文刊物');
      expect(prompt).toContain('美观度：强化');
      expect(prompt).toContain('版式节奏：对称');
      expect(prompt).toContain('视觉重点：汇聚点');
      expect(prompt).toContain('构图配方');
      expect(prompt).toContain('classDef、class、style、linkStyle、subgraph、direction');
      expect(prompt).toContain('最小自检');
      expect(prompt).toContain('宁可减少样式');
      expect(prompt).not.toContain('第一行必须直接输出 flowchart LR');
    });

    it('应该处理非 flowchart 图类型', () => {
      const context: GenerationContext = {
        layoutDirection: 'TB',
        diagramType: 'sequenceDiagram',
        usageScenario: 'presentation',
        nodeCount: 3,
        theme: 'professional',
        structurePattern: 'mixed',
        emphasisTargets: [],
        styleMode: 'showcase',
        clarificationStatus: 'none',
      };

      const prompt = getMermaidGenerationPrompt(context);
      expect(prompt).toContain('图类型：时序图 / Sequence');
      expect(prompt).toContain('sequenceDiagram');
      expect(prompt).toContain('整体从上到下');
      expect(prompt).toContain('展示增强');
    });
  });

  describe('extractMermaidCode', () => {
    it('应该从 markdown 代码块中提取 Mermaid 代码', () => {
      const text = '```mermaid\nflowchart LR\nA --> B\n```';
      const code = extractMermaidCode(text);
      expect(code).toBe('flowchart LR\nA --> B');
    });

    it('应该保留 init 指令并提取主体代码', () => {
      const text =
        '说明文字\n```mermaid\n%%{init: {"theme":"base"}}%%\nflowchart TB\nA --> B\n```';
      const code = extractMermaidCode(text);
      expect(code).toBe('%%{init: {"theme":"base"}}%%\nflowchart TB\nA --> B');
    });

    it('应该从纯文本中提取 Mermaid 代码并忽略尾部说明', () => {
      const text = '这是我的图：\nflowchart LR\nA --> B\n结束';
      const code = extractMermaidCode(text);
      expect(code).toBe('flowchart LR\nA --> B');
    });

    it('应该支持提取样式化 flowchart', () => {
      const text = `flowchart TB
classDef problem fill:#FFE8E8,stroke:#D9534F;
A["问题"]:::problem
subgraph Z1["研究背景"]
  A
end`;
      const code = extractMermaidCode(text);
      expect(code).toContain('classDef problem');
      expect(code).toContain('subgraph Z1');
    });

    it('应该支持提取其他图类型', () => {
      const text = '请参考：\nsequenceDiagram\nparticipant A\nA->>B: hello\n解释文字';
      const code = extractMermaidCode(text);
      expect(code).toBe('sequenceDiagram\nparticipant A\nA->>B: hello');
    });

    it('没有 Mermaid 主体时应该返回空字符串', () => {
      const code = extractMermaidCode('这是模型的解释文字，但没有任何图代码。');
      expect(code).toBe('');
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
        diagramType: 'flowchart',
        usageScenario: 'presentation',
        theme: 'professional',
        nodeCount: 6,
        structurePattern: 'convergent',
        styleMode: 'semantic',
        diagramStyle: 'explainer',
        beautyLevel: 'balanced',
        layoutRhythm: 'airy',
        visualFocus: 'core',
        clarificationStatus: 'resolved',
      });

      expect(prompt).toContain('整体从上到下');
      expect(prompt).toContain('演示文稿');
      expect(prompt).toContain('突出评估阶段');
      expect(prompt).toContain('图类型：流程图 / Flowchart');
      expect(prompt).toContain('样式模式：语义配色');
      expect(prompt).toContain('图形风格：讲解流程');
      expect(prompt).toContain('用户原始文本');
      expect(prompt).toContain('<<<USER_TEXT');
      expect(prompt).toContain('请基于上面的用户原始文本生成对应图表');
      expect(prompt).toContain('这是一次 one-shot 请求');
      expect(prompt).toContain('输出前请自行检查这份 Mermaid 是否能直接成功预览');
      expect(prompt).toContain('宁可少一个辅节点');
      expect(prompt).not.toContain('第一行必须直接是 flowchart TB');
    });

    it('应该明确要求模型吸收用户显式声明的图类型和样式', () => {
      const prompt = buildMermaidUserPrompt(
        '请生成一个 sequenceDiagram，要求使用语义配色与展示增强，参与者是用户和系统。'
      );

      expect(prompt).toContain('如果用户明确写了图类型、样式词或样例语法，请优先吸收进最终 Mermaid');
      expect(prompt).toContain('根据原文推断的首选图类型：时序图 / Sequence');
      expect(prompt).toContain('不要机械默认成 flowchart');
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
      expect(prompt).toContain('"diagramType"');
      expect(prompt).toContain('"styleMode"');
    });
  });

  describe('validateMermaidCode', () => {
    it('应该验证有效的 flowchart 代码', () => {
      const validCode = 'flowchart LR\nA --> B\nB --> C';
      const result = validateMermaidCode(validCode);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('应该验证有效的 sequenceDiagram 代码', () => {
      const validCode = 'sequenceDiagram\nparticipant A\nA->>B: hello';
      const result = validateMermaidCode(validCode);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该允许带 classDef 和 subgraph 的样式化 flowchart', () => {
      const validCode = `flowchart TB
classDef problem fill:#FFE8E8,stroke:#D9534F;
A["问题"]:::problem
subgraph Z1["研究背景"]
  A --> B["需求"]
end`;
      const result = validateMermaidCode(validCode);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
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
      expect(result.errors.some((error) => error.includes('类型声明'))).toBe(true);
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
