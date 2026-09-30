import { getUser, json, sendEmail } from '../../_lib/server.js';

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUser(request, env);
    if (user.user_metadata?.welcome_email_sent_at) return json({ ok: true, alreadySent: true });
    const site = (env.SITE_URL || 'https://dronehub.app.br').replace(/\/$/, '');
    await sendEmail(env, {
      to: user.email, name: user.user_metadata?.full_name || user.email,
      subject: 'Bem-vindo ao DroneHub',
      text: `Olá! Sua conta DroneHub está pronta. Acesse ${site}/dashboard.html para organizar sua operação.`,
      html: `<h2>Bem-vindo ao DroneHub</h2><p>Olá, ${String(user.user_metadata?.full_name || 'piloto').replace(/[<>&]/g, '')}.</p><p>Sua conta está pronta para organizar aeronaves, documentos e operações.</p><p><a href="${site}/dashboard.html">Acessar o DroneHub</a></p>`
    });
    await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: 'PUT', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_metadata: { ...user.user_metadata, welcome_email_sent_at: new Date().toISOString() } })
    });
    return json({ ok: true });
  } catch (error) { return json({ error: error.message || 'Não foi possível enviar boas-vindas.' }, error.status || 500); }
}
