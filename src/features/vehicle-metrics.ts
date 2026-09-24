/**
 * Métricas anônimas da página do veículo: uma visualização por sessão do navegador e cada
 * clique nos botões de WhatsApp. Sem cookies; só o ID do veículo e o tipo do evento.
 */
type MetricEvent = 'view' | 'whatsapp';

function send(vehicleId: string, event: MetricEvent) {
  const body = JSON.stringify({ v: vehicleId, e: event });
  try {
    if (navigator.sendBeacon?.('/api/metrics', new Blob([body], { type: 'application/json' }))) return;
  } catch {
    // segue para o fetch
  }
  void fetch('/api/metrics', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
  }).catch(() => undefined);
}

export function initVehicleMetrics() {
  const vehicleId = document.querySelector<HTMLElement>('[data-vehicle-id]')?.dataset.vehicleId;
  if (!vehicleId) return;

  const key = `mm:visto:${vehicleId}`;
  let seen = false;
  try {
    seen = sessionStorage.getItem(key) === '1';
    sessionStorage.setItem(key, '1');
  } catch {
    // navegação privada / armazenamento bloqueado: conta a visualização normalmente
  }
  if (!seen) send(vehicleId, 'view');

  document.querySelectorAll<HTMLAnchorElement>('a[data-whatsapp-click]').forEach((link) => {
    link.addEventListener('click', () => send(vehicleId, 'whatsapp'));
  });
}
