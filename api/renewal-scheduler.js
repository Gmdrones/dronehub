async function runRenewals(env) {
  const site = String(env.SITE_URL || '').replace(/\/$/, '');
  if (!site || !env.CRON_SECRET) throw new Error('Configuração do agendador incompleta.');
  const response = await fetch(`${site}/api/cron/subscription-expiry`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.CRON_SECRET}` }
  });
  if (!response.ok) throw new Error(`Rotina de renovação retornou HTTP ${response.status}.`);
  return response.json();
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== '/health') return new Response('Not found', { status: 404 });
    return Response.json({ ok: true, configured: Boolean(env.SITE_URL && env.CRON_SECRET) });
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runRenewals(env));
  }
};
