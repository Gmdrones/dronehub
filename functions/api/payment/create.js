import {
  json,
  getUser,
  logIntegration,
  sendEmail
} from '../../_lib/server.js';

const PLANS = {
  annual: {
    title: 'Drone Hub Pro — 12 meses',
    amount: 358.80,
    months: 12
  },
  monthly: {
    title: 'Drone Hub Pro — 30 dias',
    amount: 45.00,
    months: 1
  }
};

const DEFAULT_PAYMENT_WORKER =
  'https://dronehub-payment.primesecureconsultoria.workers.dev/api/payment/create';

/**
 * Cria o checkout usando o Worker de pagamento alternativo.
 */
async function createWithPaymentWorker(env, user, planKey) {
  const endpoint =
    env.PAYMENT_WORKER_URL ||
    DEFAULT_PAYMENT_WORKER;

  const plan = PLANS[planKey];

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      plan: planKey,

      payer: {
        email: user.email,
        name:
          user.user_metadata?.full_name ||
          user.email
      },

      // Deve conter somente o UUID do usuário.
      external_reference: user.id,

      metadata: {
        user_id: user.id,
        email: user.email,
        plan: planKey,
        months: plan.months
      }
    })
  });

  const data = await response
    .json()
    .catch(() => ({}));

  if (
    !response.ok ||
    !data.id ||
    !data.init_point
  ) {
    throw new Error(
      data.message ||
      data.error ||
      'O serviço de pagamento não criou o checkout.'
    );
  }

  return data;
}

/**
 * Cria a preferência diretamente na API do Mercado Pago.
 */
async function createMercadoPagoPreference(
  env,
  user,
  planKey,
  site
) {
  const plan = PLANS[planKey];

  const preference = {
    items: [
      {
        id: `dronehub-pro-${planKey}`,
        title: plan.title,
        quantity: 1,
        currency_id: 'BRL',
        unit_price: plan.amount
      }
    ],

    payer: {
      email: user.email,
      name:
        user.user_metadata?.full_name ||
        user.email
    },

    // Identificação usada pelo webhook.
    external_reference: user.id,

    metadata: {
      user_id: user.id,
      email: user.email,
      plan: planKey,
      months: plan.months
    },

    notification_url:
      `${site}/api/payment/webhook`,

    back_urls: {
      success:
        `${site}/precos?status=success`,
      failure:
        `${site}/precos?status=failure`,
      pending:
        `${site}/precos?status=pending`
    },

    auto_return: 'approved',

    payment_methods: {
      installments:
        planKey === 'annual' ? 12 : 1
    },

    statement_descriptor: 'DRONE HUB'
  };

  const response = await fetch(
    'https://api.mercadopago.com/checkout/preferences',
    {
      method: 'POST',
      headers: {
        Authorization:
          `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key':
          crypto.randomUUID()
      },
      body: JSON.stringify(preference)
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  return {
    response,
    data
  };
}

export async function onRequestPost({
  request,
  env
}) {
  let user = null;

  try {
    user = await getUser(request, env);

    const input = await request
      .json()
      .catch(() => ({}));

    const planKey =
      input.plan === 'monthly'
        ? 'monthly'
        : 'annual';

    const site = (
      env.SITE_URL ||
      new URL(request.url).origin
    ).replace(/\/$/, '');

    let data;
    let route = 'pages';

    if (env.MERCADO_PAGO_ACCESS_TOKEN) {
      const result =
        await createMercadoPagoPreference(
          env,
          user,
          planKey,
          site
        );

      data = result.data;

      if (
        !result.response.ok ||
        !data.id ||
        !data.init_point
      ) {
        route = 'worker_fallback';

        await logIntegration(
          env,
          'payment',
          'pages_checkout_failed',
          'warning',
          {
            plan: planKey,
            mercado_pago_status:
              result.response.status,
            mercado_pago_error:
              data.message ||
              data.error ||
              'Resposta inválida do Mercado Pago'
          },
          user.id
        );

        data =
          await createWithPaymentWorker(
            env,
            user,
            planKey
          );
      }
    } else {
      route = 'worker_fallback';

      data =
        await createWithPaymentWorker(
          env,
          user,
          planKey
        );
    }

    await logIntegration(
      env,
      'payment',
      'checkout_created',
      'info',
      {
        preference_id: data.id,
        plan: planKey,
        route
      },
      user.id
    );

    try {
      const plan = PLANS[planKey];
      const value = Number(plan.amount).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });

      await sendEmail(env, {
        to: user.email,
        subject: 'Recebemos sua solicitação de assinatura do Drone Hub',
        html: `
          <h1>Solicitação recebida</h1>
          <p>Você iniciou a assinatura do Drone Hub PRO.</p>
          <p><strong>Plano:</strong> ${planKey === 'annual' ? 'Anual' : 'Mensal'}<br>
          <strong>Valor:</strong> ${value}</p>
          <p>O pagamento ainda não foi confirmado. Assim que o Mercado Pago confirmar, seu acesso será liberado automaticamente.</p>
          <p>Você pode retornar ao Drone Hub a qualquer momento para acompanhar o status.</p>
        `,
        text: `Solicitação de assinatura recebida. Plano: ${planKey === 'annual' ? 'Anual' : 'Mensal'}. Valor: ${value}. O pagamento ainda não foi confirmado. O acesso será liberado automaticamente após a confirmação do Mercado Pago.`
      });
    } catch (emailError) {
      await logIntegration(env, 'payment', 'checkout_started_email_error', 'warning', {
        message: emailError?.message || 'Falha ao enviar e-mail de pagamento iniciado.'
      }, user.id);
    }

    return json({
      id: data.id,
      preference_id: data.id,
      init_point: data.init_point,

      // Temporariamente útil para descobrir
      // se o checkout foi criado pelo Pages
      // ou pelo Worker.
      route
    });
  } catch (error) {
    await logIntegration(
      env,
      'payment',
      'checkout_error',
      'error',
      {
        message:
          error?.message ||
          'Erro desconhecido'
      },
      user?.id || null
    );

    return json(
      {
        error:
          'Não foi possível iniciar o pagamento.',
        message:
          error?.message ||
          'Erro interno no serviço de pagamento.'
      },
      error?.status || 502
    );
  }
}

export async function onRequest() {
  return json(
    {
      error: 'Método não permitido.'
    },
    405
  );
}
