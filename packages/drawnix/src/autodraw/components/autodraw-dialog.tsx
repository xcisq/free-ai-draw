import classNames from 'classnames';
import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import '../styles/autodraw-dialog.scss';
import { useBoard } from '@plait-board/react-board';
import {
  getViewportOrigination,
  PlaitBoard,
  PlaitElement,
  PlaitGroupElement,
  PlaitHistoryBoard,
  Point,
  RectangleClient,
  Transforms,
  WritableClipboardOperationType,
} from '@plait/core';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import { SvgImportSummary } from '../../svg-import/convert-svg-to-drawnix';
import { importBundlePackage } from '../../scene-import/import-bundle-package';
import { scaleTextMetricBag } from './autodraw-text-scale';
import {
  AutodrawReferenceDirectoryHandle,
  AutodrawReferenceGalleryItemFile,
  clearStoredAutodrawReferenceDirectory,
  ensureAutodrawReferenceDirectoryPermission,
  isAutodrawReferenceGallerySupported,
  loadStoredAutodrawReferenceDirectory,
  readAutodrawReferenceGallery,
  requestAutodrawReferenceDirectory,
  saveStoredAutodrawReferenceDirectory,
} from './autodraw-reference-gallery';
import {
  AutodrawStatus,
  AutodrawArtifact,
  AutodrawAssetItem,
  AutodrawAssetShelfItem,
  AutodrawHistoryEntry,
  buildAutodrawAssetShelfItems,
  buildAssemblyBatches,
  getEffectiveWorkbenchStep,
  getAutodrawSpotlightAsset,
  getWorkbenchProgressRatio,
  mergeAutodrawArtifacts,
  toAutodrawAssetItems,
  upsertAutodrawHistory,
} from './autodraw-dialog.utils';

interface UploadReferenceImageResponse {
  upload_id: string;
  file_name: string;
  stored_path: string;
  content_type?: string | null;
  size_bytes: number;
}

interface CreateJobResponse {
  job_id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
}

interface JobResponse {
  job_id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error_message?: string | null;
  bundle_url?: string | null;
  artifacts?: AutodrawArtifact[];
  failed_stage?: number | null;
  current_stage?: number;
  source_job_id?: string | null;
  created_at?: string;
  request?: {
    job_type?: 'autodraw' | 'image-edit';
  };
}

interface JobLogChunkResponse {
  job_id: string;
  offset: number;
  next_offset: number;
  completed: boolean;
  lines: string[];
}

interface JobListItemResponse {
  job_id: string;
  job_type?: 'autodraw' | 'image-edit';
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  error_message?: string | null;
  artifacts?: AutodrawArtifact[];
  bundle_url?: string | null;
  current_stage?: number;
  failed_stage?: number | null;
}

type AssemblyProgress = {
  active: boolean;
  totalBatches: number;
  completedBatches: number;
  insertedCount: number;
};

type WorkbenchStageDefinition = {
  key: string;
  label: string;
  stepNumber: string;
};

type ActivityTab = 'timeline' | 'logs';

type AssetPreviewState = {
  asset: AutodrawAssetItem;
};

type ReferenceSource = 'gallery' | 'upload' | null;

type ReferenceGalleryState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'needs-permission'
  | 'unsupported'
  | 'error';

type ReferenceGalleryItem = AutodrawReferenceGalleryItemFile & {
  previewUrl: string;
};

type AutodrawPersistedDraft = {
  backendUrl?: string;
  methodText?: string;
  provider?: string;
  baseUrl?: string;
  imageModel?: string;
  svgModel?: string;
  jobId?: string;
  jobIdInput?: string;
  showAdvanced?: boolean;
  galleryDirectoryName?: string;
  selectedGalleryItemId?: string;
  referenceSource?: ReferenceSource;
};

const readDefaultBackendUrl = () => {
  if (
    typeof process !== 'undefined' &&
    typeof process.env?.VITE_AUTODRAW_BACKEND_URL === 'string'
  ) {
    const envValue = process.env.VITE_AUTODRAW_BACKEND_URL.trim();
    if (envValue) {
      return envValue;
    }
  }
  return 'http://127.0.0.1:8001';
};

const DEFAULT_BACKEND_URL = readDefaultBackendUrl();
const AUTODRAW_HISTORY_STORAGE_KEY = 'drawnix:autodraw-history:v1';
const AUTODRAW_DRAFT_STORAGE_KEY = 'drawnix:autodraw-draft:v2';
const AUTODRAW_REALTIME_POLL_INTERVAL = 1200;
const AUTODRAW_ASSEMBLY_LEAD_IN_DELAY = 220;
const AUTODRAW_ASSEMBLY_ENTER_BASE_DURATION = 340;
const AUTODRAW_REALTIME_PROBE_DEFINITIONS = [
  {
    name: 'figure.png',
    path: 'figure.png',
    kind: 'figure',
    minStep: 0,
  },
  {
    name: 'samed.png',
    path: 'samed.png',
    kind: 'samed',
    minStep: 1,
  },
  {
    name: 'template.svg',
    path: 'template.svg',
    kind: 'template_svg',
    minStep: 3,
  },
  {
    name: 'optimized_template.svg',
    path: 'optimized_template.svg',
    kind: 'optimized_template_svg',
    minStep: 3,
  },
  {
    name: 'final.svg',
    path: 'final.svg',
    kind: 'final_svg',
    minStep: 3,
  },
] as const;

const emptySummary: SvgImportSummary = {
  textCount: 0,
  arrowCount: 0,
  rectCount: 0,
  componentCount: 0,
  ignoredBackgroundCount: 0,
  warnings: [],
};

const initialAssemblyProgress: AssemblyProgress = {
  active: false,
  totalBatches: 0,
  completedBatches: 0,
  insertedCount: 0,
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');
const IMPORT_MAX_VIEWPORT_WIDTH_RATIO = 2.4;
const IMPORT_MAX_VIEWPORT_HEIGHT_RATIO = 2.2;

const createAutodrawHistorySessionId = (jobId: string) =>
  `job:${jobId}:${Date.now()}`;

const createRealtimeProbeArtifact = (
  jobId: string,
  definition: (typeof AUTODRAW_REALTIME_PROBE_DEFINITIONS)[number]
): AutodrawArtifact => ({
  name: definition.name,
  path: definition.path,
  kind: definition.kind,
  size_bytes: 0,
  download_url: `/api/jobs/${jobId}/artifacts/${definition.path}`,
});

const loadPersistedAutodrawDraft = (): AutodrawPersistedDraft => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const payload = window.localStorage.getItem(AUTODRAW_DRAFT_STORAGE_KEY);
    if (!payload) {
      return {};
    }
    const parsed = JSON.parse(payload) as AutodrawPersistedDraft;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const getElementRectangle = (elements: PlaitElement[]) => {
  const rectangles = elements.flatMap((element) => {
    if (PlaitGroupElement.isGroup(element)) {
      return [];
    }
    const points = (element as { points?: Point[] }).points;
    if (!Array.isArray(points) || points.length < 2) {
      return [];
    }
    return [RectangleClient.getRectangleByPoints(points)];
  });
  return rectangles.length
    ? RectangleClient.getBoundingRectangle(rectangles)
    : { x: 0, y: 0, width: 0, height: 0 };
};

const roundScaleValue = (value: number) => Math.round(value * 1000) / 1000;
const roundTextScaleFactor = (value: number) => Math.round(value * 100) / 100;
const filterAutodrawHistoryEntries = (entries: AutodrawHistoryEntry[]) =>
  entries.filter((entry) => entry.jobType !== 'image-edit');

const wait = (duration: number) =>
  new Promise<void>((resolve) => {
    const effectiveDuration =
      typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
        ? Math.min(duration, 12)
        : duration;
    window.setTimeout(() => resolve(), effectiveDuration);
  });

const getAssemblyBatchDelay = (
  batch: PlaitElement[],
  index: number,
  totalBatches: number
) => {
  const hasText = batch.some((element) => {
    const candidate = element as {
      shape?: string;
      text?: unknown;
      textStyle?: unknown;
    };
    return (
      candidate.shape === 'text' ||
      Boolean(candidate.text && candidate.textStyle)
    );
  });
  const hasArrow = batch.some(
    (element) => (element as { type?: string }).type === 'arrow-line'
  );
  const hasImage = batch.some(
    (element) => (element as { type?: string }).type === 'image'
  );

  let delay = 210;
  if (hasText) {
    delay = 280;
  } else if (hasArrow) {
    delay = 220;
  } else if (hasImage) {
    delay = 240;
  } else {
    delay = 300;
  }

  delay += Math.min(90, Math.max(0, batch.length - 1) * 26);

  if (index === 0) {
    delay += 90;
  }
  if (index === totalBatches - 2) {
    delay += 70;
  }

  return delay;
};

const getAssemblyBatchEnterProfile = (batch: PlaitElement[]) => {
  const hasText = batch.some((element) => {
    const candidate = element as {
      shape?: string;
      text?: unknown;
      textStyle?: unknown;
    };
    return (
      candidate.shape === 'text' ||
      Boolean(candidate.text && candidate.textStyle)
    );
  });
  const hasArrow = batch.some(
    (element) => (element as { type?: string }).type === 'arrow-line'
  );
  const hasImage = batch.some(
    (element) => (element as { type?: string }).type === 'image'
  );

  if (hasText) {
    return {
      translateY: 14,
      scale: 0.992,
      duration: AUTODRAW_ASSEMBLY_ENTER_BASE_DURATION,
      stagger: 26,
    };
  }

  if (hasArrow) {
    return {
      translateY: 18,
      scale: 0.988,
      duration: AUTODRAW_ASSEMBLY_ENTER_BASE_DURATION + 20,
      stagger: 30,
    };
  }

  if (hasImage) {
    return {
      translateY: 22,
      scale: 0.984,
      duration: AUTODRAW_ASSEMBLY_ENTER_BASE_DURATION + 35,
      stagger: 34,
    };
  }

  return {
    translateY: 26,
    scale: 0.978,
    duration: AUTODRAW_ASSEMBLY_ENTER_BASE_DURATION + 50,
    stagger: 38,
  };
};

const collectElementIds = (elements: PlaitElement[]) => {
  const ids: string[] = [];
  const visit = (element: PlaitElement) => {
    if (typeof (element as { id?: string }).id === 'string') {
      ids.push((element as { id: string }).id);
    }
    if (Array.isArray(element.children)) {
      element.children.forEach((child) => visit(child));
    }
  };
  elements.forEach((element) => visit(element));
  return ids;
};

const flattenBoardElements = (elements: PlaitElement[]): PlaitElement[] => {
  return elements.flatMap((element) => {
    const children = Array.isArray(
      (element as { children?: PlaitElement[] }).children
    )
      ? flattenBoardElements((element as { children: PlaitElement[] }).children)
      : [];
    return [element, ...children];
  });
};

const scaleTextLeafMetrics = (
  value: unknown,
  scaleStyleMetric: (value: unknown) => unknown
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => scaleTextLeafMetrics(item, scaleStyleMetric));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const next = { ...(value as Record<string, unknown>) };
  if (typeof next['text'] === 'string') {
    next['font-size'] = scaleStyleMetric(next['font-size']);
    next['line-height'] = scaleStyleMetric(next['line-height']);
    next['letter-spacing'] = scaleStyleMetric(next['letter-spacing']);
    return next;
  }
  if (Array.isArray(next['children'])) {
    next['children'] = (next['children'] as unknown[]).map((child) =>
      scaleTextLeafMetrics(child, scaleStyleMetric)
    );
  }
  return next;
};

const scaleImportedElements = (
  elements: PlaitElement[],
  boardContainerRect: DOMRect,
  zoom: number
) => {
  if (!elements.length) {
    return elements;
  }

  const elementRectangle = getElementRectangle(elements);
  if (!elementRectangle.width || !elementRectangle.height) {
    return elements;
  }

  const maxWidth =
    (boardContainerRect.width / zoom) * IMPORT_MAX_VIEWPORT_WIDTH_RATIO;
  const maxHeight =
    (boardContainerRect.height / zoom) * IMPORT_MAX_VIEWPORT_HEIGHT_RATIO;
  const scale = Math.min(
    1,
    maxWidth / elementRectangle.width,
    maxHeight / elementRectangle.height
  );
  if (scale >= 0.999) {
    return elements;
  }

  const anchor: Point = [elementRectangle.x, elementRectangle.y];
  const scalePoint = ([x, y]: Point): Point => [
    anchor[0] + (x - anchor[0]) * scale,
    anchor[1] + (y - anchor[1]) * scale,
  ];
  const scaleStyleMetric = (value: unknown) => {
    if (typeof value === 'number') {
      return roundScaleValue(value * scale);
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed)
        ? String(roundScaleValue(parsed * scale))
        : value;
    }
    return value;
  };

  const nextElements = JSON.parse(JSON.stringify(elements)) as PlaitElement[];
  const visit = (element: PlaitElement) => {
    const mutableElement = element as unknown as Record<string, unknown> & {
      points?: Point[];
      children?: PlaitElement[];
    };
    if (Array.isArray(element.points)) {
      element.points = element.points.map((point) =>
        scalePoint(point as Point)
      );
    }
    if (typeof mutableElement.strokeWidth === 'number') {
      mutableElement.strokeWidth = roundScaleValue(
        (mutableElement.strokeWidth as number) * scale
      );
    }
    if (typeof mutableElement.radius === 'number') {
      mutableElement.radius = roundScaleValue(
        (mutableElement.radius as number) * scale
      );
    }
    if (
      mutableElement.textStyle &&
      typeof mutableElement.textStyle === 'object'
    ) {
      mutableElement.textStyle = scaleTextMetricBag(
        mutableElement.textStyle,
        scaleStyleMetric
      );
    }
    if (
      mutableElement.textProperties &&
      typeof mutableElement.textProperties === 'object'
    ) {
      mutableElement.textProperties = scaleTextMetricBag(
        mutableElement.textProperties,
        scaleStyleMetric
      );
    }
    if (mutableElement.text) {
      mutableElement.text = scaleTextLeafMetrics(
        mutableElement.text,
        scaleStyleMetric
      );
    }
    if (Array.isArray(element.children)) {
      element.children.forEach((child) => visit(child));
    }
  };

  nextElements.forEach((element) => visit(element));
  return nextElements;
};

const AutodrawDialog = () => {
  const { appState, setAppState } = useDrawnix();
  const { t } = useI18n();
  const board = useBoard();
  const persistedDraftRef = useRef<AutodrawPersistedDraft>(
    loadPersistedAutodrawDraft()
  );
  const initialBackendUrlRef = useRef(
    persistedDraftRef.current.backendUrl || DEFAULT_BACKEND_URL
  );

  const [backendUrl, setBackendUrl] = useState(
    persistedDraftRef.current.backendUrl || DEFAULT_BACKEND_URL
  );
  const [methodText, setMethodText] = useState(
    persistedDraftRef.current.methodText || ''
  );
  const [provider, setProvider] = useState(
    persistedDraftRef.current.provider || 'qingyun'
  );
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(
    persistedDraftRef.current.baseUrl || ''
  );
  const [imageModel, setImageModel] = useState(
    persistedDraftRef.current.imageModel || ''
  );
  const [svgModel, setSvgModel] = useState(
    persistedDraftRef.current.svgModel || ''
  );
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceSource, setReferenceSource] = useState<ReferenceSource>(
    persistedDraftRef.current.referenceSource === 'gallery' ? 'gallery' : null
  );
  const [bundleFileName, setBundleFileName] = useState('');
  const [referencePreviewUrl, setReferencePreviewUrl] = useState('');
  const [jobId, setJobId] = useState(persistedDraftRef.current.jobId || '');
  const [jobIdInput, setJobIdInput] = useState(
    persistedDraftRef.current.jobIdInput ||
      persistedDraftRef.current.jobId ||
      ''
  );
  const [jobIdCopied, setJobIdCopied] = useState(false);
  const [currentStage, setCurrentStage] = useState<number | null>(null);
  const [failedStage, setFailedStage] = useState<number | null>(null);
  const [status, setStatus] = useState<AutodrawStatus>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [artifacts, setArtifacts] = useState<AutodrawArtifact[]>([]);
  const [realtimeArtifacts, setRealtimeArtifacts] = useState<
    AutodrawArtifact[]
  >([]);
  const [historyEntries, setHistoryEntries] = useState<AutodrawHistoryEntry[]>(
    []
  );
  const [logMode, setLogMode] = useState<'idle' | 'sse' | 'polling'>('idle');
  const [summary, setSummary] = useState<SvgImportSummary>(emptySummary);
  const [previewElements, setPreviewElements] = useState<PlaitElement[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastImportedElementIds, setLastImportedElementIds] = useState<
    string[]
  >([]);
  const [lastImportedTextScale, setLastImportedTextScale] = useState(1);
  const [assemblyProgress, setAssemblyProgress] = useState<AssemblyProgress>(
    initialAssemblyProgress
  );
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(persistedDraftRef.current.showAdvanced)
  );
  const [activityTab, setActivityTab] = useState<ActivityTab>('timeline');
  const [assetPreview, setAssetPreview] = useState<AssetPreviewState | null>(
    null
  );
  const [isWorkbenchDocked, setIsWorkbenchDocked] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [galleryItems, setGalleryItems] = useState<ReferenceGalleryItem[]>([]);
  const [galleryState, setGalleryState] = useState<ReferenceGalleryState>(() =>
    isAutodrawReferenceGallerySupported() ? 'idle' : 'unsupported'
  );
  const [galleryDirectoryName, setGalleryDirectoryName] = useState(
    persistedDraftRef.current.galleryDirectoryName || ''
  );
  const [galleryMessage, setGalleryMessage] = useState('');
  const [selectedGalleryItemId, setSelectedGalleryItemId] = useState(
    persistedDraftRef.current.selectedGalleryItemId || ''
  );

  const rootRef = useRef<HTMLDivElement | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  const logPollingTimerRef = useRef<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const activeHistoryEntryIdRef = useRef('');
  const logPanelRef = useRef<HTMLPreElement | null>(null);
  const assemblyRunIdRef = useRef(0);
  const copyTimerRef = useRef<number | null>(null);
  const galleryDirectoryHandleRef =
    useRef<AutodrawReferenceDirectoryHandle | null>(null);
  const galleryPreviewUrlsRef = useRef<string[]>([]);

  const disposeGalleryPreviewUrls = () => {
    galleryPreviewUrlsRef.current.forEach((previewUrl) => {
      window.URL.revokeObjectURL(previewUrl);
    });
    galleryPreviewUrlsRef.current = [];
  };

  const replaceGalleryItems = (
    nextItems: AutodrawReferenceGalleryItemFile[]
  ) => {
    disposeGalleryPreviewUrls();
    const hydratedItems = nextItems.map((item) => ({
      ...item,
      previewUrl: window.URL.createObjectURL(item.file),
    }));
    galleryPreviewUrlsRef.current = hydratedItems.map(
      (item) => item.previewUrl
    );
    setGalleryItems(hydratedItems);
    return hydratedItems;
  };

  const loadReferenceGalleryFromHandle = async (
    handle: AutodrawReferenceDirectoryHandle,
    options?: {
      applySelection?: boolean;
      preferredItemId?: string;
    }
  ) => {
    setGalleryState('loading');
    setGalleryMessage('');

    try {
      const granted = await ensureAutodrawReferenceDirectoryPermission(handle);
      if (!granted) {
        setGalleryState('needs-permission');
        setGalleryMessage(t('dialog.autodraw.galleryPermissionHint'));
        return [];
      }

      const nextFiles = await readAutodrawReferenceGallery(handle);
      const hydratedItems = replaceGalleryItems(nextFiles);
      galleryDirectoryHandleRef.current = handle;
      setGalleryDirectoryName(handle.name || '');
      setGalleryState('ready');

      const preferredItemId =
        options?.preferredItemId ||
        persistedDraftRef.current.selectedGalleryItemId ||
        '';
      const matchedItem = hydratedItems.find(
        (item) => item.id === preferredItemId
      );
      const nextSelectedId = matchedItem?.id || '';

      setSelectedGalleryItemId(nextSelectedId);
      if (options?.applySelection) {
        if (matchedItem) {
          setReferenceImage(matchedItem.file);
          setReferenceSource('gallery');
        } else {
          setReferenceImage(null);
          setReferenceSource(null);
          if (preferredItemId) {
            setGalleryMessage(t('dialog.autodraw.galleryMissingSelection'));
          }
        }
      }

      if (!hydratedItems.length) {
        setGalleryMessage(t('dialog.autodraw.galleryEmpty'));
      }

      return hydratedItems;
    } catch (error) {
      setGalleryState('error');
      setGalleryMessage(
        error instanceof Error
          ? error.message
          : t('dialog.autodraw.galleryLoadFailed')
      );
      return [];
    }
  };

  useEffect(() => {
    if (!referenceImage) {
      setReferencePreviewUrl('');
      return;
    }
    const url = window.URL.createObjectURL(referenceImage);
    setReferencePreviewUrl(url);
    return () => {
      window.URL.revokeObjectURL(url);
    };
  }, [referenceImage]);

  useEffect(() => {
    if (!logPanelRef.current || !autoScroll) {
      return;
    }
    logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
  }, [logs, autoScroll]);

  useEffect(() => {
    if (status === 'failed') {
      setShowAdvanced(true);
      setIsWorkbenchDocked(false);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'importing') {
      setIsWorkbenchDocked(true);
    }
  }, [status]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const payload = window.localStorage.getItem(AUTODRAW_HISTORY_STORAGE_KEY);
      if (!payload) {
        return;
      }
      const parsed = JSON.parse(payload) as AutodrawHistoryEntry[];
      if (Array.isArray(parsed)) {
        setHistoryEntries(filterAutodrawHistoryEntries(parsed));
      }
    } catch {
      // ignore invalid history payload
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let cancelled = false;
    const base = normalizeBaseUrl(initialBackendUrlRef.current);

    const loadRuntimeJobs = async () => {
      try {
        const response = await fetch(`${base}/api/jobs?limit=20&offset=0`);
        if (!response.ok) {
          return;
        }
        const items: JobListItemResponse[] = await response.json();
        if (cancelled || !Array.isArray(items) || items.length === 0) {
          return;
        }

        setHistoryEntries((current) => {
          const imageEditJobIds = new Set(
            items
              .filter((item) => item?.job_type === 'image-edit')
              .map((item) => item.job_id)
              .filter((jobId): jobId is string => Boolean(jobId))
          );
          let nextEntries = filterAutodrawHistoryEntries(
            current.filter(
              (entry) => !entry.jobId || !imageEditJobIds.has(entry.jobId)
            )
          );
          for (const item of items) {
            const jobId = item?.job_id;
            if (!jobId || typeof jobId !== 'string') {
              continue;
            }
            if (item.job_type === 'image-edit') {
              continue;
            }
            if (nextEntries.some((entry) => entry.jobId === jobId)) {
              continue;
            }
            const artifacts = Array.isArray(item.artifacts)
              ? item.artifacts
              : [];
            const previewAsset = getAutodrawSpotlightAsset(
              toAutodrawAssetItems(artifacts, base)
            );
            const createdAt =
              typeof item.created_at === 'string' && item.created_at
                ? item.created_at
                : new Date().toISOString();
            nextEntries = upsertAutodrawHistory(nextEntries, {
              id: `job:${jobId}`,
              type: 'job',
              jobType: 'autodraw',
              title: jobId,
              subtitle: 'Runtime job',
              status: item.status as AutodrawStatus,
              createdAt,
              jobId,
              previewUrl: previewAsset?.url,
            });
          }
          return nextEntries;
        });
      } catch {
        // ignore runtime jobs listing failures
      }
    };

    void loadRuntimeJobs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      AUTODRAW_HISTORY_STORAGE_KEY,
      JSON.stringify(historyEntries)
    );
  }, [historyEntries]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const draft: AutodrawPersistedDraft = {
      backendUrl,
      methodText,
      provider,
      baseUrl,
      imageModel,
      svgModel,
      jobId,
      jobIdInput,
      showAdvanced,
      galleryDirectoryName,
      selectedGalleryItemId,
      referenceSource: referenceSource === 'gallery' ? 'gallery' : null,
    };
    window.localStorage.setItem(
      AUTODRAW_DRAFT_STORAGE_KEY,
      JSON.stringify(draft)
    );
  }, [
    backendUrl,
    methodText,
    provider,
    baseUrl,
    imageModel,
    svgModel,
    jobId,
    jobIdInput,
    showAdvanced,
    galleryDirectoryName,
    selectedGalleryItemId,
    referenceSource,
  ]);

  useEffect(() => {
    let active = true;
    if (!isAutodrawReferenceGallerySupported()) {
      return () => {
        active = false;
      };
    }

    void loadStoredAutodrawReferenceDirectory()
      .then((storedHandle) => {
        if (!active || !storedHandle) {
          return;
        }
        galleryDirectoryHandleRef.current = storedHandle;
        setGalleryDirectoryName(
          storedHandle.name ||
            persistedDraftRef.current.galleryDirectoryName ||
            ''
        );
        return loadReferenceGalleryFromHandle(storedHandle, {
          applySelection:
            persistedDraftRef.current.referenceSource === 'gallery',
          preferredItemId: persistedDraftRef.current.selectedGalleryItemId,
        });
      })
      .catch(() => {
        setGalleryState('idle');
      });

    return () => {
      active = false;
      disposeGalleryPreviewUrls();
    };
  }, [t]);

  useEffect(() => {
    const root = rootRef.current;
    const overlay = root?.closest('.Dialog-overlay');
    const modal = root?.closest('.autodraw-dialog-modal');

    overlay?.classList.toggle(
      'autodraw-dialog-overlay--peek',
      isWorkbenchDocked
    );
    modal?.classList.toggle('autodraw-dialog-modal--docked', isWorkbenchDocked);

    return () => {
      overlay?.classList.remove('autodraw-dialog-overlay--peek');
      modal?.classList.remove('autodraw-dialog-modal--docked');
    };
  }, [isWorkbenchDocked]);

  useEffect(() => {
    return () => {
      assemblyRunIdRef.current += 1;
      if (pollingTimerRef.current) {
        window.clearTimeout(pollingTimerRef.current);
      }
      if (logPollingTimerRef.current) {
        window.clearTimeout(logPollingTimerRef.current);
      }
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      disposeGalleryPreviewUrls();
      eventSourceRef.current?.close();
    };
  }, []);

  const workbenchStages = useMemo<WorkbenchStageDefinition[]>(
    () => [
      {
        key: 'generate',
        label: t('dialog.autodraw.stage.generateFigure'),
        stepNumber: '01',
      },
      {
        key: 'parse',
        label: t('dialog.autodraw.stage.parseStructure'),
        stepNumber: '02',
      },
      {
        key: 'extract',
        label: t('dialog.autodraw.stage.extractAssets'),
        stepNumber: '03',
      },
      {
        key: 'rebuild',
        label: t('dialog.autodraw.stage.rebuildSvg'),
        stepNumber: '04',
      },
      {
        key: 'import',
        label: t('dialog.autodraw.stage.importCanvas'),
        stepNumber: '05',
      },
    ],
    [t]
  );

  const workbenchStageLabels = useMemo(
    () => workbenchStages.map((stage) => stage.label),
    [workbenchStages]
  );

  const summaryItems = useMemo(
    () => [
      {
        label: t('dialog.autodraw.summary.texts'),
        value: summary.textCount,
      },
      {
        label: t('dialog.autodraw.summary.arrows'),
        value: summary.arrowCount,
      },
      {
        label: t('dialog.autodraw.summary.components'),
        value: summary.componentCount,
      },
    ],
    [summary, t]
  );

  const statusLabel = useMemo(() => {
    if (status === 'idle') {
      return t('dialog.autodraw.status.idle');
    }
    if (status === 'queued') {
      return t('dialog.autodraw.status.queued');
    }
    if (status === 'running') {
      return t('dialog.autodraw.status.running');
    }
    if (status === 'submitting') {
      return t('dialog.autodraw.status.submitting');
    }
    if (status === 'importing') {
      return t('dialog.autodraw.status.importing');
    }
    if (status === 'succeeded') {
      return t('dialog.autodraw.status.succeeded');
    }
    return t('dialog.autodraw.status.failed');
  }, [status, t]);

  const hasImportedPreview =
    previewElements.length > 0 ||
    assemblyProgress.completedBatches > 0 ||
    status === 'succeeded';

  const filteredLogs = useMemo(() => {
    if (!logFilter.trim()) {
      return logs;
    }
    const lowerFilter = logFilter.toLowerCase();
    return logs.filter((line) => line.toLowerCase().includes(lowerFilter));
  }, [logs, logFilter]);

  const batchPreviewCount = useMemo(() => {
    if (assemblyProgress.totalBatches > 0) {
      return assemblyProgress.totalBatches;
    }
    if (!previewElements.length) {
      return 4;
    }
    return Math.min(8, Math.max(4, Math.ceil(previewElements.length / 3)));
  }, [assemblyProgress.totalBatches, previewElements.length]);

  const canAdjustTextScale = lastImportedElementIds.length > 0;
  const isJobBusy =
    status === 'submitting' ||
    status === 'queued' ||
    status === 'running' ||
    status === 'importing';

  const mergedArtifacts = useMemo(
    () => mergeAutodrawArtifacts(artifacts, realtimeArtifacts),
    [artifacts, realtimeArtifacts]
  );

  const assetItems = useMemo(
    () => toAutodrawAssetItems(mergedArtifacts, backendUrl),
    [backendUrl, mergedArtifacts]
  );

  const activeWorkbenchStep = useMemo(
    () =>
      getEffectiveWorkbenchStep({
        status,
        currentStage,
        failedStage,
        logs,
        assets: assetItems,
        hasImportedPreview,
      }),
    [assetItems, currentStage, failedStage, hasImportedPreview, logs, status]
  );

  const assetShelfItems = useMemo<AutodrawAssetShelfItem[]>(
    () =>
      buildAutodrawAssetShelfItems({
        assets: assetItems,
        activeStep: activeWorkbenchStep,
        isBusy: isJobBusy,
        stageLabels: workbenchStageLabels,
      }),
    [activeWorkbenchStep, assetItems, isJobBusy, workbenchStageLabels]
  );

  const spotlightAsset = useMemo(
    () =>
      getAutodrawSpotlightAsset(assetItems, {
        preferredStep: activeWorkbenchStep,
        strictStep: isJobBusy && activeWorkbenchStep > 0,
      }),
    [activeWorkbenchStep, assetItems, isJobBusy]
  );

  const progressRatio = useMemo(
    () =>
      getWorkbenchProgressRatio(
        status,
        currentStage,
        failedStage,
        activeWorkbenchStep
      ),
    [activeWorkbenchStep, currentStage, failedStage, status]
  );

  const timelineItems = useMemo(() => logs.slice(-8).reverse(), [logs]);
  const selectedGalleryItem = useMemo(
    () =>
      galleryItems.find((item) => item.id === selectedGalleryItemId) || null,
    [galleryItems, selectedGalleryItemId]
  );

  const currentStageLabel =
    workbenchStages[Math.min(activeWorkbenchStep, workbenchStages.length - 1)]
      ?.label || t('dialog.autodraw.status.idle');

  const appendLogs = (nextLines: string[]) => {
    if (!nextLines.length) {
      return;
    }
    setLogs((current) => [...current, ...nextLines]);
  };

  const syncJobState = (nextJobId: string) => {
    setJobId(nextJobId);
    setJobIdInput(nextJobId);
    setJobIdCopied(false);
  };

  const rememberHistory = (entry: AutodrawHistoryEntry) => {
    setHistoryEntries((current) =>
      filterAutodrawHistoryEntries(upsertAutodrawHistory(current, entry))
    );
  };

  const rememberJobHistory = (payload: {
    historyId?: string;
    jobId: string;
    jobType?: 'autodraw' | 'image-edit';
    status: AutodrawStatus;
    createdAt?: string;
    summary?: SvgImportSummary;
    nextArtifacts?: AutodrawArtifact[];
  }) => {
    const assetPreviewItem = getAutodrawSpotlightAsset(
      toAutodrawAssetItems(payload.nextArtifacts || [], backendUrl)
    );
    const currentHistoryEntry = historyEntries.find(
      (entry) => entry.id === activeHistoryEntryIdRef.current
    );
    const historyId =
      payload.historyId ||
      (currentHistoryEntry?.jobId === payload.jobId
        ? currentHistoryEntry.id
        : '') ||
      historyEntries.find((entry) => entry.jobId === payload.jobId)?.id ||
      createAutodrawHistorySessionId(payload.jobId);
    activeHistoryEntryIdRef.current = historyId;
    rememberHistory({
      id: historyId,
      type: 'job',
      jobType: payload.jobType || 'autodraw',
      title: payload.jobId,
      subtitle: 'Generated job',
      status: payload.status,
      createdAt: payload.createdAt || new Date().toISOString(),
      jobId: payload.jobId,
      previewUrl: assetPreviewItem?.url,
      summary: payload.summary
        ? {
            textCount: payload.summary.textCount,
            arrowCount: payload.summary.arrowCount,
            componentCount: payload.summary.componentCount,
          }
        : undefined,
    });
  };

  const rememberBundleHistory = (payload: {
    bundleName: string;
    summary: SvgImportSummary;
  }) => {
    rememberHistory({
      id: `bundle:${payload.bundleName}:${Date.now()}`,
      type: 'bundle',
      title: payload.bundleName,
      subtitle: 'Local ZIP',
      status: 'local',
      createdAt: new Date().toISOString(),
      summary: {
        textCount: payload.summary.textCount,
        arrowCount: payload.summary.arrowCount,
        componentCount: payload.summary.componentCount,
      },
    });
  };

  const resetAssemblyState = () => {
    assemblyRunIdRef.current += 1;
    setAssemblyProgress(initialAssemblyProgress);
  };

  const stopLogStreaming = () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (logPollingTimerRef.current) {
      window.clearTimeout(logPollingTimerRef.current);
      logPollingTimerRef.current = null;
    }
    setLogMode('idle');
  };

  const startLogPolling = (currentJobId: string) => {
    setLogMode('polling');
    const base = normalizeBaseUrl(backendUrl);

    const fetchLogs = async (offset: number) => {
      try {
        const response = await fetch(
          `${base}/api/jobs/${currentJobId}/logs?offset=${offset}`
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const data: JobLogChunkResponse = await response.json();
        appendLogs(data.lines);
        if (!data.completed) {
          logPollingTimerRef.current = window.setTimeout(
            () => void fetchLogs(data.next_offset),
            1000
          );
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t('dialog.autodraw.error.logFailed')
        );
      }
    };

    void fetchLogs(0);
  };

  const startLogStreaming = (currentJobId: string) => {
    const base = normalizeBaseUrl(backendUrl);
    try {
      const source = new EventSource(
        `${base}/api/jobs/${currentJobId}/logs/stream`
      );
      eventSourceRef.current = source;
      setLogMode('sse');

      source.addEventListener('log', (event) => {
        const data = JSON.parse((event as MessageEvent).data) as {
          line: string;
        };
        appendLogs([data.line]);
      });

      source.addEventListener('end', () => {
        source.close();
        eventSourceRef.current = null;
        setLogMode('idle');
      });

      source.onerror = () => {
        source.close();
        eventSourceRef.current = null;
        startLogPolling(currentJobId);
      };
    } catch {
      startLogPolling(currentJobId);
    }
  };

  const applyTextScaleToLastImport = (scaleFactor: number) => {
    if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
      return;
    }
    if (Math.abs(scaleFactor - 1) < 0.001) {
      return;
    }
    if (!lastImportedElementIds.length) {
      return;
    }

    const idSet = new Set(lastImportedElementIds);
    const candidates = flattenBoardElements(board.children).filter((element) =>
      idSet.has(element.id)
    );
    const textCandidates = candidates.filter((element) => {
      const textStyle = (element as { textStyle?: unknown }).textStyle;
      return (
        textStyle &&
        typeof textStyle === 'object' &&
        Array.isArray((element as { points?: Point[] }).points) &&
        ((element as { points?: Point[] }).points?.length || 0) >= 2 &&
        Boolean((element as { text?: unknown }).text)
      );
    });

    if (!textCandidates.length) {
      return;
    }

    const scaleStyleMetric = (value: unknown) => {
      if (typeof value === 'number') {
        return roundScaleValue(value * scaleFactor);
      }
      if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed)
          ? String(roundScaleValue(parsed * scaleFactor))
          : value;
      }
      return value;
    };

    PlaitHistoryBoard.withNewBatch(board, () => {
      for (const element of textCandidates) {
        const path = PlaitBoard.findPath(board, element as never);
        const rawTextStyle = ((
          element as { textStyle?: Record<string, unknown> }
        ).textStyle || {}) as Record<string, unknown>;
        const align = (rawTextStyle.align as string) || 'left';
        const fontSizeValue =
          typeof rawTextStyle.fontSize === 'number'
            ? rawTextStyle.fontSize
            : typeof rawTextStyle['font-size'] === 'string'
            ? Number.parseFloat(rawTextStyle['font-size'] as string)
            : undefined;
        const nextFontSize =
          typeof fontSizeValue === 'number' && Number.isFinite(fontSizeValue)
            ? roundScaleValue(fontSizeValue * scaleFactor)
            : undefined;

        const [start, end] = ((element as { points?: [Point, Point] })
          .points || [
          [0, 0],
          [0, 0],
        ]) as [Point, Point];
        const width = end[0] - start[0];
        const height = end[1] - start[1];
        const nextWidth = width * scaleFactor;
        const nextHeight = height * scaleFactor;
        let nextLeft = start[0];
        if (align === 'center') {
          nextLeft = start[0] - (nextWidth - width) / 2;
        } else if (align === 'right') {
          nextLeft = start[0] - (nextWidth - width);
        }
        const nextTop = start[1] - (nextHeight - height) * 0.4;
        const nextPoints: [Point, Point] = [
          [nextLeft, nextTop],
          [nextLeft + nextWidth, nextTop + nextHeight],
        ];

        const nextTextStyle = scaleTextMetricBag(
          rawTextStyle,
          scaleStyleMetric
        ) as Record<string, unknown>;
        const rawTextProperties = ((
          element as { textProperties?: Record<string, unknown> }
        ).textProperties || {}) as Record<string, unknown>;
        const nextTextProperties = scaleTextMetricBag(
          rawTextProperties,
          scaleStyleMetric
        ) as Record<string, unknown>;
        const nextText = scaleTextLeafMetrics(
          (element as { text?: unknown }).text,
          scaleStyleMetric
        );
        if (nextFontSize !== undefined) {
          nextTextStyle.fontSize = nextFontSize;
          nextTextStyle['font-size'] = String(nextFontSize);
          nextTextProperties.fontSize = nextFontSize;
          nextTextProperties['font-size'] = String(nextFontSize);
        }

        Transforms.setNode(
          board,
          {
            points: nextPoints,
            textStyle: nextTextStyle,
            textProperties: nextTextProperties,
            text: nextText,
          },
          path
        );
      }
    });

    setLastImportedTextScale((value) =>
      roundTextScaleFactor(value * scaleFactor)
    );
  };

  const getImportPlacement = (elements: PlaitElement[]) => {
    const boardContainerRect =
      PlaitBoard.getBoardContainer(board).getBoundingClientRect();
    const focusPoint = [
      boardContainerRect.width / 2,
      boardContainerRect.height / 2,
    ];
    const zoom = board.viewport.zoom;
    const origination = getViewportOrigination(board);
    const centerX = (origination?.[0] || 0) + focusPoint[0] / zoom;
    const centerY = (origination?.[1] || 0) + focusPoint[1] / zoom;
    const sourceRectangle = getElementRectangle(elements);
    const startPoint = [
      centerX - sourceRectangle.width / 2,
      centerY - sourceRectangle.height / 2,
    ] as Point;
    return {
      boardContainerRect,
      sourceRectangle,
      startPoint,
    };
  };

  const insertElementsAtPoint = (
    elements: PlaitElement[],
    startPoint: Point
  ) => {
    const fragmentElements = JSON.parse(
      JSON.stringify(elements)
    ) as PlaitElement[];
    board.insertFragment(
      { elements: fragmentElements },
      startPoint,
      WritableClipboardOperationType.paste
    );
    return {
      ids: collectElementIds(fragmentElements),
      insertedElements: fragmentElements,
    };
  };

  const playBoardBatchEnterAnimation = (
    batchElements: PlaitElement[],
    batchIndex: number
  ) => {
    if (
      typeof window === 'undefined' ||
      typeof window.requestAnimationFrame !== 'function' ||
      typeof PlaitElement.getElementG !== 'function'
    ) {
      return;
    }

    const resolveTargets = () =>
      batchElements.flatMap((element) => {
        try {
          const target = PlaitElement.getElementG(element);
          return target ? [target] : [];
        } catch {
          return [];
        }
      });

    const profile = getAssemblyBatchEnterProfile(batchElements);
    const initialTranslateY =
      batchIndex === 0 ? profile.translateY + 6 : profile.translateY;

    const startAnimation = (targets: SVGGElement[]) => {
      targets.forEach((target) => {
        target.style.transition = 'none';
        target.style.opacity = '0';
        target.style.transformBox = 'fill-box';
        target.style.transformOrigin = 'center';
        target.style.transform = `translateY(${initialTranslateY}px) scale(${profile.scale})`;
        target.style.willChange = 'transform, opacity';
      });

      window.requestAnimationFrame(() => {
        targets.forEach((target, index) => {
          const enterDelay = index * profile.stagger;
          window.setTimeout(() => {
            target.style.transition = [
              `transform ${profile.duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
              `opacity ${Math.max(
                220,
                profile.duration - 30
              )}ms cubic-bezier(0.2, 0, 0, 1)`,
            ].join(', ');
            target.style.opacity = '1';
            target.style.transform = 'translateY(0) scale(1)';
          }, enterDelay);

          window.setTimeout(() => {
            target.style.willChange = '';
          }, enterDelay + profile.duration + 80);
        });
      });
    };

    const immediateTargets = resolveTargets();
    if (immediateTargets.length) {
      startAnimation(immediateTargets);
      return;
    }

    window.requestAnimationFrame(() => {
      const deferredTargets = resolveTargets();
      if (deferredTargets.length) {
        startAnimation(deferredTargets);
      }
    });
  };

  const insertElementsWithAssembly = async (elements: PlaitElement[]) => {
    if (!elements.length) {
      return [];
    }

    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const { startPoint } = getImportPlacement(elements);
    if (reducedMotion || elements.length <= 1) {
      const insertedBatch = insertElementsAtPoint(elements, startPoint);
      setAssemblyProgress({
        active: false,
        totalBatches: 1,
        completedBatches: 1,
        insertedCount: elements.length,
      });
      return insertedBatch.ids;
    }

    const batches = buildAssemblyBatches(elements);
    const runId = ++assemblyRunIdRef.current;
    const insertedIds: string[] = [];

    setAssemblyProgress({
      active: true,
      totalBatches: batches.length,
      completedBatches: 0,
      insertedCount: 0,
    });

    await wait(AUTODRAW_ASSEMBLY_LEAD_IN_DELAY);

    for (let index = 0; index < batches.length; index += 1) {
      if (runId !== assemblyRunIdRef.current) {
        return insertedIds;
      }
      const insertedBatch = insertElementsAtPoint(batches[index], startPoint);
      insertedIds.push(...insertedBatch.ids);
      playBoardBatchEnterAnimation(insertedBatch.insertedElements, index);
      setAssemblyProgress({
        active: index < batches.length - 1,
        totalBatches: batches.length,
        completedBatches: index + 1,
        insertedCount: insertedIds.length,
      });
      if (index < batches.length - 1) {
        await wait(
          getAssemblyBatchDelay(batches[index], index, batches.length)
        );
      }
    }

    if (runId !== assemblyRunIdRef.current) {
      return insertedIds;
    }

    return insertedIds;
  };

  const importBundle = async (
    currentJobId: string,
    bundleUrl: string,
    nextArtifacts?: AutodrawArtifact[]
  ) => {
    const response = await fetch(bundleUrl);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const blob = await response.blob();
    const file = new File([blob], `${currentJobId}.zip`, {
      type: 'application/zip',
    });
    await importBundleFile(file, { currentJobId, nextArtifacts });
  };

  const importBundleFile = async (
    file: File,
    options?: {
      currentJobId?: string;
      descriptionLine?: string;
      nextArtifacts?: AutodrawArtifact[];
    }
  ) => {
    setStatus('importing');
    if (options?.descriptionLine) {
      appendLogs([options.descriptionLine]);
    }
    const result = await importBundlePackage(file);
    if (result.importKind === 'svg' && result.fallbackReason) {
      appendLogs([
        `[scene-import] fallback to svg-import: ${result.fallbackReason}`,
      ]);
    }
    const { boardContainerRect } = getImportPlacement(result.elements);
    const normalizedElements = scaleImportedElements(
      result.elements,
      boardContainerRect,
      board.viewport.zoom
    );

    setPreviewElements(normalizedElements);
    setSummary(result.summary);
    const insertedElementIds = await insertElementsWithAssembly(
      normalizedElements
    );
    setLastImportedElementIds(
      insertedElementIds.length
        ? insertedElementIds
        : collectElementIds(normalizedElements)
    );
    setLastImportedTextScale(1);
    setCurrentStage(5);
    setFailedStage(null);
    setStatus('succeeded');

    if (options?.currentJobId) {
      syncJobState(options.currentJobId);
      rememberJobHistory({
        jobId: options.currentJobId,
        status: 'succeeded',
        summary: result.summary,
        nextArtifacts: options.nextArtifacts || artifacts,
      });
    } else {
      rememberBundleHistory({
        bundleName: file.name,
        summary: result.summary,
      });
    }
  };

  const handleJobError = (error: unknown) => {
    stopLogStreaming();
    resetAssemblyState();
    setStatus('failed');
    setErrorMessage(
      error instanceof Error
        ? error.message
        : t('dialog.autodraw.error.submitFailed')
    );
  };

  const pollJob = async (currentJobId: string) => {
    const base = normalizeBaseUrl(backendUrl);
    const response = await fetch(`${base}/api/jobs/${currentJobId}`);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data: JobResponse = await response.json();
    setStatus(data.status as AutodrawStatus);
    setCurrentStage(data.current_stage ?? null);
    setFailedStage(data.failed_stage ?? null);
    setArtifacts(data.artifacts ?? []);
    rememberJobHistory({
      historyId: activeHistoryEntryIdRef.current || undefined,
      jobId: data.job_id,
      status: data.status as AutodrawStatus,
      createdAt: data.created_at,
      nextArtifacts: data.artifacts ?? [],
    });

    if (data.status === 'queued' || data.status === 'running') {
      pollingTimerRef.current = window.setTimeout(() => {
        void pollJob(currentJobId).catch(handleJobError);
      }, 1000);
      return;
    }

    stopLogStreaming();

    if (data.status === 'failed') {
      setErrorMessage(
        data.error_message || t('dialog.autodraw.error.jobFailed')
      );
      return;
    }

    if (!data.bundle_url) {
      throw new Error(t('dialog.autodraw.error.noBundle'));
    }

    await importBundle(
      currentJobId,
      `${base}${data.bundle_url}`,
      data.artifacts
    );
    setStatus('succeeded');
    setFailedStage(null);
  };

  const loadJobLogs = async (currentJobId: string) => {
    const base = normalizeBaseUrl(backendUrl);
    const response = await fetch(
      `${base}/api/jobs/${currentJobId}/logs?offset=0`
    );
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data: JobLogChunkResponse = await response.json();
    setLogs(data.lines);
  };

  const resetWorkbench = () => {
    setErrorMessage('');
    setLogs([]);
    setArtifacts([]);
    setRealtimeArtifacts([]);
    setSummary(emptySummary);
    setPreviewElements([]);
    setLastImportedElementIds([]);
    setLastImportedTextScale(1);
    setCurrentStage(null);
    setFailedStage(null);
    setJobIdCopied(false);
    setAssetPreview(null);
    setActivityTab('timeline');
    resetAssemblyState();
  };

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !jobId ||
      !isJobBusy ||
      activeWorkbenchStep < 0
    ) {
      return;
    }

    let cancelled = false;
    const knownArtifactPaths = new Set(
      mergedArtifacts.map((artifact) => artifact.path)
    );
    const candidates = AUTODRAW_REALTIME_PROBE_DEFINITIONS.filter(
      (definition) =>
        definition.minStep <= Math.min(activeWorkbenchStep, 3) &&
        !knownArtifactPaths.has(definition.path)
    );

    if (!candidates.length) {
      return;
    }

    const probeArtifacts = async () => {
      const base = normalizeBaseUrl(backendUrl);
      const nextArtifacts = await Promise.all(
        candidates.map(async (definition) => {
          const probeUrl = `${base}/api/jobs/${jobId}/artifacts/${
            definition.path
          }?t=${Date.now()}`;
          try {
            const response = await fetch(probeUrl, {
              cache: 'no-store',
            });
            if (!response.ok) {
              return null;
            }
            return createRealtimeProbeArtifact(jobId, definition);
          } catch {
            return null;
          }
        })
      );

      if (cancelled) {
        return;
      }

      const discoveredArtifacts = nextArtifacts.filter(
        (artifact): artifact is AutodrawArtifact => Boolean(artifact)
      );
      if (!discoveredArtifacts.length) {
        return;
      }
      setRealtimeArtifacts((current) =>
        mergeAutodrawArtifacts(discoveredArtifacts, current)
      );
    };

    void probeArtifacts();

    const timer = window.setTimeout(() => {
      void probeArtifacts();
    }, AUTODRAW_REALTIME_POLL_INTERVAL);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeWorkbenchStep, backendUrl, isJobBusy, jobId, mergedArtifacts]);

  const loadJobById = async (currentJobId: string) => {
    if (!currentJobId.trim()) {
      return;
    }

    stopLogStreaming();
    resetWorkbench();

    try {
      const base = normalizeBaseUrl(backendUrl);
      const response = await fetch(`${base}/api/jobs/${currentJobId.trim()}`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data: JobResponse = await response.json();
      const currentHistoryEntry = historyEntries.find(
        (entry) => entry.id === activeHistoryEntryIdRef.current
      );
      activeHistoryEntryIdRef.current =
        (currentHistoryEntry?.jobId === data.job_id
          ? currentHistoryEntry.id
          : '') ||
        historyEntries.find((entry) => entry.jobId === data.job_id)?.id ||
        createAutodrawHistorySessionId(data.job_id);
      syncJobState(data.job_id);
      setStatus(data.status as AutodrawStatus);
      setCurrentStage(data.current_stage ?? null);
      setFailedStage(data.failed_stage ?? null);
      setArtifacts(data.artifacts ?? []);
      rememberJobHistory({
        historyId: activeHistoryEntryIdRef.current,
        jobId: data.job_id,
        jobType: data.request?.job_type || 'autodraw',
        status: data.status as AutodrawStatus,
        createdAt: data.created_at,
        nextArtifacts: data.artifacts ?? [],
      });
      await loadJobLogs(data.job_id);

      if (data.status === 'queued' || data.status === 'running') {
        startLogStreaming(data.job_id);
        await pollJob(data.job_id);
        return;
      }

      if (data.status === 'succeeded') {
        if (!data.bundle_url) {
          throw new Error(t('dialog.autodraw.error.noBundle'));
        }
        await importBundle(
          data.job_id,
          `${base}${data.bundle_url}`,
          data.artifacts
        );
      }
    } catch (error) {
      handleJobError(error);
    }
  };

  const loadExistingJob = async () => {
    await loadJobById(jobIdInput);
  };

  const handleSubmit = async () => {
    if (!methodText.trim()) {
      setErrorMessage(t('dialog.autodraw.error.noMethodText'));
      return;
    }

    stopLogStreaming();
    resetWorkbench();
    setIsWorkbenchDocked(false);
    setStatus('submitting');
    setCurrentStage(1);

    try {
      const base = normalizeBaseUrl(backendUrl);
      let referenceImagePath: string | undefined;

      if (referenceImage) {
        const formData = new FormData();
        formData.append('file', referenceImage);
        const uploadResponse = await fetch(
          `${base}/api/uploads/reference-image`,
          {
            method: 'POST',
            body: formData,
          }
        );
        if (!uploadResponse.ok) {
          throw new Error(await uploadResponse.text());
        }
        const uploadData: UploadReferenceImageResponse =
          await uploadResponse.json();
        referenceImagePath = uploadData.stored_path;
      }

      const response = await fetch(`${base}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method_text: methodText,
          provider,
          api_key: apiKey || null,
          base_url: baseUrl || null,
          image_model: imageModel || null,
          svg_model: svgModel || null,
          sam_backend: 'api',
          reference_image_path: referenceImagePath || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data: CreateJobResponse = await response.json();
      activeHistoryEntryIdRef.current = createAutodrawHistorySessionId(
        data.job_id
      );
      syncJobState(data.job_id);
      setStatus(data.status as AutodrawStatus);
      rememberJobHistory({
        historyId: activeHistoryEntryIdRef.current,
        jobId: data.job_id,
        status: data.status as AutodrawStatus,
      });
      startLogStreaming(data.job_id);
      await pollJob(data.job_id);
    } catch (error) {
      handleJobError(error);
    }
  };

  const handleResume = async () => {
    if (!jobId) {
      return;
    }

    appendLogs([
      '',
      `[resume] source_job_id=${jobId}`,
      `[resume] resume_from_stage=${failedStage ?? 'auto'}`,
    ]);

    try {
      const base = normalizeBaseUrl(backendUrl);
      stopLogStreaming();
      resetAssemblyState();
      const response = await fetch(`${base}/api/jobs/${jobId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resume_from_stage: 'auto',
          image_model: imageModel || null,
          svg_model: svgModel || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data: CreateJobResponse = await response.json();
      activeHistoryEntryIdRef.current = createAutodrawHistorySessionId(
        data.job_id
      );
      syncJobState(data.job_id);
      setFailedStage(null);
      setCurrentStage(1);
      setStatus(data.status as AutodrawStatus);
      setIsWorkbenchDocked(false);
      rememberJobHistory({
        historyId: activeHistoryEntryIdRef.current,
        jobId: data.job_id,
        status: data.status as AutodrawStatus,
      });
      startLogStreaming(data.job_id);
      await pollJob(data.job_id);
    } catch (error) {
      handleJobError(error);
    }
  };

  const handleChooseReferenceGallery = async () => {
    try {
      const handle = await requestAutodrawReferenceDirectory();
      await saveStoredAutodrawReferenceDirectory(handle);
      setGalleryDirectoryName(handle.name || '');
      setGalleryMessage('');
      galleryDirectoryHandleRef.current = handle;
      await loadReferenceGalleryFromHandle(handle, {
        applySelection: false,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setGalleryState('error');
      setGalleryMessage(
        error instanceof Error
          ? error.message
          : t('dialog.autodraw.galleryLoadFailed')
      );
    }
  };

  const handleRefreshReferenceGallery = async () => {
    const handle = galleryDirectoryHandleRef.current;
    if (!handle) {
      return;
    }
    await loadReferenceGalleryFromHandle(handle, {
      applySelection: referenceSource === 'gallery',
      preferredItemId: selectedGalleryItemId,
    });
  };

  const handleClearReferenceGallery = async () => {
    await clearStoredAutodrawReferenceDirectory().catch(() => undefined);
    galleryDirectoryHandleRef.current = null;
    disposeGalleryPreviewUrls();
    setGalleryItems([]);
    setGalleryDirectoryName('');
    setSelectedGalleryItemId('');
    setGalleryState(
      isAutodrawReferenceGallerySupported() ? 'idle' : 'unsupported'
    );
    setGalleryMessage('');
    if (referenceSource === 'gallery') {
      setReferenceImage(null);
      setReferenceSource(null);
    }
  };

  const handleReferenceGalleryPick = (item: ReferenceGalleryItem) => {
    setSelectedGalleryItemId(item.id);
    setReferenceImage(item.file);
    setReferenceSource('gallery');
    setGalleryMessage('');
  };

  const handleReferenceImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setReferenceSource(file ? 'upload' : null);
    setReferenceImage(file);
  };

  const handleBundleFileChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] || null;
    setBundleFileName(file?.name || '');
    event.target.value = '';
    if (!file) {
      return;
    }

    stopLogStreaming();
    resetWorkbench();
    setJobId('');
    setIsWorkbenchDocked(false);

    try {
      await importBundleFile(file, {
        descriptionLine: `[bundle] local zip import: ${file.name}`,
      });
    } catch (error) {
      handleJobError(error);
    }
  };

  const copyTextToClipboard = async (value: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t('dialog.autodraw.jobId')
      );
    }
  };

  const handleCopyJobId = async () => {
    if (!jobId) {
      return;
    }
    await copyTextToClipboard(jobId);
    setJobIdCopied(true);
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setJobIdCopied(false);
    }, 1600);
  };

  const handleShowCurrentJobFlow = async () => {
    if (!jobId) {
      return;
    }
    setIsWorkbenchDocked(false);
    await loadJobById(jobId);
  };

  const handleHistoryLoad = async (entry: AutodrawHistoryEntry) => {
    if (!entry.jobId) {
      return;
    }
    activeHistoryEntryIdRef.current = entry.id;
    setIsWorkbenchDocked(false);
    await loadJobById(entry.jobId);
  };

  const handleHistoryCopy = async (entry: AutodrawHistoryEntry) => {
    if (!entry.jobId) {
      return;
    }
    await copyTextToClipboard(entry.jobId);
  };

  const handleClearHistory = () => {
    activeHistoryEntryIdRef.current = '';
    setHistoryEntries([]);
  };

  const handleDockWorkbench = () => {
    setIsWorkbenchDocked(true);
  };

  const handleClose = () => {
    stopLogStreaming();
    resetAssemblyState();
    setIsWorkbenchDocked(false);
    setAppState({
      ...appState,
      openDialogType: null,
    });
  };

  const getStatusBadgeClass = (nextStatus: AutodrawStatus) => {
    switch (nextStatus) {
      case 'succeeded':
        return 'autodraw-badge--success';
      case 'failed':
        return 'autodraw-badge--error';
      case 'running':
      case 'submitting':
      case 'importing':
      case 'queued':
        return 'autodraw-badge--processing';
      default:
        return 'autodraw-badge--idle';
    }
  };

  const getHistoryStatusLabel = (nextStatus: AutodrawStatus | 'local') => {
    if (nextStatus === 'local') {
      return t('dialog.autodraw.historyLocal');
    }
    switch (nextStatus) {
      case 'idle':
        return t('dialog.autodraw.status.idle');
      case 'queued':
        return t('dialog.autodraw.status.queued');
      case 'running':
        return t('dialog.autodraw.status.running');
      case 'submitting':
        return t('dialog.autodraw.status.submitting');
      case 'importing':
        return t('dialog.autodraw.status.importing');
      case 'succeeded':
        return t('dialog.autodraw.status.succeeded');
      default:
        return t('dialog.autodraw.status.failed');
    }
  };

  const methodCharacterCount = useMemo(
    () => Array.from(methodText).length,
    [methodText]
  );

  const stagePreviewAssets = useMemo(() => {
    const previewMap = new Map<number, AutodrawAssetItem>();
    assetItems
      .filter((asset) => asset.previewable && asset.category === 'visual')
      .forEach((asset) => {
        const stageIndex = Math.min(
          asset.stageIndex,
          workbenchStages.length - 1
        );
        if (!previewMap.has(stageIndex)) {
          previewMap.set(stageIndex, asset);
        }
      });
    return previewMap;
  }, [assetItems, workbenchStages.length]);

  const activityEntries = useMemo(
    () =>
      timelineItems.map((line, index) => ({
        line,
        tone: /error|failed|exception|traceback/i.test(line)
          ? 'error'
          : /running|queue|submit|import|sam|生成|解析|提取|重建|导入/i.test(
              line
            )
          ? 'run'
          : 'ok',
        stamp:
          line.match(/\b\d{2}:\d{2}:\d{2}\b/)?.[0] ||
          (index === 0 && isJobBusy ? 'now' : '—'),
      })),
    [isJobBusy, timelineItems]
  );

  const backendLabel = useMemo(() => {
    const normalized = normalizeBaseUrl(backendUrl).trim();
    if (!normalized) {
      return 'backend';
    }
    try {
      return new URL(normalized).host;
    } catch {
      return normalized.replace(/^https?:\/\//, '');
    }
  }, [backendUrl]);

  const historyPreviewEntries = useMemo(
    () => historyEntries.slice(0, 12),
    [historyEntries]
  );

  const handleMethodTextKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void handleSubmit();
    }
  };

  const renderStageThumb = (index: number) => {
    const asset = stagePreviewAssets.get(index);

    if (index === 0) {
      return (
        <div className="autodraw-stage-thumb autodraw-stage-thumb--text">
          <p>{methodText.trim() || t('dialog.autodraw.placeholder')}</p>
        </div>
      );
    }

    if (index === 4) {
      return (
        <div className="autodraw-stage-thumb autodraw-stage-thumb--board">
          <div className="autodraw-stage-thumb__board-grid" />
          <div className="autodraw-stage-thumb__board-marks">
            {Array.from({ length: 3 }, (_, markIndex) => (
              <span key={`board-mark-${markIndex}`} />
            ))}
          </div>
          <div className="autodraw-stage-thumb__board-note">{`${
            assemblyProgress.completedBatches || 0
          } / ${assemblyProgress.totalBatches || batchPreviewCount}`}</div>
        </div>
      );
    }

    if (asset?.previewable) {
      return (
        <div className="autodraw-stage-thumb autodraw-stage-thumb--image">
          <img
            src={asset.url}
            alt={asset.name}
            loading="lazy"
            className="autodraw-stage-thumb__image"
          />
        </div>
      );
    }

    if (index === 1) {
      return (
        <div className="autodraw-stage-thumb autodraw-stage-thumb--bitmap" />
      );
    }

    if (index === 2) {
      return (
        <div className="autodraw-stage-thumb autodraw-stage-thumb--mask">
          <svg viewBox="0 0 120 90" aria-hidden="true">
            <defs>
              <pattern
                id="autodraw-stage-mask"
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="4"
                  stroke="currentColor"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <path
              d="M15 20 Q 30 8, 48 16 T 72 28 L 66 42 Q 50 50, 32 40 Z"
              fill="url(#autodraw-stage-mask)"
              stroke="currentColor"
              strokeDasharray="2 2"
            />
            <path
              d="M60 48 Q 78 42, 92 52 T 105 72 L 88 78 Q 70 72, 58 62 Z"
              fill="rgba(244, 114, 182, 0.24)"
              stroke="currentColor"
              strokeDasharray="2 2"
            />
            <circle
              cx="30"
              cy="68"
              r="10"
              fill="rgba(59, 130, 246, 0.22)"
              stroke="currentColor"
              strokeDasharray="2 2"
            />
          </svg>
        </div>
      );
    }

    return (
      <div className="autodraw-stage-thumb autodraw-stage-thumb--vector">
        <svg viewBox="0 0 120 90" aria-hidden="true">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
          >
            <path d="M20 25 L40 20 L55 35" strokeDasharray="2 3" />
            <path d="M60 50 Q 75 40, 90 55" strokeDasharray="2 3" />
            <circle cx="35" cy="65" r="8" strokeDasharray="2 3" />
          </g>
        </svg>
      </div>
    );
  };

  const getStageMeta = (index: number) => {
    const asset = stagePreviewAssets.get(index);
    if (asset) {
      return asset.name;
    }
    if (index === 0) {
      return 'method text';
    }
    if (index === 1) {
      return 'figure bitmap';
    }
    if (index === 2) {
      return `${assetShelfItems.length} assets`;
    }
    if (index === 3) {
      return 'final.svg';
    }
    if (assemblyProgress.totalBatches > 0) {
      return `${assemblyProgress.completedBatches}/${assemblyProgress.totalBatches} batches`;
    }
    return 'canvas assembly';
  };

  const getStageChipLabel = (index: number) => {
    const isFailed = status === 'failed' && index === activeWorkbenchStep;
    const isComplete = index < activeWorkbenchStep || status === 'succeeded';
    const isActive =
      !isFailed &&
      !isComplete &&
      index === activeWorkbenchStep &&
      status !== 'idle';

    if (isFailed) {
      return t('dialog.autodraw.status.failed');
    }
    if (isComplete) {
      return t('dialog.autodraw.status.succeeded');
    }
    if (isActive) {
      return statusLabel;
    }
    return t('dialog.autodraw.status.idle');
  };

  return (
    <div
      ref={rootRef}
      className={classNames('autodraw-dialog', {
        'autodraw-dialog--docked': isWorkbenchDocked,
      })}
    >
      {isWorkbenchDocked ? (
        <section className="autodraw-dock">
          <div className="autodraw-dock__head">
            <div className="autodraw-dock__copy">
              <span className={`autodraw-badge ${getStatusBadgeClass(status)}`}>
                {statusLabel}
              </span>
              <h3 className="autodraw-dock__title">
                {t('dialog.autodraw.importMonitor')}
              </h3>
              <p className="autodraw-dock__description">
                {t('dialog.autodraw.importWatchingHint')}
              </p>
            </div>
            <div className="autodraw-dock__actions">
              <button
                type="button"
                className="autodraw-button autodraw-button--secondary autodraw-button--compact"
                onClick={() => setIsWorkbenchDocked(false)}
              >
                {t('dialog.autodraw.returnWorkbench')}
              </button>
              <button
                type="button"
                className="autodraw-button autodraw-button--ghost autodraw-button--compact"
                onClick={handleClose}
              >
                {t('dialog.close')}
              </button>
            </div>
          </div>

          <div className="autodraw-progress-shell autodraw-progress-shell--compact">
            <div className="autodraw-progress-shell__meta">
              <span>{currentStageLabel}</span>
              <span>{`${Math.round(progressRatio * 100)}%`}</span>
            </div>
            <div className="autodraw-progress-bar">
              <span
                className={classNames('autodraw-progress-bar__fill', {
                  'autodraw-progress-bar__fill--running': isJobBusy,
                })}
                style={{ width: `${Math.max(progressRatio, 0.04) * 100}%` }}
              />
            </div>
          </div>

          <div className="autodraw-dock__metrics">
            {summaryItems.map((item) => (
              <div key={item.label} className="autodraw-dialog__summary-card">
                <span className="autodraw-dialog__summary-value">
                  {item.value}
                </span>
                <span className="autodraw-dialog__summary-label">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="autodraw-workbench">
          <div className="autodraw-paper" />

          <header className="autodraw-topbar">
            <div className="autodraw-topbar__left">
              <button
                type="button"
                className="autodraw-back-btn"
                onClick={handleClose}
              >
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <path
                    d="M9 3 L5 7 L9 11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                返回画板
              </button>
              <div className="autodraw-crumb">
                <span>工具</span>
                <span className="autodraw-crumb__sep">/</span>
                <span className="autodraw-crumb__current">
                  AutoDraw · 实验室工作台
                </span>
              </div>
            </div>

            <div className="autodraw-topbar__right">
              <span
                className={classNames(
                  'autodraw-chip',
                  `autodraw-chip--${getStatusBadgeClass(status).replace(
                    'autodraw-badge--',
                    ''
                  )}`
                )}
              >
                <span className="autodraw-chip__pulse" />
                {statusLabel}
              </span>
              <span className="autodraw-anno">已连接 · {backendLabel}</span>
              <button
                type="button"
                className="autodraw-icon-btn"
                onClick={() => setShowAdvanced((value) => !value)}
                aria-label={t('dialog.autodraw.advancedSettings')}
              >
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <circle
                    cx="7"
                    cy="7"
                    r="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                  <path
                    d="M7 2 L7 3 M7 11 L7 12 M2 7 L3 7 M11 7 L12 7 M3.5 3.5 L4.2 4.2 M9.8 9.8 L10.5 10.5 M3.5 10.5 L4.2 9.8 M9.8 4.2 L10.5 3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="autodraw-icon-btn"
                onClick={handleDockWorkbench}
                aria-label={t('dialog.autodraw.hideWorkbench')}
              >
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <rect
                    x="2.25"
                    y="3"
                    width="9.5"
                    height="8"
                    rx="1.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M4.5 5.5 H9.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </header>

          <div className="autodraw-workspace-grid">
            <aside className="autodraw-col autodraw-col--left">
              <div className="autodraw-page-kicker">AUTODRAW · 01</div>
              <h1 className="autodraw-page-title">
                实验室<span>工作台</span>
              </h1>
              <p className="autodraw-page-desc">
                {t('dialog.autodraw.description')}
              </p>

              <div className="autodraw-sec-head">
                <div className="autodraw-sec-title">
                  {t('dialog.autodraw.basicInfo')}
                  <span>· input</span>
                </div>
                <span className="autodraw-anno autodraw-anno--small">{`${methodCharacterCount} chars`}</span>
              </div>

              <label className="autodraw-dialog__field">
                <span className="autodraw-field-label">
                  <span className="autodraw-dialog__label">
                    {t('dialog.autodraw.methodText')}
                  </span>
                  <span className="autodraw-anno autodraw-anno--small">
                    Ctrl+Enter 提交
                  </span>
                </span>
                <textarea
                  rows={7}
                  value={methodText}
                  onChange={(event) => setMethodText(event.target.value)}
                  onKeyDown={handleMethodTextKeyDown}
                  placeholder={t('dialog.autodraw.placeholder')}
                  className="autodraw-input autodraw-input--method"
                />
              </label>

              <div className="autodraw-btn-row">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isJobBusy}
                  className="autodraw-button autodraw-button--primary"
                >
                  <svg viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M2 1 L9 5 L2 9 Z" fill="currentColor" />
                  </svg>
                  {t('dialog.autodraw.generate')}
                </button>
                {jobId && (
                  <button
                    type="button"
                    onClick={handleResume}
                    disabled={isJobBusy}
                    className="autodraw-button autodraw-button--secondary"
                  >
                    {t('dialog.autodraw.resume')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDockWorkbench}
                  className="autodraw-button autodraw-button--ghost"
                >
                  {t('dialog.autodraw.hideWorkbench')}
                </button>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="autodraw-link-btn"
              >
                {t('dialog.close')}
              </button>

              <div
                className="autodraw-divider"
                data-label={t('dialog.autodraw.referenceGallery')}
              />

              <div className="autodraw-sec-head">
                <div className="autodraw-sec-title">
                  {t('dialog.autodraw.resources')}
                  <span>· style refs</span>
                </div>
                <span className="autodraw-anno autodraw-anno--small">
                  {referenceSource === 'upload'
                    ? t('dialog.autodraw.manualReference')
                    : t('dialog.autodraw.referenceGallery')}
                </span>
              </div>

              <div className="autodraw-mini-label">
                {t('dialog.autodraw.referenceGallery')}
              </div>

              <div className="autodraw-folder-tab">
                <span className="autodraw-folder-tab__dot" />
                {galleryDirectoryName ||
                  selectedGalleryItem?.name ||
                  referenceImage?.name ||
                  'gallery'}
              </div>

              <div className="autodraw-gallery-actions">
                <button
                  type="button"
                  className="autodraw-mini-btn"
                  onClick={() => void handleChooseReferenceGallery()}
                >
                  {t('dialog.autodraw.galleryChooseFolder')}
                </button>
                {galleryDirectoryName && (
                  <>
                    <button
                      type="button"
                      className="autodraw-mini-btn"
                      onClick={() => void handleRefreshReferenceGallery()}
                    >
                      {t('dialog.autodraw.galleryRefresh')}
                    </button>
                    <button
                      type="button"
                      className="autodraw-mini-btn"
                      onClick={() => void handleClearReferenceGallery()}
                    >
                      {t('dialog.autodraw.galleryDisconnect')}
                    </button>
                  </>
                )}
              </div>

              {galleryState === 'loading' ? (
                <div className="autodraw-gallery-empty">
                  {t('dialog.autodraw.galleryLoading')}
                </div>
              ) : galleryState === 'unsupported' ? (
                <div className="autodraw-gallery-empty">
                  {t('dialog.autodraw.galleryUnsupported')}
                </div>
              ) : galleryState === 'needs-permission' ? (
                <div className="autodraw-gallery-empty">
                  {galleryMessage || t('dialog.autodraw.galleryPermissionHint')}
                </div>
              ) : galleryItems.length > 0 ? (
                <div className="autodraw-gallery-grid">
                  {galleryItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleReferenceGalleryPick(item)}
                      className={classNames('autodraw-gallery-card', {
                        'autodraw-gallery-card--active':
                          selectedGalleryItemId === item.id &&
                          referenceSource === 'gallery',
                      })}
                    >
                      <div className="autodraw-gallery-card__image-wrap">
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          loading="lazy"
                          className="autodraw-gallery-card__image"
                        />
                      </div>
                      <span className="autodraw-gallery-card__label">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="autodraw-gallery-empty">
                  {galleryMessage || t('dialog.autodraw.galleryEmpty')}
                </div>
              )}

              <div className="autodraw-inline-card">
                <div>
                  <div className="autodraw-dialog__label">
                    {t('dialog.autodraw.manualReference')}
                  </div>
                  <p className="autodraw-dialog__hint">
                    {t('dialog.autodraw.manualReferenceHint')}
                  </p>
                </div>
                <div className="autodraw-file-input">
                  <input
                    type="file"
                    id="ref-image"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleReferenceImageChange}
                    className="autodraw-file-input__hidden"
                  />
                  <label
                    htmlFor="ref-image"
                    className="autodraw-file-input__label"
                  >
                    {referenceSource === 'upload' && referenceImage
                      ? referenceImage.name
                      : t('dialog.autodraw.chooseFile')}
                  </label>
                </div>
              </div>

              <p className="autodraw-dialog__hint">
                {t('dialog.autodraw.referenceHint')}
              </p>

              <div className="autodraw-divider" data-label="导入 / 接续" />

              <div className="autodraw-inline-card autodraw-inline-card--stack">
                <div className="autodraw-file-input">
                  <input
                    type="file"
                    id="bundle-zip"
                    accept=".zip,application/zip"
                    onChange={handleBundleFileChange}
                    className="autodraw-file-input__hidden"
                  />
                  <label
                    htmlFor="bundle-zip"
                    className="autodraw-file-input__label"
                  >
                    {bundleFileName || t('dialog.autodraw.uploadZip')}
                  </label>
                </div>
                <p className="autodraw-dialog__hint">
                  {t('dialog.autodraw.bundleHint')}
                </p>
              </div>

              <label className="autodraw-dialog__field">
                <span className="autodraw-dialog__label">
                  {t('dialog.autodraw.existingJobId')}
                </span>
                <div className="autodraw-dialog__inline">
                  <input
                    value={jobIdInput}
                    onChange={(event) => setJobIdInput(event.target.value)}
                    placeholder={t('dialog.autodraw.existingJobPlaceholder')}
                    className="autodraw-input"
                  />
                  <button
                    type="button"
                    onClick={loadExistingJob}
                    disabled={isJobBusy}
                    className="autodraw-button autodraw-button--secondary"
                  >
                    {t('dialog.autodraw.loadJob')}
                  </button>
                </div>
              </label>

              {jobId && (
                <div className="autodraw-dialog__job-actions">
                  <span className="autodraw-dialog__pill">{jobId}</span>
                  <button
                    type="button"
                    onClick={handleCopyJobId}
                    className="autodraw-button autodraw-button--secondary autodraw-button--compact"
                  >
                    {jobIdCopied
                      ? t('dialog.autodraw.copied')
                      : t('dialog.autodraw.copyJobId')}
                  </button>
                  <button
                    type="button"
                    onClick={handleShowCurrentJobFlow}
                    disabled={isJobBusy}
                    className="autodraw-button autodraw-button--ghost autodraw-button--compact"
                  >
                    {t('dialog.autodraw.viewFlow')}
                  </button>
                </div>
              )}

              {showAdvanced && (
                <>
                  <div
                    className="autodraw-divider"
                    data-label={t('dialog.autodraw.advancedSettings')}
                  />

                  <div className="autodraw-advanced-grid">
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.backendUrl')}
                      </span>
                      <input
                        value={backendUrl}
                        onChange={(event) => setBackendUrl(event.target.value)}
                        className="autodraw-input"
                      />
                    </label>
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.provider')}
                      </span>
                      <input
                        value={provider}
                        onChange={(event) => setProvider(event.target.value)}
                        className="autodraw-input"
                      />
                    </label>
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.apiKey')}
                      </span>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        className="autodraw-input"
                      />
                    </label>
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.baseUrl')}
                      </span>
                      <input
                        value={baseUrl}
                        onChange={(event) => setBaseUrl(event.target.value)}
                        className="autodraw-input"
                      />
                    </label>
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.imageModel')}
                      </span>
                      <input
                        value={imageModel}
                        onChange={(event) => setImageModel(event.target.value)}
                        className="autodraw-input"
                      />
                    </label>
                    <label className="autodraw-dialog__field">
                      <span className="autodraw-dialog__label">
                        {t('dialog.autodraw.svgModel')}
                      </span>
                      <input
                        value={svgModel}
                        onChange={(event) => setSvgModel(event.target.value)}
                        className="autodraw-input"
                      />
                    </label>
                  </div>

                  <div className="autodraw-scale-card">
                    <div className="autodraw-sec-head autodraw-sec-head--tight">
                      <div className="autodraw-sec-title">
                        {t('dialog.autodraw.latestImport')}
                        <span>· text scale</span>
                      </div>
                      <span className="autodraw-dialog__pill">{`x${lastImportedTextScale.toFixed(
                        2
                      )}`}</span>
                    </div>
                    <div className="autodraw-dialog__scale-actions">
                      <button
                        type="button"
                        className="autodraw-button autodraw-button--secondary"
                        disabled={!canAdjustTextScale}
                        onClick={() => {
                          const nextScale = Math.max(
                            0.6,
                            roundTextScaleFactor(lastImportedTextScale - 0.1)
                          );
                          applyTextScaleToLastImport(
                            nextScale / lastImportedTextScale
                          );
                        }}
                      >
                        A-
                      </button>
                      <button
                        type="button"
                        className="autodraw-button autodraw-button--ghost"
                        disabled={!canAdjustTextScale}
                        onClick={() =>
                          applyTextScaleToLastImport(1 / lastImportedTextScale)
                        }
                      >
                        {`x${lastImportedTextScale.toFixed(2)}`}
                      </button>
                      <button
                        type="button"
                        className="autodraw-button autodraw-button--secondary"
                        disabled={!canAdjustTextScale}
                        onClick={() => {
                          const nextScale = Math.min(
                            2.5,
                            roundTextScaleFactor(lastImportedTextScale + 0.1)
                          );
                          applyTextScaleToLastImport(
                            nextScale / lastImportedTextScale
                          );
                        }}
                      >
                        A+
                      </button>
                    </div>
                  </div>
                </>
              )}
            </aside>

            <main className="autodraw-col autodraw-col--center">
              <div className="autodraw-task-head">
                <div className="autodraw-task-id">
                  <span
                    className={classNames(
                      'autodraw-chip',
                      `autodraw-chip--${getStatusBadgeClass(status).replace(
                        'autodraw-badge--',
                        ''
                      )}`
                    )}
                  >
                    <span className="autodraw-chip__pulse" />
                    {statusLabel}
                  </span>
                  <span className="autodraw-task-id__title">
                    {t('dialog.autodraw.workbench')}
                  </span>
                  <code>
                    {jobId ? `ID: ${jobId}` : t('dialog.autodraw.noJob')}
                  </code>
                </div>
                <div className="autodraw-counts">
                  {summaryItems.map((item) => (
                    <div key={item.label} className="autodraw-count-card">
                      <div className="autodraw-count-card__value">
                        {item.value}
                      </div>
                      <div className="autodraw-count-card__label">
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <section className="autodraw-progress-wrap">
                <div className="autodraw-progress-head">
                  <span className="autodraw-progress-head__label">
                    生成预估进度
                    <span className="autodraw-anno autodraw-anno--small">
                      · {currentStageLabel}
                    </span>
                  </span>
                  <span className="autodraw-progress-head__value">{`${Math.round(
                    progressRatio * 100
                  )}%`}</span>
                </div>
                <div className="autodraw-progress-bar autodraw-progress-bar--workspace">
                  <span
                    className={classNames('autodraw-progress-bar__fill', {
                      'autodraw-progress-bar__fill--running': isJobBusy,
                    })}
                    style={{ width: `${Math.max(progressRatio, 0.04) * 100}%` }}
                  />
                </div>
              </section>

              {!!errorMessage && (
                <div className="autodraw-dialog__error-banner">
                  <span className="autodraw-dialog__error-dot" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <section className="autodraw-pipeline-card">
                <span className="autodraw-help-chip">
                  // 每一步都可以回看 / 重跑
                </span>

                <div className="autodraw-sec-head">
                  <div className="autodraw-sec-title">
                    Pipeline<span>· 文本 → 矢量</span>
                  </div>
                  <span className="autodraw-anno autodraw-anno--small">
                    当前 · {currentStageLabel}
                  </span>
                </div>

                <div className="autodraw-pipeline-stages">
                  {workbenchStages.map((stage, index) => {
                    const isFailed =
                      status === 'failed' && index === activeWorkbenchStep;
                    const isComplete =
                      index < activeWorkbenchStep || status === 'succeeded';
                    const isActive =
                      !isFailed &&
                      !isComplete &&
                      index === activeWorkbenchStep &&
                      status !== 'idle';
                    return (
                      <div
                        key={stage.key}
                        className={classNames('autodraw-pipeline-stage', {
                          'autodraw-pipeline-stage--done': isComplete,
                          'autodraw-pipeline-stage--active': isActive,
                          'autodraw-pipeline-stage--pending':
                            !isComplete && !isActive && !isFailed,
                          'autodraw-pipeline-stage--failed': isFailed,
                        })}
                      >
                        <div className="autodraw-pipeline-stage__no">
                          {stage.stepNumber}
                        </div>
                        <div className="autodraw-pipeline-stage__thumb-box">
                          {renderStageThumb(index)}
                        </div>
                        <div className="autodraw-pipeline-stage__label">
                          {stage.label}
                        </div>
                        <div className="autodraw-pipeline-stage__meta">
                          {getStageMeta(index)}
                        </div>
                        <div className="autodraw-pipeline-stage__chip">
                          {getStageChipLabel(index)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <svg
                  className="autodraw-stage-arrows"
                  viewBox="0 0 1000 60"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <g
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    strokeLinecap="round"
                  >
                    <path d="M180 30 C 195 22, 210 38, 220 30 M215 26 L222 30 L215 34" />
                    <path d="M380 30 C 395 22, 410 38, 420 30 M415 26 L422 30 L415 34" />
                    <path
                      d="M580 30 C 595 22, 610 38, 620 30 M615 26 L622 30 L615 34"
                      strokeDasharray="3 3"
                    />
                    <path
                      d="M780 30 C 795 22, 810 38, 820 30 M815 26 L822 30 L815 34"
                      strokeDasharray="3 3"
                    />
                  </g>
                </svg>
              </section>

              <div className="autodraw-output-grid">
                <section className="autodraw-panel">
                  <div className="autodraw-panel-head">
                    <div className="autodraw-panel-head__title">
                      落板预览<span>· canvas preview</span>
                    </div>
                    <div className="autodraw-panel-head__meta">
                      {currentStageLabel}
                    </div>
                  </div>

                  <div className="autodraw-output-canvas">
                    <div className="autodraw-output-canvas__mesh" />

                    {spotlightAsset && spotlightAsset.previewable ? (
                      <button
                        type="button"
                        className="autodraw-output-canvas__focus"
                        onClick={() =>
                          setAssetPreview({ asset: spotlightAsset })
                        }
                        aria-label={`${t('dialog.autodraw.openPreview')}: ${
                          spotlightAsset.name
                        }`}
                      >
                        <img
                          src={spotlightAsset.url}
                          alt={spotlightAsset.name}
                          loading="lazy"
                          className="autodraw-output-canvas__image"
                        />
                      </button>
                    ) : (
                      <div className="autodraw-output-canvas__placeholder">
                        <div className="autodraw-output-canvas__placeholder-note">
                          {isJobBusy
                            ? t('dialog.autodraw.runningStageHint')
                            : t('dialog.autodraw.readyHint')}
                        </div>
                      </div>
                    )}

                  </div>

                  {(hasImportedPreview || isJobBusy) && (
                    <div className="autodraw-output-assembly">
                      {Array.from({ length: batchPreviewCount }, (_, index) => {
                        const complete =
                          assemblyProgress.totalBatches > 0
                            ? index < assemblyProgress.completedBatches
                            : index < batchPreviewCount;
                        return (
                          <span
                            key={`assembly-${index}`}
                            className={classNames(
                              'autodraw-output-assembly__brick',
                              {
                                'autodraw-output-assembly__brick--complete':
                                  complete,
                              }
                            )}
                          />
                        );
                      })}
                    </div>
                  )}

                  <div className="autodraw-panel-foot">
                    <span className="autodraw-anno autodraw-anno--small">
                      自动导入画板 · 完成后跳转
                    </span>
                    <span className="autodraw-anno autodraw-anno--small">
                      {assemblyProgress.insertedCount > 0
                        ? `placing fragments · ${assemblyProgress.insertedCount}`
                        : t('dialog.autodraw.latestImport')}
                    </span>
                  </div>
                </section>

                <section className="autodraw-panel">
                  <div className="autodraw-panel-head">
                    <div className="autodraw-panel-head__title">
                      {t('dialog.autodraw.assetRoom')}
                      <span>· asset room</span>
                    </div>
                    <div className="autodraw-panel-head__meta">
                      {`${assetShelfItems.length} items`}
                    </div>
                  </div>

                  {assetShelfItems.length > 0 ? (
                    <div className="autodraw-asset-room">
                      {assetShelfItems.map((item) =>
                        item.asset ? (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              setAssetPreview({ asset: item.asset! })
                            }
                            className={classNames('autodraw-asset-card', {
                              'autodraw-asset-card--icon':
                                item.asset.kind === 'icon',
                            })}
                            aria-label={`${t('dialog.autodraw.openPreview')}: ${
                              item.asset.name
                            }`}
                          >
                            <div className="autodraw-asset-card__thumb">
                              <img
                                src={item.asset.url}
                                alt={item.asset.name}
                                loading="lazy"
                                className="autodraw-asset-card__image"
                              />
                            </div>
                            <div className="autodraw-asset-card__meta">
                              <strong className="autodraw-asset-card__title">
                                {item.title}
                              </strong>
                              <span className="autodraw-asset-card__stage">
                                {item.subtitle}
                              </span>
                            </div>
                          </button>
                        ) : (
                          <div
                            key={item.id}
                            className={classNames(
                              'autodraw-asset-card',
                              'autodraw-asset-card--placeholder'
                            )}
                          >
                            <div className="autodraw-asset-card__thumb">
                              <span className="autodraw-asset-card__placeholder">
                                待生成
                              </span>
                            </div>
                            <div className="autodraw-asset-card__meta">
                              <strong className="autodraw-asset-card__title">
                                {item.title}
                              </strong>
                              <span className="autodraw-asset-card__stage">
                                {item.subtitle}
                              </span>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="autodraw-asset-empty">
                      <span>{t('dialog.autodraw.noAssets')}</span>
                      <span className="autodraw-anno autodraw-anno--small">
                        {t('dialog.autodraw.assetHintLive')}
                      </span>
                    </div>
                  )}
                </section>
              </div>
            </main>

            <aside className="autodraw-col autodraw-col--right">
              <section className="autodraw-side-card">
                <div className="autodraw-sec-head autodraw-sec-head--tight">
                  <div className="autodraw-sec-title">
                    {t('dialog.autodraw.activity')}
                    <span>· activity</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLogs([])}
                    className="autodraw-link-btn autodraw-link-btn--inline"
                  >
                    {t('dialog.autodraw.clearLogs')}
                  </button>
                </div>

                <div className="autodraw-log-tabs">
                  <button
                    type="button"
                    className={classNames('autodraw-log-tab', {
                      'autodraw-log-tab--active': activityTab === 'timeline',
                    })}
                    onClick={() => setActivityTab('timeline')}
                  >
                    {t('dialog.autodraw.timeline')}
                  </button>
                  <button
                    type="button"
                    className={classNames('autodraw-log-tab', {
                      'autodraw-log-tab--active': activityTab === 'logs',
                    })}
                    onClick={() => setActivityTab('logs')}
                  >
                    {t('dialog.autodraw.rawLogs')}
                  </button>
                </div>

                {activityTab === 'timeline' ? (
                  <div className="autodraw-log-feed">
                    {activityEntries.length > 0 ? (
                      activityEntries.map((entry, index) => (
                        <div
                          key={`${entry.line}-${index}`}
                          className={classNames(
                            'autodraw-log-line',
                            `autodraw-log-line--${entry.tone}`
                          )}
                        >
                          <span className="autodraw-log-line__time">
                            {entry.stamp}
                          </span>
                          <span className="autodraw-log-line__marker" />
                          <span className="autodraw-log-line__text">
                            {entry.line}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="autodraw-gallery-empty">
                        {t('dialog.autodraw.emptyLogs')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="autodraw-dialog__logs-container">
                    <div className="autodraw-logs-header">
                      <div className="autodraw-logs-filters">
                        <input
                          type="text"
                          value={logFilter}
                          onChange={(event) => setLogFilter(event.target.value)}
                          placeholder={t('dialog.autodraw.filterLogs')}
                          className="autodraw-input autodraw-input--sm"
                        />
                        <label className="autodraw-checkbox-label">
                          <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(event) =>
                              setAutoScroll(event.target.checked)
                            }
                          />
                          <span>{t('dialog.autodraw.autoScroll')}</span>
                        </label>
                      </div>
                      <div className="autodraw-dialog__log-count">{`${filteredLogs.length} lines`}</div>
                    </div>
                    <pre ref={logPanelRef} className="autodraw-dialog__logs">
                      {filteredLogs.length > 0
                        ? filteredLogs.join('\n')
                        : t('dialog.autodraw.emptyLogs')}
                    </pre>
                  </div>
                )}
              </section>

              <section className="autodraw-side-card">
                <div className="autodraw-sec-head autodraw-sec-head--tight">
                  <div className="autodraw-sec-title">
                    {t('dialog.autodraw.history')}
                    <span>· runs</span>
                  </div>
                  <button
                    type="button"
                    className="autodraw-link-btn autodraw-link-btn--inline"
                    onClick={handleClearHistory}
                  >
                    {t('dialog.autodraw.clearHistory')}
                  </button>
                </div>

                <span className="autodraw-anno autodraw-anno--small autodraw-history-note">
                  {`最近 ${historyPreviewEntries.length} 条`}
                </span>

                {historyPreviewEntries.length > 0 ? (
                  <div className="autodraw-history-list">
                    {historyPreviewEntries.map((entry) => (
                      <article key={entry.id} className="autodraw-history-card">
                        <div className="autodraw-history-card__row">
                          <div className="autodraw-history-card__preview">
                            {entry.previewUrl ? (
                              <img
                                src={entry.previewUrl}
                                alt={entry.title}
                                loading="lazy"
                                className="autodraw-asset-card__image"
                              />
                            ) : (
                              <span className="autodraw-asset-card__placeholder">
                                {entry.type === 'job'
                                  ? t('dialog.autodraw.historyJob')
                                  : t('dialog.autodraw.historyLocal')}
                              </span>
                            )}
                          </div>

                          <div className="autodraw-history-card__meta">
                            <div className="autodraw-history-card__id">
                              {entry.title}
                            </div>
                            <div className="autodraw-history-card__subtitle">
                              {entry.createdAt
                                ? new Date(entry.createdAt).toLocaleString()
                                : ''}
                            </div>
                            <div className="autodraw-history-card__status-row">
                              <span
                                className={`autodraw-badge ${getStatusBadgeClass(
                                  entry.status === 'local'
                                    ? 'succeeded'
                                    : entry.status
                                )}`}
                              >
                                {getHistoryStatusLabel(entry.status)}
                              </span>
                            </div>
                          </div>

                          <div className="autodraw-history-card__actions">
                            {entry.jobId && (
                              <>
                                <button
                                  type="button"
                                  className="autodraw-mini-btn"
                                  onClick={() => void handleHistoryLoad(entry)}
                                >
                                  {t('dialog.autodraw.viewFlow')}
                                </button>
                                <button
                                  type="button"
                                  className="autodraw-mini-btn"
                                  onClick={() => void handleHistoryCopy(entry)}
                                >
                                  {t('dialog.autodraw.copyJobId')}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="autodraw-gallery-empty">
                    {t('dialog.autodraw.noHistory')}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      )}

      {assetPreview && (
        <div
          className="autodraw-asset-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setAssetPreview(null)}
        >
          <div
            className="autodraw-asset-lightbox__panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="autodraw-asset-lightbox__head">
              <div>
                <h3 className="autodraw-dialog__panel-title">
                  {assetPreview.asset.name}
                </h3>
                <p className="autodraw-dialog__panel-copy">
                  {assetPreview.asset.path}
                </p>
              </div>
              <button
                type="button"
                className="autodraw-button autodraw-button--ghost autodraw-button--compact"
                onClick={() => setAssetPreview(null)}
              >
                {t('dialog.close')}
              </button>
            </div>
            <div className="autodraw-asset-lightbox__viewport">
              <img
                src={assetPreview.asset.url}
                alt={assetPreview.asset.name}
                className="autodraw-asset-lightbox__image"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutodrawDialog;
