import {
  MutableRefObject,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SvgImportSummary } from '../../svg-import/convert-svg-to-drawnix';
import {
  AutodrawArtifact,
  AutodrawHistoryEntry,
  AutodrawStatus,
  createAutodrawJobHistoryId,
  getAutodrawSpotlightAsset,
  orderAutodrawHistoryEntries,
  toAutodrawAssetItems,
  upsertAutodrawHistory,
} from './autodraw-dialog.utils';

const AUTODRAW_HISTORY_STORAGE_KEY_V1 = 'drawnix:autodraw-history:v1';
const AUTODRAW_HISTORY_STORAGE_KEY_V2 = 'drawnix:autodraw-history:v2';
const AUTODRAW_HISTORY_PERSIST_DELAY =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ? 0 : 160;
const AUTODRAW_HISTORY_WATCH_POLL_INTERVAL =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ? 20 : 1000;

type JobListItemResponse = {
  job_id: string;
  job_type?: 'autodraw' | 'image-edit';
  status: AutodrawStatus;
  created_at?: string;
  preview_url?: string | null;
  bundle_url?: string | null;
  artifacts?: AutodrawArtifact[];
  current_stage?: number;
  failed_stage?: number | null;
  min_start_stage?: number;
};

type RememberJobHistoryPayload = {
  historyId?: string;
  jobId: string;
  jobType?: 'autodraw' | 'image-edit';
  status: AutodrawStatus;
  createdAt?: string;
  updatedAt?: string;
  summary?: SvgImportSummary;
  nextArtifacts?: AutodrawArtifact[];
  bundleUrl?: string | null;
  currentStage?: number | null;
  failedStage?: number | null;
  minStartStage?: number;
  setActiveEntry?: boolean;
};

type RememberBundleHistoryPayload = {
  bundleName: string;
  summary: SvgImportSummary;
};

type UseAutodrawHistoryArgs = {
  activeHistoryEntryIdRef: MutableRefObject<string>;
  backendUrl: string;
  currentJobId: string;
  deferredReady: boolean;
  historyLimit: number;
};

type JobResponse = {
  job_id: string;
  status: AutodrawStatus;
  created_at?: string;
  finished_at?: string | null;
  bundle_url?: string | null;
  artifacts?: AutodrawArtifact[];
  current_stage?: number;
  failed_stage?: number | null;
  min_start_stage?: number;
  request?: {
    job_type?: 'autodraw' | 'image-edit';
  };
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const filterAutodrawHistoryEntries = (entries: AutodrawHistoryEntry[]) =>
  entries.filter((entry) => entry.jobType !== 'image-edit');

const getHistoryPreviewAsset = (
  artifacts: AutodrawArtifact[],
  baseUrl: string,
  status: AutodrawStatus,
  currentStage?: number | null
) => {
  const assetItems = toAutodrawAssetItems(artifacts, baseUrl);
  const spotlightAsset = getAutodrawSpotlightAsset(assetItems);
  const stablePreviewAsset =
    assetItems.find((asset) =>
      currentStage && currentStage >= 4
        ? ['final_svg', 'optimized_template_svg', 'template_svg', 'figure'].includes(
            asset.kind
          )
        : ['figure', 'final_svg', 'optimized_template_svg', 'template_svg'].includes(
            asset.kind
          )
    ) || null;

  if (status === 'failed' || status === 'cancelled') {
    return assetItems.find((asset) => asset.kind === 'figure') || spotlightAsset;
  }

  if (
    (status === 'running' || status === 'importing' || status === 'queued') &&
    spotlightAsset?.kind === 'icon'
  ) {
    return stablePreviewAsset || spotlightAsset;
  }

  return spotlightAsset;
};

const normalizePersistedHistoryEntry = (
  entry: unknown
): AutodrawHistoryEntry | null => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const candidate = entry as Partial<AutodrawHistoryEntry>;
  const createdAt =
    typeof candidate.createdAt === 'string' && candidate.createdAt
      ? candidate.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof candidate.updatedAt === 'string' && candidate.updatedAt
      ? candidate.updatedAt
      : createdAt;

  if (candidate.type === 'job' && typeof candidate.jobId === 'string') {
    return {
      id: createAutodrawJobHistoryId(candidate.jobId),
      type: 'job',
      jobType: candidate.jobType === 'image-edit' ? 'image-edit' : 'autodraw',
      title: candidate.title || candidate.jobId,
      subtitle: candidate.subtitle || 'Generated job',
      status:
        typeof candidate.status === 'string'
          ? (candidate.status as AutodrawStatus)
          : 'idle',
      createdAt,
      updatedAt,
      jobId: candidate.jobId,
      previewUrl: candidate.previewUrl,
      bundleUrl: candidate.bundleUrl ?? null,
      currentStage: candidate.currentStage,
      failedStage: candidate.failedStage,
      minStartStage: candidate.minStartStage,
      summary: candidate.summary,
    };
  }

  if (candidate.type === 'bundle') {
    const bundleTitle = candidate.title || 'bundle.zip';
    return {
      id: candidate.id || `bundle:${bundleTitle}:${createdAt}`,
      type: 'bundle',
      title: bundleTitle,
      subtitle: candidate.subtitle || 'Local ZIP',
      status: 'local',
      createdAt,
      updatedAt,
      previewUrl: candidate.previewUrl,
      summary: candidate.summary,
    };
  }

  return null;
};

export const useAutodrawHistory = ({
  activeHistoryEntryIdRef,
  backendUrl,
  currentJobId,
  deferredReady,
  historyLimit,
}: UseAutodrawHistoryArgs) => {
  const [historyEntries, setHistoryEntries] = useState<AutodrawHistoryEntry[]>(
    []
  );
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const historyPersistTimerRef = useRef<number | null>(null);
  const historyWatchTimersRef = useRef<Map<string, number>>(new Map());
  const watchedHistoryJobsRef = useRef<Set<string>>(new Set());

  const stopWatchingJob = (jobId: string) => {
    watchedHistoryJobsRef.current.delete(jobId);
    const timer = historyWatchTimersRef.current.get(jobId);
    if (typeof timer === 'number') {
      window.clearTimeout(timer);
      historyWatchTimersRef.current.delete(jobId);
    }
  };

  const stopAllWatchingJobs = () => {
    watchedHistoryJobsRef.current.forEach((jobId) => {
      const timer = historyWatchTimersRef.current.get(jobId);
      if (typeof timer === 'number') {
        window.clearTimeout(timer);
      }
    });
    watchedHistoryJobsRef.current.clear();
    historyWatchTimersRef.current.clear();
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !deferredReady) {
      return;
    }

    try {
      const payload =
        window.localStorage.getItem(AUTODRAW_HISTORY_STORAGE_KEY_V2) ||
        window.localStorage.getItem(AUTODRAW_HISTORY_STORAGE_KEY_V1);
      if (!payload) {
        return;
      }

      const parsed = JSON.parse(payload) as unknown[];
      if (!Array.isArray(parsed)) {
        return;
      }

      const persistedEntries = parsed
        .map((entry) => normalizePersistedHistoryEntry(entry))
        .filter((entry): entry is AutodrawHistoryEntry => Boolean(entry));

      startTransition(() => {
        setHistoryEntries((current) => {
          let nextEntries = filterAutodrawHistoryEntries(current);
          for (const entry of persistedEntries) {
            nextEntries = upsertAutodrawHistory(
              nextEntries,
              entry,
              historyLimit
            );
          }
          return nextEntries;
        });
      });
    } catch {
      // ignore invalid history payload
    } finally {
      setHistoryHydrated(true);
    }
  }, [deferredReady, historyLimit]);

  useEffect(() => {
    if (typeof window === 'undefined' || !deferredReady) {
      return;
    }

    let cancelled = false;
    const base = normalizeBaseUrl(backendUrl);

    const loadRuntimeJobs = async () => {
      try {
        const response = await fetch(
          `${base}/api/jobs?limit=${historyLimit}&offset=0`
        );
        if (!response.ok) {
          return;
        }

        const items: JobListItemResponse[] = await response.json();
        if (cancelled || !Array.isArray(items) || items.length === 0) {
          return;
        }

        startTransition(() => {
          setHistoryEntries((current) => {
            let nextEntries = filterAutodrawHistoryEntries(current);
            for (const item of items) {
              if (
                !item ||
                typeof item.job_id !== 'string'
              ) {
                continue;
              }

              if (item.job_type === 'image-edit') {
                nextEntries = nextEntries.filter(
                  (entry) => entry.jobId !== item.job_id
                );
                continue;
              }

              const artifacts = Array.isArray(item.artifacts) ? item.artifacts : [];
              const previewUrl =
                typeof item.preview_url === 'string' && item.preview_url
                  ? `${base}${item.preview_url}`
                  : getHistoryPreviewAsset(
                      artifacts,
                      base,
                      item.status as AutodrawStatus
                    )?.url;
              const createdAt =
                typeof item.created_at === 'string' && item.created_at
                  ? item.created_at
                  : new Date().toISOString();

              nextEntries = upsertAutodrawHistory(
                nextEntries,
                {
                  id: createAutodrawJobHistoryId(item.job_id),
                  type: 'job',
                  jobType: 'autodraw',
                  title: item.job_id,
                  subtitle: 'Runtime job',
                  status: item.status as AutodrawStatus,
                  createdAt,
                  updatedAt: createdAt,
                  jobId: item.job_id,
                  previewUrl,
                  bundleUrl: item.bundle_url || null,
                  currentStage: item.current_stage,
                  failedStage: item.failed_stage,
                  minStartStage: item.min_start_stage,
                },
                historyLimit
              );
            }
            return nextEntries;
          });
        });
      } catch {
        // ignore runtime jobs listing failures
      }
    };

    void loadRuntimeJobs();
    return () => {
      cancelled = true;
    };
  }, [backendUrl, deferredReady, historyLimit]);

  useEffect(() => {
    if (typeof window === 'undefined' || !historyHydrated) {
      return;
    }

    if (historyPersistTimerRef.current) {
      window.clearTimeout(historyPersistTimerRef.current);
    }

    historyPersistTimerRef.current = window.setTimeout(() => {
      window.localStorage.setItem(
        AUTODRAW_HISTORY_STORAGE_KEY_V2,
        JSON.stringify(historyEntries)
      );
      window.localStorage.removeItem(AUTODRAW_HISTORY_STORAGE_KEY_V1);
    }, AUTODRAW_HISTORY_PERSIST_DELAY);

    return () => {
      if (historyPersistTimerRef.current) {
        window.clearTimeout(historyPersistTimerRef.current);
        historyPersistTimerRef.current = null;
      }
    };
  }, [historyEntries, historyHydrated]);

  useEffect(() => {
    return () => {
      stopAllWatchingJobs();
    };
  }, []);

  const historyPreviewEntries = useMemo(
    () => orderAutodrawHistoryEntries(historyEntries, currentJobId, historyLimit),
    [currentJobId, historyEntries, historyLimit]
  );

  const currentJobHistoryEntry = useMemo(
    () => historyEntries.find((entry) => entry.jobId === currentJobId) || null,
    [currentJobId, historyEntries]
  );

  const rememberHistory = (entry: AutodrawHistoryEntry) => {
    setHistoryEntries((current) =>
      filterAutodrawHistoryEntries(
        upsertAutodrawHistory(current, entry, historyLimit)
      )
    );
  };

  const rememberJobHistory = (payload: RememberJobHistoryPayload) => {
    const assetPreviewItem = getHistoryPreviewAsset(
      payload.nextArtifacts || [],
      backendUrl,
      payload.status,
      payload.currentStage
    );

    setHistoryEntries((current) => {
      const matchingHistoryEntry = current.find(
        (entry) =>
          entry.id === payload.historyId ||
          (entry.type === 'job' && entry.jobId === payload.jobId)
      );
      const activeHistoryEntry = current.find(
        (entry) => entry.id === activeHistoryEntryIdRef.current
      );
      const activeEntryForSameJob =
        activeHistoryEntry?.type === 'job' &&
        activeHistoryEntry.jobId === payload.jobId
          ? activeHistoryEntry
          : null;
      const createdAt = payload.createdAt || new Date().toISOString();
      const updatedAt = payload.updatedAt || createdAt;
      const historyId =
        payload.historyId ||
        matchingHistoryEntry?.id ||
        (activeEntryForSameJob
          ? activeEntryForSameJob.id
          : '') ||
        createAutodrawJobHistoryId(payload.jobId);

      if (payload.setActiveEntry !== false) {
        activeHistoryEntryIdRef.current = historyId;
      }

      return filterAutodrawHistoryEntries(
        upsertAutodrawHistory(
          current,
          {
            id: historyId,
            type: 'job',
            jobType: payload.jobType || 'autodraw',
            title: payload.jobId,
            subtitle: 'Generated job',
            status: payload.status,
            createdAt:
              matchingHistoryEntry?.createdAt ||
              activeEntryForSameJob?.createdAt ||
              createdAt,
            updatedAt,
            jobId: payload.jobId,
            previewUrl: assetPreviewItem?.url,
            bundleUrl:
              payload.bundleUrl ?? matchingHistoryEntry?.bundleUrl ?? null,
            currentStage:
              payload.currentStage ??
              matchingHistoryEntry?.currentStage ??
              undefined,
            failedStage:
              payload.failedStage ??
              matchingHistoryEntry?.failedStage ??
              undefined,
            minStartStage:
              payload.minStartStage ?? matchingHistoryEntry?.minStartStage,
            summary: payload.summary
              ? {
                  textCount: payload.summary.textCount,
                  arrowCount: payload.summary.arrowCount,
                  componentCount: payload.summary.componentCount,
                }
              : matchingHistoryEntry?.summary,
          },
          historyLimit
        )
      );
    });
  };

  const rememberBundleHistory = (payload: RememberBundleHistoryPayload) => {
    rememberHistory({
      id: `bundle:${payload.bundleName}:${Date.now()}`,
      type: 'bundle',
      title: payload.bundleName,
      subtitle: 'Local ZIP',
      status: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      summary: {
        textCount: payload.summary.textCount,
        arrowCount: payload.summary.arrowCount,
        componentCount: payload.summary.componentCount,
      },
    });
  };

  const clearHistory = () => {
    stopAllWatchingJobs();
    activeHistoryEntryIdRef.current = '';
    setHistoryEntries([]);
  };

  const deleteHistoryEntry = (entry: AutodrawHistoryEntry) => {
    if (entry.jobId) {
      stopWatchingJob(entry.jobId);
    }
    if (activeHistoryEntryIdRef.current === entry.id) {
      activeHistoryEntryIdRef.current = '';
    }

    setHistoryEntries((current) =>
      current.filter((candidate) => candidate.id !== entry.id)
    );
  };

  const watchJobUntilSettled = (jobId: string) => {
    if (typeof window === 'undefined' || !jobId) {
      return;
    }

    if (watchedHistoryJobsRef.current.has(jobId)) {
      return;
    }

    watchedHistoryJobsRef.current.add(jobId);
    const base = normalizeBaseUrl(backendUrl);

    const poll = async () => {
      if (!watchedHistoryJobsRef.current.has(jobId)) {
        return;
      }

      let shouldContinue = true;
      try {
        const response = await fetch(`${base}/api/jobs/${jobId}`);
        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data: JobResponse = await response.json();
        if (!watchedHistoryJobsRef.current.has(jobId)) {
          return;
        }

        if (data.request?.job_type === 'image-edit') {
          shouldContinue = false;
          stopWatchingJob(jobId);
          setHistoryEntries((current) =>
            current.filter((entry) => entry.jobId !== jobId)
          );
          return;
        }

        rememberJobHistory({
          jobId: data.job_id,
          jobType: data.request?.job_type || 'autodraw',
          status: data.status as AutodrawStatus,
          createdAt: data.created_at,
          updatedAt: data.finished_at || new Date().toISOString(),
          nextArtifacts: data.artifacts ?? [],
          bundleUrl: data.bundle_url || null,
          currentStage: data.current_stage,
          failedStage: data.failed_stage,
          minStartStage: data.min_start_stage,
          setActiveEntry: false,
        });

        if (
          data.status === 'cancelled' ||
          data.status === 'failed' ||
          data.status === 'succeeded'
        ) {
          shouldContinue = false;
          stopWatchingJob(jobId);
        }
      } catch {
        if (!watchedHistoryJobsRef.current.has(jobId)) {
          return;
        }
      }

      if (!shouldContinue || !watchedHistoryJobsRef.current.has(jobId)) {
        return;
      }

      const timer = window.setTimeout(() => {
        void poll();
      }, AUTODRAW_HISTORY_WATCH_POLL_INTERVAL);
      historyWatchTimersRef.current.set(jobId, timer);
    };

    void poll();
  };

  return {
    clearHistory,
    currentJobHistoryEntry,
    deleteHistoryEntry,
    historyEntries,
    historyHydrated,
    historyPreviewEntries,
    rememberBundleHistory,
    rememberHistory,
    rememberJobHistory,
    stopWatchingJob,
    watchJobUntilSettled,
  };
};
