import React from 'react';
import { ToolButton } from '../../tool-button';
import { AIImageEditIcon } from '../../icons';
import { useI18n } from '../../../i18n';
import { DialogType, useDrawnix } from '../../../hooks/use-drawnix';

export interface AIImageEditButtonProps {
  targetId: string;
}

export const AIImageEditButton: React.FC<AIImageEditButtonProps> = ({
  targetId,
}) => {
  const { t } = useI18n();
  const { appState, setAppState } = useDrawnix();
  const title = t('popupToolbar.aiEditImage');

  return (
    <ToolButton
      type="icon"
      visible={true}
      className="popup-ai-style-button popup-ai-image-edit-button"
      icon={AIImageEditIcon}
      title={title}
      aria-label={title}
      showAriaLabel={true}
      onClick={() => {
        setAppState({
          ...appState,
          imageEditTargetId: targetId,
          openDialogType: DialogType.imageEdit,
        });
      }}
    />
  );
};
