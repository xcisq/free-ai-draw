import { fireEvent, render, screen } from '@testing-library/react';

import App from './app';

jest.mock('./landing-page', () => ({
  __esModule: true,
  default: ({ onEnterBoard }: { onEnterBoard: () => void }) => (
    <button data-testid="landing-page" onClick={onEnterBoard}>
      landing
    </button>
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
    window.history.pushState({}, '', '/');
    document.documentElement.className = '';
    document.body.className = '';
    window.scrollTo = jest.fn();
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

  it('从导航页进入时会切到画板视图', () => {
    render(<App />);

    fireEvent.click(screen.getByTestId('landing-page'));

    expect(screen.getByTestId('board-shell')).toBeTruthy();
    expect(window.location.hash).toBe('#board');
  });
});
