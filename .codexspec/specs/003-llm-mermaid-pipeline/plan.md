# 实现计划：AI 驱动的论文 Pipeline 框架图生成器

## 1. 技术栈

| 类别 | 技术 | 版本 | 备注 |
|------|------|------|------|
| 语言 | TypeScript | 5.x | 严格模式 |
| 前端框架 | React | 19.2.0 | 与项目一致 |
| 绘图库 | Plait | 最新 | 已有依赖 |
| Mermaid 转换 | @plait-board/mermaid-to-drawnix | 最新 | 已有依赖 |
| LLM 接口 | OpenAI API 格式 | - | 兼容实现 |
| 状态管理 | React Hooks | - | useDrawnix |
| 样式 | SCSS | - | 与组件共置 |
| 存储配置 | .env / Vite | - | 开发阶段 |

## 2. 宪法审查

| 原则 | 合规性 | 说明 |
|------|--------|------|
| **1. 代码质量** | ✅ | 遵循 2 空格缩进、TypeScript、有意义的命名 |
| **2. 测试标准** | ✅ | 单元测试覆盖率目标 > 70% |
| **3. 文档** | ✅ | 公共 API 添加 JSDoc 注释 |
| **4. 架构** | ✅ | 关注点分离、可扩展设计 |
| **5. 性能** | ✅ | 使用 deferred value 优化输入、流式响应 |
| **6. 安全** | ✅ | API Key 存储在服务端 .env，不暴露给客户端 |

## 3. 架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AppToolbar (顶部工具栏)                       │
│  ┌─────────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────────────────────────┐  │
│  │  Logo   │ │Undo│ │Redo│ │... │ │ ...│ │  🤖 AI Pipeline (新增) │  │
│  └─────────┘ └────┘ └────┘ └────┘ └────┘ └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │ 点击
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LLMMermaidDialog (对话框)                        │
├──────────────────────────────────────┬──────────────────────────────┤
│           ChatPanel (40%)             │       PreviewPanel (60%)      │
├──────────────────────────────────────┼──────────────────────────────┤
│  ┌──────────────────────────────┐   │  ┌─────────────────────────┐  │
│  │   StructuredInputForm       │   │  │   BoardPreview          │  │
│  │   (预设引导问题)             │   │  │   (实时预览)            │  │
│  └──────────────────────────────┘   │  │                         │  │
│  ┌──────────────────────────────┐   │  │  ┌─────────────────┐   │  │
│  │   MessageList               │   │  │  │  MermaidCodeView │   │  │
│  │   (对话历史)                 │   │  │  │  (代码预览)       │   │  │
│  │   ┌──────────────────────┐  │   │  │  └─────────────────┘   │  │
│  │   │ MessageItem           │  │   │  │                         │  │
│  │   │ MessageItem           │  │   │  │  操作按钮：               │  │
│  │   └──────────────────────┘  │   │  │  [重新生成] [插入画板]     │  │
│  └──────────────────────────────┘   │  └─────────────────────────┘  │
│  ┌──────────────────────────────┐   │                              │
│  │   MessageInput               │   │                              │
│  │   (消息输入框)                │   │                              │
│  └──────────────────────────────┘   │                              │
└──────────────────────────────────────┴──────────────────────────────┘
                    │                                    │
                    ▼                                    ▼
        ┌───────────────────────┐         ┌─────────────────────────┐
        │  LLMChatService       │         │  MermaidConverter       │
        │  (LLM 对话服务)        │         │  (Mermaid 转换服务)      │
        └───────────────────────┘         └─────────────────────────┘
                    │                                    │
                    └────────────┬───────────────────────┘
                                 ▼
                    ┌───────────────────────┐
                    │  StyleRecommendation  │
                    │  Service              │
                    │  (样式推荐服务)        │
                    └───────────────────────┘
```

## 4. 组件结构

```
packages/drawnix/src/
├── llm-mermaid/                          # 新建目录
│   ├── components/                       # 组件
│   │   ├── llm-mermaid-dialog.tsx        # 主对话框
│   │   ├── llm-mermaid-dialog.scss       # 对话框样式
│   │   ├── chat-panel/                   # 左侧对话面板
│   │   │   ├── index.tsx
│   │   │   ├── message-list.tsx          # 对话历史列表
│   │   │   ├── message-list.scss
│   │   │   ├── message-item.tsx          # 单条消息组件
│   │   │   ├── message-input.tsx         # 输入框组件
│   │   │   ├── message-input.scss
│   │   │   ├── structured-input-form.tsx # 预设引导表单
│   │   │   └── structured-input-form.scss
│   │   └── preview-panel/                # 右侧预览面板
│   │       ├── index.tsx
│   │       ├── board-preview.tsx         # 画板预览
│   │       ├── board-preview.scss
│   │       ├── mermaid-code-view.tsx     # Mermaid 代码预览
│   │       └── mermaid-code-view.scss
│   ├── services/                         # 服务层
│   │   ├── llm-chat-service.ts           # LLM 对话服务
│   │   ├── mermaid-converter.ts          # Mermaid 转换服务
│   │   ├── style-recommendation.ts       # 样式推荐服务
│   │   └── prompt-templates.ts           # LLM 提示词模板
│   ├── types/                            # 类型定义
│   │   ├── chat.ts                       # 对话相关类型
│   │   ├── config.ts                     # 配置相关类型
│   │   └── style.ts                      # 样式相关类型
│   ├── hooks/                            # 自定义 Hooks
│   │   ├── use-llm-chat.ts               # LLM 对话 Hook
│   │   ├── use-mermaid-preview.ts        # Mermaid 预览 Hook
│   │   └── use-style-optimization.ts     # 样式优化 Hook
│   └── utils/                            # 工具函数
│       ├── message-validator.ts          # 消息验证
│       └── mermaid-helper.ts             # Mermaid 辅助函数
├── components/
│   ├── toolbar/
│   │   ├── app-toolbar/
│   │   │   └── app-toolbar.tsx           # 修改：新增 AI Pipeline 按钮
│   │   └── llm-mermaid-button.tsx        # 新建：AI Pipeline 按钮
│   └── icons.tsx                         # 修改：新增图标
├── hooks/
│   └── use-drawnix.tsx                   # 修改：新增 DialogType
└── i18n/
    └── zh-CN.json                         # 修改：新增翻译
```

## 5. 模块依赖图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              UI Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │AppToolbar    │  │LLMMermaidDialog│ │ChatPanel     │  │PreviewPanel│  │
│  │(新增按钮)     │  │(主对话框)      │  │(对话面板)    │  │(预览面板)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
└─────────┼──────────────────┼──────────────────┼──────────────────┼───────┘
          │                  │                  │                  │
          ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Hooks Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │useDrawnix    │  │useLLMChat    │  │useMermaidPreview│              │
│  │(已有)        │  │(新增)        │  │(新增)         │                 │
│  └──────────────┘  └──────┬───────┘  └──────┬───────┘                 │
└─────────────────────────────────┼──────────────────┼────────────────────┘
                                  │                  │
                                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            Services Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │LLMChatService│  │MermaidConverter│ │StyleRecommendation│           │
│  │(LLM 对话)    │  │(Mermaid 转换)│  │(样式推荐)     │                 │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                 │
└─────────┼──────────────────┼──────────────────┼───────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         External Dependencies                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │OpenAI API    │  │@plait-board/ │  │Plait Board   │                 │
│  │(环境变量配置)  │  │mermaid-to...│  │(已有)        │                 │
│  └──────────────┘  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## 6. 模块规范

### 模块：LLMMermaidDialog

- **职责**：主对话框容器，管理对话框状态和布局
- **依赖**：`ChatPanel`, `PreviewPanel`, `useDrawnix`
- **接口**：
  ```typescript
  interface LLMMermaidDialogProps {
    container: HTMLElement | null;
  }
  ```
- **文件**：
  - `packages/drawnix/src/llm-mermaid/components/llm-mermaid-dialog.tsx`
  - `packages/drawnix/src/llm-mermaid/components/llm-mermaid-dialog.scss`

### 模块：ChatPanel

- **职责**：左侧对话面板，包含消息列表、输入框和结构化表单
- **依赖**：`MessageList`, `MessageInput`, `StructuredInputForm`, `useLLMChat`
- **接口**：
  ```typescript
  interface ChatPanelProps {
    messages: Message[];
    onSendMessage: (content: string) => void;
    isGenerating: boolean;
  }
  ```
- **文件**：
  - `packages/drawnix/src/llm-mermaid/components/chat-panel/index.tsx`
  - `packages/drawnix/src/llm-mermaid/components/chat-panel/message-list.tsx`
  - `packages/drawnix/src/llm-mermaid/components/chat-panel/message-item.tsx`
  - `packages/drawnix/src/llm-mermaid/components/chat-panel/message-input.tsx`
  - `packages/drawnix/src/llm-mermaid/components/chat-panel/structured-input-form.tsx`

### 模块：PreviewPanel

- **职责**：右侧预览面板，显示画板预览和 Mermaid 代码
- **依赖**：`BoardPreview`, `MermaidCodeView`, `useMermaidPreview`
- **接口**：
  ```typescript
  interface PreviewPanelProps {
    mermaidCode: string;
    elements: PlaitElement[];
    onInsert: () => void;
    isGenerating: boolean;
  }
  ```
- **文件**：
  - `packages/drawnix/src/llm-mermaid/components/preview-panel/index.tsx`
  - `packages/drawnix/src/llm-mermaid/components/preview-panel/board-preview.tsx`
  - `packages/drawnix/src/llm-mermaid/components/preview-panel/mermaid-code-view.tsx`

### 模块：LLMChatService

- **职责**：封装 LLM API 调用，处理流式响应和错误
- **依赖**：环境变量配置 (`VITE_LLM_MERMAID_*`)
- **接口**：
  ```typescript
  interface LLMChatService {
    chat(messages: Message[], options?: ChatOptions): AsyncGenerator<ChatChunk>;
    generateMermaid(prompt: string, context: GenerationContext): Promise<string>;
    generateStyle(graphInfo: GraphInfo, styleRequest: string): Promise<StyleScheme>;
  }
  ```
- **文件**：`packages/drawnix/src/llm-mermaid/services/llm-chat-service.ts`

### 模块：MermaidConverter

- **职责**：使用 `@plait-board/mermaid-to-drawnix` 转换 Mermaid 代码
- **依赖**：`@plait-board/mermaid-to-drawnix`
- **接口**：
  ```typescript
  interface MermaidConverter {
    convertToElements(mermaidCode: string): Promise<PlaitElement[]>;
    validateMermaid(mermaidCode: string): ValidationResult;
    extractGraphInfo(elements: PlaitElement[]): GraphInfo;
  }
  ```
- **文件**：`packages/drawnix/src/llm-mermaid/services/mermaid-converter.ts`

### 模块：StyleRecommendation

- **职责**：基于图表结构和用户请求生成样式推荐
- **依赖**：`LLMChatService`
- **接口**：
  ```typescript
  interface StyleRecommendation {
    recommendDefault(graphInfo: GraphInfo, usage: UsageScenario): Promise<StyleScheme>;
    adjustStyle(graphInfo: GraphInfo, currentStyle: StyleScheme, request: string): Promise<StyleScheme>;
  }
  ```
- **文件**：`packages/drawnix/src/llm-mermaid/services/style-recommendation.ts`

### 模块：PromptTemplates

- **职责**：管理 LLM 提示词模板
- **依赖**：无
- **接口**：
  ```typescript
  interface PromptTemplates {
    getInitialPrompt(): string;
    getMermaidGenerationPrompt(context: GenerationContext): string;
    getStyleOptimizationPrompt(graphInfo: GraphInfo, styleRequest: string): string;
  }
  ```
- **文件**：`packages/drawnix/src/llm-mermaid/services/prompt-templates.ts`

### 模块：useLLMChat (Hook)

- **职责**：封装对话状态管理
- **依赖**：`LLMChatService`
- **接口**：
  ```typescript
  interface UseLLMChatResult {
    messages: Message[];
    isGenerating: boolean;
    error: Error | null;
    sendMessage: (content: string) => Promise<void>;
    regenerate: () => Promise<void>;
  }
  ```
- **文件**：`packages/drawnix/src/llm-mermaid/hooks/use-llm-chat.ts`

## 7. 数据模型

### Message (聊天消息)

| 字段 | 类型 | 描述 | 约束 |
|------|------|------|------|
| id | string | 消息唯一标识 | UUID |
| role | 'user' \| 'assistant' \| 'system' | 消息角色 | 必填 |
| content | string | 消息内容 | 非空 |
| timestamp | number | 时间戳 | Unix ms |
| type | 'text' \| 'mermaid' \| 'style' | 消息类型 | 默认 'text' |
| metadata | MessageMetadata | 元数据 | 可选 |

### MessageMetadata (消息元数据)

| 字段 | 类型 | 描述 |
|------|------|------|
| mermaidCode | string | Mermaid 代码 |
| styleScheme | StyleScheme | 样式方案 |
| generationContext | GenerationContext | 生成上下文 |

### GenerationContext (生成上下文)

| 字段 | 类型 | 描述 |
|------|------|------|
| layoutDirection | 'LR' \| 'TB' | 布局方向 |
| usageScenario | 'paper' \| 'presentation' \| 'document' | 使用场景 |
| nodeCount | number | 节点数量 |
| theme | string | 主题风格 |

### StyleScheme (样式方案)

| 字段 | 类型 | 描述 |
|------|------|------|
| nodeId | string | 应用到的节点 ID（'*' 表示全部） |
| fill | string | 填充颜色（CSS 颜色值） |
| stroke | string | 边框颜色 |
| strokeWidth | number | 边框粗细（px） |
| color | string | 字体颜色 |
| fontSize | number | 字体大小（px） |
| shadow | boolean | 是否启用阴影 |
| shadowBlur | number | 阴影模糊度 |

### GraphInfo (图表结构信息)

| 字段 | 类型 | 描述 |
|------|------|------|
| nodes | GraphNode[] | 节点列表 |
| edges | GraphEdge[] | 边列表 |
| groups | GraphGroup[] | 分组列表 |
| depth | number | 图表深度 |
| avgDegree | number | 平均度数 |

### GraphNode (图节点)

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 节点 ID |
| label | string | 节点标签 |
| inDegree | number | 入度 |
| outDegree | number | 出度 |
| groupId | string | 所属分组 ID |

## 8. API 契约

### 环境变量 API

```bash
# .env 或 .env.local
VITE_LLM_MERMAID_API_BASE_URL=https://api.openai.com/v1
VITE_LLM_MERMAID_API_KEY=sk-xxx
VITE_LLM_MERMAID_MODEL=gpt-4o
```

### LLM Chat API (OpenAI 兼容)

**请求格式**：
```typescript
interface ChatRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}
```

**响应格式**（非流式）：
```typescript
interface ChatResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

**响应格式**（流式）：
```typescript
interface ChatChunk {
  id: string;
  choices: Array<{
    delta: {
      content?: string;
    };
    finish_reason: string | null;
  }>;
}
```

### Mermaid 转换 API (@plait-board/mermaid-to-drawnix)

**输入**：Mermaid 代码字符串
**输出**：
```typescript
interface MermaidToDrawnixResult {
  elements: PlaitElement[];
}
```

## 9. 实现阶段

### Phase 1: 基础设施搭建

- [ ] 创建 `llm-mermaid` 目录结构
- [ ] 配置环境变量类型和读取逻辑
- [ ] 创建核心类型定义 (`types/`)
- [ ] 在 `use-drawnix.tsx` 中添加 `DialogType.llmMermaid`
- [ ] 在 `app-toolbar.tsx` 中添加 AI Pipeline 按钮
- [ ] 创建主对话框骨架 `LLMMermaidDialog`

### Phase 2: 核心服务实现

- [ ] 实现 `LLMChatService`（LLM API 调用封装）
- [ ] 实现 `PromptTemplates`（提示词模板）
- [ ] 实现 `MermaidConverter`（转换服务）
- [ ] 实现 `useLLMChat` Hook
- [ ] 实现 `useMermaidPreview` Hook

### Phase 3: UI 组件开发

- [ ] 实现 `ChatPanel` 及子组件
  - [ ] `MessageList` + `MessageItem`
  - [ ] `MessageInput`
  - [ ] `StructuredInputForm`
- [ ] 实现 `PreviewPanel` 及子组件
  - [ ] `BoardPreview`
  - [ ] `MermaidCodeView`
- [ ] 实现 `LLMMermaidDialog` 主组件

### Phase 4: 样式优化功能

- [ ] 实现 `StyleRecommendation` 服务
- [ ] 实现 `useStyleOptimization` Hook
- [ ] 添加样式调整交互逻辑
- [ ] 实现样式应用到元素的功能

### Phase 5: 集成与测试

- [ ] 将对话框集成到 `TTDDialog`
- [ ] 实现插入到画板功能
- [ ] 添加错误处理和边界情况处理
- [ ] 添加单元测试
- [ ] 添加国际化文本

## 10. 技术决策

### 决策 1：使用 OpenAI 兼容 API 格式

- **选择**：采用 OpenAI API 格式作为标准接口
- **理由**：这是目前最广泛兼容的格式，支持多家 LLM 提供商（OpenAI、Anthropic、国产大模型等），降低未来切换成本
- **替代方案**：直接使用各提供商 SDK（需要为每个提供商单独适配）
- **权衡**：放弃了部分高级特性（如 Anthropic 的 Claude 特定功能），换取了更好的兼容性

### 决策 2：复用现有 Mermaid 转换库

- **选择**：使用现有的 `@plait-board/mermaid-to-drawnix` 库
- **理由**：该库已在项目中使用并验证，无需重复造轮子
- **替代方案**：自己实现 Mermaid 解析和转换
- **权衡**：受限于该库的能力，但节省开发时间并保证一致性

### 决策 3：左右分栏布局

- **选择**：左侧 40% 对话区，右侧 60% 预览区
- **理由**：预览区需要更大的空间来展示图表细节，对话区相对紧凑即可
- **替代方案**：上下分栏、标签页切换
- **权衡**：在较小屏幕上可能需要响应式调整

### 决策 4：流式响应

- **选择**：使用 Server-Sent Events (SSE) / 流式 API
- **理由**：提升用户体验，实时看到 AI 生成内容
- **替代方案**：等待完整响应后一次性显示
- **权衡**：实现复杂度稍高，但用户体验显著提升

### 决策 5：环境变量配置

- **选择**：开发阶段使用 .env 文件存储 API 配置
- **理由**：简单直接，适合开发阶段
- **替代方案**：localStorage、后端代理
- **权衡**：不适合生产环境（API Key 会暴露），但满足了当前需求

### 决策 6：样式方案设计

- **选择**：基于 Mermaid classDef 的样式方案
- **理由**：Mermaid 原生支持样式类，与转换库兼容
- **替代方案**：在 Plait 元素层面直接应用样式
- **权衡**：需要在 Mermaid 代码中嵌入样式定义，但保证了转换的正确性

### 决策 7：状态管理

- **选择**：使用 React Hooks (useState + useContext) 而非引入额外状态管理库
- **理由**：功能相对独立，状态范围有限，不需要 Redux/Zustand 等重型方案
- **替代方案**：引入 Zustand/Jotai 等状态管理库
- **权衡**：在功能扩展时可能需要重构，但当前够用且轻量

---

*文档版本：1.0*
*创建日期：2026-03-15*
