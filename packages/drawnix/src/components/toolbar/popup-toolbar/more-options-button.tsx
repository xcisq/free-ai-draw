import React from 'react';
import { ToolButton } from '../../tool-button';
import classNames from 'classnames';
import { useI18n } from '../../../i18n';
import {
  canSetZIndex,
  deleteFragment,
  duplicateElements,
  getSelectedElements,
  PlaitBoard,
} from '@plait/core';
import {
  BringForwardIcon,
  BringToFrontIcon,
  DuplicateIcon,
  LayerOrderIcon,
  MoreOptionsIcon,
  SendBackwardIcon,
  SendToBackIcon,
  TrashIcon,
} from '../../icons';
import { Popover, PopoverContent, PopoverTrigger } from '../../popover/popover';
import Menu from '../../menu/menu';
import MenuItem from '../../menu/menu-item';
import { useState } from 'react';
import { getShortcutKey } from '../../../utils/common';
import {
  isBackgroundLayerElement,
  moveSelectionOneStepPreservingBackground,
  moveSelectionToEdgePreservingBackground,
} from '../../../utils/background-layer';

export type MoreOptionsButtonProps = {
  board: PlaitBoard;
};

export const MoreOptionsButton: React.FC<MoreOptionsButtonProps> = ({
  board,
}) => {
  const { t } = useI18n();
  const container = PlaitBoard.getBoardContainer(board);
  const [menuOpen, setMenuOpen] = useState(false);
  const hasBackgroundSelection = getSelectedElements(board).some((element) =>
    isBackgroundLayerElement(element)
  );
  const canReorderLayer =
    !PlaitBoard.isReadonly(board) &&
    canSetZIndex(board) &&
    !hasBackgroundSelection;

  const layerMenu = (
    <Menu
      className={classNames('popup-toolbar-layer-order-menu')}
      onSelect={() => {
        setMenuOpen(false);
      }}
    >
      <MenuItem
        onSelect={() => {
          moveSelectionOneStepPreservingBackground(board, 'up');
        }}
        icon={BringForwardIcon}
        shortcut={getShortcutKey('CtrlOrCmd+]')}
        aria-label={t('general.bringForward')}
      >
        {t('general.bringForward')}
      </MenuItem>
      <MenuItem
        onSelect={() => {
          moveSelectionOneStepPreservingBackground(board, 'down');
        }}
        icon={SendBackwardIcon}
        shortcut={getShortcutKey('CtrlOrCmd+[')}
        aria-label={t('general.sendBackward')}
      >
        {t('general.sendBackward')}
      </MenuItem>
      <MenuItem
        onSelect={() => {
          moveSelectionToEdgePreservingBackground(board, 'up');
        }}
        icon={BringToFrontIcon}
        aria-label={t('general.bringToFront')}
      >
        {t('general.bringToFront')}
      </MenuItem>
      <MenuItem
        onSelect={() => {
          moveSelectionToEdgePreservingBackground(board, 'down');
        }}
        icon={SendToBackIcon}
        aria-label={t('general.sendToBack')}
      >
        {t('general.sendToBack')}
      </MenuItem>
    </Menu>
  );

  return (
    <Popover
      sideOffset={12}
      open={menuOpen}
      onOpenChange={(open) => {
        setMenuOpen(open);
      }}
      placement="bottom-start"
    >
      <PopoverTrigger asChild>
        <ToolButton
          className={classNames('property-button')}
          visible={true}
          selected={menuOpen}
          icon={MoreOptionsIcon}
          type="icon"
          title={t('general.moreOptions')}
          aria-label={t('general.moreOptions')}
          onPointerDown={() => {
            setMenuOpen(!menuOpen);
          }}
        />
      </PopoverTrigger>
      <PopoverContent container={container}>
        <Menu
          className={classNames('popup-toolbar-more-options-menu')}
          onSelect={() => {
            setMenuOpen(false);
          }}
        >
          <MenuItem
            onSelect={() => {
              duplicateElements(board);
            }}
            icon={DuplicateIcon}
            shortcut={getShortcutKey('CtrlOrCmd+D')}
            aria-label={t('general.duplicate')}
          >
            {t('general.duplicate')}
          </MenuItem>
          <MenuItem
            onSelect={() => {}}
            icon={LayerOrderIcon}
            aria-label={t('general.layerOrder')}
            disabled={!canReorderLayer}
            submenu={layerMenu}
          >
            {t('general.layerOrder')}
          </MenuItem>
          <MenuItem
            onSelect={() => {
              deleteFragment(board);
            }}
            icon={TrashIcon}
            shortcut={getShortcutKey('Backspace')}
            aria-label={t('general.delete')}
          >
            {t('general.delete')}
          </MenuItem>
        </Menu>
      </PopoverContent>
    </Popover>
  );
};
