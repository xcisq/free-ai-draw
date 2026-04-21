import type {
  GenerationContext,
  MermaidRenderPreset,
  OneShotMermaidDraft,
  PromptAssistState,
  PromptAssistSuggestion,
  StructurePattern,
} from '../types';
import {
  getDiagramTypeLabel,
  getPreviewModeLabel,
  getPreviewModeForDiagramType,
  getStyleModeLabel,
  isFlowchartLikeDiagram,
  resolveDiagramTypeFromIntent,
} from '../utils/diagram-capabilities';

const DEFAULT_CONTEXT: GenerationContext = {
  layoutDirection: 'LR',
  diagramType: 'auto',
  usageScenario: 'paper',
  nodeCount: 5,
  theme: 'academic',
  layoutArea: 'medium',
  density: 'balanced',
  structurePattern: 'mixed',
  layoutIntentText: '',
  emphasisTargets: [],
  styleMode: 'auto',
  diagramStyle: 'publication',
  beautyLevel: 'balanced',
  layoutRhythm: 'airy',
  visualFocus: 'core',
  clarificationStatus: 'none',
};

export function createGenerationContext(
  incoming: Partial<GenerationContext> = {}
): GenerationContext {
  return {
    ...DEFAULT_CONTEXT,
    ...incoming,
    emphasisTargets: normalizeEmphasisTargets(incoming.emphasisTargets),
    layoutIntentText: incoming.layoutIntentText?.trim() || '',
  };
}

export function normalizeSourceText(sourceText: string) {
  return sourceText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && index < lines.length - 1))
    .join('\n')
    .trim();
}

export function createPromptAssistState(
  sourceText: string,
  incomingContext: Partial<GenerationContext> = {}
): PromptAssistState {
  const context = createGenerationContext(incomingContext);
  const normalizedSourceText = normalizeSourceText(sourceText);
  const warnings: string[] = [];
  const suggestions: PromptAssistSuggestion[] = [];
  const estimatedNodeCount = estimateNodeCountFromText(normalizedSourceText, context);
  const longestSegment = getLongestSegment(normalizedSourceText);
  const hasStructureSignals = detectStructureSignals(normalizedSourceText);
  const resolvedDiagramType = resolveDiagramTypeFromIntent(normalizedSourceText, context.diagramType);
  const previewMode = getPreviewModeForDiagramType(resolvedDiagramType);

  if (!normalizedSourceText) {
    return {
      isReady: false,
      summaryTitle: '先贴原始文本，再把 one-shot 机会交给模型',
      summaryLines: [
        '建议直接粘贴论文方法描述、模块说明或流程草稿。',
        '系统会在本地帮你整理图类型、结构和图面配方，但不会提前调用模型。',
      ],
      warnings: [],
      suggestions: [
        {
          id: 'starter-structure',
          label: '补一句结构走向',
          detail: '整体从左到右，中间两路并行，最后汇聚到评估模块。',
          action: 'append-source',
          value: '整体从左到右，中间两路并行，最后汇聚到评估模块。',
        },
      ],
      estimatedNodeCount: DEFAULT_CONTEXT.nodeCount,
    };
  }

  if (normalizedSourceText.length > 720) {
    warnings.push('原始文本偏长，建议只保留输入、核心模块、输出和关系。');
    suggestions.push({
      id: 'trim-text',
      label: '压缩原文',
      detail: '补一句“请只保留输入、核心模块、输出和关系”。',
      action: 'append-source',
      value: '请只保留输入、核心模块、输出和关系。',
    });
  }

  if (!hasStructureSignals) {
    warnings.push('当前结构信号偏弱，模型可能会把图画成普通线性链路。');
    suggestions.push({
      id: 'add-structure-signal',
      label: '补一句结构走向',
      detail: '直接告诉模型主阅读方向和局部结构。',
      action: 'append-source',
      value: '整体从左到右，中间两路并行，最后汇聚到评估模块。',
    });
  }

  if (context.beautyLevel === 'enhanced' && !hasStructureSignals) {
    warnings.push('想要更强的版式感时，最好补一句并行、汇聚或反馈等局部结构。');
  }

  if (longestSegment > 22) {
    warnings.push('可能存在过长节点名，建议先把模块命名压缩到 4 到 10 个字。');
    suggestions.push({
      id: 'compress-label',
      label: '提醒压缩节点名',
      detail: '补一句“节点命名尽量压缩为 4 到 10 个字”。',
      action: 'append-source',
      value: '节点命名尽量压缩为 4 到 10 个字。',
    });
  }

  if ((context.emphasisTargets || []).length === 0) {
    suggestions.push({
      id: 'set-emphasis',
      label: '加一个重点模块',
      detail: '把“核心方法”设为默认重点，避免图面没有视觉锚点。',
      action: 'set-emphasis-targets',
      value: ['核心方法'],
    });
  }

  const summaryLines = [
    `场景固定为${getScenarioText(context.usageScenario)}，预估图类型是${getDiagramTypeLabel(
      resolvedDiagramType
    )}，预览方式为${getPreviewModeLabel(previewMode)}。`,
    `整体阅读方向${getLayoutDirectionText(context.layoutDirection)}，结构骨架偏向${getStructurePatternText(
      context.structurePattern
    )}，图面密度${getDensityText(context.density)}，预计节点约 ${estimatedNodeCount} 个。`,
    `样式模式${getStyleModeLabel(context.styleMode)}，图形风格${getDiagramStyleText(
      context.diagramStyle
    )}，美观度${getBeautyLevelText(context.beautyLevel)}，版式节奏${getLayoutRhythmText(
      context.layoutRhythm
    )}。`,
    (context.emphasisTargets || []).length > 0
      ? `视觉重点放在${getVisualFocusText(context.visualFocus)}，重点模块：${(
          context.emphasisTargets || []
        ).join('、')}。`
      : `视觉重点放在${getVisualFocusText(
          context.visualFocus
        )}，当前未指定重点模块，模型会优先保持主干清晰、锚点明确。`,
  ];

  return {
    isReady: true,
    summaryTitle: '这次 one-shot 会把这些信息交给模型',
    summaryLines,
    warnings,
    suggestions: dedupeSuggestions(suggestions),
    estimatedNodeCount,
  };
}

export function createOneShotDraft(
  sourceText: string,
  incomingContext: Partial<GenerationContext> = {}
): OneShotMermaidDraft {
  const context = createGenerationContext(incomingContext);
  const normalizedSourceText = normalizeSourceText(sourceText);
  const assist = createPromptAssistState(normalizedSourceText, context);

  return {
    sourceText,
    normalizedSourceText,
    context: {
      ...context,
      nodeCount: assist.estimatedNodeCount,
    },
    summaryLines: assist.summaryLines,
  };
}

export function deriveRenderPreset(
  sourceText: string,
  incomingContext: Partial<GenerationContext> = {}
): MermaidRenderPreset {
  const context = createGenerationContext(incomingContext);
  const normalizedSourceText = normalizeSourceText(sourceText);
  const denseText = normalizedSourceText.length > 520;
  const diagramType = resolveDiagramTypeFromIntent(normalizedSourceText, context.diagramType);

  const fontSize = `${deriveFontSizeValue(context, denseText)}px`;
  const curve = deriveCurve(context, diagramType);

  return {
    diagramType,
    previewMode: getPreviewModeForDiagramType(diagramType),
    curve,
    fontSize,
  };
}

export function buildPreviewMermaidConfig(preset: MermaidRenderPreset) {
  return {
    startOnLoad: false,
    flowchart: isFlowchartLikeDiagram(preset.diagramType)
      ? {
          curve: preset.curve,
        }
      : undefined,
    themeVariables: {
      fontSize: preset.fontSize,
    },
  };
}

export function applyPromptAssistSuggestion(
  sourceText: string,
  context: GenerationContext,
  suggestion: PromptAssistSuggestion
) {
  const nextSourceText = normalizeSourceText(sourceText);

  switch (suggestion.action) {
    case 'append-source': {
      const patch = String(suggestion.value).trim();
      if (!patch || nextSourceText.includes(patch)) {
        return {
          sourceText,
          context,
        };
      }

      return {
        sourceText: `${nextSourceText}${nextSourceText ? '\n' : ''}${patch}`.trim(),
        context,
      };
    }
    case 'set-structure-pattern':
      return {
        sourceText,
        context: {
          ...context,
          structurePattern: suggestion.value as StructurePattern,
        },
      };
    case 'set-layout-direction':
      return {
        sourceText,
        context: {
          ...context,
          layoutDirection: suggestion.value as GenerationContext['layoutDirection'],
        },
      };
    case 'set-emphasis-targets':
      return {
        sourceText,
        context: {
          ...context,
          emphasisTargets: normalizeEmphasisTargets(suggestion.value as string[]),
        },
      };
    default:
      return {
        sourceText,
        context,
      };
  }
}

function estimateNodeCountFromText(
  sourceText: string,
  context: GenerationContext
) {
  if (!sourceText.trim()) {
    return context.nodeCount;
  }

  const lineCount = sourceText.split('\n').filter(Boolean).length;
  const sentenceCount = sourceText.split(/[。！？!?\n]/).filter(Boolean).length;
  const keywordHits =
    sourceText.match(
      /首先|然后|接着|最后|输入|输出|模块|阶段|步骤|训练|推理|评估|编码|解码|检测|分类|融合|预测|反馈/g
    )?.length || 0;

  const estimated = Math.round(lineCount * 0.9 + sentenceCount * 0.8 + keywordHits * 0.35);
  return Math.max(3, Math.min(12, estimated || context.nodeCount));
}

function detectStructureSignals(sourceText: string) {
  if (!sourceText.trim()) {
    return false;
  }

  return /从左到右|从上到下|并行|汇聚|分支|辅轨|反馈|闭环|输入|输出|首先|然后|最后|parallel|merge|feedback/i.test(
    sourceText
  );
}

function getLongestSegment(sourceText: string) {
  return sourceText
    .split(/[，,。；;：:\n]/)
    .map((segment) => segment.trim().length)
    .sort((left, right) => right - left)[0] || 0;
}

function getScenarioText(scenario: GenerationContext['usageScenario']) {
  switch (scenario) {
    case 'presentation':
      return '演示文稿';
    case 'document':
      return '技术文档';
    case 'paper':
    default:
      return '论文插图';
  }
}

function getLayoutDirectionText(direction: GenerationContext['layoutDirection']) {
  return direction === 'TB' ? '从上到下' : '从左到右';
}

function getStructurePatternText(pattern: GenerationContext['structurePattern']) {
  switch (pattern) {
    case 'linear':
      return '线性主干';
    case 'branched':
      return '主干带分支';
    case 'convergent':
      return '并行后汇聚';
    case 'multi-lane':
      return '上下辅轨';
    case 'feedback':
      return '反馈回路';
    case 'mixed':
    default:
      return '混合结构';
  }
}

function getDensityText(density: GenerationContext['density']) {
  switch (density) {
    case 'dense':
      return '偏紧凑';
    case 'sparse':
      return '偏疏朗';
    case 'balanced':
    default:
      return '平衡';
  }
}

function getDiagramStyleText(style: GenerationContext['diagramStyle']) {
  switch (style) {
    case 'architecture':
      return '系统架构';
    case 'explainer':
      return '讲解流程';
    case 'publication':
    default:
      return '论文刊物';
  }
}

function getBeautyLevelText(level: GenerationContext['beautyLevel']) {
  switch (level) {
    case 'conservative':
      return '保守';
    case 'enhanced':
      return '强化';
    case 'balanced':
    default:
      return '平衡';
  }
}

function getLayoutRhythmText(rhythm: GenerationContext['layoutRhythm']) {
  switch (rhythm) {
    case 'compact':
      return '紧凑';
    case 'symmetrical':
      return '对称';
    case 'airy':
    default:
      return '舒展';
  }
}

function getVisualFocusText(focus: GenerationContext['visualFocus']) {
  switch (focus) {
    case 'input':
      return '输入端';
    case 'output':
      return '输出端';
    case 'convergence':
      return '汇聚点';
    case 'core':
    default:
      return '核心方法';
  }
}

function deriveFontSizeValue(context: GenerationContext, denseText: boolean) {
  let fontSize =
    context.density === 'dense'
      ? 16
      : context.density === 'sparse'
      ? 20
      : denseText
      ? 17
      : 18;

  if (context.layoutRhythm === 'compact' && context.density !== 'sparse') {
    fontSize -= 1;
  }

  if (context.layoutRhythm === 'airy' && context.density !== 'dense') {
    fontSize += 1;
  }

  if (context.diagramStyle === 'publication' && context.beautyLevel === 'enhanced') {
    fontSize -= 1;
  }

  if (context.beautyLevel === 'conservative' && fontSize < 17) {
    fontSize += 1;
  }

  return clamp(fontSize, 15, 21);
}

function deriveCurve(
  context: GenerationContext,
  diagramType: MermaidRenderPreset['diagramType']
): MermaidRenderPreset['curve'] {
  if (!isFlowchartLikeDiagram(diagramType)) {
    return 'linear';
  }

  if (context.structurePattern === 'feedback') {
    return 'basis';
  }

  if (context.structurePattern === 'multi-lane' && context.layoutRhythm !== 'compact') {
    return 'basis';
  }

  if (context.diagramStyle === 'explainer' && context.beautyLevel !== 'conservative') {
    return 'basis';
  }

  if (
    context.beautyLevel === 'enhanced' &&
    context.layoutRhythm === 'airy' &&
    (context.structurePattern === 'branched' || context.structurePattern === 'convergent')
  ) {
    return 'basis';
  }

  return 'linear';
}

function normalizeEmphasisTargets(targets: string[] | undefined) {
  return Array.from(new Set((targets || []).map((target) => target.trim()).filter(Boolean))).slice(
    0,
    3
  );
}

function dedupeSuggestions(suggestions: PromptAssistSuggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    if (seen.has(suggestion.id)) {
      return false;
    }
    seen.add(suggestion.id);
    return true;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
