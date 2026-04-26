import { PlaitElement, PlaitTheme, Viewport } from '@plait/core';

export type DrawnixExportScope = 'board' | 'selection';

export interface DrawnixExportMetadata {
  snapshotFormat?: 'board-snapshot-v2';
  exportScope?: DrawnixExportScope;
  embeddedIn?: 'drawnix' | 'svg';
  exportedAt?: string;
}

export interface DrawnixExportedData {
  type: DrawnixExportedType.drawnix;
  version: number;
  source: 'web';
  elements: PlaitElement[];
  viewport: Viewport;
  theme?: PlaitTheme;
  metadata?: DrawnixExportMetadata;
}

export enum DrawnixExportedType {
    drawnix = 'drawnix'
}
