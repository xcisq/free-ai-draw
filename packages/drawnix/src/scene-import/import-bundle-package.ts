import type { PlaitElement } from '@plait/core';
import {
  convertSvgAssetPackageToDrawnix,
  type SvgImportSummary,
} from '../svg-import/convert-svg-to-drawnix';
import { parseSvgAssetPackage } from '../svg-import/parse-svg-package';
import { importScenePackage } from './import-scene-package';

export interface BundleImportResult {
  elements: PlaitElement[];
  summary: SvgImportSummary;
  importKind: 'scene' | 'svg';
  descriptionLines: string[];
  fallbackReason?: string;
}

export const importBundlePackage = async (
  file: File
): Promise<BundleImportResult> => {
  try {
    const sceneResult = await importScenePackage(file);
    return {
      elements: sceneResult.elements,
      summary: sceneResult.summary,
      importKind: 'scene',
      descriptionLines: [
        file.name,
        `Import: scene`,
        `scene: ${sceneResult.meta.sceneVersion}`,
        `elements: ${sceneResult.meta.elementCount}`,
        `assets: ${sceneResult.meta.assetCount}`,
      ],
    };
  } catch (sceneError) {
    const fallbackReason =
      sceneError instanceof Error ? sceneError.message : 'unknown scene import error';
    const assetPackage = await parseSvgAssetPackage(file);
    const svgResult = convertSvgAssetPackageToDrawnix(assetPackage);
    return {
      elements: svgResult.elements,
      summary: {
        ...svgResult.summary,
        warnings: [
          `[scene-import fallback] ${fallbackReason}`,
          ...svgResult.summary.warnings,
        ],
      },
      importKind: 'svg',
      fallbackReason,
      descriptionLines: [
        file.name,
        `Import: svg-fallback`,
        `SVG: ${assetPackage.fileName}`,
        `components: ${Object.keys(assetPackage.componentAssets).length}`,
      ],
    };
  }
};
