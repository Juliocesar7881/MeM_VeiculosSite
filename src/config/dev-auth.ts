/**
 * Senha do painel em DESENVOLVIMENTO LOCAL (`npm run dev`), usada somente quando
 * ADMIN_PASSWORD_HASH não está definido. Builds de produção (Cloudflare/Vercel) nunca a aceitam:
 * lá a senha vem sempre do segredo ADMIN_PASSWORD_HASH (npm run cf:secrets / admin:hash-password).
 *
 * Senha: MeM_admin78812
 */
export const DEV_ADMIN_PASSWORD_HASH =
  'pbkdf2-sha256$100000$WknXjBsfx1D2nRClaeXlVw$g7WYa5NZI26Dskco-IhfNMrw_5g0fR9SdEJ8OZZ7BDs';
