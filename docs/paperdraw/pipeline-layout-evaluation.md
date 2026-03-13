# PaperDraw 论文 Pipeline 布局验收与样例集

> 版本：v1.0  
> 日期：2026-03-13  
> 状态：设计中  
> 关联文档：[pipeline-layout-synthesizer.md](/Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/paperdraw/pipeline-layout-synthesizer.md)  
> 关联文档：[pipeline-layout-pattern-library.md](/Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/paperdraw/pipeline-layout-pattern-library.md)  
> 关联文档：[pipeline-routing-v3.md](/Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/paperdraw/pipeline-routing-v3.md)

---

## 1. 目标

后续布局器的验收不能只看：

- 能否生成图
- 是否没有重叠

还必须看：

- 是否接近论文 pipeline 的视觉组织方式
- 是否主干清晰
- 是否支路自然
- 是否不再退化成纯横排或纯竖排

---

## 2. 样例集分类

第一批样例集建议固定为 12 张，按结构分 6 类，每类 2 张。

### A 类：输入容器 + 主干 + 输出

目标模板：

- `G2 input-core-output`

验收重点：

- 左输入区是否稳定
- 主干是否连续
- 右输出是否明确

### B 类：主干 + 下方辅助支路

目标模板：

- `G3 spine-lower-branch`

验收重点：

- 辅助支路是否下沉
- 是否在后续自然汇聚

### C 类：分裂汇聚

目标模板：

- `G4 split-merge`

验收重点：

- 分支是否均衡
- 汇聚是否自然

### D 类：状态更新 + 模拟器

目标模板：

- `G5 paired-state-simulator`

验收重点：

- 状态节点是否成对
- 模拟器是否居中

### E 类：上控制 + 下辅助

目标模板：

- `G6 top-control-main-bottom-aux`

验收重点：

- 上下轨是否分离
- 主干是否仍居中

### F 类：外圈反馈

目标模板：

- `G7 outer-feedback-loop`

验收重点：

- 反馈是否走外围
- 是否不切主链

---

## 3. 每张样例需要保存的内容

每个样例建议保存以下 4 份材料：

1. 原始文本描述
2. 人工标注的语义结构
3. 参考骨架图
4. 生成结果快照

后续验收时要同时比对：

- 语义结构正确性
- 骨架相似性
- 路由质量

---

## 4. 验收指标

### 4.1 结构指标

- `Spine Coverage`
- `Branch Coverage`
- `Merge Detection Accuracy`
- `Feedback Detection Accuracy`

### 4.2 几何指标

- `Node Overlap Count`
- `Blank Space Ratio`
- `Aspect Ratio Deviation`
- `Module Compactness`

### 4.3 路由指标

- `Edge Crossing Count`
- `Bend Count`
- `Obstacle Violation Count`
- `Feedback Outer Loop Rate`
- `Annotation Intrusion Count`

### 4.4 论文相似性指标

这部分建议人工 + 自动结合：

- `Global Skeleton Match`
- `Rail Assignment Match`
- `Spine Readability Score`
- `Visual Organization Score`

---

## 5. 最低验收门槛

第一阶段先定最小门槛：

- `Node Overlap Count = 0`
- `Obstacle Violation Count = 0`
- `Spine Readability Score >= 0.75`
- `Global Skeleton Match >= 0.7`
- 至少 `70%` 的样例不再退化为纯横排/纯竖排

说明：

- 第一阶段不要求所有样例都做到论文级最优
- 但必须明显摆脱当前的固定列式布局

---

## 6. 人工评审维度

建议每轮迭代后做一次人工打分，维度固定为：

1. 是否一眼能看出主干
2. 支路是否容易理解
3. 输出区是否自然
4. 图面是否像论文 pipeline
5. 连线是否扰乱阅读

评分范围建议为 `1-5` 分。

---

## 7. 阶段性通过标准

### 阶段 A：语义层通过

- 主干、分支、汇聚、反馈识别基本正确
- `LayoutIntent` 输出稳定

### 阶段 B：模板层通过

- 至少 5 个高频模板可稳定命中
- 样例集中大多数图不再退化成单链

### 阶段 C：路由层通过

- 不穿实体
- 反馈外圈率明显提升
- 注释边不压主链

### 阶段 D：综合通过

- 样例集中大部分结果具备明显论文 pipeline 感

---

## 8. 当前结论

后续如果没有固定样例集，布局器很容易再次退化成：

- “坐标合法，但不论文”
- “结构正确，但不好读”
- “边避障了，但图面依然僵硬”

因此，样例集和验收指标必须在实现前先冻结。
