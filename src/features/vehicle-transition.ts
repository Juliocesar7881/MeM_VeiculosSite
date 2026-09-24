/**
 * Continuidade entre a lista e a página do veículo (View Transitions entre documentos).
 *
 * A foto do card clicado "vira" a galeria da página do veículo; ao voltar, a galeria volta
 * para o card. Só um elemento por página pode ter o nome da transição, por isso ele é
 * aplicado no momento da troca (pageswap/pagereveal) e removido quando a animação termina.
 *
 * Marcação: `data-vt-photo="/veiculo/<slug>"` nas mídias clicáveis (cards e destaque da home)
 * e `data-vt-main` na galeria da página do veículo (que já tem o nome via CSS).
 * Navegadores sem suporte simplesmente trocam de página, sem erro.
 */
const NAME = 'vehicle-photo';

const normalize = (path: string) => path.replace(/\/+$/, '') || '/';

function vehiclePath(url: string | undefined | null): string | null {
  if (!url) return null;
  const { pathname, origin } = new URL(url, location.href);
  if (origin !== location.origin || !pathname.startsWith('/veiculo/')) return null;
  return normalize(pathname);
}

function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function mediaFor(path: string, preferred?: Element | null): HTMLElement | null {
  if (preferred instanceof HTMLElement && preferred.dataset.vtPhoto === path) return preferred;
  for (const el of document.querySelectorAll<HTMLElement>('[data-vt-photo]:not([data-vt-main])')) {
    if (el.dataset.vtPhoto === path && el.getClientRects().length > 0) return el;
  }
  return null;
}

/** Aplica o nome durante a transição e o remove depois (a página pode voltar do bfcache). */
function nameDuring(el: HTMLElement, transition: ViewTransition) {
  el.style.viewTransitionName = NAME;
  transition.finished.finally(() => {
    el.style.viewTransitionName = '';
  });
}

let lastClicked: HTMLElement | null = null;

export function initVehicleTransitions() {
  if (!('onpageswap' in window)) return;

  // Guarda a mídia do card clicado (o mesmo veículo pode aparecer em mais de uma seção).
  document.addEventListener(
    'click',
    (event) => {
      const link = (event.target as Element | null)?.closest('a[href]');
      const card = link?.closest('[data-vehicle-card], [data-vt-card]');
      lastClicked = card?.querySelector<HTMLElement>('[data-vt-photo]') ?? null;
    },
    { capture: true },
  );

  // Página que está saindo.
  window.addEventListener('pageswap', (event) => {
    const transition = event.viewTransition;
    if (!transition || reducedMotion()) return;
    const here = normalize(location.pathname);
    const to = vehiclePath(event.activation?.entry?.url);
    const gallery = document.querySelector<HTMLElement>('[data-vt-main]');

    if (to && to !== here) {
      const media = mediaFor(to, lastClicked);
      if (!media) return;
      // Na página de um veículo indo para outro (semelhantes): só o card leva o nome.
      if (gallery) gallery.style.viewTransitionName = 'none';
      nameDuring(media, transition);
      transition.finished.finally(() => gallery?.style.removeProperty('view-transition-name'));
    } else if (!to && gallery && here.startsWith('/veiculo/')) {
      nameDuring(gallery, transition);
    }
  });

  // Página que está entrando (volta da página do veículo para a lista).
  window.addEventListener('pagereveal', (event) => {
    const transition = event.viewTransition;
    if (!transition || reducedMotion() || !('navigation' in window)) return;
    const from = vehiclePath(window.navigation.activation?.from?.url);
    const here = normalize(location.pathname);
    if (!from || here.startsWith('/veiculo/')) return;
    // Sem o card na lista (ex.: outra página de filtro), a galeria só esmaece com o resto.
    const media = mediaFor(from);
    if (media) nameDuring(media, transition);
  });
}
