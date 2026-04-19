import { useEffect, useState } from 'react';
import BoardShell from './board-shell';
import LandingPage from './landing-page';
import { BOARD_VIEW_HASH, getAppViewFromHash, type AppView } from './app-view';

function getInitialView(): AppView {
  if (typeof window === 'undefined') {
    return 'landing';
  }
  return getAppViewFromHash(window.location.hash);
}

export function App() {
  const [view, setView] = useState<AppView>(() => getInitialView());

  useEffect(() => {
    const onHashChange = () => {
      setView(getAppViewFromHash(window.location.hash));
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const isBoardView = view === 'board';
    document.documentElement.classList.toggle('app-board-mode', isBoardView);
    document.body.classList.toggle('app-board-mode', isBoardView);

    return () => {
      document.documentElement.classList.remove('app-board-mode');
      document.body.classList.remove('app-board-mode');
    };
  }, [view]);

  const openBoard = () => {
    setView('board');
    window.location.hash = BOARD_VIEW_HASH;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openLanding = () => {
    if (window.location.hash) {
      window.history.pushState({}, '', window.location.pathname + window.location.search);
    }
    setView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return view === 'board' ? (
    <BoardShell onBackToLanding={openLanding} />
  ) : (
    <LandingPage onEnterBoard={openBoard} />
  );
}

export default App;
