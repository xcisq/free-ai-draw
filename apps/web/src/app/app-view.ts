export type AppView = 'landing' | 'board';

export const BOARD_VIEW_HASH = 'board';

export function getAppViewFromHash(hash: string): AppView {
  const normalized = hash.replace(/^#/, '').toLowerCase();
  return normalized === BOARD_VIEW_HASH ? 'board' : 'landing';
}
