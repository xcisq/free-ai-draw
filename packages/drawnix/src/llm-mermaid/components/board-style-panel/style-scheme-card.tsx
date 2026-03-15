import type { BoardStyleSchemeOption } from '../../types';

export interface StyleSchemeCardProps {
  scheme: BoardStyleSchemeOption;
  onPreview: (scheme: BoardStyleSchemeOption) => void;
  onClearPreview: () => void;
  onApply: (scheme: BoardStyleSchemeOption) => void;
}

export const StyleSchemeCard = ({
  scheme,
  onPreview,
  onClearPreview,
  onApply,
}: StyleSchemeCardProps) => {
  const styleKeys = Object.keys(scheme.styles);

  return (
    <button
      className="board-style-panel__scheme-card"
      onMouseEnter={() => onPreview(scheme)}
      onMouseLeave={onClearPreview}
      onFocus={() => onPreview(scheme)}
      onBlur={onClearPreview}
      onClick={() => onApply(scheme)}
      type="button"
    >
      <div className="board-style-panel__scheme-header">
        <strong>{scheme.name}</strong>
        <span>{styleKeys.length} 个分组</span>
      </div>
      <div className="board-style-panel__scheme-description">{scheme.description}</div>
      <div className="board-style-panel__scheme-tags">
        {styleKeys.length > 0
          ? styleKeys.map((key) => (
            <span key={key} className="board-style-panel__scheme-tag">
              {key}
            </span>
          ))
          : (
            <span className="board-style-panel__scheme-tag">基础样式</span>
          )}
      </div>
    </button>
  );
};
