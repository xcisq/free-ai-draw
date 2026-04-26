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
    expect(
      screen.getByRole('heading', { name: '保存、导出与导入' })
    ).toBeTruthy();
    expect(screen.getAllByText(/导出 SVG、PNG 或 JPG/).length).toBeGreaterThan(
      0
    );
    expect(
      screen.getAllByText(/保存 \.drawnix|保存 .drawnix/).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/bundle\.zip|final\.svg/).length).toBeGreaterThan(
      0
    );
  });

  it('在保存与导入章节说明 .drawnix 和 AutoDraw 产物的区别', () => {
    render(<DocsPage onBackToLanding={jest.fn()} onEnterBoard={jest.fn()} />);

    expect(screen.getByText(/Drawnix 自己的可编辑工程文件/)).toBeTruthy();
    expect(
      screen.getByText(/保留当前 Drawnix 里的修改、视口和排版状态/)
    ).toBeTruthy();
    expect(
      screen.getByText(/重新消费 AutoDraw 后端产物，优先保留/)
    ).toBeTruthy();
    expect(
      screen.getByText(/scene-import 和 svg-import fallback 两条链路都还能复现/)
    ).toBeTruthy();
  });

  it('点击目录项会滚动到对应章节', () => {
    render(<DocsPage onBackToLanding={jest.fn()} onEnterBoard={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /从 prompt 到落板/ }));

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('目录中展示保存、导出与导入章节', () => {
    render(<DocsPage onBackToLanding={jest.fn()} onEnterBoard={jest.fn()} />);

    expect(
      screen.getByRole('button', { name: /保存、导出与导入.*\.drawnix、bundle\.zip、图片/i })
    );
  });

  it('在 AutoDraw 章节展示工作台截图', () => {
    render(<DocsPage onBackToLanding={jest.fn()} onEnterBoard={jest.fn()} />);

    const image = screen.getByAltText('AutoDraw 实验室工作台界面截图');

    expect(image).toBeTruthy();
    expect(image.getAttribute('src')).toBe('/docs/autodraw-workbench.png');
  });

});
