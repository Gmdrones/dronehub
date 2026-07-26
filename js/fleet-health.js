(function(){
  function ready(fn){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();}
  function read(){try{return JSON.parse(localStorage.getItem('dronehub_fleet_health')||'[]');}catch(e){return [];}}
  function write(value){localStorage.setItem('dronehub_fleet_health',JSON.stringify(value));}
  function currentUser(){return window.uid||'local';}
  function aircraft(){return typeof getAircraft==='function'?getAircraft(window.uid):[];}
  function escapeHtml(value){var e=document.createElement('span');e.textContent=value||'';return e.innerHTML;}
  function userBatteries(){return read().filter(function(x){return x.userId===currentUser();});}
  function render(){
    var root=document.getElementById('fleetHealth');if(!root)return;
    var a=aircraft(),data=userBatteries(),cycles=data.map(function(x){return Number(x.cycles)||0;}),max=cycles.length?Math.max.apply(Math,cycles):0;
    var health=a.length?Math.max(0,100-Math.max(0,max-80)/3):0;
    root.querySelector('#fleetScore').textContent=a.length?Math.round(health)+'%':'—';
    root.querySelector('#fleetStatus').textContent=!a.length?'Cadastre uma aeronave':max<150?'Saudável':max<250?'Acompanhar':'Atenção';
    root.querySelector('#fleetAircraft').textContent=a.length;root.querySelector('#fleetBatteries').textContent=data.length;root.querySelector('#fleetCycles').textContent=max?max+' ciclos':'—';
    var select=root.querySelector('#fleetAircraftSelect');select.innerHTML=a.length?a.map(function(x){return '<option value="'+escapeHtml(x.id)+'">'+escapeHtml(((x.marca||'')+' '+(x.modelo||'')).trim())+'</option>';}).join(''):'<option value="">Cadastre uma aeronave primeiro</option>';
    var list=root.querySelector('#fleetBatteryList');
    list.innerHTML=data.length?data.map(function(b){var ac=a.find(function(x){return x.id===b.aircraftId;});return '<div class="row"><div class="row-info"><strong>'+escapeHtml(b.name||'Bateria')+'</strong><span>'+escapeHtml(ac?((ac.marca||'')+' '+(ac.modelo||'')).trim():'Aeronave removida')+' · '+(Number(b.cycles)||0)+' ciclos'+(b.firmware?' · '+escapeHtml(b.firmware):'')+'</span></div><div class="row-actions"><button type="button" class="action-btn edit" data-edit="'+escapeHtml(b.id)+'">Atualizar ciclos</button><button type="button" class="action-btn delete" data-delete="'+escapeHtml(b.id)+'">Excluir</button></div></div>';}).join(''):'<p style="color:var(--text3);font-size:.85rem">Nenhuma bateria cadastrada.</p>';
    list.querySelectorAll('[data-delete]').forEach(function(btn){btn.onclick=function(){if(!confirm('Excluir esta bateria?'))return;write(read().filter(function(x){return !(x.userId===currentUser()&&x.id===btn.dataset.delete);}));render();};});
    list.querySelectorAll('[data-edit]').forEach(function(btn){btn.onclick=function(){var all=read(),b=all.find(function(x){return x.userId===currentUser()&&x.id===btn.dataset.edit;});if(!b)return;var value=prompt('Quantidade atual de ciclos:',b.cycles||0);if(value===null)return;b.cycles=Math.max(0,Number(value)||0);b.updatedAt=new Date().toISOString();write(all);render();};});
  }
  ready(function(){
    if(!window.isPro)return;var target=document.querySelector('.main > .card');if(!target)return;
    var section=document.createElement('section');section.id='fleetHealth';section.className='fleet-health';
    section.innerHTML='<div class="fleet-health__top"><div><div class="fleet-health__eyebrow">Saúde da frota</div><h3>Prontidão de aeronaves e baterias</h3><p>Cadastre cada bateria separadamente e acompanhe os ciclos de uso.</p></div><div class="fleet-health__score" id="fleetScore">—<small id="fleetStatus">Carregando</small></div></div><div class="fleet-health__grid"><div class="fleet-health__metric"><span>Aeronaves</span><b id="fleetAircraft">0</b></div><div class="fleet-health__metric"><span>Baterias registradas</span><b id="fleetBatteries">0</b></div><div class="fleet-health__metric"><span>Maior ciclo</span><b id="fleetCycles">—</b></div></div><form class="fleet-health__form" id="fleetForm"><select id="fleetAircraftSelect" aria-label="Aeronave"></select><input id="fleetBatteryName" required type="text" placeholder="Identificação da bateria (ex.: Bateria 1)"><input id="fleetCyclesInput" required min="0" type="number" placeholder="Ciclos atuais"><input id="fleetFirmware" type="text" placeholder="Firmware / observação"><button class="btn btn-primary" type="submit">Adicionar bateria</button></form><div id="fleetBatteryList" style="margin-top:18px"></div>';
    target.insertAdjacentElement('afterend',section);render();
    section.querySelector('#fleetForm').addEventListener('submit',function(e){e.preventDefault();var aircraftId=section.querySelector('#fleetAircraftSelect').value;if(!aircraftId){alert('Cadastre uma aeronave antes de adicionar baterias.');return;}var data=read();data.push({id:Date.now().toString(),userId:currentUser(),aircraftId:aircraftId,name:section.querySelector('#fleetBatteryName').value.trim(),cycles:Math.max(0,Number(section.querySelector('#fleetCyclesInput').value)||0),firmware:section.querySelector('#fleetFirmware').value.trim(),registeredAt:new Date().toISOString()});write(data);e.target.reset();render();});
  });
}());
