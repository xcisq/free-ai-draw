import { useEffect, useRef, useState } from 'react';
import BoardShell from './board-shell';
import DocsPage from './docs-page';
import LandingPage from './landing-page';
import {
  BOARD_VIEW_HASH,
  DOCS_VIEW_HASH,
  getAppViewFromHash,
  type AppView,
} from './app-view';
import styles from './app.module.scss';

const VIEW_TRANSITION_MS = 520;

type ViewTransition = 'to-board' | 'to-landing' | null;

function getInitialView(): AppView {
  if (typeof window === 'undefined') {
    return 'landing';
  }
  return getAppViewFromHash(window.location.hash);
}

function getTransitionDuration() {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return 0;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : VIEW_TRANSITION_MS;
}

export function App() {
  const [view, setView] = useState<AppView>(() => getInitialView());
  const [transition, setTransition] = useState<ViewTransition>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const suppressHashSyncRef = useRef(false);

  const clearPendingTransition = () => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  };

  const finishTransition = (nextView: AppView) => {
    clearPendingTransition();
    setView(nextView);
    setTransition(null);
  };

  const startViewTransition = (nextView: AppView) => {
    const nextTransition = nextView === 'board' ? 'to-board' : 'to-landing';
    const duration = getTransitionDuration();

    setTransition(nextTransition);

    if (duration === 0) {
      finishTransition(nextView);
      return;
    }

    clearPendingTransition();
    transitionTimerRef.current = window.setTimeout(() => {
      finishTransition(nextView);
    }, duration);
  };

  const showStaticView = (nextView: AppView) => {
    finishTransition(nextView);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onHashChange = () => {
      const nextView = getAppViewFromHash(window.location.hash);
      if (suppressHashSyncRef.current) {
        suppressHashSyncRef.current = false;
        return;
      }
      if (nextView === view && transition === null) {
        return;
      }
      if (nextView !== 'board' && view !== 'board') {
        showStaticView(nextView);
        return;
      }
      if (nextView === 'docs') {
        showStaticView('docs');
        return;
      }
      startViewTransition(nextView);
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [transition, view]);

  useEffect(() => {
    return () => {
      clearPendingTransition();
    };
  }, []);

  useEffect(() => {
    const isBoardView = view === 'board' || transition !== null;
    document.documentElement.classList.toggle('app-board-mode', isBoardView);
    document.body.classList.toggle('app-board-mode', isBoardView);

    return () => {
      document.documentElement.classList.remove('app-board-mode');
      document.body.classList.remove('app-board-mode');
    };
  }, [transition, view]);

  const openBoard = () => {
    if (view === 'board' || transition !== null) {
      return;
    }
    suppressHashSyncRef.current = true;
    window.location.hash = BOARD_VIEW_HASH;
    window.scrollTo({ top: 0 });
    startViewTransition('board');
  };

  const openLanding = () => {
    if (view === 'landing' || transition !== null) {
      return;
    }
    if (window.location.hash) {
      window.history.pushState(
        {},
        '',
        window.location.pathname + window.location.search
      );
    }
    window.scrollTo({ top: 0 });
    if (view === 'board') {
      startViewTransition('landing');
      return;
    }
    finishTransition('landing');
  };

  const openDocs = () => {
    if (view === 'docs' || transition !== null) {
      return;
    }
    suppressHashSyncRef.current = true;
    window.location.hash = DOCS_VIEW_HASH;
    window.scrollTo({ top: 0 });
    finishTransition('docs');
  };

  const showLanding = view !== 'board' || transition !== null;
  const showBoard = view === 'board' || transition !== null;
  const nonBoardView =
    view === 'docs' && transition === 'to-board' ? (
      <DocsPage onBackToLanding={openLanding} onEnterBoard={openBoard} />
    ) : (
      <LandingPage onEnterBoard={openBoard} onOpenDocs={openDocs} />
    );
  const landingLayerClassName = [
    styles.viewLayer,
    styles.landingLayer,
    view === 'landing' && transition === null ? styles.layerActive : '',
    transition === 'to-board' ? styles.layerForeground : '',
    transition === 'to-landing' ? styles.layerBackground : '',
    transition === 'to-board' ? styles.layerExitToBoard : '',
    transition === 'to-landing' ? styles.layerEnterFromBoard : '',
  ]
    .filter(Boolean)
    .join(' ');
  const boardLayerClassName = [
    styles.viewLayer,
    styles.boardLayer,
    view === 'board' && transition === null ? styles.layerActive : '',
    transition === 'to-board' ? styles.layerBoardReady : '',
    transition === 'to-board' ? styles.layerBackground : '',
    transition === 'to-landing' ? styles.layerForeground : '',
    transition === 'to-landing' ? styles.layerExitToLanding : '',
  ]
    .filter(Boolean)
    .join(' ');
  const stageClassName = [
    styles.appStage,
    transition === 'to-board' ? styles.appStageToBoard : '',
    transition === 'to-landing' ? styles.appStageToLanding : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (transition === null) {
    if (view === 'board') {
      return <BoardShell onBackToLanding={openLanding} />;
    }
    if (view === 'docs') {
      return (
        <DocsPage onBackToLanding={openLanding} onEnterBoard={openBoard} />
      );
    }
    return <LandingPage onEnterBoard={openBoard} onOpenDocs={openDocs} />;
  }

  return (
    <div className={stageClassName}>
      {showLanding ? (
        <div className={landingLayerClassName}>{nonBoardView}</div>
      ) : null}
      {showBoard ? (
        <div className={boardLayerClassName}>
          <BoardShell onBackToLanding={openLanding} />
        </div>
      ) : null}
    </div>
  );
}

export default App;
