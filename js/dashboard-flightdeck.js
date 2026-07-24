(function(){
  function ready(fn){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();}
  function userCount(key){try{return JSON.parse(localStorage.getItem(key)||'[]').filter(function(item){return item.userId===(window.uid||'');}).length;}catch(error){return 0;}}
  ready(function(){
    if(!window.isPro)return;
    window.setTimeout(function(){
      var deck=document.getElementById('dashboardCommand');
      if(!deck)return;
      var aircraft=userCount('dronehub_aircraft');
      var missions=userCount('dronehub_missoes');
      var readiness=aircraft?72:28;
      deck.className='dashboard-command dashboard-command--flightdeck';
      deck.innerHTML='<section class="flight-deck" aria-label="Central de comando operacional">'
        +'<div class="flight-deck__map"><div class="flight-deck__scan"></div><div class="flight-deck__route route-a"></div><div class="flight-deck__route route-b"></div><div class="flight-deck__pin pin-a"></div><div class="flight-deck__pin pin-b"></div><div class="flight-deck__map-label"><span>OPERACOES ATIVAS</span><b>MAPA TATICO</b><small>Local, historico e risco integrado</small></div><div class="flight-deck__coords">22°54′ S · 43°10′ W</div></div>'
        +'<div class="flight-deck__decision"><span class="command-eyebrow">FLIGHT DECK · DADOS AO VIVO</span><h2>Decida antes de decolar.</h2><p>'+(aircraft?'Planeje sua proxima missao com clima, risco e historico de operacao em uma unica leitura.':'Cadastre sua aeronave para ativar a avaliacao operacional personalizada.')+'</p><div class="flight-deck__meter"><div class="meter-head"><span>PRONTIDAO OPERACIONAL</span><b>'+readiness+'%</b></div><div class="meter-line"><i style="width:'+readiness+'%"></i></div><small>'+(aircraft?'Leitura baseada na sua aeronave e no local consultado.':'A aeronave define o limite seguro de vento para a sua leitura.')+'</small></div><div class="flight-deck__actions"><a class="flight-deck__primary" href="'+(aircraft?'central-voo.html':'aeronaves.html')+'">'+(aircraft?'Abrir Central de Voo':'Cadastrar aeronave')+' <b>→</b></a><a class="flight-deck__secondary" href="missoes.html">Planejar missao</a></div></div>'
        +'<div class="flight-deck__instruments"><div class="instrument-head"><span>SITUACAO DA OPERACAO</span><i title="Monitoramento ativo"></i></div><div class="instrument-grid"><div><small>AERONAVES</small><strong>'+aircraft+'</strong><em>'+(aircraft?'prontas para analise':'aguardando cadastro')+'</em></div><div><small>MISSÕES</small><strong>'+missions+'</strong><em>no historico</em></div><div><small>METEOROLOGIA</small><strong id="deckWind">—</strong><em>vento local</em></div><div><small>ALERTA</small><strong class="instrument-ok">ON</strong><em>monitoramento ativo</em></div></div></div>'
        +'</section>';
      var source=document.getElementById('wVento'),wind=document.getElementById('deckWind');
      if(source&&wind&&source.textContent!=='--')wind.textContent=source.textContent;
      window.setTimeout(function(){var latest=document.getElementById('wVento'),target=document.getElementById('deckWind');if(latest&&target&&latest.textContent!=='--')target.textContent=latest.textContent;},1800);
    },120);
  });
}());
