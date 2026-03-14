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
import Menu from '../../components/menu/menu';
import MenuItem from '../../components/menu/menu-item';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/popover/popover';
import {
  type AnalysisResult,
  type CRSAnswer,
  type CRSQuestion,
  type ElkLayoutOptions,
  type ExtractionResult,
  type LayoutEngine,
  type LayoutResult,
  type OptimizeMode,
  type PaperDrawPhase,
  type PaperDrawSelectionState,
} from '../types/analyzer';
import {
  extractFromText,
  generateDefaultAnalysis,
  generateQuestions,
  hasStructuralGuardQuestions,
  mergeLocalAnswers,
  validateAnalysisResult,
  validateExtractionResult,
} from '../analyzer';
import { getPaperDrawEnvConfig } from '../config';
import {
  buildFlowchartState,
  buildElkOptimizedFlowchartState,
  buildOptimizedFlowchartState,
} from '../builder/flowchart-builder';
import { PAPERDRAW_LAYOUT_DEFAULTS } from '../config/defaults';
import { isValidSelectionForOptimize } from '../layout/layout-snapshot';
import { CRSQAPanel } from './crs-qa-panel';
import { PaperDrawBoardPreview } from './paperdraw-board-preview';
import { PaperDrawDebugPanel } from './paperdraw-debug-panel';
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
  const isDebugEnabled = useMemo(() => {
    const metaEnv = (import.meta as unknown as {
      env?: Record<string, string | boolean | undefined>;
    }).env;
    return metaEnv?.DEV === true || metaEnv?.VITE_PAPERDRAW_DEBUG === 'true';
  }, []);

  const [phase, setPhase] = useState<PaperDrawPhase>('input');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');

  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [questions, setQuestions] = useState<CRSQuestion[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [draftLayout, setDraftLayout] = useState<LayoutResult | null>(null);
  const [draftElements, setDraftElements] = useState<PlaitElement[]>([]);
  const [selectionState, setSelectionState] = useState<PaperDrawSelectionState>({
    elementIds: [],
    geometryIds: [],
    edgeIds: [],
  });
  const [optimizeMenuOpen, setOptimizeMenuOpen] = useState(false);
  const hasSkipGuard = useMemo(
    () => hasStructuralGuardQuestions(questions),
    [questions]
  );

  const closeDialog = useCallback(() => {
    setAppState({ ...appState, openDialogType: null });
  }, [appState, setAppState]);

  const buildDraft = useCallback((analysis: AnalysisResult) => {
    setError(null);
    const draft = buildFlowchartState(analysis);
    setAnalysisResult(analysis);
    setDraftLayout(draft.layout);
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
    setDraftLayout(null);
    setDraftElements([]);
    setSelectionState({
      elementIds: [],
      geometryIds: [],
      edgeIds: [],
    });
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

    if (hasSkipGuard) {
      setError(t('dialog.paperdraw.error.structureConfirmationRequired'));
      setPhase('qa');
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
  }, [buildDraft, extraction, hasSkipGuard, t]);

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

  const canOptimizeSelection = useMemo(() => {
    if (!analysisResult || !draftElements.length) {
      return false;
    }
    return isValidSelectionForOptimize(selectionState, analysisResult, draftElements);
  }, [analysisResult, draftElements, selectionState]);

  const handleOptimizeLayout = useCallback(
    async (engine: LayoutEngine, mode: OptimizeMode) => {
      if (!analysisResult) {
        return;
      }

      if (mode === 'selection' && !canOptimizeSelection) {
        setError(t('dialog.paperdraw.error.invalidOptimizeSelection'));
        return;
      }

      try {
        setOptimizeMenuOpen(false);
        setError(null);
        setPhase('optimizing');
        const options: ElkLayoutOptions = {
          engine,
          mode,
          selection: selectionState,
          profile: 'auto',
          quality: 'quality',
          timeoutMs:
            mode === 'selection'
              ? PAPERDRAW_LAYOUT_DEFAULTS.optimizerSelectionTimeoutMs
              : PAPERDRAW_LAYOUT_DEFAULTS.optimizerGlobalTimeoutMs,
        };
        const optimizedDraft = await buildElkOptimizedFlowchartState(
          analysisResult,
          draftElements,
          options
        );
        setDraftLayout(optimizedDraft.layout);
        setDraftElements(optimizedDraft.elements);
        setError(
          optimizedDraft.layout.fallbackFrom === 'pipeline_v1'
            ? t('dialog.paperdraw.fallback.pipelineLayout')
            : null
        );
        setPhase('draft_flowchart');
      } catch (err: any) {
        console.error('PaperDraw ELK optimize failed, fallback to heuristic:', err);
        try {
          const fallbackDraft = buildOptimizedFlowchartState(
            analysisResult,
            draftElements
          );
          setDraftLayout(fallbackDraft.layout);
          setDraftElements(fallbackDraft.elements);
          setPhase('draft_flowchart');
        } catch (fallbackError: any) {
          console.error('PaperDraw optimize layout failed:', fallbackError);
          setError(
            `${t('dialog.paperdraw.error.analyzeFailed')}: ${fallbackError.message}`
          );
          setPhase('draft_flowchart');
        }
      }
    },
    [analysisResult, canOptimizeSelection, draftElements, selectionState, t]
  );

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
                <>
                  <Popover
                    open={optimizeMenuOpen}
                    onOpenChange={setOptimizeMenuOpen}
                    placement="bottom-end"
                  >
                    <PopoverTrigger asChild>
                      <button
                        className="paperdraw-btn paperdraw-btn-secondary"
                        disabled={phase === 'optimizing'}
                      >
                        {phase === 'optimizing'
                          ? `${t('dialog.paperdraw.optimizeLayout')}...`
                          : t('dialog.paperdraw.optimizeLayout')}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent>
                      <Menu onSelect={() => setOptimizeMenuOpen(false)}>
                        <MenuItem
                          disabled={phase === 'optimizing'}
                          onSelect={() => {}}
                          submenu={
                            <Menu onSelect={() => setOptimizeMenuOpen(false)}>
                              <MenuItem
                                disabled={
                                  !canOptimizeSelection || phase === 'optimizing'
                                }
                                onSelect={() => {
                                  void handleOptimizeLayout('pipeline_v1', 'selection');
                                }}
                              >
                                {t('dialog.paperdraw.optimizeSelection')}
                              </MenuItem>
                              <MenuItem
                                disabled={phase === 'optimizing'}
                                onSelect={() => {
                                  void handleOptimizeLayout('pipeline_v1', 'global');
                                }}
                              >
                                {t('dialog.paperdraw.optimizeGlobal')}
                              </MenuItem>
                            </Menu>
                          }
                        >
                          {t('dialog.paperdraw.engine.pipeline')}
                        </MenuItem>
                        <MenuItem
                          disabled={phase === 'optimizing'}
                          onSelect={() => {}}
                          submenu={
                            <Menu onSelect={() => setOptimizeMenuOpen(false)}>
                              <MenuItem
                                disabled={
                                  !canOptimizeSelection || phase === 'optimizing'
                                }
                                onSelect={() => {
                                  void handleOptimizeLayout('legacy_v2', 'selection');
                                }}
                              >
                                {t('dialog.paperdraw.optimizeSelection')}
                              </MenuItem>
                              <MenuItem
                                disabled={phase === 'optimizing'}
                                onSelect={() => {
                                  void handleOptimizeLayout('legacy_v2', 'global');
                                }}
                              >
                                {t('dialog.paperdraw.optimizeGlobal')}
                              </MenuItem>
                            </Menu>
                          }
                        >
                          {t('dialog.paperdraw.engine.legacy')}
                        </MenuItem>
                      </Menu>
                    </PopoverContent>
                  </Popover>
                  <button
                    className="paperdraw-btn paperdraw-btn-secondary"
                    onClick={insertToBoard}
                    disabled={phase === 'optimizing'}
                  >
                    {t('dialog.paperdraw.insert')}
                  </button>
                </>
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
              skipDisabled={hasSkipGuard}
              skipHint={
                hasSkipGuard ? t('dialog.paperdraw.qaStructureGuard') : null
              }
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

          {isDebugEnabled && (extraction || analysisResult) && (
            <PaperDrawDebugPanel
              extraction={extraction}
              analysis={analysisResult}
              layout={draftLayout}
            />
          )}
        </div>

        <div className="paperdraw-right-panel">
          {draftElements.length > 0 ? (
            <PaperDrawBoardPreview
              value={draftElements}
              onChange={setDraftElements}
              onSelectionChange={setSelectionState}
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
