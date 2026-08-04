(function(){
'use strict';
var timer=null;
function clean(){
  var duplicate=document.getElementById('ls');
  if(duplicate)duplicate.remove();
  var grid=document.querySelector('#fcLiveLayers .fc-live-grid');
  if(grid)grid.style.gridTemplateColumns='repeat(2,minmax(0,1fr))';
  var host=document.getElementById('fcOpsMap');
  if(host){
    host.style.display='block';host.style.width='100%';host.style.padding='0';host.style.overflow='hidden';
    var real=document.getElementById('centralLeafletMap');
    if(real){real.style.width='100%';real.style.height='390px'}
  }
  document.querySelectorAll('#flightCommand #centralLeafletMap').forEach(function(node,i){if(i>0)node.remove()});
}
function schedule(){clearTimeout(timer);timer=setTimeout(clean,100)}
function start(){
  var style=document.createElement('style');style.id='centralSingleMapCss';style.textContent='#fcLiveLayers #ls{display:none!important}#fcLiveLayers .fc-live-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}#fcOpsMap{display:block!important;width:100%!important;padding:0!important;overflow:hidden!important}#centralLeafletMap{width:100%!important;height:390px!important}@media(max-width:760px){#fcLiveLayers .fc-live-grid{grid-template-columns:1fr!important}#centralLeafletMap{height:310px!important}}';document.head.appendChild(style);
  clean();
  new MutationObserver(schedule).observe(document.getElementById('flightCommand')||document.body,{childList:true,subtree:true});
  document.addEventListener('change',function(e){if(e.target&&['droneSelect','fcAircraftSelect','flightDate','missionSelect'].indexOf(e.target.id)>=0){schedule();setTimeout(function(){window.dispatchEvent(new Event('dronehub:mission-location-change'))},180)}});
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
}());