# Autodraw Scene 字段映射说明

> 版本：v1.0  
> 日期：2026-04-13  
> 状态：待评审  
> 适用范围：`autodraw/backend/**`、`packages/drawnix/src/autodraw/**`、`packages/drawnix/src/svg-import/**`

## 1. 文档定位

本文档用于把当前后端已有产物、拟引入的 `scene.json` 模型，以及最终 Drawnix 编译目标三者对齐。

本文档回答三个问题：

1. 当前后端已经有哪些字段可以复用
2. 这些字段进入 `scene.json` 后应该落到哪里
3. `scene.json` 最终如何编译成 Drawnix 可编辑对象

配套文档：

- [scene-driven-drawnix-plan.md](file:///Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/autodraw/scene-driven-drawnix-plan.md)
- [scene-schema-draft.json](file:///Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/autodraw/scene-schema-draft.json)

## 2. 映射范围

当前映射范围覆盖以下来源：

- `job.json / manifest.json` 中的作业与产物信息
- `template.svg` 中的结构化图元
- `final.svg` 中的最终图标替换结果
- `icons/*_nobg.png` 资产
- `boxlib.json` / `icon_infos` 中的图标边界信息

## 3. 映射总览

整体映射链路建议如下：

1. 后端现有产物和中间结构
2. `SceneBuilder` 组装为 `scene.json`
3. `SceneNormalizer` 补默认值并归一化
4. `SceneValidator` 校验
5. `SceneToDrawnixCompiler` 输出 Drawnix
6. `SceneToSvgCompiler` 输出 `template.svg/final.svg`

其中最重要的变化是：

- 不再把 `final.svg` 当作唯一事实源
- `template.svg` 和中间边界信息更多作为 `scene` 的输入依据

## 4. 顶层字段映射

| 当前来源 | 当前字段 | scene 字段 | 说明 |
| --- | --- | --- | --- |
| `manifest.json` | `job_id` | `source.jobId` | 作业唯一标识 |
| `manifest.json` | `request.source_job_id` | `source.sourceJobId` | 用于恢复或继承场景来源 |
| `manifest.json` | `request.resume_from_stage` | `source.resumeFromStage` | 用于记录场景生成的起始阶段 |
| 后端版本 | pipeline 版本号 | `source.pipelineVersion` | 建议显式写入 |
| 后端服务名 | 固定字符串 | `source.generator` | 建议如 `autodraw-backend` |
| `template.svg` | `width / height / viewBox` | `canvas.width / canvas.height` | 画布尺寸真相建议来自 scene |
| `template.svg` | 背景色 | `canvas.background` | 通常为 `#ffffff` |
| 样式预设 | 主题名 | `theme.preset` | 如 `academic` |
| 样式提取结果 | 颜色/字体 token | `theme.tokens` | 供双编译器统一消费 |

## 5. 资产字段映射

## 5.1 图标资产

当前后端已有：

- `icons/icon_AF01.png`
- `icons/icon_AF01_nobg.png`
- `manifest.result.icon_infos[*]`

建议映射如下：

| 当前来源 | 当前字段 | scene 字段 | 说明 |
| --- | --- | --- | --- |
| `icon_infos[*].label_clean` | `AF04` | `assets[*].id` | 建议标准化为 `asset-icon-af04` |
| `icons/icon_AF04_nobg.png` | 文件路径 | `assets[*].path` | 优先使用去背景版本 |
| PNG 元信息 | 宽高 | `assets[*].width / height` | 用于编译时校验 |
| 固定值 | `image/png` | `assets[*].mimeType` | 图标资源类型 |

建议图标资产记录示例：

```json
{
  "id": "asset-icon-af04",
  "kind": "image",
  "path": "assets/icons/icon_AF04_nobg.png",
  "mimeType": "image/png",
  "width": 95,
  "height": 103
}
```

## 5.2 字体资产

当前后端未显式打包字体，但如果后续引入固定字体包，建议映射到：

- `assets[*].kind = "font"`

当前阶段不强制要求后端打包字体，但建议为后续高保真文本预留此能力。

## 6. 文本映射

## 6.1 当前来源

文本主要来自：

- `template.svg` 中的 `<text>`
- `style` 节点中的 class 样式
- 行内 `font-size / font-weight / text-anchor / dominant-baseline`

例如：

- 标题：`class="title big"`
- 正文：`class="body med"`
- 占位块标签：`<AF>04`

## 6.2 scene 映射建议

| 当前来源 | 当前字段 | scene 字段 | 说明 |
| --- | --- | --- | --- |
| `<text>` 内容 | 文本内容 | `text.text` | 原始文案 |
| `x / y` | 锚点坐标 | `text.layout.x / y` | 坐标真相 |
| 估算或后端布局框 | 宽高 | `text.layout.width / height` | 必须显式给出，不再依赖前端猜测 |
| `text-anchor` | `start/middle/end` | `text.layout.anchor` | 直接映射 |
| `dominant-baseline` | `middle/...` | `text.layout.baseline` | 直接映射 |
| `transform` | 旋转信息 | `text.layout.rotation` | 首版可只抽取旋转 |
| `font-family` | 字体族 | `text.style.fontFamily` | 必须显式保留 |
| `font-size` | 字号 | `text.style.fontSize` | 必须显式保留 |
| `font-weight` | 字重 | `text.style.fontWeight` | 必须显式保留 |
| `fill` | 填充色 | `text.style.fill` | 必须显式保留 |
| `stroke` | 描边色 | `text.style.stroke` | 对标题字很重要 |
| `stroke-width` | 描边宽度 | `text.style.strokeWidth` | 对标题字很重要 |

## 6.3 文本到 Drawnix 的编译目标

| scene 元素 | 编译目标 | 说明 |
| --- | --- | --- |
| `text.editing.mode = native-text` | 独立文本元素 | 用于普通标签与正文 |
| `text.editing.mode = native-text-in-shape` | `createGeometryElementWithText(...)` | 用于容器文字与图形绑定 |
| `text.editing.mode = svg-fragment-text` | `fragment` | 用于复杂标题字、特殊字和 emoji |

## 7. shape / frame 映射

## 7.1 当前来源

容器和边框主要来自：

- `template.svg` 中的 `<rect>`
- 局部样式类：
  - `.dash`
  - 普通描边矩形
  - 带圆角与渐变的卡片矩形

## 7.2 scene 映射建议

| 当前来源 | 当前字段 | scene 字段 | 说明 |
| --- | --- | --- | --- |
| `<rect x y width height>` | 边界框 | `shape.bounds` 或 `frame.bounds` | 直接映射 |
| `rx / ry` | 圆角 | `shape.cornerRadius` | 取较大值或保留双值扩展 |
| `fill` | 填充 | `shape.style.fill` | 基础样式 |
| `stroke` | 描边 | `shape.style.stroke` | 基础样式 |
| `stroke-width` | 描边宽度 | `shape.style.strokeWidth` | 基础样式 |
| `stroke-dasharray` | 虚线信息 | `metadata.strokeDashArray` 或 theme token | 首版先保留在 metadata |
| `filter="url(#shadow)"` | 阴影信息 | `shape.style.shadowToken` 或 `fragment` | 首版可先转 token 或局部保真 |

## 7.3 Drawnix 编译建议

| scene 元素 | Drawnix 编译目标 | 说明 |
| --- | --- | --- |
| `shape.shapeType = rectangle` | `BasicShapes.rectangle` | 标准矩形 |
| `shape.shapeType = round-rectangle` | `BasicShapes.roundRectangle` | 圆角矩形 |
| `frame` | 一般仍编译为几何元素 | 用于外层虚线框、大容器 |
| 带复杂渐变/滤镜的 shape | `fragment` 或样式降级 | 首版不强制全原生 |

## 8. 图标 image 映射

## 8.1 当前来源

当前图标有两套来源：

- `template.svg` 中的占位块和 `<AF>xx` 标签
- `final.svg` 中的 `<image id="icon_AFxx" ...>`

但新方案中不建议再以 `final.svg` 作为图标语义真相。

## 8.2 scene 映射建议

图标语义应来自：

- `icon_infos`
- 占位块位置
- 去背景图标资产路径

建议映射如下：

| 当前来源 | 当前字段 | scene 字段 | 说明 |
| --- | --- | --- | --- |
| `icon_infos[*].x1/y1/width/height` | 图标边界 | `image.layout` | 作为图标位置真相 |
| `icon_infos[*].label_clean` | 图标标识 | `image.id` | 建议标准化如 `icon-af04` |
| `_nobg.png` 路径 | 资源路径 | `image.assetRef` | 引用 `assets[]` |
| `preserveAspectRatio` | 显示模式 | `image.preserveAspectRatio` | 默认 `xMidYMid meet` |

## 8.3 Drawnix 编译建议

scene 中的 `image` 直接编译为 Drawnix 图片元素，不再通过 SVG 节点逆向推导。

## 9. connector 映射

## 9.1 当前来源

当前连线主要来自：

- `template.svg` 中的 `<path class="arrow">`
- `<path class="brown">`

其中一部分是：

- 主流程箭头

另一部分可能是：

- 装饰线
- 非箭头说明线

## 9.2 scene 映射建议

后端应尽量在生成 scene 时直接判断连线语义，而不是留给前端从路径判断。

| 当前来源 | 当前字段 | scene 字段 | 说明 |
| --- | --- | --- | --- |
| 路径起点终点 | 几何锚点 | `connector.routing.points` | 可保留折点 |
| 箭头方向 | 箭头类型 | `connector.style.endMarker` | 一般为 `arrow` |
| 路径所属语义 | 主干/辅助/反馈 | `connector.semanticRole` | 由后端直接判断 |
| 逻辑连接对象 | 源目标组件 | `connector.from/to.elementId` | 应从语义结构直接给出 |

## 9.3 Drawnix 编译建议

| scene 元素 | Drawnix 编译目标 | 说明 |
| --- | --- | --- |
| `connector` | `createArrowLineElement(...)` | 显式连线对象 |
| 路由点数 > 2 | `element.points = routing.points` | 保留折线结果 |

## 10. group 映射

## 10.1 当前来源

当前可识别分组主要来自：

- SVG `<g>`
- 语义模块
- 卡片和其子元素组合

## 10.2 scene 映射建议

group 用于表达语义归属，而不要求首版一定映射为 Drawnix 的可视 group。

建议用途：

- 记录模块归属
- 记录卡片与子元素关系
- 记录 fragment 所属容器

## 11. fragment 映射

## 11.1 触发条件

满足以下情况的局部内容建议进入 `fragment`：

- 标题字带描边且误差敏感
- 复杂渐变卡片无法稳定转原生
- 局部复杂路径组合
- 输出预览缩略结构块

## 11.2 当前来源

fragment 可来自：

- `template.svg` 中的局部节点切片
- `final.svg` 中的局部片段
- 直接由 `scene -> svg fragment compiler` 生成的内联 SVG

## 11.3 Drawnix 编译建议

首版 fragment 建议编译为局部图片对象或局部 SVG 片段对象，但必须满足：

- 范围小
- 可定位
- 不替代整图

## 12. manifest 升级映射

建议新增字段映射如下：

| 新 manifest 字段 | 来源 | 作用 |
| --- | --- | --- |
| `scene_url` | `bundle.zip/scene.json` | 前端下载 scene |
| `scene_schema_version` | `scene.version` | 版本兼容 |
| `preferred_import_kind` | 后端导入策略 | 默认优先 `scene` |
| `compiler_versions.scene_to_svg` | 编译器版本 | 回归与调试 |
| `compiler_versions.scene_to_drawnix` | 编译器版本 | 回归与调试 |
| `fallbacks` | 后端策略 | 声明可否回退 `svg-import` |

## 13. Scene 到 Drawnix 顶层输出映射

当前 Drawnix 导出格式包含：

- `type`
- `version`
- `source`
- `elements`
- `viewport`
- `theme`

建议映射：

| scene | Drawnix 输出 | 说明 |
| --- | --- | --- |
| `scene.type` | 无直接映射 | scene 仅作为中间格式 |
| `scene.version` | 编译器内部使用 | 不直接写入 Drawnix version |
| `scene.elements[]` | `elements[]` | 编译后的 PlaitElement 列表 |
| `scene.canvas` | `viewport` 初始值 | 用于首屏定位或预览 |
| `scene.theme` | `theme` | 主题映射 |
| 固定值 | `type = "drawnix"` | Drawnix 文件类型 |
| 当前前端版本 | `version` | Drawnix 格式版本 |
| 固定值或来源 | `source = "web"` | 当前仓库导出约束 |

## 14. 首版实现优先级

## P1：必须先做

- 顶层字段映射
- 图标资产映射
- 普通文本映射
- 矩形和圆角矩形映射
- 主干箭头映射
- `manifest` 升级字段

## P2：建议尽快做

- fragment 片段映射
- 阴影与渐变 token 映射
- group 语义映射
- 文本的 `baseline / rotation` 完整映射

## P3：后续增强

- 富文本 runs
- 字体资产打包
- fragment 的再编辑能力
- 更细粒度的 shape 类型

## 15. 一句话结论

当前后端已有的结构信息并不少，问题不在“没有数据”，而在“这些数据没有被组织成 Drawnix 可直接消费的场景真相”。

本映射方案的核心就是：

- 把当前分散在 `manifest.json`、`icon_infos`、`template.svg`、`final.svg`、图标资产中的信息
- 统一收束到 `scene.json`
- 再由 `scene.json` 正向编译出 Drawnix 和 SVG

这样可以显著降低前端逆向推断的复杂度，尤其能改善文本与组件导入的一致性。
