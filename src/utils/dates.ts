import { SITE_CONSTANTS } from '@/config/site';

export function nowIso(): string {
  return new Date().toISOString();
}

/** ISO UTC -> "YYYY-MM-DD" no fuso de Brasília (para inputs type=date). */
export function isoToLocalDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SITE_CONSTANTS.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return parts;
}

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SITE_CONSTANTS.timeZone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const DATE_ONLY = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SITE_CONSTANTS.timeZone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : DATE_TIME.format(date);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : DATE_ONLY.format(date);
}

/** "há 5 min", "há 2 h", "há 3 dias" — usado no painel. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  return formatDate(iso);
}

export function currentYear(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: SITE_CONSTANTS.timeZone, year: 'numeric' }).format(new Date()),
  );
}
