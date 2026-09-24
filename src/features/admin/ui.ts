/** Comportamentos gerais do painel (sem dependências). */
export function initAdminUi() {
  // Confirmação para ações destrutivas: <form data-confirm="Mensagem">
  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target as HTMLFormElement | null;
      const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
      const message = submitter?.dataset.confirm ?? form?.dataset.confirm;
      if (message && !window.confirm(message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      // Evita envio duplo
      if (submitter && !submitter.hasAttribute('data-allow-repeat')) {
        window.setTimeout(() => {
          submitter.disabled = true;
          submitter.setAttribute('aria-busy', 'true');
        }, 0);
      }
    },
    true,
  );

  // Remove mensagens (?ok= / ?erro=) da URL para não reaparecerem ao atualizar.
  const url = new URL(window.location.href);
  if (url.searchParams.has('ok') || url.searchParams.has('erro')) {
    url.searchParams.delete('ok');
    url.searchParams.delete('erro');
    window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
  }

  // Menus <details data-menu>: fecha ao clicar fora ou abrir outro.
  document.addEventListener('click', (event) => {
    const target = event.target as Element;
    document.querySelectorAll<HTMLDetailsElement>('details[data-menu][open]').forEach((menu) => {
      if (!menu.contains(target)) menu.open = false;
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll<HTMLDetailsElement>('details[data-menu][open]').forEach((menu) => {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    });
  });
}
