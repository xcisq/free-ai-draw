export interface StyleInputProps {
  disabled?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void | Promise<void>;
}

export const StyleInput = ({
  disabled = false,
  value,
  onValueChange,
  onSubmit,
}: StyleInputProps) => {
  return (
    <div className="board-style-panel__input-row">
      <textarea
        className="board-style-panel__input"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder="先输入你的样式要求，例如：重点模块蓝色、标题更醒目、连线更清晰"
        disabled={disabled}
        rows={3}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter'
            && !event.shiftKey
            && !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            void onSubmit(value.trim());
          }
        }}
      />
      <button
        className="board-style-panel__submit"
        disabled={disabled || !value.trim()}
        onClick={() => void onSubmit(value.trim())}
      >
        生成
      </button>
    </div>
  );
};
