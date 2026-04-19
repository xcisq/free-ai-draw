import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { ToolButton } from '../../tool-button';
import {
  AlignBottomIcon,
  AlignCenterIcon,
  AlignLeftIcon,
  AlignMiddleIcon,
  AlignRightIcon,
  AlignTopIcon,
  ArrangeIcon,
  DistributeHorizontalIcon,
  DistributeVerticalIcon,
} from '../../icons';
import { Popover, PopoverContent, PopoverTrigger } from '../../popover/popover';
import { useI18n } from '../../../i18n';
import { getSelectedElements, PlaitBoard } from '@plait/core';
import {
  alignSelection,
  canArrangeSelection,
  canDistributeSelection,
  type AlignType,
  type DistributeType,
  getArrangeableSelectionCount,
  distributeSelection,
} from '../../../transforms/arrange';
import { isBackgroundLayerElement } from '../../../utils/background-layer';

export type ArrangeButtonProps = {
  board: PlaitBoard;
};

const ALIGN_ACTIONS: {
  key: AlignType;
  icon: React.ReactNode;
  labelKey:
    | 'general.alignLeft'
    | 'general.alignCenter'
    | 'general.alignRight'
    | 'general.alignTop'
    | 'general.alignMiddle'
    | 'general.alignBottom';
}[] = [
  { key: 'left', icon: AlignLeftIcon, labelKey: 'general.alignLeft' },
  { key: 'center', icon: AlignCenterIcon, labelKey: 'general.alignCenter' },
  { key: 'right', icon: AlignRightIcon, labelKey: 'general.alignRight' },
  { key: 'top', icon: AlignTopIcon, labelKey: 'general.alignTop' },
  { key: 'middle', icon: AlignMiddleIcon, labelKey: 'general.alignMiddle' },
  { key: 'bottom', icon: AlignBottomIcon, labelKey: 'general.alignBottom' },
];

const DISTRIBUTE_ACTIONS: {
  key: DistributeType;
  icon: React.ReactNode;
  labelKey: 'general.distributeHorizontally' | 'general.distributeVertically';
}[] = [
  {
    key: 'horizontal',
    icon: DistributeHorizontalIcon,
    labelKey: 'general.distributeHorizontally',
  },
  {
    key: 'vertical',
    icon: DistributeVerticalIcon,
    labelKey: 'general.distributeVertically',
  },
];

export const ArrangeButton: React.FC<ArrangeButtonProps> = ({ board }) => {
  const { t } = useI18n();
  const container = PlaitBoard.getBoardContainer(board);
  const [open, setOpen] = useState(false);
  const arrangeableCount = getArrangeableSelectionCount(board);
  const disabled =
    PlaitBoard.isReadonly(board) ||
    !canArrangeSelection(board) ||
    getSelectedElements(board).some((element) =>
      isBackgroundLayerElement(element)
    );
  const showDistribute = canDistributeSelection(board);
  const scopeLabel =
    arrangeableCount > 1
      ? t('general.alignToSelection')
      : t('general.alignToCanvas');

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  return (
    <Popover
      sideOffset={12}
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
    >
      <PopoverTrigger asChild>
        <ToolButton
          className={classNames('property-button', 'popup-arrange-trigger')}
          visible={true}
          selected={open}
          icon={ArrangeIcon}
          type="icon"
          title={t('general.arrange')}
          aria-label={t('general.arrange')}
          disabled={disabled}
          onPointerDown={() => {
            if (!disabled) {
              setOpen(!open);
            }
          }}
        />
      </PopoverTrigger>
      <PopoverContent
        container={container}
        className={classNames('popup-arrange-panel')}
      >
        <div className="popup-arrange-panel__header">
          <div className="popup-arrange-panel__title">
            {t('general.arrange')}
          </div>
          <div className="popup-arrange-panel__scope">{scopeLabel}</div>
        </div>
        <div
          className="popup-arrange-grid"
          role="group"
          aria-label={t('general.arrange')}
        >
          {ALIGN_ACTIONS.map((action) => (
            <button
              key={action.key}
              type="button"
              className="popup-arrange-grid__action"
              aria-label={t(action.labelKey)}
              title={t(action.labelKey)}
              onClick={() => {
                alignSelection(board, action.key);
              }}
            >
              <span className="popup-arrange-grid__icon">{action.icon}</span>
              <span className="popup-arrange-grid__label">
                {t(action.labelKey)}
              </span>
            </button>
          ))}
        </div>
        {showDistribute && (
          <>
            <div className="popup-arrange-panel__divider" />
            <div className="popup-arrange-panel__subheading">
              {t('general.distribute')}
            </div>
            <div
              className="popup-arrange-grid popup-arrange-grid--distribution"
              role="group"
              aria-label={t('general.distribute')}
            >
              {DISTRIBUTE_ACTIONS.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className="popup-arrange-grid__action"
                  aria-label={t(action.labelKey)}
                  title={t(action.labelKey)}
                  onClick={() => {
                    distributeSelection(board, action.key);
                  }}
                >
                  <span className="popup-arrange-grid__icon">
                    {action.icon}
                  </span>
                  <span className="popup-arrange-grid__label">
                    {t(action.labelKey)}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
