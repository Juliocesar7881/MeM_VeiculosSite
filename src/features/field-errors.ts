/**
 * Avisos de campo ("Informe a marca.") que somem assim que a pessoa corrige o campo, sem esperar um
 * novo envio: um aviso que continua na tela depois de preenchido faz a pessoa achar que errou.
 *
 * O erro de um campo é o elemento `[data-error-for="campo"]` e/ou `aria-invalid="true"` no campo.
 * - Ao digitar/marcar: se `validate` disser que o campo está bom (ou se não houver `validate`), o aviso sai.
 * - Ao sair do campo ainda com problema: o texto do aviso é atualizado (ex.: WhatsApp incompleto).
 * Usado no formulário público (Anuncie seu veículo) e no cadastro de veículos do painel.
 */
export interface LiveFieldErrorsOptions {
  /** Mensagem de erro atual do campo, ou null se ele já está bom. */
  validate?: (field: string) => string | null;
  /** Chamado depois de cada mudança, com a quantidade de campos que ainda têm aviso. */
  onUpdate?: (remaining: number) => void;
}

type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const fieldsNamed = (form: HTMLFormElement, field: string) =>
  form.querySelectorAll<FieldElement>(`[name="${CSS.escape(field)}"]`);

const errorSlots = (form: HTMLFormElement, field: string) =>
  form.querySelectorAll<HTMLElement>(`[data-error-for="${CSS.escape(field)}"]`);

function hasError(form: HTMLFormElement, field: string): boolean {
  return (
    [...fieldsNamed(form, field)].some((el) => el.getAttribute('aria-invalid') === 'true') ||
    [...errorSlots(form, field)].some((el) => !el.hidden)
  );
}

function clearFieldError(form: HTMLFormElement, field: string) {
  const inputs = fieldsNamed(form, field);
  inputs.forEach((el) => el.removeAttribute('aria-invalid'));
  errorSlots(form, field).forEach((slot) => {
    if (!slot.dataset.generated) {
      slot.hidden = true;
      return;
    }
    inputs.forEach((el) => {
      if (slot.id && el.getAttribute('aria-describedby') === slot.id) el.removeAttribute('aria-describedby');
    });
    slot.remove();
  });
}

/** Quantos campos do formulário ainda mostram aviso de erro. */
export function fieldsWithErrors(form: HTMLFormElement): number {
  const names = new Set<string>();
  form.querySelectorAll<FieldElement>('[name][aria-invalid="true"]').forEach((el) => names.add(el.name));
  form.querySelectorAll<HTMLElement>('[data-error-for]').forEach((el) => {
    if (!el.hidden && el.dataset.errorFor) names.add(el.dataset.errorFor);
  });
  return names.size;
}

export function initLiveFieldErrors(form: HTMLFormElement, options: LiveFieldErrorsOptions = {}) {
  const handle = (event: Event) => {
    const target = event.target;
    if (!(
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    )) {
      return;
    }
    const field = target.name;
    if (!field || !hasError(form, field)) return;
    const message = options.validate?.(field) ?? null;
    if (!message) {
      clearFieldError(form, field);
    } else if (event.type === 'change') {
      errorSlots(form, field).forEach((slot) => {
        if (!slot.hidden) slot.textContent = message;
      });
    } else {
      return;
    }
    options.onUpdate?.(fieldsWithErrors(form));
  };
  form.addEventListener('input', handle);
  form.addEventListener('change', handle);
}
