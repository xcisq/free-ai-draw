import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PreviewPanel } from './index';

const mockUpdateCode = jest.fn();
const mockClear = jest.fn();
const mockClearError = jest.fn();
const mockPreviewState = {
  elements: [] as unknown[],
  isConverting: false,
  validation: null as null | { isValid: boolean; errors: string[]; warnings: string[] },
  isValid: false,
  error: null as null | string,
};

jest.mock('../../hooks/use-mermaid-preview', () => ({
  useMermaidPreview: () => ({
    ...mockPreviewState,
    updateCode: mockUpdateCode,
    clear: mockClear,
    clearError: mockClearError,
  }),
}));

jest.mock('./board-preview', () => ({
  BoardPreview: ({ error }: { error?: string | null }) => (
    <div data-testid="board-preview">{error || 'board-ok'}</div>
  ),
}));

jest.mock('./mermaid-code-view', () => ({
  MermaidCodeView: ({ code }: { code: string }) => (
    <div data-testid="mermaid-code-view">{code}</div>
  ),
}));

describe('PreviewPanel', () => {
  beforeEach(() => {
    mockUpdateCode.mockReset();
    mockUpdateCode.mockImplementation(async (code: string) => code);
    mockClear.mockReset();
    mockClearError.mockReset();
    mockPreviewState.elements = [];
    mockPreviewState.isConverting = false;
    mockPreviewState.validation = null;
    mockPreviewState.isValid = false;
    mockPreviewState.error = null;
  });

  it('初始空态不会错误显示 Mermaid 无效', async () => {
    render(<PreviewPanel mermaidCode="" />);

    expect(screen.queryByText('Mermaid 代码无效')).toBeNull();
    expect(screen.getByTestId('board-preview').textContent).toBe('board-ok');
    await waitFor(() => {
      expect(mockClear).toHaveBeenCalledTimes(1);
    });
  });

  it('外部代码被清空时会同步清理本地预览', async () => {
    const { rerender } = render(<PreviewPanel mermaidCode="flowchart LR\nA --> B" />);

    await waitFor(() => {
      expect(mockUpdateCode).toHaveBeenCalledWith(
        expect.stringContaining('flowchart LR'),
        expect.objectContaining({
          allowLLMRepair: false,
        })
      );
      expect(mockUpdateCode).toHaveBeenCalledWith(
        expect.stringContaining('A --> B'),
        expect.objectContaining({
          allowLLMRepair: false,
        })
      );
    });

    rerender(<PreviewPanel mermaidCode="" />);

    await waitFor(() => {
      expect(mockClear).toHaveBeenCalledTimes(1);
    });
  });

  it('流式候选预览时不应触发 LLM 修复', async () => {
    render(
      <PreviewPanel
        mermaidCode="flowchart LR\nA --> B"
        isStreamingCandidate={true}
      />
    );

    await waitFor(() => {
      expect(mockUpdateCode).toHaveBeenCalledWith(
        expect.stringContaining('flowchart LR'),
        expect.objectContaining({
          allowLLMRepair: false,
          suppressErrors: true,
          signal: expect.anything(),
        })
      );
    });
  });

  it('流式候选校验失败时不应展示错误横幅', async () => {
    mockPreviewState.validation = {
      isValid: false,
      errors: ['缺少 Mermaid 类型声明'],
      warnings: [],
    };
    mockPreviewState.isValid = false;
    mockPreviewState.error = 'Mermaid 代码暂时无法预览：缺少 Mermaid 类型声明';

    render(
      <PreviewPanel
        mermaidCode="A --> B"
        isStreamingCandidate={true}
      />
    );

    await waitFor(() => {
      expect(mockUpdateCode).toHaveBeenCalled();
    });

    expect(screen.queryByText('缺少 Mermaid 类型声明')).toBeNull();
    expect(screen.getByTestId('board-preview').textContent).toBe('board-ok');
  });

  it('校验失败时展示真实错误，并允许关闭', async () => {
    mockPreviewState.validation = {
      isValid: false,
      errors: ['缺少 Mermaid 类型声明'],
      warnings: [],
    };
    mockPreviewState.isValid = false;

    render(<PreviewPanel mermaidCode="A --> B" />);

    await waitFor(() => {
      expect(mockUpdateCode).toHaveBeenCalled();
    });
    expect(screen.getAllByText('缺少 Mermaid 类型声明')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));

    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it('预览修复失败时允许只关闭错误提示，不清空代码', async () => {
    mockPreviewState.error = 'Mermaid 代码已尝试自动修复，但仍无法稳定预览：存在未完整的连接语句';

    render(<PreviewPanel mermaidCode="flowchart LR\nA -->" />);

    await waitFor(() => {
      expect(mockUpdateCode).toHaveBeenCalled();
    });
    expect(screen.getAllByText(/已尝试自动修复/)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));

    expect(mockClearError).toHaveBeenCalledTimes(1);
    expect(mockClear).not.toHaveBeenCalled();
  });

  it('最终稳定结果到达时默认不触发 LLM 修复', async () => {
    render(
      <PreviewPanel
        mermaidCode="flowchart LR\nA --> B"
        isStreamingCandidate={false}
      />
    );

    await waitFor(() => {
      expect(mockUpdateCode).toHaveBeenCalledWith(
        expect.stringContaining('flowchart LR'),
        expect.objectContaining({
          allowLLMRepair: false,
          suppressErrors: false,
          signal: expect.anything(),
        })
      );
    });
  });
});
