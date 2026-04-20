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

const DEFAULT_GENERATION_CONTEXT: GenerationContext = {
  layoutDirection: 'LR',
  usageScenario: 'paper',
  nodeCount: 5,
  theme: 'academic',
  layoutArea: 'medium',
  density: 'balanced',
  structurePattern: 'mixed',
  layoutIntentText: '',
  emphasisTargets: [],
  clarificationStatus: 'none',
};

/**
 * 获取初始系统提示词
 */
export function getInitialPrompt(): string {
  return `你是一个专业的 Mermaid 论文图生成助手。你只会收到一次 one-shot 请求，你的任务是理解用户提供的原始文本和轻量结构约束，并直接输出一版可以稳定预览的 Mermaid 流程图。

遵循以下原则：
1. 用户输入的正文、段落、方法描述或需求文本，是图的主要语义来源
2. 先从用户文本中抽取输入、处理阶段、输出、依赖关系和层级，再组织成图
3. 如果用户文本已经包含顺序、模块名或关系，请优先忠实反映，不要脱离文本另起一套流程
4. 用户提到的“从左到右/从上到下”表示整体主视觉趋势，不代表所有节点都必须严格排成单轴直线
5. 如果文本说明局部存在并行、分支、上下辅轨、汇聚或反馈，优先保留这些局部结构
6. 节点文案要克制，优先压缩到 4 到 10 个字，不要把整句原文直接塞进节点
7. 对论文图，优先保证主干清晰、局部层次分明、汇聚明确、反馈尽量走外圈
8. 优先使用简单、稳定的 Mermaid flowchart 语法，避免冷门特性
9. 默认只使用基础节点和基础连线：矩形 ([...])、圆角矩形 ([(...)])、-->
10. 只有当模块边界非常明确时才使用 subgraph，非必要不要输出 classDef、class、style、linkStyle、click
11. 不要为了“好看”额外引入复杂语法，优先保证生成结果能被稳定预览和转换
12. 输出的第一行必须直接是 Mermaid 图类型声明，例如 flowchart LR 或 flowchart TB
13. 严禁输出“下面是 Mermaid 代码”“说明”“总结”“\`\`\`mermaid”等非 Mermaid 正文内容

输出格式：
- 仅输出完整 Mermaid 代码
- 第一行必须是 flowchart LR 或 flowchart TB
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
    "usageScenario": "paper" | "presentation" | "document",
    "theme": "academic" | "professional" | "lively" | "minimal",
    "layoutArea": "compact" | "medium" | "spacious",
    "density": "dense" | "balanced" | "sparse",
    "structurePattern": "linear" | "branched" | "convergent" | "multi-lane" | "feedback" | "mixed",
    "layoutIntentText": "string",
    "emphasisTargets": ["string"]
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
    usageScenario,
    nodeCount,
    theme,
    layoutArea,
    density,
    structurePattern,
    layoutIntentText,
    emphasisTargets,
  } = context;

  return `请基于用户提供的原始文本生成一个 Mermaid flowchart，用于${getScenarioText(usageScenario)}。

注意：
- 下面的结构化配置只用于约束整体阅读方向、结构骨架和图面复杂度
- 图中的节点、模块和连接关系，应优先来自用户输入文本本身
- “主阅读方向”表示整体视觉连贯性，不要求所有节点都严格排成一条水平线或竖线
- 如果文本说明局部存在并行、分支、上下分层、汇聚或反馈，请优先保留这些细节
- 对论文图，优先保证主干清晰、辅助结构克制、汇聚位置明确、反馈关系尽量外置
- 这次是 one-shot 生成，不要把希望中的未来补充信息写成节点

要求：
- 主阅读方向：${getLayoutDirectionText(layoutDirection)}
- 节点数量：约 ${nodeCount} 个
- 样式风格：${getThemeText(theme)}
- 整体布局：${layoutArea ? getLayoutAreaText(layoutArea) : '适中'}
- 密集程度：${density ? getDensityText(density) : '平衡'}
- 结构模式：${getStructurePatternText(structurePattern)}
- 构图补充：${layoutIntentText?.trim() || '未额外指定，请按文本语义做最小必要推断'}
- 重点强调：${formatEmphasisTargets(emphasisTargets)}

输出要求：
1. 默认使用基础 flowchart 语法，优先用 -->、[...]、[(...)] 组织结构
2. 只有当模块边界很明确时才使用 subgraph，非必要不要输出 classDef、class、style、linkStyle、click
3. 节点文案尽量压缩，不要直接复制超长论文句子作为节点名
4. 节点和连线以结构正确、可稳定预览为第一优先级，不要为了美观引入复杂 Mermaid 特性
4. 主干节点优先维持清晰的阅读顺序，局部允许存在辅轨、并行块或收束结构
5. 如果用户要求“整体从左到右，但局部有上下辅轨/并行支路/汇聚”，请把这种局部结构真实画出来，而不是压扁成简单横向链路
6. 第一行必须直接输出 flowchart ${layoutDirection}，不要在前面写任何解释
7. 不要输出 markdown 代码块，不要输出“下面是 Mermaid 代码”之类提示语

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

  return `${getMermaidGenerationPrompt(mergedContext)}

任务要求：
- 请把下面这段内容当作“用户原始文本和意图说明”，而不是普通一句提示词
- 你需要从文本中抽取流程阶段、模块、输入输出和依赖关系
- 如果文本是论文方法描述，请把方法结构可视化；如果文本是需求描述，请把执行流程可视化
- 不要脱离这段文本另起一套通用流程图
- 如果文本里同时出现“整体阅读方向”和“局部结构要求”，优先同时满足两者
- 请把所有结构信息直接体现在 Mermaid 的节点、连线和必要的少量 subgraph 中，不要输出解释文本
- 节点命名优先压缩成短标签，避免长句直接进节点
- 这是一次 one-shot 请求，不要先提问，也不要输出待确认占位节点
- 输出时第一行必须直接是 flowchart ${mergedContext.layoutDirection}
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

  // 如果没有代码块，尝试查找以 flowchart、graph 等开头的行
  const lines = text.split('\n');
  const startIndex = lines.findIndex((line) =>
    /^(flowchart|graph|stateDiagram|classDiagram|sequenceDiagram|erDiagram|gantt|pie|journey)/.test(line.trim())
  );

  if (startIndex !== -1) {
    const mermaidLines: string[] = [];

    for (const line of lines.slice(startIndex)) {
      if (isLikelyMermaidLine(line, mermaidLines.length === 0)) {
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

  const heuristicStartIndex = lines.findIndex((line) => isLikelyMermaidStartLine(line));
  if (heuristicStartIndex !== -1) {
    const mermaidLines: string[] = [];

    for (const line of lines.slice(heuristicStartIndex)) {
      if (isLikelyMermaidLine(line, false)) {
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

function isLikelyMermaidLine(line: string, isFirstLine: boolean): boolean {
  const trimmed = line.trim();

  if (!trimmed) {
    return true;
  }

  if (isFirstLine) {
    return /^(flowchart|graph|stateDiagram|classDiagram|sequenceDiagram|erDiagram|gantt|pie|journey)/.test(
      trimmed
    );
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

  // 检查是否包含基本的 Mermaid 关键字
  const hasMermaidKeyword = /^(flowchart|graph|stateDiagram|classDiagram|sequenceDiagram|erDiagram|gantt|pie|journey)/.test(
    trimmedCode
  );

  if (!hasMermaidKeyword) {
    errors.push('缺少 Mermaid 类型声明（如 flowchart LR, graph TD 等）');
  }

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

  if (/```/.test(trimmedCode)) {
    warnings.push('代码中仍包含 markdown 代码块标记');
  }

  if (lines.some((line) => /(-->|---|-.->|==>|==)\s*$/.test(line))) {
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
