/**
 * Mermaid 代码视图组件
 * 显示和编辑 Mermaid 代码
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import './mermaid-code-view.scss';

export interface MermaidCodeViewProps {
  code: string;
  baselineCode?: string;
  onChange?: (code: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
}

export const MermaidCodeView = ({
  code,
  baselineCode,
  onChange,
  readOnly = false,
  disabled = false,
}: MermaidCodeViewProps) => {
  const [value, setValue] = useState(code);
  const [isCopied, setIsCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 同步外部 code 变化
  useEffect(() => {
    setValue(code);
  }, [code]);

  // 自动调整高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(textarea.scrollHeight, 200) + 'px';
    }
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      onChange?.(newValue);
    },
    [onChange]
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, [value]);

  const handleReset = useCallback(() => {
    const nextValue = baselineCode ?? code;
    setValue(nextValue);
    onChange?.(nextValue);
  }, [baselineCode, code, onChange]);

  return (
    <div className="mermaid-code-view">
      <div className="code-view-header">
        <span className="code-view-title">Mermaid 代码</span>
        <div className="code-view-actions">
          {!readOnly && (
            <button
              className="code-view-action"
              onClick={handleReset}
              disabled={disabled || value === (baselineCode ?? code)}
              aria-label="重置为原始代码"
              title="重置为原始代码"
            >
              <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M8 2L8 10M8 10L5 7M8 10L11 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <button
            className="code-view-action"
            onClick={handleCopy}
            disabled={disabled}
            aria-label={isCopied ? '已复制 Mermaid 代码' : '复制 Mermaid 代码'}
            title={isCopied ? '已复制!' : '复制代码'}
          >
            {isCopied ? (
              <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M4 8L6 10L12 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <rect
                  x="3"
                  y="5"
                  width="8"
                  height="9"
                  rx="1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                />
                <path
                  d="M6 5V3a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                />
              </svg>
            )}
          </button>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        readOnly={readOnly}
        disabled={disabled}
        className="code-view-textarea"
        spellCheck={false}
        placeholder="Mermaid 代码将显示在这里..."
      />
      <div className="code-view-footer">
        <span className="code-view-stats">
          {value.split('\n').length} 行 · {value.length} 字符
        </span>
      </div>
    </div>
  );
};
