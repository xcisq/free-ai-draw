# 实现计划：XAI Board UI 定制化

## 1. 技术栈

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 语言 | TypeScript | ~5.4.2 | 项目主要开发语言 |
| 框架 | React | 19.2.0 | UI 框架 |
| 样式 | SCSS | - | 样式预处理器 |
| 国际化 | 自定义 I18n | - | 基于 React Context 的多语言系统 |
| 图标 | SVG | - | XAI Logo 以 SVG 格式存储 |
| 构建工具 | Vite | ^6.2.2 | 前端构建工具 |

## 2. 宪法合规性审查

| 原则 | 合规性 | 说明 |
|------|--------|------|
| 1. 代码质量 | ✅ | 新建组件遵循现有模式，代码结构清晰 |
| 2. 测试标准 | ✅ | UI 组件更改，通过手动验证测试 |
| 3. 文档 | ✅ | 规格和计划文档即作为更改记录 |
| 4. 架构 | ✅ | 遵循现有组件结构和命名约定 |
| 5. 性能 | ✅ | Logo 使用 SVG 格式，轻量高效 |
| 6. 安全 | ✅ | 不涉及敏感数据处理，仅 UI 更改 |

## 3. 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      XAI Board 应用界面                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 应用左上角    │  │  欢迎介绍页  │  │  下拉菜单    │       │
│  │  Logo 组件    │  │  (Tutorial)  │  │  (App Menu)  │       │
│  │              │  │              │  │              │       │
│  │  AppLogo     │  │  + XAI Logo  │  │  + 品牌头部  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              i18n 翻译系统 (zh.ts)                    │    │
│  │  - 更新 tutorial.title/description                    │    │
│  │  - 更新菜单相关文案                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 4. 组件结构

```
packages/drawnix/src/
├── components/
│   ├── app-logo/               [新建] Logo 组件目录
│   │   ├── app-logo.tsx        [新建] 可复用的 Logo 组件
│   │   ├── app-logo.scss       [新建] Logo 样式
│   │   └── index.ts            [新建] 导出文件
│   ├── tutorial.tsx            [修改] 欢迎页添加 Logo
│   ├── tutorial.scss           [修改] 欢迎页样式更新
│   └── toolbar/
│       └── app-toolbar/
│           ├── app-toolbar.tsx       [修改] 添加左上角 Logo
│           └── app-menu-items.tsx   [修改] 添加菜单头部，移除 GitHub
└── i18n/
    └── translations/
        └── zh.ts                 [修改] 更新欢迎页文案
```

## 5. 模块依赖图

```
┌──────────────────────┐
│    AppLogo 组件       │
│  (可复用 Logo 组件)    │
└──────────┬───────────┘
           │
           │ 被引用
           ▼
┌─────────────────────────────────────────────────────┐
│                                                  │
│   ┌──────────────┐     ┌──────────────┐          │
│   │ AppToolbar   │     │  Tutorial    │          │
│   │ (左上角 Logo)  │     │  (欢迎页)     │          │
│   └──────────────┘     └──────────────┘          │
│                          │                        │
│   ┌──────────────┐       │                        │
│   │  AppMenu     │◄──────┘                        │
│   │ (菜单头部)    │                                │
│   └──────────────┘                                │
│                                                  │
└─────────────────────────────────────────────────────┘
           │
           │ 使用
           ▼
┌──────────────────────┐
│   i18n 翻译系统        │
│   (zh.ts 文案更新)     │
└──────────────────────┘
```

## 6. 模块规格

### 模块：AppLogo 组件
- **职责**：可复用的 XAI Logo 显示组件，支持不同尺寸和样式
- **依赖**：React, SCSS
- **接口**：
  ```typescript
  interface AppLogoProps {
    size?: 'small' | 'medium' | 'large';
    className?: string;
  }
  ```
- **文件**：
  - `packages/drawnix/src/components/app-logo/app-logo.tsx`
  - `packages/drawnix/src/components/app-logo/app-logo.scss`
  - `packages/drawnix/src/components/app-logo/index.ts`

### 模块：Tutorial 组件修改
- **职责**：欢迎介绍页，显示 XAI 品牌信息
- **依赖**：i18n, AppLogo 组件
- **接口**：无变化
- **文件**：
  - `packages/drawnix/src/components/tutorial.tsx` - 添加 Logo 组件引用
  - `packages/drawnix/src/components/tutorial.scss` - 添加 Logo 样式

### 模块：AppToolbar 组件修改
- **职责**：应用顶部工具栏，添加左上角 Logo 显示
- **依赖**：AppLogo 组件
- **接口**：无变化
- **文件**：
  - `packages/drawnix/src/components/toolbar/app-toolbar/app-toolbar.tsx`

### 模块：AppMenuItems 组件修改
- **职责**：应用菜单项，添加品牌头部区域
- **依赖**：AppLogo 组件, i18n
- **接口**：新增 MenuBrandHeader 组件
- **文件**：
  - `packages/drawnix/src/components/toolbar/app-toolbar/app-menu-items.tsx`

### 模块：i18n 翻译文件
- **职责**：多语言文案配置
- **依赖**：Types 定义
- **接口**：Translations 接口
- **文件**：
  - `packages/drawnix/src/i18n/translations/zh.ts` - 更新欢迎页文案
  - `packages/drawnix/src/i18n/types.ts` - 可能需要新增品牌相关键

## 7. 数据模型

### i18n 翻译键更新

| 键名 | 原值 | 新值 |
|------|------|------|
| `tutorial.title` | 'Drawnix' | 'XAI Board' |
| `tutorial.description` | 'All-in-one 白板...' | 'XAI 课题组专用绘图工具' |
| `tutorial.dataDescription` | '所有数据被存在...' | '支持思维导图、流程图等多种绘图方式，数据本地存储，安全可靠。' |
| `menu.github` | 'GitHub' | (移除或改为 'XAI 课题组') |

## 8. 组件设计规范

### AppLogo 组件

```typescript
// packages/drawnix/src/components/app-logo/app-logo.tsx
import React from 'react';
import './app-logo.scss';

export interface AppLogoProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'light' | 'dark';
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'medium',
  variant = 'default',
  className = ''
}) => {
  return (
    <div className={`app-logo app-logo--${size} app-logo--${variant} ${className}`}>
      <img src="/logo/xai.svg" alt="XAI Logo" />
    </div>
  );
};
```

### 样式规范

```scss
// packages/drawnix/src/components/app-logo/app-logo.scss
.app-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  &--small {
    width: 24px;
    height: 24px;
  }

  &--medium {
    width: 48px;
    height: 48px;
  }

  &--large {
    width: 80px;
    height: 80px;
  }

  &--light {
    opacity: 0.9;
  }

  &--dark {
    opacity: 1;
    filter: brightness(0) invert(1);
  }
}
```

### 菜单头部组件

```typescript
// packages/drawnix/src/components/toolbar/app-toolbar/app-menu-items.tsx
export const MenuBrandHeader = () => {
  return (
    <div className="menu-brand-header">
      <AppLogo size="medium" />
      <div className="brand-info">
        <div className="brand-name">XAI Board</div>
        <div className="brand-subtitle">XAI 课题组</div>
      </div>
    </div>
  );
};
```

## 9. 实现阶段

### 阶段 1：基础组件创建
- [ ] 创建 AppLogo 组件及其样式文件
- [ ] 创建 AppLogo 导出文件
- [ ] 更新 i18n Types 定义（如需要）

### 阶段 2：欢迎页定制
- [ ] 在 Tutorial 组件中引入 AppLogo
- [ ] 更新 Tutorial 组件布局，添加 Logo 显示区域
- [ ] 更新 tutorial.scss 添加 Logo 样式
- [ ] 更新 zh.ts 翻译文件中的欢迎页文案

### 阶段 3：应用左上角 Logo
- [ ] 在 AppToolbar 组件中引入 AppLogo
- [ ] 添加固定定位的 Logo 到左上角
- [ ] 添加响应式样式适配移动端

### 阶段 4：菜单栏定制
- [ ] 创建 MenuBrandHeader 组件
- [ ] 更新 AppToolbar 菜单结构，添加头部组件
- [ ] 移除或替换 Socials (GitHub) 组件
- [ ] 更新菜单样式，添加分隔线

### 阶段 5：测试验证
- [ ] 启动开发服务器验证欢迎页显示
- [ ] 验证应用左上角 Logo 显示
- [ ] 验证菜单头部 Logo 和品牌信息
- [ ] 验证深色模式下的显示效果
- [ ] 验证移动端响应式布局
- [ ] 执行构建验证无错误

## 10. 技术决策

### 决策 1：Logo 组件复用性
- **选择**：创建独立的 AppLogo 组件，支持多种尺寸和变体
- **理由**：避免代码重复，便于统一管理 Logo 显示
- **替代方案**：在各组件中直接使用 `<img>` 标签
- **权衡**：增加了一个组件文件，但提高了可维护性

### 决策 2：Logo 资源路径
- **选择**：使用 `/logo/xai.svg` 作为统一的 Logo 资源路径
- **理由**：与之前的品牌定制保持一致，资源已存在于 `apps/web/public/logo/`
- **替代方案**：将 Logo 放在 `packages/drawnix/assets/` 目录
- **权衡**：需要确保资源路径在构建后正确解析

### 决策 3：菜单头部位置
- **选择**：将品牌头部放在菜单最顶部，使用分隔线与菜单项分开
- **理由**：符合常见的 UI 设计模式，品牌识别度最高
- **替代方案**：将品牌信息放在菜单底部
- **权衡**：顶部位置更突出，但占用菜单项上方空间

### 决策 4：GitHub 链接处理
- **选择**：完全移除 GitHub 链接项
- **理由**：XAI Board 是内部工具，不需要指向外部仓库
- **替代方案**：替换为 XAI 课题组官网链接
- **权衡**：如后续需要添加外部链接，可轻松恢复

### 决策 5：应用左上角 Logo 显示
- **选择**：使用固定定位（fixed positioning）在画布左上角
- **理由**：不随画布滚动而移动，始终保持可见
- **替代方案**：使用绝对定位，随工具栏一起布局
- **权衡**：固定定位需要处理与工具栏的层级关系

## 11. 样式规范

### 欢迎页 Logo 样式

```scss
// tutorial.scss 新增内容
.tutorial-content {
  // 原有样式...

  .tutorial-logo {
    width: 80px;
    height: 80px;
    margin-bottom: 20px;

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }
}
```

### 菜单头部样式

```scss
// 新增样式文件或添加到现有样式
.menu-brand-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  gap: 8px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);

  .brand-info {
    text-align: center;
  }

  .brand-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color, #333);
  }

  .brand-subtitle {
    font-size: 12px;
    color: var(--text-secondary, #666);
  }
}
```

### 应用左上角 Logo 样式

```scss
// app-toolbar 中的样式
.app-logo-corner {
  position: fixed;
  top: 16px;
  left: 16px;
  width: 32px;
  height: 32px;
  pointer-events: none;
  opacity: 0.85;
  z-index: 100;
}
```

## 12. 验收检查清单

- [ ] AppLogo 组件创建成功，支持多种尺寸
- [ ] 欢迎页显示 XAI Logo 图形
- [ ] 欢迎页标题为 "XAI Board"
- [ ] 欢迎页描述为 "XAI 课题组专用绘图工具"
- [ ] 应用左上角显示 XAI Logo
- [ ] 菜单顶部显示 Logo 和品牌信息
- [ ] 菜单中不显示 GitHub 链接
- [ ] 深色模式下所有元素正常显示
- [ ] 移动端布局正常
- [ ] 构建成功无错误

---

*此实现计划遵循 CodexSpec SDD 方法论生成*
