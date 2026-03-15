/**
 * 预设引导表单组件
 * 收集布局方向、样式偏好、目标用途等预设信息
 */

import { useState } from 'react';
import { useI18n } from '../../../i18n';
import type { GenerationContext, LayoutDirection, UsageScenario, ThemePreset } from '../../types';
import './structured-input-form.scss';

export interface StructuredInputFormProps {
  onContextChange: (context: Partial<GenerationContext>) => void;
  disabled?: boolean;
}

export const StructuredInputForm = ({ onContextChange, disabled = false }: StructuredInputFormProps) => {
  const { t } = useI18n();
  const [context, setContext] = useState<Partial<GenerationContext>>({
    layoutDirection: 'LR',
    usageScenario: 'paper',
    theme: 'academic',
    nodeCount: 5,
    layoutArea: 'medium',
    density: 'balanced',
  });

  const updateContext = (updates: Partial<GenerationContext>) => {
    const newContext = { ...context, ...updates };
    setContext(newContext);
    onContextChange(newContext);
  };

  return (
    <div className="structured-input-form">
      <div className="form-row">
        <label className="form-label">布局方向</label>
        <div className="form-options">
          <button
            className={`form-option ${context.layoutDirection === 'LR' ? 'active' : ''}`}
            onClick={() => !disabled && updateContext({ layoutDirection: 'LR' })}
            disabled={disabled}
          >
            从左到右
          </button>
          <button
            className={`form-option ${context.layoutDirection === 'TB' ? 'active' : ''}`}
            onClick={() => !disabled && updateContext({ layoutDirection: 'TB' })}
            disabled={disabled}
          >
            从上到下
          </button>
        </div>
      </div>

      <div className="form-row">
        <label className="form-label">使用场景</label>
        <div className="form-options">
          <button
            className={`form-option ${context.usageScenario === 'paper' ? 'active' : ''}`}
            onClick={() => !disabled && updateContext({ usageScenario: 'paper' })}
            disabled={disabled}
          >
            论文插图
          </button>
          <button
            className={`form-option ${context.usageScenario === 'presentation' ? 'active' : ''}`}
            onClick={() => !disabled && updateContext({ usageScenario: 'presentation' })}
            disabled={disabled}
          >
            演示文稿
          </button>
          <button
            className={`form-option ${context.usageScenario === 'document' ? 'active' : ''}`}
            onClick={() => !disabled && updateContext({ usageScenario: 'document' })}
            disabled={disabled}
          >
            技术文档
          </button>
        </div>
      </div>

      <div className="form-row">
        <label className="form-label">样式风格</label>
        <div className="form-options">
          <button
            className={`form-option ${context.theme === 'professional' ? 'active' : ''}`}
            onClick={() => !disabled && updateContext({ theme: 'professional' })}
            disabled={disabled}
          >
            专业
          </button>
          <button
            className={`form-option ${context.theme === 'lively' ? 'active' : ''}`}
            onClick={() => !disabled && updateContext({ theme: 'lively' })}
            disabled={disabled}
          >
            活泼
          </button>
          <button
            className={`form-option ${context.theme === 'academic' ? 'active' : ''}`}
            onClick={() => !disabled && updateContext({ theme: 'academic' })}
            disabled={disabled}
          >
            学术
          </button>
          <button
            className={`form-option ${context.theme === 'minimal' ? 'active' : ''}`}
            onClick={() => !disabled && updateContext({ theme: 'minimal' })}
            disabled={disabled}
          >
            极简
          </button>
        </div>
      </div>

      <div className="form-row">
        <label className="form-label">密集程度</label>
        <div className="form-options">
          <button
            className={`form-option ${context.density === 'dense' ? 'active' : ''}`}
            onClick={() => !disabled && updateContext({ density: 'dense' })}
            disabled={disabled}
          >
            紧密
          </button>
          <button
            className={`form-option ${context.density === 'balanced' ? 'active' : ''}`}
            onClick={() => !disabled && updateContext({ density: 'balanced' })}
            disabled={disabled}
          >
            平衡
          </button>
          <button
            className={`form-option ${context.density === 'sparse' ? 'active' : ''}`}
            onClick={() => !disabled && updateContext({ density: 'sparse' })}
            disabled={disabled}
          >
            稀疏
          </button>
        </div>
      </div>
    </div>
  );
};
