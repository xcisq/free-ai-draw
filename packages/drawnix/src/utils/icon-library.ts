import { getElementOfFocusedImage } from '@plait/common';
import {
  BoardTransforms,
  getViewportOrigination,
  getSelectedElements,
  MAX_ZOOM,
  MIN_ZOOM,
  PlaitBoard,
  PlaitElement,
  PlaitHistoryBoard,
  Point,
  RectangleClient,
  Transforms,
  WritableClipboardOperationType,
} from '@plait/core';
import { DrawTransforms, PlaitDrawElement } from '@plait/draw';
import { MindElement, MindTransforms } from '@plait/mind';
import { fileOpen } from '../data/filesystem';
import type { AssetLibraryItem } from '../asset-library/types';
import {
  createAssetLibraryItemsFromFiles,
  dataUrlToBlob,
} from '../asset-library/utils';
import { isValidDrawnixData, normalizeDrawnixData } from '../data/snapshot';
import { playBoardBatchEnterAnimation } from './board-assembly';

export type IconLibraryAsset = AssetLibraryItem;

export const ICON_LIBRARY_STORAGE_KEY = 'drawnix-icon-library-assets';
export const DEFAULT_ICON_INSERT_MAX_SIDE = 520;
export const DEFAULT_ICON_INSERT_MIN_SIDE = 120;
const ASSET_FOCUS_PADDING = 96;
const ASSET_FOCUS_MAX_ZOOM = 1.2;
const ASSET_FOCUS_MIN_ZOOM = 0.25;
const ASSET_FOCUS_DURATION = 320;

const normalizeDimension = (
  value: unknown,
  fallback = DEFAULT_ICON_INSERT_MAX_SIDE
) => {
  const dimension = Number(value);
  return Number.isFinite(dimension) && dimension > 0 ? dimension : fallback;
};

const clonePoints = (points: Point[] | undefined) => {
  if (!points) {
    return undefined;
  }
  return points.map((point) => [point[0], point[1]] as Point);
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

const getElementRectangles = (elements: PlaitElement[]): RectangleClient[] => {
  return elements.flatMap((element) => {
    const children = Array.isArray(element.children)
      ? getElementRectangles(element.children as PlaitElement[])
      : [];
    const points = (element as { points?: Point[] }).points;
    if (!Array.isArray(points) || points.length < 2) {
      return children;
    }
    return [RectangleClient.getRectangleByPoints(points), ...children];
  });
};

const getElementsRectangle = (elements: PlaitElement[]) => {
  const rectangles = getElementRectangles(elements);
  return rectangles.length
    ? RectangleClient.getBoundingRectangle(rectangles)
    : null;
};

const getTargetViewportForRectangle = (
  board: PlaitBoard,
  rectangle: RectangleClient
) => {
  const container = PlaitBoard.getBoardContainer(board);
  const width =
    container.clientWidth || container.getBoundingClientRect().width;
  const height =
    container.clientHeight || container.getBoundingClientRect().height;
  if (!width || !height || rectangle.width <= 0 || rectangle.height <= 0) {
    return null;
  }

  const availableWidth = Math.max(1, width - ASSET_FOCUS_PADDING * 2);
  const availableHeight = Math.max(1, height - ASSET_FOCUS_PADDING * 2);
  const fitZoom = Math.min(
    availableWidth / rectangle.width,
    availableHeight / rectangle.height
  );
  const zoom = clamp(
    fitZoom,
    Math.max(MIN_ZOOM, ASSET_FOCUS_MIN_ZOOM),
    Math.min(MAX_ZOOM, ASSET_FOCUS_MAX_ZOOM)
  );
  const centerX = rectangle.x + rectangle.width / 2;
  const centerY = rectangle.y + rectangle.height / 2;
  return {
    zoom,
    origination: [
      centerX - width / 2 / zoom,
      centerY - height / 2 / zoom,
    ] as Point,
  };
};

const focusViewportOnRectangle = (
  board: PlaitBoard,
  rectangle: RectangleClient | null
) => {
  if (!rectangle) {
    return;
  }
  const target = getTargetViewportForRectangle(board, rectangle);
  if (!target) {
    return;
  }
  const startOrigination = getViewportOrigination(board) || [0, 0];
  const startZoom = board.viewport.zoom || 1;
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (
    reducedMotion ||
    typeof window === 'undefined' ||
    typeof window.requestAnimationFrame !== 'function'
  ) {
    BoardTransforms.updateViewport(board, target.origination, target.zoom);
    return;
  }

  const startedAt = performance.now();
  const step = (timestamp: number) => {
    const progress = clamp(
      (timestamp - startedAt) / ASSET_FOCUS_DURATION,
      0,
      1
    );
    const eased = easeOutCubic(progress);
    const nextOrigination = [
      startOrigination[0] +
        (target.origination[0] - startOrigination[0]) * eased,
      startOrigination[1] +
        (target.origination[1] - startOrigination[1]) * eased,
    ] as Point;
    const nextZoom = startZoom + (target.zoom - startZoom) * eased;
    BoardTransforms.updateViewport(board, nextOrigination, nextZoom);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
};

const buildInsertedImageItem = (asset: IconLibraryAsset) => {
  const width = normalizeDimension(asset.width);
  const height = normalizeDimension(asset.height);
  const maxSide = Math.max(width, height);
  const minSide = Math.min(width, height);

  let scale = 1;
  if (maxSide > DEFAULT_ICON_INSERT_MAX_SIDE) {
    scale = DEFAULT_ICON_INSERT_MAX_SIDE / maxSide;
  } else if (minSide < DEFAULT_ICON_INSERT_MIN_SIDE) {
    scale = DEFAULT_ICON_INSERT_MIN_SIDE / minSide;
  }

  return {
    url: asset.dataUrl,
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const getSingleSelectedElement = (board: PlaitBoard) => {
  const selectedElements = getSelectedElements(board);
  if (selectedElements.length > 1) {
    return null;
  }
  return selectedElements[0] || getElementOfFocusedImage(board) || null;
};

export const isReplaceableDrawElement = (element: unknown) => {
  if (PlaitDrawElement.isImage(element)) {
    return true;
  }
  return (
    PlaitDrawElement.isGeometry(element) && !PlaitDrawElement.isText(element)
  );
};

export const canReplaceSelectionWithIcon = (board: PlaitBoard) => {
  const selectedElement = getSingleSelectedElement(board);
  if (!selectedElement) {
    return false;
  }
  if (MindElement.isMindElement(board, selectedElement)) {
    return true;
  }
  return isReplaceableDrawElement(selectedElement);
};

export const loadStoredIconLibraryAssets = () => [] as IconLibraryAsset[];

export const saveStoredIconLibraryAssets = (_assets: IconLibraryAsset[]) => {};

export const pickIconLibraryFiles = async () => {
  return fileOpen<true>({
    description: 'Assets',
    extensions: ['svg', 'png', 'jpg', 'webp', 'drawnix'],
    multiple: true,
  });
};

export const loadIconLibraryAssetsFromFiles = async (files: File[]) => {
  return createAssetLibraryItemsFromFiles(files);
};

export const replaceDrawElementWithIcon = (
  board: PlaitBoard,
  element: { points?: Point[]; angle?: number } & Record<string, unknown>,
  asset: IconLibraryAsset
) => {
  const path = PlaitBoard.findPath(board, element as any);
  const patch = {
    type: 'image' as const,
    url: asset.dataUrl,
    points: clonePoints(element.points),
    angle: typeof element.angle === 'number' ? element.angle : 0,
    shape: undefined,
    text: undefined,
    texts: undefined,
    fill: undefined,
    strokeColor: undefined,
    strokeWidth: undefined,
    strokeStyle: undefined,
    opacity: undefined,
    rows: undefined,
    columns: undefined,
    cells: undefined,
  };

  PlaitHistoryBoard.withNewBatch(board, () => {
    Transforms.setNode(board, patch, path);
  });
};

const getBoardCenterPoint = (board: PlaitBoard): Point => {
  try {
    const boardContainerRect =
      PlaitBoard.getBoardContainer(board).getBoundingClientRect();
    const zoom = board.viewport.zoom || 1;
    const origination = getViewportOrigination(board);
    return [
      (origination?.[0] || 0) + boardContainerRect.width / 2 / zoom,
      (origination?.[1] || 0) + boardContainerRect.height / 2 / zoom,
    ];
  } catch {
    return [0, 0];
  }
};

const insertDrawnixAsset = async (
  board: PlaitBoard,
  asset: IconLibraryAsset
) => {
  const contents = await dataUrlToBlob(asset.dataUrl).text();
  const parsed = JSON.parse(contents);
  if (!isValidDrawnixData(parsed)) {
    throw new Error('Invalid Drawnix asset');
  }
  const data = normalizeDrawnixData(parsed);
  const elements = JSON.parse(JSON.stringify(data.elements));
  board.insertFragment(
    { elements },
    getBoardCenterPoint(board),
    WritableClipboardOperationType.paste
  );
  playBoardBatchEnterAnimation(elements, 0);
  focusViewportOnRectangle(board, getElementsRectangle(elements));
  return 'insert' as const;
};

export const applyIconLibraryAsset = async (
  board: PlaitBoard,
  asset: IconLibraryAsset
) => {
  if (asset.kind === 'drawnix') {
    return insertDrawnixAsset(board, asset);
  }

  const selectedElement = getSingleSelectedElement(board);
  const imageItem = buildInsertedImageItem(asset);

  if (selectedElement && MindElement.isMindElement(board, selectedElement)) {
    MindTransforms.setImage(board, selectedElement as any, imageItem);
    focusViewportOnRectangle(
      board,
      getElementsRectangle([selectedElement as PlaitElement])
    );
    return 'replace' as const;
  }

  if (selectedElement && isReplaceableDrawElement(selectedElement)) {
    replaceDrawElementWithIcon(board, selectedElement, asset);
    focusViewportOnRectangle(
      board,
      getElementsRectangle([selectedElement as PlaitElement])
    );
    return 'replace' as const;
  }

  const centerPoint = getBoardCenterPoint(board);
  const startPoint = [
    centerPoint[0] - imageItem.width / 2,
    centerPoint[1] - imageItem.height / 2,
  ] as Point;
  const insertedRectangle = RectangleClient.getRectangleByPoints([
    startPoint,
    [startPoint[0] + imageItem.width, startPoint[1] + imageItem.height],
  ]);
  DrawTransforms.insertImage(board, imageItem, startPoint);
  focusViewportOnRectangle(board, insertedRectangle);
  return 'insert' as const;
};
