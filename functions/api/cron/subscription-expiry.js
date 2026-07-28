import { json, logIntegration, sendEmail, supabaseAdmin } from '../../_lib/server.js';

export async function onRequestPost({ request, env }) {
  if (!env.CRON_SECRET || request.headers.get('Authorization') !== `Bearer ${env.CRON_SECRET}`) return json({ error: 'Não autorizado.' }, 401);
  const limit = new Date(Date.now() + 7 * 86400000).toISOString();
  try {
    const expiring = await supabaseAdmin(env, `account_entitlements?select=user_id,courtesy_expires_at&plan=eq.pro&status=eq.active&courtesy_expires_at=lte.${encodeURIComponent(limit)}&courtesy_expires_at=gt.${encodeURIComponent(new Date().toISOString())}`);
    for (const item of expiring || []) {
      const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${item.user_id}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
      const profile = response.ok ? await response.json() : null;
      if (profile && profile.email) await sendEmail(env, { to: profile.email, subject: 'Seu plano Pro vence em breve', html: `<h2>Seu acesso Pro está próximo do vencimento</h2><p>Validade: ${new Date(item.courtesy_expires_at).toLocaleDateString('pt-BR')}.</p><p>Renove no Drone Hub para manter os módulos profissionais ativos.</p>` });
    }
    await supabaseAdmin(env, `account_entitlements?plan=eq.pro&status=eq.active&courtesy_expires_at=lte.${encodeURIComponent(new Date().toISOString())}`, { method: 'PATCH', body: JSON.stringify({ plan: 'free', status: 'expired', updated_at: new Date().toISOString() }) });
    await logIntegration(env, 'email', 'expiry_job', 'info', { reminders: (expiring || []).length });
    return json({ ok: true, reminders: (expiring || []).length });
  } catch (error) { await logIntegration(env, 'email', 'expiry_job', 'error', { message: error.message }); return json({ error: error.message }, 500); }
}
