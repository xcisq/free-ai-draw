import React, { useState } from 'react';
import classNames from 'classnames';
import { ATTACHED_ELEMENT_CLASS_NAME, PlaitBoard } from '@plait/core';
import { Island } from '../../island';
import Stack from '../../stack';
import { useI18n } from '../../../i18n';
import {
  applyIconLibraryAsset,
  IconLibraryAsset,
  loadIconLibraryAssetsFromFiles,
  loadStoredIconLibraryAssets,
  pickIconLibraryFiles,
  saveStoredIconLibraryAssets,
} from '../../../utils/icon-library';
import './icon-library-panel.scss';

export interface IconLibraryPanelProps {
  board: PlaitBoard;
}

const isAbortLikeError = (error: unknown) => {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
};

export const IconLibraryPanel: React.FC<IconLibraryPanelProps> = ({ board }) => {
  const { t } = useI18n();
  const [assets, setAssets] = useState<IconLibraryAsset[]>(() =>
    loadStoredIconLibraryAssets()
  );
  const [isUploading, setIsUploading] = useState(false);

  const setAndPersistAssets = (updater: (currentAssets: IconLibraryAsset[]) => IconLibraryAsset[]) => {
    setAssets((currentAssets) => {
      const nextAssets = updater(currentAssets);
      saveStoredIconLibraryAssets(nextAssets);
      return nextAssets;
    });
  };

  const handleUpload = async () => {
    try {
      setIsUploading(true);
      const files = await pickIconLibraryFiles();
      const nextAssets = await loadIconLibraryAssetsFromFiles(files);
      if (!nextAssets.length) {
        return;
      }
      setAndPersistAssets((currentAssets) => [...nextAssets, ...currentAssets]);
    } catch (error) {
      if (!isAbortLikeError(error)) {
        throw error;
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = (assetId: string) => {
    setAndPersistAssets((currentAssets) =>
      currentAssets.filter((asset) => asset.id !== assetId)
    );
  };

  return (
    <Island
      padding={4}
      className={classNames(
        ATTACHED_ELEMENT_CLASS_NAME,
        'icon-library-panel'
      )}
    >
      <Stack.Col gap={3}>
        <div className="icon-library-panel__header">
          <div className="icon-library-panel__heading">
            <div className="icon-library-panel__title">
              {t('toolbar.iconLibrary')}
            </div>
            <div className="icon-library-panel__hint">
              {t('iconLibrary.hint')}
            </div>
          </div>
          <button
            type="button"
            className="icon-library-panel__upload"
            onClick={() => {
              void handleUpload();
            }}
            disabled={isUploading}
          >
            {isUploading ? t('iconLibrary.uploading') : t('iconLibrary.upload')}
          </button>
        </div>

        {!assets.length && (
          <div className="icon-library-panel__empty">
            {t('iconLibrary.empty')}
          </div>
        )}

        {!!assets.length && (
          <div className="icon-library-panel__grid">
            {assets.map((asset) => {
              return (
                <div key={asset.id} className="icon-library-panel__card">
                  <button
                    type="button"
                    className="icon-library-panel__item"
                    onClick={() => {
                      applyIconLibraryAsset(board, asset);
                    }}
                    title={asset.name}
                    aria-label={asset.name}
                  >
                    <div className="icon-library-panel__preview">
                      <img src={asset.url} alt={asset.name} />
                    </div>
                    <div className="icon-library-panel__name">{asset.name}</div>
                  </button>
                  <button
                    type="button"
                    className="icon-library-panel__remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRemove(asset.id);
                    }}
                    aria-label={`${t('iconLibrary.remove')} ${asset.name}`}
                    title={t('iconLibrary.remove')}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Stack.Col>
    </Island>
  );
};
