# PaperDraw 论文 Pipeline 布局合成器设计

> 版本：v1.0  
> 日期：2026-03-13  
> 状态：设计中，最高优先级  
> 关联文档：[PRD.md](/Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/paperdraw/PRD.md)

---

## 1. 问题重述

当前布局效果不理想，根因不是“参数还不够好”，而是系统仍然把论文流程图当作通用 DAG 自动布局问题处理。这样会天然收敛为两类僵硬结果：

- 一条横向主链
- 一组纵向堆叠列

但真实论文中的 pipeline 通常不是简单的 `LR` 或 `TB` 排列，而是更接近以下组合：

- 一条主干流程 `spine`
- 若干侧支 `branch`
- 一个或多个汇聚点 `merge`
- 输入区、参数区、辅助区、输出区分别占据稳定空间区域
- 模块既是语义单元，也是视觉分区单元
- 图中常同时存在容器、图像、状态框、处理块、模拟器、注释轨道

因此，后续目标不应再定义为“图布局优化器”，而应定义为：

**面向论文 pipeline 的专用布局合成器（Pipeline Layout Synthesizer）**

---

## 2. 总体目标

新的布局系统要优先满足以下目标：

1. 生成结果应近似拟合大部分论文 pipeline 的视觉组织方式，而不是只会横排或竖排。
2. 主干流程必须清晰，用户一眼能看出“从哪里输入，经过哪些核心步骤，最后输出到哪里”。
3. 模块必须是一级视觉结构，不是事后包裹框。
4. 辅助支路、控制支路、反馈回路、注释信息应进入不同的空间轨道，而不是和主链抢同一条通道。
5. 连线必须服务阅读流，而不是反过来主导节点排布。

---

## 3. 论文 Pipeline 的结构先验

### 3.1 常见整体构型

后续布局器必须优先识别并生成以下高频构型：

- `Linear Spine`：左到右的主干流程
- `Spine + Lower Branch`：主干在中上方，辅助解码/预测/约束支路在下方
- `Split -> Merge`：一个节点分裂为多条支路，后续汇聚
- `Input Container + Core Pipeline + Output`：左侧输入容器，中间核心处理，右侧输出
- `State Transition`：状态图像或状态框成对出现，并围绕中间处理块更新
- `Feedback Loop`：输出或模拟结果反馈到中间某个阶段
- `Parameter/Control Rail`：参数、超参、控制信息位于上侧轨道或侧轨道

### 3.2 常见局部原型

节点层面也不能只剩一种矩形。后续布局器至少要支持以下视觉原型：

- `container`：带边框的大输入容器
- `process block`：普通算法步骤块
- `state block`：状态/结果/中间表征
- `parameter block`：小型参数节点
- `aggregator`：汇聚节点或融合节点
- `simulator`：物理仿真/优化器/解码器等特殊核心节点
- `media block`：图像、视频帧、特征图占位块

即使第一阶段仍只用矩形，也要在布局语义上先区分这些角色。

---

## 4. 新的语义建模

当前仅有 `sequential / modular / annotative` 三类关系，不足以驱动论文级布局。必须扩展语义层。

### 4.1 节点角色

新增 `node.role`：

- `input`
- `process`
- `state`
- `parameter`
- `decoder`
- `aggregator`
- `simulator`
- `output`
- `annotation`
- `media`

### 4.2 边角色

新增 `edge.role`：

- `main`：主干流程
- `auxiliary`：辅助支路
- `control`：控制/条件/参数影响
- `feedback`：反馈边
- `annotation`：说明边

### 4.3 模块角色

新增 `module.role`：

- `input_stage`
- `core_stage`
- `auxiliary_stage`
- `control_stage`
- `output_stage`

### 4.4 区域轨道

新增布局时使用的空间区域 `rail`：

- `left_input_rail`
- `main_rail`
- `top_control_rail`
- `bottom_aux_rail`
- `right_output_rail`
- `outer_feedback_rail`

结论：后续布局输入不再只是 `nodes + edges + groups`，而是：

- 语义图
- 角色标注
- 模式候选
- 轨道分配

---

## 5. 新的三层布局架构

新的算法不直接“算坐标”，而是分三层：

### 5.1 宏观层：画布分区（Canvas Zoning）

目标：先确定每个子图属于哪一个区域。

输入：

- 模块 DAG
- 节点/边角色
- 论文版式约束（单栏/双栏）

输出：

- 各模块所属 `rail`
- 主干 spine 位置
- 输入区、辅助区、输出区、反馈区的大致占位框

核心原则：

- `input` 优先放左侧或左上输入区
- `main` 流程放主干轨道
- `control` 优先上方
- `auxiliary / decoder` 优先下方
- `output / state_t+1` 优先右侧
- `feedback` 优先外圈，不穿主干

### 5.2 中观层：模式合成（Pattern Composition）

目标：把论文 pipeline 视为若干高频模板的组合。

流程：

1. 找主干路径 `dominant spine`
2. 找分支、汇聚、反馈和注释
3. 识别局部模式
4. 选取一个全局模板 + 若干局部模板
5. 组合成布局骨架

典型模板：

- `T1: horizontal spine`
- `T2: spine + lower branch`
- `T3: split-merge`
- `T4: left input container + center process + right output`
- `T5: paired states around a core simulator`
- `T6: outer feedback loop`

这一层的输出不是最终坐标，而是：

- 模块骨架顺序
- 支路附着点
- 汇聚点位置
- 区域间相对关系

### 5.3 微观层：局部排布与路由（Local Layout + Routing）

目标：在模板骨架内部做细化。

包含两部分：

1. 模块内部排布
2. 跨模块正交路由

模块内部不再只有：

- `TB`
- `2列网格`

而要支持：

- `horizontal pair`
- `vertical pair`
- `media + caption`
- `small fan-out`
- `small fan-in`
- `stacked states`

连线则分不同通道：

- 主干通道
- 辅助通道
- 控制通道
- 外围反馈通道
- 注释通道

---

## 6. 布局生成策略重构

### 6.1 从“候选坐标”改成“候选骨架”

当前候选生成器主要变体仍是：

- 不同方向
- 不同间距
- 不同轻微偏移

这不够。后续候选应改成“骨架级候选”：

- 候选 A：`spine + lower branch`
- 候选 B：`input container + core spine + output`
- 候选 C：`split-merge + feedback`
- 候选 D：`double-column stage blocks + side notes`

也就是说，候选之间的差异应是**结构原型不同**，而不是只差一点点 spacing。

### 6.2 模式打分

每个候选骨架需要独立打分，评分应包含：

- 主干清晰度
- 模块聚合度
- 视觉平衡度
- 论文版式适配度
- 辅助支路可读性
- 反馈路径外圈化程度
- 边交叉与遮挡惩罚

新增两个关键指标：

- `Spine Readability Score`
- `Branch Separation Score`

---

## 7. 路由器目标重构

连线不应再只是“避障 + 少拐点”，而应服从论文图的阅读语法。

### 7.1 硬约束

- 任意边不得穿过非源/非目标实体
- 跨模块边不得穿过无关模块
- 反馈边不得切穿主干区
- 控制边不得压住主链核心节点

### 7.2 软约束

- 主干边尽量短、尽量直
- 辅助边走下轨道
- 控制边走上轨道
- 反馈边走外围
- 注释边不打断主阅读流

### 7.3 新的路由层级

后续路由器建议分四级执行：

1. 先路由主干
2. 再路由汇聚相关边
3. 再路由辅助/控制边
4. 最后路由反馈和注释边

这样可以保证最重要的边先占最好的通道。

---

## 8. 为什么不能只继续调 ELK

ELK 仍然有价值，但不能再充当唯一主布局器。

ELK 适合做：

- 层次化微调
- crossing minimization
- 正交 bend point 初稿
- compound node 精排

ELK 不适合单独做：

- 论文 pipeline 模式选择
- 区域轨道划分
- 输入区/输出区/控制区的语义布局
- 反馈环的论文风格外圈布置
- 图像块、状态块、参数块的特殊摆位

结论：

**ELK 后续只作为“局部精排器”，不是最终布局决策器。**

---

## 9. 推荐的新实现路线

按优先级，后续应分四个阶段推进。

### 阶段 A：模式建模与语义增强

目标：

- 扩展 `node.role / edge.role / module.role`
- 做主干、分支、汇聚、反馈检测
- 给每张图生成 `layout intent`

输出：

- `PipelineSemanticGraph`
- `LayoutIntent`

### 阶段 B：布局模板库

目标：

- 实现一批高频论文模板
- 让生成结果先“像论文图”

首批模板建议：

- `spine-lower-branch`
- `input-core-output`
- `split-merge`
- `paired-state-simulator`
- `outer-feedback`

### 阶段 C：模板驱动的骨架合成器

目标：

- 先出骨架
- 再填坐标
- 再交给 ELK 做局部精排

输出：

- `SkeletonLayout`
- `RailAssignment`
- `AnchorSlots`

### 阶段 D：路由器 v3

目标：

- 主干、支路、反馈分层路由
- 走廊分配
- 外围回路
- rip-up reroute

这是后续真正决定“像不像论文图”的关键阶段。

---

## 10. 第一批必须覆盖的样例集

为了避免算法继续朝“横排 / 竖排”退化，后续必须建立固定样例集。

至少覆盖：

1. 左输入容器 + 中间主干 + 右输出
2. 主干 + 下方辅助解码支路
3. 双支路汇聚到一个模拟器
4. 状态更新图 `S_t -> simulator -> S_t+1`
5. 带外圈反馈回路的 pipeline
6. 多模块但非均匀列对齐的论文图

验收时不能只看：

- 是否没重叠
- 是否能生成图

而必须看：

- 是否接近样例的视觉组织方式

---

## 11. 后续文档与代码边界

本文件负责定义：

- 论文 pipeline 布局器的目标
- 语义扩展方向
- 三层算法架构
- 模板库与路由器的重构思路

配套文档：

- [pipeline-semantic-layout-schema.md](/Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/paperdraw/pipeline-semantic-layout-schema.md)
- [pipeline-layout-pattern-library.md](/Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/paperdraw/pipeline-layout-pattern-library.md)
- [pipeline-routing-v3.md](/Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/paperdraw/pipeline-routing-v3.md)
- [pipeline-layout-evaluation.md](/Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/paperdraw/pipeline-layout-evaluation.md)

`PRD.md` 继续保留为总方案文档。

---

## 12. 当前共识

基于当前讨论，已有以下共识：

1. 现有布局器过于依赖通用图布局思想，导致结果僵硬。
2. 论文 pipeline 的核心不是简单 `LR/TB`，而是“主干 + 支路 + 区域 + 角色”。
3. 布局器必须从“图自动布局”升级为“论文 pipeline 合成器”。
4. 后续最高优先级不是再调 spacing，而是先完成：
   - 语义角色增强
   - 模式库建设
   - 骨架合成
   - 分层路由

这部分为 PaperDraw 当前最高优先级问题。
