export type AppView = 'landing' | 'board' | 'docs';

export const BOARD_VIEW_HASH = 'board';
export const DOCS_VIEW_HASH = 'docs';

export function getAppViewFromHash(hash: string): AppView {
  const normalized = hash.replace(/^#/, '').toLowerCase();
  if (normalized === BOARD_VIEW_HASH) {
    return 'board';
  }
  if (normalized === DOCS_VIEW_HASH) {
    return 'docs';
  }
  return 'landing';
}
