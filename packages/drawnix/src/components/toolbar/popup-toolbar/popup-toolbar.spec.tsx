import React from 'react';
import { render, screen } from '@testing-library/react';

const mockSetPositionReference = jest.fn();
const mockBoard = {
  viewport: {},
  selection: null,
  children: [],
  pointerMove: jest.fn(),
  pointerUp: jest.fn(),
} as any;
const mockSelectedElements = [
  {
    id: 'shape-1',
    type: 'geometry',
    shape: 'rectangle',
    fill: '#ffffff',
    strokeColor: '#333333',
  },
] as any;
const mockDocumentBody = document.body;

jest.mock('@plait-board/react-board', () => ({
  useBoard: () => mockBoard,
}));

jest.mock('@floating-ui/react', () => ({
  useFloating: () => ({
    refs: {
      setFloating: jest.fn(),
      setPositionReference: mockSetPositionReference,
    },
    floatingStyles: {},
  }),
  offset: () => ({}),
  flip: () => ({}),
}));

jest.mock('@plait/core', () => ({
  ATTACHED_ELEMENT_CLASS_NAME: 'attached',
  getRectangleByElements: () => ({ x: 0, y: 0, width: 100, height: 60 }),
  getSelectedElements: () => mockSelectedElements,
  isDragging: () => false,
  isMovingElements: () => false,
  isSelectionMoving: () => false,
  PlaitBoard: {
    getBoardContainer: () => mockDocumentBody,
    hasBeenTextEditing: () => false,
  },
  RectangleClient: {
    getPoints: () => [[0, 0], [100, 60]],
  },
  toHostPointFromViewBoxPoint: (_board: unknown, point: [number, number]) => point,
  toScreenPointFromHostPoint: (_board: unknown, point: [number, number]) => point,
}));

jest.mock('@plait/draw', () => ({
  getStrokeColorByElement: () => '#333333',
  getStrokeStyleByElement: () => 'solid',
  isClosedCustomGeometry: () => false,
  isClosedDrawElement: () => true,
  isDrawElementsIncludeText: () => false,
  PlaitDrawElement: {
    isImage: () => false,
    isDrawElement: () => true,
    isArrowLine: () => false,
    isVectorLine: () => false,
    isText: (value: any) => value?.shape === 'text',
    isShapeElement: (value: any) => value?.type === 'geometry',
  },
}));

jest.mock('@plait/mind', () => ({
  getStrokeColorByElement: () => '#333333',
  MindElement: {
    isMindElement: () => false,
  },
}));

jest.mock('@plait/text-plugins', () => ({
  getTextMarksByElement: () => ({}),
}));

jest.mock('../../../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../stack', () => {
  const React = require('react');
  const Row = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    __esModule: true,
    default: {
      Row,
    },
  };
});

jest.mock('../../island', () => {
  const React = require('react');
  return {
    Island: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    ),
  };
});

jest.mock('../../popover/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

jest.mock('./font-color-button', () => ({
  PopupFontColorButton: () => <div>font-color</div>,
}));

jest.mock('./font-size-control', () => ({
  PopupFontSizeControl: () => <div>font-size</div>,
}));

jest.mock('./stroke-button', () => ({
  PopupStrokeButton: ({ children }: { children?: React.ReactNode }) => <div>{children || 'stroke'}</div>,
}));

jest.mock('./fill-button', () => ({
  PopupFillButton: ({ children }: { children?: React.ReactNode }) => <div>{children || 'fill'}</div>,
}));

jest.mock('./link-button', () => ({
  PopupLinkButton: () => <div>link</div>,
}));

jest.mock('./arrow-mark-button', () => ({
  ArrowMarkButton: () => <div>arrow</div>,
}));

jest.mock('../../../llm-mermaid/components/board-style-panel', () => ({
  BoardStylePanel: () => <div>board-style-panel</div>,
}));

jest.mock('../../../plugins/freehand/type', () => ({
  Freehand: {
    isFreehand: () => false,
  },
}));

import { PopupToolbar } from './popup-toolbar';

describe('PopupToolbar', () => {
  beforeEach(() => {
    mockSetPositionReference.mockReset();
  });

  it('选中元素后应显示 AI 样式按钮', () => {
    const { container } = render(<PopupToolbar />);

    const aiButton = screen.getByRole('button', { name: 'AI 样式' });
    expect(aiButton).toBeTruthy();
    expect(aiButton.className).toContain('tool-icon_type_button--show');
    expect(container.querySelector('.popup-ai-style-button')).toBe(aiButton);
  });

  it('AI 样式弹层应标记为附着元素，避免点击时清空选区', () => {
    const { container } = render(<PopupToolbar />);

    const content = container.querySelector('.popup-ai-style-content');
    expect(content?.className).toContain('attached');
  });
});
