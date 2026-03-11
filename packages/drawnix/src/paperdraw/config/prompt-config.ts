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
    description: '模块/阶段归属关系，表示多个实体属于同一模块或阶段',
  },
  {
    type: 'annotative',
    description: '注释/补充说明关系，表示旁注、说明、补充信息',
  },
];

export const PAPERDRAW_EXTRACTION_SYSTEM_PROMPT = `你是一个论文方法流程图提取助手。请从用户输入中提取实体和关系，并遵守以下规则：

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
      "type": "modular",
      "moduleLabel": "模块名称",
      "entityIds": ["e1", "e2"],
      "confidence": 0.0
    },
    {
      "id": "r3",
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
5. id 只能用 e1/e2... 和 r1/r2...。
6. source、target 和 entityIds 必须引用有效实体 id。
7. 如果没有明确模块，可以不输出 modular 关系。
8. label 保持和原文一致的语言。
9. 除了 JSON 包裹标记，不要输出 Markdown code fence。`;

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

${text}`;
};
