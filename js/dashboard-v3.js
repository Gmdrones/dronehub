(function(){
  function ready(fn){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();}
  function count(key){try{return JSON.parse(localStorage.getItem(key)||'[]').filter(function(x){return x.userId===(window.uid||'');}).length;}catch(e){return 0;}}
  ready(async function(){
    var hero=document.querySelector('.hero');if(!hero||document.getElementById('dashboardCommand'))return;
    // Aguarda o plano oficial antes de montar o painel. Evita mostrar o convite
    // do Pro a quem já possui uma assinatura ou cortesia ativa.
    if(typeof syncCurrentEntitlement==='function'){try{await syncCurrentEntitlement();}catch(e){}}
    var account=(typeof getCurrentUser==='function'&&getCurrentUser())||{};
    var pro=account.plan==='pro'||account.role==='admin',aircraft=count('dronehub_aircraft'),missions=count('dronehub_missoes');
    if(!pro){
      var content=document.querySelector('.content');
      if(content){
        content.innerHTML='<section class="free-flight-deck">'
          +'<div class="free-deck-orbit"></div><div class="free-deck-copy"><span class="free-deck-eyebrow">DRONE HUB · PLANO FREE</span><h2>Organize sua base.<br><em>Evolua quando precisar.</em></h2><p>Mantenha seu perfil e sua primeira aeronave organizados em um painel claro.</p><div class="free-deck-actions"><a href="aeronaves.html" class="free-deck-primary">'+(aircraft?'Gerenciar aeronave':'Cadastrar aeronave')+'</a><a href="precos.html" class="free-deck-ghost">Conhecer o Pro</a></div></div>'
          +'<div class="free-readiness"><span class="free-readiness-label">PRONTIDÃO DE VOO</span><div class="free-readiness-ring"><b id="freeReadiness">'+(aircraft?67:34)+'</b><small>%</small></div><p>'+ (aircraft?'Aeronave cadastrada. Complete o perfil e consulte o local da operação.':'Cadastre sua aeronave para receber uma avaliação de voo alinhada ao seu equipamento.')+'</p></div>'
          +'</section>'
          +'<section class="free-essentials"><a class="free-essential" href="perfil.html"><span>01</span><div><small>CADASTRO DO PILOTO</small><strong>Perfil e certificações</strong><p>Centralize seus dados de operação.</p></div><b>→</b></a><a class="free-essential" href="aeronaves.html"><span>02</span><div><small>SUA AERONAVE</small><strong>'+aircraft+'/1 cadastrada</strong><p>Cadastre seu primeiro drone.</p></div><b>→</b></a><a class="free-essential free-essential--focus" href="precos.html"><span>03</span><div><small>RECURSO PRO</small><strong>Central de Voo</strong><p>Clima, previsão e risco operacional exclusivos do Pro.</p></div><b>→</b></a></section>'
          +'<section class="free-pro-tease"><div><span class="free-deck-eyebrow">QUANDO SUA OPERAÇÃO CRESCER</span><h3>O Pro transforma planejamento em uma central operacional completa.</h3></div><a href="precos.html">Conhecer o Pro</a></section>';
      }
      var subFree=document.getElementById('welcomeSub');if(subFree)subFree.textContent='Uma base operacional simples, bonita e pronta para o seu primeiro voo.';
      return;
    }
    var section=document.createElement('section');section.id='dashboardCommand';section.className='dashboard-command';
    var action=aircraft?'Planeje a próxima missão com clima e risco reais.':'Cadastre sua aeronave para avaliar condições reais de voo.';
    section.innerHTML='<div class="command-surface"><div class="command-cell"><span class="command-eyebrow">CENTRAL DE COMANDO '+(pro?'PRO':'FREE')+'</span><h2>'+ (pro?'Planeje sua próxima operação':'Consulte as condições do seu voo') +'</h2><p>'+action+'</p><a class="command-link" href="'+(aircraft?'central-voo.html':'aeronaves.html')+'">'+(aircraft?'Abrir Central de Voo →':'Cadastrar aeronave →')+'</a></div><div class="command-cell"><span class="command-eyebrow">PRONTIDÃO</span><div class="command-stat"><b>'+aircraft+'</b> aeronave'+(aircraft===1?'':'s')+'</div><p>'+ (aircraft?'Aeronave disponível para avaliação operacional.':'Ainda não há equipamento no seu perfil.') +'</p></div><div class="command-cell"><span class="command-eyebrow">MISSÕES</span><div class="command-stat"><b>'+missions+'</b> no histórico</div><p>'+ (pro?'Diário, checklist e relatório pós-voo integrados.':'Organize sua primeira missão e acompanhe sua evolução.') +'</p></div></div>';
    hero.insertAdjacentElement('afterend',section);
    var telemetry=document.createElement('div');
    telemetry.className='hero-telemetry';
    telemetry.setAttribute('aria-label','Telemetria operacional');
    telemetry.innerHTML='<div class="telemetry-live"><i></i>LEITURA OPERACIONAL</div><div><small>LOCAL</small><b id="dashHudPlace">'+(localStorage.getItem('dronehub_location_name')||'Defina o local')+'</b></div><div><small>VENTO</small><b id="dashHudWind">Consulte a central</b></div><div><small>MISSÕES</small><b>'+missions+' no histórico</b></div><a href="central-voo.html">Abrir Flight Center <span>→</span></a>';
    hero.querySelector('.hero-c').appendChild(telemetry);
    window.setTimeout(function(){var source=document.getElementById('wVento'),wind=document.getElementById('dashHudWind');if(source&&wind&&source.textContent!=='--')wind.textContent=source.textContent;},1800);
    var sub=document.getElementById('welcomeSub');if(sub)sub.textContent=pro?'Visão operacional, segurança e inteligência para sua frota.':'Organize sua operação com clareza desde o primeiro voo.';
  });
}());
