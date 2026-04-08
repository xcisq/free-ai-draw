import { fireEvent, render, screen } from '@testing-library/react';

import { BoardStyleContextMenu } from './board-style-context-menu';

const mockBoard = {} as any;
const mockGetSelectedElements = jest.fn();
let mockBoardContainer: HTMLDivElement;

jest.mock('@plait-board/react-board', () => ({
  useBoard: () => mockBoard,
}));

jest.mock('@plait/core', () => ({
  ATTACHED_ELEMENT_CLASS_NAME: 'attached',
  getSelectedElements: (...args: unknown[]) => mockGetSelectedElements(...args),
  PlaitBoard: {
    getBoardContainer: () => mockBoardContainer,
  },
}));

jest.mock('../../components/icons', () => ({
  AIMermaidIcon: 'AI',
}));

jest.mock('./board-style-panel', () => ({
  BoardStylePanel: () => <div>Mock Board Style Panel</div>,
}));

describe('BoardStyleContextMenu', () => {
  beforeEach(() => {
    mockBoardContainer = document.createElement('div');
    document.body.appendChild(mockBoardContainer);
    mockGetSelectedElements.mockReset();
    mockGetSelectedElements.mockReturnValue([{ id: 'shape-1' }]);
  });

  afterEach(() => {
    mockBoardContainer.remove();
  });

  it('框选后右键应显示 AI 样式优化入口，并可打开面板', () => {
    render(<BoardStyleContextMenu />);

    fireEvent.contextMenu(mockBoardContainer, {
      clientX: 120,
      clientY: 140,
    });

    expect(screen.getByTestId('board-style-context-menu')).toBeTruthy();
    expect(screen.getByTestId('board-style-context-menu').className).toContain('attached');
    fireEvent.click(screen.getByText('AI 样式优化'));

    expect(screen.getByTestId('board-style-context-panel')).toBeTruthy();
    expect(screen.getByTestId('board-style-context-panel').className).toContain('attached');
    expect(screen.getByText('Mock Board Style Panel')).toBeTruthy();
  });

  it('没有选区时应保留原生右键行为', () => {
    mockGetSelectedElements.mockReturnValue([]);
    render(<BoardStyleContextMenu />);

    fireEvent.contextMenu(mockBoardContainer, {
      clientX: 80,
      clientY: 90,
    });

    expect(screen.queryByTestId('board-style-context-menu')).toBeNull();
  });
});
