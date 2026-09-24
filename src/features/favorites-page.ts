import { getFavorites, onFavoritesChange, removeFavorite } from './favorites-store';

/** Página /favoritos: busca os cards renderizados no servidor para os IDs salvos. */
export function initFavoritesPage() {
  const root = document.querySelector<HTMLElement>('[data-favorites-page]');
  if (!root) return;
  const summary = root.querySelector<HTMLElement>('[data-fav-summary]');
  const results = root.querySelector<HTMLElement>('[data-fav-results]');
  const empty = root.querySelector<HTMLElement>('[data-fav-empty]');
  const removedNote = root.querySelector<HTMLElement>('[data-fav-removed]');
  if (!summary || !results || !empty) return;

  const showEmpty = () => {
    results.replaceChildren();
    summary.textContent = '';
    empty.classList.remove('hidden');
    empty.classList.add('flex');
  };

  const load = async () => {
    const ids = getFavorites();
    if (ids.length === 0) {
      showEmpty();
      return;
    }
    try {
      const res = await fetch(`/favoritos/lista?ids=${encodeURIComponent(ids.join(','))}`, {
        headers: { Accept: 'text/html' },
      });
      if (!res.ok) throw new Error(String(res.status));
      const html = await res.text();
      // HTML gerado pelo nosso próprio servidor (Astro escapa todo conteúdo dinâmico).
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const wrapper = doc.querySelector<HTMLElement>('[data-fav-found]');
      const found = (wrapper?.dataset.favFound ?? '').split(',').filter(Boolean);
      const missing = ids.filter((id) => !found.includes(id));
      // Remove dos favoritos os veículos que saíram do site (vendidos ocultos/excluídos).
      missing.forEach((id) => removeFavorite(id));
      if (removedNote && missing.length) {
        removedNote.textContent = `${missing.length} ${missing.length === 1 ? 'veículo salvo não está mais disponível e foi removido' : 'veículos salvos não estão mais disponíveis e foram removidos'} da lista.`;
        removedNote.classList.remove('hidden');
      }
      if (found.length === 0) {
        showEmpty();
        return;
      }
      results.replaceChildren(...Array.from(wrapper?.childNodes ?? []).map((n) => document.importNode(n, true)));
      summary.innerHTML = '';
      const strong = document.createElement('strong');
      strong.className = 'text-base text-white';
      strong.textContent = String(found.length);
      summary.append(strong, found.length === 1 ? ' veículo salvo' : ' veículos salvos');
      empty.classList.add('hidden');
      document.dispatchEvent(new CustomEvent('mm:cards-rendered'));
    } catch {
      summary.textContent = 'Não foi possível carregar seus favoritos agora. Tente novamente em instantes.';
    }
  };

  void load();
  // Ao desfavoritar nesta página, remove o card imediatamente.
  onFavoritesChange((ids) => {
    results.querySelectorAll<HTMLElement>('[data-vehicle-card]').forEach((card) => {
      if (!ids.includes(card.dataset.vehicleCard ?? '')) card.closest('li')?.remove();
    });
    if (ids.length === 0) showEmpty();
    else if (summary.firstElementChild)
      summary.firstElementChild.textContent = String(results.querySelectorAll('[data-vehicle-card]').length);
  });
}
