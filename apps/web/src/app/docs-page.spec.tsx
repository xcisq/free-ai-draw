import { fireEvent, render, screen } from '@testing-library/react';

import DocsPage from './docs-page';

describe('DocsPage', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('展示用户手册、AutoDraw、文字还原和导出内容', () => {
    render(<DocsPage onBackToLanding={jest.fn()} onEnterBoard={jest.fn()} />);

    expect(
      screen.getByRole('heading', { name: 'XAI Board 使用手册' })
    ).toBeTruthy();
    expect(screen.getByText(/AutoDraw 工作台由左侧输入区/)).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: '文字还原：先看源数据，再看导入，再看渲染',
      })
    ).toBeTruthy();
    expect(screen.getAllByText(/导出 SVG、PNG 或 JPG/).length).toBeGreaterThan(
      0
    );
  });

  it('在 AutoDraw 章节展示工作台截图', () => {
    render(<DocsPage onBackToLanding={jest.fn()} onEnterBoard={jest.fn()} />);

    const image = screen.getByAltText('AutoDraw 实验室工作台界面截图');

    expect(image).toBeTruthy();
    expect(image.getAttribute('src')).toBe('/docs/autodraw-workbench.png');
  });

  it('点击目录项会滚动到对应章节', () => {
    render(<DocsPage onBackToLanding={jest.fn()} onEnterBoard={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /从 prompt 到落板/ }));

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
