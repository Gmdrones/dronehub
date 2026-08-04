(function(){
'use strict';
var OPERATIONS_URL=(window.DRONEHUB_OPERATIONS_URL||'https://dronehub-operations.primesecureconsultoria.workers.dev').replace(/\/$/,'');
var STATIONS=[['SBGL','Galeão',-22.81,-43.25],['SBRJ','Santos Dumont',-22.91,-43.16],['SBJR','Jacarepaguá',-22.99,-43.37],['SBGR','Guarulhos',-23.43,-46.47],['SBSP','Congonhas',-23.63,-46.66],['SBBR','Brasília',-15.87,-47.92],['SBCF','Confins',-19.63,-43.97],['SBPA','Porto Alegre',-29.99,-51.17],['SBCT','Curitiba',-25.53,-49.17],['SBSV','Salvador',-12.91,-38.33],['SBRF','Recife',-8.13,-34.92],['SBFZ','Fortaleza',-3.78,-38.53],['SBEG','Manaus',-3.04,-60.05]];
function el(id){return document.getElementById(id)}
function esc(v){var s=document.createElement('span');s.textContent=String(v==null?'':v);return s.innerHTML}
function icon(n){return'<i data-lucide="'+n+'"></i>'}
function coords(){return{lat:Number(localStorage.getItem('dronehub_lat'))||-22.9068,lon:Number(localStorage.getItem('dronehub_lon'))||-43.1729}}
function dist(a,b,c,d){var p=Math.PI/180,x=(c-a)*p,y=(d-b)*p*Math.cos((a+c)*p/2);return 6371*Math.sqrt(x*x+y*y)}
function station(){var c=coords();return STATIONS.slice().sort(function(a,b){return dist(c.lat,c.lon,a[2],a[3])-dist(c.lat,c.lon,b[2],b[3])})[0]}
function card(title,body){return'<article class="fc-live-card"><div class="fc-live-title">'+icon('radio')+'<span>'+title+'</span></div>'+body+'</article>'}
function pickRaw(value,type){
  if(value==null)return'';
  if(typeof value==='string')return value;
  if(Array.isArray(value)){for(var i=0;i<value.length;i++){var found=pickRaw(value[i],type);if(found)return found}return''}
  var keys=type==='metar'?['mens','message','metar','raw','texto','data']:['mens','message','taf','raw','texto','data'];
  for(var k=0;k<keys.length;k++){if(value[keys[k]]!=null){var x=pickRaw(value[keys[k]],type);if(x)return x}}
  var nested=['data','result','results','items','mensagens'];
  for(var n=0;n<nested.length;n++){if(value[nested[n]]!=null){var y=pickRaw(value[nested[n]],type);if(y)return y}}
  return'';
}
function renderLoading(st){var host=el('lm');if(!host)return;host.innerHTML=card('METAR e TAF · '+st[0],'<div class="fc-live-meta"><span>'+esc(st[1])+'</span><span>Consultando REDEMET...</span></div><div class="fc-live-raw">Aguardando dados oficiais do DECEA.</div><div class="fc-source">Fonte: REDEMET/DECEA</div>')}
function renderError(st,message){var host=el('lm');if(!host)return;host.innerHTML=card('METAR e TAF · '+st[0],'<div class="fc-live-meta"><span>'+esc(st[1])+'</span><span>Integração indisponível</span></div><div class="fc-live-raw">'+esc(message)+'</div><div class="fc-source">Confirme a publicação do arquivo api/operations-worker.js no Worker dronehub-operations e o secret REDEMET_API_KEY.</div>');if(window.lucide)window.lucide.createIcons()}
function load(){var host=el('lm');if(!host)return false;var st=station();renderLoading(st);fetch(OPERATIONS_URL+'/aviation/briefing?icao='+encodeURIComponent(st[0]),{headers:{Accept:'application/json'}}).then(function(r){return r.json().then(function(data){if(!r.ok)throw Error(data.error||('HTTP '+r.status));return data})}).then(function(data){var metar=pickRaw(data.metar,'metar')||'Sem mensagem METAR disponível no momento.',taf=pickRaw(data.taf,'taf')||'Sem mensagem TAF disponível no momento.',c=coords(),km=Math.round(dist(c.lat,c.lon,st[2],st[3]));host.innerHTML=card('METAR e TAF · '+st[0],'<div class="fc-live-meta"><span>'+esc(st[1])+'</span><span>'+km+' km</span><span>REDEMET oficial</span></div><div class="fc-live-raw">METAR\n'+esc(metar)+'\n\nTAF\n'+esc(taf)+'</div><div class="fc-source">Fonte: REDEMET/DECEA · atualizado '+new Date(data.fetchedAt||Date.now()).toLocaleString('pt-BR')+'</div>');if(window.lucide)window.lucide.createIcons()}).catch(function(err){renderError(st,err.message||'Não foi possível consultar a REDEMET.')});return true}
function start(){var tries=0;function wait(){if(load())return;if(++tries<40)setTimeout(wait,250)}wait();window.addEventListener('dronehub:mission-location-change',load)}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
}());