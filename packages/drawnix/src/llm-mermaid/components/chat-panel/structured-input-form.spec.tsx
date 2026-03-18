import { fireEvent, render, screen } from '@testing-library/react';
import { StructuredInputForm } from './structured-input-form';

describe('StructuredInputForm', () => {
  it('应该支持更新结构偏好与补充构图文本', () => {
    const handleContextChange = jest.fn();

    render(
      <StructuredInputForm
        context={{
          layoutDirection: 'LR',
          structurePattern: 'mixed',
          layoutIntentText: '',
          emphasisTargets: [],
        }}
        onContextChange={handleContextChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /并行后汇聚/ }));
    expect(handleContextChange).toHaveBeenCalledWith(
      expect.objectContaining({
        structurePattern: 'convergent',
      })
    );

    fireEvent.change(screen.getByLabelText('补充构图要求'), {
      target: { value: '整体从左到右，但中间两路并行，最后汇聚到评估阶段。' },
    });

    expect(handleContextChange).toHaveBeenCalledWith(
      expect.objectContaining({
        layoutIntentText: '整体从左到右，但中间两路并行，最后汇聚到评估阶段。',
      })
    );
  });
});
