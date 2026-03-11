/**
 * CRS QA 交互面板
 * 渲染 LLM 生成的 QA 问题，收集用户回答
 */

import { useState, useCallback } from 'react';
import { useI18n } from '../../i18n';
import { CRSQuestion, CRSAnswer } from '../types/analyzer';

interface CRSQAPanelProps {
  questions: CRSQuestion[];
  onComplete: (answers: CRSAnswer[]) => void;
  onSkip: () => void;
}

export const CRSQAPanel = ({ questions, onComplete, onSkip }: CRSQAPanelProps) => {
  const { t } = useI18n();
  const [answers, setAnswers] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const q of questions) {
      initial[q.id] = [];
    }
    return initial;
  });

  const toggleOption = useCallback(
    (questionId: string, option: string, multiSelect: boolean) => {
      setAnswers((prev) => {
        const current = prev[questionId] || [];
        if (multiSelect) {
          // 多选：toggle
          const next = current.includes(option)
            ? current.filter((o) => o !== option)
            : [...current, option];
          return { ...prev, [questionId]: next };
        } else {
          // 单选
          return { ...prev, [questionId]: [option] };
        }
      });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    const crsAnswers: CRSAnswer[] = questions.map((q) => ({
      questionId: q.id,
      selectedOptions: answers[q.id] || [],
    }));
    onComplete(crsAnswers);
  }, [questions, answers, onComplete]);

  return (
    <div className="paperdraw-qa-section">
      <h3 className="paperdraw-qa-title">{t('dialog.paperdraw.qaTitle')}</h3>
      {questions.map((q) => (
        <div key={q.id} className="paperdraw-qa-card">
          <p className="paperdraw-qa-question">{q.question}</p>
          <div className="paperdraw-qa-options">
            {q.options.map((opt) => {
              const selected = (answers[q.id] || []).includes(opt);
              return (
                <button
                  key={opt}
                  className={`paperdraw-qa-option ${selected ? 'selected' : ''}`}
                  onClick={() => toggleOption(q.id, opt, q.multiSelect)}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="paperdraw-actions">
        <button
          className="paperdraw-btn paperdraw-btn-secondary"
          onClick={onSkip}
        >
          {t('dialog.paperdraw.skip')}
        </button>
        <button
          className="paperdraw-btn paperdraw-btn-primary"
          onClick={handleConfirm}
        >
          {t('dialog.paperdraw.confirm')}
        </button>
      </div>
    </div>
  );
};
