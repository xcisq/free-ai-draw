import { getElementOfFocusedImage } from '@plait/common';
import {
  getSelectedElements,
  idCreator,
  PlaitBoard,
  PlaitHistoryBoard,
  Point,
  Transforms,
} from '@plait/core';
import { DrawTransforms, PlaitDrawElement } from '@plait/draw';
import { MindElement, MindTransforms } from '@plait/mind';
import { IMAGE_MIME_TYPES } from '../constants';
import { getDataURL } from '../data/blob';
import { fileOpen } from '../data/filesystem';
import { loadHTMLImageElement } from '../data/image';

export interface IconLibraryAsset {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  createdAt: number;
}

export const ICON_LIBRARY_STORAGE_KEY = 'drawnix-icon-library-assets';
export const DEFAULT_ICON_INSERT_MAX_SIDE = 96;

const normalizeDimension = (value: unknown, fallback = DEFAULT_ICON_INSERT_MAX_SIDE) => {
  const dimension = Number(value);
  return Number.isFinite(dimension) && dimension > 0 ? dimension : fallback;
};

const sanitizeIconName = (name: string) => {
  const normalized = name.replace(/\.[^.]+$/, '').trim();
  return normalized || 'icon';
};

const isIconLibraryAsset = (value: unknown): value is IconLibraryAsset => {
  const asset = value as IconLibraryAsset | null;
  return !!asset
    && typeof asset.id === 'string'
    && typeof asset.name === 'string'
    && typeof asset.url === 'string'
    && typeof asset.createdAt === 'number';
};

const clonePoints = (points: Point[] | undefined) => {
  if (!points) {
    return undefined;
  }
  return points.map((point) => [point[0], point[1]] as Point);
};

const buildInsertedImageItem = (asset: IconLibraryAsset) => {
  const width = normalizeDimension(asset.width);
  const height = normalizeDimension(asset.height);
  const maxSide = Math.max(width, height);
  const scale =
    maxSide > DEFAULT_ICON_INSERT_MAX_SIDE
      ? DEFAULT_ICON_INSERT_MAX_SIDE / maxSide
      : 1;

  return {
    url: asset.url,
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
  return PlaitDrawElement.isGeometry(element) && !PlaitDrawElement.isText(element);
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

export const loadStoredIconLibraryAssets = () => {
  if (typeof localStorage === 'undefined') {
    return [] as IconLibraryAsset[];
  }
  const raw = localStorage.getItem(ICON_LIBRARY_STORAGE_KEY);
  if (!raw) {
    return [] as IconLibraryAsset[];
  }
  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return [] as IconLibraryAsset[];
    }
    return parsed.filter(isIconLibraryAsset).map((asset) => ({
      ...asset,
      width: normalizeDimension(asset.width),
      height: normalizeDimension(asset.height),
    }));
  } catch {
    return [] as IconLibraryAsset[];
  }
};

export const saveStoredIconLibraryAssets = (assets: IconLibraryAsset[]) => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(ICON_LIBRARY_STORAGE_KEY, JSON.stringify(assets));
};

export const pickIconLibraryFiles = async () => {
  return fileOpen<true>({
    description: 'Icon assets',
    extensions: Object.keys(
      IMAGE_MIME_TYPES
    ) as (keyof typeof IMAGE_MIME_TYPES)[],
    multiple: true,
  });
};

export const loadIconLibraryAssetsFromFiles = async (files: File[]) => {
  const results = await Promise.allSettled(
    files.map(async (file) => {
      const dataURL = await getDataURL(file);
      const image = await loadHTMLImageElement(dataURL);
      return {
        id: idCreator(),
        name: sanitizeIconName(file.name),
        url: dataURL,
        width: normalizeDimension(image.width),
        height: normalizeDimension(image.height),
        createdAt: Date.now(),
      } satisfies IconLibraryAsset;
    })
  );

  return results.flatMap((result) => {
    return result.status === 'fulfilled' ? [result.value] : [];
  });
};

export const replaceDrawElementWithIcon = (
  board: PlaitBoard,
  element: { points?: Point[]; angle?: number } & Record<string, unknown>,
  asset: IconLibraryAsset
) => {
  const path = PlaitBoard.findPath(board, element as any);
  const patch = {
    type: 'image' as const,
    url: asset.url,
    points: clonePoints(element.points),
    angle: typeof element.angle === 'number'
      ? element.angle
      : 0,
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

export const applyIconLibraryAsset = (
  board: PlaitBoard,
  asset: IconLibraryAsset
) => {
  const selectedElement = getSingleSelectedElement(board);
  const imageItem = buildInsertedImageItem(asset);

  if (selectedElement && MindElement.isMindElement(board, selectedElement)) {
    MindTransforms.setImage(board, selectedElement as any, imageItem);
    return 'replace' as const;
  }

  if (selectedElement && isReplaceableDrawElement(selectedElement)) {
    replaceDrawElementWithIcon(board, selectedElement, asset);
    return 'replace' as const;
  }

  DrawTransforms.insertImage(board, imageItem);
  return 'insert' as const;
};
