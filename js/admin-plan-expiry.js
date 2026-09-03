(function(root){
  function planExpiry(account, now) {
    if(account.role === 'admin') return {state:'unlimited',date:'Sem vencimento',detail:'Acesso administrativo'};
    if(account.plan !== 'pro') return {state:'free',date:'—',detail:'Plano Free'};
    if(!account.courtesy_expires_at) return {state:'unlimited',date:'Sem vencimento definido',detail:'Pro sem data de expiração'};
    var expires = new Date(account.courtesy_expires_at), current = new Date(now == null ? Date.now() : now);
    if(!Number.isFinite(expires.getTime())) return {state:'unknown',date:'Data indisponível',detail:'Verifique o cadastro'};
    var zone = 'America/Sao_Paulo';
    var date = new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:zone}).format(expires);
    var calendar = new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:zone});
    var days = Math.round((Date.parse(calendar.format(expires))-Date.parse(calendar.format(current)))/86400000);
    if(expires <= current) return {state:'expired',date:date,detail:'Vencido · horário de Brasília'};
    return {state:days <= 7 ? 'soon' : 'active',date:date,detail:(days === 0 ? 'Vence hoje' : days === 1 ? 'Vence amanhã' : 'Vence em '+days+' dias')+' · Brasília'};
  }
  root.DroneHubPlanExpiry = planExpiry;
  if(typeof module !== 'undefined' && module.exports) module.exports = planExpiry;
})(typeof window !== 'undefined' ? window : globalThis);
