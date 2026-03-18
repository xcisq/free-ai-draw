/**
 * 意图控制面板
 * 以快捷偏好和自然语言补充方式收集结构意图
 */

import type { GenerationContext, StructurePattern, ThemePreset, UsageScenario } from '../../types';
import './structured-input-form.scss';

export interface StructuredInputFormProps {
  context?: Partial<GenerationContext>;
  onContextChange: (context: Partial<GenerationContext>) => void;
  disabled?: boolean;
}

const DEFAULT_CONTEXT: Partial<GenerationContext> = {
  layoutDirection: 'LR',
  usageScenario: 'paper',
  theme: 'academic',
  nodeCount: 5,
  layoutArea: 'medium',
  density: 'balanced',
  structurePattern: 'mixed',
  layoutIntentText: '',
  emphasisTargets: [],
  clarificationStatus: 'none',
};

const STRUCTURE_OPTIONS: Array<{ value: StructurePattern; label: string; description: string }> = [
  { value: 'branched', label: '主干 + 分支', description: '主线清晰，局部带支路' },
  { value: 'convergent', label: '并行后汇聚', description: '多路处理后收束到结果' },
  { value: 'multi-lane', label: '上下辅轨', description: '主干之外还有上/下辅助带' },
  { value: 'feedback', label: '反馈回路', description: '包含回写、闭环或迭代' },
  { value: 'mixed', label: '混合结构', description: '允许组合多种局部结构' },
];

const USAGE_OPTIONS: Array<{ value: UsageScenario; label: string }> = [
  { value: 'paper', label: '论文插图' },
  { value: 'presentation', label: '演示文稿' },
  { value: 'document', label: '技术文档' },
];

const THEME_OPTIONS: Array<{ value: ThemePreset; label: string }> = [
  { value: 'academic', label: '学术' },
  { value: 'professional', label: '专业' },
  { value: 'minimal', label: '极简' },
  { value: 'lively', label: '活泼' },
];

export const StructuredInputForm = ({
  context,
  onContextChange,
  disabled = false,
}: StructuredInputFormProps) => {
  const mergedContext = {
    ...DEFAULT_CONTEXT,
    ...context,
  };

  const updateContext = (updates: Partial<GenerationContext>) => {
    onContextChange({
      ...mergedContext,
      ...updates,
    });
  };

  const emphasisValue = (mergedContext.emphasisTargets || []).join('，');

  return (
    <div className="structured-input-form">
      <div className="structured-input-header">
        <h3 className="structured-input-title">意图控制</h3>
        <p className="structured-input-subtitle">
          主阅读方向约束整体视觉趋势，局部结构仍可以并行、汇聚或上下分层。
        </p>
      </div>

      <section className="intent-card">
        <div className="intent-card-label">主阅读方向</div>
        <div className="chip-group">
          <button
            className={`chip ${mergedContext.layoutDirection === 'LR' ? 'active' : ''}`}
            onClick={() => !disabled && updateContext({ layoutDirection: 'LR' })}
            disabled={disabled}
          >
            整体从左到右
          </button>
          <button
            className={`chip ${mergedContext.layoutDirection === 'TB' ? 'active' : ''}`}
            onClick={() => !disabled && updateContext({ layoutDirection: 'TB' })}
            disabled={disabled}
          >
            整体从上到下
          </button>
        </div>
      </section>

      <section className="intent-card">
        <div className="intent-card-label">结构偏好</div>
        <div className="structure-grid">
          {STRUCTURE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`structure-option ${
                mergedContext.structurePattern === option.value ? 'active' : ''
              }`}
              onClick={() => !disabled && updateContext({ structurePattern: option.value })}
              disabled={disabled}
            >
              <span className="structure-option-label">{option.label}</span>
              <span className="structure-option-description">{option.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="intent-card">
        <div className="intent-card-label">使用场景</div>
        <div className="chip-group">
          {USAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`chip ${mergedContext.usageScenario === option.value ? 'active' : ''}`}
              onClick={() => !disabled && updateContext({ usageScenario: option.value })}
              disabled={disabled}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="intent-card">
        <div className="intent-card-label">风格与密度</div>
        <div className="chip-row">
          <div className="chip-group">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`chip ${mergedContext.theme === option.value ? 'active' : ''}`}
                onClick={() => !disabled && updateContext({ theme: option.value })}
                disabled={disabled}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="chip-group">
            {[
              ['dense', '紧凑'],
              ['balanced', '平衡'],
              ['sparse', '疏朗'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`chip ${mergedContext.density === value ? 'active' : ''}`}
                onClick={() =>
                  !disabled &&
                  updateContext({ density: value as GenerationContext['density'] })
                }
                disabled={disabled}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="intent-card">
        <label className="intent-card-label" htmlFor="layout-intent-text">
          补充构图要求
        </label>
        <textarea
          id="layout-intent-text"
          className="intent-textarea"
          value={mergedContext.layoutIntentText || ''}
          onChange={(event) => updateContext({ layoutIntentText: event.target.value })}
          disabled={disabled}
          placeholder="例如：整体从左到右，但中间两路并行，最后汇聚到评估模块。"
          rows={4}
        />
      </section>

      <section className="intent-card">
        <label className="intent-card-label" htmlFor="emphasis-targets">
          重点强调
        </label>
        <input
          id="emphasis-targets"
          className="intent-input"
          value={emphasisValue}
          onChange={(event) =>
            updateContext({
              emphasisTargets: event.target.value
                .split(/[，,、]/)
                .map((item) => item.trim())
                .filter(Boolean),
            })
          }
          disabled={disabled}
          placeholder="例如：评估阶段，核心方法，最终输出"
        />
      </section>
    </div>
  );
};
