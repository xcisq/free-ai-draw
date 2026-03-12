import {
  buildExtractionUserPrompt,
  PAPERDRAW_PROMPT_CONFIG,
} from './prompt-config';

describe('PaperDraw prompt config', () => {
  it('requires explicit modules in the system prompt', () => {
    expect(PAPERDRAW_PROMPT_CONFIG.extractionSystemPrompt).toContain('"modules"');
    expect(PAPERDRAW_PROMPT_CONFIG.extractionSystemPrompt).toContain('2 到 5 个模块');
  });

  it('adds module-oriented instructions to the user prompt', () => {
    const prompt = buildExtractionUserPrompt('输入文本');

    expect(prompt).toContain('必须归纳出 2-5 个模块');
    expect(prompt).toContain('relations 仅输出 sequential 和 annotative');
  });
});
