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
import { StructuredInputForm } from './chat-panel/structured-input-form';
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
  const [generationContext, setGenerationContext] = useState<Partial<GenerationContext>>(
    DEFAULT_GENERATION_CONTEXT
  );

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
    setGenerationContext(DEFAULT_GENERATION_CONTEXT);
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
    <div className="llm-mermaid-workbench">
      <div className="llm-mermaid-workbench-header">
        <div className="llm-mermaid-workbench-copy">
          <span className="llm-mermaid-workbench-eyebrow">Mermaid AI Workspace</span>
          <h2 className="llm-mermaid-workbench-title">论文图前置生成工作台</h2>
          <p className="llm-mermaid-workbench-description">
            先用自然语言描述原始文本和构图意图，系统会在必要时先澄清，再生成 Mermaid。
          </p>
        </div>
      </div>

      <div className="llm-mermaid-workbench-content">
        <section className="llm-mermaid-pane llm-mermaid-pane-chat">
          <ChatPanel
            generationContext={generationContext}
            onContextResolved={setGenerationContext}
            onMermaidGenerated={handleMermaidGenerated}
            onReset={handleReset}
            disabled={!isReady}
          />
        </section>

        <aside className="llm-mermaid-pane llm-mermaid-pane-intent">
          <StructuredInputForm
            context={generationContext}
            onContextChange={setGenerationContext}
            disabled={!isReady}
          />
        </aside>

        <section className="llm-mermaid-pane llm-mermaid-pane-preview">
          <PreviewPanel
            mermaidCode={mermaidCode}
            onInsert={handleInsert}
            disabled={!isReady}
            generationContext={generationContext}
          />
        </section>
      </div>

      <div className="llm-mermaid-workbench-actions">
        <button
          className="llm-mermaid-workbench-close"
          onClick={handleClose}
        >
          {t('dialog.close') || '关闭'}
        </button>
      </div>
    </div>
  );
};

export default LLMMermaidDialog;

const DEFAULT_GENERATION_CONTEXT: Partial<GenerationContext> = {
  layoutDirection: 'LR',
  usageScenario: 'paper',
  theme: 'academic',
  nodeCount: 5,
  layoutArea: 'medium',
  density: 'balanced',
  structurePattern: 'mixed',
  layoutIntentText: '',
  emphasisTargets: [],
  clarificationStatus: 'none',
};
