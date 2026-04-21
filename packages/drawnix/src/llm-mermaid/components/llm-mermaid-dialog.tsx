import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
import type {
  BeautyLevel,
  DiagramStyle,
  GenerationContext,
  LayoutRhythm,
  MermaidDiagramType,
  MermaidStyleMode,
  PromptAssistSuggestion,
  StructurePattern,
  VisualFocus,
} from '../types';
import { useOneShotMermaidComposer } from '../hooks/use-one-shot-mermaid';
import {
  MERMAID_DIAGRAM_CAPABILITIES,
  detectDiagramTypeFromCode,
  getDiagramTypeLabel,
  getPreviewModeForDiagramType,
  getPreviewModeLabel,
  getStyleModeLabel,
} from '../utils/diagram-capabilities';
import { BoardPreview } from './preview-panel/board-preview';
import { MermaidCodeView } from './preview-panel/mermaid-code-view';
import './llm-mermaid-dialog.scss';

export interface LLMMermaidDialogProps {
  container: HTMLElement | null;
}

type ResultTab = 'brief' | 'preview' | 'code';

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

const DIAGRAM_TYPE_OPTIONS: Array<{ value: MermaidDiagramType; label: string }> = [
  { value: 'auto', label: '自动判断' },
  ...MERMAID_DIAGRAM_CAPABILITIES.map((capability) => ({
    value: capability.type,
    label: capability.label,
  })),
  { value: 'other', label: '其他 Mermaid 类型' },
];

const STYLE_MODE_OPTIONS: Array<{ value: MermaidStyleMode; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'minimal', label: '极简纯净' },
  { value: 'semantic', label: '语义配色' },
  { value: 'grouped', label: '分组信息图' },
  { value: 'showcase', label: '展示增强' },
];

const STYLE_OPTIONS: Array<{ value: DiagramStyle; label: string }> = [
  { value: 'publication', label: '论文刊物' },
  { value: 'architecture', label: '系统架构' },
  { value: 'explainer', label: '讲解流程' },
];

const BEAUTY_OPTIONS: Array<{ value: BeautyLevel; label: string }> = [
  { value: 'conservative', label: '保守' },
  { value: 'balanced', label: '平衡' },
  { value: 'enhanced', label: '强化' },
];

const RHYTHM_OPTIONS: Array<{ value: LayoutRhythm; label: string }> = [
  { value: 'compact', label: '紧凑' },
  { value: 'airy', label: '舒展' },
  { value: 'symmetrical', label: '对称' },
];

const VISUAL_FOCUS_OPTIONS: Array<{ value: VisualFocus; label: string }> = [
  { value: 'input', label: '输入端' },
  { value: 'core', label: '核心方法' },
  { value: 'output', label: '输出端' },
  { value: 'convergence', label: '汇聚点' },
];

const PHASE_LABELS = {
  idle: '本地整理 · 未调用模型',
  generating: '生成中 …',
  stabilizing: '本地稳定化',
  ready: '已完成 · 预览可用',
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
  const [activeTab, setActiveTab] = useState<ResultTab>('brief');
  const lastSettledCodeRef = useRef('');

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
      const focusPoint = [boardContainerRect.width / 2, boardContainerRect.height / 2];
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

  const handleSourceKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        void generate();
      }
    },
    [generate]
  );

  const handleToggleCode = useCallback(() => {
    toggleCodeEditor();
    setActiveTab('code');
  }, [toggleCodeEditor]);

  useEffect(() => {
    const nextSettledCode = state.submittedCode || state.mermaidCode;
    if (
      nextSettledCode &&
      nextSettledCode !== lastSettledCodeRef.current &&
      state.phase !== 'generating' &&
      state.phase !== 'stabilizing'
    ) {
      lastSettledCodeRef.current = nextSettledCode;
      setActiveTab(state.isCodeEditorOpen ? 'code' : 'preview');
    }

    if (!nextSettledCode) {
      lastSettledCodeRef.current = '';
    }
  }, [state.isCodeEditorOpen, state.mermaidCode, state.phase, state.submittedCode]);

  useEffect(() => {
    if (state.isCodeEditorOpen) {
      setActiveTab('code');
    }
  }, [state.isCodeEditorOpen]);

  if (!isOpen) {
    return null;
  }

  const emphasisValue = (state.context.emphasisTargets || []).join('，');
  const combinedPreviewIssue =
    previewError || (!validation?.isValid ? validation?.errors?.[0] : null);
  const currentSummaryLines = submittedDraft?.summaryLines || state.assist.summaryLines;
  const primarySuggestion = state.assist.suggestions[0] || null;
  const additionalSuggestions = state.assist.suggestions.slice(1);
  const estimatedTokenCount = Math.max(
    120,
    Math.round(state.sourceText.trim().length / 3.2 || 0)
  );
  const activeRenderPreset = submittedDraft ? submittedRenderPreset : state.renderPreset;
  const previewDiagramType =
    detectDiagramTypeFromCode(state.submittedCode || state.mermaidCode) || activeRenderPreset.diagramType;
  const previewMode = getPreviewModeForDiagramType(previewDiagramType);
  const stateDotModifier =
    state.phase === 'ready'
      ? 'is-ready'
      : state.phase === 'generating' || state.phase === 'stabilizing'
      ? 'is-busy'
      : state.phase === 'error'
      ? 'is-error'
      : 'is-idle';

  return (
    <div className="llm-mermaid-page">
      <div className="llm-mermaid-paper" />

      <header className="llm-mermaid-topbar">
        <div className="llm-mermaid-topbar-left">
          <button
            className="llm-mermaid-back-btn"
            onClick={handleClose}
            type="button"
          >
            <svg viewBox="0 0 14 14" aria-hidden="true">
              <path d="M9 3L5 7L9 11" />
            </svg>
            返回首页
          </button>

          <div className="llm-mermaid-crumb">
            <span>工具</span>
            <span className="sep">/</span>
            <span className="cur">Auto-Mermaid · 学术生成器</span>
          </div>
        </div>

        <div className="llm-mermaid-topbar-right">
          <span className={`llm-mermaid-chip llm-mermaid-chip-state ${stateDotModifier}`}>
            <span className="dot" />
            {PHASE_LABELS[state.phase]}
          </span>
          <button
            className="llm-mermaid-close-btn"
            onClick={handleClose}
            type="button"
          >
            {t('dialog.close') || '关闭'}
          </button>
        </div>
      </header>

      <div className="llm-mermaid-page-shell">
        <div className="llm-mermaid-page-kicker">
          <span className="kicker-dot" />
          AUTO-MERMAID · 02
        </div>
        <h1 className="llm-mermaid-page-title">
          One-shot <span className="it">学术生成器</span>
        </h1>
        <p className="llm-mermaid-page-desc">
          提交前先把结构意图说清楚，提交后把完整的一次生成机会留给模型。本地整理不产生调用，直到你按下「生成图稿」。
        </p>

        <div className="llm-mermaid-layout">
          <section className="llm-mermaid-left-column">
            <div className="llm-mermaid-card">
              <span className="llm-mermaid-help-chip">// 只在本地整理，不触发模型</span>

              <h3>
                提交前整理 <span className="it">· draft only</span>
              </h3>
              <p className="sub">只在本地帮助你表达清楚，不会提前调用模型。</p>

              <FieldLabel
                index="01"
                label="原始文本 / 方法描述"
                hint="支持粘贴 · 最多 4000 字"
              />
              <textarea
                className="llm-mermaid-textarea"
                value={state.sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                onKeyDown={handleSourceKeyDown}
                placeholder="把原始论文段落 / 方法描述粘在这里。也可以直接写：画成 erDiagram，用语义配色，尽量美观 …"
                maxLength={4000}
                rows={6}
              />

              <div className="llm-mermaid-field">
                <FieldLabel
                  index="02"
                  label="图类型意图"
                  hint="也可直接在原文里写 classDiagram / erDiagram / mindmap"
                />
                <select
                  className="llm-mermaid-input llm-mermaid-select"
                  value={state.context.diagramType || 'auto'}
                  onChange={(event) =>
                    updateContext({
                      diagramType: event.target.value as MermaidDiagramType,
                    })
                  }
                >
                  {DIAGRAM_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="llm-mermaid-field">
                <FieldLabel
                  index="03"
                  label="样式模式"
                  hint="决定是否输出极简、语义配色或分组信息图"
                />
                <div className="llm-mermaid-pills">
                  {STYLE_MODE_OPTIONS.map((option) => (
                    <PillButton
                      key={option.value}
                      active={state.context.styleMode === option.value}
                      onClick={() => updateContext({ styleMode: option.value })}
                    >
                      {option.label}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div className="llm-mermaid-field">
                <FieldLabel
                  index="04"
                  label="阅读方向"
                  hint="对 flowchart / state / mindmap 更明显"
                />
                <div className="llm-mermaid-pills">
                  <PillButton
                    active={state.context.layoutDirection === 'LR'}
                    onClick={() => updateContext({ layoutDirection: 'LR' })}
                  >
                    <DirectionGlyph direction="LR" />
                    从左到右
                  </PillButton>
                  <PillButton
                    active={state.context.layoutDirection === 'TB'}
                    onClick={() => updateContext({ layoutDirection: 'TB' })}
                  >
                    <DirectionGlyph direction="TB" />
                    从上到下
                  </PillButton>
                </div>
              </div>

              <div className="llm-mermaid-field">
                <FieldLabel
                  index="05"
                  label="结构模式"
                  hint="对 flowchart 类图更明显"
                />
                <div className="llm-mermaid-pills">
                  {STRUCTURE_OPTIONS.map((option) => (
                    <PillButton
                      key={option.value}
                      active={state.context.structurePattern === option.value}
                      onClick={() => updateContext({ structurePattern: option.value })}
                    >
                      {option.label}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div className="llm-mermaid-field">
                <FieldLabel
                  index="06"
                  label="图面密度"
                  hint="决定节点间距与留白"
                />
                <div className="llm-mermaid-pills">
                  {DENSITY_OPTIONS.map((option) => (
                    <PillButton
                      key={option.value}
                      active={state.context.density === option.value}
                      onClick={() => updateContext({ density: option.value })}
                    >
                      {option.label}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div className="llm-mermaid-field">
                <FieldLabel
                  index="07"
                  label="图面配方"
                  hint="决定图形气质与视觉锚点"
                />
                <div className="llm-mermaid-recipe-grid">
                  <div className="llm-mermaid-recipe-item">
                    <span className="name">图形风格</span>
                    <div className="llm-mermaid-pills">
                      {STYLE_OPTIONS.map((option) => (
                        <PillButton
                          key={option.value}
                          active={state.context.diagramStyle === option.value}
                          onClick={() => updateContext({ diagramStyle: option.value })}
                        >
                          {option.label}
                        </PillButton>
                      ))}
                    </div>
                  </div>

                  <div className="llm-mermaid-recipe-item">
                    <span className="name">美观度</span>
                    <div className="llm-mermaid-pills">
                      {BEAUTY_OPTIONS.map((option) => (
                        <PillButton
                          key={option.value}
                          active={state.context.beautyLevel === option.value}
                          onClick={() => updateContext({ beautyLevel: option.value })}
                        >
                          {option.label}
                        </PillButton>
                      ))}
                    </div>
                  </div>

                  <div className="llm-mermaid-recipe-item">
                    <span className="name">版式节奏</span>
                    <div className="llm-mermaid-pills">
                      {RHYTHM_OPTIONS.map((option) => (
                        <PillButton
                          key={option.value}
                          active={state.context.layoutRhythm === option.value}
                          onClick={() => updateContext({ layoutRhythm: option.value })}
                        >
                          {option.label}
                        </PillButton>
                      ))}
                    </div>
                  </div>

                  <div className="llm-mermaid-recipe-item">
                    <span className="name">视觉重点</span>
                    <div className="llm-mermaid-pills">
                      {VISUAL_FOCUS_OPTIONS.map((option) => (
                        <PillButton
                          key={option.value}
                          active={state.context.visualFocus === option.value}
                          onClick={() => updateContext({ visualFocus: option.value })}
                        >
                          {option.label}
                        </PillButton>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="llm-mermaid-field is-last">
                <FieldLabel
                  index="08"
                  label="重点模块"
                  hint="可选 · 最多 3 个"
                />
                <input
                  className="llm-mermaid-input"
                  value={emphasisValue}
                  onChange={(event) =>
                    updateContext({
                      emphasisTargets: event.target.value
                        .split(/[，,、]/)
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .slice(0, 3),
                    })
                  }
                  placeholder="例如：核心方法，评估阶段，最终输出"
                />
              </div>
            </div>

            <div className="llm-mermaid-card">
              <h3>
                提交前摘要 <span className="it">· pre-flight</span>
              </h3>
              <p className="sub">先贴原始文本，再把 one-shot 机会交给模型。</p>

              <div className="llm-mermaid-summary">
                  <ul>
                    {currentSummaryLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
              </div>

              {primarySuggestion ? (
                <SuggestionNote
                  suggestion={primarySuggestion}
                  onApply={applySuggestion}
                />
              ) : (
                <div className="llm-mermaid-note-block">
                  <span className="tag">补一句结构走向</span>
                  <p>整体从左到右，中间两路并行，最后汇聚到评估模块。</p>
                </div>
              )}

              {state.assist.warnings.map((warning) => (
                <div
                  key={warning}
                  className="llm-mermaid-warning-line"
                >
                  {warning}
                </div>
              ))}

              {additionalSuggestions.length > 0 && (
                <div className="llm-mermaid-note-grid">
                  {additionalSuggestions.map((suggestion) => (
                    <SuggestionNote
                      key={suggestion.id}
                      suggestion={suggestion}
                      onApply={applySuggestion}
                      compact
                    />
                  ))}
                </div>
              )}

              <div className="llm-mermaid-btn-row">
                <button
                  className="llm-mermaid-btn primary"
                  onClick={() => void generate()}
                  disabled={
                    !state.assist.isReady ||
                    state.phase === 'generating' ||
                    state.phase === 'stabilizing'
                  }
                  type="button"
                >
                  <svg viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M2 1L9 5L2 9Z" />
                  </svg>
                  {state.phase === 'generating' || state.phase === 'stabilizing'
                    ? '生成中...'
                    : '生成图稿'}
                </button>
                <button
                  className="llm-mermaid-btn"
                  onClick={reset}
                  type="button"
                >
                  清空
                </button>
                <span className="llm-mermaid-anno sm">Ctrl + Enter 快速生成</span>
              </div>
            </div>
          </section>

          <section className="llm-mermaid-right-column">
            <div className="llm-mermaid-result">
              <div className="llm-mermaid-result-head">
                <div className="ttl">
                  <h3>
                    生成结果 <span className="it">· output</span>
                  </h3>
                  <div className="sub">顺序固定为摘要、预览、代码，不再暴露多轮聊天流程。</div>
                </div>

                <span className={`llm-mermaid-state-chip ${stateDotModifier}`}>
                  <span className="d" />
                  {state.phase === 'ready'
                    ? '已完成'
                    : state.phase === 'generating'
                    ? '生成中 …'
                    : state.phase === 'stabilizing'
                    ? '稳定化 …'
                    : state.phase === 'error'
                    ? '保留草稿'
                    : '待生成'}
                </span>
              </div>

              <div className="llm-mermaid-tabs">
                <button
                  className={`llm-mermaid-tab ${activeTab === 'brief' ? 'active' : ''}`}
                  onClick={() => setActiveTab('brief')}
                  type="button"
                >
                  摘要 <span className="n">01</span>
                </button>
                <button
                  className={`llm-mermaid-tab ${activeTab === 'preview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('preview')}
                  type="button"
                >
                  预览 <span className="n">02</span>
                </button>
                <button
                  className={`llm-mermaid-tab ${activeTab === 'code' ? 'active' : ''}`}
                  onClick={() => setActiveTab('code')}
                  type="button"
                >
                  代码 <span className="n">03</span>
                </button>
              </div>

              <div className="llm-mermaid-tab-pane" hidden={activeTab !== 'brief'}>
                <div className="llm-mermaid-guide-card">
                  <h4>
                    <svg viewBox="0 0 14 14" aria-hidden="true">
                      <circle cx="7" cy="7" r="5.5" />
                      <path d="M7 4L7 7.5M7 9.5L7 9.5" />
                    </svg>
                    适合论文图的输入方式
                  </h4>
                  <ul>
                    {currentSummaryLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>

                  <div className="llm-mermaid-guide-example">
                    <span className="tag">示例补充</span>
                    <p>
                      {primarySuggestion?.detail ||
                        '整体从左到右，中间两路并行，最后汇聚到评估模块。'}
                    </p>
                  </div>
                </div>

                <div className="llm-mermaid-guide-card llm-mermaid-dry-run">
                  <h4>
                    <svg viewBox="0 0 14 14" aria-hidden="true">
                      <path d="M3 7L6 10L11 4" />
                    </svg>
                    本地 dry-run · 还没调用模型
                  </h4>

                  <div className="llm-mermaid-dry-run-grid">
                    <div className="label">图类型</div>
                    <div>{getDiagramTypeLabel(activeRenderPreset.diagramType)}</div>
                    <div className="label">预览方式</div>
                    <div>{getPreviewModeLabel(activeRenderPreset.previewMode)}</div>
                    <div className="label">样式模式</div>
                    <div>{getStyleModeLabel(state.context.styleMode)}</div>
                    <div className="label">方向</div>
                    <div>{state.context.layoutDirection === 'TB' ? '从上到下 · TB' : '从左到右 · LR'}</div>
                    <div className="label">结构</div>
                    <div>{formatStructureText(state.context.structurePattern)}</div>
                    <div className="label">密度</div>
                    <div>{formatDensityText(state.context.density)}</div>
                    <div className="label">风格</div>
                    <div>{formatDiagramStyleText(state.context.diagramStyle)}</div>
                    <div className="label">美观度</div>
                    <div>{formatBeautyLevelText(state.context.beautyLevel)}</div>
                    <div className="label">节奏</div>
                    <div>{formatLayoutRhythmText(state.context.layoutRhythm)}</div>
                    <div className="label">锚点</div>
                    <div>{formatVisualFocusText(state.context.visualFocus)}</div>
                    <div className="label">重点</div>
                    <div>
                      {state.context.emphasisTargets?.length
                        ? state.context.emphasisTargets.join('，')
                        : '—'}
                    </div>
                    <div className="label">预览</div>
                    <div className="mono">
                      {activeRenderPreset.curve} / {activeRenderPreset.fontSize}
                    </div>
                    <div className="label">token 预估</div>
                    <div className="mono">≈ {estimatedTokenCount} / 4k</div>
                  </div>
                </div>
              </div>

              <div className="llm-mermaid-tab-pane" hidden={activeTab !== 'preview'}>
                <div className="llm-mermaid-preview-meta">
                  <span className="llm-mermaid-state-chip is-ready">
                    <span className="d" />
                    {getDiagramTypeLabel(previewDiagramType)}
                  </span>
                  <span className="llm-mermaid-anno sm">
                    预览模式 · {getPreviewModeLabel(previewMode)}
                  </span>
                </div>

                <div className="llm-mermaid-preview-window">
                  <BoardPreview
                    elements={elements}
                    isLoading={
                      isPreviewLoading ||
                      state.phase === 'generating' ||
                      state.phase === 'stabilizing'
                    }
                    error={combinedPreviewIssue}
                  />
                </div>

                <div className="llm-mermaid-preview-actions-row">
                  <button
                    className="llm-mermaid-btn"
                    onClick={() => void regenerate()}
                    disabled={
                      !state.sourceText.trim() ||
                      state.phase === 'generating' ||
                      state.phase === 'stabilizing'
                    }
                    type="button"
                  >
                    重新生成一次
                  </button>
                  <button
                    className="llm-mermaid-btn"
                    onClick={handleToggleCode}
                    disabled={!state.mermaidCode.trim()}
                    type="button"
                  >
                    手动改代码
                  </button>
                  <button
                    className="llm-mermaid-btn primary"
                    onClick={handleInsert}
                    disabled={elements.length === 0 || isPreviewLoading}
                    type="button"
                  >
                    插入画板
                  </button>
                </div>
              </div>

              <div className="llm-mermaid-tab-pane" hidden={activeTab !== 'code'}>
                <div className="llm-mermaid-code-pane">
                  {state.mermaidCode.trim() ? (
                    <MermaidCodeView
                      code={state.mermaidCode}
                      baselineCode={state.submittedCode}
                      onChange={(code) => void updateMermaidCode(code)}
                      disabled={
                        state.phase === 'generating' || state.phase === 'stabilizing'
                      }
                    />
                  ) : (
                    <div className="llm-mermaid-code-empty">
                      <span className="big">code</span>
                      <span className="anno">生成完成后会在这里显示 Mermaid 代码</span>
                    </div>
                  )}
                </div>
              </div>

              {(error || previewError) && (
                <div className="llm-mermaid-inline-error">
                  <span>{error?.message || previewError}</span>
                  <button
                    className="llm-mermaid-btn ghost"
                    onClick={clearError}
                    type="button"
                  >
                    关闭
                  </button>
                </div>
              )}

              <div className="llm-mermaid-result-foot">
                <span className="llm-mermaid-anno sm">Tips · 只在按下「生成图稿」时才会消耗一次调用</span>
                <span className="llm-mermaid-anno sm">v 0.3.1</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

function FieldLabel({
  index,
  label,
  hint,
}: {
  index: string;
  label: string;
  hint: string;
}) {
  return (
    <div className="llm-mermaid-field-label">
      <span className="lbl">
        <span className="n">{index}</span>
        {label}
      </span>
      <span className="hint">{hint}</span>
    </div>
  );
}

function PillButton({
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
      className={`llm-mermaid-pill ${active ? 'active' : ''}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function DirectionGlyph({ direction }: { direction: 'LR' | 'TB' }) {
  if (direction === 'TB') {
    return (
      <svg className="llm-mermaid-dir-glyph" viewBox="0 0 10 14" aria-hidden="true">
        <path d="M5 1L5 12M2 9L5 12L8 9" />
      </svg>
    );
  }

  return (
    <svg className="llm-mermaid-dir-glyph" viewBox="0 0 14 10" aria-hidden="true">
      <path d="M1 5L12 5M9 2L12 5L9 8" />
    </svg>
  );
}

function SuggestionNote({
  suggestion,
  onApply,
  compact = false,
}: {
  suggestion: PromptAssistSuggestion;
  onApply: (suggestion: PromptAssistSuggestion) => void;
  compact?: boolean;
}) {
  return (
    <button
      className={`llm-mermaid-note-block is-action ${compact ? 'is-compact' : ''}`}
      onClick={() => onApply(suggestion)}
      type="button"
    >
      <span className="tag">{suggestion.label}</span>
      <p>{suggestion.detail}</p>
    </button>
  );
}

function formatStructureText(pattern: StructurePattern | undefined) {
  switch (pattern) {
    case 'linear':
      return '线性主干 · linear';
    case 'branched':
      return '主干分支 · branched';
    case 'convergent':
      return '并行汇聚 · convergent';
    case 'multi-lane':
      return '上下辅轨 · multi-lane';
    case 'feedback':
      return '反馈回路 · feedback';
    case 'mixed':
    default:
      return '混合结构 · hybrid';
  }
}

function formatDensityText(density: GenerationContext['density']) {
  switch (density) {
    case 'dense':
      return '紧凑 · dense';
    case 'sparse':
      return '疏朗 · airy';
    case 'balanced':
    default:
      return '平衡 · balanced';
  }
}

function formatDiagramStyleText(style: GenerationContext['diagramStyle']) {
  switch (style) {
    case 'architecture':
      return '系统架构 · modules';
    case 'explainer':
      return '讲解流程 · story';
    case 'publication':
    default:
      return '论文刊物 · editorial';
  }
}

function formatBeautyLevelText(level: GenerationContext['beautyLevel']) {
  switch (level) {
    case 'conservative':
      return '保守 · stable';
    case 'enhanced':
      return '强化 · composed';
    case 'balanced':
    default:
      return '平衡 · balanced';
  }
}

function formatLayoutRhythmText(rhythm: GenerationContext['layoutRhythm']) {
  switch (rhythm) {
    case 'compact':
      return '紧凑 · compact';
    case 'symmetrical':
      return '对称 · symmetric';
    case 'airy':
    default:
      return '舒展 · airy';
  }
}

function formatVisualFocusText(focus: GenerationContext['visualFocus']) {
  switch (focus) {
    case 'input':
      return '输入端 · input';
    case 'output':
      return '输出端 · output';
    case 'convergence':
      return '汇聚点 · merge';
    case 'core':
    default:
      return '核心方法 · core';
  }
}

export default LLMMermaidDialog;
