import {
  normalizeFontFamilyStack,
  resolveFontFamilyOption,
  setProjectFontFamilyOptions,
} from './font';

describe('font option matching', () => {
  afterEach(() => {
    setProjectFontFamilyOptions(undefined);
  });

  it('应优先按主字体匹配，而不是被 fallback 误判成默认无衬线', () => {
    const normalized = normalizeFontFamilyStack('Georgia, serif');

    const resolved = resolveFontFamilyOption(normalized);

    expect(resolved.label).toBe('Georgia');
  });

  it('应能在项目级字体方案下返回正确标签', () => {
    setProjectFontFamilyOptions([
      {
        label: '默认无衬线',
        value:
          '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      },
      {
        label: '宋体',
        value: '"Songti SC", "STSong", "Noto Serif CJK SC", serif',
      },
    ]);

    const normalized = normalizeFontFamilyStack(
      '"Songti SC", "STSong", "Noto Serif CJK SC", serif'
    );

    const resolved = resolveFontFamilyOption(normalized);

    expect(resolved.label).toBe('宋体');
  });
});
