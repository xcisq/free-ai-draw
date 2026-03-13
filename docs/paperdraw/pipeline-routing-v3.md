# PaperDraw 论文 Pipeline 路由器 v3 设计

> 版本：v1.0  
> 日期：2026-03-13  
> 状态：设计中  
> 关联文档：[pipeline-layout-synthesizer.md](/Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/paperdraw/pipeline-layout-synthesizer.md)  
> 关联文档：[pipeline-layout-pattern-library.md](/Users/bytedance/Documents/upc/draw_xcl/drawnix/docs/paperdraw/pipeline-layout-pattern-library.md)

---

## 1. 目标

路由器 v3 的目标不是简单“少交叉”，而是让连线服从论文 pipeline 的阅读语法。

必须同时满足：

- 不穿实体
- 不穿无关模块
- 主干边最清晰
- 支路边进入自己的轨道
- 反馈边走外圈
- 注释边不打断阅读流

---

## 2. 路由分层思想

后续所有边必须按角色分层路由，而不是放进同一个池子统一求解。

### 2.1 边类别

```ts
type RoutedEdgeClass =
  | 'spine'
  | 'merge'
  | 'aux'
  | 'control'
  | 'feedback'
  | 'annotation';
```

### 2.2 路由优先级

固定顺序：

1. `spine`
2. `merge`
3. `aux`
4. `control`
5. `feedback`
6. `annotation`

原则：

- 越重要的边，越先占用好通道
- 越后路由的边，越绕，不允许反过来压主链

---

## 3. 障碍与走廊模型

### 3.1 硬障碍

- 所有非源/非目标节点矩形
- 所有无关模块矩形
- 已保留的主干走廊

### 3.2 半开放区域

- 模块内部成员边，可在本模块内部通行
- 输入容器内部边，只允许按容器局部规则通行

### 3.3 走廊 `corridor`

新增走廊概念：

- `spine corridor`
- `top control corridor`
- `bottom aux corridor`
- `outer feedback corridor`
- `annotation corridor`

这些走廊是显式留出来的，不是路由时临时找路。

---

## 4. 端口与锚点策略

### 4.1 端口原则

不同类别边必须走不同侧边：

| 边类别 | 默认端口 |
|--------|---------|
| `spine` | `E -> W` 或 `S -> N` |
| `merge` | 汇聚目标的迎向侧 |
| `aux` | 主节点下侧或外侧 |
| `control` | 主节点上侧 |
| `feedback` | 输出节点外侧 -> 外圈 -> 目标节点外侧 |
| `annotation` | 右侧优先，其次下侧 |

### 4.2 多槽位分配

每个侧边必须支持多槽位：

- `slotIndex = 0,1,2,...`
- 主干边优先拿中心槽
- 控制边和辅助边拿边缘槽
- 反馈边拿最外槽

---

## 5. 路由流程

### 5.1 阶段 1：保留主干走廊

先根据骨架模板为主干预留通道。

例如：

- `input-core-output`：中轴横向主走廊
- `spine-lower-branch`：上主走廊 + 下辅助走廊
- `outer-feedback-loop`：外围环路走廊

### 5.2 阶段 2：路由主干边

要求：

- 尽量直
- 尽量少拐点
- 不允许反向穿插

### 5.3 阶段 3：路由汇聚边

要求：

- 汇聚节点前的几条边尽量平行进入
- 避免在汇聚前发生无意义绕行

### 5.4 阶段 4：路由辅助和控制边

要求：

- 辅助边优先走底部走廊
- 控制边优先走顶部走廊
- 不压主干

### 5.5 阶段 5：路由反馈边

要求：

- 一律优先走外围
- 不切穿主链
- 不从核心模块中间穿过

### 5.6 阶段 6：注释边

要求：

- 放到最后
- 优先贴近注释节点
- 尽量走最短侧挂路径

---

## 6. 路由算法建议

### 6.1 主算法

保留 rectilinear routing，但从“统一 A*”升级为“走廊约束 A* + rip-up reroute”。

流程：

1. 构建障碍图
2. 构建走廊图
3. 对每条边在允许走廊里求最短合法路径
4. 若冲突过多，对低优先级边做 rip-up
5. 重新分配槽位并 reroute

### 6.2 路径代价

```text
Cost =
  1 * length +
  36 * bends +
  140 * crossings +
  220 * reverseFlow +
  60 * corridorViolation +
  50 * congestion
```

其中：

- 穿实体 = `Infinity`
- 穿无关模块 = `Infinity`
- 反馈边压主干 = `Infinity`
- 控制边走到底部 = 高惩罚
- 辅助边走到顶部 = 高惩罚

---

## 7. 交叉与拥塞控制

### 7.1 交叉最小化

不能只靠 ELK 的 crossing minimization。  
路由器本身也要显式最小化交叉：

- 主干边之间不允许交叉
- 汇聚前允许少量平行接近，不允许杂乱交叉
- 注释边若与主干冲突，优先牺牲注释边

### 7.2 拥塞控制

当某条走廊边太多时：

- 先尝试扩展走廊宽度
- 再尝试重新分配槽位
- 最后才允许次优绕路

---

## 8. 局部重排场景

局部优化不能简单重跑全图路由。

### 8.1 未选区域

- 节点坐标固定
- 已有主干走廊尽量不动

### 8.2 选区内

- 可以重新分配模块内部走廊
- 可以重新分配局部槽位

### 8.3 边界边

边界边必须单独处理：

- 先保留边界锚点
- 再重新接入局部新骨架
- 最后只 reroute 受影响的边

---

## 9. 失败恢复策略

复杂图不一定一次求出满意路径，必须允许恢复策略：

1. 降级到次优槽位
2. 放宽局部走廊长度
3. 提高反馈边绕行代价容忍度
4. 仅对低优先级边启用大绕路
5. 若仍失败，输出带 warning 的合法路径，而不是穿实体

原则：

**宁可绕远，也不能穿实体。**

---

## 10. 调试与验收指标

后续路由器必须产出调试指标：

```ts
interface RoutingMetrics {
  edgeCrossings: number;
  bends: number;
  totalLength: number;
  obstacleViolations: number;
  corridorViolations: number;
  feedbackOuterLoopRate: number;
}
```

### 10.1 验收标准

- `obstacleViolations = 0`
- 主干边交叉数接近 `0`
- 反馈边外圈率尽量高
- 控制边与辅助边不压主干
- 注释边不会切断主阅读流

---

## 11. 第一阶段实现建议

为控制风险，路由器 v3 不建议一步做满，建议按以下顺序：

1. 先做走廊建模
2. 再做边分类和优先级
3. 再做主干优先路由
4. 再做辅助/控制分轨
5. 最后补 feedback 外圈和 rip-up reroute

---

## 12. 当前设计结论

1. 路由质量不能只靠避障算法本身，需要布局骨架和走廊先验
2. 主干、辅助、控制、反馈必须分层处理
3. 后续真正决定“像不像论文图”的，不只是节点放置，更是通道组织
4. 若没有路由分层，再强的模板布局最后也会被线条打乱
