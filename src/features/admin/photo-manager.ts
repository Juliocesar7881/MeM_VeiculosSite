import { extensionFor, ImageProcessingError, makeImagePair, type PairOptions } from '../image-compress';
import { clearBusy, markBusy, setBusyLabel } from './busy-button';
import { confirmDialog, setLeaveWarning } from './confirm-dialog';

interface Config extends PairOptions {
  /** Vazio no cadastro de um veículo novo: as fotos ficam na página e sobem logo depois de salvar. */
  vehicleId: string;
  maxPhotos: number;
}

interface UploadedImage {
  id: string;
  thumbUrl: string;
  thumbWidth: number;
  thumbHeight: number;
}

type ImagePair = Awaited<ReturnType<typeof makeImagePair>>;

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Erro ${res.status}`;
  } catch {
    return `Erro ${res.status}`;
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ImageProcessingError || error instanceof Error ? error.message : fallback;
}

/** Corpo do envio de UMA foto (grande + miniatura + média + compartilhamento), já otimizadas. */
function pairBody(pair: ImagePair): FormData {
  const body = new FormData();
  body.append('large', pair.large.blob, `foto.${extensionFor(pair.large.blob)}`);
  body.append('thumb', pair.thumb.blob, `foto-thumb.${extensionFor(pair.thumb.blob)}`);
  if (pair.medium) body.append('medium', pair.medium.blob, `foto-md.${extensionFor(pair.medium.blob)}`);
  if (pair.og) body.append('og', pair.og, 'foto-og.jpg');
  return body;
}

export function initPhotoManager() {
  const root = document.querySelector<HTMLElement>('[data-photo-manager]');
  if (!root) return;
  const config = JSON.parse(root.dataset.config ?? '{}') as Config;
  const list = root.querySelector<HTMLUListElement>('[data-photo-list]');
  const input = root.querySelector<HTMLInputElement>('[data-photo-input]');
  const dropzone = root.querySelector<HTMLElement>('[data-dropzone]');
  const errorBox = root.querySelector<HTMLElement>('[data-photo-error]');
  const countLabel = root.querySelector<HTMLElement>('[data-photo-count]');
  const empty = root.querySelector<HTMLElement>('[data-photo-empty]');
  const progress = root.querySelector<HTMLElement>('[data-photo-progress]');
  const progressText = progress?.querySelector<HTMLElement>('[data-photo-progress-text]');
  const progressBar = progress?.querySelector<HTMLElement>('[data-photo-progress-bar]');
  const template = document.querySelector<HTMLTemplateElement>('[data-photo-template]');
  if (!list || !template) return;

  /** Cadastro novo: fotos escolhidas ficam aqui (já otimizadas) até o veículo ser salvo. */
  const draft = !config.vehicleId;
  const drafts = new Map<string, ImagePair>();
  let draftCounter = 0;
  let api = draft ? '' : `/api/admin/vehicles/${config.vehicleId}/images`;

  const items = () => Array.from(list.querySelectorAll<HTMLLIElement>('li[data-photo-id]'));
  const refresh = () => {
    const count = list.querySelectorAll('li').length;
    if (countLabel) countLabel.textContent = `(${items().length}/${config.maxPhotos})`;
    if (empty) empty.hidden = count > 0;
    if (draft) {
      setLeaveWarning(
        root,
        drafts.size
          ? {
              title: 'Sair sem salvar?',
              message:
                'As fotos escolhidas ainda não foram salvas. Toque em “Salvar” para cadastrar o veículo com elas.',
              ok: 'Sair sem salvar',
            }
          : null,
      );
    }
  };
  const showError = (message: string) => {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.hidden = !message;
  };

  /** Destaque rápido na foto que mudou de lugar. */
  const flash = (li: HTMLLIElement) => {
    li.classList.remove('is-moved');
    void li.offsetWidth; // reinicia a animação
    li.classList.add('is-moved');
  };

  // ---------------------------------------------------------------- ordem
  let saveTimer = 0;
  const saveOrder = () => {
    if (draft) return; // no cadastro, a ordem da tela é a ordem de envio
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      const order = items().map((li) => li.dataset.photoId ?? '');
      const res = await fetch(`${api}/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      }).catch(() => null);
      if (!res?.ok) showError(res ? await readError(res) : 'Falha de conexão ao salvar a ordem das fotos.');
    }, 400);
  };

  const move = (li: HTMLLIElement, delta: number) => {
    const siblings = items();
    const index = siblings.indexOf(li);
    const target = siblings[index + delta];
    if (!target) return;
    if (delta < 0) list.insertBefore(li, target);
    else list.insertBefore(li, target.nextSibling);
    flash(li);
    saveOrder();
  };

  const removeItem = (li: HTMLLIElement) => {
    li.classList.add('is-removed');
    window.setTimeout(() => {
      li.remove();
      refresh();
    }, 260);
  };

  // ------------------------------------------------------------- ações item
  list.addEventListener('click', async (event) => {
    const btn = (event.target as Element).closest<HTMLButtonElement>('button');
    const li = btn?.closest<HTMLLIElement>('li[data-photo-id]');
    if (!btn || !li) return;
    if (btn.dataset.move) move(li, Number(btn.dataset.move));
    if (btn.hasAttribute('data-make-cover')) {
      list.prepend(li);
      flash(li);
      saveOrder();
    }
    if (!btn.hasAttribute('data-delete')) return;
    const id = li.dataset.photoId ?? '';
    // Foto ainda não salva: só sai da seleção, sem perguntar.
    if (drafts.has(id)) {
      drafts.delete(id);
      removeItem(li);
      return;
    }
    const confirmed = await confirmDialog({
      title: 'Excluir esta foto?',
      message: 'Ela sai do anúncio e é apagada de vez. Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir foto',
      tone: 'danger',
      imageSrc: li.querySelector('img')?.currentSrc || undefined,
    });
    if (!confirmed) return;
    btn.disabled = true;
    li.classList.add('is-deleting');
    const res = await fetch(`${api}/${id}`, { method: 'DELETE' }).catch(() => null);
    if (res?.ok) {
      removeItem(li);
    } else {
      li.classList.remove('is-deleting');
      btn.disabled = false;
      showError(res ? await readError(res) : 'Falha de conexão ao excluir a foto.');
    }
  });

  // --------------------------------------------------------- arrastar/soltar
  let dragging: HTMLLIElement | null = null;
  list.addEventListener('dragstart', (event) => {
    dragging = (event.target as Element).closest<HTMLLIElement>('li[data-photo-id]');
    if (!dragging) return;
    dragging.classList.add('is-dragging');
    event.dataTransfer?.setData('text/plain', dragging.dataset.photoId ?? '');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });
  list.addEventListener('dragover', (event) => {
    if (!dragging) return;
    event.preventDefault();
    const over = (event.target as Element).closest<HTMLLIElement>('li[data-photo-id]');
    if (!over || over === dragging) return;
    const rect = over.getBoundingClientRect();
    const after = event.clientX > rect.left + rect.width / 2;
    list.insertBefore(dragging, after ? over.nextSibling : over);
  });
  list.addEventListener('dragend', () => {
    if (!dragging) return;
    dragging.classList.remove('is-dragging');
    dragging = null;
    saveOrder();
  });

  // ------------------------------------------------------------------ envio
  const createItem = (): HTMLLIElement => {
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const li = fragment.querySelector('li') as HTMLLIElement;
    li.classList.add('is-new', 'is-pending');
    const status = document.createElement('span');
    status.className = 'photo-status';
    status.textContent = 'Otimizando…';
    li.append(status);
    list.append(li);
    return li;
  };

  const markFailed = (li: HTMLLIElement, message: string) => {
    li.classList.add('is-failed');
    const status = li.querySelector<HTMLElement>('.photo-status');
    if (status) status.textContent = 'Falhou';
    showError(message);
    window.setTimeout(() => {
      li.remove();
      refresh();
    }, 4000);
  };

  /** Sobe uma foto já otimizada para o veículo; o item da lista passa a mostrar a foto salva. */
  const send = async (li: HTMLLIElement, pair: ImagePair): Promise<void> => {
    const res = await fetch(api, { method: 'POST', body: pairBody(pair) });
    if (!res.ok) throw new Error(await readError(res));
    const data = (await res.json()) as { image: UploadedImage };
    li.dataset.photoId = data.image.id;
    li.classList.remove('is-pending');
    li.classList.add('is-done');
    li.querySelector('.photo-status')?.remove();
    window.setTimeout(() => li.classList.remove('is-done'), 1600);
    const img = li.querySelector('img');
    if (img) {
      const blobUrl = img.src;
      img.src = data.image.thumbUrl;
      img.width = data.image.thumbWidth;
      img.height = data.image.thumbHeight;
      img.alt = 'Foto do veículo';
      if (blobUrl.startsWith('blob:')) img.addEventListener('load', () => URL.revokeObjectURL(blobUrl), { once: true });
    }
  };

  /** Otimiza a foto no navegador e mostra a prévia; no cadastro novo ela espera o "Salvar". */
  const process = async (file: File): Promise<boolean> => {
    const li = createItem();
    try {
      const pair = await makeImagePair(file, config);
      const img = li.querySelector('img');
      if (img) img.src = URL.createObjectURL(pair.thumb.blob);
      if (draft) {
        draftCounter += 1;
        const id = `nova-${draftCounter}`;
        drafts.set(id, pair);
        li.dataset.photoId = id;
        li.classList.remove('is-pending');
        li.querySelector('.photo-status')?.remove();
        if (img) img.alt = 'Foto escolhida (ainda não salva)';
        return true;
      }
      const status = li.querySelector<HTMLElement>('.photo-status');
      if (status) status.textContent = 'Enviando…';
      await send(li, pair);
      return true;
    } catch (error) {
      markFailed(li, `${file.name}: ${errorMessage(error, 'Falha ao enviar a foto.')}`);
      return false;
    } finally {
      refresh();
    }
  };

  // Progresso (várias seleções seguidas entram na mesma fila).
  let queued = 0;
  let finished = 0;
  let failed = 0;
  const showProgress = () => {
    if (!progress) return;
    const active = queued > 0 && finished < queued;
    progress.hidden = !active && finished === 0;
    progress.classList.toggle('is-complete', !active && !failed);
    if (progressText) {
      const verb = draft ? 'Preparando' : 'Enviando';
      progressText.textContent = active
        ? `${verb} foto ${finished + 1} de ${queued}…${draft ? '' : ' Não feche esta página.'}`
        : failed
          ? `${finished - failed} de ${finished} fotos ${draft ? 'prontas' : 'enviadas'}.`
          : draft
            ? `${finished === 1 ? 'Foto pronta' : 'Fotos prontas'}! Elas são salvas junto com o veículo.`
            : finished === 1
              ? 'Foto enviada!'
              : 'Fotos enviadas!';
    }
    if (progressBar) progressBar.style.transform = `scaleX(${queued ? finished / queued : 1})`;
    if (!active) {
      window.setTimeout(() => {
        if (queued === 0) progress.hidden = true;
      }, 2600);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    showError('');
    const available = config.maxPhotos - list.querySelectorAll('li').length;
    const selected = Array.from(files).slice(0, Math.max(0, available));
    if (selected.length < files.length) showError(`Limite de ${config.maxPhotos} fotos por veículo.`);
    if (!selected.length) return;
    // Sair da página interromperia o envio: o painel pede confirmação (na própria tela).
    if (!draft) {
      setLeaveWarning(root, {
        title: 'Fotos ainda sendo enviadas',
        message: 'Se sair agora, as fotos que ainda não terminaram de enviar serão perdidas.',
        ok: 'Sair mesmo assim',
      });
    }
    queued += selected.length;
    // Sequencial: evita estourar memória no celular e mantém a ordem de escolha.
    for (const file of selected) {
      showProgress();
      if (!(await process(file))) failed += 1;
      finished += 1;
    }
    if (finished >= queued) {
      showProgress();
      queued = 0;
      finished = 0;
      failed = 0;
      if (!draft) setLeaveWarning(root, null);
    }
  };

  input?.addEventListener('change', () => {
    if (input.files) void handleFiles(input.files);
    input.value = '';
  });
  if (dropzone) {
    const targets = [dropzone, root];
    targets.forEach((el) => {
      el.addEventListener('dragover', (e) => {
        if (dragging || !e.dataTransfer?.types.includes('Files')) return;
        e.preventDefault();
        dropzone.classList.add('is-over');
      });
      el.addEventListener('dragleave', () => dropzone.classList.remove('is-over'));
      el.addEventListener('drop', (e) => {
        if (dragging || !e.dataTransfer?.files.length) return;
        e.preventDefault();
        dropzone.classList.remove('is-over');
        void handleFiles(e.dataTransfer.files);
      });
    });
  }

  const showUpload = (text: string, done: number, total: number) => {
    if (!progress) return;
    progress.hidden = false;
    progress.classList.toggle('is-complete', done >= total);
    if (progressText) progressText.textContent = done < total ? `${text} Não feche esta página.` : text;
    if (progressBar) progressBar.style.transform = `scaleX(${total ? done / total : 1})`;
  };

  if (draft) {
    initDraftSubmit(root, { drafts, items, send, markFailed, showError, setApi: (url) => (api = url), showUpload });
  }
}

/**
 * Cadastro com fotos: o "Salvar" envia os dados (o servidor valida e cria o veículo) e, em seguida,
 * sobe as fotos escolhidas na ordem da tela. Sem fotos, o formulário segue o envio normal.
 */
function initDraftSubmit(
  root: HTMLElement,
  ctx: {
    drafts: Map<string, ImagePair>;
    items: () => HTMLLIElement[];
    send: (li: HTMLLIElement, pair: ImagePair) => Promise<void>;
    markFailed: (li: HTMLLIElement, message: string) => void;
    showError: (message: string) => void;
    setApi: (url: string) => void;
    /** Mostra o progresso do envio (texto e barra). */
    showUpload: (text: string, done: number, total: number) => void;
  },
) {
  const form = root.closest<HTMLFormElement>('form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    if (event.defaultPrevented || ctx.drafts.size === 0) return;
    event.preventDefault();
    const button = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    if (button) markBusy(button);
    const body = new FormData(form);
    body.set('_fotos', String(ctx.drafts.size));

    let res: Response;
    try {
      res = await fetch(form.action || window.location.href, { method: 'POST', body });
    } catch {
      if (button) clearBusy(button);
      ctx.showError('Falha de conexão ao salvar. Confira a internet e tente de novo.');
      return;
    }
    const created = res.url.match(/\/admin\/veiculos\/([0-9a-f-]{36})/);
    if (!res.redirected || !created) {
      // Dados com erro: mostra os erros do servidor sem perder as fotos escolhidas.
      showServerErrors(form, root, await res.text());
      return;
    }

    // Veículo criado: os dados estão salvos; agora as fotos (em ordem, a primeira é a capa).
    setLeaveWarning(form, null);
    setLeaveWarning(root, {
      title: 'Fotos ainda sendo enviadas',
      message: 'O veículo já foi salvo, mas as fotos que ainda não terminaram de enviar serão perdidas.',
      ok: 'Sair mesmo assim',
    });
    ctx.setApi(`/api/admin/vehicles/${created[1]}/images`);
    const queue = ctx.items().filter((li) => ctx.drafts.has(li.dataset.photoId ?? ''));
    let sent = 0;
    const failures: string[] = [];
    // Todas aparecem "na fila"; cada uma perde o véu ao terminar de subir.
    for (const li of queue) {
      li.classList.add('is-pending');
      const status = document.createElement('span');
      status.className = 'photo-status';
      status.textContent = 'Na fila…';
      li.append(status);
    }
    for (const [index, li] of queue.entries()) {
      const label = `Enviando foto ${index + 1} de ${queue.length}…`;
      if (button) setBusyLabel(button, `Enviando fotos ${index + 1}/${queue.length}…`);
      ctx.showUpload(label, index, queue.length);
      const pair = ctx.drafts.get(li.dataset.photoId ?? '');
      if (!pair) continue;
      const status = li.querySelector('.photo-status');
      if (status) status.textContent = 'Enviando…';
      try {
        await ctx.send(li, pair);
        ctx.drafts.delete(li.dataset.photoId ?? '');
        sent += 1;
      } catch (error) {
        const message = errorMessage(error, 'Falha ao enviar a foto.');
        failures.push(message);
        ctx.markFailed(li, `Foto ${index + 1}: ${message}`);
      }
    }
    setLeaveWarning(root, null);
    ctx.showUpload(
      failures.length ? `${sent} de ${queue.length} fotos enviadas.` : 'Fotos enviadas!',
      queue.length,
      queue.length,
    );

    if (failures.length) {
      await confirmDialog({
        title: `${sent} de ${queue.length} fotos enviadas`,
        message: `O veículo foi salvo. ${failures[0] ?? ''} Na próxima tela você pode tentar enviar as fotos que faltaram.`,
        confirmLabel: 'Continuar',
        icon: 'alert',
        hideCancel: true,
      });
    }
    window.location.assign(res.url);
  });
}

/** Troca as seções do formulário pelas que o servidor devolveu (com os erros), mantendo as fotos. */
function showServerErrors(form: HTMLFormElement, photos: HTMLElement, html: string) {
  const fresh = new DOMParser()
    .parseFromString(html, 'text/html')
    .querySelector<HTMLFormElement>('[data-vehicle-form]');
  if (!fresh) {
    window.location.reload();
    return;
  }
  const keep = new Set<Element>([photos, ...form.querySelectorAll(':scope > [data-photo-template], :scope > script')]);
  for (const child of Array.from(form.children)) if (!keep.has(child)) child.remove();
  const incoming = Array.from(fresh.children).filter(
    (child) => !child.matches('[data-photo-manager], [data-photo-template], script'),
  );
  const alert = incoming.find((child) => child.hasAttribute('data-form-errors'));
  if (alert) photos.before(alert);
  form.append(...incoming.filter((child) => child !== alert));
  (alert ?? form).scrollIntoView({ behavior: 'smooth', block: 'start' });
}
