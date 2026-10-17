import { getUser, json, supabaseAdmin, logIntegration } from '../../_lib/server.js';

async function requireAdmin(request, env) {
  const user = await getUser(request, env);
  const rows = await supabaseAdmin(env, `account_entitlements?select=role,status&user_id=eq.${encodeURIComponent(user.id)}`);
  if (rows?.[0]?.role !== 'admin' || rows?.[0]?.status !== 'active') {
    throw Object.assign(new Error('Administrator access required.'), { status: 403 });
  }
  return user;
}

export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    const url = new URL(request.url);
    const status = url.searchParams.get('status') === 'resolved' ? 'resolved' : 'pending';
    const items = await supabaseAdmin(env, `payment_review_queue?select=provider,provider_payment_id,user_id,reason,review_status,created_at,updated_at,resolved_at,resolution_notes&review_status=eq.${status}&order=created_at.desc&limit=100`);
    return json({ ok: true, items });
  } catch (e) { return json({ error: e.message }, e.status || 500); }
}

export async function onRequestPost({ request, env }) {
  try {
    const admin = await requireAdmin(request, env);
    const body = await request.json();
    const paymentId = String(body?.payment_id || '').trim();
    const provider = 'mercado_pago';
    const notes = String(body?.notes || '').trim();
    if (!/^[0-9]{1,30}$/.test(paymentId) || notes.length < 10 || notes.length > 1000 || body?.action !== 'resolve') {
      return json({ error: 'A valid payment ID, resolve action and review notes (10-1000 characters) are required.' }, 400);
    }
    const query = `payment_review_queue?provider=eq.${provider}&provider_payment_id=eq.${encodeURIComponent(paymentId)}&review_status=eq.pending`;
    const rows = await supabaseAdmin(env, query, { method: 'PATCH', body: JSON.stringify({ review_status: 'resolved', resolved_at: new Date().toISOString(), resolution_notes: notes }) });
    if (!Array.isArray(rows) || rows.length !== 1) return json({ error: 'Pending review not found or already resolved.' }, 409);
    await logIntegration(env, 'payment', 'manual_refund_review_resolved', 'info', { payment_id: paymentId, notes, reviewed_by: admin.id }, admin.id);
    return json({ ok: true, review: rows[0] });
  } catch (e) { return json({ error: e.message }, e.status || 500); }
}
