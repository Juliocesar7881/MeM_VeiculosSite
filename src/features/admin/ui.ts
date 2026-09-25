import { clearBusy, markBusy } from './busy-button';
import { confirmDialog, confirmOptionsFrom, leaveWarning } from './confirm-dialog';
import { initFeedback } from './feedback';

/** Comportamentos gerais do painel (sem dependências). */
export function initAdminUi() {
  // Confirmações na própria página: <form data-confirm-title="Excluir?" data-confirm="Detalhes">
  // (ou os mesmos atributos no botão). Com envio de fotos em andamento, pede para confirmar a saída.
  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;
      const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
      if (form.dataset.confirmed === 'true') {
        delete form.dataset.confirmed;
      } else {
        const own = (submitter && confirmOptionsFrom(submitter)) ?? confirmOptionsFrom(form);
        const leaving = leaveWarning(form);
        if (own || leaving) {
          event.preventDefault();
          event.stopImmediatePropagation();
          void (async () => {
            if (leaving && !(await confirmDialog(leaving))) return;
            if (own && !(await confirmDialog(own))) return;
            form.dataset.confirmed = 'true';
            form.requestSubmit(submitter ?? undefined);
          })();
          return;
        }
      }
      if (submitter && !submitter.hasAttribute('data-allow-repeat')) {
        window.setTimeout(() => markBusy(submitter), 0);
      }
    },
    true,
  );

  // Links internos com envio de fotos em andamento: confirma antes de sair.
  document.addEventListener('click', (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target === '_blank' || link.hasAttribute('download')) return;
    const url = new URL(link.href, window.location.href);
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
    const leaving = leaveWarning();
    if (!leaving) return;
    event.preventDefault();
    void confirmDialog(leaving).then((ok) => {
      if (ok) window.location.assign(url.href);
    });
  });

  // Voltar pelo navegador (página restaurada do cache): botões voltam ao normal.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    document.querySelectorAll<HTMLButtonElement>('button.is-busy').forEach(clearBusy);
  });

  // Remove mensagens (?ok= / ?erro=) da URL para não reaparecerem ao atualizar.
  const url = new URL(window.location.href);
  if (url.searchParams.has('ok') || url.searchParams.has('erro')) {
    for (const key of ['ok', 'erro', 'fs', 'fx']) url.searchParams.delete(key);
    window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
  }

  initFeedback();

  // Menus <details data-menu>: fecha ao clicar fora ou abrir outro.
  document.addEventListener('click', (event) => {
    const target = event.target as Element;
    document.querySelectorAll<HTMLDetailsElement>('details[data-menu][open]').forEach((menu) => {
      if (!menu.contains(target)) menu.open = false;
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    document.querySelectorAll<HTMLDetailsElement>('details[data-menu][open]').forEach((menu) => {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    });
  });
}
