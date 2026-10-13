// Mercado Pago signs: id:<payment-id>;request-id:<x-request-id>;ts:<ts>;
const PRICES_CENTS = Object.freeze({ monthly: 4500, annual: 35880 });

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function verifyMercadoPagoSignature(request, env, paymentId) {
  const secret = String(env.MERCADO_PAGO_WEBHOOK_SECRET || '').trim();
  if (!secret) throw httpError('Webhook secret is not configured.', 503);

  const header = request.headers.get('x-signature') || '';
  const requestId = request.headers.get('x-request-id') || '';
  const ts = header.match(/(?:^|,)\s*ts=([^,\s]+)/)?.[1];
  const signature = header.match(/(?:^|,)\s*v1=([0-9a-f]{64})(?:,|$)/i)?.[1];

  if (!requestId || !ts || !signature || !/^\d+$/.test(ts) || !paymentId) {
    throw httpError('Invalid Mercado Pago webhook signature.', 401);
  }

  const manifest = `id:${String(paymentId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest));
  const expected = new Uint8Array(digest);
  const received = Uint8Array.from(signature.match(/../g), byte => parseInt(byte, 16));
  let mismatch = expected.length ^ received.length;
  for (let i = 0; i < expected.length; i++) mismatch |= expected[i] ^ received[i];
  if (mismatch !== 0) throw httpError('Invalid Mercado Pago webhook signature.', 401);
}

export function validatePaymentPurchase(payment, paymentData) {
  const plan = paymentData.planKey;
  const expected = PRICES_CENTS[plan];
  const paidCents = Math.round(Number(payment.transaction_amount) * 100);
  if (!expected || !Number.isFinite(paidCents) ||
      paidCents !== expected || payment.currency_id !== 'BRL' ||
      Number(paymentData.months) !== (plan === 'monthly' ? 1 : 12)) {
    throw httpError('Payment amount, currency or plan does not match the purchase.', 422);
  }
  if (payment.metadata?.user_id && payment.external_reference &&
      String(payment.metadata.user_id) !== String(payment.external_reference).split('|')[0]) {
    throw httpError('Payment user identity mismatch.', 422);
  }
}
