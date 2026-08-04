(function(){
'use strict';
var timer=null,recoveryRunning=false;
var OPS=(window.DRONEHUB_OPERATIONS_URL||'https://dronehub-operations.primesecureconsultoria.workers.dev').replace(/\/$/,'');
function el(id){return document.getElementById(id)}
function coords(){return{lat:Number(localStorage.getItem('dronehub_lat'))||-22.9068,lon:Number(localStorage.getItem('dronehub_lon'))||-43.1729}}
function clean(){
  var duplicate=el('ls');
  if(duplicate)duplicate.remove();
  var grid=document.querySelector('#fcLiveLayers .fc-live-grid');
  if(grid)grid.style.gridTemplateColumns='repeat(2,minmax(0,1fr))';
  var host=el('fcOpsMap');
  if(host){
    host.style.display='block';host.style.width='100%';host.style.padding='0';host.style.overflow='hidden';
    var real=el('centralLeafletMap');
    if(real){real.style.width='100%';real.style.height='390px'}
  }
  document.querySelectorAll('#flightCommand #centralLeafletMap').forEach(function(node,i){if(i>0)node.remove()});
}
function unavailable(message){
  var main=document.querySelector('.main');
  if(!main||el('flightCommand'))return;
  var root=document.createElement('section');
  root.id='flightCommand';root.className='fc-panel';
  root.style.cssText='margin-bottom:20px;padding:24px;border:1px solid rgba(22,200,255,.22);border-radius:16px;background:#091725;color:#eaf7ff';
  root.innerHTML='<strong style="display:block;font-size:1.05rem">Central de Voo temporariamente indisponível</strong><span style="display:block;margin-top:8px;color:#91a8ba">'+message+'</span>';
  main.insertBefore(root,main.firstChild);
}
function recover(){
  if(el('flightCommand')||recoveryRunning)return;
  recoveryRunning=true;
  var c=coords();
  fetch(OPS+'/weather?lat='+encodeURIComponent(c.lat)+'&lon='+encodeURIComponent(c.lon),{headers:{Accept:'application/json'}})
    .then(function(r){return r.json().then(function(data){if(!r.ok)throw Error(data.error||('HTTP '+r.status));return data})})
    .then(function(data){
      window.DroneHubFlightWeather=data;
      window.dispatchEvent(new CustomEvent('dronehub:weather-ready',{detail:data}));
      setTimeout(function(){
        recoveryRunning=false;
        if(!el('flightCommand'))window.dispatchEvent(new CustomEvent('dronehub:weather-ready',{detail:data}));
        setTimeout(clean,120);
      },180);
    })
    .catch(function(err){recoveryRunning=false;unavailable('Dados meteorológicos indisponíveis. '+String(err&&err.message||err));});
}
function schedule(){clearTimeout(timer);timer=setTimeout(function(){clean();if(!el('flightCommand'))recover()},120)}
function start(){
  if(!el('centralSingleMapCss')){
    var style=document.createElement('style');style.id='centralSingleMapCss';style.textContent='#fcLiveLayers #ls{display:none!important}#fcLiveLayers .fc-live-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}#fcOpsMap{display:block!important;width:100%!important;padding:0!important;overflow:hidden!important}#centralLeafletMap{width:100%!important;height:390px!important}@media(max-width:760px){#fcLiveLayers .fc-live-grid{grid-template-columns:1fr!important}#centralLeafletMap{height:310px!important}}';document.head.appendChild(style);
  }
  setTimeout(recover,250);
  clean();
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',function(e){if(e.target&&['droneSelect','fcAircraftSelect','flightDate','missionSelect'].indexOf(e.target.id)>=0){schedule();setTimeout(function(){window.dispatchEvent(new Event('dronehub:mission-location-change'))},180)}});
  window.addEventListener('error',function(){setTimeout(recover,100)});
  window.addEventListener('unhandledrejection',function(){setTimeout(recover,100)});
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
}());