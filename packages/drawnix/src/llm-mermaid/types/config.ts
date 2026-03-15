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
 * 主题风格预设
 */
export type ThemePreset = 'professional' | 'lively' | 'academic' | 'minimal';

/**
 * 节点形状预设
 */
export type NodeShapePreset = 'rectangle' | 'rounded' | 'stadium';
