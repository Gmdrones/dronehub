(function(){
  function ready(fn){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();}
  function count(key){try{return JSON.parse(localStorage.getItem(key)||'[]').filter(function(x){return x.userId===(window.uid||'');}).length;}catch(e){return 0;}}
  ready(function(){
    var hero=document.querySelector('.hero');if(!hero||document.getElementById('dashboardCommand'))return;
    var pro=Boolean(window.isPro),aircraft=count('dronehub_aircraft'),missions=count('dronehub_missoes');
    var section=document.createElement('section');section.id='dashboardCommand';section.className='dashboard-command';
    var action=aircraft?'Planeje a próxima missão com clima e risco reais.':'Cadastre sua aeronave para avaliar condições reais de voo.';
    section.innerHTML='<div class="command-surface"><div class="command-cell"><span class="command-eyebrow">CENTRAL DE COMANDO '+(pro?'PRO':'FREE')+'</span><h2>'+ (pro?'Operação pronta para decidir':'Sua próxima operação começa aqui') +'</h2><p>'+action+'</p><a class="command-link" href="'+(aircraft?'central-voo.html':'aeronaves.html')+'">'+(aircraft?'Abrir Central de Voo →':'Cadastrar aeronave →')+'</a></div><div class="command-cell"><span class="command-eyebrow">PRONTIDÃO</span><div class="command-stat"><b>'+aircraft+'</b> aeronave'+(aircraft===1?'':'s')+'</div><p>'+ (aircraft?'Aeronave disponível para avaliação operacional.':'Ainda não há equipamento no seu perfil.') +'</p></div><div class="command-cell"><span class="command-eyebrow">MISSÕES</span><div class="command-stat"><b>'+missions+'</b> no histórico</div><p>'+ (pro?'Diário, checklist e relatório pós-voo integrados.':'Organize sua primeira missão e acompanhe sua evolução.') +'</p></div></div>';
    hero.insertAdjacentElement('afterend',section);
    var sub=document.getElementById('welcomeSub');if(sub)sub.textContent=pro?'Visão operacional, segurança e inteligência para sua frota.':'Organize sua operação com clareza desde o primeiro voo.';
  });
}());
