/**
 * Preview Panel 主组件
 * 集成 Mermaid 代码视图和 Board 预览
 */

import { useState, useCallback, useEffect } from 'react';
import { BoardPreview } from './board-preview';
import { MermaidCodeView } from './mermaid-code-view';
import { useMermaidPreview } from '../../hooks/use-mermaid-preview';
import './index.scss';

export interface PreviewPanelProps {
  mermaidCode?: string;
  onInsert?: (elements: unknown[]) => void;
  disabled?: boolean;
}

export const PreviewPanel = ({
  mermaidCode: externalMermaidCode = '',
  onInsert,
  disabled = false,
}: PreviewPanelProps) => {
  const [viewMode, setViewMode] = useState<'board' | 'code' | 'split'>('split');
  const [localCode, setLocalCode] = useState(externalMermaidCode);

  const {
    elements,
    isConverting,
    isValid,
    updateCode,
    clear,
  } = useMermaidPreview();

  // 使用 isLoading 别名以保持一致性
  const isLoading = isConverting;
  const error = isValid ? null : { message: 'Mermaid 代码无效' };

  // 同步外部代码变化
  useEffect(() => {
    if (externalMermaidCode && externalMermaidCode !== localCode) {
      setLocalCode(externalMermaidCode);
      updateCode(externalMermaidCode);
    }
  }, [externalMermaidCode, localCode, updateCode]);

  // 处理 Mermaid 代码变化
  const handleCodeChange = useCallback(
    async (code: string) => {
      setLocalCode(code);
      await updateCode(code);
    },
    [updateCode]
  );

  // 处理插入到画布
  const handleInsert = useCallback(() => {
    if (elements.length > 0) {
      onInsert?.(elements);
    }
  }, [elements, onInsert]);

  // 切换视图模式
  const handleToggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      if (prev === 'board') return 'split';
      if (prev === 'split') return 'code';
      return 'board';
    });
  }, []);

  const hasContent = localCode.length > 0 || elements.length > 0;

  return (
    <div className="preview-panel">
      <div className="preview-panel-header">
        <h3 className="preview-panel-title">预览</h3>
        <div className="preview-panel-actions">
          <button
            className="preview-panel-action"
            onClick={handleToggleViewMode}
            disabled={disabled || !hasContent}
            title={
              viewMode === 'board'
                ? '切换到分屏视图'
                : viewMode === 'split'
                ? '切换到代码视图'
                : '切换到预览视图'
            }
          >
            {viewMode === 'board' ? (
              <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M2 4h12M2 8h12M2 12h12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              </svg>
            ) : viewMode === 'split' ? (
              <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M3 3h5v10H3z M8 3h5v10H8z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <rect
                  x="3"
                  y="3"
                  width="10"
                  height="10"
                  rx="1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                />
                <path d="M6 7h4M6 9h2" fill="none" stroke="currentColor" strokeWidth={1.5} />
              </svg>
            )}
          </button>
          {hasContent && (
            <button
              className="preview-panel-action preview-panel-insert"
              onClick={handleInsert}
              disabled={disabled || isLoading || elements.length === 0}
              title="插入到画布"
            >
              <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M8 2v12M5 11l3 3 3-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>插入</span>
            </button>
          )}
        </div>
      </div>

      <div className={`preview-panel-content view-mode-${viewMode}`}>
        <div className="preview-section preview-board">
          <BoardPreview
            elements={elements}
            isLoading={isLoading}
            error={error?.message || null}
          />
        </div>

        {(viewMode === 'code' || viewMode === 'split') && (
          <div className="preview-section preview-code">
            <MermaidCodeView
              code={localCode}
              onChange={handleCodeChange}
              readOnly={false}
              disabled={disabled || isLoading}
            />
          </div>
        )}
      </div>

      {error && !isValid && localCode.length > 0 && (
        <div className="preview-panel-error-banner">
          <span className="error-message">{error.message}</span>
          <button
            className="error-dismiss"
            onClick={() => clear()}
            disabled={disabled}
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
};
