import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import type { PlaitBoard, PlaitElement } from '@plait/core';
import { useBoardStyleOptimization } from '../../hooks/use-board-style-optimization';
import { StyleInput } from './style-input';
import { StyleSchemeCard } from './style-scheme-card';
import { resolveBoardStyleSelection } from '../../utils/board-style-selection';
import './index.scss';

export interface BoardStylePanelProps {
  board: PlaitBoard;
  selectedElements: PlaitElement[];
}

export const BoardStylePanel = ({
  board,
  selectedElements,
}: BoardStylePanelProps) => {
  const [includeConnectedLines, setIncludeConnectedLines] = useState(true);
  const [requestText, setRequestText] = useState('');
  const selectionKey = useMemo(
    () =>
      selectedElements
        .map((element) => (element as Record<string, unknown>)['id'])
        .filter((id): id is string => typeof id === 'string')
        .sort()
        .join('|'),
    [selectedElements]
  );

  useEffect(() => {
    setIncludeConnectedLines(true);
    setRequestText('');
  }, [selectionKey]);

  const resolvedSelection = useMemo(
    () =>
      resolveBoardStyleSelection(board, selectedElements, {
        includeConnectedLines,
      }),
    [board, includeConnectedLines, selectedElements]
  );
  const {
    schemes,
    isGenerating,
    error,
    lastRequest,
    generateSchemes,
    previewScheme,
    clearPreview,
    applyScheme,
    clearError,
  } = useBoardStyleOptimization({
    board,
    targetElements: resolvedSelection.targetElements,
    selectionSummary: resolvedSelection.summary,
    autoGenerate: false,
  });

  const quickPrompts = [
    {
      label: '更专业',
      value: '整体更专业一些，适合论文或汇报图',
    },
    {
      label: '更柔和',
      value: '整体配色更柔和，降低饱和度并保持层次',
    },
    {
      label: '线条更突出',
      value: '增强连线和箭头的辨识度，让流程方向更清晰',
    },
  ];

  const stopPanelPointerEvent = (
    event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>
  ) => {
    event.stopPropagation();
  };

  return (
    <div
      className="board-style-panel"
      onPointerDownCapture={stopPanelPointerEvent}
      onMouseDownCapture={stopPanelPointerEvent}
    >
      <div className="board-style-panel__header">
        <div>
          <div className="board-style-panel__title">AI 样式优化</div>
          <div className="board-style-panel__subtitle">
            原始选中 {resolvedSelection.summary.originalTotal} 个，实际优化 {resolvedSelection.summary.total} 个
          </div>
        </div>
      </div>

      <div className="board-style-panel__selection-meta">
        <span>形状 {resolvedSelection.summary.shapeCount}</span>
        <span>连线 {resolvedSelection.summary.lineCount}</span>
        <span>文本 {resolvedSelection.summary.textCount}</span>
      </div>

      <label className="board-style-panel__selection-toggle">
        <input
          type="checkbox"
          checked={includeConnectedLines}
          onChange={(event) => setIncludeConnectedLines(event.target.checked)}
        />
        <span>
          包含关联连线
          {resolvedSelection.summary.relatedLineCount > 0
            ? `（自动补入 ${resolvedSelection.summary.relatedLineCount} 条）`
            : '（当前无可补入连线）'}
        </span>
      </label>

      <StyleInput
        value={requestText}
        onValueChange={setRequestText}
        disabled={isGenerating || resolvedSelection.targetElements.length === 0}
        onSubmit={async (value) => {
          await generateSchemes(value);
        }}
      />

      <div className="board-style-panel__input-hint">
        先输入你希望调整的样式要求，再点击生成。不会在打开面板时自动请求。
      </div>

      <div className="board-style-panel__quick-actions">
        {quickPrompts.map((preset) => (
          <button
            key={preset.label}
            className="board-style-panel__quick-chip"
            onClick={() => setRequestText(preset.value)}
            disabled={isGenerating || resolvedSelection.targetElements.length === 0}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {isGenerating && (
        <div className="board-style-panel__status">正在生成样式方案...</div>
      )}

      {error && (
        <div className="board-style-panel__error">
          <span>{error}</span>
          <button type="button" onClick={clearError}>
            关闭
          </button>
        </div>
      )}

      {!isGenerating && !error && schemes.length === 0 && (
        <div className="board-style-panel__empty">
          还没有样式方案，请先输入这次想优化的样式要求，再点击生成。
        </div>
      )}

      {lastRequest && !isGenerating && (
        <div className="board-style-panel__last-request">最近请求：{lastRequest}</div>
      )}

      <div className="board-style-panel__scheme-list">
        {schemes.map((scheme) => (
          <StyleSchemeCard
            key={scheme.id}
            scheme={scheme}
            onPreview={previewScheme}
            onClearPreview={clearPreview}
            onApply={applyScheme}
          />
        ))}
      </div>
    </div>
  );
};
