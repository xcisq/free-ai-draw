import { unzipSync } from 'fflate';

export interface SvgPackageComponentAsset {
  id: string;
  fileName: string;
  url: string;
}

export interface SvgPackageIconBox {
  id: number;
  label: string;
  normalizedLabel: string;
  iconId: string;
  prompt?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score?: number;
}

export interface SvgAssetPackage {
  fileName: string;
  svgText: string;
  componentAssets: Record<string, SvgPackageComponentAsset>;
  iconBoxMap: Record<string, SvgPackageIconBox>;
}

const SVG_FILE_CANDIDATES = ['final_edited.svg', 'final.svg'];
const COMPONENT_ASSET_FOLDERS = ['/components/', '/icons/'];

const normalizePath = (value: string) => value.replace(/\\/g, '/');

const getBaseName = (value: string) => {
  const normalized = normalizePath(value);
  return normalized.slice(normalized.lastIndexOf('/') + 1);
};

const stripExtension = (value: string) => value.replace(/\.[^.]+$/, '');

const normalizePlaceholderLabel = (value: string) =>
  value.replace(/[^a-z0-9]/gi, '').toUpperCase();

const arrayBufferToBase64 = (input: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < input.length; index += chunkSize) {
    binary += String.fromCharCode(...input.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const inferMimeType = (fileName: string) => {
  const normalized = fileName.toLowerCase();
  if (normalized.endsWith('.png')) {
    return 'image/png';
  }
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (normalized.endsWith('.svg')) {
    return 'image/svg+xml';
  }
  return 'application/octet-stream';
};

const toDataUrl = (bytes: Uint8Array, fileName: string) => {
  const mimeType = inferMimeType(fileName);
  return `data:${mimeType};base64,${arrayBufferToBase64(bytes)}`;
};

const buildComponentAssetKey = (fileName: string) => {
  const baseName = getBaseName(fileName);
  return stripExtension(baseName).replace(/_nobg$/i, '');
};

const readFileAsUint8Array = async (file: File) => {
  const fileWithArrayBuffer = file as File & {
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };

  if (typeof fileWithArrayBuffer.arrayBuffer === 'function') {
    return new Uint8Array(await fileWithArrayBuffer.arrayBuffer());
  }

  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (!(result instanceof ArrayBuffer)) {
        reject(new Error('无法读取 ZIP 文件'));
        return;
      }
      resolve(new Uint8Array(result));
    };
    reader.onerror = () => {
      reject(reader.error || new Error('无法读取 ZIP 文件'));
    };
    reader.readAsArrayBuffer(file);
  });
};

const decodeUtf8 = async (input: Uint8Array) => {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(input);
  }
  let output = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < input.length; index += chunkSize) {
    output += String.fromCharCode(...input.subarray(index, index + chunkSize));
  }
  return output;
};

const pickSvgEntry = (entries: string[]) => {
  const normalizedEntries = entries.map((entry) => normalizePath(entry));

  for (const candidate of SVG_FILE_CANDIDATES) {
    const matched = normalizedEntries.find((entry) => getBaseName(entry) === candidate);
    if (matched) {
      return matched;
    }
  }

  return normalizedEntries.find((entry) => {
    return entry.toLowerCase().endsWith('.svg') && !entry.includes('/components/');
  });
};

const pickBoxlibEntry = (entries: string[]) => {
  return entries
    .map((entry) => normalizePath(entry))
    .find((entry) => getBaseName(entry).toLowerCase() === 'boxlib.json');
};

export const parseSvgAssetPackage = async (file: File): Promise<SvgAssetPackage> => {
  const archive = unzipSync(await readFileAsUint8Array(file));
  const entryNames = Object.keys(archive);
  const svgEntry = pickSvgEntry(entryNames);
  const boxlibEntry = pickBoxlibEntry(entryNames);

  if (!svgEntry) {
    throw new Error('ZIP 中未找到总 SVG 文件');
  }

  const svgBytes = archive[svgEntry];
  if (!svgBytes) {
    throw new Error('无法读取总 SVG 文件');
  }

  const svgText = await decodeUtf8(svgBytes);
  const componentAssets: Record<string, SvgPackageComponentAsset> = {};
  const iconBoxMap: Record<string, SvgPackageIconBox> = {};

  for (const entryName of entryNames) {
    const normalized = normalizePath(entryName);
    if (!COMPONENT_ASSET_FOLDERS.some((folder) => normalized.includes(folder))) {
      continue;
    }
    const baseName = getBaseName(normalized);
    if (!/\.(png|jpg|jpeg|svg)$/i.test(baseName)) {
      continue;
    }

    const key = buildComponentAssetKey(baseName);
    const bytes = archive[entryName];
    if (!bytes) {
      continue;
    }

    const asset: SvgPackageComponentAsset = {
      id: key,
      fileName: baseName,
      url: toDataUrl(bytes, baseName),
    };

    const existing = componentAssets[key];
    const isPreferred = /_nobg\./i.test(baseName);
    const existingPreferred = existing ? /_nobg\./i.test(existing.fileName) : false;

    if (!existing || (isPreferred && !existingPreferred)) {
      componentAssets[key] = asset;
    }
  }

  if (boxlibEntry) {
    const boxlibBytes = archive[boxlibEntry];
    if (boxlibBytes) {
      try {
        const boxlibText = await decodeUtf8(boxlibBytes);
        const parsed = JSON.parse(boxlibText) as {
          boxes?: Array<{
            id?: number;
            label?: string;
            prompt?: string;
            x1?: number;
            y1?: number;
            x2?: number;
            y2?: number;
            score?: number;
          }>;
        };
        for (const box of parsed.boxes || []) {
          const label = typeof box.label === 'string' ? box.label.trim() : '';
          const normalizedLabel = normalizePlaceholderLabel(label);
          if (!normalizedLabel) {
            continue;
          }
          iconBoxMap[normalizedLabel] = {
            id: typeof box.id === 'number' ? box.id : Object.keys(iconBoxMap).length,
            label,
            normalizedLabel,
            iconId: `icon_${normalizedLabel}`,
            prompt: box.prompt,
            x1: typeof box.x1 === 'number' ? box.x1 : 0,
            y1: typeof box.y1 === 'number' ? box.y1 : 0,
            x2: typeof box.x2 === 'number' ? box.x2 : 0,
            y2: typeof box.y2 === 'number' ? box.y2 : 0,
            score: typeof box.score === 'number' ? box.score : undefined,
          };
        }
      } catch {
        // Ignore malformed boxlib metadata and continue importing the SVG.
      }
    }
  }

  return {
    fileName: getBaseName(svgEntry),
    svgText,
    componentAssets,
    iconBoxMap,
  };
};
