import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MoreOptionsButton } from './more-options-button';

const mockMoveSelectionOneStepPreservingBackground = jest.fn();
const mockMoveSelectionToEdgePreservingBackground = jest.fn();
const mockDuplicateElements = jest.fn();
const mockDeleteFragment = jest.fn();
const mockCanSetZIndex = jest.fn(() => true);
const mockGetSelectedElements = jest.fn(() => [{ id: 'shape-1' }]);
const mockBoard = {
  options: { readonly: false },
} as any;

jest.mock('@plait/core', () => ({
  canSetZIndex: (...args: unknown[]) => mockCanSetZIndex(...args),
  deleteFragment: (...args: unknown[]) => mockDeleteFragment(...args),
  duplicateElements: (...args: unknown[]) => mockDuplicateElements(...args),
  getSelectedElements: (...args: unknown[]) => mockGetSelectedElements(...args),
  PlaitBoard: {
    getBoardContainer: () => globalThis.document.body,
    isReadonly: (board: any) => Boolean(board?.options?.readonly),
  },
}));

jest.mock('../../../utils/background-layer', () => ({
  isBackgroundLayerElement: (element: { id?: string }) =>
    element?.id === 'svg-base-layer',
  moveSelectionOneStepPreservingBackground: (...args: unknown[]) =>
    mockMoveSelectionOneStepPreservingBackground(...args),
  moveSelectionToEdgePreservingBackground: (...args: unknown[]) =>
    mockMoveSelectionToEdgePreservingBackground(...args),
}));

jest.mock('../../../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../popover/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('MoreOptionsButton', () => {
  beforeEach(() => {
    mockMoveSelectionOneStepPreservingBackground.mockReset();
    mockMoveSelectionToEdgePreservingBackground.mockReset();
    mockDuplicateElements.mockReset();
    mockDeleteFragment.mockReset();
    mockCanSetZIndex.mockReset();
    mockGetSelectedElements.mockReset();
    mockCanSetZIndex.mockReturnValue(true);
    mockGetSelectedElements.mockReturnValue([{ id: 'shape-1' }]);
    mockBoard.options.readonly = false;
  });

  it('应展示层级操作并触发对应的层级调整动作', () => {
    render(<MoreOptionsButton board={mockBoard} />);

    expect(screen.getByRole('button', { name: 'general.layerOrder' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'general.bringForward' }));
    fireEvent.click(screen.getByRole('button', { name: 'general.sendBackward' }));
    fireEvent.click(screen.getByRole('button', { name: 'general.bringToFront' }));
    fireEvent.click(screen.getByRole('button', { name: 'general.sendToBack' }));

    expect(mockMoveSelectionOneStepPreservingBackground).toHaveBeenNthCalledWith(
      1,
      mockBoard,
      'up'
    );
    expect(mockMoveSelectionOneStepPreservingBackground).toHaveBeenNthCalledWith(
      2,
      mockBoard,
      'down'
    );
    expect(mockMoveSelectionToEdgePreservingBackground).toHaveBeenNthCalledWith(
      1,
      mockBoard,
      'up'
    );
    expect(mockMoveSelectionToEdgePreservingBackground).toHaveBeenNthCalledWith(
      2,
      mockBoard,
      'down'
    );
  });

  it('不支持层级调整时应禁用层级菜单入口', () => {
    mockCanSetZIndex.mockReturnValue(false);

    render(<MoreOptionsButton board={mockBoard} />);

    expect(
      screen.getByRole('button', { name: 'general.layerOrder' }).hasAttribute('disabled')
    ).toBe(true);
  });

  it('选中背景层时应禁用层级菜单入口', () => {
    mockGetSelectedElements.mockReturnValue([{ id: 'svg-base-layer' }]);

    render(<MoreOptionsButton board={mockBoard} />);

    expect(
      screen.getByRole('button', { name: 'general.layerOrder' }).hasAttribute('disabled')
    ).toBe(true);
  });
});
