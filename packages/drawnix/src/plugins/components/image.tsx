import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { ImageProps } from '@plait/common';
import classNames from 'classnames';
import { i18nInsidePlaitHook } from '../../i18n';
import { useImageGenerationTask } from '../../image-edit/image-generation-store';
import {
  applyImageEraseMask,
  buildImageEraseCacheKey,
} from '../../utils/image-erase';
import { DrawnixImageEraseMask } from '../../utils/image-element';

export const Image: React.FC<ImageProps> = (props: ImageProps) => {
  const { t } = i18nInsidePlaitHook();
  const targetId = (props.element as { id?: string }).id || null;
  const generationTask = useImageGenerationTask(targetId);
  const sourceUrl = props.imageItem.url;
  const eraseMask = (props.element as { eraseMask?: DrawnixImageEraseMask })
    .eraseMask;
  const eraseCacheKey = useMemo(() => {
    return buildImageEraseCacheKey(sourceUrl, eraseMask);
  }, [eraseMask, sourceUrl]);
  const [renderedUrl, setRenderedUrl] = useState(sourceUrl);

  useEffect(() => {
    let cancelled = false;

    if (!eraseMask?.strokes.length) {
      setRenderedUrl(sourceUrl);
      return;
    }

    setRenderedUrl(sourceUrl);
    void applyImageEraseMask(sourceUrl, eraseMask)
      .then((nextUrl) => {
        if (!cancelled) {
          setRenderedUrl(nextUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRenderedUrl(sourceUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eraseCacheKey, eraseMask, sourceUrl]);

  const imageContainerStyle: CSSProperties = {
    display: 'flex',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  };
  const imageStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  };
  const imgProps = {
    src: renderedUrl,
    draggable: false,
    width: '100%',
    style: imageStyle,
  };
  return (
    <div
      className={classNames('drawnix-image', {
        'drawnix-image--generating': !!generationTask,
      })}
      data-image-id={targetId || undefined}
      data-image-status={generationTask?.status || undefined}
      style={imageContainerStyle}
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
