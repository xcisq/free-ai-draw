import { fireEvent, render, screen } from '@testing-library/react';
import ImageEditDialog from './image-edit-dialog';

const mockSetAppState = jest.fn();
const mockBoard = {
  children: [],
} as any;

const mockAppState = {
  openDialogType: 'imageEdit',
  imageEditTargetId: 'image-1',
  imageGenerationTasks: {},
} as any;

const translations: Record<string, string> = {
  'dialog.close': '关闭',
  'dialog.imageEdit.title': '编辑当前图片',
  'dialog.imageEdit.description':
    '基于当前选中的图片提交 AI 改图任务，成功后会直接替换画布里的原图。',
  'dialog.imageEdit.prompt': '编辑提示词',
  'dialog.imageEdit.promptPlaceholder':
    '例如：把背景改成浅色科技感风格，并增强主体边缘细节',
  'dialog.imageEdit.sourceImage': '当前图片',
  'dialog.imageEdit.backendUrl': '后端地址',
  'dialog.imageEdit.provider': 'Provider',
  'dialog.imageEdit.apiKey': 'API Key',
  'dialog.imageEdit.baseUrl': 'Base URL',
  'dialog.imageEdit.imageModel': '图片模型',
  'dialog.imageEdit.removeBackground': '替换前自动去背景',
  'dialog.imageEdit.removeBackgroundHint':
    '适合白底或杂色底图。开启后会在生图完成后再做一次抠图处理。',
  'dialog.imageEdit.generate': '开始编辑',
  'dialog.imageEdit.close': '关闭',
  'dialog.imageEdit.targetMissing':
    '没有找到可编辑的图片，请重新选中目标图片后再试。',
  'dialog.imageEdit.status.idle': '待开始',
  'dialog.imageEdit.status.submitting': '提交中',
  'dialog.imageEdit.status.running': '编辑中',
  'dialog.imageEdit.status.succeeded': '已完成',
  'dialog.imageEdit.status.failed': '失败',
  'dialog.imageEdit.error.noPrompt': '请先输入图片编辑提示词',
  'dialog.imageEdit.error.noTarget': '当前没有可编辑的目标图片',
  'dialog.imageEdit.error.exportFailed':
    '当前图片无法读取，请先重新导入图片后再试',
  'dialog.imageEdit.error.submitFailed': '图片编辑任务提交失败',
};

jest.mock('@plait-board/react-board', () => ({
  useBoard: () => mockBoard,
}));

jest.mock('../../hooks/use-drawnix', () => ({
  DialogType: {
    imageEdit: 'imageEdit',
  },
  useDrawnix: () => ({
    appState: mockAppState,
    setAppState: mockSetAppState,
  }),
}));

jest.mock('../../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => translations[key] || key,
  }),
}));

jest.mock('../../utils/image-element', () => ({
  findImageElementById: () => ({
    id: 'image-1',
    url: 'https://example.com/source.png',
  }),
  getSingleSelectedImageElement: () => ({
    id: 'image-1',
    url: 'https://example.com/source.png',
  }),
}));

jest.mock('../utils', () => ({
  normalizeBackendUrl: (value: string) => value,
  readErrorMessage: async () => '图片编辑任务提交失败',
}));

describe('ImageEditDialog', () => {
  beforeEach(() => {
    mockSetAppState.mockReset();
    mockAppState.openDialogType = 'imageEdit';
    mockAppState.imageEditTargetId = 'image-1';
    mockAppState.imageGenerationTasks = {};
  });

  it('renders the workbench shell with the shared paper style structure', () => {
    render(<ImageEditDialog />);

    expect(screen.getByText('IMAGE EDIT · 03')).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 1, name: /当前图片.*编辑工作台/ })
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 3, name: /编辑指令与运行配置/ })
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 3, name: /提交前摘要/ })
    ).toBeTruthy();
  });

  it('shows the prompt error when triggering one-shot submit with ctrl+enter', async () => {
    render(<ImageEditDialog />);

    fireEvent.keyDown(screen.getByPlaceholderText(translations['dialog.imageEdit.promptPlaceholder']), {
      key: 'Enter',
      ctrlKey: true,
    });

    expect(await screen.findByText('请先输入图片编辑提示词')).toBeTruthy();
  });
});
