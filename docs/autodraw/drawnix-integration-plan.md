# Autodraw 与 Drawnix 集成方案

> 版本：v1.0  
> 日期：2026-04-13  
> 状态：待评审  
> 适用范围：`autodraw/backend/**`、`packages/drawnix/src/autodraw/**`、`packages/drawnix/src/svg-import/**`

## 1. 文档定位

本文件定义 `autodraw/backend` Python 后端系统与 Drawnix 平台的集成方案，目标是为 Drawnix 新增一个独立的 `Autodraw` 前端界面，支持：

- 输入方法描述文本
- 上传参考风格图片
- 提交后端生成任务
- 轮询任务状态
- 实时展示后端运行日志
- 自动下载并解析后端产物
- 自动导入 Drawnix 画板

本文件用于方案评审、范围确认与后续开发执行基线。在评审通过前，不进入正式开发。

关于后端产物从 `SVG` 单一事实源升级为 `scene.json` 单一事实源的后续方案，详见：

- [scene-driven-drawnix-plan.md](file:///Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/autodraw/scene-driven-drawnix-plan.md)

## 2. 范围界定

## 2.1 本次能力边界

本次是 Drawnix 中的一个**新功能入口**，不是现有 `PaperDraw Flowchart` 的延伸，也不挂靠 `packages/drawnix/src/paperdraw/**`。

本次能力边界如下：

- 新增独立入口：`Autodraw`
- 新增独立前端界面：文本输入 + 参考风格图上传 + 参数配置 + 任务状态面板
- 后端来源：`autodraw/backend`
- 产物导入：复用 Drawnix 现有 `svg-import` 能力

## 2.2 非目标

当前阶段不优先处理：

- 复用或改造现有 `PaperDraw Flowchart` 本地分析流程
- 后端直接让 LLM 输出最终 Plait JSON
- 生产级部署、鉴权、多租户、任务取消
- 实时 WebSocket 推送
- 云存储或 CDN 级资源分发

## 3. 后端现状分析

## 3.1 总体架构

`autodraw/backend` 当前是一个独立的 FastAPI 服务，核心结构如下：

- `app/main.py`
  - 应用入口
  - 注册 `health` 与 `jobs` 路由
  - 开启宽松 CORS
- `app/routers/jobs.py`
  - 提交任务
  - 查询任务
  - 下载 bundle
  - 下载单个 artifact
- `app/services/job_runner.py`
  - 创建任务目录
  - 线程池执行 pipeline
  - 维护 `job.json`
  - 生成 `manifest.json`
  - 生成 `bundle.zip`
- `app/services/pipeline_service.py`
  - 调用 `autofigure2.method_to_svg()`
- `app/services/artifact_service.py`
  - 扫描运行目录产物
- `app/services/bundle_service.py`
  - 构建 `manifest.json`
  - 打包 `bundle.zip`
- `app/pipeline/autofigure2.py`
  - 图片生成
  - 分割检测
  - 去背景
  - SVG 模板生成
  - 图标替换
  - 输出 `final.svg`

## 3.2 后端执行模型

当前是典型的异步作业模型：

- 前端调用 `POST /api/jobs`
- 后端创建 `job_id` 与本地运行目录
- 后端在线程池中串行执行
- 前端通过 `GET /api/jobs/{job_id}` 轮询状态
- 成功后下载 `bundle.zip`

关键特点：

- 默认 `max_concurrent_jobs=1`
- 任务目录固定落在 `autodraw/backend/runtime/jobs/<job_id>/`
- 每个任务包含 `job.json / manifest.json / run.log / bundle.zip`
- 适合 Drawnix 前端做“提交任务 -> 轮询 -> 自动导入”

## 3.3 现有 API

### `POST /api/jobs`

用途：

- 提交完整 Autodraw 任务

核心字段：

- `method_text`
- `provider`
- `api_key`
- `base_url`
- `image_model`
- `svg_model`
- `image_size`
- `sam_prompt`
- `sam_backend`
- `sam_api_url`
- `sam_api_key`
- `sam_max_masks`
- `rmbg_model_path`
- `stop_after`
- `placeholder_mode`
- `optimize_iterations`
- `merge_threshold`
- `reference_image_path`

说明：

- `reference_image_path` 已经是后端现有字段，这正好对应前端“上传参考风格图片”的需求

### `GET /api/jobs/{job_id}`

用途：

- 查询任务状态
- 返回 artifact 列表
- 返回 `bundle_url` 和 `manifest_url`

### `GET /api/jobs/{job_id}/bundle`

用途：

- 下载完整 `bundle.zip`

### `GET /api/jobs/{job_id}/artifacts/{artifact_path}`

用途：

- 下载单个产物

### `GET /healthz`

用途：

- 健康检查

## 3.4 现有输出产物

成功任务通常包含：

- `figure.png`
- `samed.png`
- `boxlib.json`
- `template.svg`
- `optimized_template.svg`
- `final.svg`
- `icons/*`
- `run.log`
- `manifest.json`
- `bundle.zip`

## 3.5 文件生成机制

`autofigure2.method_to_svg()` 当前主流程：

1. 生成 `figure.png`
2. 用 SAM 进行区域检测并生成 `samed.png + boxlib.json`
3. 对检测区域裁切并去背景，生成 `icons/*_nobg.png`
4. 生成 `template.svg`
5. 生成或复制 `optimized_template.svg`
6. 将图标替换进 SVG，生成 `final.svg`
7. 后端写 `manifest.json`
8. 后端生成 `bundle.zip`

这说明后端已经具备“面向前端消费的完整资产包”能力。

## 4. Drawnix 集成目标

## 4.1 产品目标

在 Drawnix 中新增一个独立的 `Autodraw` 前端界面，支持：

1. 输入方法描述文本
2. 上传参考风格图片
3. 配置必要参数
4. 提交后端生成任务
5. 实时查看后端运行日志
6. 查看任务进度与错误
7. 自动导入后端生成结果到画板

## 4.2 技术目标

1. 不改造现有 `paperdraw` 本地分析链
2. 第一阶段尽量复用后端现有 API
3. 第一阶段尽量复用现有 `svg-import` 能力
4. 前端只做任务调度、bundle 消费和画板导入

## 5. 前端新界面设计

## 5.1 新入口

推荐新增工具入口：

- `Autodraw`

与现有入口区分：

- `PaperDraw Flowchart`
  - 本地文本分析生成流程图
- `SVG To Drawnix`
  - 手动上传 ZIP 导入
- `Autodraw`
  - 调用 `autodraw/backend`，自动完成任务、下载 bundle、导入画板

## 5.2 新界面字段

### 必填区域

- `method_text`
  - 多行文本输入框

### 参考风格图区域

- `reference_style_image`
  - 本地文件上传
  - 支持图片格式：
    - `png`
    - `jpg/jpeg`
    - `webp`

### 后端参数区域

- `provider`
- `api_key`
- `base_url`
- `image_model`
- `svg_model`
- `image_size`
- `sam_prompt`
- `sam_backend`
- `sam_api_url`
- `sam_api_key`
- `sam_max_masks`
- `stop_after`
- `placeholder_mode`
- `optimize_iterations`
- `merge_threshold`

### 状态区域

- 当前阶段
- job_id
- 创建时间
- 当前状态
- 错误信息
- 下载入口
- 导入摘要

### 实时日志区域

- 只读日志面板
- 自动滚动到底部
- 支持暂停自动滚动
- 支持复制日志
- 支持下载完整 `run.log`
- 支持日志级别高亮：
  - `meta`
  - `info`
  - `warning`
  - `error`

## 5.3 用户交互流程

```mermaid
flowchart TD
  A[用户打开 Autodraw 界面] --> B[输入文本]
  B --> C[上传参考风格图]
  C --> D[配置后端参数]
  D --> E[点击生成]
  E --> F[前端上传参考图并准备请求]
  F --> G[POST /api/jobs]
  G --> H[获得 job_id]
  H --> I[建立日志流]
  H --> J[轮询 GET /api/jobs/{job_id}]
  I --> K[实时展示后端日志]
  J --> L{状态}
  L -->|queued/running| J
  L -->|failed| M[展示错误与日志入口]
  L -->|succeeded| N[关闭日志流并下载 bundle.zip]
  N --> O[解析 final.svg/icons/manifest]
  O --> P[导入 Drawnix 画板]
  P --> Q[展示导入摘要]
```

## 5.4 实时日志展示设计

## 5.4.1 目标

让用户在前端执行任务期间，实时看到后端当前运行到哪一步、是否卡住、是否报错，而不是只在失败后下载 `run.log` 排查。

## 5.4.2 前端展示形态

建议在 `Autodraw` 界面右侧或底部提供固定日志面板：

- 顶部显示：
  - `job_id`
  - 当前状态
  - 连接状态
  - 最后更新时间
- 中部显示滚动日志
- 底部提供操作：
  - 清空本地缓存
  - 暂停自动滚动
  - 复制日志
  - 下载完整日志

## 5.4.3 推荐日志传输方案

优先推荐：

- `SSE (Server-Sent Events)` 实时日志流

原因：

- 后端当前是单向输出日志到 `run.log`
- 前端只需要订阅，不需要双向消息
- 实现复杂度低于 WebSocket
- 浏览器原生支持较好

降级方案：

- 定时轮询日志尾部

## 5.4.4 日志生命周期

前端行为建议：

1. 提交任务成功后立即获得 `job_id`
2. 立刻建立日志订阅
3. 任务处于 `queued/running` 时持续消费日志
4. 任务结束后停止实时订阅
5. 成功时继续进入 bundle 下载
6. 失败时保留日志面板与下载入口

## 6. 参考风格图上传方案

## 6.1 前端处理方式

用户上传参考风格图后，前端需要：

1. 校验文件格式和大小
2. 临时保存到浏览器内存
3. 在提交任务前完成文件上传或路径桥接

## 6.2 推荐集成方式

由于后端当前只接受 `reference_image_path`，建议分两个阶段：

### 阶段 A

- 前端先通过新增上传接口把参考图传到后端临时目录
- 后端返回一个服务端路径或 token
- 提交 `POST /api/jobs` 时把该路径写入 `reference_image_path`

### 阶段 B

- 后端扩展 `POST /api/jobs` 支持直接传文件或资源 token

## 6.3 建议新增接口

建议为 `autodraw/backend` 新增：

### `POST /api/uploads/reference-image`

请求：

- `multipart/form-data`
- 字段：
  - `file`

响应：

```json
{
  "upload_id": "ref_20260413_xxxx",
  "file_name": "style.png",
  "stored_path": "runtime/uploads/ref_20260413_xxxx.png"
}
```

然后前端在 `POST /api/jobs` 中传：

```json
{
  "method_text": "...",
  "reference_image_path": "runtime/uploads/ref_20260413_xxxx.png"
}
```

## 6.4 日志流接口建议

建议为 `autodraw/backend` 新增：

### `GET /api/jobs/{job_id}/logs/stream`

用途：

- 以 `text/event-stream` 实时输出 `run.log` 新增内容

响应事件示例：

```text
event: log
data: {"job_id":"20260413_xxxx","offset":128,"line":"步骤一：使用 LLM 生成学术风格图片"}
```

任务结束事件示例：

```text
event: end
data: {"job_id":"20260413_xxxx","status":"succeeded"}
```

### `GET /api/jobs/{job_id}/logs`

用途：

- 轮询式读取日志片段
- 作为 SSE 不可用时的降级方案

查询参数建议：

- `offset`
- `limit`

响应示例：

```json
{
  "job_id": "20260413_xxxx",
  "offset": 1024,
  "next_offset": 1388,
  "completed": false,
  "lines": [
    "[meta] provider=qingyun",
    "步骤二：SAM3 分割 + 灰色填充+黑色边框+序号标记"
  ]
}
```

## 7. 前端自动导入方案

## 7.1 输入源

前端自动导入的唯一主输入建议是：

- `bundle.zip`

原因：

- 产物完整
- 便于离线回放
- 不依赖多次单文件请求

## 7.2 资源优先级

建议：

1. 总图：`final.svg`
2. fallback 总图：`optimized_template.svg`
3. 再 fallback：`template.svg`
4. 组件图：优先 `icons/*_nobg.png`
5. 若 `_nobg` 不存在，则回退普通 `icons/*.png`

## 7.3 渲染引擎适配

复用现有 `svg-import` 能力，不单独造一套新渲染器。

### 导入规则

- 组件图
  - 使用 `icons/*_nobg.png`
  - 与总 SVG 中 `icon_AFxx` 占位节点匹配
- 文字
  - 从 `final.svg` 中提取
  - 使用真实 `bbox` 落板
- 箭头
  - 连接性箭头转 Drawnix 连线
  - 装饰箭头从总 SVG 裁片保留

### 图层顺序

1. 底图层
2. 组件层
3. 保留箭头层
4. 可编辑箭头层
5. 文本层

## 7.4 错误处理

### 后端任务阶段

- 创建任务失败
  - 显示错误
  - 不进入轮询
- 日志流连接失败
  - 自动回退到日志轮询模式
  - 在界面标记“实时日志已降级”
- 轮询失败
  - 支持重试
  - 支持手动刷新
- 任务失败
  - 展示 `error_message`
  - 保留实时日志内容
  - 提供 `run.log` 下载

### 资源导入阶段

- ZIP 损坏
  - 提示重新下载
- `final.svg` 缺失
  - 尝试 fallback SVG
- `icons/` 缺失
  - 仅导入总 SVG
- 参考风格图未上传成功
  - 阻止任务提交

## 8. 数据流图

```mermaid
flowchart LR
  A[method_text] --> B[Autodraw 前端界面]
  C[reference style image] --> B
  B --> D[上传参考图]
  D --> E[reference_image_path]
  B --> F[POST /api/jobs]
  F --> G[job_id]
  G --> H[logs/stream 或 logs polling]
  G --> I[GET /api/jobs/{job_id}]
  H --> J[实时日志面板]
  I --> K[bundle.zip]
  K --> L[manifest.json]
  K --> M[final.svg]
  K --> N[icons/*_nobg.png]
  M --> O[文本/箭头/底图拆解]
  N --> P[组件图替换]
  O --> Q[Drawnix elements]
  P --> Q
  Q --> R[Canvas insert]
```

## 9. 接口定义

## 9.1 现有后端接口

### `POST /api/jobs`

请求体保持现状，第一阶段重点新增前端界面，不强制改已有 schema。

### `GET /api/jobs/{job_id}`

用于轮询状态。

### `GET /api/jobs/{job_id}/logs/stream`

建议新增，用于实时日志订阅。

### `GET /api/jobs/{job_id}/logs`

建议新增，用于日志轮询降级。

### `GET /api/jobs/{job_id}/bundle`

用于拉取 `bundle.zip`。

### `GET /api/jobs/{job_id}/artifacts/{path}`

用于调试时下载单个产物。

## 9.2 建议新增接口

### `POST /api/uploads/reference-image`

用途：

- 上传参考风格图

### 可选：`DELETE /api/uploads/{upload_id}`

用途：

- 清理临时上传资源

## 10. 前后端协议规范

## 10.1 前端请求模型

```ts
interface AutodrawJobDraft {
  methodText: string;
  referenceStyleImage?: File;
  provider: 'openrouter' | 'bianxie' | 'qingyun' | 'gemini';
  apiKey?: string;
  baseUrl?: string;
  imageModel?: string;
  svgModel?: string;
  imageSize: '1K' | '2K' | '4K';
  samPrompt: string;
  samBackend: 'local' | 'fal' | 'roboflow' | 'api';
  samApiUrl?: string;
  samApiKey?: string;
  samMaxMasks: number;
  stopAfter: 1 | 2 | 3 | 4 | 5;
  placeholderMode: 'none' | 'box' | 'label';
  optimizeIterations: number;
  mergeThreshold: number;
}
```

## 10.2 前端 bundle 消费模型

```ts
interface AutodrawBundle {
  manifest?: Record<string, unknown>;
  finalSvgText: string;
  fallbackSvgTexts: string[];
  components: Record<
    string,
    {
      fileName: string;
      url: string;
      preferred: boolean;
    }
  >;
  boxlib?: Record<string, unknown>;
}
```

## 10.3 实时日志事件模型

```ts
interface AutodrawLogEvent {
  jobId: string;
  offset: number;
  line: string;
  level?: 'meta' | 'info' | 'warning' | 'error';
  timestamp?: string;
}
```

## 10.4 导入结果摘要

```ts
interface AutodrawImportSummary {
  jobId?: string;
  textCount: number;
  editableArrowCount: number;
  preservedArrowCount: number;
  componentCount: number;
  ignoredBackgroundCount: number;
  warnings: string[];
}
```

## 11. 分阶段实施计划

## 11.1 阶段 A1：方案与协议评审

目标：

- 冻结前后端边界、入口形式、上传方案和导入流程

验收：

- 本文档评审通过

## 11.2 阶段 A2：独立前端界面

目标：

- 在 Drawnix 中新增 `Autodraw` 独立界面

任务：

- 文本输入区
- 参考风格图上传区
- 参数面板
- 状态面板

验收：

- 用户可以在新界面发起任务，不依赖现有 PaperDraw 界面

## 11.3 阶段 A3：任务调度与轮询

目标：

- 打通提交任务、轮询状态、实时日志与错误反馈

验收：

- 能完成 `submit -> queued/running -> succeeded/failed`
- 前端可实时展示后端运行日志

## 11.4 阶段 A4：日志流与状态面板

目标：

- 为 Autodraw 前端提供稳定的实时日志展示能力

任务：

- 新增日志面板 UI
- 接入 SSE 日志流
- 实现 polling 降级
- 支持自动滚动、复制、下载完整日志

验收：

- 任务运行期间日志能持续更新
- 断开 SSE 后能自动回退轮询
- 任务结束后日志状态正确收口

## 11.5 阶段 A5：bundle 自动导入

目标：

- bundle 下载完成后自动导入 Drawnix

验收：

- 样例任务可自动入板

## 11.6 阶段 A6：协议增强

目标：

- 为 Drawnix 增加稳定导入协议

建议：

- 在 `manifest.json` 中补充 `import_contract`

## 12. 质量标准

- 新界面与现有 PaperDraw 解耦
- 文本输入与参考图上传流程清晰
- 后端任务状态可感知
- 后端运行日志可实时展示
- bundle 自动导入成功率可验证
- 组件图优先 `_nobg`
- 文字、箭头、组件相对位置与总 SVG 一致

## 13. 结论

当前最优路线是：

1. 新增 Drawnix 独立 `Autodraw` 前端界面
2. 该界面支持文本输入和参考风格图上传
3. 调用 `autodraw/backend` 任务接口
4. 任务运行期间实时展示后端日志
5. 任务完成后自动下载 `bundle.zip`
6. 复用 `svg-import` 进行自动导入

这个方案兼顾了：

- 前后端职责清晰
- 与原有 `PaperDraw Flowchart` 解耦
- 对现有后端改动最小
- 对现有 Drawnix 导入能力复用最大
