/**
 * Favoritos salvos apenas no navegador (localStorage), sem login.
 * Guarda somente IDs de veículos — nenhum dado pessoal.
 */
const KEY = 'mm:favoritos:v1';
const EVENT = 'mm:favorites-change';
const MAX = 60;
const ID_PATTERN = /^[0-9a-f-]{36}$/;

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && ID_PATTERN.test(v)) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {
    // Modo privado/armazenamento cheio: favoritos ficam apenas na sessão atual.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: ids }));
}

export function getFavorites(): string[] {
  return read();
}

export function isFavorite(id: string): boolean {
  return read().includes(id);
}

export function toggleFavorite(id: string): boolean {
  if (!ID_PATTERN.test(id)) return false;
  const ids = read();
  const index = ids.indexOf(id);
  if (index >= 0) {
    ids.splice(index, 1);
    write(ids);
    return false;
  }
  write([id, ...ids]);
  return true;
}

export function removeFavorite(id: string): void {
  write(read().filter((v) => v !== id));
}

export function onFavoritesChange(callback: (ids: string[]) => void): void {
  window.addEventListener(EVENT, (event) => callback((event as CustomEvent<string[]>).detail));
  // Sincroniza entre abas
  window.addEventListener('storage', (event) => {
    if (event.key === KEY) callback(read());
  });
}
