import React, { useMemo, useState } from 'react';
import { PlaitBoard } from '@plait/core';
import { setTextFontFamily } from '../../../transforms/property';
import { Select } from '../../select/select';
import {
  getConfiguredFontFamilyOptions,
  resolveFontFamilyOption,
} from '../../../constants/font';

export type PopupFontFamilyControlProps = {
  board: PlaitBoard;
  currentFontFamily?: string;
  title: string;
};

export const PopupFontFamilyControl: React.FC<PopupFontFamilyControlProps> = ({
  board,
  currentFontFamily,
  title,
}) => {
  const [open, setOpen] = useState(false);
  const currentOption = useMemo(
    () => resolveFontFamilyOption(currentFontFamily),
    [currentFontFamily]
  );
  const fontOptions = getConfiguredFontFamilyOptions();
  const currentValue = currentOption.value;
  const currentLabel = currentOption.label;
  const container = PlaitBoard.getBoardContainer(board);

  return (
    <Select.Root
      open={open}
      onOpenChange={setOpen}
      value={currentValue}
      onValueChange={(value) => {
        setTextFontFamily(board, value);
        setOpen(false);
      }}
      placement={'top-start'}
      sideOffset={12}
      hideSelectedIndicator
    >
      <Select.Trigger asChild>
        <button
          type="button"
          className="popup-font-family"
          title={title}
          aria-label={title}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
          }}
        >
          <span
            className="popup-font-family__label"
            style={{ fontFamily: currentValue }}
          >
            {currentLabel}
          </span>
        </button>
      </Select.Trigger>
      <Select.Content
        container={container}
        style={{ minWidth: '11rem' }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
        }}
      >
        {fontOptions.map((option) => (
          <Select.Item
            key={option.value}
            value={option.value}
            textValue={option.label}
            onPointerUp={() => {
              setTextFontFamily(board, option.value);
              setOpen(false);
            }}
          >
            <span style={{ fontFamily: option.value }}>{option.label}</span>
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
};
