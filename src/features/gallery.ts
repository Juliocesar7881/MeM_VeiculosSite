/**
 * Galeria do veículo: swipe nativo (scroll-snap), setas, miniaturas, teclado e tela cheia.
 */
function currentIndex(track: HTMLElement): number {
  const width = track.clientWidth || 1;
  return Math.round(track.scrollLeft / width);
}

function goTo(track: HTMLElement, index: number, smooth = true) {
  const count = track.children.length;
  const target = Math.max(0, Math.min(count - 1, index));
  track.scrollTo({ left: target * track.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
}

function onScrollEnd(track: HTMLElement, callback: () => void) {
  let timer = 0;
  track.addEventListener(
    'scroll',
    () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(callback, 60);
    },
    { passive: true },
  );
}

function initGallery(root: HTMLElement) {
  const track = root.querySelector<HTMLElement>('[data-track]');
  if (!track) return;
  const count = Number(root.dataset.count ?? '1');
  const counter = root.querySelector<HTMLElement>('[data-counter]');
  const thumbs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-thumb]'));
  const thumbBar = root.querySelector<HTMLElement>('[data-thumbs]');

  const update = () => {
    const index = currentIndex(track);
    if (counter) counter.textContent = `${index + 1} / ${count}`;
    thumbs.forEach((thumb, i) => {
      const selected = i === index;
      thumb.setAttribute('aria-selected', String(selected));
      if (selected && thumbBar) {
        const left = thumb.offsetLeft - thumbBar.clientWidth / 2 + thumb.clientWidth / 2;
        thumbBar.scrollTo({ left, behavior: 'smooth' });
      }
    });
  };
  onScrollEnd(track, update);

  root.querySelector('[data-prev]')?.addEventListener('click', () => goTo(track, currentIndex(track) - 1));
  root.querySelector('[data-next]')?.addEventListener('click', () => goTo(track, currentIndex(track) + 1));
  thumbs.forEach((thumb, index) => thumb.addEventListener('click', () => goTo(track, index)));
  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(track, currentIndex(track) - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(track, currentIndex(track) + 1);
    }
  });

  // Tela cheia
  const lightbox = root.querySelector<HTMLDialogElement>('[data-lightbox]');
  const lbTrack = lightbox?.querySelector<HTMLElement>('[data-lb-track]');
  const lbCounter = lightbox?.querySelector<HTMLElement>('[data-lb-counter]');
  if (!lightbox || !lbTrack) return;

  const loadImages = () => {
    lbTrack.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((img) => {
      img.src = img.dataset.src ?? '';
      img.removeAttribute('data-src');
    });
  };
  const updateLb = () => {
    if (lbCounter) lbCounter.textContent = `${currentIndex(lbTrack) + 1} / ${count}`;
  };
  onScrollEnd(lbTrack, updateLb);

  root.querySelectorAll<HTMLElement>('[data-open-lightbox]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const raw = btn.dataset.openLightbox;
      const index = raw === 'current' ? currentIndex(track) : Number(raw);
      loadImages();
      lightbox.showModal();
      document.documentElement.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        goTo(lbTrack, index, false);
        updateLb();
      });
    });
  });
  lightbox.querySelector('[data-lb-close]')?.addEventListener('click', () => lightbox.close());
  lightbox.querySelector('[data-lb-prev]')?.addEventListener('click', () => goTo(lbTrack, currentIndex(lbTrack) - 1));
  lightbox.querySelector('[data-lb-next]')?.addEventListener('click', () => goTo(lbTrack, currentIndex(lbTrack) + 1));
  lightbox.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') goTo(lbTrack, currentIndex(lbTrack) - 1);
    if (event.key === 'ArrowRight') goTo(lbTrack, currentIndex(lbTrack) + 1);
  });
  lightbox.addEventListener('close', () => {
    document.documentElement.style.overflow = '';
    goTo(track, currentIndex(lbTrack), false);
    update();
  });
}

export function initGalleries() {
  document.querySelectorAll<HTMLElement>('[data-gallery]').forEach(initGallery);
}
