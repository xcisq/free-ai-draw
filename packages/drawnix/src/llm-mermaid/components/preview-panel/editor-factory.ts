/**
 * Editor Factory
 * 创建只读的 Plait Board 实例用于预览
 */

import {
  PlaitBoard,
  PlaitBoardOptions,
} from '@plait/core';
import { withDraw } from '@plait/draw';
import { withCommonPlugin } from '../../../plugins/with-common';
import type { Value } from '@plait/core';

export interface CreateEditorOptions extends PlaitBoardOptions {
  themeColors?: {
    primary: string;
    background: string;
    text: string;
  };
}

/**
 * 创建只读 Board 实例
 */
export function createEditor(
  container: HTMLElement,
  elements: Value[] = [],
  options: CreateEditorOptions = {}
): PlaitBoard {
  const boardOptions: PlaitBoardOptions = {
    ...options,
    readonly: true,
    hideScrollbar: true,
  };

  // 创建基础 Board
  const board = new PlaitBoard(container, boardOptions);

  // 应用插件
  const boardWithPlugins = withCommonPlugin(withDraw(board));

  // 初始化元素
  if (elements.length > 0) {
    boardWithPlugins.children = [];
    elements.forEach((element) => {
      boardWithPlugins.addElements(element);
    });
  }

  // 自适应视图
  if (elements.length > 0) {
    boardWithPlugins.fitToSelection();
  }

  return boardWithPlugins;
}

/**
 * 从 Board 获取元素数组
 */
export function getElementsFromBoard(board: PlaitBoard): Value[] {
  return board.children || [];
}

/**
 * 销毁 Board 实例
 */
export function destroyBoard(board: PlaitBoard): void {
  if (board && typeof board.destroy === 'function') {
    board.destroy();
  }
}
