/**
 * LLM 提示词模板管理
 * 提供 Mermaid 生成和样式优化的提示词模板
 */

import type { GenerationContext, GraphInfo, LayoutDirection, UsageScenario } from '../types';

/**
 * 获取初始系统提示词
 */
export function getInitialPrompt(): string {
  return `你是一个专业的论文框架图生成助手。你的任务是根据用户的描述生成 Mermaid 代码，用于创建论文 Pipeline 框架图。

遵循以下原则：
1. 使用矩形节点（stadium 或 rounded）表示处理步骤
2. 使用 subgraph 进行模块分组
3. 不使用复杂箭头标签
4. 使用 classDef 定义样式类
5. 支持的节点类型：矩形 ([...]) 和 圆角矩形 ([(...)])
6. 布局方向根据用户要求选择 LR（从左到右）或 TB（从上到下）

输出格式：仅输出 Mermaid 代码，不要包含任何解释文字。`;
}

/**
 * 获取 Mermaid 生成提示词
 */
export function getMermaidGenerationPrompt(context: GenerationContext): string {
  const { layoutDirection, usageScenario, nodeCount, theme, layoutArea, density } = context;

  const directionText = layoutDirection === 'LR' ? '从左到右' : '从上到下';

  return `请生成一个 Mermaid flowchart 代码，用于${getScenarioText(usageScenario)}。

要求：
- 布局方向：${directionText}
- 节点数量：约 ${nodeCount} 个
- 样式风格：${getThemeText(theme)}
- 整体布局：${layoutArea ? getLayoutAreaText(layoutArea) : '适中'}
- 密集程度：${density ? getDensityText(density) : '平衡'}

使用以下结构：
1. 使用 subgraph 对相关模块进行分组
2. 使用矩形节点 ([...]) 表示处理步骤
3. 使用圆角矩形 ([(...)]) 表示输入/输出节点
4. 使用 classDef 定义样式类
5. 使用 --> 连接节点

输出格式：仅输出 Mermaid 代码，不要包含任何解释文字。`;
}

/**
 * 获取样式优化提示词
 */
export function getStyleOptimizationPrompt(
  graphInfo: GraphInfo,
  styleRequest: string
): string {
  return `基于以下图表结构信息，为 Mermaid 图表生成样式方案。

图表信息：
- 节点数量：${graphInfo.nodeCount}
- 图表深度：${graphInfo.depth}
- 平均度数：${graphInfo.avgDegree.toFixed(2)}
- 分组数量：${graphInfo.groups.length}

用户样式需求：${styleRequest}

请生成 Mermaid classDef 样式定义，包含以下属性：
- fill: 填充颜色（CSS 颜色值）
- stroke: 边框颜色
- stroke-width: 边框粗细（px）
- color: 字体颜色
- fontSize: 字体大小（px）

输出格式：仅输出 classDef 定义代码，格式如下：
classDef className fill:#hex stroke:#hex stroke-width:Npx color:#hex fontSize:Npx

可以为不同类型的节点定义多个样式类（如 input、output、process）。`;
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
 * 获取样式调整提示词
 */
export function getStyleAdjustmentPrompt(
  currentMermaid: string,
  styleRequest: string
): string {
  return `请修改以下 Mermaid 代码的样式部分，以满足用户需求：${styleRequest}

当前 Mermaid 代码：
\`\`\`
${currentMermaid}
\`\`\`

请仅输出修改后的完整 Mermaid 代码，保持结构和连接关系不变，只修改 classDef 样式定义。`;
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
    return lines.slice(startIndex).join('\n').trim();
  }

  // 返回原文本
  return text.trim();
}

/**
 * 验证 Mermaid 代码基本格式
 */
export function validateMermaidCode(code: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const trimmedCode = code.trim();

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

  // 检查括号是否匹配
  const openBrackets = (trimmedCode.match(/\[/g) || []).length;
  const closeBrackets = (trimmedCode.match(/\]/g) || []).length;

  if (openBrackets !== closeBrackets) {
    errors.push('方括号不匹配');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
