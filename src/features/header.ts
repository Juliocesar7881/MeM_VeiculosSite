import { getFavorites, onFavoritesChange } from './favorites-store';

function updateFavCount(ids: string[]) {
  document.querySelectorAll<HTMLElement>('[data-fav-count]').forEach((el) => {
    el.textContent = ids.length > 9 ? '9+' : String(ids.length);
    el.hidden = ids.length === 0;
  });
}

/** Marca `html[data-scrolled]` quando a página sai do topo (sentinela + IntersectionObserver, sem ouvir scroll). */
function initScrollState() {
  const root = document.documentElement;
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none;';
  document.body.prepend(sentinel);
  new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) root.removeAttribute('data-scrolled');
    else root.setAttribute('data-scrolled', '');
  }).observe(sentinel);
}

function initMobileMenu() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-mobile-menu]');
  const openBtn = document.querySelector<HTMLButtonElement>('[data-menu-open]');
  if (!dialog || !openBtn) return;
  const closeBtn = dialog.querySelector<HTMLButtonElement>('[data-menu-close]');

  openBtn.addEventListener('click', () => {
    dialog.showModal();
    openBtn.setAttribute('aria-expanded', 'true');
  });
  closeBtn?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    openBtn.setAttribute('aria-expanded', 'false');
    openBtn.focus();
  });
  // Clique fora do conteúdo (backdrop) fecha
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  // Links internos fecham o menu antes de navegar
  dialog.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => dialog.close()));
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
    if (e.matches && dialog.open) dialog.close();
  });
}

export function initHeader() {
  initScrollState();
  initMobileMenu();
  updateFavCount(getFavorites());
  onFavoritesChange(updateFavCount);
}
