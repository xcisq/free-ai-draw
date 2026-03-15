/**
 * Board 预览组件
 * 使用项目现有的 Wrapper + Board 只读渲染 Mermaid 转换结果
 */

import { useMemo, useState } from 'react';
import { withGroup } from '@plait/common';
import { Board, Wrapper } from '@plait-board/react-board';
import { PlaitBoard, PlaitElement, PlaitPlugin, PlaitTheme } from '@plait/core';
import { withDraw } from '@plait/draw';
import { MindThemeColors, withMind } from '@plait/mind';
import { withCommonPlugin } from '../../../plugins/with-common';
import './board-preview.scss';

export interface BoardPreviewProps {
  elements: unknown[];
  theme?: PlaitTheme;
  isLoading?: boolean;
  error?: string | null;
  onBoardReady?: (board: PlaitBoard | null) => void;
}

export const BoardPreview = ({
  elements,
  theme,
  isLoading = false,
  error = null,
  onBoardReady,
}: BoardPreviewProps) => {
  const [isReady, setIsReady] = useState(false);
  const plugins = useMemo<PlaitPlugin[]>(
    () => [withDraw, withMind, withGroup, withCommonPlugin],
    []
  );
  const value = useMemo(() => elements as PlaitElement[], [elements]);

  return (
    <div className="board-preview">
      <div
        className="board-preview-container"
        style={{ opacity: error ? 0.15 : 1 }}
      >
        <Wrapper
          value={value}
          theme={theme}
          options={{
            readonly: true,
            hideScrollbar: false,
            disabledScrollOnNonFocus: true,
            themeColors: MindThemeColors,
          }}
          plugins={plugins}
        >
          <Board
            afterInit={(board) => {
              setIsReady(true);
              onBoardReady?.(board);
            }}
          ></Board>
        </Wrapper>
      </div>

      {isLoading && (
        <div className="board-preview-loading">
          <div className="loading-spinner" />
          <span className="loading-text">正在生成预览...</span>
        </div>
      )}

      {error && (
        <div className="board-preview-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      {isReady && !isLoading && !error && value.length === 0 && (
        <div className="board-preview-empty">
          <svg
            className="empty-icon"
            viewBox="0 0 64 64"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="8"
              y="16"
              width="48"
              height="32"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M16 24h32M16 32h24M16 40h16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span className="empty-text">生成的流程图预览将显示在这里</span>
        </div>
      )}
    </div>
  );
};
