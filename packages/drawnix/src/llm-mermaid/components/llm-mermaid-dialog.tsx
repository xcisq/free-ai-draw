import { useCallback, type ReactNode } from 'react';
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
import type { GenerationContext, PromptAssistSuggestion, StructurePattern } from '../types';
import { useOneShotMermaidComposer } from '../hooks/use-one-shot-mermaid';
import { BoardPreview } from './preview-panel/board-preview';
import { MermaidCodeView } from './preview-panel/mermaid-code-view';
import './llm-mermaid-dialog.scss';

export interface LLMMermaidDialogProps {
  container: HTMLElement | null;
}

const STRUCTURE_OPTIONS: Array<{ value: StructurePattern; label: string }> = [
  { value: 'linear', label: '线性主干' },
  { value: 'branched', label: '主干分支' },
  { value: 'convergent', label: '并行汇聚' },
  { value: 'multi-lane', label: '上下辅轨' },
  { value: 'feedback', label: '反馈回路' },
  { value: 'mixed', label: '混合结构' },
];

const DENSITY_OPTIONS: Array<{
  value: NonNullable<GenerationContext['density']>;
  label: string;
}> = [
  { value: 'dense', label: '紧凑' },
  { value: 'balanced', label: '平衡' },
  { value: 'sparse', label: '疏朗' },
];

const PHASE_LABELS = {
  idle: '待生成',
  generating: '模型生成中',
  stabilizing: '本地稳定化',
  ready: '预览已就绪',
  error: '保留草稿',
} as const;

export const LLMMermaidDialog = ({ container: _container }: LLMMermaidDialogProps) => {
  const board = useBoard();
  const { appState, setAppState } = useDrawnix();
  const { t } = useI18n();
  const {
    state,
    submittedDraft,
    submittedRenderPreset,
    elements,
    isPreviewLoading,
    validation,
    error,
    previewError,
    setSourceText,
    updateContext,
    applySuggestion,
    generate,
    regenerate,
    updateMermaidCode,
    toggleCodeEditor,
    clearError,
    reset,
  } = useOneShotMermaidComposer();

  const isOpen = appState.openDialogType === DialogType.llmMermaid;

  const handleClose = useCallback(() => {
    setAppState({
      ...appState,
      openDialogType: null,
    });
  }, [appState, setAppState]);

  const handleInsert = useCallback(() => {
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
          .map((ele) => RectangleClient.getRectangleByPoints(ele.points as Point[]))
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

      handleClose();
    } catch (insertError) {
      console.error('Insert elements failed:', insertError);
    }
  }, [board, elements, handleClose]);

  if (!isOpen) {
    return null;
  }

  const emphasisValue = (state.context.emphasisTargets || []).join('，');
  const combinedPreviewIssue = previewError || (!validation?.isValid ? validation?.errors?.[0] : null);
  const showCodeView = state.isCodeEditorOpen || Boolean(error && state.mermaidCode.trim());

  return (
    <div className="llm-mermaid-editor">
      <div className="llm-mermaid-editor-header">
        <div className="llm-mermaid-editor-copy">
          <span className="llm-mermaid-editor-eyebrow">Auto-Mermaid</span>
          <h2 className="llm-mermaid-editor-title">One-shot 学术生成器</h2>
          <p className="llm-mermaid-editor-description">
            提交前先把结构意图说清楚，提交后把完整的一次生成机会留给模型。
          </p>
        </div>

        <button
          className="llm-mermaid-editor-close"
          onClick={handleClose}
        >
          {t('dialog.close') || '关闭'}
        </button>
      </div>

      <div className="llm-mermaid-editor-body">
        <section className="llm-mermaid-composer">
          <div className="llm-mermaid-section-heading">
            <h3>提交前整理</h3>
            <p>只在本地帮助你表达清楚，不会提前调用模型。</p>
          </div>

          <div className="llm-mermaid-card llm-mermaid-card-source">
            <label className="llm-mermaid-label" htmlFor="llm-mermaid-source-text">
              原始文本 / 方法描述
            </label>
            <textarea
              id="llm-mermaid-source-text"
              className="llm-mermaid-source-textarea"
              value={state.sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="直接粘贴论文方法描述、模块说明或流程草稿。建议保留输入、核心模块、输出和关系。"
              rows={12}
            />
            <div className="llm-mermaid-source-meta">
              <span>{state.sourceText.trim().length} 字</span>
              <span>one-shot 只在你点击“生成图稿”时请求模型</span>
            </div>
          </div>

          <div className="llm-mermaid-card">
            <div className="llm-mermaid-field">
              <span className="llm-mermaid-label">阅读方向</span>
              <div className="llm-mermaid-chip-group">
                <ChipButton
                  active={state.context.layoutDirection === 'LR'}
                  onClick={() => updateContext({ layoutDirection: 'LR' })}
                >
                  从左到右
                </ChipButton>
                <ChipButton
                  active={state.context.layoutDirection === 'TB'}
                  onClick={() => updateContext({ layoutDirection: 'TB' })}
                >
                  从上到下
                </ChipButton>
              </div>
            </div>

            <div className="llm-mermaid-field">
              <span className="llm-mermaid-label">结构模式</span>
              <div className="llm-mermaid-chip-grid">
                {STRUCTURE_OPTIONS.map((option) => (
                  <ChipButton
                    key={option.value}
                    active={state.context.structurePattern === option.value}
                    onClick={() => updateContext({ structurePattern: option.value })}
                  >
                    {option.label}
                  </ChipButton>
                ))}
              </div>
            </div>

            <div className="llm-mermaid-field">
              <span className="llm-mermaid-label">图面密度</span>
              <div className="llm-mermaid-chip-group">
                {DENSITY_OPTIONS.map((option) => (
                  <ChipButton
                    key={option.value}
                    active={state.context.density === option.value}
                    onClick={() => updateContext({ density: option.value })}
                  >
                    {option.label}
                  </ChipButton>
                ))}
              </div>
            </div>

            <div className="llm-mermaid-field">
              <label className="llm-mermaid-label" htmlFor="llm-mermaid-emphasis">
                重点模块
              </label>
              <input
                id="llm-mermaid-emphasis"
                className="llm-mermaid-text-input"
                value={emphasisValue}
                onChange={(event) =>
                  updateContext({
                    emphasisTargets: event.target.value
                      .split(/[，,、]/)
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="例如：核心方法，评估阶段，最终输出"
              />
            </div>
          </div>

          <div className="llm-mermaid-card llm-mermaid-card-summary">
            <div className="llm-mermaid-section-heading is-compact">
              <h3>提交前摘要</h3>
              <p>{state.assist.summaryTitle}</p>
            </div>

            <ul className="llm-mermaid-summary-list">
              {state.assist.summaryLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            {state.assist.warnings.length > 0 && (
              <div className="llm-mermaid-warning-list">
                {state.assist.warnings.map((warning) => (
                  <div
                    key={warning}
                    className="llm-mermaid-warning"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            )}

            {state.assist.suggestions.length > 0 && (
              <div className="llm-mermaid-suggestion-list">
                {state.assist.suggestions.map((suggestion) => (
                  <SuggestionButton
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApply={applySuggestion}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="llm-mermaid-composer-actions">
            <button
              className="llm-mermaid-button llm-mermaid-button-primary"
              onClick={() => void generate()}
              disabled={!state.assist.isReady || state.phase === 'generating' || state.phase === 'stabilizing'}
            >
              {state.phase === 'generating' || state.phase === 'stabilizing' ? '正在生成...' : '生成图稿'}
            </button>
            <button
              className="llm-mermaid-button"
              onClick={reset}
            >
              清空
            </button>
          </div>
        </section>

        <section className="llm-mermaid-result">
          <div className="llm-mermaid-result-header">
            <div className="llm-mermaid-section-heading">
              <h3>生成结果</h3>
              <p>顺序固定为摘要、预览、代码，不再暴露多轮聊天流程。</p>
            </div>
            <span className={`llm-mermaid-phase llm-mermaid-phase-${state.phase}`}>
              {PHASE_LABELS[state.phase]}
            </span>
          </div>

          {!submittedDraft && !state.mermaidCode.trim() ? (
            <div className="llm-mermaid-result-empty">
              <h4>适合论文图的输入方式</h4>
              <ul>
                <li>先贴论文方法描述，再补一句整体方向和局部结构。</li>
                <li>节点名尽量压缩，避免把整句原文直接放进图里。</li>
                <li>如果有重点模块，直接写在“重点模块”里，让图面更稳。</li>
              </ul>
              <div className="llm-mermaid-example">
                <span className="llm-mermaid-example-label">示例补充</span>
                <p>整体从左到右，中间两路并行，最后汇聚到评估模块。</p>
              </div>
            </div>
          ) : (
            <>
              <div className="llm-mermaid-card llm-mermaid-card-result-summary">
                <div className="llm-mermaid-result-meta">
                  <span>最近一次提交摘要</span>
                  <span>
                    预览参数：{submittedRenderPreset.curve} / {submittedRenderPreset.fontSize}
                  </span>
                </div>
                <ul className="llm-mermaid-summary-list">
                  {(submittedDraft?.summaryLines || state.draft.summaryLines).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>

              <div className="llm-mermaid-card llm-mermaid-card-preview">
                <div className="llm-mermaid-preview-toolbar">
                  <span className="llm-mermaid-preview-label">Drawnix 预览</span>
                  <div className="llm-mermaid-preview-actions">
                    <button
                      className="llm-mermaid-button"
                      onClick={() => void regenerate()}
                      disabled={!state.sourceText.trim() || state.phase === 'generating' || state.phase === 'stabilizing'}
                    >
                      重新生成一次
                    </button>
                    <button
                      className="llm-mermaid-button"
                      onClick={toggleCodeEditor}
                      disabled={!state.mermaidCode.trim()}
                    >
                      {showCodeView ? '收起代码' : '手动改代码'}
                    </button>
                    <button
                      className="llm-mermaid-button llm-mermaid-button-primary"
                      onClick={handleInsert}
                      disabled={elements.length === 0 || isPreviewLoading}
                    >
                      插入画板
                    </button>
                  </div>
                </div>

                <div className="llm-mermaid-preview-canvas">
                  <BoardPreview
                    elements={elements}
                    isLoading={isPreviewLoading || state.phase === 'generating' || state.phase === 'stabilizing'}
                    error={combinedPreviewIssue}
                  />
                </div>
              </div>

              {showCodeView && (
                <div className="llm-mermaid-card llm-mermaid-card-code">
                  <MermaidCodeView
                    code={state.mermaidCode}
                    baselineCode={state.submittedCode}
                    onChange={(code) => void updateMermaidCode(code)}
                    disabled={state.phase === 'generating' || state.phase === 'stabilizing'}
                  />
                </div>
              )}
            </>
          )}

          {(error || previewError) && (
            <div className="llm-mermaid-error-banner">
              <span className="llm-mermaid-error-message">
                {error?.message || previewError}
              </span>
              <button
                className="llm-mermaid-error-dismiss"
                onClick={clearError}
              >
                关闭
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

function ChipButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`llm-mermaid-chip ${active ? 'is-active' : ''}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function SuggestionButton({
  suggestion,
  onApply,
}: {
  suggestion: PromptAssistSuggestion;
  onApply: (suggestion: PromptAssistSuggestion) => void;
}) {
  return (
    <button
      className="llm-mermaid-suggestion"
      type="button"
      onClick={() => onApply(suggestion)}
    >
      <span className="llm-mermaid-suggestion-label">{suggestion.label}</span>
      <span className="llm-mermaid-suggestion-detail">{suggestion.detail}</span>
    </button>
  );
}

export default LLMMermaidDialog;
