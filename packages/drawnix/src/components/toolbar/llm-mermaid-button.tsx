import { useBoard } from '@plait-board/react-board';
import { Popover, PopoverContent, PopoverTrigger } from '../popover/popover';
import { PlaitBoard } from '@plait/core';
import { useState } from 'react';
import { ToolButton } from '../tool-button';
import { AIMermaidIcon } from '../icons';
import { useI18n } from '../../i18n';
import { useDrawnix, DialogType } from '../../hooks/use-drawnix';
import './llm-mermaid-button.scss';

export const LLMMermaidButton = () => {
  const board = useBoard();
  const { t } = useI18n();
  const { appState, setAppState } = useDrawnix();
  const container = PlaitBoard.getBoardContainer(board);
  const [menuOpen, setMenuOpen] = useState(false);
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
      selected={isOpen}
      icon={AIMermaidIcon}
      title={t('toolbar.llmMermaid') || 'AI Pipeline'}
      aria-label={t('toolbar.llmMermaid') || 'AI Pipeline'}
      onPointerDown={() => {
        if (isOpen) {
          handleClose();
        } else {
          handleOpen();
        }
      }}
    />
  );
};
