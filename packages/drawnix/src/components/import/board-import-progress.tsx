import { useMemo } from 'react';
import { useDrawnix } from '../../hooks/use-drawnix';
import './board-import-progress.scss';

export const BoardImportProgress = () => {
  const { appState } = useDrawnix();
  const progress = appState.boardImportProgress;

  const ratio = useMemo(() => {
    if (progress.phase === 'preparing') {
      return 0.08;
    }
    if (!progress.totalBatches) {
      return 0;
    }
    return Math.min(1, progress.completedBatches / progress.totalBatches);
  }, [progress.completedBatches, progress.phase, progress.totalBatches]);

  if (!progress.active && progress.totalBatches === 0) {
    return null;
  }

  const stageLabel =
    progress.phase === 'preparing' ? 'preparing file' : 'assembling board';
  const metaLabel =
    progress.phase === 'preparing'
      ? 'parsing'
      : `${progress.completedBatches}/${progress.totalBatches || 1}`;
  const countLabel =
    progress.phase === 'preparing' ? '...' : String(progress.insertedCount);

  return (
    <div
      className="board-import-progress"
      aria-live="polite"
      aria-label={progress.fileName || 'drawnix import progress'}
    >
      <div className="board-import-progress__shell">
        <div className="board-import-progress__grid" />
        <div className="board-import-progress__eyebrow">.drawnix</div>
        <div className="board-import-progress__title" title={progress.fileName}>
          {progress.fileName || 'board import'}
        </div>
        <div className="board-import-progress__meta">
          <span>{stageLabel}</span>
          <span>{metaLabel}</span>
          <span>{countLabel}</span>
        </div>
        <div className="board-import-progress__bar">
          <span
            className="board-import-progress__fill"
            style={{ width: `${Math.max(ratio, 0.06) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

BoardImportProgress.displayName = 'BoardImportProgress';
