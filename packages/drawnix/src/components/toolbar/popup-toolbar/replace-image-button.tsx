import React from 'react';
import { ToolButton } from '../../tool-button';
import { ImageIcon } from '../../icons';
import { useI18n } from '../../../i18n';
import { fileOpen } from '../../../data/filesystem';
import { IMAGE_MIME_TYPES } from '../../../constants';
import { getDataURL } from '../../../data/blob';
import type { PlaitBoard } from '@plait/core';
import { replaceImageElementUrl } from '../../../utils/image-element';

export interface ReplaceImageButtonProps {
  board: PlaitBoard;
  targetId: string;
}

export const ReplaceImageButton: React.FC<ReplaceImageButtonProps> = ({
  board,
  targetId,
}) => {
  const { t } = useI18n();
  const title = t('popupToolbar.replaceImage');

  return (
    <ToolButton
      type="icon"
      visible={true}
      className="popup-ai-style-button popup-replace-image-button"
      icon={ImageIcon}
      title={title}
      aria-label={title}
      showAriaLabel={true}
      onClick={async () => {
        try {
          const imageFile = await fileOpen({
            description: 'Image',
            extensions: Object.keys(
              IMAGE_MIME_TYPES
            ) as (keyof typeof IMAGE_MIME_TYPES)[],
          });
          const dataUrl = await getDataURL(imageFile);
          replaceImageElementUrl(board, targetId, dataUrl);
        } catch (error: any) {
          if (error?.name === 'AbortError') {
            return;
          }
          throw error;
        }
      }}
    />
  );
};
