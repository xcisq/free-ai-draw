import { act, fireEvent, render, screen } from '@testing-library/react';

import App from './app';

jest.mock('./landing-page', () => ({
  __esModule: true,
  default: ({
    onEnterBoard,
    onOpenDocs,
  }: {
    onEnterBoard: () => void;
    onOpenDocs: () => void;
  }) => (
    <div data-testid="landing-page">
      <button data-testid="landing-enter-board" onClick={onEnterBoard}>
        landing
      </button>
      <button data-testid="landing-open-docs" onClick={onOpenDocs}>
        docs
      </button>
    </div>
  ),
}));

jest.mock('./docs-page', () => ({
  __esModule: true,
  default: ({
    onBackToLanding,
    onEnterBoard,
  }: {
    onBackToLanding: () => void;
    onEnterBoard: () => void;
  }) => (
    <div data-testid="docs-page">
      <button data-testid="docs-back-landing" onClick={onBackToLanding}>
        back
      </button>
      <button data-testid="docs-enter-board" onClick={onEnterBoard}>
        board
      </button>
    </div>
  ),
}));

jest.mock('./board-shell', () => ({
  __esModule: true,
  default: ({ onBackToLanding }: { onBackToLanding?: () => void }) => (
    <button data-testid="board-shell" onClick={onBackToLanding}>
      board
    </button>
  ),
}));

describe('App', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.history.pushState({}, '', '/');
    document.documentElement.className = '';
    document.body.className = '';
    window.scrollTo = jest.fn();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('默认显示导航页', () => {
    render(<App />);

    expect(screen.getByTestId('landing-page')).toBeTruthy();
  });

  it('hash 为 board 时显示画板', () => {
    window.location.hash = 'board';

    render(<App />);

    expect(screen.getByTestId('board-shell')).toBeTruthy();
  });

  it('hash 为 docs 时显示文档页', () => {
    window.location.hash = 'docs';

    render(<App />);

    expect(screen.getByTestId('docs-page')).toBeTruthy();
  });

  it('从导航页进入时会切到画板视图', () => {
    render(<App />);

    fireEvent.click(screen.getByTestId('landing-enter-board'));
    act(() => {
      jest.runAllTimers();
    });

    expect(screen.getByTestId('board-shell')).toBeTruthy();
    expect(window.location.hash).toBe('#board');
  });

  it('从导航页可以进入文档页', () => {
    render(<App />);

    fireEvent.click(screen.getByTestId('landing-open-docs'));

    expect(screen.getByTestId('docs-page')).toBeTruthy();
    expect(window.location.hash).toBe('#docs');
  });

  it('从文档页返回时会切回导航页', () => {
    window.location.hash = 'docs';

    render(<App />);

    fireEvent.click(screen.getByTestId('docs-back-landing'));

    expect(screen.getByTestId('landing-page')).toBeTruthy();
    expect(window.location.hash).toBe('');
  });

  it('从文档页进入时会切到画板视图', () => {
    window.location.hash = 'docs';

    render(<App />);

    fireEvent.click(screen.getByTestId('docs-enter-board'));
    act(() => {
      jest.runAllTimers();
    });

    expect(screen.getByTestId('board-shell')).toBeTruthy();
    expect(window.location.hash).toBe('#board');
  });

  it('从画板返回时会切回导航页', () => {
    window.location.hash = 'board';

    render(<App />);

    fireEvent.click(screen.getByTestId('board-shell'));
    act(() => {
      jest.runAllTimers();
    });

    expect(screen.getByTestId('landing-page')).toBeTruthy();
    expect(window.location.hash).toBe('');
  });
});
