# Web Frontend Rendering Logic

## 1. 目标与范围

本文档整理 `web/` 目录下当前前端的渲染逻辑，重点回答以下问题：

- 生图完成后，前端如何把结果送入画板
- `SVG` 如何在画板中加载、解析、渲染
- 文字在页面和画板内如何呈现
- 各类组件（图片、图标、文本、容器）如何进入画板
- 选中、编辑、拖拽、删除等交互能力依赖什么技术栈

这里分析的是当前仓库中的旧版 `web/` 前端，而不是 `paperdraw/frontend/` 的最小测试页。

## 2. 总体架构

当前 `web/` 采用的是一套非常直接的浏览器原生架构：

- 页面层：原生 HTML
- 逻辑层：原生 JavaScript
- 样式层：原生 CSS
- 实时状态同步：SSE (`EventSource`)
- SVG 编辑器：`SVG-Edit`
- SVG 预览回退：浏览器原生 `<object type="image/svg+xml">`

核心文件：

- `web/index.html`
- `web/canvas.html`
- `web/app.js`
- `web/styles.css`
- `web/vendor/svg-edit/editor/`
- `server.py`

前端不使用 React/Vue，也没有构建系统；所有逻辑集中在 `web/app.js` 中，通过 `body[data-page]` 决定初始化输入页还是画板页。

## 3. 页面职责

### 3.1 输入页

输入页对应 `web/index.html`，主要职责是：

- 收集 `method_text`
- 收集 provider / api key / optimize 参数
- 选择 SAM3 后端与 prompt
- 上传参考图
- 发起后端任务

页面主要控件：

- `textarea#methodText`
- `select#provider`
- `input#apiKey`
- `input#optimizeIterations`
- `select#imageSize`
- `select#samBackend`
- `input#samPrompt`
- `input#samApiKey`
- `input#referenceFile`

这些控件不直接参与 SVG 渲染，它们的作用是把后端 job 的参数组织起来。

### 3.2 画板页

画板页对应 `web/canvas.html`，主要职责是：

- 展示当前 job 状态
- 接收后端推送的中间产物
- 加载 `template.svg` 或 `final.svg`
- 将 SVG 注入 `SVG-Edit`
- 展示 artifacts 面板和日志面板

页面主体由三部分组成：

- 画板容器：`iframe#svgEditorFrame`
- 失败回退容器：`div#svgFallback` + `object#fallbackObject`
- 侧边信息：artifact panel / log panel

## 4. 从生图到画板的完整链路

### 4.1 启动任务

输入页在点击按钮后，会把表单序列化为请求体并发到：

- `POST /api/run`

请求由 `web/app.js` 中 `initInputPage()` 的按钮点击逻辑发起。

后端 `server.py` 收到请求后：

- 创建 `job_id`
- 创建输出目录
- 启动 `autofigure2.py`
- 返回 `job_id`

前端随后跳转到：

- `/canvas.html?job=<job_id>`

### 4.2 监听任务进度

进入画板页后，前端会创建：

- `new EventSource(/api/events/{job_id})`

后端通过 SSE 持续推送三类事件：

- `status`
- `log`
- `artifact`

其中：

- `status` 驱动画面顶部状态文字
- `log` 填充右侧日志面板
- `artifact` 驱动中间产物面板，并触发 SVG 加载

### 4.3 什么时候进入画板

真正进入画板的不是步骤一输出的 `figure.png`，而是：

- `template.svg`
- `final.svg`

当前逻辑中，只要前端接收到下列任意 artifact：

- `template_svg`
- `final_svg`

就会调用 `loadSvgAsset(url)` 去获取 SVG 内容并加载到画板。

所以更准确地说：

- `figure.png` 是中间展示产物
- `template.svg` / `final.svg` 才是画板编辑输入

## 5. SVG 的加载、解析与渲染

### 5.1 画板优先使用 SVG-Edit

画板页初始化时，前端会先请求：

- `GET /api/config`

后端返回：

- `svgEditAvailable`
- `svgEditPath`

如果可用，则：

- `iframe#svgEditorFrame.src = svgEditPath`

也就是把 `web/vendor/svg-edit/editor/index.html` 作为编辑器嵌入页面。

### 5.2 SVG 文本的获取方式

当后端通过 `artifact` 事件通知产出 `template.svg` 或 `final.svg` 后，前端做两步：

1. `fetch(url)` 拉取 SVG 文本
2. 尝试把文本注入 `SVG-Edit`

这里不是直接让 `iframe` 跳转到目标 SVG 文件，而是优先走“读取字符串后注入”的模式。

### 5.3 注入到 SVG-Edit 的方式

前端尝试两种 API：

- `window.svgEditor.loadFromString(svgText)`
- `window.svgCanvas.setSvgString(svgText)`

这说明当前集成方式依赖于 `SVG-Edit` 在 `iframe.contentWindow` 暴露全局对象。

逻辑顺序：

1. 如果编辑器尚未 `load`
   - 先缓存到 `pendingSvgText`
2. 等 `iframe` 触发 `load`
   - 再注入 SVG
3. 如果全局 API 不存在
   - 退化为给 `iframe` 拼 `?url=...`

### 5.4 最终回退

如果 `SVG-Edit` 本身不可用，则前端回退为：

- `fallbackObject.data = svgUrl`

此时浏览器原生把 SVG 当作外部资源渲染，不提供编辑能力，只提供显示能力。

## 6. 文字渲染逻辑

文字渲染可以分成两层看。

### 6.1 普通 DOM 文字

前端页面上的所有标题、标签、状态文字、日志文字都属于普通 HTML 文本：

- `Method Text`
- `Provider`
- `Status`
- `Artifacts`
- `Logs`
- `jobId`
- `statusText`
- `artifact card` 的名称和 badge

这些文字由 HTML + CSS 直接渲染。

使用的字体来自 `web/styles.css`：

- `IBM Plex Sans`
- `Space Grotesk`

通过 Google Fonts 引入：

- `@import url("https://fonts.googleapis.com/css2?...")`

因此，输入页和画板页的普通界面文字，完全依赖浏览器 DOM/CSS 排版。

### 6.2 SVG 内文字

真正被画板编辑的文字，不是 HTML 文本，而是 SVG 中的：

- `<text>`
- `<tspan>`
- 或由 `foreignObject` 包含的嵌入内容

这部分不是 `web/app.js` 手动解析绘制的，而是由 `SVG-Edit` 的底层 `svgcanvas` 负责处理。

从 `web/vendor/svg-edit/editor/tests/vendor/svgcanvas/svgcanvas.js` 可以看到：

- 支持的可编辑元素集合中包含 `text` 和 `tspan`
- 内部维护了 `curText` 文本样式对象
- 初始化时注册了 `textActions`
- 选择逻辑会对 `text` 节点走专门的包围盒计算和编辑流程

因此，SVG 内文字的渲染与编辑依赖：

- 浏览器原生 SVG 渲染
- `SVG-Edit` 的 `svgcanvas` 文本编辑能力

## 7. 各类组件如何渲染

这里的“组件”不是 React component，而是画板中的 SVG 图元与资源。

### 7.1 组件来源

进入画板的元素主要来自后端输出的 `template.svg` / `final.svg`，其中可能包含：

- 文本节点
- 矩形、圆、多边形、路径
- 图像节点 `<image>`
- 分组 `<g>`
- 图标位图或向量片段
- 箭头、连线、边框、标题区块

也就是说，前端本身不负责把结构化 JSON 转成 SVG 组件；组件组装已经发生在后端 pipeline。

前端负责的是：

- 发现哪个 SVG 可用
- 读取 SVG 字符串
- 交给画板渲染引擎

### 7.2 浏览器侧渲染主体

渲染主体有两个：

- `SVG-Edit` 内部的 `svgcanvas`
- 浏览器原生 SVG 渲染器

所以组件的显示方式本质上是：

- SVG XML -> DOM 解析 -> SVG 图元渲染

不是前端自己逐个 canvas draw，也不是手写路径渲染器。

### 7.3 artifacts 面板中的组件卡片

画板右下角 artifacts 面板里，每个中间产物会被渲染成一个卡片：

- 根节点是 `<a>`
- 内部有 `<img>`
- 再加名称和 badge

这套渲染完全由 `addArtifactCard()` 动态创建 DOM 完成。

artifact 卡片只是“文件预览组件”，不是画板内可编辑组件。

## 8. 选中、编辑、拖拽是怎么实现的

### 8.1 当前项目自己的前端没有手写编辑器

`web/app.js` 本身没有实现：

- 图元 hit test
- 选中框
- 拖拽控制点
- 文字就地编辑
- 旋转缩放 handles

这些能力全部依赖 `SVG-Edit`。

### 8.2 SVG-Edit 内部能力

从 `web/vendor/svg-edit/editor/tests/vendor/svgcanvas/svgcanvas.js` 可以看出，它内部维护了典型编辑器状态：

- `currentMode = 'select'`
- `selectedElements = []`
- `rubberBox`
- `selectorManager`
- `textActions`
- `selectOnly()`
- `removeFromSelection()`
- `selectAllInCurrentLayer()`
- `changeSelectedAttribute()`
- `deleteSelectedElements()`
- `setMode('select' | 'text' | 'rect' | ...)`

因此你在画板中的这些交互能力：

- 点击选中
- 框选
- 调整大小
- 修改属性
- 删除元素
- 切换绘制模式

都来自 `SVG-Edit` 内部，而不是当前项目自研。

### 8.3 文本选中与编辑

`svgcanvas` 中有专门的文本处理模块：

- `textActionsInit`
- `textActions`
- 对 `selectedElements[0]?.nodeName === 'text'` 的分支处理

这意味着：

- 文字节点在被选中时，会进入 SVG-Edit 的专用文本编辑逻辑
- 字体、字号、内容、文本边界的处理也由其内部完成

### 8.4 组件选中与边界框

`svgcanvas` 内部使用：

- `selectorManager`
- `releaseSelector()`
- `requestSelector()`
- `getRubberBandBox()`

这对应编辑器常见的：

- 选中边框
- 控制点
- 多选矩形框

也就是说，组件选中编辑是标准 SVG 编辑器工作流，而不是该项目自己实现的覆盖层。

## 9. 日志与状态渲染

### 9.1 状态渲染

页面顶部状态来自 SSE `status` 事件。

显示的典型状态包括：

- `Running`
- `Done`
- `Failed`
- `Disconnected`
- 以及 `Step n/5 - ...`

### 9.2 日志渲染

日志面板通过 `appendLogLine()` 把后端 SSE 推送的 `log` 文本拼接到 DOM 中。

特点：

- 每条日志拼成 `[stream] line`
- 最多保留 200 行
- 自动滚动到底部

这部分不是终端直出，而是浏览器端对 SSE 数据做了轻量缓冲和截断。

## 10. 样式系统

页面视觉样式主要由 `web/styles.css` 提供：

- 布局：`grid` / `flex`
- 主色：`--accent`, `--accent-strong`
- 卡片：圆角、边框、阴影
- 上传组件：拖拽态样式
- 画板容器：白底、大圆角、阴影
- 浮动按钮：glassmorphism 风格
- 侧边栏：artifact panel / log panel

这说明前端壳层 UI 是自定义 CSS，而画板内部 UI 则由 `SVG-Edit` 自己控制。

## 11. 当前技术栈清单

### 11.1 项目自有前端技术

- HTML5
- Vanilla JavaScript
- CSS3
- `fetch`
- `FormData`
- `EventSource`
- `sessionStorage`
- `<iframe>`
- `<object type="image/svg+xml">`

### 11.2 第三方编辑器

- `SVG-Edit`
- `svgcanvas`

### 11.3 后端协作协议

- REST:
  - `POST /api/run`
  - `POST /api/upload`
  - `GET /api/config`
  - `GET /api/artifacts/{job_id}/{path}`
- SSE:
  - `GET /api/events/{job_id}`

## 12. 关键设计特点

### 12.1 优点

- 架构简单，联调成本低
- 通过 SSE 可以实时观察 pipeline 中间状态
- `SVG-Edit` 直接复用成熟编辑能力
- 没有复杂前端框架依赖

### 12.2 局限

- 页面逻辑全部集中在 `app.js`，后续扩展会越来越重
- 画板与业务状态之间靠字符串事件和文件名约定耦合
- `SVG-Edit` 通过 `iframe.contentWindow` 集成，接口边界松散
- 前端自己并不了解 SVG 的业务语义，只负责“加载一个 SVG”
- `figure.png` 等中间产物与画板编辑态之间没有统一数据模型

## 13. 一句话总结

当前 `web/` 的本质是：

- 一个原生 JS 的任务控制台
- 加上一层 `SVG-Edit iframe` 作为画板

它并不自己实现 SVG 图元编辑，而是：

1. 启动后端 job
2. 通过 SSE 监听产物
3. 拿到 `template.svg/final.svg`
4. 把 SVG 文本注入 `SVG-Edit`
5. 由 `SVG-Edit` 负责文字、图元、选中与编辑

换句话说：

- 业务生成在后端
- SVG 渲染与编辑在 `SVG-Edit`
- `web/` 前端负责把两者串起来
