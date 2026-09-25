/** Estado "salvando..." de um botão: desabilitado, com indicador girando e texto opcional (data-busy-label). */
function labelNode(button: HTMLButtonElement): ChildNode | undefined {
  return Array.from(button.childNodes).findLast((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
}

export function markBusy(button: HTMLButtonElement, label = button.dataset.busyLabel) {
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.classList.add('is-busy');
  if (label) setBusyLabel(button, label);
}

/** Troca o texto do botão enquanto ele está ocupado (ex.: "Enviando fotos 2/5…"). */
export function setBusyLabel(button: HTMLButtonElement, label: string) {
  const text = labelNode(button);
  if (!text) return;
  if (button.dataset.idleLabel === undefined) button.dataset.idleLabel = text.textContent ?? '';
  text.textContent = ` ${label}`;
}

export function clearBusy(button: HTMLButtonElement) {
  button.disabled = false;
  button.removeAttribute('aria-busy');
  button.classList.remove('is-busy');
  const idle = button.dataset.idleLabel;
  if (idle === undefined) return;
  const text = labelNode(button);
  if (text) text.textContent = idle;
  delete button.dataset.idleLabel;
}
