const DAY = 86400000;
export function renewalStage(a, now = Date.now()) {
  if (!a || a.plan !== 'pro' || a.status !== 'active' || a.role === 'admin') return null;
  const remaining = new Date(a.courtesy_expires_at || '').getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0 || remaining > 7 * DAY) return null;
  return remaining <= DAY ? 1 : remaining <= 3 * DAY ? 3 : 7;
}
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renewalMessage(profile, expiry) {
  const name = String(profile.user_metadata?.full_name || profile.user_metadata?.name || 'piloto').trim().slice(0,100) || 'piloto';
  const date = new Date(expiry).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo', dateStyle:'short', timeStyle:'short' });
  const url = 'https://dronehub.app.br/precos?utm_source=email&utm_medium=renewal';
  return { to:profile.email, name, subject:'Seu DroneHub Pro está próximo do vencimento',
    text:`Olá, ${name}! Seu Pro vence em ${date} (Brasília). Renove para continuar utilizando os recursos Pro: ${url}. Se acabou de renovar, confira a validade na sua conta.`,
    html:`<div style="background:#080c12;padding:32px 16px;font-family:Arial,sans-serif;color:#f4f8fb"><div style="max-width:540px;margin:auto;padding:28px;background:#101824;border:1px solid #253547;border-radius:16px"><p style="color:#20c9f3;font-size:12px">DRONEHUB · SEU PLANO</p><h1 style="font-size:27px">Continue suas operações com o Pro.</h1><p>Olá, ${escapeHTML(name)}!</p><p style="color:#bdcbd9;line-height:1.7">Seu plano Pro vence em <strong>${escapeHTML(date)} (Brasília)</strong>. Renove para continuar utilizando os recursos Pro do DroneHub.</p><p style="margin:28px 0"><a href="${url}" style="display:inline-block;background:#20c9f3;color:#06111c;padding:14px 22px;border-radius:8px;font-weight:bold;text-decoration:none">Renovar meu Pro</a></p><p style="color:#9aaec1;font-size:13px">Se você acabou de renovar, confira a nova validade na sua conta.</p></div></div>` };
}
function contactable(p, now) { return p?.email && p.email_confirmed_at && !(p.banned_until && new Date(p.banned_until).getTime() > now); }
export async function runRenewals({ db, getProfile, send, now = () => Date.now() }, dryRun = false) {
  const counts = { eligible:0, accepted:0, skipped:0, failed:0, uncertain:0, dryRun };
  let after = '';
  while (true) {
    const time = now();
    const rows = await db('account_entitlements?select=user_id,plan,role,status,courtesy_expires_at&plan=eq.pro&status=eq.active' +
      '&courtesy_expires_at=gt.' + encodeURIComponent(new Date(time).toISOString()) +
      '&courtesy_expires_at=lte.' + encodeURIComponent(new Date(time+7*DAY).toISOString()) +
      '&order=user_id.asc&limit=100' + (after ? '&user_id=gt.' + encodeURIComponent(after) : ''));
    if (!Array.isArray(rows)) throw new Error('Resposta inválida ao consultar planos.');
    if (!rows.length) break;
    for (const account of rows) {
      let claim = null, attempted = false;
      const update = values => db('renewal_email_deliveries?id=eq.'+claim.id, {method:'PATCH',body:JSON.stringify(values)});
      try {
        const stage = renewalStage(account, now());
        if (!stage) { counts.skipped++; continue; }
        counts.eligible++;
        if (dryRun) continue;
        if (!contactable(await getProfile(account.user_id), now())) { counts.skipped++; continue; }
        // The unique constraint makes this claim atomic across overlapping jobs.
        const inserted = await db('renewal_email_deliveries?on_conflict=user_id,expires_at,stage', {
          method:'POST', prefer:'resolution=ignore-duplicates,return=representation',
          body:JSON.stringify({user_id:account.user_id,expires_at:account.courtesy_expires_at,stage,state:'claimed'})
        });
        if (!inserted?.length) { counts.skipped++; continue; }
        claim = inserted[0];
        const fresh = (await db('account_entitlements?select=plan,role,status,courtesy_expires_at&user_id=eq.'+encodeURIComponent(account.user_id)))?.[0];
        const profile = await getProfile(account.user_id);
        if (renewalStage(fresh,now()) !== stage || new Date(fresh?.courtesy_expires_at).getTime() !== new Date(account.courtesy_expires_at).getTime() || !contactable(profile,now())) {
          await update({state:'skipped'}); counts.skipped++; continue;
        }
        attempted = true;
        const receipt = await send(renewalMessage(profile,account.courtesy_expires_at));
        if (!receipt?.messageId) throw new Error('Envio sem comprovante de aceitação.');
        await update({state:'accepted',provider_message_id:receipt.messageId,accepted_at:new Date(now()).toISOString()});
        counts.accepted++;
      } catch (error) {
        const state = attempted && !error.definitelyRejected ? 'uncertain' : 'failed';
        counts[state]++;
        // No automatic replay of an ambiguous provider attempt. Reconcile it first.
        if (claim) try { await update({state,error_code:error.code || 'delivery_error'}); } catch (_) {}
      }
    }
    after = rows[rows.length-1].user_id;
  }
  return counts;
}
