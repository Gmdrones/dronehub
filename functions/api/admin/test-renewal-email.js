import { getUser, json, logIntegration, sendEmail, supabaseAdmin } from '../../_lib/server.js';
import { renewalMessage } from '../../_lib/renewal.js';

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUser(request, env);
    const entitlement = (await supabaseAdmin(env, `account_entitlements?select=role,status&user_id=eq.${encodeURIComponent(user.id)}`))[0];
    if (entitlement?.role !== 'admin' || entitlement?.status !== 'active') return json({ error: 'Acesso administrativo obrigatório.' }, 403);
    if (!env.BREVO_API_KEY || !env.EMAIL_FROM || !env.RENEWAL_TEST_EMAIL) return json({ error: 'Configuração de e-mail de teste incompleta.' }, 503);
    const recipient = env.RENEWAL_TEST_EMAIL.trim().toLowerCase();
    const receipt = await sendEmail(env, renewalMessage({ ...user, email: recipient }, new Date(Date.now() + 4 * 86400000).toISOString(), true));
    await logIntegration(env, 'email', 'renewal_test', 'info', { provider_message_id: receipt.messageId }, user.id);
    return json({ ok: true, recipient });
  } catch (error) {
    await logIntegration(env, 'email', 'renewal_test', 'error', { code: error.code || 'renewal_test_failed' });
    return json({ error: 'Não foi possível enviar o teste de renovação.', code: error.code || 'renewal_test_failed' }, 500);
  }
}
