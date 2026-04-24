import classNames from 'classnames';
import { memo, useEffect, useMemo, useState } from 'react';
import { Translations } from '../../i18n/types';
import {
  AutodrawHistoryEntry,
  AutodrawStatus,
  getAutodrawHistoryDefaultReplayStage,
  getAutodrawHistoryMinReplayStage,
  getAutodrawStatusBadgeClass,
} from './autodraw-dialog.utils';

type WorkbenchStageDefinition = {
  key: string;
  label: string;
  stepNumber: string;
};

type AutodrawHistoryPanelProps = {
  currentJobId: string;
  entries: AutodrawHistoryEntry[];
  isReady: boolean;
  onClearHistory: () => void;
  onDeleteHistoryEntry: (entry: AutodrawHistoryEntry) => void;
  onHistoryCopy: (entry: AutodrawHistoryEntry) => Promise<void> | void;
  onHistoryLoad: (entry: AutodrawHistoryEntry) => Promise<void> | void;
  onHistoryPreview: (entry: AutodrawHistoryEntry) => void;
  onHistoryReplay: (
    entry: AutodrawHistoryEntry,
    startStage: number
  ) => Promise<void> | void;
  t: (key: keyof Translations) => string;
  workbenchStages: WorkbenchStageDefinition[];
};

const canReplayHistoryEntry = (entry: AutodrawHistoryEntry) =>
  entry.status === 'succeeded' ||
  entry.status === 'failed' ||
  entry.status === 'cancelled';

const getHistoryStatusLabel = (
  nextStatus: AutodrawStatus | 'local',
  t: (key: keyof Translations) => string
) => {
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
    case 'cancelling':
      return t('dialog.autodraw.status.cancelling');
    case 'submitting':
      return t('dialog.autodraw.status.submitting');
    case 'importing':
      return t('dialog.autodraw.status.importing');
    case 'succeeded':
      return t('dialog.autodraw.status.succeeded');
    case 'cancelled':
      return t('dialog.autodraw.status.cancelled');
    default:
      return t('dialog.autodraw.status.failed');
  }
};

export const AutodrawHistoryPanel = memo(
  ({
    currentJobId,
    entries,
    isReady,
    onClearHistory,
    onDeleteHistoryEntry,
    onHistoryCopy,
    onHistoryLoad,
    onHistoryPreview,
    onHistoryReplay,
    t,
    workbenchStages,
  }: AutodrawHistoryPanelProps) => {
    const [activeHistoryActionId, setActiveHistoryActionId] = useState<
      string | null
    >(null);
    const [pendingHistoryDeleteId, setPendingHistoryDeleteId] = useState<
      string | null
    >(null);
    const [historyReplayStageById, setHistoryReplayStageById] = useState<
      Record<string, number>
    >({});

    const currentEntries = useMemo(
      () =>
        currentJobId
          ? entries.filter(
              (entry) => entry.type === 'job' && entry.jobId === currentJobId
            )
          : [],
      [currentJobId, entries]
    );

    const recentEntries = useMemo(
      () =>
        currentJobId
          ? entries.filter(
              (entry) => !(entry.type === 'job' && entry.jobId === currentJobId)
            )
          : entries,
      [currentJobId, entries]
    );

    useEffect(() => {
      if (activeHistoryActionId && !entries.some((entry) => entry.id === activeHistoryActionId)) {
        setActiveHistoryActionId(null);
      }
    }, [activeHistoryActionId, entries]);

    useEffect(() => {
      if (
        pendingHistoryDeleteId &&
        !entries.some((entry) => entry.id === pendingHistoryDeleteId)
      ) {
        setPendingHistoryDeleteId(null);
      }
    }, [entries, pendingHistoryDeleteId]);

    const getReplayableHistoryStages = (entry: AutodrawHistoryEntry) =>
      workbenchStages.slice(getAutodrawHistoryMinReplayStage(entry) - 1, 4).map(
        (stage, index) => ({
          ...stage,
          value: getAutodrawHistoryMinReplayStage(entry) + index,
        })
      );

    const getSelectedHistoryReplayStage = (entry: AutodrawHistoryEntry) => {
      const selected = historyReplayStageById[entry.id];
      const minStage = getAutodrawHistoryMinReplayStage(entry);
      if (selected && selected >= minStage && selected <= 4) {
        return selected;
      }
      return getAutodrawHistoryDefaultReplayStage(entry);
    };

    const toggleHistoryActionCard = (entry: AutodrawHistoryEntry) => {
      setPendingHistoryDeleteId(null);
      setActiveHistoryActionId((current) =>
        current === entry.id ? null : entry.id
      );
      setHistoryReplayStageById((current) => {
        if (current[entry.id]) {
          return current;
        }
        return {
          ...current,
          [entry.id]: getAutodrawHistoryDefaultReplayStage(entry),
        };
      });
    };

    const handleHistoryDeleteConfirm = (entry: AutodrawHistoryEntry) => {
      setActiveHistoryActionId((current) =>
        current === entry.id ? null : current
      );
      setPendingHistoryDeleteId((current) =>
        current === entry.id ? null : current
      );
      setHistoryReplayStageById((current) => {
        if (!(entry.id in current)) {
          return current;
        }
        const next = { ...current };
        delete next[entry.id];
        return next;
      });
      onDeleteHistoryEntry(entry);
    };

    const renderHistoryCard = (entry: AutodrawHistoryEntry) => (
      <article
        key={entry.id}
        className={classNames('autodraw-history-card', {
          'autodraw-history-card--action-open':
            activeHistoryActionId === entry.id,
        })}
      >
        <div className="autodraw-history-card__preview-shell">
          {entry.previewUrl ? (
            <button
              type="button"
              className="autodraw-history-card__preview-button"
              onClick={() => onHistoryPreview(entry)}
              aria-label={`${t('dialog.autodraw.openPreview')}: ${entry.title}`}
            >
              <div className="autodraw-history-card__preview">
                <img
                  src={entry.previewUrl}
                  alt={entry.title}
                  loading="lazy"
                  className="autodraw-asset-card__image"
                />
              </div>
            </button>
          ) : (
            <div className="autodraw-history-card__preview">
              <span className="autodraw-history-card__placeholder">
                {entry.type === 'job'
                  ? t('dialog.autodraw.historyJob')
                  : t('dialog.autodraw.historyLocal')}
              </span>
            </div>
          )}
          <div className="autodraw-history-card__status-chip">
            <span
              className={`autodraw-badge ${getAutodrawStatusBadgeClass(
                entry.status === 'local' ? 'succeeded' : entry.status
              )}`}
            >
              {getHistoryStatusLabel(entry.status, t)}
            </span>
          </div>
          <button
            type="button"
            className="autodraw-history-card__action-trigger"
            onClick={() => toggleHistoryActionCard(entry)}
            aria-label={`${t('dialog.autodraw.openAssetActions')}: ${entry.title}`}
            aria-expanded={activeHistoryActionId === entry.id}
          >
            <svg viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M5.25 3.75 L8.75 7 L5.25 10.25"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.15"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="autodraw-history-card__editor">
            {(entry.jobId || entry.previewUrl) && (
              <div className="autodraw-history-card__editor-actions">
                {entry.jobId && (
                  <button
                    type="button"
                    className="autodraw-mini-btn autodraw-history-card__editor-btn"
                    onClick={() => void onHistoryLoad(entry)}
                  >
                    {t('dialog.autodraw.viewFlow')}
                  </button>
                )}
                {entry.previewUrl && (
                  <button
                    type="button"
                    className="autodraw-mini-btn autodraw-history-card__editor-btn"
                    onClick={() => onHistoryPreview(entry)}
                  >
                    {t('dialog.autodraw.openPreview')}
                  </button>
                )}
                {entry.jobId && (
                  <button
                    type="button"
                    className="autodraw-mini-btn autodraw-history-card__editor-btn"
                    onClick={() => void onHistoryCopy(entry)}
                  >
                    {t('dialog.autodraw.copyJobId')}
                  </button>
                )}
              </div>
            )}
            {entry.jobId && (
              <div className="autodraw-history-card__replay">
                <label className="autodraw-history-card__replay-label">
                  <span className="autodraw-sr-only">
                    {t('dialog.autodraw.replayStageLabel')}
                  </span>
                  <select
                    value={getSelectedHistoryReplayStage(entry)}
                    onChange={(event) =>
                      setHistoryReplayStageById((current) => ({
                        ...current,
                        [entry.id]: Number(event.target.value),
                      }))
                    }
                    className="autodraw-input autodraw-input--sm autodraw-history-card__stage-select"
                    aria-label={t('dialog.autodraw.replayStageLabel')}
                    disabled={!canReplayHistoryEntry(entry)}
                  >
                    {getReplayableHistoryStages(entry).map((stage) => (
                      <option key={stage.key} value={stage.value}>
                        {`${stage.stepNumber} · ${stage.label}`}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="autodraw-mini-btn autodraw-history-card__editor-btn autodraw-history-card__editor-btn--accent"
                  onClick={() =>
                    void onHistoryReplay(entry, getSelectedHistoryReplayStage(entry))
                  }
                  disabled={!canReplayHistoryEntry(entry)}
                >
                  {t('dialog.autodraw.replayFromStage')}
                </button>
              </div>
            )}
            <div className="autodraw-history-card__delete">
              {pendingHistoryDeleteId === entry.id ? (
                <>
                  <p className="autodraw-history-card__delete-text">
                    {t('dialog.autodraw.deleteHistoryPrompt')}
                  </p>
                  <span className="autodraw-history-card__delete-hint">
                    {t('dialog.autodraw.deleteHistoryHint')}
                  </span>
                  <div className="autodraw-history-card__delete-actions">
                    <button
                      type="button"
                      className="autodraw-mini-btn autodraw-history-card__editor-btn"
                      onClick={() => setPendingHistoryDeleteId(null)}
                    >
                      {t('cleanConfirm.cancel')}
                    </button>
                    <button
                      type="button"
                      className="autodraw-mini-btn autodraw-history-card__editor-btn autodraw-history-card__editor-btn--danger"
                      onClick={() => handleHistoryDeleteConfirm(entry)}
                    >
                      {t('general.delete')}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="autodraw-mini-btn autodraw-history-card__editor-btn autodraw-history-card__editor-btn--danger"
                  onClick={() => {
                    setActiveHistoryActionId(entry.id);
                    setPendingHistoryDeleteId(entry.id);
                  }}
                >
                  {t('dialog.autodraw.deleteHistoryEntry')}
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    );

    if (!isReady) {
      return (
        <section className="autodraw-side-card autodraw-side-card--loading">
          <div className="autodraw-sec-head autodraw-sec-head--tight">
            <div className="autodraw-sec-title">
              {t('dialog.autodraw.history')}
              <span>· runs</span>
            </div>
          </div>
          <div className="autodraw-skeleton-stack autodraw-skeleton-stack--cards">
            <span className="autodraw-skeleton-card" />
            <span className="autodraw-skeleton-card" />
          </div>
        </section>
      );
    }

    return (
      <section className="autodraw-side-card">
        <div className="autodraw-sec-head autodraw-sec-head--tight">
          <div className="autodraw-sec-title">
            {t('dialog.autodraw.history')}
            <span>· runs</span>
          </div>
          <button
            type="button"
            className="autodraw-link-btn autodraw-link-btn--inline"
            onClick={onClearHistory}
          >
            {t('dialog.autodraw.clearHistory')}
          </button>
        </div>

        <span className="autodraw-anno autodraw-anno--small autodraw-history-note">
          {`最近 ${entries.length} 条`}
        </span>

        {entries.length > 0 ? (
          <div className="autodraw-history-list">
            {currentEntries.map((entry) => renderHistoryCard(entry))}
            {recentEntries.map((entry) => renderHistoryCard(entry))}
          </div>
        ) : (
          <div className="autodraw-gallery-empty">
            {t('dialog.autodraw.noHistory')}
          </div>
        )}
      </section>
    );
  }
);

AutodrawHistoryPanel.displayName = 'AutodrawHistoryPanel';
