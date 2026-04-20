export type AutodrawStatus =
  | 'idle'
  | 'submitting'
  | 'queued'
  | 'running'
  | 'importing'
  | 'succeeded'
  | 'failed';

type AssemblyCandidate = {
  id?: string;
  type?: string;
  shape?: string;
  text?: unknown;
  textStyle?: unknown;
  points?: [number, number][];
};

export interface AutodrawArtifact {
  name: string;
  path: string;
  kind: string;
  size_bytes: number;
  download_url: string;
}

export interface AutodrawAssetItem extends AutodrawArtifact {
  id: string;
  url: string;
  previewable: boolean;
  category: 'visual' | 'data' | 'log';
  stageIndex: number;
  priority: number;
}

export interface AutodrawAssetShelfItem {
  id: string;
  title: string;
  subtitle: string;
  stageIndex: number;
  kind: string;
  isPlaceholder: boolean;
  asset?: AutodrawAssetItem;
}

export interface AutodrawHistorySummary {
  textCount: number;
  arrowCount: number;
  componentCount: number;
}

export interface AutodrawHistoryEntry {
  id: string;
  type: 'job' | 'bundle';
  jobType?: 'autodraw' | 'image-edit';
  title: string;
  subtitle: string;
  status: AutodrawStatus | 'local';
  createdAt: string;
  jobId?: string;
  previewUrl?: string;
  summary?: AutodrawHistorySummary;
}

type AutodrawSpotlightOptions = {
  preferredStep?: number;
  strictStep?: boolean;
};

const AUTODRAW_ASSET_STAGE_PLACEHOLDERS = [
  {
    id: 'placeholder:figure',
    stageIndex: 0,
    kind: 'figure',
    title: 'figure.png',
  },
  {
    id: 'placeholder:samed',
    stageIndex: 1,
    kind: 'samed',
    title: 'samed.png',
  },
  {
    id: 'placeholder:icons',
    stageIndex: 2,
    kind: 'icon',
    title: 'icons/*',
  },
  {
    id: 'placeholder:final',
    stageIndex: 3,
    kind: 'final_svg',
    title: 'final.svg',
  },
] as const;

const VISUAL_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
const LOG_STEP_PATTERNS: Array<{
  step: number;
  patterns: RegExp[];
}> = [
  {
    step: 4,
    patterns: [
      /步骤五/i,
      /import to canvas/i,
      /导入画板/i,
      /落板/i,
      /\[scene-import\]/i,
      /\[svg-import\]/i,
    ],
  },
  {
    step: 3,
    patterns: [
      /步骤四/i,
      /rebuild svg/i,
      /重建\s*svg/i,
      /final\.svg/i,
      /template\.svg/i,
      /optimized_template\.svg/i,
      /scene\.json/i,
    ],
  },
  {
    step: 2,
    patterns: [
      /步骤三/i,
      /extract assets/i,
      /提取图标/i,
      /icon/i,
      /icons\//i,
      /asset/i,
      /组件/i,
    ],
  },
  {
    step: 1,
    patterns: [
      /步骤二/i,
      /parse structure/i,
      /解析结构/i,
      /sam3/i,
      /分割/i,
      /boxlib/i,
      /samed/i,
    ],
  },
  {
    step: 0,
    patterns: [
      /步骤一/i,
      /generate figure/i,
      /生成原始图/i,
      /生成学术风格图片/i,
      /figure\.png/i,
      /\bllm\b/i,
    ],
  },
];

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const resolveArtifactUrl = (downloadUrl: string, baseUrl: string) => {
  if (/^https?:\/\//.test(downloadUrl)) {
    return downloadUrl;
  }
  return `${normalizeBaseUrl(baseUrl)}${downloadUrl}`;
};

const getAssetStageIndex = (artifact: AutodrawArtifact) => {
  switch (artifact.kind) {
    case 'figure':
      return 0;
    case 'samed':
    case 'boxlib':
      return 1;
    case 'icon':
      return 2;
    case 'template_svg':
    case 'optimized_template_svg':
    case 'final_svg':
      return 3;
    default:
      return 4;
  }
};

const getAssetPriority = (artifact: AutodrawArtifact) => {
  switch (artifact.kind) {
    case 'figure':
      return 0;
    case 'final_svg':
      return 1;
    case 'optimized_template_svg':
      return 2;
    case 'template_svg':
      return 3;
    case 'icon':
      return 4;
    case 'scene_json':
      return 5;
    case 'boxlib':
      return 6;
    case 'manifest':
      return 7;
    case 'log':
      return 8;
    default:
      return 9;
  }
};

const isPreviewableArtifact = (artifact: AutodrawArtifact) => {
  const lowerName = artifact.name.toLowerCase();
  return VISUAL_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
};

const getArtifactCategory = (
  artifact: AutodrawArtifact
): AutodrawAssetItem['category'] => {
  if (artifact.kind === 'log') {
    return 'log';
  }
  if (isPreviewableArtifact(artifact)) {
    return 'visual';
  }
  return 'data';
};

export const buildAssemblyBatches = <T extends AssemblyCandidate>(
  elements: T[]
) => {
  if (!elements.length) {
    return [];
  }

  const chunkSize =
    elements.length <= 6
      ? 1
      : elements.length <= 18
      ? 3
      : Math.min(6, Math.ceil(elements.length / 4));

  const batches: T[][] = [];
  for (let index = 0; index < elements.length; index += chunkSize) {
    const nextBatch = elements.slice(index, index + chunkSize);
    if (nextBatch.length) {
      batches.push(nextBatch);
    }
  }
  return batches;
};

export const toAutodrawAssetItems = (
  artifacts: AutodrawArtifact[],
  baseUrl: string
) => {
  return [...artifacts]
    .map<AutodrawAssetItem>((artifact) => ({
      ...artifact,
      id: artifact.path,
      url: resolveArtifactUrl(artifact.download_url, baseUrl),
      previewable: isPreviewableArtifact(artifact),
      category: getArtifactCategory(artifact),
      stageIndex: getAssetStageIndex(artifact),
      priority: getAssetPriority(artifact),
    }))
    .sort((left, right) => {
      if (left.stageIndex !== right.stageIndex) {
        return left.stageIndex - right.stageIndex;
      }
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      return left.name.localeCompare(right.name);
    });
};

export const mergeAutodrawArtifacts = (
  primaryArtifacts: AutodrawArtifact[],
  fallbackArtifacts: AutodrawArtifact[]
) => {
  const artifactMap = new Map<string, AutodrawArtifact>();
  fallbackArtifacts.forEach((artifact) => {
    artifactMap.set(artifact.path, artifact);
  });
  primaryArtifacts.forEach((artifact) => {
    artifactMap.set(artifact.path, artifact);
  });
  return [...artifactMap.values()];
};

export const getAutodrawVisibleAssetItems = (assets: AutodrawAssetItem[]) => {
  return assets.filter(
    (asset) => asset.previewable && asset.category === 'visual'
  );
};

export const buildAutodrawAssetShelfItems = (payload: {
  assets: AutodrawAssetItem[];
  activeStep: number;
  isBusy: boolean;
  stageLabels: string[];
}) => {
  const visibleAssets = getAutodrawVisibleAssetItems(payload.assets);
  const assetShelfItems = visibleAssets.map<AutodrawAssetShelfItem>(
    (asset) => ({
      id: asset.id,
      title: asset.name,
      subtitle:
        payload.stageLabels[
          Math.min(asset.stageIndex, payload.stageLabels.length - 1)
        ] || '',
      stageIndex: asset.stageIndex,
      kind: asset.kind,
      isPlaceholder: false,
      asset,
    })
  );

  if (!payload.isBusy) {
    return assetShelfItems;
  }

  const cappedStep = Math.min(3, Math.max(0, payload.activeStep));
  const stagesWithAssets = new Set(
    visibleAssets
      .filter((asset) => asset.stageIndex <= 3)
      .map((asset) => asset.stageIndex)
  );

  const placeholders = AUTODRAW_ASSET_STAGE_PLACEHOLDERS.filter((item) => {
    return (
      item.stageIndex <= cappedStep && !stagesWithAssets.has(item.stageIndex)
    );
  }).map<AutodrawAssetShelfItem>((item) => ({
    id: item.id,
    title: item.title,
    subtitle:
      payload.stageLabels[
        Math.min(item.stageIndex, payload.stageLabels.length - 1)
      ] || '',
    stageIndex: item.stageIndex,
    kind: item.kind,
    isPlaceholder: true,
  }));

  return [...assetShelfItems, ...placeholders].sort((left, right) => {
    if (left.stageIndex !== right.stageIndex) {
      return left.stageIndex - right.stageIndex;
    }
    if (left.isPlaceholder !== right.isPlaceholder) {
      return left.isPlaceholder ? 1 : -1;
    }
    return left.title.localeCompare(right.title);
  });
};

export const getWorkbenchStepFromLogs = (logs: string[]) => {
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const line = logs[index];
    const matchedPattern = LOG_STEP_PATTERNS.find(({ patterns }) =>
      patterns.some((pattern) => pattern.test(line))
    );
    if (matchedPattern) {
      return matchedPattern.step;
    }
  }
  return null;
};

export const getWorkbenchStepFromAssets = (assets: AutodrawAssetItem[]) => {
  const visibleAssets = getAutodrawVisibleAssetItems(assets).filter(
    (asset) => asset.stageIndex <= 3
  );
  if (!visibleAssets.length) {
    return null;
  }
  return visibleAssets.reduce((maxStep, asset) => {
    return Math.max(maxStep, asset.stageIndex);
  }, 0);
};

export const getEffectiveWorkbenchStep = (payload: {
  status: AutodrawStatus;
  currentStage: number | null | undefined;
  failedStage: number | null | undefined;
  logs: string[];
  assets: AutodrawAssetItem[];
  hasImportedPreview?: boolean;
}): number => {
  if (
    payload.status === 'importing' ||
    payload.status === 'succeeded' ||
    payload.hasImportedPreview
  ) {
    return 4;
  }

  const baseStep = getWorkbenchStepForStatus(
    payload.status,
    payload.currentStage,
    payload.failedStage
  );
  const logStep = getWorkbenchStepFromLogs(payload.logs);
  const assetStep = getWorkbenchStepFromAssets(payload.assets);
  const effectiveSteps = [baseStep, logStep, assetStep].filter(
    (step): step is number => typeof step === 'number'
  );
  return effectiveSteps.length ? Math.max(...effectiveSteps) : 0;
};

export const getAutodrawSpotlightAsset = (
  assets: AutodrawAssetItem[],
  options?: AutodrawSpotlightOptions
) => {
  const visibleAssets = getAutodrawVisibleAssetItems(assets);
  if (!visibleAssets.length) {
    return undefined;
  }

  const preferredStep = options?.preferredStep;
  if (typeof preferredStep === 'number') {
    if (preferredStep >= 4) {
      return [...visibleAssets].sort((left, right) => {
        if (left.stageIndex !== right.stageIndex) {
          return right.stageIndex - left.stageIndex;
        }
        return left.priority - right.priority;
      })[0];
    }

    const exactStageAssets = visibleAssets.filter(
      (asset) => asset.stageIndex === preferredStep
    );
    if (exactStageAssets.length) {
      return [...exactStageAssets].sort((left, right) => {
        if (left.priority !== right.priority) {
          return left.priority - right.priority;
        }
        return left.name.localeCompare(right.name);
      })[0];
    }

    if (options?.strictStep) {
      return undefined;
    }
  }

  return [...visibleAssets].sort((left, right) => {
    if (left.stageIndex !== right.stageIndex) {
      return right.stageIndex - left.stageIndex;
    }
    return left.priority - right.priority;
  })[0];
};

export const upsertAutodrawHistory = (
  entries: AutodrawHistoryEntry[],
  entry: AutodrawHistoryEntry,
  limit = 12
) => {
  const nextEntries = [
    entry,
    ...entries.filter((item) => item.id !== entry.id),
  ];
  nextEntries.sort((left, right) => {
    return (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });
  return nextEntries.slice(0, limit);
};

export const mapBackendStageToWorkbenchStep = (
  stage: number | null | undefined
) => {
  if (!stage || stage <= 1) {
    return 0;
  }
  if (stage === 2) {
    return 1;
  }
  if (stage === 3) {
    return 2;
  }
  return 3;
};

export const getWorkbenchStepForStatus = (
  status: AutodrawStatus,
  currentStage: number | null | undefined,
  failedStage: number | null | undefined
) => {
  if (status === 'importing' || status === 'succeeded') {
    return 4;
  }
  if (status === 'failed') {
    return mapBackendStageToWorkbenchStep(failedStage ?? currentStage);
  }
  if (status === 'running') {
    return mapBackendStageToWorkbenchStep(currentStage);
  }
  return 0;
};

export const getWorkbenchProgressRatio = (
  status: AutodrawStatus,
  currentStage: number | null | undefined,
  failedStage: number | null | undefined,
  stepOverride?: number | null
) => {
  if (status === 'idle') {
    return 0.04;
  }
  if (status === 'submitting' || status === 'queued') {
    return 0.12;
  }
  if (status === 'succeeded') {
    return 1;
  }

  const step =
    typeof stepOverride === 'number'
      ? stepOverride
      : getWorkbenchStepForStatus(status, currentStage, failedStage);
  if (status === 'failed') {
    return Math.min(1, (step + 1) / 5);
  }
  if (status === 'importing') {
    return 0.96;
  }
  return Math.min(0.92, (step + 0.62) / 5);
};
