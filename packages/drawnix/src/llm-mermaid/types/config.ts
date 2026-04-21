/**
 * 配置相关类型定义
 */

/**
 * LLM 配置
 */
export interface LLMConfig {
  /** API 密钥 */
  apiKey: string;
  /** API 基础 URL */
  baseUrl: string;
  /** 模型名称 */
  model: string;
}

/**
 * 环境变量 LLM 配置（包含配置状态）
 */
export interface EnvLLMConfig extends LLMConfig {
  /** 是否已配置 */
  isConfigured: boolean;
}

/**
 * 生成上下文
 */
export interface GenerationContext {
  /** 布局方向 */
  layoutDirection: LayoutDirection;
  /** 图类型意图 */
  diagramType?: MermaidDiagramType;
  /** 使用场景 */
  usageScenario: UsageScenario;
  /** 节点数量 */
  nodeCount: number;
  /** 主题风格 */
  theme: string;
  /** 整体布局区域偏好 */
  layoutArea?: 'compact' | 'medium' | 'spacious';
  /** 密集程度偏好 */
  density?: 'dense' | 'balanced' | 'sparse';
  /** 结构模式偏好 */
  structurePattern?: StructurePattern;
  /** 补充构图意图 */
  layoutIntentText?: string;
  /** 需要强调的阶段或模块 */
  emphasisTargets?: string[];
  /** Mermaid 样式模式 */
  styleMode?: MermaidStyleMode;
  /** 图形风格 */
  diagramStyle?: DiagramStyle;
  /** 美观度倾向 */
  beautyLevel?: BeautyLevel;
  /** 版式节奏 */
  layoutRhythm?: LayoutRhythm;
  /** 视觉重点 */
  visualFocus?: VisualFocus;
  /** 当前澄清状态 */
  clarificationStatus?: ClarificationStatus;
}

export interface OneShotMermaidDraft {
  /** 用户原始文本 */
  sourceText: string;
  /** 归一化后的原始文本 */
  normalizedSourceText: string;
  /** 生成上下文 */
  context: GenerationContext;
  /** 提交前摘要 */
  summaryLines: string[];
}

export type PromptAssistActionType =
  | 'append-source'
  | 'set-structure-pattern'
  | 'set-layout-direction'
  | 'set-emphasis-targets';

export interface PromptAssistSuggestion {
  /** 建议唯一标识 */
  id: string;
  /** 按钮文案 */
  label: string;
  /** 建议说明 */
  detail: string;
  /** 建议动作类型 */
  action: PromptAssistActionType;
  /** 建议动作值 */
  value: string | string[];
}

export interface PromptAssistState {
  /** 是否可以直接提交 */
  isReady: boolean;
  /** 当前摘要标题 */
  summaryTitle: string;
  /** 当前摘要明细 */
  summaryLines: string[];
  /** 风险提示 */
  warnings: string[];
  /** 可点击的辅助建议 */
  suggestions: PromptAssistSuggestion[];
  /** 预计节点规模 */
  estimatedNodeCount: number;
}

export interface MermaidRenderPreset {
  /** 预估图类型 */
  diagramType: MermaidDiagramType;
  /** 预估预览模式 */
  previewMode: MermaidPreviewMode;
  /** 连线曲线 */
  curve: 'linear' | 'basis';
  /** 预览字号 */
  fontSize: string;
}

export type ComposerPhase =
  | 'idle'
  | 'generating'
  | 'stabilizing'
  | 'ready'
  | 'error';

export interface ComposerState {
  /** 原始文本 */
  sourceText: string;
  /** 生成上下文 */
  context: GenerationContext;
  /** 本地辅助分析结果 */
  assist: PromptAssistState;
  /** 当前草稿 */
  draft: OneShotMermaidDraft;
  /** Mermaid 渲染预设 */
  renderPreset: MermaidRenderPreset;
  /** 当前阶段 */
  phase: ComposerPhase;
  /** 当前 Mermaid 代码 */
  mermaidCode: string;
  /** 最近一次稳定生成的代码 */
  submittedCode: string;
  /** 是否展开代码编辑区 */
  isCodeEditorOpen: boolean;
}

/**
 * 布局方向
 */
export type LayoutDirection = 'LR' | 'TB';

/**
 * Mermaid 图类型
 */
export type MermaidDiagramType =
  | 'auto'
  | 'flowchart'
  | 'sequenceDiagram'
  | 'classDiagram'
  | 'stateDiagram'
  | 'erDiagram'
  | 'journey'
  | 'gantt'
  | 'pie'
  | 'gitGraph'
  | 'requirementDiagram'
  | 'mindmap'
  | 'timeline'
  | 'quadrantChart'
  | 'xychart'
  | 'sankey'
  | 'c4'
  | 'block'
  | 'packet'
  | 'kanban'
  | 'architecture'
  | 'other';

/**
 * Mermaid 样式模式
 */
export type MermaidStyleMode = 'auto' | 'minimal' | 'semantic' | 'grouped' | 'showcase';

/**
 * Mermaid 预览模式
 */
export type MermaidPreviewMode = 'native-editable' | 'svg-fallback';

/**
 * 使用场景
 */
export type UsageScenario = 'paper' | 'presentation' | 'document';

/**
 * 图形风格
 */
export type DiagramStyle = 'publication' | 'architecture' | 'explainer';

/**
 * 美观度倾向
 */
export type BeautyLevel = 'conservative' | 'balanced' | 'enhanced';

/**
 * 版式节奏
 */
export type LayoutRhythm = 'compact' | 'airy' | 'symmetrical';

/**
 * 视觉重点
 */
export type VisualFocus = 'input' | 'core' | 'output' | 'convergence';

/**
 * 结构模式偏好
 */
export type StructurePattern =
  | 'linear'
  | 'branched'
  | 'convergent'
  | 'multi-lane'
  | 'feedback'
  | 'mixed';

/**
 * 澄清状态
 */
export type ClarificationStatus = 'none' | 'pending' | 'resolved';

/**
 * 主题风格预设
 */
export type ThemePreset = 'professional' | 'lively' | 'academic' | 'minimal';

/**
 * 节点形状预设
 */
export type NodeShapePreset = 'rectangle' | 'rounded' | 'stadium';
