import { describe, expect, it } from '@jest/globals';

import {
  applyPromptAssistSuggestion,
  buildPreviewMermaidConfig,
  createOneShotDraft,
  createPromptAssistState,
  deriveRenderPreset,
} from './one-shot-assist';

describe('one-shot-assist', () => {
  it('会为结构信号不足的文本生成本地提示与建议', () => {
    const assist = createPromptAssistState('这是一个用于论文的方法描述。');

    expect(assist.isReady).toBe(true);
    expect(assist.warnings.some((warning) => warning.includes('结构信号偏弱'))).toBe(true);
    expect(assist.suggestions.some((suggestion) => suggestion.id === 'add-structure-signal')).toBe(
      true
    );
  });

  it('会把当前上下文整理成提交前摘要', () => {
    const draft = createOneShotDraft('输入图像后进行编码，然后做分类预测。', {
      layoutDirection: 'TB',
      structurePattern: 'branched',
      emphasisTargets: ['分类预测'],
    });

    expect(draft.summaryLines[0]).toContain('从上到下');
    expect(draft.summaryLines[1]).toContain('主干带分支');
    expect(draft.summaryLines[2]).toContain('分类预测');
  });

  it('会根据结构复杂度给出稳妥的预览渲染参数', () => {
    const preset = deriveRenderPreset('包含反馈回路的训练过程。', {
      structurePattern: 'feedback',
      density: 'dense',
    });

    expect(preset.curve).toBe('basis');
    expect(preset.fontSize).toBe('16px');
    expect(buildPreviewMermaidConfig(preset)).toEqual({
      startOnLoad: false,
      flowchart: {
        curve: 'basis',
      },
      themeVariables: {
        fontSize: '16px',
      },
    });
  });

  it('点击建议后可以把补充结构语句追加回原文', () => {
    const assist = createPromptAssistState('编码后进行预测。');
    const suggestion = assist.suggestions.find((item) => item.action === 'append-source');

    expect(suggestion).toBeTruthy();

    const applied = applyPromptAssistSuggestion(
      '编码后进行预测。',
      {
        layoutDirection: 'LR',
        usageScenario: 'paper',
        nodeCount: 5,
        theme: 'academic',
      },
      suggestion!
    );

    expect(applied.sourceText).toContain('整体从左到右');
  });
});
