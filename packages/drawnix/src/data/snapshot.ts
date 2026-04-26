import { PlaitBoard } from '@plait/core';
import { VERSIONS } from '../constants';
import {
  DrawnixExportMetadata,
  DrawnixExportedData,
  DrawnixExportedType,
  DrawnixExportScope,
} from './types';

const buildMetadata = (
  metadata: DrawnixExportMetadata | undefined,
  embeddedIn: 'drawnix' | 'svg',
  exportScope: DrawnixExportScope
): DrawnixExportMetadata => ({
  ...metadata,
  snapshotFormat: 'board-snapshot-v2',
  embeddedIn,
  exportScope,
  exportedAt: metadata?.exportedAt || new Date().toISOString(),
});

export const hasValidViewport = (value: unknown) => {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { zoom?: unknown }).zoom === 'number' &&
    Number.isFinite((value as { zoom: number }).zoom)
  );
};

export const isValidDrawnixData = (data?: any): data is DrawnixExportedData => {
  return (
    !!data &&
    data.type === DrawnixExportedType.drawnix &&
    Array.isArray(data.elements) &&
    hasValidViewport(data.viewport)
  );
};

export const normalizeDrawnixData = (
  data: DrawnixExportedData
): DrawnixExportedData => {
  const exportScope = data.metadata?.exportScope || 'board';
  const embeddedIn = data.metadata?.embeddedIn || 'drawnix';
  return {
    ...data,
    metadata: buildMetadata(data.metadata, embeddedIn, exportScope),
  };
};

export const createBoardSnapshot = (
  board: PlaitBoard,
  options?: {
    elements?: PlaitBoard['children'];
    exportScope?: DrawnixExportScope;
    embeddedIn?: 'drawnix' | 'svg';
  }
): DrawnixExportedData => {
  const exportScope = options?.exportScope || 'board';
  const embeddedIn = options?.embeddedIn || 'drawnix';
  return {
    type: DrawnixExportedType.drawnix,
    version: VERSIONS.drawnix,
    source: 'web',
    elements: options?.elements || board.children,
    viewport: board.viewport || { zoom: 1 },
    theme: board.theme,
    metadata: buildMetadata(undefined, embeddedIn, exportScope),
  };
};

export const serializeBoardSnapshot = (snapshot: DrawnixExportedData) => {
  return JSON.stringify(snapshot, null, 2);
};
