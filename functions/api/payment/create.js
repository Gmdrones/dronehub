import { json, getUser, logIntegration } from '../../_lib/server.js';

const PLANS = {
  annual: { title: 'Drone Hub Pro — 12 meses', amount: 358.80, months: 12 },
  monthly: { title: 'Drone Hub Pro — 30 dias', amount: 45.00, months: 1 }
};

const DEFAULT_PAYMENT_WORKER =
  'https://dronehub-payment.primesecureconsultoria.workers.dev/api/payment/create';

async function createWithPaymentWorker(env, user, planKey) {
  const endpoint = env.PAYMENT_WORKER_URL || DEFAULT_PAYMENT_WORKER;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan: planKey,
      payer: {
        email: user.email,
        name: user.user_metadata?.full_name || user.email
      },
      external_reference: `${user.id}|${planKey}|${Date.now()}`
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id || !data.init_point) {
    throw new Error(data.message || data.error || 'O serviço de pagamento não criou o checkout.');
  }
  return data;
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUser(request, env);
    const input = await request.json();
    const planKey = input.plan === 'monthly' ? 'monthly' : 'annual';
    const plan = PLANS[planKey];
    const site = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    let data;
    let route = 'pages';

    if (env.MERCADO_PAGO_ACCESS_TOKEN) {
      const preference = {
        items: [{
          id: `dronehub-pro-${planKey}`,
          title: plan.title,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: plan.amount
        }],
        payer: { email: user.email, name: user.user_metadata?.full_name || user.email },
        external_reference: user.id,
        metadata: { user_id: user.id, email: user.email, plan: planKey, months: plan.months },
        notification_url: `${site}/api/payment/webhook`,
        back_urls: {
          success: `${site}/precos?status=success`,
          failure: `${site}/precos?status=failure`,
          pending: `${site}/precos?status=pending`
        },
        auto_return: 'approved',
        payment_methods: { installments: planKey === 'annual' ? 12 : 1 },
        statement_descriptor: 'DRONE HUB'
      };
      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify(preference)
      });
      data = await response.json().catch(() => ({}));
      if (!response.ok || !data.id || !data.init_point) {
        route = 'worker_fallback';
        data = await createWithPaymentWorker(env, user, planKey);
      }
    } else {
      route = 'worker_fallback';
      data = await createWithPaymentWorker(env, user, planKey);
    }

    await logIntegration(env, 'payment', 'checkout_created', 'info', {
      preference_id: data.id,
      plan: planKey,
      route
    }, user.id);
    return json({ id: data.id, init_point: data.init_point });
  } catch (error) {
    await logIntegration(env, 'payment', 'checkout_error', 'error', { message: error.message });
    return json({
      error: 'Não foi possível iniciar o pagamento.',
      message: error.message
    }, error.status || 502);
  }
}

export async function onRequest() {
  return json({ error: 'Método não permitido.' }, 405);
}
