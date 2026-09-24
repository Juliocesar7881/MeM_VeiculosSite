export interface NavItem {
  label: string;
  href: string;
  /** Prefixos de caminho que marcam o item como ativo. */
  match: string[];
}

export const MAIN_NAV: NavItem[] = [
  { label: 'Início', href: '/', match: ['/'] },
  { label: 'Estoque', href: '/estoque', match: ['/estoque', '/veiculo'] },
  { label: 'Ofertas', href: '/ofertas', match: ['/ofertas'] },
  { label: 'Repasses', href: '/repasses', match: ['/repasses'] },
  { label: 'Empresa', href: '/empresa', match: ['/empresa'] },
  { label: 'Contato', href: '/contato', match: ['/contato'] },
];

export function isActive(item: NavItem, pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return item.match.some((m) => (m === '/' ? path === '/' : path === m || path.startsWith(`${m}/`)));
}
