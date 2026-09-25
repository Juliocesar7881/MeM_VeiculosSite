/**
 * Retorno visual do painel: aviso flutuante ("Alterações salvas.") que some sozinho e a
 * comemoração quando um veículo é cadastrado ou publicado (renderizados em AdminFeedback.astro).
 */
const CONFETTI_COLORS = ['#f8d970', '#f2c12e', '#d8a813', '#ffffff', '#37c47e'];
const CONFETTI_PIECES = 42;
const CELEBRATION_MS = 2800;

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function dismissToast(toast: HTMLElement) {
  if (toast.classList.contains('is-leaving')) return;
  toast.classList.add('is-leaving');
  window.setTimeout(() => toast.remove(), reducedMotion() ? 0 : 260);
}

function initToasts() {
  document.querySelectorAll<HTMLElement>('[data-toast]').forEach((toast) => {
    toast.querySelector('[data-toast-close]')?.addEventListener('click', () => dismissToast(toast));
    const delay = Number(toast.dataset.autoclose ?? 0);
    if (!delay) return;
    // Pausa enquanto o mouse está em cima (dá tempo de ler).
    let timer = window.setTimeout(() => dismissToast(toast), delay);
    toast.addEventListener('mouseenter', () => {
      window.clearTimeout(timer);
      toast.classList.add('is-paused');
    });
    toast.addEventListener('mouseleave', () => {
      toast.classList.remove('is-paused');
      timer = window.setTimeout(() => dismissToast(toast), 1800);
    });
  });
}

function burstConfetti(container: HTMLElement) {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < CONFETTI_PIECES; i += 1) {
    const piece = document.createElement('i');
    const angle = (Math.PI * 2 * i) / CONFETTI_PIECES + Math.random() * 0.5;
    const distance = 110 + Math.random() * 150;
    piece.style.setProperty('--x', `${Math.round(Math.cos(angle) * distance)}px`);
    piece.style.setProperty('--y', `${Math.round(Math.sin(angle) * distance * 0.75 - 60)}px`);
    piece.style.setProperty('--r', `${Math.round(Math.random() * 720 - 360)}deg`);
    piece.style.setProperty('--d', `${Math.round(Math.random() * 120)}ms`);
    piece.style.setProperty('--c', CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? '#f2c12e');
    if (i % 3 === 0) piece.classList.add('is-round');
    fragment.append(piece);
  }
  container.append(fragment);
}

function initCelebration() {
  const overlay = document.querySelector<HTMLElement>('[data-celebrate]');
  if (!overlay) return;
  if (reducedMotion()) {
    overlay.remove();
    return;
  }
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.classList.add('is-leaving');
    window.setTimeout(() => overlay.remove(), 320);
    document.removeEventListener('keydown', close);
  };
  overlay.hidden = false;
  const confetti = overlay.querySelector<HTMLElement>('[data-confetti]');
  if (confetti) window.setTimeout(() => burstConfetti(confetti), 620);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', close);
  window.setTimeout(close, CELEBRATION_MS);
}

export function initFeedback() {
  initToasts();
  initCelebration();
}
