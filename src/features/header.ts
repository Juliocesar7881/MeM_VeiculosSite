import { getFavorites, onFavoritesChange } from './favorites-store';

function updateFavCount(ids: string[]) {
  document.querySelectorAll<HTMLElement>('[data-fav-count]').forEach((el) => {
    el.textContent = ids.length > 9 ? '9+' : String(ids.length);
    el.hidden = ids.length === 0;
  });
}

function initScrollState() {
  const root = document.documentElement;
  let ticking = false;
  const apply = () => {
    ticking = false;
    if (window.scrollY > 8) root.setAttribute('data-scrolled', '');
    else root.removeAttribute('data-scrolled');
  };
  apply();
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(apply);
      }
    },
    { passive: true },
  );
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
