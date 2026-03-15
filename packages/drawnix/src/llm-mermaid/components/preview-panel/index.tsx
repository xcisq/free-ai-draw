/**
 * Preview Panel 主组件
 * 集成 Mermaid 代码视图和 Board 预览
 */

import { useState, useCallback, useEffect } from 'react';
import { BoardPreview } from './board-preview';
import { MermaidCodeView } from './mermaid-code-view';
import { useMermaidPreview } from '../../hooks/use-mermaid-preview';
import { useStyleOptimization } from '../../hooks/use-style-optimization';
import type { GenerationContext } from '../../types';
import './index.scss';

export interface PreviewPanelProps {
  mermaidCode?: string;
  onInsert?: (elements: unknown[]) => void;
  disabled?: boolean;
  generationContext?: Partial<GenerationContext>;
}

export const PreviewPanel = ({
  mermaidCode: externalMermaidCode = '',
  onInsert,
  disabled = false,
  generationContext,
}: PreviewPanelProps) => {
  const [viewMode, setViewMode] = useState<'board' | 'code' | 'split'>('split');
  const [localCode, setLocalCode] = useState(externalMermaidCode);
  const [isStylePanelOpen, setIsStylePanelOpen] = useState(false);
  const [styleRequest, setStyleRequest] = useState('');

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
    async (code: string) => {
      const nextCode = await updateCode(code, {
        allowLLMRepair: true,
      });
      setLocalCode(nextCode);
    },
    [updateCode]
  );

  const {
    isOptimizing,
    styleError,
    lastStyleRequest,
    recommendedStyles,
    applyPreset,
    optimizeByPrompt,
    resetStyleState,
  } = useStyleOptimization({
    mermaidCode: localCode,
    generationContext,
    onMermaidCodeChange: handleGeneratedCodeChange,
  });

  // 使用 isLoading 别名以保持一致性
  const isLoading = isConverting;
  const validationError =
    localCode.trim().length > 0 && validation && !isValid
      ? { message: validation.errors[0] || 'Mermaid 代码无效' }
      : null;
  const errorMessage = styleError || previewError || validationError?.message;

  // 同步外部代码变化
  useEffect(() => {
    if (!externalMermaidCode.trim()) {
      setLocalCode('');
      setStyleRequest('');
      setIsStylePanelOpen(false);
      clear();
      return;
    }

    setIsStylePanelOpen(true);
    void handleGeneratedCodeChange(externalMermaidCode);
  }, [clear, externalMermaidCode, handleGeneratedCodeChange]);

  // 处理插入到画布
  const handleInsert = useCallback(() => {
    if (elements.length > 0) {
      onInsert?.(elements);
    }
  }, [elements, onInsert]);

  const handleApplyStyleRequest = useCallback(async () => {
    const trimmedRequest = styleRequest.trim();
    if (!trimmedRequest) {
      return;
    }

    await optimizeByPrompt(trimmedRequest);
    setStyleRequest('');
  }, [optimizeByPrompt, styleRequest]);

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
          {hasContent && (
            <button
              className={`preview-panel-action ${isStylePanelOpen ? 'is-active' : ''}`}
              onClick={() => setIsStylePanelOpen((prev) => !prev)}
              disabled={disabled || isLoading}
              title="切换样式优化"
            >
              <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M4 11.5 2.5 14 5 12.5 12.5 5a1.5 1.5 0 1 0-2.1-2.1L4 11.5Zm7.2-7.2 1.5 1.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>样式优化</span>
            </button>
          )}
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

      {isStylePanelOpen && hasContent && (
        <div className="preview-panel-style-panel">
          <div className="preview-panel-style-presets">
            {(
              [
                ['academic', '学术'],
                ['professional', '专业'],
                ['lively', '活泼'],
                ['minimal', '极简'],
              ] as const
            ).map(([theme, label]) => (
              <button
                key={theme}
                className="preview-panel-style-chip"
                onClick={() => void applyPreset(theme)}
                disabled={disabled || isLoading || isOptimizing}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="preview-panel-style-request">
            <input
              className="preview-panel-style-input"
              value={styleRequest}
              onChange={(event) => setStyleRequest(event.target.value)}
              placeholder="描述你想要的配色、边框或模块强调方式"
              disabled={disabled || isLoading || isOptimizing}
            />
            <button
              className="preview-panel-style-submit"
              onClick={() => void handleApplyStyleRequest()}
              disabled={disabled || isLoading || isOptimizing || !styleRequest.trim()}
            >
              应用样式
            </button>
          </div>

          <div className="preview-panel-style-status">
            {isOptimizing
              ? '正在优化样式...'
              : recommendedStyles.length > 0
              ? `已检测到 ${recommendedStyles.length} 个样式类`
              : lastStyleRequest || '可继续用自然语言描述你想要的风格'}
          </div>
        </div>
      )}

      <div className={`preview-panel-content view-mode-${viewMode}`}>
        <div className="preview-section preview-board">
          <BoardPreview
            elements={elements}
            isLoading={isLoading}
            error={styleError || previewError || validationError?.message || null}
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
              if (styleError) {
                resetStyleState();
                return;
              }

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
