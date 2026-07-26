(function(){
  'use strict';
  function esc(value){return String(value == null ? '' : value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function n(value){var parsed=Number(value);return Number.isFinite(parsed)?parsed:0;}
  function firstName(){var name=(window.user&&user.name)||'Piloto';return String(name).trim().split(/\s+/)[0]||'Piloto';}
  function greeting(){var hour=new Date().getHours();return hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';}
  function missionDate(m){return String(m.data||m.date||m.datetime||'').slice(0,10);}
  function todayKey(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function flightStats(){var list=(window.missions||[]).filter(function(m){return m.status==='concluida';});return {completed:list.length,minutes:list.reduce(function(s,m){return s+n(m.durationMinutes||m.duration||m.tempoVoo);},0),distance:list.reduce(function(s,m){return s+n(m.distanceKm||m.distance||m.distancia);},0)};}
  function updateDesktopKpis(){
    var row=document.getElementById('desktopOperationalKpis');if(!row)return;
    var cards=row.querySelectorAll('.kpi-card'),stats=flightStats();
    var values=[(stats.minutes/60).toFixed(stats.minutes?1:0)+' h',(window.missions||[]).length,stats.distance.toFixed(stats.distance?1:0)+' km',(window.aircraft||[]).length,(window.batteries||[]).length,stats.completed];
    var labels=['Horas voadas','Missões','Distância percorrida','Aeronaves','Baterias monitoradas','Voos concluídos'];
    cards.forEach(function(card,i){var value=card.querySelector('.kpi-value'),label=card.querySelector('.kpi-label');if(value)value.textContent=values[i];if(label)label.textContent=labels[i];});
  }
  function smartHero(){
    var title=document.getElementById('smartGreeting'),sub=document.getElementById('welcomeSub'),status=document.getElementById('smartHeroStatus');if(!title)return;
    var today=(window.missions||[]).filter(function(m){return missionDate(m)===todayKey();});
    var warnings=document.querySelectorAll('#alertList .alert-item').length;
    title.textContent=greeting()+', '+firstName();
    sub.textContent=(window.aircraft||[]).length?((aircraft[0].marca||'')+' '+(aircraft[0].modelo||'Aeronave')+' pronta para análise operacional.'):'Cadastre sua aeronave para ativar a análise operacional.';
    if(status)status.innerHTML='<span class="smart-status-item"><i></i> Clima atualizado agora</span><span class="smart-status-item"><i></i> '+(warnings?warnings+' alerta(s)':'Nenhum alerta')+'</span><span class="smart-status-item"><i></i> '+today.length+' missão(ões) hoje</span>';
  }
  function hideEmpty(){
    [['documentsCard',window.docs],['financeCard',window.txns],['clientsCard',window.clients],['batteriesCard',window.batteries]].forEach(function(pair){var el=document.getElementById(pair[0]);if(el)el.classList.toggle('is-empty',!(pair[1]||[]).length);});
  }
  function icon(path){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">'+path+'</svg>';}
  function mobileMarkup(){
    var content=document.querySelector('.main .content');if(!content||document.querySelector('.dashboard-mobile'))return;
    var profile=typeof getProfile==='function'?getProfile(window.uid):{},city=profile.cidade||profile.city||'Rio de Janeiro, RJ';
    var today=(window.missions||[]).filter(function(m){return missionDate(m)===todayKey();}),alerts=document.querySelectorAll('#alertList .alert-item').length;
    var mobile=document.createElement('section');mobile.className='dashboard-mobile';mobile.setAttribute('aria-label','Resumo operacional');
    mobile.innerHTML='<div class="mobile-ops-hero"><div class="mobile-ops-copy"><span class="mobile-ops-eyebrow">DRONE HUB · OPERAÇÃO ATUAL</span><h1>'+esc(greeting()+', '+firstName())+'</h1><div class="mobile-ready"><i></i><span id="mobileReadyText">Operação pronta para consulta</span></div><div class="mobile-weather-line"><div><small>LOCAL</small><strong>'+esc(city)+'</strong></div><div><small>TEMPERATURA</small><strong id="mobileTemp">--</strong></div><div><small>VENTO</small><strong id="mobileWind">--</strong></div></div><a class="mobile-main-cta" href="central-voo.html"><span>Abrir Central de Voo</span><b>→</b></a></div></div>'+
      '<div class="mobile-quick-grid"><a class="mobile-quick" href="aeronaves.html">'+icon('<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7z"/>')+'<div><strong>Aeronaves</strong><small>'+(aircraft||[]).length+' cadastrada(s)</small></div></a><a class="mobile-quick" href="missoes.html">'+icon('<circle cx="12" cy="12" r="9"/><path d="m12 7 3 5-3 5-3-5 3-5z"/>')+'<div><strong>Missões</strong><small>'+today.length+' hoje</small></div></a><a class="mobile-quick" href="documentos.html">'+icon('<path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5"/>')+'<div><strong>Documentos</strong><small>'+(docs||[]).length+' no painel</small></div></a><a class="mobile-quick" href="aeronaves.html#fleetHealth">'+icon('<rect x="3" y="7" width="18" height="11" rx="2"/><path d="M8 7V4h8v3"/>')+'<div><strong>Baterias</strong><small>'+(batteries||[]).length+' monitorada(s)</small></div></a></div>'+
      '<div class="mobile-condition-card"><div class="mobile-condition-head"><span>CONDIÇÕES ATUAIS</span><b id="mobileStatus">Atualizando</b></div><div class="mobile-condition-metrics"><div><small>Temp.</small><strong id="mobileTemp2">--</strong></div><div><small>Vento</small><strong id="mobileWind2">--</strong></div><div><small>Rajadas</small><strong id="mobileGust">--</strong></div><div><small>Sat.</small><strong id="mobileSat">--</strong></div></div></div>'+
      (today.length?'<div class="card mobile-context-card"><div class="card-header"><h3>Próxima missão</h3><a class="card-link" href="missoes.html">Ver</a></div><strong>'+esc(today[0].titulo||today[0].cliente||'Missão de hoje')+'</strong></div>':'')+
      (alerts?'<div class="card mobile-context-card"><div class="card-header"><h3>Alertas operacionais</h3></div><p>'+alerts+' item(ns) precisam da sua atenção.</p></div>':'')+
      '<button class="dashboard-more-toggle" id="mobileExpandToggle" type="button" aria-expanded="false"><span class="toggle-label">Mostrar informações operacionais</span><span class="toggle-chevron">⌄</span></button>'+
      '<div class="mobile-expand-panel" id="mobileExpandPanel">'+
        '<div class="mobile-expand-summary">'+
          '<div class="mobile-expand-row"><span>Perfil operacional</span><b>'+(profile.nome?'Completo':'Pendente')+'</b></div>'+
          '<div class="mobile-expand-row"><span>Voos concluídos</span><b>'+flightStats().completed+'</b></div>'+
          '<div class="mobile-expand-row"><span>Documentos ativos</span><b>'+(docs||[]).length+'</b></div>'+
          '<div class="mobile-expand-row"><span>Baterias monitoradas</span><b>'+(batteries||[]).length+'</b></div>'+
        '</div>'+
        '<div class="mobile-tools-title">Todas as ferramentas</div>'+
        '<nav class="mobile-tools-grid" aria-label="Todas as ferramentas do Drone Hub">'+
          '<a href="perfil.html"><strong>Perfil do piloto</strong><small>Dados e documentos pessoais</small></a>'+
          '<a href="aeronaves.html"><strong>Frota e baterias</strong><small>Aeronaves, ciclos e manutenção</small></a>'+
          '<a href="central-voo.html"><strong>Central de Voo</strong><small>Clima e decisão operacional</small></a>'+
          '<a href="missoes.html"><strong>Missões e checklist</strong><small>Planejamento, SARPAS e diário</small></a>'+
          '<a href="documentos.html"><strong>Documentos e relatórios</strong><small>IA, PDF, DOCX e arquivos</small></a>'+
          '<a href="fiscalizacao.html"><strong>Fiscalização</strong><small>Credencial e QR Code</small></a>'+
          '<a href="financeiro.html"><strong>Financeiro</strong><small>Receitas, despesas e histórico</small></a>'+
        '</nav>'+
      '</div><p class="mobile-more-note">Informação essencial primeiro. Todas as ferramentas continuam acessíveis.</p>';
    content.insertBefore(mobile,content.firstChild);
  }
  function syncWeather(){
    var map=[['wTemp','mobileTemp'],['wTemp','mobileTemp2'],['wVento','mobileWind'],['wVento','mobileWind2'],['wRajada','mobileGust'],['wSat','mobileSat'],['wStatus','mobileStatus']];
    map.forEach(function(ids){var source=document.getElementById(ids[0]),target=document.getElementById(ids[1]);if(source&&target&&source.textContent.trim()!=='--')target.textContent=source.textContent.replace('🟢 ','').replace('🟡 ','').replace('🔴 ','');});
  }
  function bindToggle(btn,section){
    if(!btn||!section)return;
    btn.addEventListener('click',function(){
      var open=btn.getAttribute('aria-expanded')==='true';
      btn.setAttribute('aria-expanded',String(!open));
      var label=btn.querySelector('.toggle-label');
      if(label)label.textContent=open?'Mostrar informações operacionais':'Mostrar menos';
      section.classList.toggle('is-open',!open);
    });
  }
  function toggleMore(){bindToggle(document.getElementById('dashboardMoreToggle'),document.getElementById('dashboardMoreSection'));bindToggle(document.getElementById('mobileExpandToggle'),document.getElementById('mobileExpandPanel'));}
  function fetchMobileWeather(){fetch('https://api.open-meteo.com/v1/forecast?latitude=-22.9068&longitude=-43.1729&current=temperature_2m,wind_speed_10m,wind_gusts_10m&timezone=America%2FSao_Paulo').then(function(r){return r.json();}).then(function(data){var c=data.current;if(!c)return;[['mobileTemp',Math.round(c.temperature_2m)+'°'],['mobileTemp2',Math.round(c.temperature_2m)+'°'],['mobileWind',Math.round(c.wind_speed_10m)+' km/h'],['mobileWind2',Math.round(c.wind_speed_10m)+' km/h'],['mobileGust',Math.round(c.wind_gusts_10m)+' km/h']].forEach(function(x){var el=document.getElementById(x[0]);if(el)el.textContent=x[1];});var status=document.getElementById('mobileStatus');if(status)status.textContent=c.wind_speed_10m<15?'Favorável':c.wind_speed_10m<25?'Atenção':'Não recomendado';}).catch(function(){});}
  function init(){updateDesktopKpis();hideEmpty();smartHero();mobileMarkup();toggleMore();syncWeather();fetchMobileWeather();var weather=document.getElementById('weatherContent');if(weather)new MutationObserver(syncWeather).observe(weather,{subtree:true,childList:true,characterData:true,attributes:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
