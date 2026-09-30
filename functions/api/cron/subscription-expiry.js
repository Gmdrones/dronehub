import { json, logIntegration, sendEmail, supabaseAdmin } from '../../_lib/server.js';
import { runRenewals } from '../../_lib/renewal.js';

async function validCronSecret(request, secret) {
  const token = request.headers.get('Authorization') || '';
  const expected = `Bearer ${secret || ''}`;
  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(token);
  const expectedBytes = encoder.encode(expected);
  if (!secret || actualBytes.length !== expectedBytes.length) return false;
  if (typeof crypto.subtle.timingSafeEqual === 'function') return crypto.subtle.timingSafeEqual(actualBytes, expectedBytes);
  // Keeps local tests compatible with runtimes that do not yet expose timingSafeEqual.
  let difference = 0;
  for (let index = 0; index < actualBytes.length; index++) difference |= actualBytes[index] ^ expectedBytes[index];
  return difference === 0;
}

export async function onRequestPost({ request, env }) {
  if (!(await validCronSecret(request, env.CRON_SECRET))) return json({ error: 'Não autorizado.' }, 401);
  const dryRun = new URL(request.url).searchParams.get('dry_run') === 'true';
  if (!dryRun && env.RENEWAL_EMAILS_ENABLED !== 'true') return json({ error: 'Envios de renovação desativados.' }, 503);
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', ...(!dryRun ? ['BREVO_API_KEY', 'EMAIL_FROM'] : [])];
  const missing = required.filter(key => !env[key]);
  if (missing.length) return json({ error: 'Configuração incompleta.', missing }, 503);
  try {
    await supabaseAdmin(env, 'renewal_email_deliveries?select=id&limit=0');
    const result = await runRenewals({
      db: (path, options) => supabaseAdmin(env, path, options),
      getProfile: async id => {
        const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
          headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
          signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) throw new Error('Não foi possível verificar o destinatário.');
        return response.json();
      },
      send: message => sendEmail(env, message)
    }, dryRun);
    // Expiry itself is already managed by the database. Never mutate plans here.
    if (!dryRun) await logIntegration(env, 'email', 'expiry_job', result.failed || result.uncertain ? 'error' : 'info', result);
    return json({ ok: !result.failed && !result.uncertain, ...result }, result.failed || result.uncertain ? 502 : 200);
  } catch (_) {
    if (!dryRun) await logIntegration(env, 'email', 'expiry_job', 'error', { code: 'renewal_job_failed' });
    return json({ error: 'Falha na rotina de renovação. Verifique a configuração e o registro de envios.' }, 500);
  }
}
