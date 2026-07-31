import {
  json,
  supabaseAdmin,
  logIntegration,
  sendEmail
} from '../../_lib/server.js';

function normalizedState(status) {
  if (status === 'approved') return 'approved';

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

    /*
     * Algumas notificações do Mercado Pago não contêm
     * um ID de pagamento. Nesses casos, apenas confirmamos
     * o recebimento.
     */
    if (!paymentId) {
      return json({
        received: true,
        ignored: true,
        reason: 'Pagamento sem ID.'
      });
    }

    /*
     * Consulta diretamente a API do Mercado Pago.
     * Não confiamos somente nos dados enviados no webhook.
     */
    const mercadoPagoResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
        paymentId
      )}`,
      {
        headers: {
          Authorization:
            `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`
        }
      }
    );

    const payment = await mercadoPagoResponse
      .json()
      .catch(() => ({}));

    if (!mercadoPagoResponse.ok) {
      throw new Error(
        payment.message ||
        'Falha ao validar o pagamento no Mercado Pago.'
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

    const months = paymentData.months;

    /*
     * Salva ou atualiza a transação.
     */
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

    /*
     * Ativa, mantém, cancela ou revoga o acesso
     * conforme o estado do pagamento.
     */
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

    await logIntegration(
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

    /*
     * Envia a confirmação somente quando aprovado.
     */
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
      } catch (emailError) {
        /*
         * Uma falha no envio do e-mail não deve fazer
         * o Mercado Pago reenviar o webhook indefinidamente.
         */
        await logIntegration(
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
    await logIntegration(
      env,
      'payment',
      'webhook_error',
      'error',
      {
        payment_id: paymentId,
        user_id: userId,
        message:
          error?.message ||
          'Erro desconhecido.'
      },
      userId
    );

    return json(
      {
        received: false,
        error:
          error?.message ||
          'Erro ao processar o pagamento.'
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
