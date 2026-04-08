import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { BoardStylePanel } from './index';
import { resolveBoardStyleSelection } from '../../utils/board-style-selection';

const mockGenerateSchemes = jest.fn();
const mockApplyScheme = jest.fn();
const mockPreviewScheme = jest.fn();
const mockClearPreview = jest.fn();
const mockClearError = jest.fn();
const mockUseBoardStyleOptimization = jest.fn(() => ({
  ...mockHookState,
  generateSchemes: mockGenerateSchemes,
  previewScheme: mockPreviewScheme,
  clearPreview: mockClearPreview,
  applyScheme: mockApplyScheme,
  clearError: mockClearError,
}));
const mockHookState = {
  schemes: [
    {
      id: 'scheme-1',
      name: '专业蓝',
      description: '适合技术流程图',
      styles: {
        shape: {
          nodeId: 'shape',
          fill: '#fff',
          stroke: '#333',
          strokeWidth: 2,
          color: '#333',
          fontSize: 14,
          shadow: false,
          shadowBlur: 0,
        },
      },
    },
  ],
  isGenerating: false,
  error: null as string | null,
  lastRequest: '',
};

const mockResolvedSelection = {
  targetElements: [{ id: 'shape-1' }],
  relatedLines: [{ id: 'line-1' }],
  summary: {
    total: 2,
    originalTotal: 1,
    shapeCount: 1,
    lineCount: 1,
    textCount: 0,
    relatedLineCount: 1,
    includeConnectedLines: true,
    fills: ['#fff'],
    strokes: ['#333'],
  },
};

jest.mock('../../hooks/use-board-style-optimization', () => ({
  useBoardStyleOptimization: (...args: unknown[]) => mockUseBoardStyleOptimization(...args),
}));

jest.mock('../../utils/board-style-selection', () => ({
  resolveBoardStyleSelection: jest.fn(() => mockResolvedSelection),
}));

describe('BoardStylePanel', () => {
  beforeEach(() => {
    mockGenerateSchemes.mockReset();
    mockApplyScheme.mockReset();
    mockPreviewScheme.mockReset();
    mockClearPreview.mockReset();
    mockClearError.mockReset();
    mockUseBoardStyleOptimization.mockClear();
    mockHookState.error = null;
    mockHookState.isGenerating = false;
    mockHookState.lastRequest = '';
    (resolveBoardStyleSelection as jest.Mock).mockReturnValue(mockResolvedSelection);
  });

  it('应该渲染选区摘要并支持应用', () => {
    render(
      <BoardStylePanel
        board={{} as any}
        selectedElements={[{ id: 'shape-1' } as any]}
      />
    );

    expect(screen.getByText('AI 样式优化')).toBeTruthy();
    expect(screen.getByText('原始选中 1 个，实际优化 2 个')).toBeTruthy();
    expect(screen.getByText('包含关联连线（自动补入 1 条）')).toBeTruthy();
    expect(screen.getByText('先输入你希望调整的样式要求，再点击生成。不会在打开面板时自动请求。')).toBeTruthy();
    expect(mockUseBoardStyleOptimization).toHaveBeenCalledWith(
      expect.objectContaining({
        autoGenerate: false,
      })
    );

    fireEvent.click(screen.getByText('专业蓝').closest('button')!);

    expect(mockApplyScheme).toHaveBeenCalledWith(mockHookState.schemes[0]);
  });

  it('应该支持自然语言继续生成', async () => {
    render(
      <BoardStylePanel
        board={{} as any}
        selectedElements={[{ id: 'shape-1' } as any]}
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText('先输入你的样式要求，例如：重点模块蓝色、标题更醒目、连线更清晰'),
      { target: { value: '更专业一点' } }
    );
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(mockGenerateSchemes).toHaveBeenCalledWith('更专业一点');
    });
  });

  it('hover 方案卡片时应触发预览，移出时应清除预览', () => {
    render(
      <BoardStylePanel
        board={{} as any}
        selectedElements={[{ id: 'shape-1' } as any]}
      />
    );

    const schemeButton = screen.getByText('专业蓝').closest('button')!;
    fireEvent.mouseEnter(schemeButton);
    fireEvent.mouseLeave(schemeButton);

    expect(mockPreviewScheme).toHaveBeenCalledWith(mockHookState.schemes[0]);
    expect(mockClearPreview).toHaveBeenCalled();
  });

  it('点击快捷提示词时应只填入输入框，不直接请求', () => {
    render(
      <BoardStylePanel
        board={{} as any}
        selectedElements={[{ id: 'shape-1' } as any]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '更专业' }));

    expect(
      screen.getByDisplayValue('整体更专业一些，适合论文或汇报图')
    ).toBeTruthy();
    expect(mockGenerateSchemes).not.toHaveBeenCalled();
  });

  it('面板内部点击输入框时不应冒泡到外层', () => {
    const onMouseDown = jest.fn();

    render(
      <div onMouseDown={onMouseDown}>
        <BoardStylePanel
          board={{} as any}
          selectedElements={[{ id: 'shape-1' } as any]}
        />
      </div>
    );

    const input = screen.getByPlaceholderText(
      '先输入你的样式要求，例如：重点模块蓝色、标题更醒目、连线更清晰'
    );

    fireEvent.mouseDown(input);

    expect(onMouseDown).not.toHaveBeenCalled();
  });

  it('在输入区按 Enter 会提交，Shift+Enter 仅换行', async () => {
    render(
      <BoardStylePanel
        board={{} as any}
        selectedElements={[{ id: 'shape-1' } as any]}
      />
    );

    const input = screen.getByPlaceholderText(
      '先输入你的样式要求，例如：重点模块蓝色、标题更醒目、连线更清晰'
    );

    fireEvent.change(input, { target: { value: '更专业一点' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockGenerateSchemes).toHaveBeenCalledWith('更专业一点');
    });

    mockGenerateSchemes.mockReset();
    fireEvent.change(input, { target: { value: '第一行' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(mockGenerateSchemes).not.toHaveBeenCalled();
  });

  it('切换包含关联连线时应重新解析目标选区', () => {
    render(
      <BoardStylePanel
        board={{} as any}
        selectedElements={[{ id: 'shape-1' } as any]}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));

    expect(resolveBoardStyleSelection).toHaveBeenLastCalledWith(
      {},
      [{ id: 'shape-1' }],
      { includeConnectedLines: false }
    );
  });
});
