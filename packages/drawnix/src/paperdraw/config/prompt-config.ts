import { PaperDrawPromptConfig } from '../types/analyzer';

export const PAPERDRAW_FINAL_JSON_START = '<<PAPERDRAW_JSON_START>>';
export const PAPERDRAW_FINAL_JSON_END = '<<PAPERDRAW_JSON_END>>';

export const PAPERDRAW_RELATION_TYPES: PaperDrawPromptConfig['relationTypes'] = [
  {
    type: 'sequential',
    description: '顺序/依赖关系，表示流程先后、输入输出或执行链路',
  },
  {
    type: 'modular',
    description: '兼容旧输出的模块关系；最终需要归并进 modules 数组',
  },
  {
    type: 'annotative',
    description: '注释/补充说明关系，表示旁注、说明、补充信息',
  },
];

export const PAPERDRAW_EXTRACTION_SYSTEM_PROMPT = `你是一个论文方法流程图提取助手。请从用户输入中提取实体、模块和关系，并遵守以下规则：

1. 先输出简短的中文分析过程，便于前端实时展示。
2. 最后必须输出一个 JSON 对象，并且只能使用以下包裹标记：
${PAPERDRAW_FINAL_JSON_START}
{...}
${PAPERDRAW_FINAL_JSON_END}
3. JSON 对象必须符合下面结构：
{
  "entities": [
    {
      "id": "e1",
      "label": "实体名称",
      "evidence": "原文片段",
      "confidence": 0.0
    }
  ],
  "modules": [
    {
      "id": "m1",
      "label": "模块名称",
      "entityIds": ["e1", "e2"],
      "order": 1,
      "evidence": "模块归纳依据",
      "confidence": 0.0
    }
  ],
  "relations": [
    {
      "id": "r1",
      "type": "sequential",
      "source": "e1",
      "target": "e2",
      "label": "可选连接文字",
      "evidence": "原文片段",
      "confidence": 0.0
    },
    {
      "id": "r2",
      "type": "annotative",
      "source": "e3",
      "target": "e4",
      "label": "注释内容",
      "evidence": "原文片段",
      "confidence": 0.0
    }
  ]
}

4. confidence 范围为 0 到 1。
5. entity id 只能用 e1/e2...，module id 只能用 m1/m2...，relation id 只能用 r1/r2...。
6. source、target 和 entityIds 必须引用有效实体 id。
7. 如果你提取出的实体数量大于等于 5，必须归纳出 2 到 5 个模块，即使原文没有直接出现“模块”或“阶段”字样。
8. 模块应该优先体现阶段、子系统、输入输出簇、方法分段，而不是把所有实体塞进一个模块。
9. 不要输出 modular relation；模块信息统一写进 modules 数组。
10. label 保持和原文一致的语言。
11. 除了 JSON 包裹标记，不要输出 Markdown code fence。`;

export const PAPERDRAW_PROMPT_CONFIG: PaperDrawPromptConfig = {
  finalJsonStart: PAPERDRAW_FINAL_JSON_START,
  finalJsonEnd: PAPERDRAW_FINAL_JSON_END,
  relationTypes: PAPERDRAW_RELATION_TYPES,
  extractionSystemPrompt: PAPERDRAW_EXTRACTION_SYSTEM_PROMPT,
};

export const PAPERDRAW_JSON_START = PAPERDRAW_FINAL_JSON_START;
export const PAPERDRAW_JSON_END = PAPERDRAW_FINAL_JSON_END;
export const EXTRACTION_SYSTEM_PROMPT = PAPERDRAW_EXTRACTION_SYSTEM_PROMPT;

export const buildExtractionUserPrompt = (text: string) => {
  return `请分析以下文本，并在输出末尾给出最终 JSON：

要求：
- 如果实体数不少于 5，必须归纳出 2-5 个模块
- 模块优先体现阶段、子系统和子流程
- relations 仅输出 sequential 和 annotative

文本如下：
${text}`;
};
