/**
 * LLM 配置面板
 * API Key / Base URL / Model 输入，持久化到 localStorage
 */

import { useI18n } from '../../i18n';
import { LLMConfig } from '../types/analyzer';

interface LLMConfigPanelProps {
  config: LLMConfig;
  onChange: (config: LLMConfig) => void;
}

export const LLMConfigPanel = ({ config, onChange }: LLMConfigPanelProps) => {
  const { t } = useI18n();

  return (
    <div className="paperdraw-config">
      <div className="paperdraw-config-field">
        <label>{t('dialog.paperdraw.apiKey')}</label>
        <input
          type="password"
          value={config.apiKey}
          onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
          placeholder="sk-..."
        />
      </div>
      <div className="paperdraw-config-field">
        <label>{t('dialog.paperdraw.baseUrl')}</label>
        <input
          type="text"
          value={config.baseUrl}
          onChange={(e) => onChange({ ...config, baseUrl: e.target.value })}
          placeholder="https://api.openai.com/v1"
        />
      </div>
      <div className="paperdraw-config-field">
        <label>{t('dialog.paperdraw.model')}</label>
        <input
          type="text"
          value={config.model}
          onChange={(e) => onChange({ ...config, model: e.target.value })}
          placeholder="gpt-4o"
        />
      </div>
    </div>
  );
};
