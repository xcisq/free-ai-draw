# Autodraw Scene 驱动 Drawnix 方案

> 版本：v1.0  
> 日期：2026-04-13  
> 状态：待评审  
> 适用范围：`autodraw/backend/**`、`packages/drawnix/src/autodraw/**`、`packages/drawnix/src/svg-import/**`、`packages/drawnix/src/data/**`

## 1. 文档定位

本文档定义 Autodraw 下一阶段的核心演进方向：

- 将后端产物的唯一事实源从 `final.svg` 升级为结构化 `scene.json`
- 由同一份 `scene.json` 正向编译出 `Drawnix` 编辑结果和 `SVG` 预览结果
- 逐步替代当前“`SVG -> 前端解析 -> Drawnix`”的逆向导入链路

本文档是以下工作的方案基线：

- 后端场景模型设计
- `bundle.zip` 协议升级
- 前端 `scene-import` 新链路设计
- 文本、箭头、图标等核心元素的正向编译策略
- 与现有 `svg-import` 的兼容与迁移策略

配套文档：

- [scene-schema-draft.json](file:///Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/autodraw/scene-schema-draft.json)
- [scene-field-mapping.md](file:///Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/autodraw/scene-field-mapping.md)

当前 `Autodraw` 的总体集成背景仍以：

- [drawnix-integration-plan.md](file:///Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/autodraw/drawnix-integration-plan.md)

为上位背景文档。本文档聚焦“产物模型与导入架构重置”。

## 2. 背景与问题

## 2.1 当前链路

当前 Autodraw 的主要产物链路如下：

1. 后端生成 `template.svg`
2. 后端将图标替换进模板，生成 `final.svg`
3. 后端打包 `bundle.zip`
4. 前端下载 `bundle.zip`
5. 前端解析 `final.svg + icons/*_nobg.png`
6. 前端把 SVG 反向转换成 Drawnix 元素并插入画板

当前链路的问题不在于“能不能出图”，而在于“导入后的编辑真相是谁”。

现在的编辑真相是：

- `final.svg`

而 Drawnix 只能作为：

- `final.svg` 的逆向消费方

这会导致：

- 文本排版依赖 SVG 反解析，难以稳定还原
- 箭头和组件语义依赖路径与节点猜测，稳定性不足
- 无法稳定表达的 SVG 内容只能降级为图片
- 一旦底图面积过大，可编辑率会明显下降

## 2.2 文字问题是核心瓶颈

文字是当前逆向导入路线中最难高保真的部分，原因包括：

- SVG 文本渲染依赖浏览器原生的字体、锚点、基线和变换模型
- `text-anchor`、`dominant-baseline`、`transform`、`getBBox()` 等属性都会影响最终位置
- Drawnix 的原生文本模型与 SVG 文本模型并不等价
- 即便字体名一致，基线、换行、字距、emoji fallback 也可能不同

这说明：

- 不能继续把 `SVG` 作为 Drawnix 编辑态的唯一事实源

## 2.3 架构判断

正确方向不是继续增强“SVG 逆向 importer”，而是重建一条正向链路：

1. 后端先生成结构化 `scene.json`
2. `scene.json` 作为唯一事实源
3. 再由编译器分别输出：
   - `Drawnix`
   - `SVG`

这样：

- Drawnix 不再从 SVG 猜语义
- SVG 只是视觉产物，不再是编辑真相

## 3. 目标与非目标

## 3.1 目标

本方案的目标是建立一条面向 Drawnix 的稳定产物链路：

1. 后端输出结构化 `scene.json`
2. `scene.json` 同时可编译为 `Drawnix` 和 `SVG`
3. 文本、容器、箭头、图标优先正向生成原生可编辑对象
4. Drawnix 无法稳定表达的局部内容允许降级为“局部 fragment”，而不是整图底图
5. 保持对现有 `bundle.zip` 和 `svg-import` 的兼容回退

## 3.2 非目标

当前阶段不优先处理：

- 让 LLM 直接输出最终 `PlaitElement[]`
- 一次性覆盖 Drawnix 的全部内部元素类型
- 完整替代所有 SVG 视觉能力
- 任意复杂 `path` 的通用可编辑还原
- 富文本 run 级完全编辑能力

## 4. 核心原则

- 单一事实源：编辑真相必须是 `scene.json`
- 双编译器：`scene -> Drawnix` 与 `scene -> SVG` 均为正向生成
- 结构优先：先保文本、容器、连线和组件语义，再补复杂视觉细节
- 局部降级：只允许局部 fragment，禁止整图大底图吞掉编辑能力
- 严格校验：所有 `scene.json` 必须通过 schema 校验与业务校验
- 平滑迁移：新链路必须可回退到现有 `svg-import`

## 5. 总体架构

目标链路如下：

1. `method_text + reference assets`
2. `layout / semantic / asset planning`
3. `scene.json`
4. `scene -> Drawnix compiler`
5. `scene -> SVG compiler`
6. `bundle.zip`
7. 前端优先消费 `scene.json`

其中：

- `scene.json` 是唯一事实源
- `Drawnix` 是编辑产物
- `SVG` 是预览与对照产物

## 5.1 模块职责

### 5.1.1 SceneBuilder

职责：

- 汇总布局、文本、图标、容器、连线等结构
- 生成未归一化的场景描述

### 5.1.2 SceneNormalizer

职责：

- 统一单位、颜色、字体、默认值
- 规范元素边界、层级和样式 token

### 5.1.3 SceneValidator

职责：

- 执行 JSON Schema 校验
- 执行业务规则校验
- 检查资源引用、元素唯一性和关系闭合性

### 5.1.4 SceneToDrawnixCompiler

职责：

- 将 `scene.json` 编译为 `DrawnixExportedData` 或 `PlaitElement[]`
- 优先生成原生可编辑对象

### 5.1.5 SceneToSvgCompiler

职责：

- 将 `scene.json` 编译为 `template.svg` 与 `final.svg`
- 保留当前系统已有的高保真视觉预览能力

### 5.1.6 BundleAssembler

职责：

- 组织 `scene.json / manifest.json / SVG / assets`
- 输出稳定的 `bundle.zip`

## 6. Scene 文件格式

## 6.1 顶层结构

建议首版 `scene.json` 采用：

```json
{
  "type": "drawnix-scene",
  "version": "1.0.0",
  "source": {
    "jobId": "20260413_125746_20de10bd",
    "generator": "autodraw-backend",
    "pipelineVersion": "v1"
  },
  "canvas": {
    "width": 1765,
    "height": 608,
    "background": "#ffffff"
  },
  "theme": {
    "preset": "academic",
    "tokens": {}
  },
  "assets": [],
  "elements": [],
  "metadata": {}
}
```

## 6.2 顶层字段说明

- `type`
  - 固定为 `drawnix-scene`
- `version`
  - `scene schema` 版本
- `source`
  - 记录作业、生成器与 pipeline 来源
- `canvas`
  - 画布尺寸与背景
- `theme`
  - 主题预设与样式 token
- `assets`
  - 外部资源清单
- `elements`
  - 场景元素列表
- `metadata`
  - 调试与编译附加信息

## 6.3 元素类型

首版建议仅支持以下元素：

- `text`
- `shape`
- `image`
- `connector`
- `group`
- `fragment`
- `frame`

这样可以覆盖当前 Autodraw 的大部分核心图表需求，同时控制复杂度。

## 7. 元素模型设计

## 7.1 text

用途：

- 普通标题
- 正文标签
- 容器内文案
- 说明性文字

建议字段：

- `id`
- `kind = "text"`
- `text`
- `layout`
- `style`
- `editing`
- `metadata`

其中 `layout` 至少包含：

- `x`
- `y`
- `width`
- `height`
- `anchor`
- `baseline`
- `rotation`
- `wrapMode`

其中 `style` 至少包含：

- `fontFamily`
- `fontSize`
- `fontWeight`
- `fontStyle`
- `fill`
- `stroke`
- `strokeWidth`
- `lineHeight`
- `letterSpacing`

其中 `editing.mode` 建议支持：

- `native-text`
- `native-text-in-shape`
- `svg-fragment-text`

## 7.2 shape

用途：

- 矩形
- 圆角矩形
- 圆
- 菱形
- 一般几何容器

建议字段：

- `id`
- `kind = "shape"`
- `shapeType`
- `bounds`
- `style`
- `textRef`

首版 `shapeType` 建议仅支持：

- `rectangle`
- `round-rectangle`
- `ellipse`
- `diamond`
- `text`

## 7.3 image

用途：

- 图标组件
- 去背景后的位图资源
- 外部示意图块

建议字段：

- `id`
- `kind = "image"`
- `assetRef`
- `layout`
- `editing`

其中：

- `editing.mode = "native-image"`
- `editing.replaceable = true`

## 7.4 connector

用途：

- 主干连线
- 分支连线
- 反馈线
- 注释性箭头

建议字段：

- `id`
- `kind = "connector"`
- `from`
- `to`
- `routing`
- `style`
- `semanticRole`

其中：

- `from.elementId / to.elementId` 是显式绑定关系
- `routing.points` 用于保存折线点
- `semanticRole` 用于区分：
  - `primary-flow`
  - `secondary-flow`
  - `annotation`
  - `feedback`

## 7.5 fragment

用途：

- Drawnix 当前不适合原生表达但必须保真的局部视觉块

首版允许 fragment 承载：

- 描边标题字
- 带复杂滤镜的小型组件
- 局部复杂装饰图
- 局部复杂路径组合

fragment 必须满足：

- 只允许局部区域
- 不允许整图 fragment
- 必须保留原始 bounds
- 必须支持后续替换或重新编译

## 8. 文本专项策略

文本是本方案的核心部分，必须从“SVG 反解析”切换为“结构化文本正向生成”。

## 8.1 文本分级

### A 级：原生文本

适用场景：

- 普通单行标签
- 容器内正文
- 简单标题

策略：

- 直接编译为 Drawnix 原生文本或带文本几何元素

### B 级：保真优先文本

适用场景：

- 描边标题字
- 特殊字体标题
- emoji
- 复杂多行精排
- 依赖基线或旋转的文本

策略：

- 编译为 `fragment`
- 同时保留 `sourceText` 与文本元数据

### C 级：过渡态文本

适用场景：

- 当前 Drawnix 无法稳定表达，但后续有明确原生支持计划的文字

策略：

- 首版先 fragment
- 后续在编译器中逐类回收为原生文本

## 8.2 文本最少字段

后端生成文本元素时，至少需要显式给出：

- `text`
- `fontFamily`
- `fontSize`
- `fontWeight`
- `fontStyle`
- `fill`
- `stroke`
- `strokeWidth`
- `anchor`
- `baseline`
- `rotation`
- `lineHeight`
- `letterSpacing`
- `bbox`

禁止依赖前端从 `SVG` 二次猜测这些字段。

## 9. Drawnix 编译策略

## 9.1 输出目标

首版 `scene -> Drawnix` 建议输出：

- `DrawnixExportedData`

结构对齐当前仓库导出格式：

- `type`
- `version`
- `source`
- `elements`
- `viewport`
- `theme`

## 9.2 元素映射

- `text`
  - 编译为 `BasicShapes.text` 或 `createGeometryElementWithText(...)`
- `shape`
  - 编译为 `BasicShapes.rectangle / roundRectangle / ...`
- `connector`
  - 编译为 `createArrowLineElement(...)`
- `image`
  - 编译为 `type: "image"` 的 Drawnix 图片元素
- `fragment`
  - 首版编译为局部图片元素或局部 SVG 片段元素

## 9.3 不建议直接由 LLM 输出 Plait JSON

原因：

- 内部 schema 绑定过强
- 易出现字段缺失和类型错误
- 难以做版本演进
- 难以与 SVG 产物共享真相

因此推荐：

- LLM 或后端逻辑输出 `scene.json`
- 编译器输出最终 `Drawnix`

## 10. SVG 编译策略

保留 `scene -> SVG` 的原因：

- 继续提供高保真预览
- 方便与历史结果做视觉对照
- 方便导出与调试
- 方便短期内保留现有工作流

建议：

- `template.svg` 由 `scene` 直接编译
- `final.svg` 也由 `scene` 直接编译
- 不再把 `SVG` 作为 Drawnix 的唯一事实源

## 11. bundle 协议升级

## 11.1 新增产物

`bundle.zip` 中建议新增：

- `scene.json`
- `scene.schema.json`
- `compile-report.json` 可选

## 11.2 manifest.json 升级字段

建议新增：

- `scene_url`
- `scene_schema_version`
- `preferred_import_kind`
- `compiler_versions`
- `asset_index`
- `fallbacks`

其中：

- `preferred_import_kind`
  - 推荐值：`scene`

## 12. 前端消费方案

前端新链路建议如下：

1. 下载 `manifest.json`
2. 检查 `preferred_import_kind`
3. 若存在 `scene_url`，优先下载 `scene.json`
4. 执行 schema 校验与业务校验
5. 编译为 `PlaitElement[]`
6. 插入 Drawnix 画板
7. 若失败，则回退到现有 `svg-import`

前端需新增模块建议：

- `scene-import/types.ts`
- `scene-import/load-scene-package.ts`
- `scene-import/validate-scene.ts`
- `scene-import/compile-scene-to-drawnix.ts`
- `scene-import/insert-scene-result.ts`

## 13. 后端改造建议

后端建议新增以下模块：

- `app/services/scene_service.py`
- `app/services/scene_schema.py`
- `app/services/scene_to_svg.py`
- `app/services/scene_to_drawnix.py`
- `app/services/bundle_service.py` 扩展

现有 `autofigure2.py` 的后半段建议调整为：

1. 生成布局与占位信息
2. 构建 `scene.json`
3. 归一化和校验
4. 从 `scene.json` 编译出 `template.svg`
5. 从 `scene.json` 编译出 `final.svg`
6. 打包 `bundle.zip`

## 14. 迁移计划

## 14.1 阶段 S1：并行产出

- 后端继续输出 `template.svg / final.svg`
- 同时新增 `scene.json`
- 前端增加隐藏开关支持 `scene-import`

## 14.2 阶段 S2：灰度消费

- 前端优先尝试 `scene-import`
- 导入失败时自动回退 `svg-import`
- 对比两条链路的文字、箭头、组件和整体布局效果

## 14.3 阶段 S3：默认切换

- `manifest.preferred_import_kind = "scene"`
- `scene-import` 成为默认导入链路
- `svg-import` 保留为兼容回退

## 15. 验收标准

## 15.1 结构验收

- `scene.json` 可通过 schema 校验
- 所有资源引用可解析
- 所有元素 `id` 唯一
- 所有 connector 的 `from/to` 均能正确绑定

## 15.2 编辑验收

- 文本元素可编辑
- 箭头元素可编辑
- 图标元素可移动、缩放、替换
- 容器元素可修改尺寸与样式
- fragment 仅占局部，不出现整图底图吞并

## 15.3 视觉验收

- 与现有 `final.svg` 对比时，标题、正文、箭头、图标位置误差可控
- 文字与容器不出现大面积错位
- 复杂局部允许 fragment 保真

## 16. 风险与对策

## 16.1 风险：文字仍无法完全像素级一致

对策：

- 明确“结构化文本高保真”而非“像素级完全一致”的验收口径
- 对特殊文本采用 fragment 方案

## 16.2 风险：后端 scene 结构漂移

对策：

- 使用严格 JSON Schema
- 默认 `additionalProperties: false`
- 为版本升级建立兼容策略

## 16.3 风险：前后端双编译器产生分叉

对策：

- 以 `scene.json` 为唯一事实源
- 编译报告中记录版本与降级情况
- 对关键样例建立回归测试

## 17. 决策建议

本轮建议正式采用以下决策：

1. 将 `scene.json` 设为 Autodraw 下一阶段的编辑事实源
2. 保留 `scene -> SVG` 作为高保真预览和回归产物
3. 前端新增 `scene-import`，并保留 `svg-import` 回退
4. 文本采用“原生文本优先，复杂文本 fragment 保真”的混合策略
5. 禁止继续扩张“整图 base layer 图片”式导入方案

## 18. 下一步实现清单

建议后续实现按以下顺序推进：

1. 定义 `scene.schema.json`
2. 在后端新增 `scene builder / validator / compiler`
3. 扩展 `manifest.json` 与 `bundle.zip`
4. 在前端实现 `scene-import`
5. 增加真实样例对照与回归测试
