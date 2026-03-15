import { useBoard } from '@plait-board/react-board';
import {
  ATTACHED_ELEMENT_CLASS_NAME,
  getSelectedElements,
  PlaitBoard,
} from '@plait/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AIMermaidIcon } from '../../components/icons';
import Menu from '../../components/menu/menu';
import MenuItem from '../../components/menu/menu-item';
import { BoardStylePanel } from './board-style-panel';
import classNames from 'classnames';
import './board-style-context-menu.scss';

interface ContextPosition {
  x: number;
  y: number;
}

const CONTEXT_MENU_SIZE = {
  width: 220,
  height: 80,
};

const PANEL_SIZE = {
  width: 360,
  height: 540,
};

export const BoardStyleContextMenu = () => {
  const board = useBoard();
  const selectedElements = getSelectedElements(board);
  const boardContainer = PlaitBoard.getBoardContainer(board);
  const [menuPosition, setMenuPosition] = useState<ContextPosition | null>(null);
  const [panelPosition, setPanelPosition] = useState<ContextPosition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectionKey = useMemo(
    () =>
      selectedElements
        .map((element) => (element as Record<string, unknown>)['id'])
        .filter((id): id is string => typeof id === 'string')
        .sort()
        .join('|'),
    [selectedElements]
  );

  useEffect(() => {
    if (!boardContainer) {
      return;
    }

    const handleContextMenu = (event: MouseEvent) => {
      const nextSelectedElements = getSelectedElements(board);
      if (!nextSelectedElements.length) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPanelPosition(null);
      setMenuPosition(clampToViewport(event.clientX, event.clientY, CONTEXT_MENU_SIZE));
    };

    boardContainer.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      boardContainer.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [board, boardContainer]);

  useEffect(() => {
    setMenuPosition(null);
    setPanelPosition(null);
  }, [selectionKey]);

  useEffect(() => {
    if (!menuPosition && !panelPosition) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        (target && menuRef.current?.contains(target))
        || (target && panelRef.current?.contains(target))
      ) {
        return;
      }

      setMenuPosition(null);
      setPanelPosition(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuPosition(null);
        setPanelPosition(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuPosition, panelPosition]);

  if (!menuPosition && !panelPosition) {
    return null;
  }

  return (
    <>
      {menuPosition && (
        <div
          ref={menuRef}
          className={classNames(
            'board-style-context-menu',
            ATTACHED_ELEMENT_CLASS_NAME
          )}
          style={{
            left: `${menuPosition.x}px`,
            top: `${menuPosition.y}px`,
          }}
          data-testid="board-style-context-menu"
        >
          <Menu className="board-style-context-menu__menu">
            <MenuItem
              icon={AIMermaidIcon}
              onSelect={() => {
                setMenuPosition(null);
                setPanelPosition(
                  clampToViewport(
                    menuPosition.x + 12,
                    menuPosition.y + 12,
                    PANEL_SIZE
                  )
                );
              }}
            >
              AI 样式优化
            </MenuItem>
          </Menu>
        </div>
      )}

      {panelPosition && selectedElements.length > 0 && (
        <div
          ref={panelRef}
          className={classNames(
            'board-style-context-menu__panel',
            ATTACHED_ELEMENT_CLASS_NAME
          )}
          style={{
            left: `${panelPosition.x}px`,
            top: `${panelPosition.y}px`,
          }}
          data-testid="board-style-context-panel"
        >
          <BoardStylePanel board={board} selectedElements={selectedElements} />
        </div>
      )}
    </>
  );
};

function clampToViewport(
  x: number,
  y: number,
  size: {
    width: number;
    height: number;
  }
): ContextPosition {
  const padding = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  return {
    x: Math.max(padding, Math.min(x, viewportWidth - size.width - padding)),
    y: Math.max(padding, Math.min(y, viewportHeight - size.height - padding)),
  };
}
