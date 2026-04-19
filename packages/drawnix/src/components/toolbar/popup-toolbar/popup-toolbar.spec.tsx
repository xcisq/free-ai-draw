import React from 'react';
import { render, screen } from '@testing-library/react';
import { PopupToolbar } from './popup-toolbar';

const mockSetPositionReference = jest.fn();
const mockBoard = {
  viewport: {},
  selection: null,
  children: [],
  pointerMove: jest.fn(),
  pointerUp: jest.fn(),
} as any;
const mockSelectedElements: any[] = [
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
    isReadonly: () => false,
  },
  RectangleClient: {
    getPoints: () => [
      [0, 0],
      [100, 60],
    ],
  },
  toHostPointFromViewBoxPoint: (_board: unknown, point: [number, number]) =>
    point,
  toScreenPointFromHostPoint: (_board: unknown, point: [number, number]) =>
    point,
}));

jest.mock('@plait/draw', () => ({
  ArrowLineComponent: class {},
  getStrokeColorByElement: () => '#333333',
  getStrokeStyleByElement: () => 'solid',
  isClosedCustomGeometry: () => false,
  isClosedDrawElement: () => true,
  isDrawElementsIncludeText: () => false,
  PlaitDrawElement: {
    isImage: () => false,
    isDrawElement: () => true,
    isArrowLine: (value: any) => value?.type === 'arrow-line',
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
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const Row = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    __esModule: true,
    default: {
      Row,
    },
  };
});

jest.mock('../../island', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    Island: ReactModule.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement>
    >(({ children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
  };
});

jest.mock('../../popover/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
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

jest.mock('./font-family-control', () => ({
  PopupFontFamilyControl: () => <div>font-family</div>,
}));

jest.mock('./font-size-control', () => ({
  PopupFontSizeControl: () => <div>font-size</div>,
}));

jest.mock('./stroke-button', () => ({
  PopupStrokeButton: ({ children }: { children?: React.ReactNode }) => (
    <div>{children || 'stroke'}</div>
  ),
}));

jest.mock('./fill-button', () => ({
  PopupFillButton: ({ children }: { children?: React.ReactNode }) => (
    <div>{children || 'fill'}</div>
  ),
}));

jest.mock('./link-button', () => ({
  PopupLinkButton: () => <div>link</div>,
}));

jest.mock('./arrange-button', () => ({
  ArrangeButton: () => <div>arrange</div>,
}));

jest.mock('./arrow-mark-button', () => ({
  ArrowMarkButton: () => <div>arrow</div>,
}));

jest.mock('./arrow-animation-button', () => ({
  ArrowAnimationButton: () => <div>arrow-animation</div>,
}));

jest.mock('./more-options-button', () => ({
  MoreOptionsButton: () => (
    <button type="button" aria-label="general.moreOptions">
      more-options
    </button>
  ),
}));

jest.mock('../../../plugins/freehand/type', () => ({
  Freehand: {
    isFreehand: () => false,
  },
}));

describe('PopupToolbar', () => {
  beforeEach(() => {
    mockSetPositionReference.mockReset();
    mockSelectedElements.splice(
      0,
      mockSelectedElements.length,
      {
        id: 'shape-1',
        type: 'geometry',
        shape: 'rectangle',
        fill: '#ffffff',
        strokeColor: '#333333',
      }
    );
  });

  it('更多操作按钮应只渲染一次，重复渲染后也不应增殖', () => {
    const { rerender } = render(<PopupToolbar />);

    expect(
      screen.getAllByRole('button', { name: 'general.moreOptions' })
    ).toHaveLength(1);

    rerender(<PopupToolbar />);

    expect(
      screen.getAllByRole('button', { name: 'general.moreOptions' })
    ).toHaveLength(1);
  });

  it('选中箭头时应显示动画按钮', () => {
    mockSelectedElements.splice(
      0,
      mockSelectedElements.length,
      {
        id: 'arrow-1',
        type: 'arrow-line',
        source: { marker: 'none' },
        target: { marker: 'arrow' },
        strokeColor: '#333333',
      }
    );

    render(<PopupToolbar />);

    expect(screen.getByText('arrow-animation')).toBeTruthy();
  });
});
