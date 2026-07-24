(function () {
  function cardinal(degrees) {
    var names=['N','NE','L','SE','S','SO','O','NO'];
    return names[Math.round((Number(degrees)||0)/45)%8];
  }
  function dateLabel(value) {
    if(!value) return 'não definido';
    return new Date(value+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  }
  function createShell() {
    var content=document.querySelector('.content');
    if(!content || document.getElementById('proReadiness')) return null;
    var shell=document.createElement('section'); shell.id='proReadiness'; shell.className='pro-readiness';
    shell.innerHTML='<div class="pro-readiness__top"><div><div class="pro-readiness__eyebrow">DRONE HUB PRO · PRONTIDÃO OPERACIONAL</div><h2>Sua operação antes da decolagem</h2></div><div class="pro-readiness__tag">DADOS AO VIVO</div></div><div class="readiness-grid"><article class="readiness-card readiness-card--airspace"><div class="readiness-card__label">ESPAÇO AÉREO E AUTORIZAÇÃO</div><div class="readiness-card__value">Consulta obrigatória</div><div class="readiness-card__meta">Registre o código da autorização da missão e confirme restrições no canal oficial antes de voar.</div><div class="readiness-card__actions"><a href="https://servicos.decea.mil.br/sarpas/?login=1" target="_blank" rel="noopener">Abrir SARPAS</a><a href="missoes.html">Vincular missão</a></div></article><article class="readiness-card readiness-card--weather"><div class="readiness-card__label">METEOROLOGIA OPERACIONAL</div><div class="readiness-card__value" id="opWeatherValue">Consultando local</div><div class="readiness-data"><span>Direção<b id="opWindDirection">--</b></span><span>Visibilidade<b id="opVisibility">--</b></span><span>Pôr do sol<b id="opSunset">--</b></span><span>Rajadas<b id="opGust">--</b></span></div></article><article class="readiness-card readiness-card--fleet"><div class="readiness-card__label">SAÚDE DA FROTA</div><div class="readiness-card__value" id="opFleetValue">Verificando frota</div><div class="readiness-card__meta" id="opFleetMeta">Baterias, firmware, seguro e manutenção da sua operação.</div><div class="readiness-card__actions"><a href="aeronaves.html">Ver aeronaves</a><a href="documentos.html">Documentos</a></div></article></div>';
    content.insertBefore(shell,content.firstChild); return shell;
  }
  function updateFleet() {
    var fleet=Array.isArray(window.batteries)?window.batteries:[];
    var aircraft=Array.isArray(window.aircraft)?window.aircraft:[];
    var value=document.getElementById('opFleetValue'), meta=document.getElementById('opFleetMeta'); if(!value||!meta)return;
    value.textContent=aircraft.length?aircraft.length+' aeronave'+(aircraft.length>1?'s':'')+' ativa'+(aircraft.length>1?'s':''):'Cadastre sua primeira aeronave';
    if(!fleet.length){meta.textContent='Nenhuma bateria cadastrada. Adicione ciclos e estado de saúde para receber alertas.';return;}
    var cycles=fleet.map(function(b){return Number(b.cycles||b.ciclos||0);}), max=Math.max.apply(null,cycles);
    meta.textContent=fleet.length+' bateria'+(fleet.length>1?'s':'')+' acompanhada'+(fleet.length>1?'s':'')+(max?' · maior ciclo: '+max:' · informe os ciclos para receber alertas.');
  }
  function updateWeather() {
    var lat=Number(localStorage.getItem('dronehub_lat'))||-22.9068, lon=Number(localStorage.getItem('dronehub_lon'))||-43.1729;
    fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cloud_cover&daily=sunset&forecast_days=1&timezone=auto').then(function(r){return r.json();}).then(function(data){
      var c=data.current||{}, d=data.daily||{}, direction=Math.round(c.wind_direction_10m||0), sunset=(d.sunset&&d.sunset[0])?new Date(d.sunset[0]).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'--';
      document.getElementById('opWeatherValue').textContent=Math.round(c.wind_speed_10m||0)+' km/h de vento';
      document.getElementById('opWindDirection').textContent=cardinal(direction)+' · '+direction+'°';
      document.getElementById('opVisibility').textContent=c.visibility?Math.max(.1,Math.round(c.visibility/100)/10)+' km':'--';
      document.getElementById('opSunset').textContent=sunset;
      document.getElementById('opGust').textContent=Math.round(c.wind_gusts_10m||0)+' km/h';
    }).catch(function(){var label=document.getElementById('opWeatherValue');if(label)label.textContent='Dados indisponíveis agora';});
  }
  document.addEventListener('DOMContentLoaded',function(){ if(!window.isPro)return; if(createShell()){updateFleet();updateWeather();setInterval(updateWeather,10*60*1000);} });
}());
