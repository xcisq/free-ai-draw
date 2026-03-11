import { useState, useCallback, useMemo } from 'react';
import { useBoard } from '@plait-board/react-board';
import {
  getViewportOrigination,
  PlaitBoard,
  PlaitElement,
  WritableClipboardOperationType,
} from '@plait/core';
import { useI18n } from '../../i18n';
import { useDrawnix } from '../../hooks/use-drawnix';
import {
  AnalysisResult,
  CRSAnswer,
  CRSQuestion,
  ExtractionResult,
  PaperDrawPhase,
} from '../types/analyzer';
import {
  extractFromText,
  generateDefaultAnalysis,
  generateQuestions,
  mergeLocalAnswers,
  validateAnalysisResult,
  validateExtractionResult,
} from '../analyzer';
import { getPaperDrawEnvConfig } from '../config';
import { buildFlowchartState } from '../builder/flowchart-builder';
import { CRSQAPanel } from './crs-qa-panel';
import { PaperDrawBoardPreview } from './paperdraw-board-preview';
import './paperdraw-dialog.scss';

const PaperDrawDialog = () => {
  const { t } = useI18n();
  const { appState, setAppState } = useDrawnix();
  const mainBoard = useBoard();
  const envConfig = useMemo(
    () =>
      getPaperDrawEnvConfig(
        (import.meta as unknown as { env?: Record<string, string | undefined> })
          .env
      ),
    []
  );

  const [phase, setPhase] = useState<PaperDrawPhase>('input');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');

  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [questions, setQuestions] = useState<CRSQuestion[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [draftElements, setDraftElements] = useState<PlaitElement[]>([]);

  const closeDialog = useCallback(() => {
    setAppState({ ...appState, openDialogType: null });
  }, [appState, setAppState]);

  const buildDraft = useCallback((analysis: AnalysisResult) => {
    const draft = buildFlowchartState(analysis);
    setAnalysisResult(analysis);
    setDraftElements(draft.elements);
    setPhase('draft_flowchart');
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!envConfig.isConfigured) {
      setError(
        `${t('dialog.paperdraw.error.noApiKey')} (.env.local / VITE_PAPERDRAW_API_KEY)`
      );
      return;
    }
    if (!text.trim()) {
      return;
    }

    setError(null);
    setRawText('');
    setExtraction(null);
    setQuestions([]);
    setAnalysisResult(null);
    setDraftElements([]);
    setPhase('analyzing');

    try {
      const rawResult = await extractFromText(text.trim(), envConfig, {
        onText: (value) => setRawText(value),
      });
      const normalizedExtraction = validateExtractionResult(rawResult);
      setExtraction(normalizedExtraction);

      const nextQuestions = generateQuestions(normalizedExtraction);
      setQuestions(nextQuestions);

      if (nextQuestions.length) {
        setPhase('qa');
        return;
      }

      const nextAnalysis = validateAnalysisResult(
        generateDefaultAnalysis(normalizedExtraction)
      );
      buildDraft(nextAnalysis);
    } catch (err: any) {
      console.error('PaperDraw analysis failed:', err);
      setError(`${t('dialog.paperdraw.error.analyzeFailed')}: ${err.message}`);
      setPhase('input');
    }
  }, [buildDraft, envConfig, t, text]);

  const handleQAComplete = useCallback(
    (answers: CRSAnswer[]) => {
      if (!extraction) {
        return;
      }

      try {
        const nextAnalysis = validateAnalysisResult(
          mergeLocalAnswers(extraction, answers, questions)
        );
        buildDraft(nextAnalysis);
      } catch (err: any) {
        console.error('PaperDraw QA merge failed:', err);
        setError(`${t('dialog.paperdraw.error.analyzeFailed')}: ${err.message}`);
        setPhase('qa');
      }
    },
    [buildDraft, extraction, questions, t]
  );

  const handleSkipQA = useCallback(() => {
    if (!extraction) {
      return;
    }

    try {
      const nextAnalysis = validateAnalysisResult(
        generateDefaultAnalysis(extraction)
      );
      buildDraft(nextAnalysis);
    } catch (err: any) {
      console.error('PaperDraw default analysis failed:', err);
      setError(`${t('dialog.paperdraw.error.analyzeFailed')}: ${err.message}`);
      setPhase('qa');
    }
  }, [buildDraft, extraction, t]);

  const insertToBoard = useCallback(() => {
    if (!draftElements.length) {
      return;
    }

    const boardContainerRect =
      PlaitBoard.getBoardContainer(mainBoard).getBoundingClientRect();
    const focusPoint = [
      boardContainerRect.width / 4,
      boardContainerRect.height / 2 - 20,
    ];
    const zoom = mainBoard.viewport.zoom;
    const origination = getViewportOrigination(mainBoard);
    const focusX = origination![0] + focusPoint[0] / zoom;
    const focusY = origination![1] + focusPoint[1] / zoom;

    mainBoard.insertFragment(
      {
        elements: JSON.parse(JSON.stringify(draftElements)),
      },
      [focusX, focusY],
      WritableClipboardOperationType.paste
    );

    closeDialog();
  }, [closeDialog, draftElements, mainBoard]);

  return (
    <div className="paperdraw-dialog">
      <div className="paperdraw-dialog-desc">{t('dialog.paperdraw.description')}</div>
      <div className="paperdraw-env-hint">
        <span>Model: {envConfig.model}</span>
        <span>Base URL: {envConfig.baseUrl}</span>
      </div>

      {error && <div className="paperdraw-error">{error}</div>}

      <div className="paperdraw-layout">
        <div className="paperdraw-left-panel">
          <div className="paperdraw-input-section">
            <textarea
              className="paperdraw-textarea"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t('dialog.paperdraw.placeholder')}
              disabled={phase === 'analyzing'}
              rows={10}
            />
            <div className="paperdraw-actions">
              <button
                className="paperdraw-btn paperdraw-btn-primary"
                onClick={handleAnalyze}
                disabled={phase === 'analyzing' || !text.trim()}
              >
                {phase === 'analyzing'
                  ? t('dialog.paperdraw.analyzing')
                  : t('dialog.paperdraw.analyze')}
              </button>
              {draftElements.length > 0 && (
                <button
                  className="paperdraw-btn paperdraw-btn-secondary"
                  onClick={insertToBoard}
                >
                  {t('dialog.paperdraw.insert')}
                </button>
              )}
            </div>
          </div>

          {(phase === 'analyzing' || rawText) && (
            <div className="paperdraw-stream-section">
              <h3>实时模型输出</h3>
              <pre className="paperdraw-stream-output">
                {rawText || '模型正在返回内容...'}
              </pre>
            </div>
          )}

          {phase === 'qa' && questions.length > 0 && (
            <CRSQAPanel
              questions={questions}
              onComplete={handleQAComplete}
              onSkip={handleSkipQA}
            />
          )}

          {(extraction || analysisResult) && (
            <div className="paperdraw-analysis-preview">
              <h4>结构化结果</h4>
              <p>
                实体：
                <strong>
                  {' '}
                  {(analysisResult ?? extraction)?.entities.length ?? 0}
                </strong>
                ，关系：
                <strong>
                  {' '}
                  {(analysisResult ?? extraction)?.relations.length ?? 0}
                </strong>
              </p>
              <ul>
                {(analysisResult ?? extraction)?.entities.map((entity) => (
                  <li key={entity.id}>
                    {entity.label}
                    {typeof entity.confidence === 'number'
                      ? ` (${entity.confidence.toFixed(2)})`
                      : ''}
                  </li>
                ))}
              </ul>
              {(analysisResult?.warnings ?? extraction?.warnings)?.length ? (
                <>
                  <h4>提示</h4>
                  <ul>
                    {(analysisResult?.warnings ?? extraction?.warnings)?.map(
                      (warning) => (
                        <li key={warning}>{warning}</li>
                      )
                    )}
                  </ul>
                </>
              ) : null}
            </div>
          )}
        </div>

        <div className="paperdraw-right-panel">
          {draftElements.length > 0 ? (
            <PaperDrawBoardPreview
              value={draftElements}
              onChange={setDraftElements}
            />
          ) : (
            <div className="paperdraw-draft-placeholder">
              <h3>流程图预览</h3>
              <p>完成文本分析后，这里会显示可编辑的真实流程图。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaperDrawDialog;
