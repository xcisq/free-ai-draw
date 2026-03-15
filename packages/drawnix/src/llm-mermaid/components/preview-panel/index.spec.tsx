import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PreviewPanel } from './index';

const mockUpdateCode = jest.fn();
const mockClear = jest.fn();
const mockPreviewState = {
  elements: [] as unknown[],
  isConverting: false,
  validation: null as null | { isValid: boolean; errors: string[]; warnings: string[] },
  isValid: false,
};

jest.mock('../../hooks/use-mermaid-preview', () => ({
  useMermaidPreview: () => ({
    ...mockPreviewState,
    updateCode: mockUpdateCode,
    clear: mockClear,
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
    mockClear.mockReset();
    mockPreviewState.elements = [];
    mockPreviewState.isConverting = false;
    mockPreviewState.validation = null;
    mockPreviewState.isValid = false;
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
        expect.stringContaining('flowchart LR')
      );
      expect(mockUpdateCode).toHaveBeenCalledWith(
        expect.stringContaining('A --> B')
      );
    });

    rerender(<PreviewPanel mermaidCode="" />);

    await waitFor(() => {
      expect(mockClear).toHaveBeenCalledTimes(1);
    });
  });

  it('校验失败时展示真实错误，并允许关闭', () => {
    mockPreviewState.validation = {
      isValid: false,
      errors: ['缺少 Mermaid 类型声明'],
      warnings: [],
    };
    mockPreviewState.isValid = false;

    render(<PreviewPanel mermaidCode="A --> B" />);

    expect(screen.getAllByText('缺少 Mermaid 类型声明')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));

    expect(mockClear).toHaveBeenCalledTimes(1);
  });
});
