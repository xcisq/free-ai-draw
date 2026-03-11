import { getPaperDrawEnvConfig } from './env-config';

describe('getPaperDrawEnvConfig', () => {
  it('reads configured env values', () => {
    expect(
      getPaperDrawEnvConfig({
        VITE_PAPERDRAW_API_KEY: 'sk-local',
        VITE_PAPERDRAW_BASE_URL: 'https://example.com/v1',
        VITE_PAPERDRAW_MODEL: 'qwen-max',
      })
    ).toEqual({
      apiKey: 'sk-local',
      baseUrl: 'https://example.com/v1',
      model: 'qwen-max',
      isConfigured: true,
    });
  });

  it('falls back to defaults when env values are missing', () => {
    expect(getPaperDrawEnvConfig()).toEqual({
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      isConfigured: false,
    });
  });
});
