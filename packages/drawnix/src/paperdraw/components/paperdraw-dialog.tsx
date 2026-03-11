/**
 * PaperDraw 主弹窗组件
 * 状态机管理：input → analyzing → qa → draft_flowchart
 */

import { useState, useCallback } from 'react';
import { useI18n } from '../../i18n';
import { useDrawnix } from '../../hooks/use-drawnix';
import {
  PaperDrawPhase,
  LLMConfig,
  ExtractionResult,
  AnalysisResult,
  CRSQuestion,
  CRSAnswer,
} from '../types/analyzer';
import {
  extractFromText,
  validateExtractionResult,
  generateQuestions,
  refineWithAnswers,
  generateDefaultAnalysis,
  validateAnalysisResult,
} from '../analyzer';
import { LLMConfigPanel } from './llm-config-panel';
import { CRSQAPanel } from './crs-qa-panel';
import './paperdraw-dialog.scss';

const LLM_CONFIG_STORAGE_KEY = 'paperdraw-llm-config';

function loadLLMConfig(): LLMConfig {
  try {
    const stored = localStorage.getItem(LLM_CONFIG_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  };
}

function saveLLMConfig(config: LLMConfig) {
  localStorage.setItem(LLM_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

const PaperDrawDialog = () => {
  const { t } = useI18n();
  const { appState, setAppState } = useDrawnix();

  const [phase, setPhase] = useState<PaperDrawPhase>('input');
  const [text, setText] = useState('');
  const [llmConfig, setLLMConfig] = useState<LLMConfig>(loadLLMConfig);
  const [error, setError] = useState<string | null>(null);

  // 分析结果
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [questions, setQuestions] = useState<CRSQuestion[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // 配置面板是否展开
  const [showConfig, setShowConfig] = useState(false);

  const handleConfigChange = useCallback((config: LLMConfig) => {
    setLLMConfig(config);
    saveLLMConfig(config);
  }, []);

  // 点击"分析"按钮
  const handleAnalyze = useCallback(async () => {
    if (!llmConfig.apiKey) {
      setError(t('dialog.paperdraw.error.noApiKey'));
      return;
    }
    if (!text.trim()) {
      return;
    }

    setError(null);
    setPhase('analyzing');

    try {
      // Step 1: LLM 提取实体和关系
      const rawResult = await extractFromText(text.trim(), llmConfig);
      const validResult = validateExtractionResult(rawResult);
      setExtraction(validResult);

      // Step 2: 生成 CRS QA 问题
      const qaQuestions = await generateQuestions(validResult, llmConfig);
      setQuestions(qaQuestions);

      setPhase('qa');
    } catch (err: any) {
      console.error('PaperDraw analysis failed:', err);
      setError(`${t('dialog.paperdraw.error.analyzeFailed')}: ${err.message}`);
      setPhase('input');
    }
  }, [text, llmConfig, t]);

  // CRS QA 完成
  const handleQAComplete = useCallback(
    async (answers: CRSAnswer[]) => {
      if (!extraction) return;

      setPhase('analyzing');
      setError(null);

      try {
        const rawResult = await refineWithAnswers(extraction, answers, questions, llmConfig);
        const validResult = validateAnalysisResult(rawResult);
        setAnalysisResult(validResult);
        setPhase('draft_flowchart');
      } catch (err: any) {
        console.error('PaperDraw refine failed:', err);
        setError(`${t('dialog.paperdraw.error.analyzeFailed')}: ${err.message}`);
        setPhase('qa');
      }
    },
    [extraction, questions, llmConfig, t]
  );

  // 跳过 QA
  const handleSkipQA = useCallback(async () => {
    if (!extraction) return;

    setPhase('analyzing');
    setError(null);

    try {
      const rawResult = await generateDefaultAnalysis(extraction, llmConfig);
      const validResult = validateAnalysisResult(rawResult);
      setAnalysisResult(validResult);
      setPhase('draft_flowchart');
    } catch (err: any) {
      console.error('PaperDraw skip QA failed:', err);
      setError(`${t('dialog.paperdraw.error.analyzeFailed')}: ${err.message}`);
      setPhase('qa');
    }
  }, [extraction, llmConfig, t]);

  return (
    <div className="paperdraw-dialog">
      <div className="paperdraw-dialog-desc">{t('dialog.paperdraw.description')}</div>

      {error && <div className="paperdraw-error">{error}</div>}

      {/* LLM 配置 */}
      <div className="paperdraw-config-toggle">
        <button
          className="paperdraw-btn paperdraw-btn-text"
          onClick={() => setShowConfig(!showConfig)}
        >
          {t('dialog.paperdraw.configTitle')} {showConfig ? '▲' : '▼'}
        </button>
      </div>
      {showConfig && (
        <LLMConfigPanel config={llmConfig} onChange={handleConfigChange} />
      )}

      {/* 阶段: input */}
      {(phase === 'input' || phase === 'analyzing') && (
        <div className="paperdraw-input-section">
          <textarea
            className="paperdraw-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
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
          </div>
        </div>
      )}

      {/* 阶段: qa */}
      {phase === 'qa' && questions.length > 0 && (
        <CRSQAPanel
          questions={questions}
          onComplete={handleQAComplete}
          onSkip={handleSkipQA}
        />
      )}

      {/* 阶段: draft_flowchart - 占位，后续阶段实现基础布局 */}
      {phase === 'draft_flowchart' && analysisResult && (
        <div className="paperdraw-draft-section">
          <div className="paperdraw-draft-placeholder">
            <h3>✅ 分析完成</h3>
            <p>
              提取到 <strong>{analysisResult.entities.length}</strong> 个实体，
              <strong>{analysisResult.relations.length}</strong> 个关系，
              <strong>{analysisResult.modules.length}</strong> 个模块
            </p>
            <div className="paperdraw-analysis-preview">
              <h4>实体列表:</h4>
              <ul>
                {analysisResult.entities.map((e) => (
                  <li key={e.id}>
                    <span className="entity-label">{e.label}</span>
                    <span className="entity-weight">
                      {' '}
                      (权重: {(analysisResult.weights[e.id] ?? 0.5).toFixed(2)})
                    </span>
                  </li>
                ))}
              </ul>
              {analysisResult.modules.length > 0 && (
                <>
                  <h4>模块分组:</h4>
                  <ul>
                    {analysisResult.modules.map((m) => (
                      <li key={m.id}>
                        <strong>{m.moduleLabel}</strong>:{' '}
                        {m.entityIds
                          .map(
                            (eid) =>
                              analysisResult.entities.find((e) => e.id === eid)
                                ?.label ?? eid
                          )
                          .join(', ')}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
          <div className="paperdraw-actions">
            <p className="paperdraw-hint">
              流程图渲染将在布局模块实现后可用
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaperDrawDialog;
