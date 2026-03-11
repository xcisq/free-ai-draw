/**
 * CRS (Conversational Recommendation System) 对话代理
 * 通过多轮 QA 确认模块分组和重要性权重
 */

import {
  LLMConfig,
  ExtractionResult,
  AnalysisResult,
  CRSQuestion,
  CRSAnswer,
} from '../types/analyzer';
import { callLLM } from './llm-client';

const GENERATE_QUESTIONS_PROMPT = `你是一个流程图生成助手的对话代理。基于已提取的实体和关系，生成 2-3 个问题来帮助用户确认：
1. 模块分组：哪些实体应该归入同一个模块/阶段
2. 重要性排序：哪些实体在流程中更重要（权重更高）

输出 JSON 格式：
{
  "questions": [
    {
      "id": "q1",
      "type": "module_grouping",
      "question": "问题文本",
      "options": ["实体标签1", "实体标签2", ...],
      "multiSelect": true
    },
    {
      "id": "q2",
      "type": "importance_ranking",
      "question": "问题文本",
      "options": ["实体标签1", "实体标签2", ...],
      "multiSelect": false
    }
  ]
}

注意：
- 模块分组问题：options 列出所有可能属于同一模块的实体标签，multiSelect 为 true
- 重要性排序问题：options 列出需要比较的实体标签，multiSelect 为 false（用户选最重要的）
- 问题用与实体标签相同的语言
- 每个问题最多列出 6 个 options`;

const REFINE_PROMPT = `你是一个流程图生成助手。基于已提取的实体和关系，以及用户对问题的回答，生成最终的分析结果。

你需要输出一个 JSON，包含：
1. entities: 实体列表（保持原始提取不变）
2. relations: 关系列表（可能根据用户回答调整模块分组）
3. weights: 每个实体的重要性权重（0-1 范围，基于用户回答调整）
4. modules: 模块分组列表（基于用户回答确认的分组）

输出格式：
{
  "entities": [...],
  "relations": [...],
  "weights": {"e1": 0.8, "e2": 0.6, ...},
  "modules": [
    {"id": "m1", "type": "modular", "moduleLabel": "模块名", "entityIds": ["e1", "e2"]}
  ]
}

注意：
- 所有实体都必须有 weight 值
- 如果用户选择了某个实体更重要，给它更高的权重（0.7-1.0）
- 未被选中的实体给中等权重（0.4-0.6）
- 用户确认的模块分组应体现在 modules 和 relations 中
- 确保 modules 中的 entityIds 引用的是有效的实体 id`;

/**
 * 基于 LLM 提取结果生成 QA 问题
 */
export async function generateQuestions(
  extraction: ExtractionResult,
  config: LLMConfig
): Promise<CRSQuestion[]> {
  const entityLabels = extraction.entities.map((e) => e.label);
  const relationsSummary = extraction.relations.map((r) => {
    if (r.type === 'modular') {
      return `模块 "${r.moduleLabel}" 包含 [${r.entityIds.join(', ')}]`;
    }
    return `${r.source} --${r.type}--> ${r.target}`;
  });

  const content = await callLLM(config, [
    { role: 'system', content: GENERATE_QUESTIONS_PROMPT },
    {
      role: 'user',
      content: `已提取的实体标签: ${JSON.stringify(entityLabels)}
已识别的关系: ${JSON.stringify(relationsSummary)}

请生成问题帮助用户确认分组和重要性。`,
    },
  ]);

  const parsed = JSON.parse(content);
  return parsed.questions as CRSQuestion[];
}

/**
 * 根据用户回答让 LLM 生成最终分析结果
 */
export async function refineWithAnswers(
  extraction: ExtractionResult,
  answers: CRSAnswer[],
  questions: CRSQuestion[],
  config: LLMConfig
): Promise<AnalysisResult> {
  const qaHistory = questions.map((q) => {
    const answer = answers.find((a) => a.questionId === q.id);
    return {
      question: q.question,
      type: q.type,
      selectedOptions: answer?.selectedOptions ?? [],
    };
  });

  const content = await callLLM(config, [
    { role: 'system', content: REFINE_PROMPT },
    {
      role: 'user',
      content: `原始提取结果:
${JSON.stringify(extraction, null, 2)}

用户的问答记录:
${JSON.stringify(qaHistory, null, 2)}

请基于用户的回答生成最终分析结果。`,
    },
  ]);

  const parsed = JSON.parse(content);
  return parsed as AnalysisResult;
}

/**
 * 跳过 QA 环节，使用 LLM 直接生成默认的 AnalysisResult
 */
export async function generateDefaultAnalysis(
  extraction: ExtractionResult,
  config: LLMConfig
): Promise<AnalysisResult> {
  const content = await callLLM(config, [
    { role: 'system', content: REFINE_PROMPT },
    {
      role: 'user',
      content: `原始提取结果:
${JSON.stringify(extraction, null, 2)}

用户选择跳过问答环节。请根据文本内容自动推断合理的模块分组和重要性权重，生成最终分析结果。`,
    },
  ]);

  const parsed = JSON.parse(content);
  return parsed as AnalysisResult;
}
