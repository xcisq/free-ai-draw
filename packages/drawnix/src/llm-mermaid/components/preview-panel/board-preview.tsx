/**
 * Board 预览组件
 * 使用 Plait Board 渲染 Mermaid 转换后的元素
 */

import { useEffect, useRef, useState } from 'react';
import { PlaitBoard, PlaitBoardOptions, ThemeColorMode } from '@plait/core';
import { createEditor } from './editor-factory';
import './board-preview.scss';

export interface BoardPreviewProps {
  elements: unknown[];
  theme?: ThemeColorMode;
  isLoading?: boolean;
  error?: string | null;
  onBoardReady?: (board: PlaitBoard | null) => void;
}

export const BoardPreview = ({
  elements,
  theme = 'light',
  isLoading = false,
  error = null,
  onBoardReady,
}: BoardPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<PlaitBoard | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 初始化 Board
  useEffect(() => {
    if (!containerRef.current || boardRef.current) {
      return;
    }

    const options: PlaitBoardOptions = {
      readonly: true,
      themeColors: {
        primary: '#4A90E2',
        background: '#ffffff',
        text: '#333333',
      },
    };

    try {
      const board = createEditor(containerRef.current, elements, options);
      boardRef.current = board;
      setIsReady(true);
      onBoardReady?.(board);
    } catch (err) {
      console.error('Board initialization failed:', err);
    }

    return () => {
      if (boardRef.current) {
        boardRef.current.destroy();
        boardRef.current = null;
      }
    };
  }, [onBoardReady]);

  // 更新元素
  useEffect(() => {
    if (boardRef.current && elements.length > 0) {
      try {
        // 清空现有元素
        boardRef.current.children = [];

        // 添加新元素
        elements.forEach((element) => {
          boardRef.current?.addElements(element);
        });

        // 自适应视图
        boardRef.current.fitToSelection();
      } catch (err) {
        console.error('Update board elements failed:', err);
      }
    }
  }, [elements]);

  // 更新主题
  useEffect(() => {
    if (boardRef.current) {
      boardRef.current.theme = theme;
    }
  }, [theme]);

  return (
    <div className="board-preview">
      <div className="board-preview-container" ref={containerRef} />

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

      {!isReady && !isLoading && !error && elements.length === 0 && (
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
          <span className="empty-text">
            生成的流程图预览将显示在这里
          </span>
        </div>
      )}
    </div>
  );
};
