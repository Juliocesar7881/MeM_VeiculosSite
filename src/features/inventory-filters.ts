/**
 * Filtros do estoque (melhoria progressiva — sem JS o formulário GET funciona normalmente).
 * - Desktop: aplica automaticamente ao alterar selects/checkbox.
 * - Celular: gaveta lateral com botão "Ver resultados".
 * - Remove campos vazios da URL e formata valores monetários.
 */
const DESKTOP = window.matchMedia('(min-width: 1024px)');

type Field = HTMLInputElement | HTMLSelectElement;

function submitClean(form: HTMLFormElement) {
  const disabled: Field[] = [];
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement) || !el.name) continue;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') continue;
    const value = el.value.trim();
    const isDefaultSort = el.name === 'ordem' && value === 'recentes';
    if (!value || isDefaultSort) {
      el.disabled = true;
      disabled.push(el);
    } else if (el.hasAttribute('data-money')) {
      el.value = value.replace(/\D/g, '');
    }
  }
  form.submit();
  // Caso a navegação seja cancelada (ex.: bfcache), reabilita os campos.
  window.setTimeout(() => disabled.forEach((el) => (el.disabled = false)), 1500);
}

function initDrawer(panel: HTMLElement) {
  const openBtn = document.querySelector<HTMLButtonElement>('[data-filter-open]');
  const closeBtn = panel.querySelector<HTMLButtonElement>('[data-filter-close]');
  const backdrop = document.querySelector<HTMLElement>('[data-filter-backdrop]');

  const setOpen = (open: boolean) => {
    panel.classList.toggle('is-open', open);
    if (backdrop) backdrop.hidden = !open;
    openBtn?.setAttribute('aria-expanded', String(open));
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (open) panel.querySelector<HTMLElement>('input, select, button')?.focus();
    else openBtn?.focus();
  };

  openBtn?.addEventListener('click', () => setOpen(true));
  closeBtn?.addEventListener('click', () => setOpen(false));
  backdrop?.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('is-open')) setOpen(false);
  });
  DESKTOP.addEventListener('change', (e) => {
    if (e.matches) setOpen(false);
  });
}

export function initInventoryFilters() {
  const form = document.querySelector<HTMLFormElement>('[data-filter-form]');
  const panel = document.querySelector<HTMLElement>('[data-filter-panel]');
  if (!form || !panel) return;

  initDrawer(panel);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitClean(form);
  });

  form.querySelectorAll<HTMLElement>('[data-autosubmit]').forEach((el) => {
    el.addEventListener('change', () => {
      if (el.hasAttribute('data-brand-select')) {
        const model = form.querySelector<HTMLSelectElement>('select[name="modelo"]');
        if (model) model.value = '';
      }
      if (DESKTOP.matches) submitClean(form);
    });
  });

  form.querySelectorAll<HTMLInputElement>('[data-money]').forEach((input) => {
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '').slice(0, 9);
      input.value = digits ? Number(digits).toLocaleString('pt-BR') : '';
    });
  });

  document.querySelector<HTMLSelectElement>('[data-sort-select]')?.addEventListener('change', () => submitClean(form));
}
