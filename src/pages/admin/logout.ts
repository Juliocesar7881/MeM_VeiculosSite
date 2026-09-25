import type { APIRoute } from 'astro';
import { endAdminSession } from '@/server/admin-auth';

export const POST: APIRoute = async ({ cookies, url, locals, redirect }) => {
  if (locals.admin) {
    await locals.container.audit.log(locals.admin, 'auth.logout', 'session', null);
    // Encerra a sessão também no servidor: um cookie copiado deixa de funcionar na hora.
    if (locals.admin.method === 'password') {
      await locals.container.settings
        .revokeAdminSessions(locals.admin)
        .catch((error: unknown) => console.error('[auth] falha ao encerrar sessões no servidor', error));
    }
  }
  endAdminSession(cookies, url.protocol === 'https:');
  return redirect('/admin/login', 303);
};

export const GET: APIRoute = ({ redirect }) => redirect('/admin', 303);
