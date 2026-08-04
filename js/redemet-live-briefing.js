(function(){
'use strict';
var OPERATIONS_URL=(window.DRONEHUB_OPERATIONS_URL||'https://dronehub-operations.primesecureconsultoria.workers.dev').replace(/\/$/,'');
var FALLBACK=[['SBGL','Galeão',-22.81,-43.25],['SBRJ','Santos Dumont',-22.91,-43.16],['SBJR','Jacarepaguá',-22.99,-43.37],['SBGR','Guarulhos',-23.43,-46.47],['SBSP','Congonhas',-23.63,-46.66],['SBBR','Brasília',-15.87,-47.92],['SBCF','Confins',-19.63,-43.97],['SBPA','Porto Alegre',-29.99,-51.17],['SBCT','Curitiba',-25.53,-49.17],['SBSV','Salvador',-12.91,-38.33],['SBRF','Recife',-8.13,-34.92],['SBFZ','Fortaleza',-3.78,-38.53],['SBEG','Manaus',-3.04,-60.05]];
var aerodromes=null,aerodromesPromise=null;
function el(id){return document.getElementById(id)}
function esc(v){var s=document.createElement('span');s.textContent=String(v==null?'':v);return s.innerHTML}
function icon(n){return'<i data-lucide="'+n+'"></i>'}
function coords(){return{lat:Number(localStorage.getItem('dronehub_lat'))||-22.9068,lon:Number(localStorage.getItem('dronehub_lon'))||-43.1729}}
function dist(a,b,c,d){var p=Math.PI/180,x=(c-a)*p,y=(d-b)*p*Math.cos((a+c)*p/2);return 6371*Math.sqrt(x*x+y*y)}
function card(title,body){return'<article class="fc-live-card"><div class="fc-live-title">'+icon('radio')+'<span>'+title+'</span></div>'+body+'</article>'}
function num(v){var n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n:null}
function normalizeAerodrome(item){
  if(!item||typeof item!=='object')return null;
  var code=String(item.codigo_icao||item.icao||item.id_localidade||item.codigo||'').trim().toUpperCase();
  var name=String(item.nome||item.nome_aerodromo||item.localidade||item.cidade||code).trim();
  var lat=num(item.latitude_decimal||item.latitude||item.lat);
  var lon=num(item.longitude_decimal||item.longitude||item.lon||item.lng);
  if(!/^[A-Z]{4}$/.test(code)||lat===null||lon===null)return null;
  return[code,name,lat,lon];
}
function extractAerodromeList(payload){
  var candidates=[payload&&payload.data&&payload.data.data,payload&&payload.data,payload&&payload.items,payload];
  for(var i=0;i<candidates.length;i++){
    var list=candidates[i];
    if(Array.isArray(list)){
      var normalized=list.map(normalizeAerodrome).filter(Boolean);
      if(normalized.length)return normalized;
    }
  }
  return[];
}
function loadAerodromes(){
  if(aerodromes)return Promise.resolve(aerodromes);
  if(aerodromesPromise)return aerodromesPromise;
  aerodromesPromise=fetch(OPERATIONS_URL+'/aviation/aerodromes',{headers:{Accept:'application/json'}})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw Error(d.error||('HTTP '+r.status));return d})})
    .then(function(data){var list=extractAerodromeList(data);aerodromes=list.length?list:FALLBACK;return aerodromes})
    .catch(function(){aerodromes=FALLBACK;return aerodromes});
  return aerodromesPromise;
}
function nearest(list){var c=coords();return list.slice().sort(function(a,b){return dist(c.lat,c.lon,a[2],a[3])-dist(c.lat,c.lon,b[2],b[3])})[0]}
function firstMessage(root){var list=root&&root.data&&root.data.data;return Array.isArray(list)&&list.length?list[0]:null}
function fmtDate(value){if(!value)return'';var d=new Date(String(value).replace(' ','T')+'Z');return isNaN(d.getTime())?String(value):d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}
function renderLoading(st){var host=el('lm');if(!host)return;host.innerHTML=card('METAR e TAF · '+st[0],'<div class="fc-live-meta"><span>'+esc(st[1])+'</span><span>Consultando REDEMET...</span></div><div class="fc-live-raw">Carregando aeródromo, METAR e TAF oficiais.</div><div class="fc-source">Fonte: REDEMET/DECEA</div>')}
function renderError(st,message){var host=el('lm');if(!host)return;host.innerHTML=card('METAR e TAF · '+st[0],'<div class="fc-live-meta"><span>'+esc(st[1])+'</span><span>Integração indisponível</span></div><div class="fc-live-raw">'+esc(message)+'</div><div class="fc-source">Fonte: REDEMET/DECEA</div>');if(window.lucide)window.lucide.createIcons()}
function load(){
  var host=el('lm');if(!host)return false;
  loadAerodromes().then(function(list){
    var st=nearest(list);renderLoading(st);
    return fetch(OPERATIONS_URL+'/aviation/briefing?icao='+encodeURIComponent(st[0]),{headers:{Accept:'application/json'}})
      .then(function(r){return r.json().then(function(data){if(!r.ok)throw Error(data.error||('HTTP '+r.status));return data})})
      .then(function(data){
        var m=firstMessage(data.metar),t=firstMessage(data.taf),c=coords(),km=Math.round(dist(c.lat,c.lon,st[2],st[3]));
        var metar=m&&m.mens||'Sem mensagem METAR disponível no momento.';
        var taf=t&&t.mens||'Sem mensagem TAF disponível no momento.';
        var meta='<div class="fc-live-meta"><span>'+esc(st[1])+'</span><span>'+km+' km</span><span>'+esc(st[0])+'</span><span>Aeródromo REDEMET</span></div>';
        var raw='<div class="fc-live-raw">METAR\n'+esc(metar)+(m&&m.recebimento?'\nRecebido: '+esc(fmtDate(m.recebimento)):'')+'\n\nTAF\n'+esc(taf)+(t&&t.validade_inicial?'\nVálido desde: '+esc(fmtDate(t.validade_inicial)):'')+(t&&t.validade_final?'\nVálido até: '+esc(fmtDate(t.validade_final)):'')+(t&&t.recebimento?'\nRecebido: '+esc(fmtDate(t.recebimento)):'')+'</div>';
        host.innerHTML=card('METAR e TAF · '+st[0],meta+raw+'<div class="fc-source">Fonte: REDEMET/DECEA · consulta '+new Date(data.fetchedAt||Date.now()).toLocaleString('pt-BR')+'</div>');
        if(window.lucide)window.lucide.createIcons();
      }).catch(function(err){renderError(st,err.message||'Não foi possível consultar a REDEMET.')});
  });
  return true;
}
function start(){var tries=0;function wait(){if(load())return;if(++tries<40)setTimeout(wait,250)}wait();window.addEventListener('dronehub:mission-location-change',function(){load()})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
}());