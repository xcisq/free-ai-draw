import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Select } from './select';

describe('Select', () => {
  it('受控 open 场景下点击 trigger 也应能展开菜单', () => {
    const ControlledSelect = () => {
      const [open, setOpen] = React.useState(false);

      return (
        <div className="drawnix">
          <Select.Root
            open={open}
            onOpenChange={setOpen}
            value="sans"
            hideSelectedIndicator
          >
            <Select.Trigger aria-label="字体">默认无衬线</Select.Trigger>
            <Select.Content container={document.body}>
              <Select.Item value="sans" textValue="默认无衬线">
                默认无衬线
              </Select.Item>
              <Select.Item value="serif" textValue="Georgia">
                Georgia
              </Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
      );
    };

    render(<ControlledSelect />);

    fireEvent.click(screen.getByRole('combobox', { name: '字体' }));

    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Georgia' })).toBeTruthy();
  });
});
