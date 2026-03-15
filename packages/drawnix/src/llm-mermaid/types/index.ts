/**
 * LLM Mermaid 类型定义统一导出
 */

// 对话相关类型
export type {
  MessageRole,
  MessageType,
  Message,
  MessageMetadata,
  ChatChunk,
  ChatOptions,
} from './chat';

// 配置相关类型
export type {
  LLMConfig,
  EnvLLMConfig,
  ThemePreset,
  NodeShapePreset,
  GenerationContext,
  LayoutDirection,
  UsageScenario,
} from './config';

// 样式相关类型
export type {
  StyleScheme,
  GraphInfo,
  GraphNode,
  GraphEdge,
  GraphGroup,
  ValidationResult,
} from './style';

export type {
  BoardStyleSelector,
  BoardStrokeStyle,
  BoardLineShape,
  BoardArrowMarker,
  BoardStyleScheme,
  ElementStyleMap,
  BoardStyleSchemeOption,
  BoardStyleSchemesResult,
  SelectedElementsSummary,
} from './board-style';
