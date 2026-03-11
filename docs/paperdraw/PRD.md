# Drawnix PaperDraw 功能 — PRD 与技术方案 v2

> **版本**: v2.0 | **日期**: 2026-03-11 | **状态**: 讨论中
> **目标**: 基于 PaperDraw 论文，为 Drawnix 实现"自然语言 → 论文级 Pipeline 流程图"

---

## 1. 产品概述

### 1.1 核心理念（对齐论文）

PaperDraw 论文提出三阶段系统：
1. **Text Analyzer** — LLM 提取实体/关系 + CRS 对话代理迭代确认用户意图
2. **Controllable Layout Optimizer** — 多目标优化元素排列 + 连接路由算法
3. **Visual Elements Optimizer** — 风格向量库 + 结构相似性推荐 + 自适应风格应用

**与 v1 PRD 的关键差异：**
- 文本解析器不再以规则引擎为主，**LLM 是核心**
- 新增 **用户 QA 交互环节**（CRS 模式），而非直接生成
- 节点统一为**矩形 + 文本**（论文统计矩形为最常见形状）
- 关系分为三类：**sequential（顺序连接）**、**modular（模块包含）**、**annotative（注释）**

### 1.2 用户画像

- 学术研究者：从论文方法描述自动生成 pipeline 图
- 技术文档作者：从系统描述生成方法流程图
- 非技术用户：零语法门槛，自然语言输入

---

## 2. 系统架构（四视图模型）

论文 Fig.9 定义了四个核心视图区域，我们对齐实现：

```
┌───────────────────────────────────────────────────────────┐
│                    PaperDraw 弹窗                          │
│ ┌─────────────────────┐  ┌─────────────────────────────┐  │
│ │ ① 文本分析视图       │  │ ③ 生成与编辑视图             │  │
│ │  - 文本输入区        │  │  - 流程图预览（只读 Board）  │  │
│ │  - "分析"按钮        │  │  - 布局交互（选择/缩放/路由）│  │
│ │  - QA 问答区域       │  │                             │  │
│ │    (CRS 多轮对话)    │  │                             │  │
│ ├─────────────────────┤  ├─────────────────────────────┤  │
│ │ ② 语义可视化视图     │  │ ④ 风格推荐视图              │  │
│ │  - 实体列表+权重     │  │  - 推荐风格列表             │  │
│ │  - 模块分组关系      │  │  - NL 风格指令输入          │  │
│ │  - 连接关系图        │  │  - "插入画布"按钮           │  │
│ └─────────────────────┘  └─────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### 2.1 端到端流程

```mermaid
flowchart TB
    A[用户输入文本] --> B["点击 '分析'"]
    B --> C[LLM 提取实体与关系]
    C --> D[CRS 对话: 模块分组 QA]
    D --> E[CRS 对话: 重要性权重 QA]
    E --> F["② 语义可视化: 展示实体/模块/权重"]
    F --> G{用户确认/修改?}
    G -->|修改| D
    G -->|确认| H[可控布局优化器]
    H --> I[元素排列优化]
    I --> J[连接路由优化 MultiRect-CenterLine]
    J --> K["③ 预览流程图"]
    K --> L{用户满意?}
    L -->|调整布局| M[交互操作: 拖拽/缩放/路由]
    M --> H
    L -->|选择风格| N["④ 风格推荐"]
    N --> O[应用风格]
    O --> K
    L -->|确认| P["插入主画布 board.insertFragment"]
```

---

## 3. 三大子系统技术方案

### 3.1 Text Analyzer（文本分析器）

#### 3.1.1 核心功能

1. **实体提取**：从文本中识别关键实体名词（步骤/模块/数据/方法）
2. **关系提取**：识别实体间的深层语义关系
3. **CRS 对话代理**：通过多轮 QA 确认模块分组和重要性权重
4. **语义可视化**：将提取结果展示给用户供确认/修改

#### 3.1.2 三种关系类型（对齐论文 Section 3.2.3）

| 关系类型 | 含义 | 可视化表达 | 示例 |
|---------|------|-----------|------|
| **Sequential（顺序）** | 实体间的顺序/依赖 | 有向箭头连接 | A → B → C |
| **Modular（模块）** | 实体属于同一功能模块 | 边界框（bounding box）包含 | {A, B} ∈ "数据准备" |
| **Annotative（注释）** | 层级或补充说明关系 | 虚线/分支线 | A --注释--> B |

#### 3.1.3 数据类型定义

```typescript
// paperdraw/types/analyzer.ts

/** 实体 — 统一为矩形节点 */
interface Entity {
  id: string;
  label: string;         // 实体名称（显示在矩形中）
  evidence?: string;      // 原文溯源片段
}

/** 顺序关系 — 箭头连接 */
interface SequentialRelation {
  id: string;
  type: 'sequential';
  source: string;         // 源实体 id
  target: string;         // 目标实体 id
  label?: string;         // 连接线上的文字
}

/** 模块关系 — 边界框包含 */
interface ModularRelation {
  id: string;
  type: 'modular';
  moduleLabel: string;    // 模块名称
  entityIds: string[];    // 包含的实体 id 列表
}

/** 注释关系 — 虚线连接 */
interface AnnotativeRelation {
  id: string;
  type: 'annotative';
  source: string;
  target: string;
  label?: string;
}

type Relation = SequentialRelation | ModularRelation | AnnotativeRelation;

/** LLM 初步提取结果 */
interface ExtractionResult {
  entities: Entity[];
  relations: Relation[];
}

/** 经 CRS 确认后的完整分析结果 */
interface AnalysisResult {
  entities: Entity[];
  relations: Relation[];
  weights: Record<string, number>;  // 实体id → 重要性权重 0-1
  modules: ModularRelation[];       // 确认后的模块分组
}
```

#### 3.1.4 LLM Prompt 设计

```typescript
// paperdraw/analyzer/llm-client.ts

const EXTRACTION_SYSTEM_PROMPT = `
你是一个学术论文流程图生成助手。给定一段描述研究方法/流程的文本，你需要：
1. 提取所有关键实体（步骤、模块、数据、方法名等）
2. 识别实体间的关系：
   - sequential: 顺序/依赖关系（A 之后是 B）
   - modular: 模块包含关系（A 和 B 属于同一阶段/模块）
   - annotative: 注释/补充关系
3. 以 JSON 格式输出

输出格式：
{
  "entities": [{"id": "e1", "label": "实体名称", "evidence": "原文片段"}],
  "relations": [
    {"id": "r1", "type": "sequential", "source": "e1", "target": "e2"},
    {"id": "r2", "type": "modular", "moduleLabel": "模块名", "entityIds": ["e1","e2"]},
    {"id": "r3", "type": "annotative", "source": "e3", "target": "e4"}
  ]
}
`;
```

#### 3.1.5 CRS 对话代理（核心交互）

论文 Section 4.2.2 的 Conversational Agent，两类问题迭代确认：

**问题类型 1 — 模块分组：**
```
Q: "以下哪些实体应该属于同一个模块？"
   [文本解析] [LLM推理] [实体提取] [关系识别]
   用户选择 → 确认分组
```

**问题类型 2 — 重要性权重：**
```
Q: "以下实体中，哪个对整体流程贡献更大？"
   [文本解析器] [布局优化器]
   用户选择 → 调整权重排序
```

```typescript
// paperdraw/analyzer/crs-agent.ts

interface CRSQuestion {
  id: string;
  type: 'module_grouping' | 'importance_ranking';
  question: string;
  options: string[];        // 可选实体标签
  multiSelect: boolean;     // 模块分组允许多选
}

interface CRSAnswer {
  questionId: string;
  selectedOptions: string[];
}

/** 基于 LLM 和提取结果生成 QA 问题 */
async function generateQuestions(
  extraction: ExtractionResult,
  llmConfig: LLMConfig
): Promise<CRSQuestion[]>;

/** 根据用户回答让 LLM 更新分析结果 */
async function refineWithAnswers(
  extraction: ExtractionResult,
  answers: CRSAnswer[],
  llmConfig: LLMConfig
): Promise<AnalysisResult>;
```

### 3.2 Controllable Layout Optimizer（可控布局优化器）

#### 3.2.1 两阶段优化

**阶段 A — 元素排列优化**（论文 Section 4.3.1）

三个优化目标：
- **空白最小化**（公式1）：最大化空间利用效率
- **视觉信息流 VIF**（公式2）：连续方向夹角 > 90° 扣分，保持阅读流连贯
- **边界框几何**（公式3）：贴合目标宽高比（单栏 / 双栏格式）

实现策略：ELK 初始布局 → 多目标迭代微调

**阶段 B — 连接路由优化**（论文 Section 4.3.2）

MultiRect-CenterLine 算法（比 A* 快 34 倍）：
1. 空白区域分割为最大面积矩形集合
2. 计算矩形间邻接图
3. 搜索连接两元素的最短空白矩形路径
4. 沿路径中心线生成折线坐标
5. 基于能量值选择最优路由（共享起终点加分，交叉扣分）

#### 3.2.2 关键数据结构

```typescript
// paperdraw/types/layout.ts

interface LayoutNode {
  id: string;
  x: number; y: number;
  width: number; height: number;
  label: string;
  weight: number;
}

interface LayoutEdge {
  id: string;
  sourceId: string;
  targetId: string;
  routing: [number, number][];
  type: 'sequential' | 'annotative';
}

interface LayoutGroup {
  id: string;
  moduleLabel: string;
  nodeIds: string[];
  x: number; y: number;
  width: number; height: number;
}

interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  groups: LayoutGroup[];
  metrics: {
    blankSpaceScore: number;
    vifScore: number;
    geometryScore: number;
    crossings: number;
  };
}
```

### 3.3 Visual Elements Optimizer（视觉元素优化器）

#### 3.3.1 论文五大设计原则（P1-P5）

| 编号 | 原则 | 实现 |
|------|------|------|
| P1 | 元素对齐 | 同行共享基线/居中 |
| P2 | 空间效率 | 紧凑布局 |
| P3 | 标准化尺寸 | 论文单/双栏格式 |
| P4 | 连接路由 | 最少交叉，自然阅读序 |
| P5 | 颜色编码一致 | 同模块同颜色族 |

#### 3.3.2 颜色编码规则（论文 Section 3.2.4）

- **相似性法则**：同模块实体使用同一颜色族
- **前景/背景**：模块背景浅色填充，实体白底深边框
- **高亮**：高权重实体用更饱和色调强调

#### 3.3.3 MVP 模板库

3 套预定义模板：`academic-default`（学术默认）、`minimal-bw`（极简黑白）、`tech-blue`（科技蓝）

后续迭代引入论文的风格向量库（tree kernel 结构相似性检索）。

---

## 4. 前端集成方案

### 4.1 代码修改清单

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `use-drawnix.tsx` | MODIFY | `DialogType` 新增 `paperdrawToFlowchart` |
| 2 | `menu-items.tsx` | MODIFY | 新增 `PaperDrawItem` 菜单项 |
| 3 | `ttd-dialog.tsx` | MODIFY | 新增 PaperDraw 对话框 |
| 4 | `paperdraw/` 目录 | NEW | 全部新增模块（analyzer/layout/visual/builder/components） |
| 5 | `icons.tsx` + i18n | MODIFY | 图标和文案 |

### 4.2 状态机

```typescript
type PaperDrawPhase =
  | 'input'           // 用户输入文本
  | 'analyzing'       // LLM 提取中
  | 'qa'              // CRS QA 对话轮次
  | 'semantic_review'  // 语义可视化确认
  | 'layouting'       // 布局优化中
  | 'preview'         // 预览结果
  | 'styling';        // 风格选择/调整
```

### 4.3 目录结构

```
packages/drawnix/src/paperdraw/
├── types/              # 类型定义
├── analyzer/           # 文本分析器（LLM + CRS）
├── layout/             # 布局优化器（ELK + 多目标 + 路由）
├── visual/             # 视觉优化器（模板 + 颜色引擎）
├── builder/            # PlaitElement 构建
├── components/         # UI 组件（弹窗/QA面板/语义视图/风格面板）
└── pipeline.ts         # 编排层
```

---

## 5. 里程碑

| 阶段 | 内容 | 估时 |
|------|------|------|
| **M-A** | 类型定义 + LLM 客户端 + 弹窗骨架 | 5-8 人日 |
| **M-B** | LLM 文本提取 + CRS QA 交互 + 语义可视化 | 10-15 人日 |
| **M-C** | ELK 布局 + 多目标优化 + 连接路由 | 10-15 人日 |
| **M-D** | 视觉优化 + 模板库 + PlaitElement 构建 | 8-12 人日 |
| **M-E** | 端到端集成 + 交互式调整 + E2E 测试 | 8-12 人日 |
| **M-F** | 风格向量库检索 + NL 风格指令 | 10-20 人日 |

---

## 6. 待确认事项

1. **LLM 选型**: 使用哪个 LLM API？（OpenAI / DeepSeek / Qwen / 自部署）
2. **LLM 调用方式**: 纯前端直接调用 API？还是需后端代理？
3. **CRS 轮次**: QA 交互默认几轮？用户可跳过吗？
4. **风格模板数量**: MVP 需要几套模板？
5. **节点形状**: 是否严格全部矩形？论文统计显示矩形最常见但也有椭圆/菱形等
6. **MultiRect-CenterLine**: 完整实现还是先用 ELK 正交路由替代？
