/**
 * Ícones minimalistas (traço 1.75, grade 24x24), desenhados para o projeto.
 * Conteúdo estático e confiável — renderizado via set:html no componente Icon.
 */
export const ICONS = {
  whatsapp:
    '<path fill="currentColor" stroke="none" d="M12.04 2.5a9.43 9.43 0 0 0-8.1 14.25L2.5 21.5l4.9-1.4A9.43 9.43 0 1 0 12.04 2.5Zm0 17.2a7.8 7.8 0 0 1-3.97-1.09l-.28-.17-2.9.83.85-2.83-.19-.29a7.78 7.78 0 1 1 6.5 3.55Zm4.28-5.83c-.23-.12-1.38-.68-1.6-.76-.21-.08-.37-.12-.52.12-.16.23-.6.76-.74.91-.13.16-.27.18-.5.06-.24-.12-.99-.37-1.89-1.17a7.1 7.1 0 0 1-1.3-1.63c-.14-.24-.02-.36.1-.48.1-.1.24-.27.35-.41.12-.14.16-.24.24-.4.08-.15.04-.29-.02-.41-.06-.12-.52-1.26-.72-1.72-.19-.45-.38-.39-.52-.4h-.45a.86.86 0 0 0-.62.3 2.6 2.6 0 0 0-.82 1.94c0 1.14.83 2.25.95 2.4.12.16 1.63 2.5 3.96 3.5.55.24.99.39 1.32.5.56.17 1.06.15 1.46.09.45-.07 1.38-.56 1.57-1.1.2-.55.2-1.02.14-1.12-.06-.1-.21-.16-.45-.28Z"/>',
  instagram:
    '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none"/>',
  facebook:
    '<path d="M14.5 8.5H16V5.2a17 17 0 0 0-2.3-.2c-2.3 0-3.9 1.4-3.9 4v2.3H7.3v3.7h2.5V21h3.4v-6h2.6l.4-3.7h-3v-2c0-1 .3-1.8 1.3-1.8Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
  phone:
    '<path d="M5.2 3.5h3l1.6 4.2-2.1 1.3a11.5 11.5 0 0 0 5.3 5.3l1.3-2.1 4.2 1.6v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.2 5.7a2 2 0 0 1 2-2.2Z"/>',
  'map-pin': '<path d="M12 21s-7-6.1-7-11.5a7 7 0 1 1 14 0C19 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v10.5a1 1 0 0 0 1 1h3.5v-6h4v6h3.5a1 1 0 0 0 1-1V9"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  heart:
    '<path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.6 3.6 4.5 6.9 4.5c2 0 3.4 1.1 5.1 3 1.7-1.9 3.1-3 5.1-3 3.3 0 5.2 3.1 4.1 6.2C19.5 15.4 12 20 12 20Z"/>',
  'chevron-left': '<path d="m15 5-7 7 7 7"/>',
  'chevron-right': '<path d="m9 5 7 7-7 7"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
  car: '<path d="M3.5 15.5v-2.6c0-.5.2-1 .6-1.4L6.4 9h9.1c.6 0 1.2.3 1.6.8l2.3 3h1.1c.8 0 1.5.7 1.5 1.5v1.2"/><path d="M3.5 15.5a1 1 0 0 0 1 1h.6M9 16.5h6M19 16.5h.9a1 1 0 0 0 1-1"/><circle cx="7" cy="16.5" r="2"/><circle cx="17" cy="16.5" r="2"/><path d="M8 9l1.6-2.2c.3-.4.8-.6 1.3-.6h2.3c.5 0 1 .2 1.3.6L16 9"/>',
  moto: '<circle cx="5.5" cy="16.5" r="3"/><circle cx="18.5" cy="16.5" r="3"/><path d="M5.5 16.5 9.3 10h4.9l4.3 6.5"/><path d="M14 10l-1.3-3.5H16M7.5 10H10"/>',
  scooter:
    '<circle cx="6" cy="17.5" r="2.5"/><circle cx="18" cy="17.5" r="2.5"/><path d="M8.5 17.5h7"/><path d="M18 17.5 15.2 6.5H18"/><path d="M4.5 14.2c.7-1.6 2-2.7 3.8-2.7h6.2"/>',
  truck:
    '<path d="M2.5 6.5h11v9.5h-11z"/><path d="M13.5 9.5h4.1l3.9 3.9v2.6h-8"/><circle cx="6.5" cy="17" r="1.9"/><circle cx="17.5" cy="17" r="1.9"/>',
  tractor:
    '<circle cx="7" cy="15.5" r="4"/><circle cx="7" cy="15.5" r="1.2"/><circle cx="18.5" cy="17.5" r="2"/><path d="M5.5 11.8V5.5H11l2.2 6h6a1 1 0 0 1 1 1v3.2"/><path d="M11 15.5h5.5M9 5.5V4"/>',
  tag: '<path d="M20.4 13.1 13.1 20.4a1.9 1.9 0 0 1-2.7 0L3.5 13.5V3.5h10l6.9 6.9a1.9 1.9 0 0 1 0 2.7Z"/><circle cx="8.2" cy="8.2" r="1.4"/>',
  repasse: '<path d="M4 8h13.5M14 4.5 17.5 8 14 11.5"/><path d="M20 16H6.5M10 12.5 6.5 16l3.5 3.5"/>',
  star: '<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8Z"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  gauge: '<path d="M4.2 17.5a9 9 0 1 1 15.6 0"/><path d="m12 13.5 4-4.5"/><circle cx="12" cy="14" r="1.3"/>',
  fuel: '<path d="M4.5 20.5v-14a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14M3.5 20.5h11M7 8.5h4"/><path d="M13.5 10.5h1.5a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 0 3 0V8.2L17 5.5"/>',
  gear: '<circle cx="6" cy="6" r="1.8"/><circle cx="12" cy="6" r="1.8"/><circle cx="18" cy="6" r="1.8"/><circle cx="6" cy="18" r="1.8"/><circle cx="12" cy="18" r="1.8"/><path d="M6 7.8v10.4M12 7.8v10.4M18 7.8V12H6"/>',
  palette:
    '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6h1.9a4.4 4.4 0 0 0 4.4-4.4c0-3.9-3.8-7-8.5-7Z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1" fill="currentColor"/><circle cx="15" cy="8" r="1" fill="currentColor"/>',
  body: '<path d="M3 15.5V13l2.5-4h11l2.5 3.5h1.5a1 1 0 0 1 1 1v2"/><path d="M3 15.5h18"/><path d="M8 9v6.5M13.5 9v6.5"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  share:
    '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.7 2.7L16.2 9.5"/>',
  upload: '<path d="M12 15.5V4M7 8.5 12 3.5l5 5"/><path d="M4 15v3a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 18v-3"/>',
  image:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="1.7"/><path d="m20.5 15.5-4.8-4.8-9.2 8.8"/>',
  trash:
    '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5L17.5 7M10.2 11v6M13.8 11v6"/>',
  grip: '<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off':
    '<path d="M4 4l16 16M9.9 5.8A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.2 7.4A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.9-.4 4.1-1"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/>',
  logout: '<path d="M9.5 20.5h-4a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4M16 16.5l4.5-4.5L16 7.5M20.5 12H9.5"/>',
  dashboard:
    '<rect x="3.5" y="3.5" width="7" height="9" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.6"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.6"/><rect x="3.5" y="15.5" width="7" height="5" rx="1.6"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1" fill="currentColor"/><circle cx="4.8" cy="12" r="1" fill="currentColor"/><circle cx="4.8" cy="17.5" r="1" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5v-.2a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  inbox:
    '<path d="M3.5 13.5 6 5.5a1.5 1.5 0 0 1 1.4-1h9.2a1.5 1.5 0 0 1 1.4 1l2.5 8"/><path d="M3.5 13.5v4.5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4.5h-5l-1.5 2.5h-4L8.5 13.5Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.2"/>',
  alert:
    '<path d="M10.3 4.3 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4.5M12 17v.2"/>',
  handshake:
    '<path d="m11 17 2 2a1.4 1.4 0 0 0 2-2"/><path d="m14 14 2.5 2.5a1.4 1.4 0 0 0 2-2l-3.9-3.9a2.8 2.8 0 0 0-4 0l-.9.9a1.4 1.4 0 0 1-2-2l2.8-2.8a4.2 4.2 0 0 1 5.2-.6l.5.3a3 3 0 0 0 2.1.4l2.2-.4"/><path d="m21 3.5 1 10.5-2 1M3 3.5 2 14l6.5 6.5a1.4 1.4 0 0 0 2-2M3 4.5h8"/>',
  send: '<path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5-7.5-4Z"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  external:
    '<path d="M14 4.5h5.5V10M19.5 4.5 11 13"/><path d="M18 14.5v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h4"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.4L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.6 4.4l1.4-1.9M20 20v-4.5h-4.5"/>',
  archive:
    '<rect x="3" y="4" width="18" height="4.5" rx="1.2"/><path d="M5 8.5v9.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5M10 12.5h4"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 12.6l-2.2 2.2-8.6 8.6a2.1 2.1 0 0 1-3-3l8.6-8.6"/>',
  shield:
    '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.6 7.5 9.5 4.3-.9 7.5-4.9 7.5-9.5V6Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
} as const;

export type IconName = keyof typeof ICONS;
