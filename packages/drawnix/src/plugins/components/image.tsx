import type { ImageProps } from '@plait/common';
import classNames from 'classnames';
import { i18nInsidePlaitHook } from '../../i18n';
import { useImageGenerationTask } from '../../image-edit/image-generation-store';

export const Image: React.FC<ImageProps> = (props: ImageProps) => {
  const { t } = i18nInsidePlaitHook();
  const targetId = (props.element as { id?: string }).id || null;
  const generationTask = useImageGenerationTask(targetId);
  const imgProps = {
    src: props.imageItem.url,
    draggable: false,
    width: '100%',
  };
  return (
    <div
      className={classNames('drawnix-image', {
        'drawnix-image--generating': !!generationTask,
      })}
      data-image-id={targetId || undefined}
      data-image-status={generationTask?.status || undefined}
      style={{ display: 'flex' }}
    >
      <img
        {...imgProps}
        className={classNames('image-origin', {
          'image-origin--focus': props.isFocus,
        })}
      />
      <div className="drawnix-image__generation-mask" aria-hidden="true">
        <div className="drawnix-image__generation-backdrop"></div>
        <div className="drawnix-image__generation-glow"></div>
        <div className="drawnix-image__generation-spectrum"></div>
        <div className="drawnix-image__generation-scan"></div>
        <div className="drawnix-image__generation-grain"></div>
        <div className="drawnix-image__generation-badge">
          <span className="drawnix-image__generation-dot"></span>
          <span className="drawnix-image__generation-label">
            {t('dialog.imageEdit.overlayLabel')}
          </span>
        </div>
      </div>
    </div>
  );
};
