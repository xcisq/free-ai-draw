import { fireEvent, render, screen } from '@testing-library/react';

import LandingPage from './landing-page';

describe('LandingPage', () => {
  it('在 gallery 区块展示来自 autodraw jobs 的真实样例图', () => {
    render(
      <LandingPage onEnterBoard={jest.fn()} onOpenDocs={jest.fn()} />
    );

    expect(screen.getByRole('heading', { name: /课题组最近画的.*一些图/i })).toBeTruthy();
    expect(screen.getByText('来自 autodraw jobs · 4 张 final.svg')).toBeTruthy();

    expect(screen.getByAltText('AI Model-Assisted Labeling')).toBeTruthy();
    expect(screen.getByAltText('Video + Live Cards Logic')).toBeTruthy();
    expect(screen.getByAltText('交互可视化重构框架')).toBeTruthy();
    expect(screen.getByAltText('交互形式化与解耦流程')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: '放大预览：AI Model-Assisted Labeling' })
    );

    expect(
      screen.getByRole('dialog', { name: 'AI Model-Assisted Labeling' })
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '关闭预览' })).toBeTruthy();
  });
});
