import React from 'react';
import { ToolButton } from '../../tool-button';
import classNames from 'classnames';
import { PropertyTransforms } from '@plait/common';
import { getMemorizeKey, PlaitDrawElement } from '@plait/draw';
import { ArrowAnimationIcon } from '../../icons';
import { useI18n } from '../../../i18n';
import type { PlaitBoard } from '@plait/core';
import {
  DRAWNIX_ARROW_ANIMATION_FLOW,
  DrawnixAnimatedArrowLine,
  isArrowAnimationEnabled,
} from '../../../plugins/with-arrow-animation';

export type ArrowAnimationButtonProps = {
  board: PlaitBoard;
  animation?: DrawnixAnimatedArrowLine['drawnixArrowAnimation'];
};

export const ArrowAnimationButton: React.FC<ArrowAnimationButtonProps> = ({
  board,
  animation,
}) => {
  const { t } = useI18n();
  const enabled = isArrowAnimationEnabled({ drawnixArrowAnimation: animation });
  const title = enabled
    ? t('line.disableAnimation')
    : t('line.enableAnimation');

  return (
    <ToolButton
      className={classNames(
        'property-button',
        'popup-arrow-animation-button',
        {
          'popup-arrow-animation-button--enabled': enabled,
        }
      )}
      visible={true}
      icon={ArrowAnimationIcon}
      type="icon"
      title={title}
      aria-label={title}
      selected={enabled}
      onClick={() => {
        const nextAnimation = enabled
          ? undefined
          : DRAWNIX_ARROW_ANIMATION_FLOW;
        PropertyTransforms.setProperty<DrawnixAnimatedArrowLine>(
          board,
          {
            drawnixArrowAnimation: nextAnimation,
          },
          {
            getMemorizeKey: (element) => getMemorizeKey(element),
            match: (element) => PlaitDrawElement.isArrowLine(element),
          }
        );
      }}
    />
  );
};
