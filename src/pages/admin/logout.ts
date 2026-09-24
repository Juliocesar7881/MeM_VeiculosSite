import type { APIRoute } from 'astro';
import { endAdminSession } from '@/server/admin-auth';

export const POST: APIRoute = async ({ cookies, url, locals, redirect }) => {
  if (locals.admin) await locals.container.audit.log(locals.admin, 'auth.logout', 'session', null);
  endAdminSession(cookies, url.protocol === 'https:');
  return redirect('/admin/login', 303);
};

export const GET: APIRoute = ({ redirect }) => redirect('/admin', 303);
