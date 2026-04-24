import classNames from 'classnames';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Translations } from '../../i18n/types';

type ActivityTab = 'timeline' | 'logs';

type AutodrawActivityPanelProps = {
  isBusy: boolean;
  isReady: boolean;
  logs: string[];
  onClearLogs: () => void;
  t: (key: keyof Translations) => string;
};

export const AutodrawActivityPanel = memo(
  ({ isBusy, isReady, logs, onClearLogs, t }: AutodrawActivityPanelProps) => {
    const [activityTab, setActivityTab] = useState<ActivityTab>('timeline');
    const [logFilter, setLogFilter] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const logPanelRef = useRef<HTMLPreElement | null>(null);

    useEffect(() => {
      if (!logPanelRef.current || !autoScroll) {
        return;
      }
      logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
    }, [autoScroll, logs]);

    const filteredLogs = useMemo(() => {
      if (!logFilter.trim()) {
        return logs;
      }
      const lowerFilter = logFilter.toLowerCase();
      return logs.filter((line) => line.toLowerCase().includes(lowerFilter));
    }, [logFilter, logs]);

    const timelineItems = useMemo(() => logs.slice(-8).reverse(), [logs]);

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
            (index === 0 && isBusy ? 'now' : '—'),
        })),
      [isBusy, timelineItems]
    );

    if (!isReady) {
      return (
        <section className="autodraw-side-card autodraw-side-card--loading">
          <div className="autodraw-sec-head autodraw-sec-head--tight">
            <div className="autodraw-sec-title">
              {t('dialog.autodraw.activity')}
              <span>· activity</span>
            </div>
          </div>
          <div className="autodraw-skeleton-stack">
            <span className="autodraw-skeleton-line autodraw-skeleton-line--lg" />
            <span className="autodraw-skeleton-line" />
            <span className="autodraw-skeleton-line" />
            <span className="autodraw-skeleton-line autodraw-skeleton-line--sm" />
          </div>
        </section>
      );
    }

    return (
      <section className="autodraw-side-card">
        <div className="autodraw-sec-head autodraw-sec-head--tight">
          <div className="autodraw-sec-title">
            {t('dialog.autodraw.activity')}
            <span>· activity</span>
          </div>
          <button
            type="button"
            onClick={onClearLogs}
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
                  <span className="autodraw-log-line__time">{entry.stamp}</span>
                  <span className="autodraw-log-line__marker" />
                  <span className="autodraw-log-line__text">{entry.line}</span>
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
                    onChange={(event) => setAutoScroll(event.target.checked)}
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
    );
  }
);

AutodrawActivityPanel.displayName = 'AutodrawActivityPanel';
