import { ToolButton } from '../tool-button';
import { AIMermaidIcon } from '../icons';
import { useI18n } from '../../i18n';
import { useDrawnix, DialogType } from '../../hooks/use-drawnix';
import './llm-mermaid-button.scss';

export const LLMMermaidButton = () => {
  const { t } = useI18n();
  const { appState, setAppState } = useDrawnix();
  const label = t('toolbar.llmMermaid') || 'AI Pipeline';
  const isOpen = appState.openDialogType === DialogType.llmMermaid;

  const handleOpen = () => {
    setAppState({
      ...appState,
      openDialogType: DialogType.llmMermaid,
    });
  };

  const handleClose = () => {
    setAppState({
      ...appState,
      openDialogType: null,
    });
  };

  return (
    <ToolButton
      type="icon"
      visible={true}
      className="llm-mermaid-button"
      selected={isOpen}
      icon={AIMermaidIcon}
      title={label}
      aria-label={label}
      showAriaLabel={true}
      onClick={() => {
        if (isOpen) {
          handleClose();
        } else {
          handleOpen();
        }
      }}
    />
  );
};
