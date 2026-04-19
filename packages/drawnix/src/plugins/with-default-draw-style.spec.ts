import {
  applyDefaultDrawStrokeColor,
  DEFAULT_DRAW_MEMORIZE_KEYS,
  DEFAULT_DRAW_STROKE_COLOR,
  withDefaultDrawStyle,
} from './with-default-draw-style';

const mockMemorizeLatest = jest.fn();

jest.mock('@plait/common', () => ({
  memorizeLatest: (...args: unknown[]) => mockMemorizeLatest(...args),
}));

jest.mock('@plait/draw', () => ({
  MemorizeKey: {
    basicShape: 'basicShape',
    flowchart: 'flowchart',
    UML: 'UML',
    arrowLine: 'arrow-line',
  },
}));

describe('withDefaultDrawStyle', () => {
  beforeEach(() => {
    mockMemorizeLatest.mockReset();
  });

  it('应初始化图形和箭头的默认描边为黑色', () => {
    applyDefaultDrawStrokeColor();

    expect(mockMemorizeLatest).toHaveBeenCalledTimes(
      DEFAULT_DRAW_MEMORIZE_KEYS.length
    );
    DEFAULT_DRAW_MEMORIZE_KEYS.forEach((memorizeKey, index) => {
      expect(mockMemorizeLatest).toHaveBeenNthCalledWith(
        index + 1,
        memorizeKey,
        'strokeColor',
        DEFAULT_DRAW_STROKE_COLOR
      );
    });
  });

  it('插件应返回原 board，并立即写入默认描边', () => {
    const board = {} as any;

    expect(withDefaultDrawStyle(board)).toBe(board);
    expect(mockMemorizeLatest).toHaveBeenCalled();
  });
});
