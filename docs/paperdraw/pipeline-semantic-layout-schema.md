# PaperDraw 论文 Pipeline 语义布局 Schema

> 版本：v1.0  
> 日期：2026-03-13  
> 状态：设计中  
> 关联文档：[pipeline-layout-synthesizer.md](/Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/paperdraw/pipeline-layout-synthesizer.md)

---

## 1. 目标

布局器要先理解“这张图在表达什么”，再决定“节点放哪里”。  
本文件定义从文本抽取得到的 `AnalysisResult` 如何提升为可驱动论文级布局的 `LayoutIntent`。

核心原则：

- 先识别语义角色，再做模板匹配
- 先找主干，再找支路、汇聚、反馈
- 先定区域倾向，再定坐标

---

## 2. 新增语义字段

### 2.1 节点角色 `node.role`

```ts
type NodeRole =
  | 'input'
  | 'process'
  | 'state'
  | 'parameter'
  | 'decoder'
  | 'aggregator'
  | 'simulator'
  | 'output'
  | 'annotation'
  | 'media';
```

说明：

- `input`：输入数据、原始样本、历史帧、初始条件
- `process`：编码、提取、变换、预测等普通步骤
- `state`：状态、当前状态、中间状态、更新后状态
- `parameter`：超参、控制量、嵌入向量、条件输入
- `decoder`：解码器、预测头、接触点回归、输出头
- `aggregator`：融合、拼接、汇总、选择器
- `simulator`：仿真器、优化器、规划器、求解器
- `output`：最终结果、输出表征、更新状态
- `annotation`：纯说明性标签
- `media`：图像、视频帧、特征图、示例图

### 2.2 边角色 `edge.role`

```ts
type EdgeRole =
  | 'main'
  | 'auxiliary'
  | 'control'
  | 'feedback'
  | 'annotation';
```

说明：

- `main`：主干流程边
- `auxiliary`：辅助分支或附属解码支路
- `control`：参数/条件影响
- `feedback`：从后面回到前面或中部的回路
- `annotation`：注释性指向

### 2.3 模块角色 `module.role`

```ts
type ModuleRole =
  | 'input_stage'
  | 'core_stage'
  | 'auxiliary_stage'
  | 'control_stage'
  | 'output_stage';
```

### 2.4 轨道倾向 `railPreference`

```ts
type RailPreference =
  | 'left_input_rail'
  | 'main_rail'
  | 'top_control_rail'
  | 'bottom_aux_rail'
  | 'right_output_rail'
  | 'outer_feedback_rail';
```

### 2.5 视觉原型 `visualPrimitive`

```ts
type VisualPrimitive =
  | 'container'
  | 'block'
  | 'small-block'
  | 'state-card'
  | 'media-card'
  | 'aggregator'
  | 'simulator';
```

---

## 3. 目标输出结构

后续布局器的直接输入建议统一为：

```ts
interface LayoutIntentNode {
  id: string;
  role: NodeRole;
  primitive: VisualPrimitive;
  importance: number;
  moduleId?: string;
  preferredRail?: RailPreference;
  isMainSpineCandidate: boolean;
}

interface LayoutIntentEdge {
  id: string;
  role: EdgeRole;
  sourceId: string;
  targetId: string;
  priority: number;
}

interface LayoutIntentModule {
  id: string;
  role: ModuleRole;
  preferredRail?: RailPreference;
  members: string[];
}

interface LayoutIntent {
  nodes: LayoutIntentNode[];
  edges: LayoutIntentEdge[];
  modules: LayoutIntentModule[];
  dominantSpine: string[];
  branchRoots: string[];
  mergeNodes: string[];
  feedbackEdges: string[];
  layoutHints: string[];
}
```

### 3.1 `LayoutIntent v1` 字段冻结

为了避免后续实现阶段字段继续漂移，先冻结 `v1` 结构：

#### 必填字段

- `LayoutIntentNode.id`
- `LayoutIntentNode.role`
- `LayoutIntentNode.primitive`
- `LayoutIntentNode.importance`
- `LayoutIntentNode.isMainSpineCandidate`
- `LayoutIntentEdge.id`
- `LayoutIntentEdge.role`
- `LayoutIntentEdge.sourceId`
- `LayoutIntentEdge.targetId`
- `LayoutIntentEdge.priority`
- `LayoutIntentModule.id`
- `LayoutIntentModule.role`
- `LayoutIntentModule.members`
- `LayoutIntent.dominantSpine`
- `LayoutIntent.branchRoots`
- `LayoutIntent.mergeNodes`
- `LayoutIntent.feedbackEdges`

#### 可选字段

- `moduleId`
- `preferredRail`
- `layoutHints`

#### 默认值

| 字段 | 默认值 |
|------|--------|
| `importance` | `0.5` |
| `priority` | `0.5` |
| `role` | `process` |
| `primitive` | `block` |
| `preferredRail` | `undefined` |
| `isMainSpineCandidate` | `false` |

#### 非法状态

以下状态在进入模板匹配前必须被修正：

- `dominantSpine` 为空
- `feedbackEdges` 同时出现在 `dominantSpine`
- `annotation` 节点出现在主干
- `output` 节点大面积出现在输入模块
- `module.members` 为空

### 3.2 实现边界

`LayoutIntent v1` 只服务布局器，不直接服务渲染器。  
渲染器仍消费布局结果；视觉原型和角色在这一阶段只作为布局决策依据与后续视觉优化入口。

---

## 4. 角色推断来源

角色推断必须同时结合三类信号：

### 4.1 文本词汇信号

节点名称里的关键词可作为第一层强信号：

| 关键词模式 | 倾向角色 |
|-----------|---------|
| `input`, `raw`, `source`, `initial`, `frame`, `history` | `input` |
| `encoder`, `extractor`, `backbone`, `embedding` | `process` |
| `decoder`, `head`, `predictor`, `regressor` | `decoder` |
| `fusion`, `concat`, `aggregate`, `selector` | `aggregator` |
| `state`, `current state`, `updated state` | `state` / `output` |
| `parameter`, `condition`, `prompt`, `force`, `rubric` | `parameter` / `control` |
| `simulation`, `optimizer`, `solver`, `planner` | `simulator` |
| `output`, `result`, `prediction`, `label` | `output` |

### 4.2 拓扑结构信号

图结构本身能进一步修正角色：

- 入度为 `0` 且位于主链起点，优先考虑 `input`
- 出度大于 `1` 的节点，若后续再汇聚，优先考虑 `aggregator` 或 `split source`
- 入度大于 `1` 的节点，优先考虑 `merge / aggregator / simulator`
- 从后层回指前层的边，优先标记为 `feedback`
- 只与一个主节点相连、且不在主干上的节点，优先标记为 `parameter` 或 `annotation`

### 4.3 模块和段落信号

- 模块标题中含 `input / data / source`，模块倾向 `input_stage`
- 模块标题中含 `decoder / auxiliary / branch`，模块倾向 `auxiliary_stage`
- 模块标题中含 `output / result / updated`，模块倾向 `output_stage`
- 其余承载大部分主链节点的模块，默认 `core_stage`

---

## 5. 主干、分支、汇聚、反馈识别

### 5.1 主干 `dominantSpine`

主干不是简单最长路径，而应综合以下因素：

- 边角色更偏 `main`
- 节点重要性更高
- 路径跨越模块更多
- 路径更符合阅读方向

建议评分：

```text
SpineScore(path) =
  0.45 * pathNodeImportance +
  0.25 * pathMainEdgeWeight +
  0.20 * moduleCoverage +
  0.10 * directionalConsistency
```

### 5.2 分支 `branch`

分支通常有以下特征：

- 从主干中部或前部发出
- 节点数量较少
- 终点是主干后续节点、汇聚节点或输出节点

### 5.3 汇聚 `merge`

满足以下任一条件即可认定为汇聚候选：

- 入度大于等于 `2`
- 模块内有多个支路 converging
- 语义标签含 `fusion / merge / aggregation / combine`

### 5.4 反馈 `feedback`

满足以下任一条件即可认定为反馈：

- 边从拓扑后层指向前层
- 边从 `output/state` 指回 `process/simulator`
- 语义标签含 `update / refine / loop / recurrent / iterative`

---

## 6. 轨道倾向推断

轨道推断不直接决定最终坐标，但会强影响模板选择。

### 6.1 节点轨道

| 角色 | 默认轨道 |
|------|---------|
| `input`, `media` | `left_input_rail` |
| `process`, `aggregator`, `simulator` | `main_rail` |
| `parameter` | `top_control_rail` |
| `decoder`, `auxiliary` | `bottom_aux_rail` |
| `output`, `state` | `right_output_rail` |
| `feedback` 相关节点 | `outer_feedback_rail` |

### 6.2 模块轨道

模块轨道由成员角色投票得到：

```text
module preferredRail = argmax(sum(role vote))
```

如果主干覆盖率高，则强制回到 `main_rail`。

---

## 7. 视觉原型映射

角色不仅影响布局，也影响视觉原型。

| role | primitive |
|------|-----------|
| `input` + 多媒体 | `container` / `media-card` |
| `parameter` | `small-block` |
| `process` | `block` |
| `state` | `state-card` |
| `aggregator` | `aggregator` |
| `simulator` | `simulator` |
| `output` | `state-card` / `block` |

第一阶段即使仍只输出矩形，也要保留 `primitive` 字段，后续给视觉元素优化器使用。

---

## 8. 置信度与本地修正

角色推断不能完全依赖模型。需要增加本地修正规则：

### 8.1 低置信修正

- 若文本信号弱，但拓扑信号非常强，则以拓扑为准
- 若模块内大多数节点是 `process`，单个弱信号节点不要轻易升成 `output`
- 若一条边被识别为 `feedback`，但并未反向或形成回路，则降级为 `auxiliary`

### 8.2 冲突修正

冲突示例：

- 节点被标为 `input`，但位于主链尾部
- 节点被标为 `parameter`，但出现在主链连续路径中
- `annotation` 节点拥有多个结构性出边

修正规则：

- 主链位置优先级高于词面标签
- 汇聚/回路位置优先级高于普通模块归属
- `annotation` 不能进入主干

### 8.3 角色冲突优先级

当一个节点同时命中多个角色时，按以下优先级裁决：

```text
simulator > aggregator > decoder > output > state > input > parameter > process > annotation
```

原因：

- `simulator`、`aggregator`、`decoder` 会直接影响模板和汇聚方式
- `annotation` 永远不应覆盖结构角色

### 8.4 边角色冲突优先级

```text
feedback > main > control > auxiliary > annotation
```

原因：

- `feedback` 若误判，会严重破坏整体骨架
- `annotation` 是最后兜底角色

---

## 9. 面向模板库的接口

语义层最终要服务模板匹配器，因此必须输出以下摘要：

```ts
interface TemplateMatchingFeatures {
  spineLength: number;
  branchCount: number;
  mergeCount: number;
  feedbackCount: number;
  hasInputContainer: boolean;
  hasStatePair: boolean;
  hasTopControlRail: boolean;
  hasBottomAuxRail: boolean;
  hasRightOutputRail: boolean;
}
```

这些特征会直接决定候选模板的排名。

### 9.1 `LayoutIntent` 构建流程

推荐固定为：

1. 读取 `AnalysisResult`
2. 计算主干候选
3. 识别分支、汇聚、反馈
4. 推断节点角色
5. 推断边角色
6. 推断模块角色
7. 推断轨道倾向
8. 生成 `TemplateMatchingFeatures`
9. 产出 `LayoutIntent`

后续实现中不允许跳步直接从 `AnalysisResult` 进入模板匹配。

---

## 10. 例子：图 2 的语义解释

对于“输入容器 + 双支路 + 物理模拟 + 状态更新”这类论文图，语义层理想输出应接近：

- 左侧大容器：`input_stage`，包含 `media + initial state`
- 上方主支路：`encoder -> embedding -> force decoder`
- 下方辅助支路：`contact point decoder`
- 中右大节点：`physics simulation`，角色为 `simulator`
- 右侧节点：`updated state`，角色为 `output/state`
- 从 `force decoder`、`contact point decoder` 指向 `physics simulation` 的边为 `main + merge`

这时模板库就能明显偏向：

- `input-core-output`
- `spine-lower-branch`
- `paired-state-simulator`

---

## 11. 当前设计结论

1. 语义层必须升级，不能只靠 `sequential / modular / annotative`
2. 后续布局质量的上限，首先取决于 `LayoutIntent` 是否足够准确
3. 主干、分支、汇聚、反馈、轨道倾向和视觉原型都应该在布局前被显式建模
4. 没有这一步，后续再好的 ELK 或路由器也只会把“错误结构”排得更整齐
