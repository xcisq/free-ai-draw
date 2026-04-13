# Autodraw 执行计划

> 版本：v1.0  
> 日期：2026-04-13  
> 状态：待评审  
> 适用范围：`autodraw/backend/**`、`packages/drawnix/src/autodraw/**`、`packages/drawnix/src/svg-import/**`

## 1. 文档定位

本文件是 Autodraw 与 Drawnix 集成能力的执行基线，用于统一：

- 目标范围
- 执行顺序
- 分阶段任务
- 验收标准
- 需求变更流程

详细方案、接口协议、交互设计与数据流见：

- [drawnix-integration-plan.md](file:///Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/autodraw/drawnix-integration-plan.md)

## 2. 总目标

在 Drawnix 中新增一个独立的 `Autodraw` 前端入口，支持：

- 输入方法描述文本
- 上传参考风格图片
- 提交 `autodraw/backend` 生成任务
- 轮询任务状态
- 实时展示后端运行日志
- 自动下载 `bundle.zip`
- 自动导入 Drawnix 画板

## 3. 分阶段计划

## 3.1 阶段 A1：方案评审

- 完成边界确认
- 冻结前端入口与上传方式
- 冻结 bundle 消费规则

## 3.2 阶段 A2：独立前端界面

- 新建 `Autodraw` 界面
- 提供文本输入区
- 提供参考风格图上传区
- 提供参数配置区

## 3.3 阶段 A3：后端任务调度

- 接入 `POST /api/jobs`
- 接入 `GET /api/jobs/{job_id}`
- 展示状态、错误和日志入口

## 3.4 阶段 A4：实时日志面板

- 新增日志展示区域
- 接入 `logs/stream` 实时日志流
- 增加 `logs` 轮询降级
- 支持自动滚动、复制和下载日志

## 3.5 阶段 A5：bundle 自动导入

- 下载 `bundle.zip`
- 解析 `final.svg`
- 解析 `icons/*_nobg.png`
- 调用 `svg-import` 自动导入

## 3.6 阶段 A6：协议增强

- 为 `manifest.json` 增加稳定导入契约
- 明确前后端导入字段版本

## 4. 验收标准

- Autodraw 入口独立存在
- 可输入文本并上传参考图
- 可成功提交后端任务
- 可轮询并看到任务状态
- 可实时看到后端运行日志
- 成功任务可自动导入 Drawnix
- 与现有 `PaperDraw Flowchart` 分支解耦

## 5. 需求变更流程

若后续修改以下内容，必须先更新本文档与 `drawnix-integration-plan.md`：

- 前端入口形态
- 参考图上传方式
- 日志展示方式与日志接口
- 后端接口契约
- bundle 导入规则
- 分阶段计划与验收标准
