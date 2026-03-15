# 任务分解：AI 驱动的论文 Pipeline 框架图生成器

## 概览

- **总任务数**：62
- **可并行任务数**：38
- **预计阶段数**：5

---

## Phase 1: 基础设施搭建

### Task 1.1: 创建 llm-mermaid 目录结构

- **类型**：设置
- **文件**：`packages/drawnix/src/llm-mermaid/`
- **描述**：创建 llm-mermaid 功能目录及子目录结构（components, services, types, hooks, utils）
- **依赖**：无
- **估计复杂度**：低

### Task 1.2: 创建核心类型定义 - chat.ts

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/types/chat.ts`
- **描述**：定义对话相关类型（Message, MessageMetadata, ChatChunk 等）
- **依赖**：Task 1.1
- **估计复杂度**：低

### Task 1.3: 创建核心类型定义 - config.ts [P]

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/types/config.ts`
- **描述**：定义配置相关类型（LLMConfig, GenerationContext 等）
- **依赖**：Task 1.1
- **估计复杂度**：低

### Task 1.4: 创建核心类型定义 - style.ts [P]

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/types/style.ts`
- **描述**：定义样式相关类型（StyleScheme, GraphInfo, GraphNode 等）
- **依赖**：Task 1.1
- **估计复杂度**：低

### Task 1.5: 创建类型导出索引

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/types/index.ts`
- **描述**：导出所有类型定义，统一入口
- **依赖**：Task 1.2, Task 1.3, Task 1.4
- **估计复杂度**：低

### Task 1.6: 添加 DialogType 枚举

- **类型**：实现
- **文件**：`packages/drawnix/src/hooks/use-drawnix.tsx`
- **描述**：在 DialogType 枚举中添加 `llmMermaid = 'llmMermaid'`
- **依赖**：无
- **估计复杂度**：低

### Task 1.7: 添加 AI Pipeline 图标

- **类型**：实现
- **文件**：`packages/drawnix/src/components/icons.tsx`
- **描述**：创建 AI Pipeline 按钮图标组件
- **依赖**：无
- **估计复杂度**：低

### Task 1.8: 创建 AI Pipeline 按钮

- **类型**：实现
- **文件**：`packages/drawnix/src/components/toolbar/llm-mermaid-button.tsx`
- **描述**：创建 AI Pipeline 入口按钮组件，点击打开对话框
- **依赖**：Task 1.6, Task 1.7
- **估计复杂度**：低

### Task 1.9: 集成按钮到顶部工具栏

- **类型**：实现
- **文件**：`packages/drawnix/src/components/toolbar/app-toolbar/app-toolbar.tsx`
- **描述**：在顶部工具栏最右侧添加 AI Pipeline 按钮
- **依赖**：Task 1.8
- **估计复杂度**：低

### Task 1.10: 创建环境变量配置工具

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/utils/env-config.ts`
- **描述**：创建环境变量读取函数，获取 VITE_LLM_MERMAID_* 配置
- **依赖**：Task 1.3
- **估计复杂度**：低

### Task 1.11: 创建主对话框骨架样式

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/components/llm-mermaid-dialog.scss`
- **描述**：定义对话框左右分栏布局样式（40% / 60%）
- **依赖**：Task 1.1
- **估计复杂度**：低

### Task 1.12: 创建主对话框骨架组件

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/components/llm-mermaid-dialog.tsx`
- **描述**：创建主对话框骨架，包含左右分栏容器和基本状态管理
- **依赖**：Task 1.5, Task 1.6, Task 1.11
- **估计复杂度**：中

### Task 1.13: 集成到 TTDDialog

- **类型**：实现
- **文件**：`packages/drawnix/src/components/ttd-dialog/ttd-dialog.tsx`
- **描述**：在 TTDDialog 中添加 LLMMermaidDialog 的渲染逻辑
- **依赖**：Task 1.12
- **估计复杂度**：低

---

## Phase 2: 核心服务实现 (TDD)

### Task 2.1: 编写 PromptTemplates 测试 [P]

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/services/prompt-templates.spec.ts`
- **描述**：编写提示词模板的单元测试
- **依赖**：Task 1.5
- **估计复杂度**：低

### Task 2.2: 实现 PromptTemplates

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/services/prompt-templates.ts`
- **描述**：实现 LLM 提示词模板管理（初始提示、Mermaid 生成、样式优化）
- **依赖**：Task 2.1
- **估计复杂度**：中

### Task 2.3: 编写 LLMChatService 测试 [P]

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/services/llm-chat-service.spec.ts`
- **描述**：编写 LLM 对话服务的单元测试（包含 mock）
- **依赖**：Task 1.5, Task 1.10
- **估计复杂度**：中

### Task 2.4: 实现 LLMChatService

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/services/llm-chat-service.ts`
- **描述**：实现 LLM API 调用封装，支持流式响应和错误处理
- **依赖**：Task 2.3
- **估计复杂度**：高

### Task 2.5: 编写 MermaidConverter 测试 [P]

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/services/mermaid-converter.spec.ts`
- **描述**：编写 Mermaid 转换服务的单元测试
- **依赖**：Task 1.5
- **估计复杂度**：中

### Task 2.6: 实现 MermaidConverter

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/services/mermaid-converter.ts`
- **描述**：实现 Mermaid 代码转换服务，封装 @plait-board/mermaid-to-drawnix
- **依赖**：Task 2.5
- **估计复杂度**：中

### Task 2.7: 编写 MermaidHelper 工具测试 [P]

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/utils/mermaid-helper.spec.ts`
- **描述**：编写 Mermaid 辅助函数的单元测试
- **依赖**：Task 1.5
- **估计复杂度**：低

### Task 2.8: 实现 MermaidHelper 工具

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/utils/mermaid-helper.ts`
- **描述**：实现 Mermaid 代码验证和修复工具函数
- **依赖**：Task 2.7
- **估计复杂度**：低

### Task 2.9: 编写 MessageValidator 工具测试 [P]

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/utils/message-validator.spec.ts`
- **描述**：编写消息验证工具的单元测试
- **依赖**：Task 1.5
- **估计复杂度**：低

### Task 2.10: 实现 MessageValidator 工具

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/utils/message-validator.ts`
- **描述**：实现用户输入消息验证和边界检查工具
- **依赖**：Task 2.9
- **估计复杂度**：低

### Task 2.11: 编写 useLLMChat Hook 测试

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/hooks/use-llm-chat.spec.ts`
- **描述**：编写 LLM 对话 Hook 的单元测试
- **依赖**：Task 2.4
- **估计复杂度**：中

### Task 2.12: 实现 useLLMChat Hook

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/hooks/use-llm-chat.ts`
- **描述**：实现对话状态管理 Hook，封装消息发送、流式响应等逻辑
- **依赖**：Task 2.11
- **估计复杂度**：中

### Task 2.13: 编写 useMermaidPreview Hook 测试 [P]

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/hooks/use-mermaid-preview.spec.ts`
- **描述**：编写 Mermaid 预览 Hook 的单元测试
- **依赖**：Task 2.6
- **估计复杂度**：中

### Task 2.14: 实现 useMermaidPreview Hook

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/hooks/use-mermaid-preview.ts`
- **描述**：实现 Mermaid 预览 Hook，管理代码转换和元素状态
- **依赖**：Task 2.13
- **估计复杂度**：中

---

## Phase 3: UI 组件开发 (TDD)

### Task 3.1: 编写 MessageItem 组件测试 [P]

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/components/chat-panel/message-item.spec.tsx`
- **描述**：编写消息项组件的单元测试
- **依赖**：Task 1.5
- **估计复杂度**：低

### Task 3.2: 实现 MessageItem 组件

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/components/chat-panel/message-item.tsx`
- **描述**：实现单条消息显示组件，支持文本、代码、加载状态
- **依赖**：Task 3.1
- **估计复杂度**：低

### Task 3.3: 编写 MessageList 组件测试 [P]

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/components/chat-panel/message-list.spec.tsx`
- **描述**：编写消息列表组件的单元测试
- **依赖**：Task 3.2
- **估计复杂度**：中

### Task 3.4: 实现 MessageList 组件

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/components/chat-panel/message-list.tsx`
- **描述**：实现对话历史列表组件，支持滚动和自动定位
- **依赖**：Task 3.3
- **估计复杂度**：中

### Task 3.5: 编写 MessageInput 组件测试 [P]

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/components/chat-panel/message-input.spec.tsx`
- **描述**：编写消息输入组件的单元测试
- **依赖**：无
- **估计复杂度**：中

### Task 3.6: 实现 MessageInput 组件

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/components/chat-panel/message-input.tsx`
- **描述**：实现消息输入框组件，支持快捷键提交（Ctrl/Cmd + Enter）
- **依赖**：Task 3.5
- **估计复杂度**：中

### Task 3.7: 编写 StructuredInputForm 组件测试 [P]

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/components/chat-panel/structured-input-form.spec.tsx`
- **描述**：编写结构化输入表单的单元测试
- **依赖**：Task 1.5
- **估计复杂度**：中

### Task 3.8: 实现 StructuredInputForm 组件

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/components/chat-panel/structured-input-form.tsx`
- **描述**：实现预设引导表单组件，收集布局方向、样式偏好、目标用途等
- **依赖**：Task 3.7
- **估计复杂度**：中

### Task 3.9: 编写 ChatPanel 组件测试

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/components/chat-panel/index.spec.tsx`
- **描述**：编写对话面板的集成测试
- **依赖**：Task 2.12, Task 3.4, Task 3.6, Task 3.8
- **估计复杂度**：高

### Task 3.10: 实现 ChatPanel 组件

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/components/chat-panel/index.tsx`
- **描述**：实现左侧对话面板，整合 MessageList、MessageInput、StructuredInputForm
- **依赖**：Task 3.9
- **估计复杂度**：中

### Task 3.11: 编写 MermaidCodeView 组件测试 [P]

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/components/preview-panel/mermaid-code-view.spec.tsx`
- **描述**：编写 Mermaid 代码预览组件的单元测试
- **依赖**：无
- **估计复杂度**：低

### Task 3.12: 实现 MermaidCodeView 组件

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/components/preview-panel/mermaid-code-view.tsx`
- **描述**：实现 Mermaid 代码预览组件，支持语法高亮和复制
- **依赖**：Task 3.11
- **估计复杂度**：低

### Task 3.13: 编写 BoardPreview 组件测试 [P]

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/components/preview-panel/board-preview.spec.tsx`
- **描述**：编写画板预览组件的单元测试
- **依赖**：Task 2.14
- **估计复杂度**：高

### Task 3.14: 实现 BoardPreview 组件

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/components/preview-panel/board-preview.tsx`
- **描述**：实现画板预览组件，使用 Wrapper + Board 渲染 PlaitElement
- **依赖**：Task 3.13
- **估计复杂度**：高

### Task 3.15: 编写 PreviewPanel 组件测试

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/components/preview-panel/index.spec.tsx`
- **描述**：编写预览面板的集成测试
- **依赖**：Task 3.12, Task 3.14
- **估计复杂度**：高

### Task 3.16: 实现 PreviewPanel 组件

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/components/preview-panel/index.tsx`
- **描述**：实现右侧预览面板，整合 BoardPreview 和 MermaidCodeView，包含插入按钮
- **依赖**：Task 3.15
- **估计复杂度**：中

### Task 3.17: 完善 LLMMermaidDialog 主组件

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/components/llm-mermaid-dialog.tsx`
- **描述**：整合 ChatPanel 和 PreviewPanel，实现完整交互逻辑
- **依赖**：Task 3.10, Task 3.16
- **估计复杂度**：高

---

## Phase 4: 样式优化功能 (TDD)

### Task 4.1: 编写 StyleRecommendation 服务测试

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/services/style-recommendation.spec.ts`
- **描述**：编写样式推荐服务的单元测试
- **依赖**：Task 2.4
- **估计复杂度**：中

### Task 4.2: 实现 StyleRecommendation 服务

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/services/style-recommendation.ts`
- **描述**：实现样式推荐服务，基于图表结构和用户请求生成样式方案
- **依赖**：Task 4.1
- **估计复杂度**：高

### Task 4.3: 编写 useStyleOptimization Hook 测试

- **类型**：测试
- **文件**：`packages/drawnix/src/llm-mermaid/hooks/use-style-optimization.spec.ts`
- **描述**：编写样式优化 Hook 的单元测试
- **依赖**：Task 4.2
- **估计复杂度**：中

### Task 4.4: 实现 useStyleOptimization Hook

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/hooks/use-style-optimization.ts`
- **描述**：实现样式优化 Hook，管理样式调整和重新生成逻辑
- **依赖**：Task 4.3
- **估计复杂度**：中

### Task 4.5: 添加样式应用到元素功能

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/utils/style-applier.ts`
- **描述**：实现将 StyleScheme 应用到 PlaitElement 的工具函数
- **依赖**：Task 4.2
- **估计复杂度**：中

### Task 4.6: 集成样式优化到对话框

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/components/llm-mermaid-dialog.tsx`
- **描述**：在对话框中集成样式优化功能，支持样式调整交互
- **依赖**：Task 4.4, Task 4.5
- **估计复杂度**：中

---

## Phase 5: 集成、测试与文档

### Task 5.1: 实现插入到画板功能

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/components/llm-mermaid-dialog.tsx`
- **描述**：实现将生成的图表插入主画板的功能，插入后关闭对话框
- **依赖**：Task 3.17
- **估计复杂度**：中

### Task 5.2: 添加错误处理逻辑

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/hooks/use-llm-chat.ts`
- **描述**：添加 LLM API 错误、网络超时、Mermaid 语法错误的处理逻辑
- **依赖**：Task 5.1
- **估计复杂度**：中

### Task 5.3: 添加边界情况处理

- **类型**：实现
- **文件**：`packages/drawnix/src/llm-mermaid/utils/message-validator.ts`
- **描述**：添加超长对话、空输入、节点过多等边界情况的处理
- **依赖**：Task 5.2
- **估计复杂度**：中

### Task 5.4: 添加国际化文本

- **类型**：实现
- **文件**：`packages/drawnix/src/i18n/zh-CN.json`
- **描述**：添加所有 UI 文本的中文翻译
- **依赖**：Task 5.3
- **估计复杂度**：低

### Task 5.5: 编写端到端测试

- **类型**：测试
- **文件**：`apps/web-e2e/tests/llm-mermaid.spec.ts`
- **描述**：编写完整用户流程的 E2E 测试
- **依赖**：Task 5.4
- **估计复杂度**：高

### Task 5.6: 添加服务文档 [P]

- **类型**：文档
- **文件**：`packages/drawnix/src/llm-mermaid/services/README.md`
- **描述**：编写服务层的 API 文档和使用示例
- **依赖**：Task 5.4
- **估计复杂度**：低

### Task 5.7: 添加类型文档 [P]

- **类型**：文档
- **文件**：`packages/drawnix/src/llm-mermaid/types/README.md`
- **描述**：编写核心类型的说明文档
- **依赖**：Task 5.4
- **估计复杂度**：低

### Task 5.8: 添加 Hooks 文档 [P]

- **类型**：文档
- **文件**：`packages/drawnix/src/llm-mermaid/hooks/README.md`
- **描述**：编写自定义 Hooks 的使用文档
- **依赖**：Task 5.4
- **估计复杂度**：低

### Task 5.9: 添加组件文档 [P]

- **类型**：文档
- **文件**：`packages/drawnix/src/llm-mermaid/components/README.md`
- **描述**：编写 UI 组件的使用文档
- **依赖**：Task 5.4
- **估计复杂度**：低

### Task 5.10: 添加功能主文档

- **类型**：文档
- **文件**：`packages/drawnix/src/llm-mermaid/README.md`
- **描述**：编写整体功能介绍、架构说明和快速开始指南
- **依赖**：Task 5.6, Task 5.7, Task 5.8, Task 5.9
- **估计复杂度**：中

---

## 执行顺序

```
Phase 1: 基础设施搭建
Task 1.1 ──► ┌─► Task 1.2 [P] ──┐
           │                    ├─► Task 1.5 ──► Task 1.12 ──► Task 1.13
           ├─► Task 1.3 [P] ──┤                  │
           │                    └───────────────┘
           ├─► Task 1.4 [P] ──┘
           │
           ├─► Task 1.6 ──► Task 1.8 ──► Task 1.9
           │
           └─► Task 1.7 ──┘
           │
           Task 1.10
           │
           Task 1.11 ──┘
                                                            │
Phase 2: 核心服务实现 (TDD)                                 │
┌──────────────────────────────────────────────────────────┴────────┐
│                                                                 │
Task 1.5 ──► Task 2.1 [P] ──► Task 2.2                          │
           │                                                      │
           ├─► Task 2.3 [P] ──► Task 2.4 ──► Task 2.11 ──► Task 2.12
           │                                                      │
           ├─► Task 2.5 [P] ──► Task 2.6 ──► Task 2.13 ──► Task 2.14
           │                                                      │
           ├─► Task 2.7 [P] ──► Task 2.8                         │
           │                                                      │
           └─► Task 2.9 [P] ──► Task 2.10                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                                            │
Phase 3: UI 组件开发 (TDD)                                     │
┌──────────────────────────────────────────────────────────┴────────┐
│                                                                 │
Task 1.5 ──► Task 3.1 [P] ──► Task 3.2 ──► Task 3.3 ──► Task 3.4 ─┐
           │                                                     │
           ├─► Task 3.5 [P] ──► Task 3.6                         │
           │                                                     │
           ├─► Task 3.7 [P] ──► Task 3.8                         │
           │                          │                          │
Task 2.12 ──────────────────────────┴─► Task 3.9 ──► Task 3.10    │
           │                                                     │
           │   Task 3.11 [P] ──► Task 3.12 ──┐                   │
           │                                 │                   │
Task 2.14 ────────► Task 3.13 [P] ──► Task 3.14 ─┴─► Task 3.15 ──► Task 3.16 ─┐
           │                                                             │          │
           └─────────────────────────────────────────────────────────────┴─► Task 3.17
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                                            │
Phase 4: 样式优化功能 (TDD)                                   │
Task 2.4 ──► Task 4.1 ──► Task 4.2 ──► Task 4.3 ──► Task 4.4 ──┐
           │                                                 │
           └────────────────────────────────► Task 4.5 ────┴─► Task 4.6
                                                            │
Phase 5: 集成、测试与文档                                    │
Task 3.17 ──► Task 5.1 ──► Task 5.2 ──► Task 5.3 ──► Task 5.4 ──┐
           │                                                 │
           └─► Task 5.5                                ┌─► Task 5.6 [P]
                                                      │
                                                      ├─► Task 5.7 [P] ──┐
                                                      │                  │
                                                      ├─► Task 5.8 [P] ─┴─► Task 5.10
                                                      │
                                                      └─► Task 5.9 [P] ──┘
```

---

## 检查点

- [ ] **检查点 1**：Phase 1 完成后 - 验证目录结构、类型定义、按钮和对话框骨架
- [ ] **检查点 2**：Phase 2 完成后 - 验证所有核心服务测试通过，LLM 调用和转换功能正常
- [ ] **检查点 3**：Phase 3 完成后 - 验证所有 UI 组件测试通过，基本交互流程可用
- [ ] **检查点 4**：Phase 4 完成后 - 验证样式优化功能正常，样式应用正确
- [ ] **检查点 5**：Phase 5 完成后 - 验证 E2E 测试通过，文档完整

---

## 用户故事映射

| 用户故事 | 相关任务 |
|---------|----------|
| Story 1：通过对话生成 Pipeline 图 | Task 1.1-1.13, Task 2.1-2.14, Task 3.1-3.17 |
| Story 2：AI 驱动的样式优化 | Task 4.1-4.6 |
| Story 3：插入主画板 | Task 5.1-5.3 |

---

## 复杂度统计

| 复杂度 | 任务数 |
|--------|--------|
| 低 | 27 |
| 中 | 26 |
| 高 | 9 |

---

*文档版本：1.0*
*创建日期：2026-03-15*
