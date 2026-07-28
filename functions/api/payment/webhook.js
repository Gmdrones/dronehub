import { json, supabaseAdmin, logIntegration, sendEmail } from '../../_lib/server.js';

function normalizedState(status) {
  if (status === 'approved') return 'approved';
  if (['refunded', 'charged_back'].includes(status)) return status;
  if (['cancelled', 'rejected'].includes(status)) return 'cancelled';
  return 'pending';
}

export async function onRequestPost({ request, env }) {
  let paymentId = null;
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    paymentId = body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
    if (!paymentId) return json({ received: true });
    const mp = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}` }
    });
    const payment = await mp.json();
    if (!mp.ok) throw new Error(payment.message || 'Falha ao validar pagamento no Mercado Pago.');
    const userId = payment.metadata?.user_id || payment.external_reference;
    if (!userId) throw new Error('Pagamento sem usuário vinculado.');
    const state = normalizedState(payment.status);
    const months = Number(payment.metadata?.months || (payment.metadata?.plan === 'monthly' ? 1 : 12));
    await supabaseAdmin(env, 'payment_transactions?on_conflict=provider,provider_payment_id', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=representation',
      body: JSON.stringify({
        user_id: userId, provider: 'mercado_pago', provider_payment_id: String(payment.id),
        preference_id: payment.preference_id || null, status: state, status_detail: payment.status_detail || null,
        amount: payment.transaction_amount, currency: payment.currency_id || 'BRL', payment_method: payment.payment_type_id,
        payer_email: payment.payer?.email || null, raw_payload: payment, paid_at: payment.date_approved || null,
        expires_at: payment.date_of_expiration || null, updated_at: new Date().toISOString()
      })
    });
    await supabaseAdmin(env, 'rpc/apply_payment_entitlement', {
      method: 'POST', body: JSON.stringify({ target_user: userId, payment_status: state, access_months: months, payment_reference: String(payment.id) })
    });
    await logIntegration(env, 'payment', `payment_${state}`, state === 'approved' ? 'info' : 'warning', { payment_id: payment.id, status_detail: payment.status_detail }, userId);
    if (state === 'approved' && payment.payer?.email) {
      await sendEmail(env, { to: payment.payer.email, subject: 'Seu Drone Hub Pro está ativo', html: `<h2>Pagamento aprovado</h2><p>Seu acesso ao Drone Hub Pro já está ativo por ${months === 1 ? '30 dias' : '12 meses'}.</p><p><a href="${env.SITE_URL || 'https://dronehub.app.br'}/dashboard">Acessar o painel</a></p>` });
    }
    return json({ received: true });
  } catch (error) {
    await logIntegration(env, 'payment', 'webhook_error', 'error', { payment_id: paymentId, message: error.message });
    return json({ received: false, error: error.message }, 500);
  }
}

export async function onRequestGet() { return json({ ok: true, service: 'mercado-pago-webhook' }); }
