(function(){
  function ready(fn){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();}
  function currentUser(){
    var session=JSON.parse(localStorage.getItem('dronehub_user')||'null');
    return (session&&(session.id||session.email))||window.uid||'local';
  }
  function aircraft(){return typeof getAircraft==='function'?getAircraft(currentUser()):[];}
  function batteries(){return typeof getBatteries==='function'?getBatteries(currentUser()):[];}
  function escapeHtml(value){var e=document.createElement('span');e.textContent=value||'';return e.innerHTML;}
  function render(){
    var root=document.getElementById('fleetHealth');if(!root)return;
    var a=aircraft(),data=batteries(),cycles=data.map(function(x){return Number(x.cycles)||0;}),max=cycles.length?Math.max.apply(Math,cycles):0;
    var health=a.length?Math.max(0,100-Math.max(0,max-80)/3):0;
    root.querySelector('#fleetScore').textContent=a.length?Math.round(health)+'%':'—';
    root.querySelector('#fleetStatus').textContent=!a.length?'Cadastre uma aeronave':max<150?'Saudável':max<250?'Acompanhar':'Atenção';
    root.querySelector('#fleetAircraft').textContent=a.length;root.querySelector('#fleetBatteries').textContent=data.length;root.querySelector('#fleetCycles').textContent=max?max+' ciclos':'—';
    var select=root.querySelector('#fleetAircraftSelect');
    select.innerHTML=a.length?a.map(function(x){return '<option value="'+escapeHtml(x.id)+'">'+escapeHtml(((x.marca||'')+' '+(x.modelo||'')).trim())+'</option>';}).join(''):'<option value="">Cadastre uma aeronave primeiro</option>';
    Array.from(root.querySelectorAll('.fleet-health__form input,.fleet-health__form button')).forEach(function(el){el.disabled=!a.length;});
    root.querySelector('#fleetEmpty').hidden=!!a.length;
    var list=root.querySelector('#fleetBatteryList');
    list.innerHTML=data.length?data.map(function(b){var ac=a.find(function(x){return String(x.id)===String(b.aircraftId);});return '<div class="row"><div class="row-info"><strong>'+escapeHtml(b.name||'Bateria')+'</strong><span>'+escapeHtml(ac?((ac.marca||'')+' '+(ac.modelo||'')).trim():'Aeronave removida')+' · '+(Number(b.cycles)||0)+' ciclos'+(b.firmware?' · '+escapeHtml(b.firmware):'')+'</span></div><div class="row-actions"><button type="button" class="action-btn edit" data-edit="'+escapeHtml(b.id)+'">Atualizar ciclos</button><button type="button" class="action-btn delete" data-delete="'+escapeHtml(b.id)+'">Excluir</button></div></div>';}).join(''):'<p class="fleet-health__empty">Nenhuma bateria cadastrada.</p>';
    list.querySelectorAll('[data-delete]').forEach(function(btn){btn.onclick=function(){if(!confirm('Excluir esta bateria?'))return;deleteBattery(currentUser(),btn.dataset.delete);render();};});
    list.querySelectorAll('[data-edit]').forEach(function(btn){btn.onclick=function(){var b=batteries().find(function(x){return String(x.id)===String(btn.dataset.edit);});if(!b)return;var value=prompt('Quantidade atual de ciclos:',b.cycles||0);if(value===null)return;b.cycles=Math.max(0,Number(value)||0);b.updatedAt=new Date().toISOString();saveBattery(currentUser(),b);render();};});
  }
  ready(function(){
    if(!window.isPro)return;var target=document.querySelector('.main > .card');if(!target)return;
    var section=document.createElement('section');section.id='fleetHealth';section.className='fleet-health';
    section.innerHTML='<div class="fleet-health__top"><div><div class="fleet-health__eyebrow">Saúde da frota</div><h3>Prontidão de aeronaves e baterias</h3><p>Cadastre cada bateria separadamente e acompanhe os ciclos de uso em todos os dispositivos.</p></div><div class="fleet-health__score" id="fleetScore">—<small id="fleetStatus">Carregando</small></div></div><div class="fleet-health__grid"><div class="fleet-health__metric"><span>Aeronaves</span><b id="fleetAircraft">0</b></div><div class="fleet-health__metric"><span>Baterias registradas</span><b id="fleetBatteries">0</b></div><div class="fleet-health__metric"><span>Maior ciclo</span><b id="fleetCycles">—</b></div></div><p id="fleetEmpty" class="fleet-health__notice">Cadastre uma aeronave acima para liberar o registro de baterias.</p><form class="fleet-health__form" id="fleetForm"><select id="fleetAircraftSelect" aria-label="Aeronave"></select><input id="fleetBatteryName" required type="text" placeholder="Identificação (ex.: Bateria 1)"><input id="fleetCyclesInput" required min="0" type="number" placeholder="Ciclos atuais"><input id="fleetFirmware" type="text" placeholder="Firmware / observação"><button class="btn btn-primary" type="submit">Adicionar bateria</button></form><div id="fleetBatteryList"></div>';
    target.insertAdjacentElement('afterend',section);render();
    section.querySelector('#fleetForm').addEventListener('submit',function(e){e.preventDefault();var aircraftId=section.querySelector('#fleetAircraftSelect').value;if(!aircraftId){alert('Cadastre uma aeronave antes de adicionar baterias.');return;}saveBattery(currentUser(),{id:Date.now().toString(),aircraftId:aircraftId,name:section.querySelector('#fleetBatteryName').value.trim(),cycles:Math.max(0,Number(section.querySelector('#fleetCyclesInput').value)||0),firmware:section.querySelector('#fleetFirmware').value.trim(),registeredAt:new Date().toISOString()});e.target.reset();render();});
    window.addEventListener('dronehub:aircraft-updated',render);
    window.addEventListener('dronehub:cloud-ready',render);
  });
}());
