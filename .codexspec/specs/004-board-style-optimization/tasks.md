# 任务分解：画板 AI 样式优化增强

## 概览
- 总任务数：47
- 可并行任务：26
- 预估阶段数：5

## 用户故事映射

| 用户故事 | 任务范围 |
|----------|----------|
| Story 1: 在画板上继续优化样式 | Phase 1-4 |
| Story 2: 丰富的样式属性调节 | Phase 2-3 |
| Story 3: 多方案选择与继续生成 | Phase 2-3 |

---

## Phase 1: 基础设施

### Task 1.1: 创建画板样式类型定义文件
- **类型**: Setup
- **文件**: `packages/drawnix/src/llm-mermaid/types/board-style.ts`
- **描述**: 创建画板样式相关的 TypeScript 类型定义文件，包含 `ExtendedStyleScheme`、`StyleSchemeOption`、`ElementStyleMap`、`GradientConfig`、`ArrowStyleConfig`、`PaddingConfig`、`IconConfig` 等接口
- **依赖**: 无
- **复杂度**: Low
- **用户故事**: Story 2

### Task 1.2: 编写画板样式类型测试 [P]
- **类型**: Testing
- **文件**: `packages/drawnix/src/llm-mermaid/types/board-style.spec.ts`
- **描述**: 为画板样式类型编写单元测试，验证类型定义的正确性和默认值
- **依赖**: Task 1.1
- **复杂度**: Low
- **用户故事**: Story 2

### Task 1.3: 扩展现有 StyleScheme 类型
- **类型**: Implementation
- **文件**: `packages/drawnix/src/llm-mermaid/types/style.ts`
- **描述**: 修改现有 `StyleScheme` 接口，添加对新样式属性的支持（opacity, gradient, borderRadius, padding, lineStyle, arrowStyle, textAlign, verticalAlign, icon）
- **依赖**: Task 1.1
- **复杂度**: Low
- **用户故事**: Story 2

### Task 1.4: 扩展类型导出 [P]
- **类型**: Implementation
- **文件**: `packages/drawnix/src/llm-mermaid/types/index.ts`
- **描述**: 更新类型导出文件，添加新类型 `ExtendedStyleScheme`、`StyleSchemeOption`、`ElementStyleMap`、`GradientConfig`、`ArrowStyleConfig` 的导出
- **依赖**: Task 1.1, Task 1.3
- **复杂度**: Low
- **用户故事**: Story 1, Story 2

### Task 1.5: 创建 board-style-panel 组件目录结构
- **类型**: Setup
- **文件**: `packages/drawnix/src/llm-mermaid/components/board-style-panel/`
- **描述**: 创建画板样式优化面板组件目录，包括 index.tsx, index.scss, style-scheme-card.tsx, style-input.tsx, style-preview.tsx 的基础文件结构
- **依赖**: 无
- **复杂度**: Low
- **用户故事**: Story 1

### Task 1.6: 创建 context-menu 组件目录结构 [P]
- **类型**: Setup
- **文件**: `packages/drawnix/src/components/context-menu/`
- **描述**: 创建右键菜单组件目录，包括 index.tsx, index.scss, menu-items.tsx 的基础文件结构
- **依赖**: 无
- **复杂度**: Low
- **用户故事**: Story 1

### Task 1.7: 添加国际化翻译条目
- **类型**: Implementation
- **文件**: `packages/drawnix/src/i18n/translations/zh-CN.ts`
- **描述**: 添加画板样式优化相关的中文翻译条目，包括菜单项、按钮文本、提示信息等
- **依赖**: 无
- **复杂度**: Low
- **用户故事**: Story 1

---

## Phase 2: 核心服务 (TDD)

### Task 2.1: 编写样式应用工具测试
- **类型**: Testing
- **文件**: `packages/drawnix/src/llm-mermaid/utils/board-style-application.spec.ts`
- **描述**: 为样式应用工具编写单元测试，覆盖 `applyStyleToElements`、`createStyleSnapshot`、`restoreStyleSnapshot` 函数的各种场景
- **依赖**: Task 1.3, Task 1.4
- **复杂度**: Medium
- **用户故事**: Story 1

### Task 2.2: 实现样式应用工具
- **类型**: Implementation
- **文件**: `packages/drawnix/src/llm-mermaid/utils/board-style-application.ts`
- **描述**: 实现将样式应用到 Plait 元素的工具函数，包括应用样式、创建快照、恢复快照功能
- **依赖**: Task 2.1
- **复杂度**: High
- **用户故事**: Story 1

### Task 2.3: 扩展 prompt-templates 支持多样式方案生成
- **类型**: Implementation
- **文件**: `packages/drawnix/src/llm-mermaid/services/prompt-templates.ts`
- **描述**: 添加 `getBoardStyleMultipleSchemesPrompt` 函数，支持生成多个样式方案的提示词模板
- **依赖**: Task 1.3
- **复杂度**: Medium
- **用户故事**: Story 3

### Task 2.4: 编写 prompt-templates 扩展测试 [P]
- **类型**: Testing
- **文件**: `packages/drawnix/src/llm-mermaid/services/prompt-templates.spec.ts`
- **描述**: 为新增的多样式方案提示词模板函数编写单元测试
- **依赖**: Task 2.3
- **复杂度**: Low
- **用户故事**: Story 3

### Task 2.5: 编写画板样式服务测试
- **类型**: Testing
- **文件**: `packages/drawnix/src/llm-mermaid/services/board-style-service.spec.ts`
- **描述**: 为画板样式服务编写单元测试，覆盖 `generateMultipleSchemes` 方法的各种场景（成功、失败、空元素等）
- **依赖**: Task 2.3
- **复杂度**: Medium
- **用户故事**: Story 3

### Task 2.6: 实现画板样式服务
- **类型**: Implementation
- **文件**: `packages/drawnix/src/llm-mermaid/services/board-style-service.ts`
- **描述**: 实现 `BoardStyleService` 类，包含 `generateMultipleSchemes` 方法，调用 LLM 生成多个样式方案
- **依赖**: Task 2.5
- **复杂度**: High
- **用户故事**: Story 3

### Task 2.7: 编写样式应用器扩展测试 [P]
- **类型**: Testing
- **文件**: `packages/drawnix/src/llm-mermaid/utils/style-applier.spec.ts`
- **描述**: 为扩展的样式应用器编写测试，验证新增样式属性（gradient, borderRadius, opacity 等）的应用逻辑
- **依赖**: Task 1.3
- **复杂度**: Medium
- **用户故事**: Story 2

### Task 2.8: 扩展样式应用器支持新属性
- **类型**: Implementation
- **文件**: `packages/drawnix/src/llm-mermaid/utils/style-applier.ts`
- **描述**: 扩展现有 `style-applier` 工具，支持新样式属性的解析和应用
- **依赖**: Task 2.7
- **复杂度**: Medium
- **用户故事**: Story 2

### Task 2.9: 编写画板样式优化 Hook 测试
- **类型**: Testing
- **文件**: `packages/drawnix/src/llm-mermaid/hooks/use-board-style-optimization.spec.ts`
- **描述**: 为 `useBoardStyleOptimization` Hook 编写单元测试，覆盖状态管理、方案生成、应用、预览等功能
- **依赖**: Task 2.2, Task 2.6
- **复杂度**: High
- **用户故事**: Story 1, Story 3

### Task 2.10: 实现画板样式优化 Hook
- **类型**: Implementation
- **文件**: `packages/drawnix/src/llm-mermaid/hooks/use-board-style-optimization.ts`
- **描述**: 实现 `useBoardStyleOptimization` Hook，管理样式优化状态（schemes, isGenerating, error）和操作（generateSchemes, applyScheme, previewScheme, clearPreview）
- **依赖**: Task 2.9
- **复杂度**: High
- **用户故事**: Story 1, Story 3

---

## Phase 3: UI 组件 (TDD)

### Task 3.1: 编写样式方案卡片组件测试
- **类型**: Testing
- **文件**: `packages/drawnix/src/llm-mermaid/components/board-style-panel/style-scheme-card.spec.tsx`
- **描述**: 为 `StyleSchemeCard` 组件编写单元测试，验证渲染、点击、悬停等交互行为
- **依赖**: Task 1.5
- **复杂度**: Medium
- **用户故事**: Story 1, Story 3

### Task 3.2: 实现样式方案卡片组件
- **类型**: Implementation
- **文件**: `packages/drawnix/src/llm-mermaid/components/board-style-panel/style-scheme-card.tsx`
- **描述**: 实现 `StyleSchemeCard` 组件，展示单个样式方案的预览、名称和描述，支持点击应用和悬停预览
- **依赖**: Task 3.1
- **复杂度**: Medium
- **用户故事**: Story 1, Story 3

### Task 3.3: 编写样式输入组件测试 [P]
- **类型**: Testing
- **文件**: `packages/drawnix/src/llm-mermaid/components/board-style-panel/style-input.spec.tsx`
- **描述**: 为 `StyleInput` 组件编写单元测试，验证输入、提交、禁用状态等行为
- **依赖**: Task 1.5
- **复杂度**: Low
- **用户故事**: Story 1

### Task 3.4: 实现样式输入组件
- **类型**: Implementation
- **文件**: `packages/drawnix/src/llm-mermaid/components/board-style-panel/style-input.tsx`
- **描述**: 实现 `StyleInput` 组件，提供文本输入框和提交按钮，支持自然语言样式描述输入
- **依赖**: Task 3.3
- **复杂度**: Low
- **用户故事**: Story 1

### Task 3.5: 编写样式预览组件测试 [P]
- **类型**: Testing
- **文件**: `packages/drawnix/src/llm-mermaid/components/board-style-panel/style-preview.spec.tsx`
- **描述**: 为 `StylePreview` 组件编写单元测试，验证预览模式下的样式展示
- **依赖**: Task 1.5
- **复杂度**: Medium
- **用户故事**: Story 1

### Task 3.6: 实现样式预览组件
- **类型**: Implementation
- **文件**: `packages/drawnix/src/llm-mermaid/components/board-style-panel/style-preview.tsx`
- **描述**: 实现 `StylePreview` 组件，在预览模式下展示样式效果（可选实现）
- **依赖**: Task 3.5
- **复杂度**: Medium
- **用户故事**: Story 1

### Task 3.7: 编写画板样式优化面板测试
- **类型**: Testing
- **文件**: `packages/drawnix/src/llm-mermaid/components/board-style-panel/index.spec.tsx`
- **描述**: 为 `BoardStylePanel` 主组件编写单元测试，验证整体布局、状态管理、子组件交互等
- **依赖**: Task 2.10, Task 3.2, Task 3.4
- **复杂度**: High
- **用户故事**: Story 1

### Task 3.8: 实现画板样式优化面板主组件
- **类型**: Implementation
- **文件**: `packages/drawnix/src/llm-mermaid/components/board-style-panel/index.tsx`
- **描述**: 实现 `BoardStylePanel` 主组件，整合 `StyleSchemeCard`、`StyleInput`、`StylePreview` 等子组件，管理整体布局和交互
- **依赖**: Task 3.7
- **复杂度**: High
- **用户故事**: Story 1

### Task 3.9: 实现画板样式优化面板样式
- **类型**: Implementation
- **文件**: `packages/drawnix/src/llm-mermaid/components/board-style-panel/index.scss`
- **描述**: 为 `BoardStylePanel` 组件编写 SCSS 样式，保持与现有 LLM Mermaid 对话框一致的视觉风格
- **依赖**: Task 3.8
- **复杂度**: Medium
- **用户故事**: Story 1

### Task 3.10: 编写右键菜单项测试 [P]
- **类型**: Testing
- **文件**: `packages/drawnix/src/components/context-menu/menu-items.spec.tsx`
- **描述**: 为右键菜单项组件编写单元测试，验证菜单项的显示、禁用状态、点击行为
- **依赖**: Task 1.6
- **复杂度**: Low
- **用户故事**: Story 1

### Task 3.11: 实现右键菜单项组件
- **类型**: Implementation
- **文件**: `packages/drawnix/src/components/context-menu/menu-items.tsx`
- **描述**: 实现右键菜单项组件，定义"AI 样式优化"菜单项及其子选项
- **依赖**: Task 3.10
- **复杂度**: Low
- **用户故事**: Story 1

### Task 3.12: 编写右键菜单容器测试 [P]
- **类型**: Testing
- **文件**: `packages/drawnix/src/components/context-menu/index.spec.tsx`
- **描述**: 为右键菜单容器组件编写单元测试，验证菜单的显示、隐藏、定位等行为
- **依赖**: Task 1.6
- **复杂度**: Medium
- **用户故事**: Story 1

### Task 3.13: 实现右键菜单容器组件
- **类型**: Implementation
- **文件**: `packages/drawnix/src/components/context-menu/index.tsx`
- **描述**: 实现右键菜单容器组件，处理菜单的显示、隐藏、定位逻辑
- **依赖**: Task 3.12
- **复杂度**: Medium
- **用户故事**: Story 1

### Task 3.14: 实现右键菜单样式
- **类型**: Implementation
- **文件**: `packages/drawnix/src/components/context-menu/index.scss`
- **描述**: 为右键菜单组件编写 SCSS 样式
- **依赖**: Task 3.13
- **复杂度**: Low
- **用户故事**: Story 1

---

## Phase 4: 插件集成

### Task 4.1: 编写样式优化插件测试
- **类型**: Testing
- **文件**: `packages/drawnix/src/plugins/with-board-style-optimization.spec.ts`
- **描述**: 为 `withBoardStyleOptimization` 插件编写单元测试，验证插件与 Plait Board 的集成
- **依赖**: Task 3.8
- **复杂度**: High
- **用户故事**: Story 1

### Task 4.2: 实现样式优化插件
- **类型**: Implementation
- **文件**: `packages/drawnix/src/plugins/with-board-style-optimization.ts`
- **描述**: 实现 `withBoardStyleOptimization` 插件，集成样式优化功能到 Plait Board，处理右键菜单事件和面板显示
- **依赖**: Task 4.1
- **复杂度**: High
- **用户故事**: Story 1

### Task 4.3: 创建样式应用 Transform
- **类型**: Implementation
- **文件**: `packages/drawnix/src/transforms/board-style.ts`
- **描述**: 创建 Plait Transform 用于应用样式变更，确保支持撤销/重做
- **依赖**: Task 2.2
- **复杂度**: Medium
- **用户故事**: Story 1

### Task 4.4: 将插件注册到 drawnix.tsx
- **类型**: Implementation
- **文件**: `packages/drawnix/src/drawnix.tsx`
- **描述**: 将 `withBoardStyleOptimization` 插件添加到 Plait 插件数组
- **依赖**: Task 4.2
- **复杂度**: Low
- **用户故事**: Story 1

### Task 4.5: 将面板集成到 Board 组件
- **类型**: Implementation
- **文件**: `packages/drawnix/src/drawnix.tsx`
- **描述**: 在 `Board` 组件中添加 `BoardStylePanel`，集成到属性面板区域
- **依赖**: Task 3.8, Task 4.2
- **复杂度**: Medium
- **用户故事**: Story 1

---

## Phase 5: 测试与文档

### Task 5.1: 编写 E2E 测试 - 基本流程
- **类型**: Testing
- **文件**: `apps/web-e2e/tests/board-style-optimization/basic.spec.ts`
- **描述**: 编写端到端测试，验证用户选中元素、右键点击、生成方案、应用样式的完整流程
- **依赖**: Task 4.5
- **复杂度**: High
- **用户故事**: Story 1

### Task 5.2: 编写 E2E 测试 - 多样式方案选择 [P]
- **类型**: Testing
- **文件**: `apps/web-e2e/tests/board-style-optimization/multiple-schemes.spec.ts`
- **描述**: 编写端到端测试，验证生成多个样式方案并进行选择的流程
- **依赖**: Task 4.5
- **复杂度**: Medium
- **用户故事**: Story 3

### Task 5.3: 编写 E2E 测试 - 自然语言样式调整 [P]
- **类型**: Testing
- **文件**: `apps/web-e2e/tests/board-style-optimization/natural-language.spec.ts`
- **描述**: 编写端到端测试，验证通过自然语言描述调整样式的流程
- **依赖**: Task 4.5
- **复杂度**: Medium
- **用户故事**: Story 1, Story 2

### Task 5.4: 编写 E2E 测试 - 撤销重做 [P]
- **类型**: Testing
- **文件**: `apps/web-e2e/tests/board-style-optimization/undo-redo.spec.ts`
- **描述**: 编写端到端测试，验证样式应用的撤销和重做功能
- **依赖**: Task 4.5
- **复杂度**: Medium
- **用户故事**: Story 1

### Task 5.5: 编写 E2E 测试 - 错误处理 [P]
- **类型**: Testing
- **文件**: `apps/web-e2e/tests/board-style-optimization/error-handling.spec.ts`
- **描述**: 编写端到端测试，验证各种错误场景（API 失败、无效样式、网络超时等）的处理
- **依赖**: Task 4.5
- **复杂度**: Medium
- **用户故事**: Story 1

### Task 5.6: 性能优化 - 大量元素场景
- **类型**: Optimization
- **文件**: `packages/drawnix/src/llm-mermaid/utils/board-style-application.ts`
- **描述**: 优化样式应用逻辑，确保处理大量元素（100+）时性能良好，添加批量处理和节流
- **依赖**: Task 2.2
- **复杂度**: High
- **用户故事**: Story 1

### Task 5.7: 更新 README 文档 [P]
- **类型**: Documentation
- **文件**: `README.md` 或相关文档文件
- **描述**: 更新项目 README，添加画板样式优化功能的使用说明
- **依赖**: Task 4.5
- **复杂度**: Low
- **用户故事**: Story 1, Story 2, Story 3

---

## 执行顺序

```
Phase 1: 基础设施
─────────────────────────────────────────────────────────────────────────────
Task 1.1 ──► Task 1.2 [P]
Task 1.1 ──► Task 1.3
Task 1.1 ──► Task 1.5
Task 1.1 ──► Task 1.6 [P]
Task 1.1 ──► Task 1.7 [P]
                    │
Task 1.1 + Task 1.3 ──► Task 1.4 [P]

Phase 2: 核心服务 (TDD)
─────────────────────────────────────────────────────────────────────────────
                    │
                    ▼
Task 1.3 + Task 1.4 ──► Task 2.1 ──► Task 2.2
Task 1.3 ─────────────► Task 2.3 [P] ──► Task 2.4 [P]
Task 1.3 ─────────────► Task 2.7 [P] ──► Task 2.8 [P]
                    │
                    ▼
Task 2.3 ────────────► Task 2.5 ──► Task 2.6
                    │
                    ▼
Task 2.2 + Task 2.6 ──► Task 2.9 ──► Task 2.10

Phase 3: UI 组件 (TDD)
─────────────────────────────────────────────────────────────────────────────
Task 1.5 ──► Task 3.1 ──► Task 3.2
Task 1.5 ──► Task 3.3 [P] ──► Task 3.4 [P]
Task 1.5 ──► Task 3.5 [P] ──► Task 3.6 [P]
Task 1.6 ──► Task 3.10 [P] ──► Task 3.11 [P]
Task 1.6 ──► Task 3.12 [P] ──► Task 3.13 ──► Task 3.14
                    │
                    ▼
Task 2.10 + Task 3.2 + Task 3.4 ──► Task 3.7 ──► Task 3.8 ──► Task 3.9

Phase 4: 插件集成
─────────────────────────────────────────────────────────────────────────────
                    │
                    ▼
Task 3.8 ───────────► Task 4.1 ──► Task 4.2
Task 2.2 ───────────► Task 4.3 [P]
                    │
                    ▼
Task 4.2 ───────────► Task 4.4
Task 3.8 + Task 4.2 ──► Task 4.5

Phase 5: 测试与文档
─────────────────────────────────────────────────────────────────────────────
                    │
                    ▼
Task 4.5 ──┬─► Task 5.1 ──► Task 5.6 [P]
          ├─► Task 5.2 [P]
          ├─► Task 5.3 [P]
          ├─► Task 5.4 [P]
          ├─► Task 5.5 [P]
          └─► Task 5.7 [P]
```

---

## 检查点

### Checkpoint 1: 基础设施完成
- [ ] 类型定义文件创建完成
- [ ] 组件目录结构创建完成
- [ ] 国际化翻译添加完成
- [ ] 所有类型测试通过

### Checkpoint 2: 核心服务完成
- [ ] 样式应用工具实现完成
- [ ] 画板样式服务实现完成
- [ ] Hook 实现完成
- [ ] 所有服务层测试通过

### Checkpoint 3: UI 组件完成
- [ ] 所有面板组件实现完成
- [ ] 右键菜单组件实现完成
- [ ] 所有组件测试通过

### Checkpoint 4: 插件集成完成
- [ ] 插件实现完成
- [ ] 集成到 drawnix.tsx
- [ ] Transform 支持撤销/重做
- [ ] 集成测试通过

### Checkpoint 5: 测试与文档完成
- [ ] 所有 E2E 测试通过
- [ ] 性能优化完成
- [ ] 文档更新完成
- [ ] 用户验收测试通过

---

## 并行任务矩阵

| 可并行任务组 | 包含任务 |
|-------------|----------|
| Phase 1 并行组 | Task 1.2, Task 1.4, Task 1.5, Task 1.6, Task 1.7 |
| Phase 2 并行组 A | Task 2.3, Task 2.7 |
| Phase 2 并行组 B | Task 2.4, Task 2.8 |
| Phase 3 并行组 A | Task 3.3, Task 3.5, Task 3.10, Task 3.12 |
| Phase 3 并行组 B | Task 3.4, Task 3.6, Task 3.11 |
| Phase 5 并行组 | Task 5.2, Task 5.3, Task 5.4, Task 5.5, Task 5.6, Task 5.7 |

---

*文档版本：1.0*
*创建日期：2026-03-15*
*关联规格：spec.md, plan.md*
