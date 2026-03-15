/**
 * LLM Mermaid 主对话框组件
 * 左右分栏布局：左侧对话区，右侧预览区
 */

import { useEffect, useState, useCallback } from 'react';
import { useBoard } from '@plait-board/react-board';
import {
  getViewportOrigination,
  PlaitBoard,
  PlaitElement,
  PlaitGroupElement,
  Point,
  RectangleClient,
  WritableClipboardOperationType,
} from '@plait/core';
import { DialogType, useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import { ChatPanel } from './chat-panel';
import { PreviewPanel } from './preview-panel';
import type { GenerationContext } from '../types';
import './llm-mermaid-dialog.scss';

export interface LLMMermaidDialogProps {
  container: HTMLElement | null;
}

export const LLMMermaidDialog = ({ container }: LLMMermaidDialogProps) => {
  const board = useBoard();
  const { appState, setAppState } = useDrawnix();
  const { t } = useI18n();
  const [isReady, setIsReady] = useState(false);
  const [mermaidCode, setMermaidCode] = useState('');
  const [generationContext, setGenerationContext] = useState<Partial<GenerationContext>>({
    layoutDirection: 'LR',
    usageScenario: 'paper',
    theme: 'academic',
    nodeCount: 5,
    layoutArea: 'medium',
    density: 'balanced',
  });

  const isOpen = appState.openDialogType === DialogType.llmMermaid;

  const handleClose = () => {
    setAppState({
      ...appState,
      openDialogType: null,
    });
  };

  // 处理 Mermaid 代码生成
  const handleMermaidGenerated = useCallback((code: string) => {
    setMermaidCode(code);
  }, []);

  const handleReset = useCallback(() => {
    setMermaidCode('');
  }, []);

  // 处理插入到画布
  const handleInsert = useCallback(
    (elements: unknown[]) => {
      const typedElements = elements as PlaitElement[];
      if (!board || typedElements.length === 0) {
        return;
      }

      try {
        const boardContainerRect =
          PlaitBoard.getBoardContainer(board).getBoundingClientRect();
        const focusPoint = [
          boardContainerRect.width / 2,
          boardContainerRect.height / 2,
        ];
        const zoom = board.viewport.zoom;
        const origination = getViewportOrigination(board);
        const centerX = origination![0] + focusPoint[0] / zoom;
        const centerY = origination![1] + focusPoint[1] / zoom;

        const elementRectangle = RectangleClient.getBoundingRectangle(
          typedElements
            .filter((ele) => !PlaitGroupElement.isGroup(ele))
            .map((ele) =>
              RectangleClient.getRectangleByPoints(ele.points as Point[])
            )
        );
        const startPoint = [
          centerX - elementRectangle.width / 2,
          centerY - elementRectangle.height / 2,
        ] as Point;

        board.insertFragment(
          {
            elements: JSON.parse(JSON.stringify(typedElements)),
          },
          startPoint,
          WritableClipboardOperationType.paste
        );

        // 插入成功后关闭对话框
        handleClose();
      } catch (err) {
        console.error('Insert elements failed:', err);
      }
    },
    [board, appState, setAppState]
  );

  useEffect(() => {
    // 延迟加载组件以提升性能
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="llm-mermaid-dialog">
      <div className="llm-mermaid-content">
        {/* 左侧对话区 */}
        <div className="llm-mermaid-left">
          <ChatPanel
            onContextChange={setGenerationContext}
            onMermaidGenerated={handleMermaidGenerated}
            onReset={handleReset}
            disabled={!isReady}
          />
        </div>

        {/* 右侧预览区 */}
        <div className="llm-mermaid-right">
          <PreviewPanel
            mermaidCode={mermaidCode}
            onInsert={handleInsert}
            disabled={!isReady}
            generationContext={generationContext}
          />
        </div>
      </div>

      <div className="llm-mermaid-actions">
        <button
          className="llm-mermaid-btn llm-mermaid-btn-secondary"
          onClick={handleClose}
        >
          {t('dialog.close') || '关闭'}
        </button>
      </div>
    </div>
  );
};

export default LLMMermaidDialog;
