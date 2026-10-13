const SITE_ORIGIN = 'https://dronehub.app.br';
const PLANS = Object.freeze({
  annual: { title: 'Drone Hub PRO — 12 meses', amount: 358.80, months: 12 },
  monthly: { title: 'Drone Hub PRO — 30 dias', amount: 45.00, months: 1 }
});
const REVISION = 'worker_safe_v2';
const ANNUAL_MAX_INSTALLMENTS = 12; // Monthly is always one upfront payment.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': SITE_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-DroneHub-Worker-Key' }
  });
}

function secretMatches(actual, expected) {
  const encoder = new TextEncoder();
  const a = encoder.encode(String(actual || ''));
  const b = encoder.encode(String(expected || ''));
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    difference |= (a[i] || 0) ^ (b[i] || 0);
  }
  return b.length >= 32 && difference === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, {status: 204});
    if (url.pathname !== '/api/payment/create' || request.method !== 'POST')
      return json({error: 'Rota não encontrada.'}, 404);

    // Only the authenticated DroneHub Pages backend may create preferences.
    if (!env.MP_ACCESS_TOKEN || !env.DRONEHUB_WORKER_SHARED_SECRET)
      return json({error: 'Serviço não configurado.'}, 503);
    if (!secretMatches(request.headers.get('x-dronehub-worker-key'), env.DRONEHUB_WORKER_SHARED_SECRET))
      return json({error: 'Não autorizado.'}, 401);

    const input = await request.json().catch(() => ({}));
    const plan = PLANS[input.plan];
    const userId = String(input.external_reference || '').trim();
    const email = String(input.payer?.email || '').trim();
    if (!plan || !UUID.test(userId) || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email))
      return json({error: 'Dados inválidos para iniciar o pagamento.'}, 400);

    const preference = {
      items: [{id: 'dronehub-pro-' + input.plan, title: plan.title,
        quantity: 1, currency_id: 'BRL', unit_price: plan.amount}],
      payer: {email, name: String(input.payer?.name || '').slice(0, 120)},
      external_reference: userId,
      metadata: {user_id: userId, plan: input.plan, months: plan.months, email},
      notification_url: SITE_ORIGIN + '/api/payment/webhook',
      back_urls: {
        success: SITE_ORIGIN + '/precos?status=success',
        failure: SITE_ORIGIN + '/precos?status=failure',
        pending: SITE_ORIGIN + '/precos?status=pending'
      },
      auto_return: 'approved',
      payment_methods: {installments: input.plan === 'monthly' ? 1 : ANNUAL_MAX_INSTALLMENTS},
      statement_descriptor: 'DRONE HUB'
    };
    try {
      const result = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {'Content-Type': 'application/json',
          Authorization: 'Bearer ' + env.MP_ACCESS_TOKEN,
          'X-Idempotency-Key': crypto.randomUUID()},
        body: JSON.stringify(preference)
      });
      const created = await result.json().catch(() => ({}));
      if (!result.ok || !created?.id || !created?.init_point)
        return json({error: 'O checkout não pôde ser iniciado.'}, 502);
      return json({id: created.id, init_point: created.init_point, flow_revision: REVISION});
    } catch {
      return json({error: 'Serviço de pagamento indisponível.'}, 502);
    }
  }
};
