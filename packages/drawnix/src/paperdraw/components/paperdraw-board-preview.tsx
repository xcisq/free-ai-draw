import { withGroup } from '@plait/common';
import { Board, Wrapper } from '@plait-board/react-board';
import {
  BoardTransforms,
  PlaitBoard,
  PlaitElement,
  PlaitPlugin,
  PlaitPointerType,
} from '@plait/core';
import { withDraw } from '@plait/draw';
import { useEffect, useState } from 'react';
import { withCommonPlugin } from '../../plugins/with-common';

interface PaperDrawBoardPreviewProps {
  value: PlaitElement[];
  onChange: (value: PlaitElement[]) => void;
}

export const PaperDrawBoardPreview = ({
  value,
  onChange,
}: PaperDrawBoardPreviewProps) => {
  const [boardValue, setBoardValue] = useState<PlaitElement[]>(value);

  useEffect(() => {
    setBoardValue(value);
  }, [value]);

  const plugins: PlaitPlugin[] = [withDraw, withGroup, withCommonPlugin];

  return (
    <div className="paperdraw-board-preview">
      <Wrapper
        value={boardValue}
        options={{
          readonly: false,
          hideScrollbar: false,
          disabledScrollOnNonFocus: false,
        }}
        plugins={plugins}
        onValueChange={(nextValue) => {
          setBoardValue(nextValue);
          onChange(nextValue);
        }}
      >
        <Board
          afterInit={(board: PlaitBoard) => {
            BoardTransforms.updatePointerType(
              board,
              PlaitPointerType.selection
            );
          }}
        ></Board>
      </Wrapper>
    </div>
  );
};
