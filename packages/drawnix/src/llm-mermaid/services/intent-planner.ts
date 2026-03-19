import type {
  GenerationContext,
  Message,
  StructurePattern,
} from '../types';
import { llmChatService } from './llm-chat-service';
import {
  buildMermaidIntentPlanningPrompt,
  extractJsonBlock,
  getIntentPlanningSystemPrompt,
} from './prompt-templates';

export interface IntentPlanningResult {
  mode: 'generate' | 'clarify';
  normalizedContext: Partial<GenerationContext>;
  clarificationQuestion?: string;
  quickReplies?: string[];
  missingSignals?: string[];
}

export interface PlanMermaidIntentOptions {
  userInput: string;
  currentContext?: Partial<GenerationContext>;
  currentMermaid?: string;
  conversationHistory?: Message[];
  requestKind?: 'generate' | 'refine';
  signal?: AbortSignal;
}

const DEFAULT_CONTEXT: Partial<GenerationContext> = {
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

export async function planMermaidIntent(
  options: PlanMermaidIntentOptions
): Promise<IntentPlanningResult> {
  const heuristicContext = inferContext(options.userInput, options.currentContext);
  const conversationSummary = buildConversationSummary(options.conversationHistory);

  const response = await llmChatService.chat(
    [
      {
        id: 'intent-planner-system',
        role: 'system',
        content: getIntentPlanningSystemPrompt(),
        timestamp: Date.now(),
        type: 'text',
      },
      {
        id: 'intent-planner-user',
        role: 'user',
        content: buildMermaidIntentPlanningPrompt({
          userInput: options.userInput,
          currentContext: heuristicContext,
          currentMermaid: options.currentMermaid,
          conversationSummary,
          requestKind: options.requestKind,
        }),
        timestamp: Date.now(),
        type: 'text',
      },
    ],
    {
      signal: options.signal,
      temperature: 0.2,
      maxTokens: 900,
    }
  );

  return normalizePlanningResult(response, heuristicContext);
}

export function shouldRunIntentPlanner(options: {
  userInput: string;
  currentContext?: Partial<GenerationContext>;
  currentMermaid?: string;
  requestKind?: 'generate' | 'refine';
}) {
  const { userInput, currentContext, currentMermaid, requestKind } = options;
  const trimmed = userInput.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) {
    return false;
  }

  if (requestKind === 'refine' || currentMermaid?.trim()) {
    return false;
  }

  const hasProcessSignals =
    /首先|然后|接着|最后|输入|输出|模块|阶段|步骤|训练|推理|评估|编码|解码|检测|分类/.test(trimmed) ||
    /first|then|finally|input|output|module|stage|step|train|infer|evaluate/.test(lower);
  const hasStructureSignals =
    /从左到右|从上到下|并行|汇聚|分支|辅轨|反馈|上下/.test(trimmed) ||
    /left to right|top to bottom|parallel|merge|branch|feedback/.test(lower);
  const hasRichContext = Boolean(
    currentContext?.layoutIntentText?.trim() ||
      (currentContext?.structurePattern && currentContext.structurePattern !== 'mixed')
  );

  if (hasProcessSignals) {
    return false;
  }

  if (trimmed.length <= 16) {
    return true;
  }

  if (trimmed.length <= 28 && hasStructureSignals && !hasRichContext) {
    return true;
  }

  return false;
}

function normalizePlanningResult(
  response: string,
  heuristicContext: Partial<GenerationContext>
): IntentPlanningResult {
  try {
    const parsed = JSON.parse(extractJsonBlock(response)) as Partial<IntentPlanningResult> & {
      normalizedContext?: Partial<GenerationContext>;
    };
    const normalizedContext = mergeContexts(
      heuristicContext,
      parsed.normalizedContext
    );
    const mode = parsed.mode === 'clarify' ? 'clarify' : 'generate';

    if (mode === 'clarify') {
      const question = parsed.clarificationQuestion?.trim() || '你更希望这张图的局部结构是并行展开，还是最终汇聚成一个主输出？';
      const quickReplies = normalizeQuickReplies(parsed.quickReplies);

      return {
        mode,
        normalizedContext: {
          ...normalizedContext,
          clarificationStatus: 'pending',
        },
        clarificationQuestion: question,
        quickReplies,
        missingSignals: parsed.missingSignals || [],
      };
    }

    return {
      mode,
      normalizedContext: {
        ...normalizedContext,
        clarificationStatus: 'resolved',
      },
      missingSignals: parsed.missingSignals || [],
    };
  } catch {
    return {
      mode: 'generate',
      normalizedContext: {
        ...heuristicContext,
        clarificationStatus: 'resolved',
      },
      missingSignals: [],
    };
  }
}

function normalizeQuickReplies(quickReplies: string[] | undefined) {
  if (!Array.isArray(quickReplies)) {
    return ['整体从左到右，局部并行后汇聚', '主干居中，上下分别放辅助模块'];
  }

  return quickReplies
    .map((reply) => reply.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function mergeContexts(
  base: Partial<GenerationContext>,
  incoming: Partial<GenerationContext> | undefined
): Partial<GenerationContext> {
  return {
    ...DEFAULT_CONTEXT,
    ...base,
    ...incoming,
    emphasisTargets: normalizeEmphasisTargets(
      incoming?.emphasisTargets?.length ? incoming.emphasisTargets : base.emphasisTargets
    ),
    layoutIntentText:
      incoming?.layoutIntentText?.trim() || base.layoutIntentText || '',
  };
}

function inferContext(
  userInput: string,
  currentContext: Partial<GenerationContext> = {}
): Partial<GenerationContext> {
  const inferredDirection = inferLayoutDirection(userInput) ?? currentContext.layoutDirection ?? 'LR';
  const inferredPattern = inferStructurePattern(userInput) ?? currentContext.structurePattern ?? 'mixed';
  const emphasisTargets = normalizeEmphasisTargets([
    ...(currentContext.emphasisTargets || []),
    ...extractEmphasisTargets(userInput),
  ]);

  return {
    ...DEFAULT_CONTEXT,
    ...currentContext,
    layoutDirection: inferredDirection,
    structurePattern: inferredPattern,
    layoutIntentText: mergeIntentText(currentContext.layoutIntentText, userInput),
    emphasisTargets,
  };
}

function buildConversationSummary(messages: Message[] = []) {
  const sliced = messages.slice(-6);
  if (sliced.length === 0) {
    return '';
  }

  return sliced
    .map((message) => {
      const role = message.role === 'assistant' ? 'AI' : message.role === 'user' ? '用户' : '系统';
      const content = message.content.replace(/\s+/g, ' ').slice(0, 180);
      return `${role}：${content}`;
    })
    .join('\n');
}

function inferLayoutDirection(userInput: string): 'LR' | 'TB' | null {
  if (/从上到下|自上而下|上下/.test(userInput)) {
    return 'TB';
  }

  if (/从左到右|自左向右|左右/.test(userInput)) {
    return 'LR';
  }

  return null;
}

function inferStructurePattern(userInput: string): StructurePattern | null {
  const lower = userInput.toLowerCase();
  const hasFeedback = /反馈|回路|闭环|迭代|循环/.test(userInput) || /feedback|loop/.test(lower);
  const hasMerge = /汇聚|收束|合并|融合|merge|converge/.test(userInput) || /汇合/.test(userInput);
  const hasBranch = /并行|分支|双路|多路|parallel|branch/.test(userInput) || /支路/.test(userInput);
  const hasLane = /上方|下方|辅轨|控制轨|辅助轨|多轨|上下分层/.test(userInput);

  const matches = [hasFeedback, hasMerge, hasBranch, hasLane].filter(Boolean).length;
  if (matches >= 2) {
    return 'mixed';
  }
  if (hasFeedback) {
    return 'feedback';
  }
  if (hasLane) {
    return 'multi-lane';
  }
  if (hasMerge) {
    return 'convergent';
  }
  if (hasBranch) {
    return 'branched';
  }
  if (/线性|一步一步|顺序/.test(userInput)) {
    return 'linear';
  }

  return null;
}

function extractEmphasisTargets(userInput: string) {
  const matches = userInput.match(/(?:突出|强调|重点展示|重点是)([^，。；\n]+)/g) || [];
  return matches
    .map((item) =>
      item.replace(/^(突出|强调|重点展示|重点是)/, '').trim()
    )
    .filter(Boolean);
}

function normalizeEmphasisTargets(targets: string[] | undefined) {
  return [...new Set((targets || []).map((target) => target.trim()).filter(Boolean))].slice(0, 4);
}

function mergeIntentText(previousIntent: string | undefined, userInput: string) {
  const trimmedInput = userInput.trim();
  if (!trimmedInput) {
    return previousIntent || '';
  }

  if (!previousIntent) {
    return trimmedInput;
  }

  if (previousIntent.includes(trimmedInput)) {
    return previousIntent;
  }

  return `${previousIntent}\n${trimmedInput}`.trim();
}
