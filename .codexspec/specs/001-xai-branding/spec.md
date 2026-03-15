# 功能：XAI 课题组品牌定制

## 概述

将 Drawnix 开源白板工具重新品牌为 XAI 课题组专用绘图工具。通过替换所有品牌标识、Logo、元数据和存储配置，创建一个具有 XAI 课题组独特身份的专业绘图工具。

## 目标

- 建立独立的 XAI 课题组品牌形象
- 移除所有 Drawnix 原有品牌信息
- 保持核心绘图功能完整性
- 确保存储配置与新品牌隔离
- 提供可识别的视觉标识

## 用户故事

### 故事 1：品牌识别

**作为** XAI 课题组成员
**我想要** 在应用中看到 XAI 课题组的 Logo 和品牌信息
**以便于** 识别这是专为课题组使用的工具

**验收标准：**
- [ ] 应用标题显示 "XAI Board" 或 "XAI 课题组绘图工具"
- [ ] 浏览器标签页显示正确的品牌名称
- [ ] 所有页面元数据反映 XAI 品牌信息

### 故事 2：Logo 替换

**作为** XAI 课题组成员
**我想要** 看到 XAI 课题组的 Logo 而非 Drawnix Logo
**以便于** 建立品牌一致性

**验收标准：**
- [ ] 应用顶部 Logo 替换为 XAI Logo
- [ ] 深色模式下显示对应的深色版本 Logo
- [ ] 浏览器 favicon 使用 XAI 图标

### 故事 3：数据隔离

**作为** XAI 课题组成员
**我想要** 我的数据存储与原版 Drawnix 分离
**以便于** 避免数据混淆

**验收标准：**
- [ ] LocalStorage/IndexedDB 使用新的存储键名
- [ ] 数据文件扩展名考虑使用 `.xaiboard` 或保持 `.drawnix` 但内部标识不同

## 功能需求

- [REQ-001] HTML 页面标题更新为 "XAI Board - XAI 课题组绘图工具"
- [REQ-002] 所有 meta 描述和关键词更新为 XAI 课题组相关内容
- [REQ-003] 替换 `/public/logo/` 下的 SVG Logo 文件
- [REQ-004] 替换 `/public/favicon.ico` 为 XAI 图标
- [REQ-005] 更新 JSON-LD 结构化数据中的品牌信息
- [REQ-006] 更新 localforage 配置的数据库名称和存储名称
- [REQ-007] 更新 Open Graph 和 Twitter Card 元标签
- [REQ-008] 移除或更新 Umami 分析脚本的数据站点 ID
- [REQ-009] 更新 canonical URL 和 alternate 语言链接
- [REQ-010] 更新 package.json 中的项目名称和描述

## 非功能需求

- [NFR-001] 更改不影响核心绘图功能
- [NFR-002] 现有用户数据可通过适当方式迁移
- [NFR-003] 页面加载性能不受影响
- [NFR-004] SEO 元数据符合搜索引擎最佳实践
- [NFR-005] 更改后可通过标准构建流程正常部署

## 验收标准（测试用例）

- [TC-001] 浏览器标签页显示 "XAI Board" 标题
- [TC-002] 页面源代码中所有 "Drawnix" 引用已更新（除代码注释外）
- [TC-003] Logo 文件存在且可访问（`/logo/logo_xai_h.svg`）
- [TC-004] 深色模式 Logo 存在且可访问（`/logo/logo_xai_h_dark.svg`）
- [TC-005] Favicon 正确显示
- [TC-006] LocalStorage/IndexedDB 数据库名称为 "XAIBoard" 或类似
- [TC-007] 构建产物不包含原 Drawnix 品牌资源
- [TC-008] 社交媒体分享预览显示 XAI 品牌信息
- [TC-009] 所有功能（绘图、保存、导出）正常工作

## 边界情况

- **现有数据迁移**：如果用户已有使用原版 Drawnix 保存的数据，需要提供导入说明或迁移工具
- **深色模式切换**：确保 Logo 在深色/浅色模式下都能正确显示
- **浏览器缓存**：更改后需要清除浏览器缓存才能看到新的 favicon 和图标
- **SEO 影响**：更改 canonical URL 可能影响搜索引擎索引，需要配置适当的重定向

## 输出示例

### HTML Title 更改
```html
<!-- 更改前 -->
<title>Drawnix - 开源白板工具</title>

<!-- 更改后 -->
<title>XAI Board - XAI 课题组绘图工具</title>
```

### Meta 描述更改
```html
<!-- 更改前 -->
<meta name="description" content="Drawnix 是一款强大的开源白板工具...">

<!-- 更改后 -->
<meta name="description" content="XAI Board 是 XAI 课题组专用绘图工具，支持思维导图、流程图等功能。">
```

### Localforage 配置更改
```typescript
// 更改前
localforage.config({
  name: 'Drawnix',
  storeName: 'drawnix_store',
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
});

// 更改后
localforage.config({
  name: 'XAIBoard',
  storeName: 'xai_board_store',
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
});
```

### JSON-LD 结构化数据更改
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "XAI Board",
  "alternateName": ["XAI课题组绘图工具", "XAI Research Whiteboard"],
  "creator": {
    "@type": "Organization",
    "name": "XAI Research Group"
  }
}
```

## 范围外

- **核心绘图功能**：不修改 Plait 框架和绘图引擎
- **UI 组件样式**：仅更改 Logo，不重新设计整个 UI
- **功能特性**：不添加或删除绘图功能
- **后端服务**：不涉及后端 API 更改（当前无后端）
- **第三方集成**：不更改第三方服务集成（如分析工具）
- **许可证更改**：不修改项目的开源许可证

## 文件更改清单

| 文件路径 | 更改类型 | 说明 |
|---------|---------|------|
| `apps/web/index.html` | 修改 | 更新 title, meta, JSON-LD |
| `apps/web/public/logo/logo_drawnix_h.svg` | 替换 | 替换为 XAI Logo（浅色） |
| `apps/web/public/logo/logo_drawnix_h_dark.svg` | 替换 | 替换为 XAI Logo（深色） |
| `apps/web/public/favicon.ico` | 替换 | 替换为 XAI favicon |
| `apps/web/src/app/app.tsx` | 修改 | 更新 localforage 配置 |
| `apps/web/package.json` | 修改 | 更新项目名称和描述 |
| `package.json` | 修改 | 更新项目名称（可选） |

## 设计资源需求

- **XAI Logo**：需要提供以下规格的 Logo 文件
  - `logo_xai_h.svg` - 水平布局 Logo，用于浅色背景
  - `logo_xai_h_dark.svg` - 水平布局 Logo，用于深色背景
  - `favicon.ico` - 网站图标，建议 32x32 或 48x48
  - 可选：Apple Touch Icon、PWA 图标

## 分支策略

- 创建新分支：`feature/xai-branding`
- 基于：`develop` 分支
- 合并目标：创建独立的 `xai-brand` 分支或合并回 `develop`

---

*此规格文档遵循 CodexSpec SDD 方法论生成*
