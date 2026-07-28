import { getUser, json, logIntegration, sendEmail } from '../../_lib/server.js';

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUser(request, env);
    await sendEmail(env, { to: user.email, subject: 'Senha alterada — Drone Hub', html: '<h2>Sua senha foi alterada</h2><p>A senha da sua conta Drone Hub foi atualizada com sucesso.</p><p>Se não foi você, recupere o acesso imediatamente.</p>' });
    await logIntegration(env, 'email', 'password_changed', 'info', {}, user.id);
    return json({ ok: true });
  } catch (error) { return json({ error: error.message }, 401); }
}
