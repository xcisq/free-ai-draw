# 功能：XAI Board UI 定制化

## 概述

对 XAI Board 白板工具进行深度的 UI 定制，包括应用界面 Logo 显示、欢迎介绍页品牌化、以及菜单栏头部定制，打造完整的 XAI 课题组品牌形象。

## 目标

- 在应用界面左上角显示 XAI Logo
- 定制欢迎介绍页，展示 XAI 品牌形象和介绍
- 在下拉菜单顶部添加 XAI Logo 和课题组信息
- 移除原有的 GitHub 链接，替换为 XAI 相关内容

## 用户故事

### 故事 1：应用 Logo 显示

**作为** XAI 课题组成员
**我想要** 在画布界面左上角看到 XAI Logo
**以便于** 随时识别这是 XAI 课题组的专业工具

**验收标准：**
- [ ] 应用界面左上角显示 XAI Logo
- [ ] Logo 大小适中，不遮挡工具栏
- [ ] Logo 在深色/浅色模式下都清晰可见

### 故事 2：欢迎页品牌化

**作为** XAI 课题组成员
**我想要** 首次进入应用时看到 XAI 品牌的欢迎页面
**以便于** 感受到这是专为课题组定制的工具

**验收标准：**
- [ ] 欢迎页顶部显示 XAI Logo 图形
- [ ] 标题显示 "XAI Board"
- [ ] 描述文字介绍 "XAI 课题组专用绘图工具"
- [ ] 保持原有的功能指引箭头和说明

### 故事 3：菜单栏定制

**作为** XAI 课题组成员
**我想要** 打开菜单时看到 XAI Logo 和课题组信息
**以便于** 强化品牌认知

**验收标准：**
- [ ] 菜单顶部显示 XAI Logo
- [ ] Logo 下方显示 "XAI Board" 和 "XAI 课题组"
- [ ] 原 GitHub 链接被移除或替换
- [ ] 菜单项布局保持整洁

## 功能需求

- [REQ-001] 在应用界面左上角添加 XAI Logo 显示组件
- [REQ-002] 定制欢迎介绍页组件，添加 XAI Logo 图形
- [REQ-003] 更新欢迎页标题为 "XAI Board"
- [REQ-004] 更新欢迎页描述为 XAI 课题组相关文案
- [REQ-005] 在下拉菜单顶部添加 XAI Logo 和品牌信息区域
- [REQ-006] 移除或替换菜单中的 GitHub 链接
- [REQ-007] 添加 XAI Logo 资源文件（SVG 格式）
- [REQ-008] 更新 i18n 国际化文件中的相关文案

## 非功能需求

- [NFR-001] UI 更改不影响现有绘图功能
- [NFR-002] Logo 显示响应式适配移动端
- [NFR-003] 欢迎页在不同屏幕尺寸下正常显示
- [NFR-004] 菜单头部区域样式与现有菜单风格一致

## 验收标准（测试用例）

- [TC-001] 应用界面左上角正确显示 XAI Logo
- [TC-002] 欢迎页显示 XAI Logo 图形
- [TC-003] 欢迎页标题为 "XAI Board"
- [TC-004] 欢迎页描述为 "XAI 课题组专用绘图工具"
- [TC-005] 菜单顶部显示 XAI Logo 和品牌信息
- [TC-006] 菜单中不显示 GitHub 链接
- [TC-007] 深色模式下所有 Logo 和文字清晰可见
- [TC-008] 移动端响应式布局正常

## 边界情况

- **Logo 文件缺失**：当 Logo 文件加载失败时，显示文字替代或使用默认图标
- **小屏幕设备**：Logo 尺寸需要自适应，避免过大
- **极长菜单项文字**：品牌信息区域不应影响菜单项的滚动和显示

## 设计规范

### 欢迎页文案

```typescript
{
  title: "XAI Board",
  description: "XAI 课题组专用绘图工具",
  dataDescription: "支持思维导图、流程图等多种绘图方式，数据本地存储，安全可靠。"
}
```

### 菜单头部设计

```
┌─────────────────────────┐
│                         │
│      [XAI Logo]         │
│                         │
│      XAI Board          │
│      XAI 课题组          │
│                         │
│   ─────────────────────  │
│                         │
│   打开文件               │
│   保存文件               │
│   ...                   │
└─────────────────────────┘
```

### 应用左上角 Logo

- 位置：画布左上角，固定定位
- 尺寸：建议 32x32px 或 40x40px
- 透明度：80%-90%，避免过于突出

## 范围外

- **核心绘图功能**：不修改 Plait 框架的绘图引擎
- **工具栏样式**：不重新设计工具栏组件样式
- **欢迎页交互逻辑**：不修改欢迎页的显示/隐藏逻辑
- **其他语言版本**：优先实现中文版，其他语言可后续添加

## 文件更改清单

| 文件路径 | 更改类型 | 说明 |
|---------|---------|------|
| `packages/drawnix/src/components/tutorial.tsx` | 修改 | 添加 Logo 组件引用 |
| `packages/drawnix/src/components/tutorial.scss` | 修改 | 添加 Logo 样式 |
| `packages/drawnix/src/components/toolbar/app-toolbar/app-menu-items.tsx` | 修改 | 添加菜单头部组件，移除 GitHub |
| `packages/drawnix/src/components/toolbar/app-toolbar/app-toolbar.tsx` | 修改 | 添加应用 Logo 显示 |
| `packages/drawnix/src/i18n/zh-CN.ts` | 修改 | 更新欢迎页文案 |
| `packages/drawnix/src/components/app-logo/` | 新建 | Logo 组件目录 |
| `packages/drawnix/src/components/app-logo/app-logo.tsx` | 新建 | Logo 组件 |
| `packages/drawnix/src/components/app-logo/app-logo.scss` | 新建 | Logo 样式 |
| `apps/web/public/logo/xai-small.svg` | 新建 | 小尺寸 Logo（可选） |

## 设计资源需求

- **XAI Logo**：需要以下规格的 Logo 文件
  - 标准版 SVG（已有 `xai.svg`）
  - 小尺寸 SVG（用于应用角落，可选）

---

*此规格文档遵循 CodexSpec SDD 方法论生成*
