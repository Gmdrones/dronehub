import {
  json,
  supabaseAdmin,
  logIntegration,
  sendEmail
} from '../../_lib/server.js';

function normalizedState(status) {
  if (status === 'approved') {
    return 'approved';
  }

  if (['refunded', 'charged_back'].includes(status)) {
    return status;
  }

  if (['cancelled', 'rejected'].includes(status)) {
    return 'cancelled';
  }

  return 'pending';
}

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function extractPaymentData(payment) {
  const externalReference = String(
    payment.external_reference || ''
  ).trim();

  const referenceParts = externalReference.split('|');

  const userId = String(
    payment.metadata?.user_id ||
    referenceParts[0] ||
    ''
  ).trim();

  const planKey = String(
    payment.metadata?.plan ||
    referenceParts[1] ||
    ''
  ).trim();

  const metadataMonths = Number(
    payment.metadata?.months
  );

  let months;

  if (
    Number.isFinite(metadataMonths) &&
    metadataMonths > 0
  ) {
    months = metadataMonths;
  } else if (planKey === 'monthly') {
    months = 1;
  } else {
    months = 12;
  }

  return {
    userId,
    planKey,
    months,
    externalReference
  };
}

async function safeLogIntegration(
  env,
  service,
  event,
  level,
  details,
  userId = null
) {
  try {
    await logIntegration(
      env,
      service,
      event,
      level,
      details,
      userId
    );
  } catch (logError) {
    console.error('INTEGRATION_LOG_ERROR', {
      event,
      userId,
      message:
        logError?.message ||
        'Falha desconhecida ao gravar log.',
      stack: logError?.stack || null
    });
  }
}

export async function onRequestPost({
  request,
  env
}) {
  let paymentId = null;
  let userId = null;

  try {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new Error(
        'MERCADO_PAGO_ACCESS_TOKEN não configurado.'
      );
    }

    const url = new URL(request.url);

    const body = await request
      .json()
      .catch(() => ({}));

    paymentId =
      body?.data?.id ||
      body?.id ||
      url.searchParams.get('data.id') ||
      url.searchParams.get('id');

    if (!paymentId) {
      return json({
        received: true,
        ignored: true,
        reason: 'Notificação sem ID de pagamento.'
      });
    }

    console.log('MERCADO_PAGO_WEBHOOK_RECEIVED', {
      paymentId: String(paymentId),
      action: body?.action || null,
      type: body?.type || null,
      liveMode: body?.live_mode ?? null
    });

    const mercadoPagoResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
        String(paymentId)
      )}`,
      {
        method: 'GET',
        headers: {
          Authorization:
            `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
          Accept: 'application/json'
        }
      }
    );

    const payment = await mercadoPagoResponse
      .json()
      .catch(() => ({}));

    if (!mercadoPagoResponse.ok) {
      const mercadoPagoMessage =
        payment?.message ||
        payment?.error ||
        `Mercado Pago respondeu HTTP ${mercadoPagoResponse.status}.`;

      throw new Error(
        `Falha ao validar pagamento no Mercado Pago: ${mercadoPagoMessage}`
      );
    }

    const paymentData =
      extractPaymentData(payment);

    userId = paymentData.userId;

    if (!userId) {
      throw new Error(
        'Pagamento sem usuário vinculado.'
      );
    }

    if (!isValidUuid(userId)) {
      throw new Error(
        `UUID de usuário inválido: ${userId}`
      );
    }

    const state =
      normalizedState(payment.status);

    const months =
      paymentData.months;

    console.log('MERCADO_PAGO_PAYMENT_VALIDATED', {
      paymentId: String(payment.id),
      userId,
      status: payment.status,
      normalizedStatus: state,
      plan: paymentData.planKey || null,
      months,
      externalReference:
        paymentData.externalReference
    });

    await supabaseAdmin(
      env,
      'payment_transactions?on_conflict=provider,provider_payment_id',
      {
        method: 'POST',
        prefer:
          'resolution=merge-duplicates,return=representation',
        body: JSON.stringify({
          user_id: userId,
          provider: 'mercado_pago',
          provider_payment_id:
            String(payment.id),
          preference_id:
            payment.preference_id || null,
          status: state,
          status_detail:
            payment.status_detail || null,
          amount:
            payment.transaction_amount,
          currency:
            payment.currency_id || 'BRL',
          payment_method:
            payment.payment_type_id ||
            payment.payment_method_id ||
            null,
          payer_email:
            payment.payer?.email || null,
          raw_payload: payment,
          paid_at:
            payment.date_approved || null,
          expires_at:
            payment.date_of_expiration || null,
          updated_at:
            new Date().toISOString()
        })
      }
    );

    console.log('PAYMENT_TRANSACTION_SAVED', {
      paymentId: String(payment.id),
      userId,
      status: state
    });

    await supabaseAdmin(
      env,
      'rpc/apply_payment_entitlement',
      {
        method: 'POST',
        body: JSON.stringify({
          target_user: userId,
          payment_status: state,
          access_months: months,
          payment_reference:
            String(payment.id)
        })
      }
    );

    console.log('PAYMENT_ENTITLEMENT_APPLIED', {
      paymentId: String(payment.id),
      userId,
      status: state,
      months
    });

    await safeLogIntegration(
      env,
      'payment',
      `payment_${state}`,
      state === 'approved'
        ? 'info'
        : 'warning',
      {
        payment_id: payment.id,
        mercado_pago_status:
          payment.status,
        status_detail:
          payment.status_detail,
        plan:
          paymentData.planKey || null,
        months,
        external_reference:
          paymentData.externalReference
      },
      userId
    );

    if (
      state === 'approved' &&
      payment.payer?.email
    ) {
      try {
        const site = (
          env.SITE_URL ||
          'https://dronehub.app.br'
        ).replace(/\/$/, '');

        await sendEmail(env, {
          to: payment.payer.email,
          subject:
            'Seu Drone Hub Pro está ativo',
          html: `
            <h2>Pagamento aprovado</h2>

            <p>
              Seu acesso ao Drone Hub Pro já está ativo por
              ${
                months === 1
                  ? '30 dias'
                  : `${months} meses`
              }.
            </p>

            <p>
              <a href="${site}/dashboard">
                Acessar o painel
              </a>
            </p>
          `
        });

        console.log(
          'PAYMENT_CONFIRMATION_EMAIL_SENT',
          {
            paymentId: String(payment.id),
            userId,
            email: payment.payer.email
          }
        );
      } catch (emailError) {
        console.error(
          'PAYMENT_CONFIRMATION_EMAIL_ERROR',
          {
            paymentId: String(payment.id),
            userId,
            message:
              emailError?.message ||
              'Falha no envio do e-mail.',
            stack: emailError?.stack || null
          }
        );

        await safeLogIntegration(
          env,
          'payment',
          'confirmation_email_error',
          'warning',
          {
            payment_id: payment.id,
            message:
              emailError?.message ||
              'Falha no envio do e-mail.'
          },
          userId
        );
      }
    }

    return json({
      received: true,
      payment_id: String(payment.id),
      status: state,
      entitlement_processed: true
    });
  } catch (error) {
    const errorMessage =
      error?.message ||
      'Erro desconhecido ao processar o webhook.';

    console.error(
      'MERCADO_PAGO_WEBHOOK_ERROR',
      {
        paymentId:
          paymentId !== null
            ? String(paymentId)
            : null,
        userId,
        message: errorMessage,
        stack: error?.stack || null
      }
    );

    await safeLogIntegration(
      env,
      'payment',
      'webhook_error',
      'error',
      {
        payment_id: paymentId,
        user_id: userId,
        message: errorMessage
      },
      userId
    );

    return json(
      {
        received: false,
        payment_id:
          paymentId !== null
            ? String(paymentId)
            : null,
        error: errorMessage
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({
    ok: true,
    service:
      'mercado-pago-webhook'
  });
}
