import { withGroup } from '@plait/common';
import { Board, Wrapper } from '@plait-board/react-board';
import {
  BoardTransforms,
  PlaitBoard,
  PlaitElement,
  PlaitPlugin,
  PlaitPointerType,
} from '@plait/core';
import { ArrowLineShape, DrawTransforms, getArrowLines, withDraw } from '@plait/draw';
import { useEffect, useRef, useState } from 'react';
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
  const boardRef = useRef<PlaitBoard | null>(null);
  const lastEmittedValueRef = useRef<PlaitElement[] | null>(null);
  const shouldStabilizeRouteRef = useRef(true);
  const stabilizeTimerRef = useRef<number | null>(null);

  const stabilizeArrowRoutes = () => {
    const board = boardRef.current;
    if (!board || !shouldStabilizeRouteRef.current) {
      return;
    }

    shouldStabilizeRouteRef.current = false;
    const elbowLines = getArrowLines(board).filter(
      (line) => line.shape === ArrowLineShape.elbow
    );

    elbowLines.forEach((line) => {
      const path = PlaitBoard.findPath(board, line);
      DrawTransforms.resizeArrowLine(
        board,
        {
          points: [...line.points],
          source: line.source,
          target: line.target,
        },
        path
      );
    });
  };

  const scheduleRouteStabilization = () => {
    if (stabilizeTimerRef.current !== null) {
      window.clearTimeout(stabilizeTimerRef.current);
    }
    stabilizeTimerRef.current = window.setTimeout(() => {
      stabilizeTimerRef.current = null;
      stabilizeArrowRoutes();
    }, 0);
  };

  useEffect(() => {
    if (value === lastEmittedValueRef.current) {
      return;
    }

    shouldStabilizeRouteRef.current = true;
    setBoardValue(value);
    scheduleRouteStabilization();
  }, [value]);

  useEffect(() => {
    return () => {
      if (stabilizeTimerRef.current !== null) {
        window.clearTimeout(stabilizeTimerRef.current);
      }
    };
  }, []);

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
          lastEmittedValueRef.current = nextValue;
          setBoardValue(nextValue);
          onChange(nextValue);
        }}
      >
        <Board
          afterInit={(board: PlaitBoard) => {
            boardRef.current = board;
            BoardTransforms.updatePointerType(
              board,
              PlaitPointerType.selection
            );
            scheduleRouteStabilization();
          }}
        ></Board>
      </Wrapper>
    </div>
  );
};
