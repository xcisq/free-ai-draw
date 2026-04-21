/**
 * LLM 提示词模板管理
 * 提供 Mermaid 生成与修复的提示词模板
 */

import type {
  GenerationContext,
  GraphInfo,
  RequestKind,
  StructurePattern,
  UsageScenario,
} from '../types';
import {
  buildDiagramTypePromptText,
  findDiagramDeclaration,
  getDiagramTypeLabel,
  getStyleModeLabel,
  resolveDiagramTypeFromIntent,
} from '../utils/diagram-capabilities';

const DEFAULT_GENERATION_CONTEXT: GenerationContext = {
  layoutDirection: 'LR',
  diagramType: 'auto',
  usageScenario: 'paper',
  nodeCount: 5,
  theme: 'academic',
  layoutArea: 'medium',
  density: 'balanced',
  structurePattern: 'mixed',
  layoutIntentText: '',
  emphasisTargets: [],
  styleMode: 'auto',
  diagramStyle: 'publication',
  beautyLevel: 'balanced',
  layoutRhythm: 'airy',
  visualFocus: 'core',
  clarificationStatus: 'none',
};

/**
 * 获取初始系统提示词
 */
export function getInitialPrompt(): string {
  return `你是一个专业的 Mermaid 图表生成助手。你只会收到一次 one-shot 请求，你的任务是理解用户提供的原始文本、图类型意图和样式要求，并直接输出一版可以稳定预览的 Mermaid 代码。

遵循以下原则：
1. 用户输入的正文、段落、方法描述或需求文本，是图的主要语义来源
2. 先判断最合适的 Mermaid 图类型，再从用户文本中抽取结构、关系、层级和语义重点
3. 如果用户已经明确写出图类型，例如 flowchart、classDiagram、sequenceDiagram、erDiagram、mindmap、timeline 等，请优先遵从
4. 用户提到的“从左到右/从上到下”表示整体主视觉趋势，不代表所有节点都必须严格排成单轴直线
5. 如果文本说明局部存在并行、分支、汇聚、反馈、阶段或群组，优先保留这些局部结构
6. 节点文案要克制，优先压缩到 4 到 12 个字，不要把整句原文直接塞进节点
7. 对论文图与信息图，优先保证主干清晰、局部层次分明、视觉锚点明确
8. 允许输出 Mermaid 官方样式能力，例如 classDef、class、style、linkStyle、subgraph、direction、注释与必要的初始化指令
9. 当用户要求“更美观 / 语义配色 / 分组信息图 / 学术风格”时，可以适度使用语义色板、分组标题、核心节点高亮和多行标签
10. 样式增强必须服务信息表达，不要只为了装饰堆砌复杂语法
11. 你的输出必须能被 Mermaid 官方解析器直接解析成功；如果某种更复杂的写法不确定是否稳定，请主动降级为更简单但合法的写法
12. 输出的第一行或第一个有效 Mermaid 声明，必须是图类型声明；如果前面有 %%{init: ...}%% 或 frontmatter，可以放在类型声明之前
13. 输出前请自行检查：图类型声明存在、连线没有截断、括号成对、subgraph 有闭合、图类型语法不要混用
14. 严禁输出“下面是 Mermaid 代码”“说明”“总结”“\`\`\`mermaid”等非 Mermaid 正文内容

输出格式：
- 仅输出完整 Mermaid 代码
- 可以包含 Mermaid 指令、frontmatter、注释和图类型声明
- 不要输出 markdown 代码块标记
- 不要输出解释、前缀、后缀或注意事项`;
}

/**
 * 获取意图规划系统提示词
 */
export function getIntentPlanningSystemPrompt(): string {
  return `你是一个 Mermaid 生成前置意图规划助手。

你的职责不是直接输出 Mermaid，而是先判断用户提供的信息是否足够生成一张结构清晰的流程图。

请严格遵循以下规则：
1. 只输出 JSON，不要输出 markdown，不要解释
2. layoutDirection 表示整体主阅读方向，不表示所有节点必须完全线性排列
3. 用户如果表达了局部并行、上下辅轨、汇聚、反馈，要保留这些结构意图
4. 如果用户的原始文本或意图足够明确，mode 设为 "generate"
5. 如果关键信息缺失，mode 设为 "clarify"，且只追问 1 个简短问题
6. quickReplies 最多 3 个，必须简短、可直接点击
7. normalizedContext 里只保留对 Mermaid 生成真正有帮助的字段

返回 JSON 结构：
{
  "mode": "generate" | "clarify",
  "normalizedContext": {
    "layoutDirection": "LR" | "TB",
    "diagramType": "auto" | "flowchart" | "sequenceDiagram" | "classDiagram" | "stateDiagram" | "erDiagram" | "journey" | "gantt" | "pie" | "gitGraph" | "requirementDiagram" | "mindmap" | "timeline" | "quadrantChart" | "xychart" | "sankey" | "c4" | "block" | "packet" | "kanban" | "architecture" | "other",
    "usageScenario": "paper" | "presentation" | "document",
    "theme": "academic" | "professional" | "lively" | "minimal",
    "layoutArea": "compact" | "medium" | "spacious",
    "density": "dense" | "balanced" | "sparse",
    "structurePattern": "linear" | "branched" | "convergent" | "multi-lane" | "feedback" | "mixed",
    "layoutIntentText": "string",
    "emphasisTargets": ["string"],
    "styleMode": "auto" | "minimal" | "semantic" | "grouped" | "showcase",
    "diagramStyle": "publication" | "architecture" | "explainer",
    "beautyLevel": "conservative" | "balanced" | "enhanced",
    "layoutRhythm": "compact" | "airy" | "symmetrical",
    "visualFocus": "input" | "core" | "output" | "convergence"
  },
  "clarificationQuestion": "string",
  "quickReplies": ["string"],
  "missingSignals": ["string"]
}`;
}

/**
 * 获取 Mermaid 生成提示词
 */
export function getMermaidGenerationPrompt(context: GenerationContext): string {
  const {
    layoutDirection,
    diagramType,
    usageScenario,
    nodeCount,
    theme,
    layoutArea,
    density,
    structurePattern,
    layoutIntentText,
    emphasisTargets,
    styleMode,
    diagramStyle,
    beautyLevel,
    layoutRhythm,
    visualFocus,
  } = context;

  return `请基于用户提供的原始文本生成一个 Mermaid 图表，用于${getScenarioText(usageScenario)}。

注意：
- 下面的结构化配置只用于约束图类型、整体阅读方向、结构骨架和图面复杂度
- 图中的节点、模块和连接关系，应优先来自用户输入文本本身
- “主阅读方向”表示整体视觉连贯性，对 flowchart、stateDiagram、mindmap 之类布局图更重要
- 如果文本说明局部存在并行、分支、上下分层、汇聚或反馈，请优先保留这些细节
- 对论文图，优先保证主干清晰、辅助结构克制、汇聚位置明确、反馈关系尽量外置
- “图形风格 / 美观度 / 版式节奏 / 视觉重点”是构图提示，不是要你输出解释文本
- “样式模式”表示是否应输出极简、语义配色、分组信息图或更强的展示感
- 这次是 one-shot 生成，不要把希望中的未来补充信息写成节点
- 如果完整的美化版本不够确定能稳定预览，优先生成更克制但合法的版本，不要冒险输出会报错的 Mermaid

要求：
- 图类型：${getDiagramTypeLabel(diagramType)}
- 图类型指令：${buildDiagramTypePromptText(diagramType)}
- 主阅读方向：${getLayoutDirectionText(layoutDirection)}
- 节点数量：约 ${nodeCount} 个
- 样式风格：${getThemeText(theme)}
- 整体布局：${layoutArea ? getLayoutAreaText(layoutArea) : '适中'}
- 密集程度：${density ? getDensityText(density) : '平衡'}
- 结构模式：${getStructurePatternText(structurePattern)}
- 样式模式：${getStyleModeLabel(styleMode)}
- 图形风格：${getDiagramStyleText(diagramStyle)}
- 美观度：${getBeautyLevelText(beautyLevel)}
- 版式节奏：${getLayoutRhythmText(layoutRhythm)}
- 视觉重点：${getVisualFocusText(visualFocus)}
- 构图补充：${layoutIntentText?.trim() || '未额外指定，请按文本语义做最小必要推断'}
- 重点强调：${formatEmphasisTargets(emphasisTargets)}

构图配方：
- 样式模式要求：${getStyleModeRecipe(styleMode)}
- 图形风格要求：${getDiagramStyleRecipe(diagramStyle)}
- 美观度要求：${getBeautyLevelRecipe(beautyLevel)}
- 版式节奏要求：${getLayoutRhythmRecipe(layoutRhythm)}
- 视觉重点要求：${getVisualFocusRecipe(visualFocus, emphasisTargets)}

输出要求：
1. 必须优先生成与用户原文和图类型意图匹配的 Mermaid 官方图类型，不要默认偷换成 flowchart
2. 对 flowchart 类图表，允许使用 classDef、class、style、linkStyle、subgraph、direction 做适度美化
3. 对 sequenceDiagram、classDiagram、erDiagram、journey、gantt、pie、mindmap、timeline、quadrantChart、xychart、sankey、C4 等类型，优先使用该类型的官方语法，不要硬套 flowchart 语法
4. 节点文案尽量压缩，不要直接复制超长论文句子作为节点名；允许必要的 <br/> 或多行文本
5. 节点和连线以结构正确、可稳定预览为第一优先级，美观度主要通过分组、语义配色、层次和锚点来体现
6. 如果用户要求“整体从左到右，但局部有上下辅轨/并行支路/汇聚”，请把这种局部结构真实画出来，而不是压扁成简单横向链路
7. 当用户明确要求“更美观”时，优先输出可以提升阅读体验的版本，例如语义色板、核心节点高亮、分组标题、局部分层
8. 如果使用 Mermaid 指令或 frontmatter，请确保后面仍然有明确的图类型声明
9. 输出前请自行完成一次最小自检：声明、括号、subgraph、连线完整性，以及是否混入了其他图类型语法
10. 如果自检后发现某些美化语法可能导致预览失败，宁可减少样式、减少节点或减少分组，也不要输出不可预览代码
11. 不要输出 markdown 代码块，不要输出“下面是 Mermaid 代码”之类提示语

输出格式：
- 仅输出完整 Mermaid 代码
- 不要输出 markdown 代码块标记
- 不要输出解释、前缀、后缀或注意事项`;
}

/**
 * 构造 Mermaid 生成前的意图规划请求
 */
export function buildMermaidIntentPlanningPrompt(options: {
  userInput: string;
  currentContext?: Partial<GenerationContext>;
  currentMermaid?: string;
  conversationSummary?: string;
  requestKind?: RequestKind;
}): string {
  const {
    userInput,
    currentContext = {},
    currentMermaid,
    conversationSummary,
    requestKind = 'generate',
  } = options;
  const mergedContext: GenerationContext = {
    ...DEFAULT_GENERATION_CONTEXT,
    ...currentContext,
  };

  return `请先规划 Mermaid 生成意图，不要直接输出 Mermaid。

当前已知上下文：
${JSON.stringify(mergedContext, null, 2)}

${conversationSummary ? `最近对话摘要：\n${conversationSummary}\n\n` : ''}${
    currentMermaid
      ? `当前已有 Mermaid（供增量细化参考）：
\`\`\`
${currentMermaid}
\`\`\`

`
      : ''
  }当前请求类型：${requestKind === 'refine' ? '基于已有 Mermaid 的细化请求' : '新的 Mermaid 生成请求'}

最新用户输入：
<<<USER_TEXT
${userInput.trim()}
USER_TEXT>>>

判断原则：
- 如果用户已经同时提供了原始文本和较明确的构图意图，直接 generate
- 如果用户只给了模糊方向，缺少关键结构信号，可以 clarify
- clarify 时只问一个最影响构图的短问题
- 如果用户说“整体从左到右，但局部有上下辅轨/并行/汇聚”，这已经是有效结构意图，不要再追问“是不是从左到右”

请严格输出 JSON。`;
}

/**
 * 将用户输入与结构化配置组合为 Mermaid 生成请求
 */
export function buildMermaidUserPrompt(
  userInput: string,
  context: Partial<GenerationContext> = {},
  options: {
    currentMermaid?: string;
    requestKind?: RequestKind;
  } = {}
): string {
  const mergedContext: GenerationContext = {
    ...DEFAULT_GENERATION_CONTEXT,
    ...context,
  };
  const { currentMermaid, requestKind = 'generate' } = options;
  const isRefine = requestKind === 'refine' && !!currentMermaid?.trim();
  const detectedDiagramType = resolveDiagramTypeFromIntent(userInput, mergedContext.diagramType);

  return `${getMermaidGenerationPrompt(mergedContext)}

任务要求：
- 请把下面这段内容当作“用户原始文本和意图说明”，而不是普通一句提示词
- 你需要从文本中抽取流程阶段、模块、输入输出和依赖关系
- 如果文本是论文方法描述，请把方法结构可视化；如果文本是需求描述，请把执行流程可视化
- 不要脱离这段文本另起一套通用流程图
- 如果文本里同时出现“整体阅读方向”和“局部结构要求”，优先同时满足两者
- 请把所有结构信息直接体现在 Mermaid 的节点、连线和必要的少量 subgraph 中，不要输出解释文本
- 如果用户明确写了图类型、样式词或样例语法，请优先吸收进最终 Mermaid
- 根据原文推断的首选图类型：${getDiagramTypeLabel(detectedDiagramType)}
- 节点命名优先压缩成短标签，避免长句直接进节点
- 这是一次 one-shot 请求，不要先提问，也不要输出待确认占位节点
- 允许使用 classDef、class、style、linkStyle、subgraph、direction、注释与必要的指令来增强表达
- 如果没有显式图类型，才根据语义自动判断，不要机械默认成 flowchart
- 输出前请自行检查这份 Mermaid 是否能直接成功预览；如果不确定，请主动删掉高风险样式，保留核心结构
- 宁可少一个辅节点、少一种样式，也不要输出需要事后修补的代码
- 不要输出任何额外解释、标题、markdown 代码块或总结

用户原始文本：
<<<USER_TEXT
${userInput.trim()}
USER_TEXT>>>

${isRefine ? `当前已有 Mermaid：
\`\`\`
${currentMermaid}
\`\`\`

请基于当前 Mermaid 做增量细化，尽量保留已经合理的模块和关系，只调整与最新要求直接相关的部分。
` : ''}请基于上面的用户原始文本生成对应图表，并严格输出完整 Mermaid 代码，不要补充额外说明，不要输出 \`\`\`。`;
}

/**
 * 获取使用场景描述文本
 */
function getScenarioText(scenario: UsageScenario): string {
  const scenarios: Record<UsageScenario, string> = {
    paper: '学术论文插图',
    presentation: '演示文稿',
    document: '技术文档',
  };
  return scenarios[scenario] || '通用场景';
}

/**
 * 获取主题风格描述文本
 */
function getThemeText(theme: string): string {
  const themeMap: Record<string, string> = {
    professional: '专业风格，使用深色系，简洁大方',
    lively: '活泼风格，使用明亮色彩',
    academic: '学术风格，使用黑白色调，适合论文发表',
    minimal: '极简风格，最少色彩和装饰',
  };
  return themeMap[theme] || '通用风格';
}

function getLayoutDirectionText(direction: 'LR' | 'TB'): string {
  return direction === 'LR' ? '整体从左到右' : '整体从上到下';
}

function getStructurePatternText(pattern: StructurePattern | undefined): string {
  const patternMap: Record<StructurePattern, string> = {
    linear: '线性主干',
    branched: '主干带分支',
    convergent: '多支汇聚',
    'multi-lane': '多轨分层',
    feedback: '包含反馈回路',
    mixed: '混合结构',
  };

  return pattern ? patternMap[pattern] : '混合结构';
}

function formatEmphasisTargets(targets: string[] | undefined): string {
  if (!targets || targets.length === 0) {
    return '无特别强调';
  }

  return targets.join('、');
}

/**
 * 获取布局区域描述文本
 */
function getLayoutAreaText(area: string): string {
  const areaMap: Record<string, string> = {
    compact: '紧凑布局，节省空间',
    medium: '中等布局，平衡空间和内容',
    spacious: '宽松布局，留有充足空白',
  };
  return areaMap[area] || '适中';
}

/**
 * 获取密集程度描述文本
 */
function getDensityText(density: string): string {
  const densityMap: Record<string, string> = {
    dense: '密集排列',
    balanced: '平衡排列',
    sparse: '稀疏排列',
  };
  return densityMap[density] || '平衡';
}

function getStyleModeRecipe(mode: GenerationContext['styleMode']) {
  switch (mode) {
    case 'minimal':
      return '优先产出干净、克制、低装饰的版本，减少颜色和多余分组。';
    case 'semantic':
      return '优先用 classDef / class / style 做语义色板，把问题、方案、价值、理论等层次分出来。';
    case 'grouped':
      return '优先用 subgraph、section 或分层块强化信息分区，让读者按区块理解。';
    case 'showcase':
      return '在保证语义正确的前提下输出更强的展示感，允许核心节点高亮、颜色分层、分组标题和更完整的视觉节奏。';
    case 'auto':
    default:
      return '根据原文自动决定是极简、语义配色还是分组信息图，但不要无意义堆砌样式。';
  }
}

function getDiagramStyleText(style: GenerationContext['diagramStyle']): string {
  switch (style) {
    case 'architecture':
      return '系统架构，模块边界更清楚';
    case 'explainer':
      return '讲解流程，叙事推进更明显';
    case 'publication':
    default:
      return '论文刊物，克制而规整';
  }
}

function getBeautyLevelText(level: GenerationContext['beautyLevel']): string {
  switch (level) {
    case 'conservative':
      return '保守，以稳定和清晰为主';
    case 'enhanced':
      return '强化，主动追求版式感';
    case 'balanced':
    default:
      return '平衡，兼顾稳定与观感';
  }
}

function getLayoutRhythmText(rhythm: GenerationContext['layoutRhythm']): string {
  switch (rhythm) {
    case 'compact':
      return '紧凑，减少无效绕行';
    case 'symmetrical':
      return '对称，尽量平衡两侧关系';
    case 'airy':
    default:
      return '舒展，保留更清楚的层次留白';
  }
}

function getVisualFocusText(focus: GenerationContext['visualFocus']): string {
  switch (focus) {
    case 'input':
      return '输入端';
    case 'output':
      return '输出端';
    case 'convergence':
      return '汇聚点';
    case 'core':
    default:
      return '核心方法';
  }
}

function getDiagramStyleRecipe(style: GenerationContext['diagramStyle']) {
  switch (style) {
    case 'architecture':
      return '把模块边界画清楚，局部分组只在边界明确时使用，整体像系统架构图而不是流水账。';
    case 'explainer':
      return '保持讲解顺序自然推进，减少不必要岔路，让读者一眼看到故事线。';
    case 'publication':
    default:
      return '维持发表级论文插图的克制感，主干规整、局部层次清楚，不要为了装饰打散结构。';
  }
}

function getBeautyLevelRecipe(level: GenerationContext['beautyLevel']) {
  switch (level) {
    case 'conservative':
      return '优先选择最稳妥的节点组织方式，不追求复杂花样，先保证清楚和整齐。';
    case 'enhanced':
      return '在不增加复杂 Mermaid 语法的前提下，主动优化主干比例、并行块平衡和视觉锚点。';
    case 'balanced':
    default:
      return '在稳定预览和图面层次之间取平衡，允许适度分组和更清楚的收束。';
  }
}

function getLayoutRhythmRecipe(rhythm: GenerationContext['layoutRhythm']) {
  switch (rhythm) {
    case 'compact':
      return '尽量减少不必要的横向或纵向拉长，结构紧凑但不要拥挤。';
    case 'symmetrical':
      return '若语义允许，尽量让并行支路和两侧模块长度接近，避免一边过重一边过空。';
    case 'airy':
    default:
      return '让主干和辅助结构之间更有层次感，不要把所有节点挤成一团。';
  }
}

function getVisualFocusRecipe(
  focus: GenerationContext['visualFocus'],
  emphasisTargets: string[] | undefined
) {
  const targetText = emphasisTargets?.length ? `，并优先照顾 ${emphasisTargets.join('、')}` : '';

  switch (focus) {
    case 'input':
      return `把输入端做成最先被看见的起点，其他模块围绕输入展开${targetText}。`;
    case 'output':
      return `让输出端成为最明确的终点，前面过程服务于结果收束${targetText}。`;
    case 'convergence':
      return `让汇聚点成为主要锚点，并尽量把前置支路组织成清晰的收束关系${targetText}。`;
    case 'core':
    default:
      return `让核心方法成为视觉中心，输入和输出围绕它服务，不要把重点打散${targetText}。`;
  }
}

/**
 * 获取 Mermaid 定向修复提示词
 */
export function getMermaidRepairPrompt(options: {
  brokenMermaid: string;
  errors?: string[];
  originalRequest?: string;
}): string {
  const { brokenMermaid, errors = [], originalRequest } = options;
  const errorList = errors.length > 0 ? errors.map((error) => `- ${error}`).join('\n') : '- 本地校验或转换失败';

  return `请修复下面这段 Mermaid 代码，并仅输出修复后的完整 Mermaid 代码。

${originalRequest ? `原始用户需求：${originalRequest}\n` : ''}当前检测到的问题：
${errorList}

待修复 Mermaid：
\`\`\`mermaid
${brokenMermaid}
\`\`\`

严格要求：
1. 优先保持原始语义、节点 ID、连接关系和 subgraph 层级
2. 只修复 Mermaid 语法、括号、引号、classDef/class 绑定和明显截断问题
3. 如缺少图类型声明，默认补成 flowchart LR
4. 只输出完整 Mermaid 代码，不要输出 markdown 代码块，不要解释`;
}

/**
 * 提取 Mermaid 代码
 */
export function extractMermaidCode(text: string): string {
  // 尝试从 markdown 代码块中提取 Mermaid 代码
  const mermaidBlockRegex = /```(?:mermaid)?\s*\n([\s\S]*?)\n```/;
  const match = text.match(mermaidBlockRegex);
  if (match && match[1]) {
    return match[1].trim();
  }

  const lines = text.split('\n');
  const startIndex = findDiagramStartIndex(lines);

  if (startIndex !== -1) {
    const mermaidLines: string[] = [];
    let currentDeclaration: string | null = null;

    for (const line of lines.slice(startIndex)) {
      if (line.trim().startsWith('```')) {
        break;
      }

      const declaration = findDiagramDeclaration(line);
      if (declaration) {
        currentDeclaration = declaration;
      }

      if (isLikelyMermaidLine(line, mermaidLines.length === 0, currentDeclaration)) {
        mermaidLines.push(line);
        continue;
      }

      if (
        mermaidLines.length > 0 &&
        /^说明[:：]|^note[:：]|^解释[:：]|^总结[:：]|^summary[:：]|^下面是/i.test(line.trim())
      ) {
        break;
      }

      if (mermaidLines.length > 0) {
        break;
      }
    }

    if (mermaidLines.length > 0) {
      return mermaidLines.join('\n').trim();
    }
  }

  const heuristicStartIndex = lines.findIndex((line) => isLikelyMermaidStartLine(line));
  if (heuristicStartIndex !== -1) {
    const mermaidLines: string[] = [];

    for (const line of lines.slice(heuristicStartIndex)) {
      if (line.trim().startsWith('```')) {
        break;
      }

      if (isLikelyMermaidLine(line, false, null)) {
        mermaidLines.push(line);
        continue;
      }

      if (mermaidLines.length > 0) {
        break;
      }
    }

    if (mermaidLines.length > 0) {
      return mermaidLines.join('\n').trim();
    }
  }

  // 没识别到 Mermaid 主体时，视为未提取成功
  return '';
}

/**
 * 从文本中提取 JSON 代码块或对象文本
 */
export function extractJsonBlock(text: string): string {
  const fencedMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const arrayStart = text.indexOf('[');
  const objectStart = text.indexOf('{');
  const start = [arrayStart, objectStart]
    .filter((value) => value >= 0)
    .sort((left, right) => left - right)[0];

  if (start === undefined) {
    return text.trim();
  }

  return text.slice(start).trim();
}

function findDiagramStartIndex(lines: string[]) {
  let insideFrontmatter = false;
  let prefixStart = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim() || '';

    if (!trimmed) {
      continue;
    }

    if (!insideFrontmatter && trimmed === '---') {
      if (prefixStart === -1) {
        prefixStart = index;
      }
      insideFrontmatter = true;
      continue;
    }

    if (insideFrontmatter) {
      if (trimmed === '---') {
        insideFrontmatter = false;
      }
      continue;
    }

    if (/^%%\{.*\}%%$/.test(trimmed) || /^%%/.test(trimmed)) {
      if (prefixStart === -1) {
        prefixStart = index;
      }
      continue;
    }

    if (findDiagramDeclaration(trimmed)) {
      return prefixStart === -1 ? index : prefixStart;
    }
  }

  return -1;
}

function isLikelyMermaidLine(
  line: string,
  isFirstLine: boolean,
  declaration: string | null
): boolean {
  const trimmed = line.trim();

  if (!trimmed) {
    return true;
  }

  if (isFirstLine) {
    return /^%%\{.*\}%%$/.test(trimmed) || trimmed === '---' || Boolean(findDiagramDeclaration(trimmed));
  }

  if (trimmed === '---' || /^%%\{.*\}%%$/.test(trimmed)) {
    return true;
  }

  if (findDiagramDeclaration(trimmed)) {
    return true;
  }

  if (declaration && requiresStrictBodyParsing(declaration)) {
    return isLikelyStructuredDiagramBodyLine(trimmed, declaration);
  }

  if (declaration) {
    return !/^说明[:：]|^note[:：]|^解释[:：]|^总结[:：]|^summary[:：]|^下面是/i.test(trimmed);
  }

  return /^(subgraph|end|classDef|class|style|linkStyle|click|%%)\b/.test(trimmed)
    || /-->|---|-.->|==>|==/.test(trimmed)
    || /^%%/.test(trimmed)
    || /^\w[\w-]*\s*(?:\[[^\]]*\]|\([^)]+\)|\{[^}]+\}|:::.*)?$/.test(trimmed)
    || /^\w[\w-]*\s*:::/.test(trimmed);
}

function isLikelyMermaidStartLine(line: string): boolean {
  const trimmed = line.trim();

  if (!trimmed) {
    return false;
  }

  return /^(subgraph|classDef|class|style|linkStyle|click|%%)\b/.test(trimmed)
    || /-->|---|-.->|==>|==/.test(trimmed)
    || /^\w[\w-]*\s*(?:\[[^\]]*\]|\([^)]+\)|\{[^}]+\}|:::.*)/.test(trimmed);
}

function requiresStrictBodyParsing(declaration: string) {
  return /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|gitGraph|requirementDiagram)$/i.test(
    declaration
  );
}

function isLikelyStructuredDiagramBodyLine(trimmed: string, declaration: string) {
  const commonPattern =
    /^(subgraph|end|classDef|class|style|linkStyle|click|%%|title|accTitle|accDescr|section|direction)\b/i;

  if (commonPattern.test(trimmed)) {
    return true;
  }

  if (/^(flowchart|graph|stateDiagram|stateDiagram-v2|requirementDiagram)$/i.test(declaration)) {
    return /-->|---|-.->|==>|==|<-->|\{\{|}}/.test(trimmed)
      || /^\w[\w-]*\s*(?:\[[^\]]*\]|\([^)]+\)|\{[^}]+\})?(?:\s*:::.*)?$/.test(trimmed)
      || /^\w[\w-]*\s*:::/.test(trimmed)
      || /^state\s+["\w]/i.test(trimmed)
      || /^\[\*]\s*--/.test(trimmed);
  }

  if (/^sequenceDiagram$/i.test(declaration)) {
    return /^(participant|actor|activate|deactivate|autonumber|Note|note|loop|alt|else|opt|par|and|critical|break|rect|box|create|destroy|end)\b/.test(
      trimmed
    ) || /-{1,2}>>|={1,2}>>|--x|x--|->>|-->>/.test(trimmed);
  }

  if (/^classDiagram$/i.test(declaration)) {
    return /^(class|direction|namespace|note)\b/i.test(trimmed)
      || /<\|--|--\*|--o|-->|\.\.>|\.\.\|>|\*--|o--/.test(trimmed)
      || /^[+#~\-]\s*[\w"'<>{}()[\]:, ]+$/.test(trimmed)
      || /^<<.+>>$/.test(trimmed)
      || /^\w[\w-]*\s*:\s*.+$/.test(trimmed);
  }

  if (/^erDiagram$/i.test(declaration)) {
    return /(\|\|--|\|o--|o\|--|o\{--|\}\|--|\}o--|\|\{--)/.test(trimmed)
      || /^(%%|\w[\w-]*\s*\{|\})/.test(trimmed)
      || /^\w+\s+\w+(\s+(PK|FK|UK))?$/i.test(trimmed);
  }

  if (/^gitGraph$/i.test(declaration)) {
    return /^(commit|branch|checkout|merge|cherry-pick|reset)\b/i.test(trimmed);
  }

  return true;
}

function formatGraphInfo(graphInfo: GraphInfo): string {
  const groupLabels = graphInfo.groups.map((group) => group.label || group.id).join('、') || '无';
  const nodeSummary = graphInfo.nodes
    .slice(0, 6)
    .map((node) => `${node.id}:${node.label || node.id}`)
    .join('；') || '无';

  return `- 节点数量：${graphInfo.nodeCount}
- 图表深度：${graphInfo.depth}
- 平均度数：${graphInfo.avgDegree.toFixed(2)}
- 分组数量：${graphInfo.groups.length}
- 主要分组：${groupLabels}
- 节点摘要：${nodeSummary}`;
}

/**
 * 验证 Mermaid 代码基本格式
 */
export function validateMermaidCode(code: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const trimmedCode = code.trim();
  const lines = trimmedCode
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!trimmedCode) {
    errors.push('Mermaid 代码为空');
  }

  const declaration = findDiagramDeclaration(trimmedCode);

  if (!declaration) {
    errors.push('缺少 Mermaid 类型声明（如 flowchart LR, graph TD 等）');
  }

  if (declaration && isBracketSensitiveDeclaration(declaration)) {
    const bracketPairs: Array<[string, string, string]> = [
      ['\\[', '\\]', '方括号不匹配'],
      ['\\(', '\\)', '圆括号不匹配'],
      ['\\{', '\\}', '花括号不匹配'],
    ];

    bracketPairs.forEach(([openPattern, closePattern, message]) => {
      const openCount = (trimmedCode.match(new RegExp(openPattern, 'g')) || []).length;
      const closeCount = (trimmedCode.match(new RegExp(closePattern, 'g')) || []).length;

      if (openCount !== closeCount) {
        errors.push(message);
      }
    });
  }

  if (/```/.test(trimmedCode)) {
    warnings.push('代码中仍包含 markdown 代码块标记');
  }

  if (
    declaration &&
    isArrowSensitiveDeclaration(declaration) &&
    lines.some((line) => /(-->|---|-.->|==>|==)\s*$/.test(line))
  ) {
    errors.push('存在未完整的连接语句');
  }

  const subgraphCount = lines.filter((line) => line.startsWith('subgraph ')).length;
  const endCount = lines.filter((line) => line === 'end').length;
  if (subgraphCount > 0 && subgraphCount !== endCount) {
    warnings.push('subgraph 结构可能未完整闭合');
  }

  if (lines.length <= 1 && trimmedCode) {
    warnings.push('Mermaid 代码行数过少，可能是截断结果');
  }

  if (lines.slice(1).some((line) => /^说明[:：]|^note[:：]|^解释[:：]/i.test(line))) {
    warnings.push('Mermaid 代码中混入了解释性文本');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function isBracketSensitiveDeclaration(declaration: string) {
  return /^(flowchart|graph|classDiagram|stateDiagram|stateDiagram-v2|erDiagram)$/i.test(
    declaration
  );
}

function isArrowSensitiveDeclaration(declaration: string) {
  return /^(flowchart|graph|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|gitGraph)$/i.test(
    declaration
  );
}
