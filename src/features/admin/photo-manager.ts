import { extensionFor, ImageProcessingError, makeImagePair, type PairOptions } from '../image-compress';

interface Config extends PairOptions {
  vehicleId: string;
  maxPhotos: number;
}

interface UploadedImage {
  id: string;
  thumbUrl: string;
  thumbWidth: number;
  thumbHeight: number;
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Erro ${res.status}`;
  } catch {
    return `Erro ${res.status}`;
  }
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
  const template = document.querySelector<HTMLTemplateElement>('[data-photo-template]');
  if (!list || !template) return;
  const api = `/api/admin/vehicles/${config.vehicleId}/images`;

  const items = () => Array.from(list.querySelectorAll<HTMLLIElement>('li[data-photo-id]'));
  const refresh = () => {
    const count = list.querySelectorAll('li').length;
    if (countLabel) countLabel.textContent = `(${items().length}/${config.maxPhotos})`;
    if (empty) empty.hidden = count > 0;
  };
  const showError = (message: string) => {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.hidden = !message;
  };

  // ---------------------------------------------------------------- ordem
  let saveTimer = 0;
  const saveOrder = () => {
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
    saveOrder();
  };

  // ------------------------------------------------------------- ações item
  list.addEventListener('click', async (event) => {
    const btn = (event.target as Element).closest<HTMLButtonElement>('button');
    const li = btn?.closest<HTMLLIElement>('li[data-photo-id]');
    if (!btn || !li) return;
    if (btn.dataset.move) move(li, Number(btn.dataset.move));
    if (btn.hasAttribute('data-make-cover')) {
      list.prepend(li);
      saveOrder();
    }
    if (btn.hasAttribute('data-delete')) {
      if (!window.confirm('Excluir esta foto? Esta ação não pode ser desfeita.')) return;
      btn.disabled = true;
      const res = await fetch(`${api}/${li.dataset.photoId}`, { method: 'DELETE' }).catch(() => null);
      if (res?.ok) {
        li.remove();
        refresh();
      } else {
        btn.disabled = false;
        showError(res ? await readError(res) : 'Falha de conexão ao excluir a foto.');
      }
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

  // ------------------------------------------------------------------ upload
  const createItem = (): HTMLLIElement => {
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const li = fragment.querySelector('li') as HTMLLIElement;
    li.classList.add('is-pending');
    const status = document.createElement('span');
    status.className = 'photo-status';
    status.textContent = 'Otimizando…';
    li.append(status);
    list.append(li);
    return li;
  };

  const upload = async (file: File) => {
    const li = createItem();
    const status = li.querySelector<HTMLElement>('.photo-status');
    const img = li.querySelector('img');
    try {
      const pair = await makeImagePair(file, { ...config, withOg: true });
      if (img) img.src = URL.createObjectURL(pair.thumb.blob);
      if (status) status.textContent = 'Enviando…';
      const body = new FormData();
      body.append('large', pair.large.blob, `foto.${extensionFor(pair.large.blob)}`);
      body.append('thumb', pair.thumb.blob, `foto-thumb.${extensionFor(pair.thumb.blob)}`);
      if (pair.og) body.append('og', pair.og, 'foto-og.jpg');
      const res = await fetch(api, { method: 'POST', body });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { image: UploadedImage };
      li.dataset.photoId = data.image.id;
      li.classList.remove('is-pending');
      status?.remove();
      if (img) {
        const blobUrl = img.src;
        img.src = data.image.thumbUrl;
        img.width = data.image.thumbWidth;
        img.height = data.image.thumbHeight;
        img.alt = 'Foto do veículo';
        img.addEventListener('load', () => URL.revokeObjectURL(blobUrl), { once: true });
      }
    } catch (error) {
      li.classList.add('is-failed');
      if (status) status.textContent = 'Falhou';
      const message =
        error instanceof ImageProcessingError || error instanceof Error ? error.message : 'Falha ao enviar a foto.';
      showError(`${file.name}: ${message}`);
      window.setTimeout(() => {
        li.remove();
        refresh();
      }, 4000);
    } finally {
      refresh();
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    showError('');
    const available = config.maxPhotos - list.querySelectorAll('li').length;
    const selected = Array.from(files).slice(0, Math.max(0, available));
    if (selected.length < files.length) showError(`Limite de ${config.maxPhotos} fotos por veículo.`);
    // Sequencial: evita estourar memória no celular e mantém a ordem de escolha.
    for (const file of selected) await upload(file);
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

  window.addEventListener('beforeunload', (event) => {
    if (list.querySelector('.is-pending')) event.preventDefault();
  });
}
