/**
 * Confirmações do painel desenhadas na própria página (nunca o `confirm()` do navegador, que abre
 * uma caixa no topo da janela com o endereço do site).
 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger`: ação destrutiva (botão vermelho, foco inicial em "Cancelar"). */
  tone?: 'default' | 'danger';
  /** Ícone: lixeira (padrão das ações destrutivas), alerta ou interrogação (padrão das demais). */
  icon?: 'trash' | 'alert' | 'question';
  /** Miniatura exibida no diálogo (ex.: a foto que será excluída). */
  imageSrc?: string;
}

const SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const ICONS = {
  trash: `${SVG_OPEN}<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5L17.5 7M10.2 11v6M13.8 11v6"/></svg>`,
  alert: `${SVG_OPEN}<path d="M10.3 4.3 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4.5M12 17v.2"/></svg>`,
  question: `${SVG_OPEN}<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17v.2"/></svg>`,
};

let counter = 0;
let active: Promise<boolean> | null = null;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const el = document.createElement(tag);
  el.className = className;
  if (text) el.textContent = text;
  return el;
}

/** Abre o diálogo e resolve `true` se a pessoa confirmar. Só um por vez. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (active) return active.then(() => false);
  counter += 1;
  const id = `confirm-${counter}`;
  const danger = options.tone === 'danger';

  const dialog = element('dialog', `confirm-dialog${danger ? ' is-danger' : ''}`);
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  if (options.message) dialog.setAttribute('aria-describedby', `${id}-text`);

  const card = element('div', 'confirm-card');
  const icon = element('span', 'confirm-icon');
  icon.innerHTML = ICONS[options.icon ?? (danger ? 'trash' : 'question')]; // SVG fixo, sem dados externos
  const title = element('h2', 'confirm-title', options.title);
  title.id = `${id}-title`;
  card.append(icon, title);
  if (options.message) {
    const text = element('p', 'confirm-text', options.message);
    text.id = `${id}-text`;
    card.append(text);
  }
  if (options.imageSrc) {
    const img = element('img', 'confirm-image');
    img.src = options.imageSrc;
    img.alt = '';
    card.append(img);
  }
  const actions = element('div', 'confirm-actions');
  const cancel = element('button', 'btn btn-ghost', options.cancelLabel ?? 'Cancelar');
  cancel.type = 'button';
  const confirm = element(
    'button',
    `btn ${danger ? 'btn-confirm-danger' : 'btn-gold'}`,
    options.confirmLabel ?? 'Confirmar',
  );
  confirm.type = 'button';
  actions.append(cancel, confirm);
  card.append(actions);
  dialog.append(card);

  const previousFocus = document.activeElement as HTMLElement | null;
  document.body.append(dialog);
  dialog.showModal();
  (danger ? cancel : confirm).focus();

  active = new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (value: boolean) => {
      if (done) return;
      done = true;
      dialog.classList.add('is-closing');
      const remove = () => {
        dialog.close();
        dialog.remove();
        active = null;
        if (!value) previousFocus?.focus?.();
        resolve(value);
      };
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) remove();
      else window.setTimeout(remove, 150);
    };
    confirm.addEventListener('click', () => finish(true));
    cancel.addEventListener('click', () => finish(false));
    // Esc e clique fora do cartão cancelam.
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) finish(false);
    });
  });
  return active;
}

/** Lê as opções de um elemento: data-confirm (texto), data-confirm-title, -ok, -tone. */
export function confirmOptionsFrom(el: HTMLElement): ConfirmOptions | null {
  const { confirm, confirmTitle, confirmOk, confirmTone } = el.dataset;
  if (!confirm && !confirmTitle) return null;
  return {
    title: confirmTitle ?? confirm ?? '',
    message: confirmTitle ? confirm : undefined,
    confirmLabel: confirmOk,
    tone: confirmTone === 'danger' ? 'danger' : 'default',
  };
}

/**
 * Aviso ao sair da página com trabalho em andamento (fotos sendo enviadas, formulário não salvo).
 * Fica no próprio elemento (data-leave-warning), então vale entre scripts diferentes do painel.
 * `null` remove o aviso.
 */
export function setLeaveWarning(el: HTMLElement, warning: { title: string; message: string; ok: string } | null) {
  if (!warning) {
    delete el.dataset.leaveWarning;
    return;
  }
  el.dataset.leaveWarning = warning.message;
  el.dataset.leaveTitle = warning.title;
  el.dataset.leaveOk = warning.ok;
}

/** Aviso pendente, ignorando o do próprio formulário que está sendo enviado (salvar não é "sair"). */
export function leaveWarning(except?: Element | null): ConfirmOptions | null {
  const el = Array.from(document.querySelectorAll<HTMLElement>('[data-leave-warning]')).find(
    (candidate) => !except || !except.contains(candidate),
  );
  if (!el) return null;
  return {
    title: el.dataset.leaveTitle ?? 'Sair desta página?',
    message: el.dataset.leaveWarning,
    confirmLabel: el.dataset.leaveOk ?? 'Sair mesmo assim',
    cancelLabel: 'Continuar aqui',
    tone: 'danger',
    icon: 'alert',
  };
}
