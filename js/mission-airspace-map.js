(function(){
  var sarpasUrl='https://servicos.decea.mil.br/sarpas/';
  function ready(fn){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();}
  function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function missions(){try{return typeof getMissoes==='function'?getMissoes():[];}catch(e){return [];}}
  function save(list){if(typeof saveMissoes==='function')saveMissoes(list);}
  function isMissionPage(){return location.pathname.indexOf('missoes')>-1;}
  function airspacePanel(){if(!isMissionPage()||!window.isPro||document.getElementById('airspacePanel'))return;var main=document.querySelector('.main');var card=main&&main.querySelector('.card');if(!card)return;var panel=document.createElement('section');panel.id='airspacePanel';panel.className='airspace-panel';panel.innerHTML='<div><span class="airspace-panel__eyebrow">ESPAÇO AÉREO E SARPAS</span><h3>Planeje legalmente antes de decolar.</h3><p>Vincule o protocolo SARPAS à missão e abra a consulta oficial do DECEA. O Drone Hub não confirma autorização de voo automaticamente.</p><a target="_blank" rel="noopener" href="'+sarpasUrl+'">Abrir SARPAS oficial ↗</a></div><div class="airspace-panel__check"><b>Confirmação oficial obrigatória</b><span>Consulte no SARPAS possíveis restrições, aeródromos, áreas condicionadas e autorizações aplicáveis ao local e à data da operação.</span></div>';card.insertAdjacentElement('afterend',panel);}
  function sarpasField(){if(!isMissionPage()||!window.isPro||document.getElementById('mSarpasStatus'))return;var grid=document.querySelector('.main .card .grid-2');if(!grid)return;var old=document.getElementById('mSarpas');if(!old){var field=document.createElement('div');field.innerHTML='<label for="mSarpas">Código SARPAS / autorização</label><input id="mSarpas" type="text" placeholder="Informe o código após a consulta oficial">';grid.appendChild(field);}var status=document.createElement('div');status.innerHTML='<label for="mSarpasStatus">Situação da consulta oficial</label><select id="mSarpasStatus"><option value="pendente">Consulta SARPAS pendente</option><option value="solicitada">Solicitação enviada</option><option value="autorizacao_informada">Código/autorização informado</option></select>';grid.appendChild(status);var create=window.criarMissao;if(typeof create==='function'){window.criarMissao=function(){var code=document.getElementById('mSarpas').value.trim(),statusValue=document.getElementById('mSarpasStatus').value;create.apply(this,arguments);var list=missions();if(!list.length)return;var latest=list.slice().sort(function(a,b){return String(b.createdAt||'').localeCompare(String(a.createdAt||''));})[0];if(latest){latest.sarpas=code;latest.sarpasStatus=statusValue;save(list);}document.getElementById('mSarpas').value='';document.getElementById('mSarpasStatus').value='pendente';};}}
  function cache(){try{return JSON.parse(localStorage.getItem('dronehub_geocode_cache')||'{}');}catch(e){return {};}}
  function geo(address){var c=cache();if(c[address])return Promise.resolve(c[address]);return fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(address),{headers:{Accept:'application/json'}}).then(function(r){return r.json();}).then(function(rows){if(!rows[0])return null;var point={lat:Number(rows[0].lat),lon:Number(rows[0].lon),label:rows[0].display_name};c[address]=point;localStorage.setItem('dronehub_geocode_cache',JSON.stringify(c));return point;}).catch(function(){return null;});}
  var operationsMap=null;
  function mapCard(){
    if(!window.isPro)return false;
    var main=document.querySelector('.main');if(!main)return false;
    var card=document.getElementById('missionMapCard');
    if(!card){
      card=document.createElement('section');card.id='missionMapCard';card.className='card mission-map-card';
      var anchor=document.getElementById('dashboardCommand')||document.getElementById('missionTools')||main.querySelector('.tabs')||main.querySelector('.card');
      if(!anchor)return false;
      anchor.insertAdjacentElement('afterend',card);
    }
    card.className='card mission-map-card';
    card.innerHTML='<div class="mission-map-card__head"><div><h3>Mapa de operações</h3><p>Histórico geográfico de todas as missões: agendadas, em andamento e concluídas.</p></div><div class="mission-map-badge"><i></i>DADOS DAS MISSÕES</div></div><div id="missionMap" class="mission-map"></div>';
    renderMap();return true;
  }
  function profileRegion(){try{var p=typeof getProfile==='function'?getProfile(window.uid):{};return p.cidade||p.city||'Rio de Janeiro, RJ';}catch(e){return 'Rio de Janeiro, RJ';}}
  function markerClass(status){if(status==='concluida')return 'ops-map-marker--concluida';if(status==='em_andamento')return 'ops-map-marker--andamento';return 'ops-map-marker--agendada';}
  function renderMap(){
    var target=document.getElementById('missionMap');if(!target)return;
    var list=missions().filter(function(m){return Boolean(m.local);});
    if(!window.L){target.className='mission-map-empty';target.textContent='O mapa não pôde ser carregado agora. Verifique sua conexão e tente novamente.';return;}
    target.className='mission-map';target.textContent='';
    if(operationsMap){operationsMap.remove();operationsMap=null;}
    operationsMap=L.map(target,{zoomControl:false,attributionControl:true}).setView([-22.9068,-43.1729],11);
    L.control.zoom({position:'topright'}).addTo(operationsMap);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(operationsMap);
    var jobs=list.map(function(m){var query=m.local;/Brasil|Brazil|\bBR\b/i.test(query)||(query+=', Brasil');return geo(query).then(function(point){return {mission:m,point:point};});});
    Promise.all(jobs).then(function(items){
      var bounds=[];
      items.forEach(function(item){
        if(!item.point)return;
        var m=item.mission,status=markerClass(m.status);
        var icon=L.divIcon({className:'',html:'<div class="ops-map-marker '+status+'"><span>⌖</span></div>',iconSize:[30,30],iconAnchor:[15,30]});
        var detail='<b>'+esc(m.titulo||'Missão')+'</b><small>'+esc(m.local)+'</small><br><small>'+esc(m.data||'Data a definir')+(m.horario?' · '+esc(m.horario):'')+'</small><br><small>Situação: '+esc(String(m.status||'agendada').replace('_',' '))+'</small>';
        L.marker([item.point.lat,item.point.lon],{icon:icon}).addTo(operationsMap).bindTooltip(detail,{direction:'top',offset:[0,-24],opacity:.97,sticky:true}).bindPopup(detail);
        bounds.push([item.point.lat,item.point.lon]);
      });
      if(bounds.length){operationsMap.fitBounds(bounds,{padding:[48,48],maxZoom:15});return;}
      geo(profileRegion()+', Brasil').then(function(point){if(point)operationsMap.setView([point.lat,point.lon],11);});
    });
    setTimeout(function(){operationsMap&&operationsMap.invalidateSize();},120);
  }
  window.refreshMissionMap=renderMap;
  function bootMap(){
    airspacePanel();sarpasField();
    if(mapCard())return;
    var attempts=0,timer=setInterval(function(){attempts+=1;if(mapCard()||attempts>=20)clearInterval(timer);},400);
  }
  ready(bootMap);
}());
