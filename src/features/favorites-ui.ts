import { getFavorites, onFavoritesChange, toggleFavorite } from './favorites-store';

function sync(ids: string[]) {
  const set = new Set(ids);
  document.querySelectorAll<HTMLButtonElement>('[data-fav-toggle]').forEach((btn) => {
    const id = btn.dataset.favToggle ?? '';
    const on = set.has(id);
    btn.setAttribute('aria-pressed', String(on));
    const label = on ? btn.dataset.labelOn : btn.dataset.labelOff;
    if (label) btn.setAttribute('aria-label', label);
    const text = btn.querySelector('.fav-text');
    if (text) text.textContent = on ? 'Favoritado' : 'Favoritar';
  });
}

let initialized = false;

/** Delegação de eventos: funciona também para cards inseridos depois (página de favoritos). */
export function initFavoriteButtons() {
  if (initialized) return;
  initialized = true;
  document.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    const btn = target?.closest<HTMLButtonElement>('[data-fav-toggle]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite(btn.dataset.favToggle ?? '');
  });
  sync(getFavorites());
  onFavoritesChange(sync);
  document.addEventListener('mm:cards-rendered', () => sync(getFavorites()));
}
