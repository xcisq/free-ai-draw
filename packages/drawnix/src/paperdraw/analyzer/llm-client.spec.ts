import {
  createSSEProcessor,
  extractFinalJsonBlock,
} from './llm-client';

describe('PaperDraw llm-client helpers', () => {
  it('extracts final json block from tagged text', () => {
    const rawText = `思考中...\n<<PAPERDRAW_JSON_START>>{"entities":[],"relations":[]}\n<<PAPERDRAW_JSON_END>>`;

    expect(extractFinalJsonBlock(rawText)).toBe('{"entities":[],"relations":[]}');
  });

  it('parses OpenAI-compatible SSE chunks', () => {
    let rawText = '';
    const processor = createSSEProcessor((delta) => {
      rawText += delta;
    });

    processor(
      [
        'data: {"choices":[{"delta":{"content":"分析中"}}]}',
        'data: {"choices":[{"delta":{"content":"<<PAPERDRAW_JSON_START>>"}}]}',
        'data: {"choices":[{"delta":{"content":"{\\"entities\\":[],\\"relations\\":[]}"}}]}',
        'data: {"choices":[{"delta":{"content":"<<PAPERDRAW_JSON_END>>"}}]}',
        'data: [DONE]',
        '',
      ].join('\n')
    );

    expect(rawText).toContain('分析中');
    expect(extractFinalJsonBlock(rawText)).toBe('{"entities":[],"relations":[]}');
  });
});
