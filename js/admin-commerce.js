(function () {
  'use strict';
  function safe(value) { var node=document.createElement('span'); node.textContent=String(value == null ? '' : value); return node.innerHTML; }
  function money(value) { return Number(value || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
  function date(value) { return value ? new Date(value).toLocaleString('pt-BR') : '—'; }
  async function load() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
    var health=await supabaseClient.rpc('admin_integration_health');
    var payments=await supabaseClient.from('payment_transactions').select('provider_payment_id,status,amount,currency,payment_method,user_email,created_at').order('created_at',{ascending:false}).limit(30);
    var wrap=document.createElement('section'); wrap.className='admin-card accounts-card'; wrap.id='commerceAdmin';
    var healthRows=(health.data||[]).map(function(row){return '<span class="status-badge '+(row.error_count_24h?'blocked':'active')+'">'+safe(row.service)+': '+safe(row.last_event||'sem eventos')+' · '+Number(row.error_count_24h||0)+' erro(s)/24h</span>';}).join(' ');
    var paymentRows=(payments.data||[]).map(function(row){return '<tr><td>'+safe(row.provider_payment_id)+'</td><td>'+safe(row.user_email||'—')+'</td><td><span class="status-badge '+(row.status==='approved'?'active':'')+'">'+safe(row.status)+'</span></td><td>'+money(row.amount)+' '+safe(row.currency||'BRL')+'</td><td>'+safe(row.payment_method||'—')+'</td><td>'+date(row.created_at)+'</td></tr>';}).join('');
    wrap.innerHTML='<div class="accounts-heading"><div><p class="eyebrow">OPERAÇÃO E RECEITA</p><h2>Pagamentos e integrações</h2><p class="card-copy">Registro administrativo de cobranças e saúde dos serviços críticos.</p></div><button class="admin-ghost" id="backupAdmin" type="button">Exportar backup</button></div><div class="accounts-status">'+(healthRows||'Sem eventos registrados nas últimas 24 horas.')+'</div><div class="accounts-table-wrap"><table class="accounts-table"><thead><tr><th>Pagamento</th><th>Conta</th><th>Status</th><th>Valor</th><th>Método</th><th>Data</th></tr></thead><tbody>'+(paymentRows||'<tr><td colspan="6">Nenhum pagamento registrado.</td></tr>')+'</tbody></table></div>';
    document.getElementById('adminApp').appendChild(wrap);
    document.getElementById('backupAdmin').onclick=async function(){
      var records=await supabaseClient.from('user_records').select('*');
      var blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),records:records.data||[],payments:payments.data||[]},null,2)],{type:'application/json'});
      var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='dronehub-backup-'+new Date().toISOString().slice(0,10)+'.json'; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href)},1000);
    };
  }
  window.addEventListener('load',function(){setTimeout(function(){load().catch(function(error){console.error('Admin commerce:',error)})},1200)});
}());
