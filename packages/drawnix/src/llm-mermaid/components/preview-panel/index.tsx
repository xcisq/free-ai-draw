/**
 * Preview Panel 主组件
 * 集成 Mermaid 代码视图和 Board 预览
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { BoardPreview } from './board-preview';
import { MermaidCodeView } from './mermaid-code-view';
import { useMermaidPreview } from '../../hooks/use-mermaid-preview';
import type { GenerationContext } from '../../types';
import './index.scss';

export interface PreviewPanelProps {
  mermaidCode?: string;
  isStreamingCandidate?: boolean;
  onInsert?: (elements: unknown[]) => void;
  disabled?: boolean;
  generationContext?: Partial<GenerationContext>;
}

export const PreviewPanel = ({
  mermaidCode: externalMermaidCode = '',
  isStreamingCandidate = false,
  onInsert,
  disabled = false,
  generationContext,
}: PreviewPanelProps) => {
  const [viewMode, setViewMode] = useState<'board' | 'code' | 'split'>('board');
  const [localCode, setLocalCode] = useState(externalMermaidCode);
  const syncAbortControllerRef = useRef<AbortController | null>(null);

  const {
    elements,
    isConverting,
    validation,
    isValid,
    error: previewError,
    updateCode,
    clear,
    clearError,
  } = useMermaidPreview();

  // 处理 Mermaid 代码变化
  const handleCodeChange = useCallback(
    async (code: string) => {
      setLocalCode(code);
      await updateCode(code, {
        allowLLMRepair: false,
      });
    },
    [updateCode]
  );

  const handleGeneratedCodeChange = useCallback(
    async (
      code: string,
      options: {
        allowLLMRepair?: boolean;
        signal?: AbortSignal;
        suppressErrors?: boolean;
      } = {}
    ) => {
      const nextCode = await updateCode(code, {
        allowLLMRepair: options.allowLLMRepair ?? false,
        signal: options.signal,
        suppressErrors: options.suppressErrors,
        preserveElementsOnFailure: options.suppressErrors,
      });
      if (!options.signal?.aborted) {
        setLocalCode(nextCode);
      }
    },
    [updateCode]
  );

  // 使用 isLoading 别名以保持一致性
  const isLoading = isConverting;
  const shouldMutePreviewIssues = isStreamingCandidate;
  const validationError =
    !shouldMutePreviewIssues && localCode.trim().length > 0 && validation && !isValid
      ? { message: validation.errors[0] || 'Mermaid 代码无效' }
      : null;
  const previewIssue = shouldMutePreviewIssues ? null : previewError || validationError?.message;
  const errorMessage = previewIssue;

  // 同步外部代码变化
  useEffect(() => {
    syncAbortControllerRef.current?.abort();

    if (!externalMermaidCode.trim()) {
      setLocalCode('');
      clear();
      return;
    }

    const controller = new AbortController();
    syncAbortControllerRef.current = controller;
    void handleGeneratedCodeChange(externalMermaidCode, {
      allowLLMRepair: false,
      suppressErrors: isStreamingCandidate,
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [clear, externalMermaidCode, handleGeneratedCodeChange, isStreamingCandidate]);

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

  const hasContent = localCode.trim().length > 0 || elements.length > 0;

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
            error={previewIssue || null}
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

      {errorMessage && (
        <div className="preview-panel-error-banner">
          <span className="error-message">{errorMessage}</span>
          <button
            className="error-dismiss"
            onClick={() => {
              if (previewError) {
                clearError();
                return;
              }

              if (validationError) {
                setLocalCode('');
                clear();
                return;
              }
            }}
            disabled={disabled}
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
};
