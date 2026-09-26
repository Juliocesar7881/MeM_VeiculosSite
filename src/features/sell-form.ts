import { initLiveFieldErrors } from './field-errors';
import { extensionFor, ImageProcessingError, makeImagePair, type PairOptions } from './image-compress';

interface Limits extends PairOptions {
  maxPhotos: number;
}

interface Photo {
  id: string;
  large: Blob;
  thumb: Blob;
  previewUrl: string;
}

interface TurnstileApi {
  render: (
    el: HTMLElement,
    options: { sitekey: string; theme: 'dark'; language: string; size: 'flexible' | 'compact' },
  ) => string;
  reset: (widget?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Renderiza o Turnstile de forma explícita: em telas muito estreitas (< 300px disponíveis)
 * usa o tamanho "compact" para não causar rolagem horizontal.
 */
function renderTurnstile(): Promise<string | null> {
  const el = document.querySelector<HTMLElement>('[data-turnstile]');
  if (!el) return Promise.resolve(null);
  return new Promise((resolve) => {
    let tries = 0;
    const attempt = () => {
      const api = window.turnstile;
      if (api) {
        const size = el.clientWidth < 300 ? 'compact' : 'flexible';
        resolve(api.render(el, { sitekey: el.dataset.sitekey ?? '', theme: 'dark', language: 'pt-br', size }));
        return;
      }
      tries += 1;
      if (tries < 150) window.setTimeout(attempt, 100);
      else resolve(null);
    };
    attempt();
  });
}

/** Campos obrigatórios e o aviso de cada um (mesmo texto do servidor, schemas/lead.ts). */
const REQUIRED_MESSAGES: Record<string, string> = {
  name: 'Informe seu nome.',
  whatsapp: 'Informe seu WhatsApp.',
  brand: 'Informe a marca.',
  model: 'Informe o modelo.',
  manufactureYear: 'Informe o ano de fabricação.',
};

const reviseMessage = (count: number) =>
  `Revise ${count === 1 ? 'o campo destacado' : `os ${count} campos destacados`}.`;

function formatThousands(input: HTMLInputElement) {
  const digits = input.value.replace(/\D/g, '').slice(0, 12);
  input.value = digits ? Number(digits).toLocaleString('pt-BR') : '';
}

function formatPhone(input: HTMLInputElement) {
  let d = input.value.replace(/\D/g, '');
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) input.value = d ? `(${d}` : '';
  else if (d.length <= 6) input.value = `(${d.slice(0, 2)}) ${d.slice(2)}`;
  else if (d.length <= 10) input.value = `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  else input.value = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function initSellForm() {
  const form = document.querySelector<HTMLFormElement>('[data-sell-form]');
  if (!form) return;
  const limits = JSON.parse(form.dataset.limits ?? '{}') as Limits;
  const alertBox = form.querySelector<HTMLElement>('[data-form-alert]');
  const photoInput = form.querySelector<HTMLInputElement>('[data-photo-input]');
  const dropzone = form.querySelector<HTMLElement>('[data-dropzone]');
  const list = form.querySelector<HTMLUListElement>('[data-photo-list]');
  const photoError = form.querySelector<HTMLElement>('[data-photo-error]');
  const submit = form.querySelector<HTMLButtonElement>('[data-submit]');
  const submitLabel = form.querySelector<HTMLElement>('[data-submit-label]');
  const success = document.querySelector<HTMLElement>('[data-sell-success]');
  const photos: Photo[] = [];
  let processing = 0;
  let widgetId: string | null = null;
  void renderTurnstile().then((id) => {
    widgetId = id;
  });

  form
    .querySelectorAll<HTMLInputElement>('[data-thousands]')
    .forEach((el) => el.addEventListener('input', () => formatThousands(el)));
  form
    .querySelectorAll<HTMLInputElement>('[data-phone]')
    .forEach((el) => el.addEventListener('input', () => formatPhone(el)));

  const showPhotoError = (message: string) => {
    if (!photoError) return;
    photoError.textContent = message;
    photoError.hidden = !message;
  };

  const renderPhotos = () => {
    if (!list) return;
    list.replaceChildren(
      ...photos.map((photo, index) => {
        const li = document.createElement('li');
        li.className = 'relative aspect-[4/3] overflow-hidden rounded-lg border border-white/10';
        const img = document.createElement('img');
        img.src = photo.previewUrl;
        img.alt = `Foto ${index + 1}`;
        img.className = 'h-full w-full object-cover';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className =
          'absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black';
        remove.setAttribute('aria-label', `Remover foto ${index + 1}`);
        remove.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
        remove.addEventListener('click', () => {
          URL.revokeObjectURL(photo.previewUrl);
          photos.splice(photos.indexOf(photo), 1);
          renderPhotos();
        });
        li.append(img, remove);
        return li;
      }),
    );
    for (let i = 0; i < processing; i += 1) {
      const li = document.createElement('li');
      li.className =
        'grid aspect-[4/3] place-items-center rounded-lg border border-white/10 bg-white/5 text-xs text-mist-400';
      li.textContent = 'Otimizando…';
      list.append(li);
    }
  };

  const addFiles = async (files: FileList | File[]) => {
    showPhotoError('');
    const available = limits.maxPhotos - photos.length - processing;
    const selected = Array.from(files).slice(0, Math.max(0, available));
    if (files.length > selected.length) {
      showPhotoError(`Você pode enviar até ${limits.maxPhotos} fotos.`);
    }
    processing += selected.length;
    renderPhotos();
    for (const file of selected) {
      try {
        const pair = await makeImagePair(file, limits);
        photos.push({
          id: crypto.randomUUID(),
          large: pair.large.blob,
          thumb: pair.thumb.blob,
          previewUrl: URL.createObjectURL(pair.thumb.blob),
        });
      } catch (error) {
        showPhotoError(
          error instanceof ImageProcessingError ? error.message : 'Não foi possível processar uma das fotos.',
        );
      } finally {
        processing -= 1;
        renderPhotos();
      }
    }
  };

  photoInput?.addEventListener('change', () => {
    if (photoInput.files) void addFiles(photoInput.files);
    photoInput.value = '';
  });
  if (dropzone) {
    ['dragenter', 'dragover'].forEach((type) =>
      dropzone.addEventListener(type, (e) => {
        e.preventDefault();
        dropzone.classList.add('is-over');
      }),
    );
    ['dragleave', 'drop'].forEach((type) =>
      dropzone.addEventListener(type, () => dropzone.classList.remove('is-over')),
    );
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer?.files) void addFiles(e.dataTransfer.files);
    });
  }

  const clearErrors = () => {
    if (alertBox) alertBox.hidden = true;
    form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
    form.querySelectorAll<HTMLElement>('.field-error[data-generated], [data-error-for]').forEach((el) => {
      if (el.dataset.generated) el.remove();
      else el.hidden = true;
    });
  };

  const showErrors = (errors: Record<string, string>, message?: string) => {
    let first: HTMLElement | null = null;
    for (const [field, text] of Object.entries(errors)) {
      const slot = form.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
      const input = form.querySelector<HTMLElement>(`[name="${field}"]`);
      if (input) input.setAttribute('aria-invalid', 'true');
      if (slot) {
        slot.textContent = text;
        slot.hidden = false;
      } else if (input) {
        const p = document.createElement('p');
        p.className = 'field-error';
        p.dataset.generated = 'true';
        p.textContent = text;
        p.dataset.errorFor = field;
        const id = `err-${field}`;
        p.id = id;
        input.setAttribute('aria-describedby', id);
        (input.closest('.relative') ?? input).insertAdjacentElement('afterend', p);
      }
      first ??= input;
    }
    if (alertBox) {
      const count = Object.keys(errors).length;
      alertBox.textContent = message ?? (count ? reviseMessage(count) : 'Verifique os dados.');
      // Aviso sobre campos: acompanha as correções (some quando todos estiverem certos).
      alertBox.dataset.fields = String(count > 0);
      alertBox.hidden = false;
    }
    (first ?? alertBox)?.focus?.({ preventScroll: false });
    (first ?? alertBox)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const clientValidate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const data = new FormData(form);
    for (const [field, message] of Object.entries(REQUIRED_MESSAGES)) {
      if (!String(data.get(field) ?? '').trim()) errors[field] = message;
    }
    if (String(data.get('name') ?? '').trim().length === 1) errors.name = 'Seu nome deve ter ao menos 2 caracteres.';
    if (!data.get('category')) errors.category = 'Selecione a categoria.';
    if (!data.get('consent')) errors.consent = 'É necessário autorizar o contato para enviar.';
    const phone = String(data.get('whatsapp') ?? '').replace(/\D/g, '');
    if (phone && (phone.length < 10 || phone.length > 13)) errors.whatsapp = 'Informe um WhatsApp válido com DDD.';
    return errors;
  };

  // O aviso de cada campo some assim que ele é preenchido/corrigido (sem esperar um novo envio).
  initLiveFieldErrors(form, {
    validate: (field) => clientValidate()[field] ?? null,
    onUpdate: (remaining) => {
      if (!alertBox || alertBox.dataset.fields !== 'true') return;
      if (remaining === 0) alertBox.hidden = true;
      else alertBox.textContent = reviseMessage(remaining);
    },
  });

  const setLoading = (loading: boolean, text?: string) => {
    if (!submit) return;
    submit.disabled = loading;
    submit.setAttribute('aria-busy', String(loading));
    if (submitLabel) submitLabel.textContent = text ?? (loading ? 'Enviando…' : 'Enviar para avaliação');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    if (processing > 0) {
      showPhotoError('Aguarde a otimização das fotos terminar.');
      return;
    }
    const errors = clientValidate();
    if (Object.keys(errors).length) {
      showErrors(errors);
      return;
    }

    const body = new FormData(form);
    for (const key of ['mileage', 'usageHours', 'desiredPrice']) {
      const value = String(body.get(key) ?? '').replace(/\D/g, '');
      body.set(key, value);
    }
    photos.forEach((photo, index) => {
      body.append(`photo_large_${index}`, photo.large, `foto-${index + 1}.${extensionFor(photo.large)}`);
      body.append(`photo_thumb_${index}`, photo.thumb, `foto-${index + 1}-thumb.${extensionFor(photo.thumb)}`);
    });

    setLoading(true);
    try {
      const res = await fetch(form.action, { method: 'POST', body, headers: { Accept: 'application/json' } });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        fieldErrors?: Record<string, string>;
      };
      if (res.ok && data.ok) {
        photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        form.hidden = true;
        form.style.display = 'none';
        success?.classList.add('is-visible');
        success?.focus();
        success?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      showErrors(data.fieldErrors ?? {}, data.error ?? 'Não foi possível enviar. Tente novamente.');
    } catch {
      showErrors({}, 'Falha de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setLoading(false);
      if (widgetId) window.turnstile?.reset(widgetId);
    }
  });
}
