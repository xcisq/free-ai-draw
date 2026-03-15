/**
 * PromptTemplates 服务单元测试
 */

import { describe, it, expect } from '@jest/globals';
import {
  getInitialPrompt,
  getMermaidGenerationPrompt,
  getStyleOptimizationPrompt,
  extractMermaidCode,
  validateMermaidCode,
  getStyleAdjustmentPrompt,
} from './prompt-templates';
import type { GenerationContext, GraphInfo } from '../types';

describe('PromptTemplates', () => {
  describe('getInitialPrompt', () => {
    it('应该返回非空的系统提示词', () => {
      const prompt = getInitialPrompt();
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toContain('Mermaid');
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
      };

      const prompt = getMermaidGenerationPrompt(context);
      expect(prompt).toContain('从左到右');
      expect(prompt).toContain('学术论文插图');
      expect(prompt).toContain('约 5 个');
      expect(prompt).toContain('学术风格');
    });

    it('应该处理 TB 布局方向', () => {
      const context: GenerationContext = {
        layoutDirection: 'TB',
        usageScenario: 'presentation',
        nodeCount: 3,
        theme: 'professional',
      };

      const prompt = getMermaidGenerationPrompt(context);
      expect(prompt).toContain('从上到下');
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
      expect(code).toContain('flowchart LR');
      expect(code).toContain('A --> B');
    });
  });

  describe('validateMermaidCode', () => {
    it('应该验证有效的 Mermaid 代码', () => {
      const validCode = 'flowchart LR\nA --> B\nB --> C';
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
      expect(result.errors.some(e => e.includes('类型声明'))).toBe(true);
    });

    it('应该检测括号不匹配', () => {
      const invalidCode = 'flowchart LR\nA --> B\n[B --> C';
      const result = validateMermaidCode(invalidCode);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('方括号不匹配');
    });
  });

  describe('getStyleAdjustmentPrompt', () => {
    it('应该生成样式调整提示词', () => {
      const currentMermaid = 'flowchart LR\nA --> B\nB --> C';
      const prompt = getStyleAdjustmentPrompt(currentMermaid, '把 A 节点改成蓝色');
      expect(prompt).toContain(currentMermaid);
      expect(prompt).toContain('把 A 节点改成蓝色');
    });
  });
});
