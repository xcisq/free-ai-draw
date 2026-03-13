# PaperDraw 论文 Pipeline 模板库

> 版本：v1.0  
> 日期：2026-03-13  
> 状态：设计中  
> 关联文档：[pipeline-layout-synthesizer.md](/Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/paperdraw/pipeline-layout-synthesizer.md)  
> 关联文档：[pipeline-semantic-layout-schema.md](/Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/paperdraw/pipeline-semantic-layout-schema.md)

---

## 1. 目标

模板库的目标不是提供“好看的例子”，而是给布局器提供一组可选的**论文 pipeline 骨架原型**。

后续布局系统必须先从模板库中选出最匹配的骨架，再做细化坐标与路由。

---

## 2. 模板系统总览

模板分两级：

- **全局模板**：决定整张图的整体骨架
- **局部模板**：决定模块内部、局部支路、输入容器或状态对的细节

组合方式：

```text
Global Template
  + Local Template A
  + Local Template B
  + Local Template C
  => Skeleton Layout
```

---

## 3. 全局模板库

### G1 `linear-spine`

适用条件：

- 主干很长
- 分支很少
- 汇聚很少
- 整体以顺序步骤为主

骨架：

```text
Left -> Center -> Right
```

适合：

- 传统算法流程
- 多阶段方法管线

风险：

- 一旦存在明显辅助支路，容易显得过直

---

### G2 `input-core-output`

适用条件：

- 左侧存在明显输入容器或输入模块
- 中间存在核心处理主链
- 右侧存在明确输出

骨架：

```text
[Input Zone] -> [Core Spine] -> [Output Zone]
```

适合：

- 图像/视频/传感器输入方法图
- 论文里左输入右输出的标准 pipeline

---

### G3 `spine-lower-branch`

适用条件：

- 主干清晰
- 有至少一条辅助支路从主干中部发出
- 支路在后续阶段回到主干或汇聚到终点

骨架：

```text
Main Spine
   |
Lower Auxiliary Branch
   |
 Merge / Join
```

适合：

- `encoder + decoder`
- `feature branch + auxiliary prediction`
- `contact point decoder + force branch`

---

### G4 `split-merge`

适用条件：

- 一个节点或模块后面明显分叉
- 多条分支后续汇聚到一个聚合器、模拟器或输出

骨架：

```text
Split -> Branch A
      -> Branch B
      -> Branch C
         Merge
```

适合：

- 多模态融合
- 多分支预测
- 主干 + 控制 + 辅助共同汇聚

---

### G5 `paired-state-simulator`

适用条件：

- 存在 `state_t` 与 `state_t+1`
- 中间有 `simulation / optimizer / planner`
- 状态更新是整张图的核心语义

骨架：

```text
Current State -> Simulator -> Updated State
         ^           ^
       Aux         Control
```

适合：

- 物理模拟
- 动力学预测
- 规划与控制闭环

---

### G6 `top-control-main-bottom-aux`

适用条件：

- 主干之外还有明显控制输入
- 下方有辅助支路
- 上方和下方都不应和主链挤在一起

骨架：

```text
Top Control Rail
Main Spine
Bottom Auxiliary Rail
```

适合：

- 参数控制型方法图
- 条件输入 + 主流程 + 辅助预测

---

### G7 `outer-feedback-loop`

适用条件：

- 有至少一条明显回路
- 回路不应切穿主链

骨架：

```text
Main Spine -> Output
  ^           |
  |-----------|
```

适合：

- 迭代优化
- recurrent / refinement
- update loop

---

## 4. 局部模板库

### L1 `input-container-stack`

结构：

- 大容器
- 内部是若干时间帧、图像或输入卡片
- 可附带初始状态小卡片

### L2 `horizontal-pair`

结构：

- 两个关系紧密的节点横向摆放

适合：

- `encoder + embedding`
- `state + feature`

### L3 `vertical-pair`

结构：

- 两个关系紧密的节点纵向摆放

适合：

- `module title + content`
- `state + result`

### L4 `small-fan-out`

结构：

- 一个局部节点向 2-3 个节点扩散

### L5 `small-fan-in`

结构：

- 2-3 个局部节点汇入一个中心节点

### L6 `media-with-caption`

结构：

- 图像卡片
- 说明文本位于下方或侧方

### L7 `state-before-after`

结构：

- 左侧当前状态
- 右侧更新状态
- 中间不直接承载大主链，只作为状态对

---

## 5. 模板匹配特征

模板选择必须基于明确特征，而不是人工猜。

```ts
interface TemplateFitFeatures {
  spineLength: number;
  branchCount: number;
  mergeCount: number;
  feedbackCount: number;
  inputContainerCount: number;
  stateNodeCount: number;
  simulatorNodeCount: number;
  topControlCount: number;
  bottomAuxCount: number;
  outputNodeCount: number;
}
```

---

## 6. 模板选择规则

### 6.1 全局模板优先级

可按规则初筛：

1. 若存在明显 `input container + output`，优先 `G2`
2. 若存在明显下支路并回汇，优先 `G3`
3. 若存在高置信 `split/merge`，优先 `G4`
4. 若存在 `state pair + simulator`，优先 `G5`
5. 若存在显著反馈，额外叠加 `G7`
6. 若没有强特征，再回退 `G1`

### 6.2 多模板组合

允许：

- `G2 + G3`
- `G2 + G5`
- `G3 + G7`
- `G6 + G4`

不允许：

- 同时使用两个相互冲突的全局骨架

### 6.3 全局模板优先级冻结

当多个全局模板都可用时，优先级固定为：

```text
G5 paired-state-simulator
> G3 spine-lower-branch
> G4 split-merge
> G2 input-core-output
> G7 outer-feedback-loop
> G6 top-control-main-bottom-aux
> G1 linear-spine
```

说明：

- `G5`、`G3`、`G4` 结构辨识度高，且对最终布局影响最大
- `G7` 更适合作为叠加模板，而不是根模板
- `G1` 只作为最末 fallback

### 6.4 模板冲突处理

典型冲突与处理规则：

#### 冲突 A：`G2` 与 `G4`

- 若输入区和输出区都非常强，同时又存在分支汇聚
- 处理：以 `G2` 做根模板，以 `G4` 作为中部局部结构

#### 冲突 B：`G3` 与 `G6`

- 若同时有下支路和上控制轨道
- 处理：以 `G3` 做主结构，`G6` 只补充 `top_control_rail`

#### 冲突 C：`G5` 与 `G7`

- 若既有状态更新，又有外围反馈
- 处理：以 `G5` 为根模板，`G7` 叠加到外围通道

### 6.5 回退顺序

若没有模板达到置信阈值，按以下顺序回退：

1. `G2`
2. `G3`
3. `G1`

原因：

- `G2` 最接近多数论文方法图
- `G3` 覆盖大部分主干+支路结构
- `G1` 只保证基本可读性

---

## 7. 模板骨架输出

模板选择器不直接输出坐标，而输出：

```ts
interface SkeletonLayout {
  globalTemplateId: string;
  localTemplateIds: string[];
  rails: Record<string, string>;
  blockSequence: string[];
  branchAttachments: Array<{
    branchRootId: string;
    attachToId: string;
    side: 'top' | 'bottom' | 'left' | 'right';
  }>;
  mergeTargets: string[];
  feedbackLoops: string[];
}
```

---

## 8. 模板评分

除了语义匹配分数，模板还要有视觉适配评分：

```text
TemplateScore =
  0.35 * semanticFit +
  0.20 * spineReadability +
  0.15 * branchSeparation +
  0.10 * mergeClarity +
  0.10 * profileCompatibility +
  0.10 * estimatedRoutingEase
```

### 8.1 关键指标

- `semanticFit`：角色、轨道、结构是否匹配
- `spineReadability`：主干是否连续、是否易于阅读
- `branchSeparation`：支路是否和主链清晰分开
- `mergeClarity`：汇聚是否自然
- `profileCompatibility`：是否适配单栏/双栏版式
- `estimatedRoutingEase`：是否容易路由出少交叉、少拐点的线

### 8.2 最低接受阈值

模板候选若满足以下任一条件，应直接淘汰：

- `semanticFit < 0.55`
- `spineReadability < 0.5`
- `estimatedRoutingEase < 0.45`

### 8.3 决策流程

模板选择固定为：

1. 计算所有模板的 `fit`
2. 过滤低于阈值的模板
3. 选根模板
4. 附加局部模板
5. 冲突消解
6. 生成 `SkeletonLayout`
7. 若失败则走回退模板

---

## 9. 样例映射

### 样例 A：你给出的第二张论文图

建议匹配：

- 全局：`G2 input-core-output`
- 全局叠加：`G3 spine-lower-branch`
- 局部：`L1 input-container-stack`
- 局部：`L7 state-before-after`

### 样例 B：标准方法流程图

建议匹配：

- 全局：`G1 linear-spine`
- 若存在上方超参：叠加 `G6 top-control-main-bottom-aux`

### 样例 C：多模态融合图

建议匹配：

- 全局：`G4 split-merge`
- 若存在最终输出反馈：叠加 `G7 outer-feedback-loop`

---

## 10. 第一阶段必须实现的模板

为保证投入产出比，首批只实现以下 5 个：

1. `G2 input-core-output`
2. `G3 spine-lower-branch`
3. `G4 split-merge`
4. `G5 paired-state-simulator`
5. `G7 outer-feedback-loop`

原因：

- 这 5 个模板可以覆盖大部分论文 pipeline 的高频组织方式
- 能显著摆脱当前“纯横排 / 纯竖排”的僵硬结果

### 10.1 暂缓实现的模板

以下模板不进入第一阶段：

- 多页流程图
- 环形布局
- 大规模矩阵布局
- 高密度双向图
- 复杂 U-Net 对称结构

原因：

- 当前最高优先级是“先接近大部分论文 pipeline”
- 不应在第一阶段就追求极端覆盖率

---

## 11. 当前设计结论

1. 候选布局必须从“方向变体”升级为“模板变体”
2. 后续布局质量的关键不在 spacing，而在模板匹配是否正确
3. 模板库是连接“语义理解”和“坐标生成”的中间层
4. 没有模板层，布局器就很难接近论文中的真实组织方式
