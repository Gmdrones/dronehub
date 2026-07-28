import { getUser, json, logIntegration } from '../_lib/server.js';

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUser(request, env);
    const body = await request.json();
    const allowed = ['weather','ai','upload','sync','payment','email','backup'];
    if (!allowed.includes(body.service)) return json({ error: 'Serviço inválido.' }, 400);
    await logIntegration(env, body.service, String(body.event || 'client_error').slice(0,80), body.level === 'warning' ? 'warning' : 'error', body.details || {}, user.id);
    return json({ ok: true });
  } catch (error) { return json({ error: error.message }, 401); }
}
