/**
 * LLM Mermaid 主对话框组件
 * 左右分栏布局：左侧对话区，右侧预览区
 */

import { useEffect, useState, useCallback } from 'react';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import { ChatPanel } from './chat-panel';
import { PreviewPanel } from './preview-panel';
import type { GenerationContext } from '../../types';
import './llm-mermaid-dialog.scss';

export interface LLMMermaidDialogProps {
  container: HTMLElement | null;
}

export const LLMMermaidDialog = ({ container }: LLMMermaidDialogProps) => {
  const { appState, setAppState, board } = useDrawnix();
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

  const isOpen = appState.openDialogType === 'llmMermaid';

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

  // 处理插入到画布
  const handleInsert = useCallback(
    (elements: unknown[]) => {
      if (!board || elements.length === 0) {
        return;
      }

      try {
        // 将元素添加到画布中心
        const viewport = board.viewport;
        const centerX = viewport.width / 2 - viewport.x;
        const centerY = viewport.height / 2 - viewport.y;

        // 计算元素组的边界框
        // 简化处理：直接添加到画布中心
        board.addElements(elements);

        // 更新视图以显示新添加的元素
        board.fitToSelection();
      } catch (err) {
        console.error('Insert elements failed:', err);
      }
    },
    [board]
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
            disabled={!isReady}
          />
        </div>

        {/* 右侧预览区 */}
        <div className="llm-mermaid-right">
          <PreviewPanel
            mermaidCode={mermaidCode}
            onInsert={handleInsert}
            disabled={!isReady}
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
