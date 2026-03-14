# PaperDraw 优化执行计划

> 版本：v1.3
> 日期：2026-03-14
> 状态：执行中
> 适用范围：`packages/drawnix/src/paperdraw/**` 及其相关文档、测试、评估链路

## 1. 文档定位

本文件是 PaperDraw 后续开发的唯一执行基线，用来统一以下内容：

- 当前问题诊断
- 优化目标与非目标
- 分阶段开发计划
- 每阶段的任务拆解、交付物、验收标准
- 需求变更流程

后续所有 PaperDraw 相关需求、修复、重构、评估工作，默认都应先对齐本文件，再进入代码实现。

## 2. 执行原则

### 2.1 总原则

- 先修语义结构，再修布局，再修路由，最后再做视觉打磨。
- 先补真实语料与可观测性，再调算法参数。
- 优先减少错误和冗余边，而不是一味增加布局规则。
- 优先让主干清晰、分支可读、反馈闭环明确，而不是追求局部复杂排布。
- 保持小步迭代，每一步都能被测试、样例或评估指标验证。

### 2.2 当前非目标

当前阶段不优先处理：

- 生产部署与在线服务化
- 风格模板库的完整视觉优化
- 多语言 prompt 精修
- 大规模模型供应商兼容层

## 3. 当前问题诊断

## 3.1 文本解析器问题

当前解析输出过于扁平，只提供 `entities / modules / relations`，且关系仅限 `sequential` 与 `annotative`。这会带来几个直接问题：

- 缺少 `nodeRole / edgeRole / moduleRole` 等显式语义字段。
- 缺少主干、分支、汇聚、反馈等结构级信息。
- 缺少关系重要性、关系必要性、候选主链顺序。
- 布局器只能依赖关键词和拓扑做二次猜测，导致真实论文语义被弱化。

当前代码证据：

- `prompt-config.ts` 只要求输出 `entities / modules / relations`
- `pipeline-layout-intent.ts` 通过关键词和图结构反推角色

## 3.2 语义归一化与 QA 问题

`validator` 当前更像“保底出图修复器”，不是“保真语义校正器”：

- 会按 label 合并重复实体，可能误合并不同语义节点。
- 没有顺序边时自动补主链，容易把真实结构压成线性流。
- 模块不足时按主链切块，可能得到假的阶段结构。
- 没有做冗余边裁剪、传递约简、主干边筛选。

QA 当前也没有校正结构，只校正：

- 模块归属
- 低置信实体保留
- 关键实体重要性

缺失能力：

- 关系冗余判断
- 主干确认
- merge 节点确认
- feedback 边确认
- control / aux 边确认

## 3.3 模板与骨架问题

当前模板布局已接近“规则式骨架引擎”，但与论文 pipeline 图还有差距：

- 模板匹配依赖弱语义，容易退化到常见模板。
- 文档中的 `G6 top-control-main-bottom-aux` 尚未成为代码中的正式模板类型。
- 模块内部主要仍是一列或两列布局，局部模式不够丰富。
- 整体骨架本质仍围绕 `LR / TB` 方向切换，布局形态不够多样。

结果就是：

- 图能排开，但很难有论文图那种明确的主视觉结构。
- 有控制轨、辅助轨时仍容易被塞回普通左右布局。

## 3.4 路由问题

当前路由器的主要问题不是“不能避障”，而是“没有真正落实论文阅读语法”：

- `pipeline-router-v3` 定义了 corridor，但没有把 corridor 变成真实的通道保留机制。
- 端口槽位分配存在实现缺陷，key 带了 `edge.id`，导致多边无法真正共享同侧槽位。
- 没有主干 bundling、merge bus、branch bundling、feedback 外圈保留。
- 冗余边过多时，路由器只能把更多线“合法地绕开”，无法把图变清爽。

## 3.5 评估口径问题

当前评估更接近“给一份干净结构，布局能不能工作”，而不是“真实论文文本进来，能不能得到论文级效果”：

- fixture 直接手写 `AnalysisResult`
- 没覆盖文本解析器和 validator 的真实退化路径
- 缺少真实论文语料库和全链路 trace
- 缺少视觉层面的人工验收口径

## 4. 优化目标

本轮优化目标不是“继续增加规则”，而是建立一条可靠的全链路：

1. 真实论文文本进入后，能得到更稳定的语义结构。
2. 主干、分支、汇聚、反馈能显式区分。
3. 骨架布局不再只退化为简单左右或上下。
4. 线条数量下降，主干边更清晰，辅助边更克制。
5. 每一轮改动都能通过真实样例、指标和测试验证。

## 5. 分阶段执行计划

## 5.0 当前执行状态

### 已完成

- `P0-2`：布局评估 trace 导出与结果序列化
- `P1-1`：`roleCandidate / spineCandidate` 中间语义接入
- `P1-2`：提取 prompt 升级，要求显式输出主干和角色候选
- `P2-1`：冗余顺序边裁剪与主干候选保留
- `P2-2`：收紧自动补主链和自动重建模块的 fallback
- `P2-3` 第一轮：主干确认、可省略连线确认、模块角色确认
- `P2-3` 第二轮：merge 节点确认、feedback 边确认
- `P3-1` 第二轮：增强 merge / aggregator 结果在 intent 中的消费强度
- `P4-1`：修复 `pipeline-router-v3` 端口槽位分配错误

### 当前进行中

- `P3-2`：开始补正式模板 `top-control-main-bottom-aux`

### 下一轮计划

- `P3-2` 第二轮：补模板 matcher 与 skeleton 对 `top-control-main-bottom-aux` 的正式支持
- `P3-3`：增加 control-over-main / aux-under-main 局部骨架
- `P5-2`：为开发态补一个最小调试视图，方便查看 extraction / analysis / intent 差异

## 5.1 阶段 P0：建立可观测性与真实基线

### 目标

先把问题看清楚，建立后续调优的统一输入输出和验收基线。

### 任务

#### P0-1 建立真实论文样例集

- 收集 20-30 个真实论文方法段落或图注文本
- 覆盖以下类型：
  - 线性主干
  - 输入-核心-输出
  - 主干带下方辅助支路
  - split-merge
  - state-simulator
  - 带 feedback loop
  - 上控制下辅助的混合图

#### P0-2 建立全链路 trace 导出

每个样例都要能导出以下阶段产物：

- raw LLM output
- normalized extraction
- analysis result
- layout intent
- template match
- skeleton layout
- routed layout
- metrics

#### P0-3 建立人工验收维度

每个样例增加人工评分项：

- 主干是否清晰
- 分支是否分离
- merge 是否可读
- feedback 是否走外圈
- 是否存在明显冗余边
- 是否具备论文图观感

### 交付物

- 样例清单
- trace 导出格式
- 人工验收表
- 当前基线问题报告

### 验收标准

- 任意一个样例都能稳定导出全链路中间结果
- 团队能明确判断问题出在 parser、intent、skeleton 还是 router

### 主要涉及模块

- `packages/drawnix/src/paperdraw/analyzer/**`
- `packages/drawnix/src/paperdraw/layout/**`
- `packages/drawnix/src/paperdraw/layout/evaluation/**`
- `docs/paperdraw/**`

## 5.2 阶段 P1：升级文本解析 schema

### 目标

让解析器输出足够支撑论文级布局的结构语义，不再把后续布局器逼成“猜结构”。

### 任务

#### P1-1 升级 ExtractionResult / AnalysisResult 中间 schema

新增或等价表达以下语义：

- `nodeRole`
- `edgeRoleCandidate`
- `moduleRoleCandidate`
- `spineCandidate`
- `branchGroup`
- `mergeTargetCandidate`
- `feedbackCandidate`
- `relationPriority`
- `relationNecessity`

#### P1-2 升级 prompt

prompt 必须要求模型显式输出：

- 哪些实体是输入、核心处理、控制参数、辅助支路、状态、输出
- 哪些边属于主干、控制、辅助、反馈、注释
- 哪些节点是 merge / aggregator / simulator
- 哪些边是可省略的说明性边

#### P1-3 保持兼容

升级时要允许旧 schema 回退，避免一次性改崩整个链路。

### 交付物

- 新 schema 定义
- 新 prompt
- 兼容旧输出的解析逻辑

### 验收标准

- 真实样例中，至少 70% 能显式给出主干候选与边角色候选
- 解析输出不再只有“平铺实体 + 平铺顺序边”

### 主要涉及模块

- `packages/drawnix/src/paperdraw/types/analyzer.ts`
- `packages/drawnix/src/paperdraw/config/prompt-config.ts`
- `packages/drawnix/src/paperdraw/analyzer/llm-client.ts`

## 5.3 阶段 P2：重做语义归一化、结构修复与 QA

### 目标

把“能出图”升级为“结构尽量保真”，同时在进入布局前先删掉明显错误和冗余关系。

### 任务

#### P2-1 重做 validator 策略

新增以下处理：

- 关系合法性校验
- 冗余边裁剪
- 传递约简
- 主干边保留优先
- 注释边和说明边降权
- merge / feedback 结构识别修复

#### P2-2 限制过度 fallback

以下 fallback 要降级使用，并记录 warning：

- 自动补主链
- 自动重建模块
- 自动实体合并

要求：

- fallback 后必须保留原因说明
- 不能静默把复杂图压成简单线性图

#### P2-3 升级 QA

QA 从“实体层提问”升级为“结构层提问”，优先问：

- 哪条边属于主干
- 哪个节点是汇聚点
- 哪些边只是说明性关系
- 哪些边可以省略
- 哪个模块是控制区/辅助区

当前进度：

- 已完成第一轮本地结构 QA：主干确认、可省略连线确认、模块控制区/辅助区确认
- 已完成第二轮本地结构 QA：merge 节点确认、feedback 边确认
- 下一轮补充：UI 展示标签优化、问题优先级控制

### 交付物

- 新 validator
- 新结构 QA 规则
- 冗余边裁剪逻辑

### 验收标准

- 真实样例平均边数明显下降
- 进入布局前的主干更稳定
- 同一篇论文多次运行的结构波动下降

### 主要涉及模块

- `packages/drawnix/src/paperdraw/analyzer/validator.ts`
- `packages/drawnix/src/paperdraw/analyzer/crs-agent.ts`
- `packages/drawnix/src/paperdraw/components/crs-qa-panel.tsx`

## 5.4 阶段 P3：重构 LayoutIntent 与模板系统

### 目标

让布局器真正消费结构语义，而不是继续依赖关键词猜测。

### 任务

#### P3-1 重构 LayoutIntent 输入来源

优先使用解析阶段产出的显式语义字段，只把关键词推断作为兜底。

当前进度：

- 已消费显式 `spineCandidate / moduleRoleCandidate / feedback edge`
- 已增强显式 `aggregator` 对 merge cluster 的影响，允许分支挂载结果参与 merge 结构识别
- 下一轮补充：继续减少纯关键词推断在 control / aux 模块上的权重

#### P3-2 补齐模板族

至少落实以下全局模板：

- `linear-spine`
- `input-core-output`
- `spine-lower-branch`
- `split-merge`
- `paired-state-simulator`
- `top-control-main-bottom-aux`
- `outer-feedback-loop`

其中 `top-control-main-bottom-aux` 必须进入正式代码，而不是只停留在文档里。

#### P3-3 增强局部骨架

模块内部支持更多局部模式：

- input container stack
- fan-out
- fan-in
- state-before-after
- control-over-main
- aux-under-main

#### P3-4 解耦 profile 与主流向

不能再由 profile 间接决定 `LR / TB` 主方向，主方向应优先由模板和结构语义决定。

### 交付物

- 新 LayoutIntent 生成逻辑
- 新模板匹配逻辑
- 新骨架布局器

### 验收标准

- 真实样例中，非线性图不再大面积退化成单一左右主链
- 控制区、辅助区、输出区位置更稳定
- state-simulator、feedback、merge 类图明显更像论文图

### 主要涉及模块

- `packages/drawnix/src/paperdraw/layout/pipeline-layout-intent.ts`
- `packages/drawnix/src/paperdraw/layout/pipeline-template-matcher.ts`
- `packages/drawnix/src/paperdraw/layout/pipeline-skeleton-generator.ts`
- `packages/drawnix/src/paperdraw/layout/layout-profile.ts`
- `packages/drawnix/src/paperdraw/types/analyzer.ts`

## 5.5 阶段 P4：重做论文语法路由

### 目标

让线条“少、稳、清晰”，而不是只是“合法绕开”。

### 任务

#### P4-1 修复端口槽位分配

立即修复 `pipeline-router-v3` 端口分配 key 错误，保证多条边能共享同侧槽位并真正错开。

#### P4-2 corridor 真正落地

把 corridor 从“guide line 概念”升级为：

- 可保留的主干通道
- merge 通道
- top control 通道
- bottom aux 通道
- outer feedback 通道
- annotation side 通道

#### P4-3 增加 bundling 与 bus

新增：

- 主干边 bundling
- merge bus
- 分支汇入前并行对齐
- feedback 外圈单独通道

#### P4-4 限制低价值边视觉权重

对于说明性边、低必要性边：

- 优先缩短
- 优先靠边
- 必要时允许延后插入

### 交付物

- 修复后的 `pipeline-router-v3`
- corridor reservation 机制
- bundling / merge bus 机制

### 验收标准

- 真实样例的平均 bend 数下降
- 主干边交叉为 0
- feedback 边基本走外圈
- 人工评分中“箭头杂乱”问题显著下降

### 主要涉及模块

- `packages/drawnix/src/paperdraw/layout/pipeline-router-v3.ts`
- `packages/drawnix/src/paperdraw/layout/orthogonal-router.ts`
- `packages/drawnix/src/paperdraw/layout/layout-metrics.ts`

## 5.6 阶段 P5：评估、回归与 UI 接入

### 目标

把优化结果真正固化成稳定能力，而不是只停留在局部测试通过。

### 任务

#### P5-1 扩展评估体系

新增两类评估：

- 真实文本到最终布局的全链路评估
- 关键样例的视觉快照回归

#### P5-2 在弹窗中增加调试开关

开发态可查看：

- extraction
- analysis
- intent
- template id
- routing warnings

#### P5-3 建立验收门槛

每次较大改动至少满足：

- 真实样例集通过率不下降
- 关键核心样例人工评分不下降
- PaperDraw 单元测试、布局评估测试通过

### 交付物

- 回归测试
- 开发态调试视图
- 新验收门槛

### 验收标准

- 调整 parser、layout、router 后可以快速定位回归点
- 新增需求不会再次让系统退回“单调布局 + 杂乱箭头”

## 6. 执行顺序与依赖

必须按以下顺序推进：

1. `P0` 可观测性与真实基线
2. `P1` 解析 schema 升级
3. `P2` 语义修复与结构 QA
4. `P3` 模板与骨架重构
5. `P4` 路由重构
6. `P5` 回归与 UI 调试接入

禁止直接跳到 `P4` 大改路由而不补前面的语义结构，否则收益会很差。

## 7. 每次开发提交的最小要求

每次实际开发任务都应满足：

- 明确对应本计划中的阶段与任务编号
- 改动范围尽量只覆盖一个主问题
- 同步补测试或样例验证
- 若结果与计划不符，先更新文档再继续实现

建议提交说明格式：

- `功能: PaperDraw P1-2 升级解析 prompt 输出结构语义`
- `修复: PaperDraw P4-1 修正 pipeline-router-v3 端口槽位分配`
- `测试: PaperDraw P5-1 增加真实文本全链路回归样例`

## 8. 需求变更流程

后续如果有需求变化，必须按以下流程处理：

1. 先更新本文件中的目标、阶段、任务或验收标准。
2. 在本文件末尾追加变更记录。
3. 再根据更新后的计划执行代码修改。

若用户需求与当前计划冲突，默认先停在文档层面完成以下动作：

- 标记冲突点
- 修改阶段优先级
- 更新任务拆解
- 更新验收口径

再进入代码开发。

## 9. 文档维护规则

维护本文件时，至少同步更新以下内容：

- `版本`
- `日期`
- `状态`
- 受影响阶段
- 交付物
- 验收标准
- 变更记录

## 10. 变更记录

### v1.0 - 2026-03-14

- 首次建立 PaperDraw 优化执行基线
- 明确当前主要问题不止在布局和路由，还包含解析 schema、语义修复和评估口径
- 冻结后续执行顺序：`P0 -> P1 -> P2 -> P3 -> P4 -> P5`

### v1.1 - 2026-03-14

- 同步记录已完成的 `P0-2 / P1-1 / P1-2 / P2-1 / P2-2 / P4-1`
- 将 `P2-3` 状态更新为“结构 QA 第一轮进行中”
- 明确下一轮开发计划：补 merge / feedback QA，并推动 `P3-1` 消费结构 QA 结果

### v1.2 - 2026-03-14

- 记录 `P2-3` 第二轮完成：本地 QA 增加 merge 节点确认和 feedback 边确认
- 将当前进行中阶段切换到 `P3-1`，开始加强 `pipeline-layout-intent` 对显式 feedback 结果的消费
- 更新下一轮计划：继续增强 merge 结果消费，并开始补正式模板 `top-control-main-bottom-aux`

### v1.3 - 2026-03-14

- 记录 `P3-1` 第二轮完成：显式 `aggregator` 结果开始参与 merge cluster 构建
- 将当前进行中阶段切换到 `P3-2`，开始补正式模板 `top-control-main-bottom-aux`
- 更新下一轮计划：先补模板 matcher 和 skeleton，再补 control-over-main / aux-under-main 局部骨架
