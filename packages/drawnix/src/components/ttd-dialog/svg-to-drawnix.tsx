import { useMemo, useRef, useState } from 'react';
import './ttd-dialog.scss';
import { TTDDialogPanels } from './ttd-dialog-panels';
import { TTDDialogPanel } from './ttd-dialog-panel';
import { TTDDialogInput } from './ttd-dialog-input';
import { TTDDialogOutput } from './ttd-dialog-output';
import { TTDDialogSubmitShortcut } from './ttd-dialog-submit-shortcut';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import { useBoard } from '@plait-board/react-board';
import {
  getViewportOrigination,
  PlaitBoard,
  PlaitElement,
  PlaitGroupElement,
  Point,
  RectangleClient,
  WritableClipboardOperationType,
} from '@plait/core';
import {
  convertSvgAssetPackageToDrawnix,
  type SvgImportSummary,
} from '../../svg-import/convert-svg-to-drawnix';
import { parseSvgAssetPackage } from '../../svg-import/parse-svg-package';

const emptySummary: SvgImportSummary = {
  textCount: 0,
  arrowCount: 0,
  componentCount: 0,
  ignoredBackgroundCount: 0,
  warnings: [],
};

const SvgToDrawnix = () => {
  const { appState, setAppState } = useDrawnix();
  const { t } = useI18n();
  const board = useBoard();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileDescription, setFileDescription] = useState('');
  const [value, setValue] = useState<PlaitElement[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [summary, setSummary] = useState<SvgImportSummary>(emptySummary);

  const insertToBoard = () => {
    if (!value.length) {
      return;
    }

    const boardContainerRect =
      PlaitBoard.getBoardContainer(board).getBoundingClientRect();
    const focusPoint = [
      boardContainerRect.width / 2,
      boardContainerRect.height / 2,
    ];
    const zoom = board.viewport.zoom;
    const origination = getViewportOrigination(board);
    const centerX = origination![0] + focusPoint[0] / zoom;
    const centerY = origination![1] + focusPoint[1] / zoom;
    const elements = value;
    const elementRectangle = RectangleClient.getBoundingRectangle(
      elements
        .filter((ele) => !PlaitGroupElement.isGroup(ele))
        .map((ele) =>
          RectangleClient.getRectangleByPoints(ele.points as Point[])
        )
    );
    const startPoint = [
      centerX - elementRectangle.width / 2,
      centerY - elementRectangle.height / 2,
    ] as Point;

    board.insertFragment(
      {
        elements: JSON.parse(JSON.stringify(elements)),
      },
      startPoint,
      WritableClipboardOperationType.paste
    );
    setAppState({ ...appState, openDialogType: null });
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const assetPackage = await parseSvgAssetPackage(file);
      const result = convertSvgAssetPackageToDrawnix(assetPackage);
      setValue(result.elements);
      setSummary(result.summary);
      setError(null);
      setFileDescription(
        [
          file.name,
          `SVG: ${assetPackage.fileName}`,
          `components: ${Object.keys(assetPackage.componentAssets).length}`,
        ].join('\n')
      );
    } catch (err) {
      setValue([]);
      setSummary(emptySummary);
      setFileDescription(file.name);
      setError(
        err instanceof Error
          ? err
          : new Error(t('dialog.svg.error.invalidSvg'))
      );
    }

    event.target.value = '';
  };

  const summaryText = useMemo(() => {
    return [
      `${t('dialog.svg.summary.texts')}: ${summary.textCount}`,
      `${t('dialog.svg.summary.arrows')}: ${summary.arrowCount}`,
      `${t('dialog.svg.summary.components')}: ${summary.componentCount}`,
      `${t('dialog.svg.summary.backgrounds')}: ${summary.ignoredBackgroundCount}`,
    ].join(' · ');
  }, [summary, t]);

  return (
    <>
      <div className="ttd-dialog-desc">
        {t('dialog.svg.description')}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={handlePickFile}>
            {t('dialog.svg.upload')}
          </button>
          <span style={{ opacity: 0.7 }}>{summaryText}</span>
        </div>
        {!!summary.warnings.length && (
          <div style={{ marginTop: 8, opacity: 0.8 }}>
            {summary.warnings.join(' ')}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={handleFileChange}
        />
      </div>
      <TTDDialogPanels>
        <TTDDialogPanel label={t('dialog.svg.syntax')}>
          <TTDDialogInput
            input={fileDescription}
            placeholder={t('dialog.svg.placeholder')}
            onChange={() => undefined}
            onKeyboardSubmit={() => {
              insertToBoard();
            }}
          />
        </TTDDialogPanel>
        <TTDDialogPanel
          label={t('dialog.svg.preview')}
          panelAction={{
            action: () => {
              insertToBoard();
            },
            label: t('dialog.svg.insert'),
          }}
          renderSubmitShortcut={() => <TTDDialogSubmitShortcut />}
        >
          <TTDDialogOutput
            value={value}
            loaded={true}
            error={error}
          />
        </TTDDialogPanel>
      </TTDDialogPanels>
    </>
  );
};

export default SvgToDrawnix;
