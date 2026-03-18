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
  /** 当前澄清状态 */
  clarificationStatus?: ClarificationStatus;
}

/**
 * 布局方向
 */
export type LayoutDirection = 'LR' | 'TB';

/**
 * 使用场景
 */
export type UsageScenario = 'paper' | 'presentation' | 'document';

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
