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

  if (['cancelled', 'rejected', 'expired'].includes(status)) {
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

  const referenceParts =
    externalReference.split('|');

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

/*
 * Cria uma cópia do pagamento sem informações
 * desnecessárias ou muito sensíveis.
 *
 * O objeto original continua sendo usado normalmente
 * durante o processamento do webhook.
 */
function sanitizePaymentPayload(payment) {
  if (
    !payment ||
    typeof payment !== 'object'
  ) {
    return {};
  }

  try {
    const sanitized =
      JSON.parse(JSON.stringify(payment));

    const transactionData =
      sanitized
        ?.point_of_interaction
        ?.transaction_data;

    if (transactionData) {
      delete transactionData.qr_code;
      delete transactionData.qr_code_base64;
      delete transactionData.ticket_url;
    }

    if (sanitized.payer) {
      delete sanitized.payer.phone;
      delete sanitized.payer.identification;
    }

    return sanitized;
  } catch {
    return {
      id:
        payment.id ||
        null,

      status:
        payment.status ||
        null,

      status_detail:
        payment.status_detail ||
        null,

      external_reference:
        payment.external_reference ||
        null,

      transaction_amount:
        payment.transaction_amount ??
        null,

      currency_id:
        payment.currency_id ||
        null
    };
  }
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
    console.error(
      'INTEGRATION_LOG_ERROR',
      {
        event,
        userId,

        message:
          logError?.message ||
          'Falha desconhecida ao gravar log.'
      }
    );
  }
}

export async function onRequestPost({
  request,
  env
}) {
  let paymentId = null;
  let userId = null;
  let mercadoPagoStatus = null;

  try {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new Error(
        'MERCADO_PAGO_ACCESS_TOKEN não configurado.'
      );
    }

    const mercadoPagoAccessToken =
      String(
        env.MERCADO_PAGO_ACCESS_TOKEN
      ).trim();

    if (!mercadoPagoAccessToken) {
      throw new Error(
        'MERCADO_PAGO_ACCESS_TOKEN está vazio.'
      );
    }

    const url =
      new URL(request.url);

    const body =
      await request
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

        reason:
          'Notificação sem ID de pagamento.'
      });
    }

    paymentId =
      String(paymentId).trim();

    console.log(
      'MERCADO_PAGO_WEBHOOK_RECEIVED',
      {
        paymentId,

        action:
          body?.action ||
          null,

        type:
          body?.type ||
          null,

        liveMode:
          body?.live_mode ??
          null
      }
    );

    const mercadoPagoResponse =
      await fetch(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
          paymentId
        )}`,
        {
          method: 'GET',

          headers: {
            Authorization:
              `Bearer ${mercadoPagoAccessToken}`,

            Accept:
              'application/json'
          }
        }
      );

    mercadoPagoStatus =
      mercadoPagoResponse.status;

    /*
     * A resposta é lida como texto primeiro para permitir
     * identificar respostas inválidas, mas seu conteúdo
     * completo não é enviado aos logs.
     */
    const responseText =
      await mercadoPagoResponse.text();

    let payment = {};

    try {
      payment =
        responseText
          ? JSON.parse(responseText)
          : {};
    } catch {
      throw new Error(
        `O Mercado Pago retornou uma resposta inválida. HTTP ${mercadoPagoStatus}.`
      );
    }

    if (!mercadoPagoResponse.ok) {
      const mercadoPagoMessage =
        payment?.message ||
        payment?.error ||
        'Não foi possível consultar o pagamento.';

      throw new Error(
        `Mercado Pago HTTP ${mercadoPagoStatus}: ${mercadoPagoMessage}`
      );
    }

    if (!payment?.id) {
      throw new Error(
        'O Mercado Pago não retornou um pagamento válido.'
      );
    }

    const paymentData =
      extractPaymentData(payment);

    userId =
      paymentData.userId;

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
      normalizedState(
        payment.status
      );

    const months =
      paymentData.months;

    console.log(
      'MERCADO_PAGO_PAYMENT_VALIDATED',
      {
        paymentId:
          String(payment.id),

        userId,

        status:
          payment.status,

        normalizedStatus:
          state,

        plan:
          paymentData.planKey ||
          null,

        months
      }
    );

    const sanitizedPayment =
      sanitizePaymentPayload(payment);

    await supabaseAdmin(
      env,
      'payment_transactions?on_conflict=provider,provider_payment_id',
      {
        method:
          'POST',

        prefer:
          'resolution=merge-duplicates,return=representation',

        body:
          JSON.stringify({
            user_id:
              userId,

            provider:
              'mercado_pago',

            provider_payment_id:
              String(payment.id),

            preference_id:
              payment.preference_id ||
              null,

            status:
              state,

            status_detail:
              payment.status_detail ||
              null,

            amount:
              payment.transaction_amount,

            currency:
              payment.currency_id ||
              'BRL',

            payment_method:
              payment.payment_type_id ||
              payment.payment_method_id ||
              null,

            payer_email:
              payment.payer?.email ||
              payment.metadata?.email ||
              null,

            raw_payload:
              sanitizedPayment,

            paid_at:
              payment.date_approved ||
              null,

            expires_at:
              payment.date_of_expiration ||
              null,

            updated_at:
              new Date().toISOString()
          })
      }
    );

    console.log(
      'PAYMENT_TRANSACTION_SAVED',
      {
        paymentId:
          String(payment.id),

        userId,

        status:
          state
      }
    );

    await supabaseAdmin(
      env,
      'rpc/apply_payment_entitlement',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            target_user:
              userId,

            payment_status:
              state,

            access_months:
              months,

            payment_reference:
              String(payment.id)
          })
      }
    );

    console.log(
      'PAYMENT_ENTITLEMENT_APPLIED',
      {
        paymentId:
          String(payment.id),

        userId,

        status:
          state,

        months
      }
    );

    await safeLogIntegration(
      env,
      'payment',
      `payment_${state}`,

      state === 'approved'
        ? 'info'
        : 'warning',

      {
        payment_id:
          String(payment.id),

        mercado_pago_status:
          payment.status,

        status_detail:
          payment.status_detail ||
          null,

        plan:
          paymentData.planKey ||
          null,

        months
      },

      userId
    );

    const payerEmail =
      payment.payer?.email ||
      payment.metadata?.email ||
      null;

    if (
      state === 'approved' &&
      payerEmail
    ) {
      try {
        const site = (
          env.SITE_URL ||
          'https://dronehub.app.br'
        ).replace(/\/$/, '');

        await sendEmail(
          env,
          {
            to:
              payerEmail,

            subject:
              'Seu Drone Hub PRO está ativo',

            html: `
              <h2>Pagamento confirmado!</h2>

              <p>
                Seu acesso ao Drone Hub PRO já está ativo por
                ${
                  months === 1
                    ? '30 dias'
                    : `${months} meses`
                }.
              </p>

              <p>
                <a href="${site}/dashboard">
                  Acessar Drone Hub
                </a>
              </p>
            `
          }
        );

        console.log(
          'PAYMENT_CONFIRMATION_EMAIL_SENT',
          {
            paymentId:
              String(payment.id),

            userId
          }
        );
      } catch (emailError) {
        const emailErrorMessage =
          emailError?.message ||
          'Falha no envio do e-mail.';

        console.error(
          'PAYMENT_CONFIRMATION_EMAIL_ERROR',
          {
            paymentId:
              String(payment.id),

            userId,

            message:
              emailErrorMessage
          }
        );

        await safeLogIntegration(
          env,
          'payment',
          'confirmation_email_error',
          'warning',
          {
            payment_id:
              String(payment.id),

            message:
              emailErrorMessage
          },
          userId
        );
      }
    } else if (state === 'cancelled' && payerEmail) {
      try {
        const site = (env.SITE_URL || 'https://dronehub.app.br').replace(/\/$/, '');

        await sendEmail(env, {
          to: payerEmail,
          subject: 'Pagamento não concluído',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#102033">
              <h1 style="color:#0b7fab">Pagamento não concluído</h1>
              <p>Seu pagamento não foi confirmado.</p>
              <p>Caso ainda deseje assinar o Drone Hub PRO, acesse novamente nossa página de planos e gere um novo pagamento.</p>
              <p style="margin-top:28px">
                <a href="${site}/precos" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#18c8ff;color:#07111d;text-decoration:none;font-weight:700">Assinar agora</a>
              </p>
            </div>
          `,
          text: `Pagamento não concluído\n\nSeu pagamento não foi confirmado.\n\nCaso ainda deseje assinar o Drone Hub PRO, acesse novamente nossa página de planos e gere um novo pagamento.\n\nAssinar agora: ${site}/precos`
        });
      } catch (emailError) {
        await safeLogIntegration(
          env,
          'payment',
          'payment_not_completed_email_error',
          'warning',
          {
            payment_id: String(payment.id),
            message: String(emailError?.message || emailError)
          },
          userId
        );
      }
    }

    return json({
      received:
        true,

      payment_id:
        String(payment.id),

      status:
        state,

      entitlement_processed:
        true
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

        mercadoPagoHttpStatus:
          mercadoPagoStatus,

        message:
          errorMessage
      }
    );

    await safeLogIntegration(
      env,
      'payment',
      'webhook_error',
      'error',
      {
        payment_id:
          paymentId !== null
            ? String(paymentId)
            : null,

        user_id:
          userId,

        mercado_pago_http_status:
          mercadoPagoStatus,

        message:
          errorMessage
      },
      userId
    );

    return json(
      {
        received:
          false,

        payment_id:
          paymentId !== null
            ? String(paymentId)
            : null,

        error:
          errorMessage
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({
    ok:
      true,

    service:
      'mercado-pago-webhook'
  });
}
