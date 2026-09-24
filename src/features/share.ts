/** Compartilhar: Web Share API (celular) com fallback para copiar o link. */
export function initShareButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-share]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const url = btn.dataset.shareUrl ?? window.location.href;
      const title = btn.dataset.shareTitle ?? document.title;
      const label = btn.querySelector<HTMLElement>('[data-share-label]');
      try {
        if (navigator.share) {
          await navigator.share({ title, url });
          return;
        }
        await navigator.clipboard.writeText(url);
        if (label) {
          const original = label.textContent;
          label.textContent = 'Link copiado!';
          window.setTimeout(() => (label.textContent = original), 2200);
        }
      } catch {
        // Usuário cancelou o compartilhamento — nada a fazer.
      }
    });
  });
}
