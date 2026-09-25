/**
 * Lista de opções própria para <select data-select-menu> (melhoria progressiva).
 *
 * O <select> nativo continua no formulário (é ele que envia o valor e dispara "change"),
 * mas fica escondido; no lugar entra um botão que abre uma lista com uma linha entre as
 * opções, marca na escolhida, teclado completo (setas, Home/End, Enter, Esc, digitar a
 * inicial) e posição inteligente (abre para cima quando não cabe embaixo).
 *
 * A lista usa a Popover API (camada do topo): não é cortada por gavetas com rolagem nem
 * por elementos com transform. Sem suporte, o <select> nativo continua como está.
 */

let uid = 0;

const CHEVRON =
  '<svg class="select-trigger-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
const CHECK =
  '<svg class="select-option-check" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>';

function supportsPopover(): boolean {
  return typeof HTMLElement !== 'undefined' && Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'popover');
}

function enhance(select: HTMLSelectElement) {
  if (select.dataset.selectMenuReady) return;
  select.dataset.selectMenuReady = 'true';

  const id = select.id || `select-${(uid += 1)}`;
  const listId = `${id}-lista`;

  // O botão assume o id do select: o <label for> passa a apontar para ele.
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = id;
  select.id = `${id}-nativo`;
  trigger.className = `${select.className} select-trigger`;
  for (const attr of Array.from(select.attributes)) {
    if (attr.name.startsWith('data-astro-cid')) trigger.setAttribute(attr.name, attr.value);
  }
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', listId);
  const described = select.getAttribute('aria-describedby');
  if (described) trigger.setAttribute('aria-describedby', described);
  trigger.innerHTML = `<span class="select-trigger-value"></span>${CHEVRON}`;
  const valueEl = trigger.querySelector<HTMLElement>('.select-trigger-value') as HTMLElement;

  const list = document.createElement('ul');
  list.id = listId;
  list.className = 'select-menu';
  list.setAttribute('role', 'listbox');
  list.setAttribute('popover', 'manual');
  list.tabIndex = -1;
  const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
  if (label) {
    label.id ||= `${id}-rotulo`;
    list.setAttribute('aria-labelledby', label.id);
    // Leitor de tela anuncia o rótulo e a escolha atual ("Categoria, Motos").
    valueEl.id = `${id}-valor`;
    trigger.setAttribute('aria-labelledby', `${label.id} ${valueEl.id}`);
  }

  select.classList.add('select-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  select.after(trigger);
  document.body.append(list);

  let active = -1;
  let typed = '';
  let typedTimer = 0;

  const options = () => Array.from(select.options);
  const items = () => Array.from(list.children) as HTMLElement[];

  const syncTrigger = () => {
    const current = select.selectedOptions[0] ?? select.options[0];
    valueEl.textContent = current?.textContent?.trim() ?? '';
    trigger.disabled = select.disabled;
  };

  const build = () => {
    list.replaceChildren(
      ...options().map((option, index) => {
        const li = document.createElement('li');
        li.id = `${listId}-${index}`;
        li.className = 'select-option';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(option.selected));
        if (option.disabled) li.setAttribute('aria-disabled', 'true');
        li.innerHTML = `<span class="select-option-label"></span>${CHECK}`;
        (li.firstElementChild as HTMLElement).textContent = option.textContent?.trim() ?? '';
        li.dataset.index = String(index);
        return li;
      }),
    );
  };

  const setActive = (index: number) => {
    const all = items();
    if (!all.length) return;
    active = Math.max(0, Math.min(index, all.length - 1));
    all.forEach((li, i) => li.classList.toggle('is-active', i === active));
    const li = all[active];
    if (li) {
      list.setAttribute('aria-activedescendant', li.id);
      li.scrollIntoView({ block: 'nearest' });
    }
  };

  const place = () => {
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    const width = Math.max(rect.width, 200);
    const below = window.innerHeight - rect.bottom - gap - margin;
    const above = rect.top - gap - margin;
    list.style.minWidth = `${width}px`;
    list.style.maxWidth = `${Math.min(window.innerWidth - margin * 2, Math.max(width, 320))}px`;
    const natural = Math.min(list.scrollHeight, 320);
    const openUp = below < natural && above > below;
    list.style.maxHeight = `${Math.max(120, Math.min(320, openUp ? above : below))}px`;
    const left = Math.min(rect.left, window.innerWidth - margin - list.offsetWidth);
    list.style.left = `${Math.max(margin, left)}px`;
    if (openUp) {
      list.style.top = 'auto';
      list.style.bottom = `${window.innerHeight - rect.top + gap}px`;
    } else {
      list.style.bottom = 'auto';
      list.style.top = `${rect.bottom + gap}px`;
    }
    list.dataset.side = openUp ? 'top' : 'bottom';
  };

  const isOpen = () => trigger.getAttribute('aria-expanded') === 'true';

  const onViewportChange = () => {
    if (isOpen()) place();
  };

  const onOutside = (event: PointerEvent) => {
    const target = event.target as Node;
    if (!list.contains(target) && !trigger.contains(target)) close(false);
  };

  function open() {
    if (select.disabled || isOpen()) return;
    build();
    list.showPopover();
    place();
    trigger.setAttribute('aria-expanded', 'true');
    setActive(Math.max(0, select.selectedIndex));
    list.focus({ preventScroll: true });
    document.addEventListener('pointerdown', onOutside, true);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
  }

  function close(returnFocus = true) {
    if (!isOpen()) return;
    trigger.setAttribute('aria-expanded', 'false');
    list.removeAttribute('aria-activedescendant');
    list.hidePopover();
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange);
    if (returnFocus) trigger.focus({ preventScroll: true });
  }

  const choose = (index: number) => {
    const option = select.options[index];
    if (!option || option.disabled) return;
    const changed = select.selectedIndex !== index;
    select.selectedIndex = index;
    syncTrigger();
    close();
    if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const typeahead = (key: string) => {
    window.clearTimeout(typedTimer);
    typed += key.toLowerCase();
    typedTimer = window.setTimeout(() => (typed = ''), 600);
    const all = options();
    const start = typed.length === 1 ? active + 1 : active;
    for (let step = 0; step < all.length; step += 1) {
      const index = (start + step) % all.length;
      const text = all[index]?.textContent?.trim().toLowerCase() ?? '';
      if (text.startsWith(typed)) return index;
    }
    return -1;
  };

  trigger.addEventListener('click', () => (isOpen() ? close() : open()));
  trigger.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      open();
    }
  });

  list.addEventListener('keydown', (event) => {
    const count = select.options.length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive(active + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive(active - 1);
        break;
      case 'Home':
      case 'PageUp':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
      case 'PageDown':
        event.preventDefault();
        setActive(count - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        choose(active);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation(); // não fecha a gaveta de filtros junto
        close();
        break;
      case 'Tab':
        close(false);
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const index = typeahead(event.key);
          if (index >= 0) setActive(index);
        }
    }
  });

  list.addEventListener('pointermove', (event) => {
    const li = (event.target as HTMLElement).closest<HTMLElement>('.select-option');
    if (li?.dataset.index && Number(li.dataset.index) !== active) setActive(Number(li.dataset.index));
  });
  list.addEventListener('click', (event) => {
    const li = (event.target as HTMLElement).closest<HTMLElement>('.select-option');
    if (li?.dataset.index) choose(Number(li.dataset.index));
  });

  // Opções ou "disabled" mudados por outro script (ex.: modelos da marca escolhida).
  new MutationObserver(syncTrigger).observe(select, {
    attributes: true,
    attributeFilter: ['disabled'],
    childList: true,
    subtree: true,
  });
  select.addEventListener('change', syncTrigger);
  // Voltar pelo histórico (bfcache) restaura o valor do select: atualiza o botão.
  window.addEventListener('pageshow', syncTrigger);
  syncTrigger();
}

export function initSelectMenus(root: ParentNode = document) {
  if (!supportsPopover()) return;
  root.querySelectorAll<HTMLSelectElement>('select[data-select-menu]').forEach(enhance);
}
