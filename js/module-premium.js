(function(){
  function ready(fn){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();}
  var titles={perfil:['Perfil do piloto','Sua identidade operacional, certificações e documentos em um único lugar.'],aeronaves:['Frota e aeronaves','Informações técnicas, homologação e prontidão do seu equipamento.'],missoes:['Planejamento de missões','Planeje cada operação com local, data, protocolo e rastreabilidade.'],documentos:['Documentos profissionais','Crie, organize e apresente documentos com padrão de operação premium.'],financeiro:['Controle financeiro','Acompanhe receitas, despesas e resultados da sua operação.'],fiscalizacao:['Modo fiscalização','Organize uma credencial temporária para apresentação segura de documentos.'],central:['Central inteligente de voo','Clima, aeronave e contexto operacional para decisões mais seguras.']};
  function key(){var path=location.pathname.split('/').pop().replace('.html','');return path==='central-voo'?'central':path;}
  function loadScript(id,src){if(document.getElementById(id))return;var script=document.createElement('script');script.id=id;script.src=src;script.defer=true;document.head.appendChild(script);}
  function loadLiveLayers(){
    loadScript('flightLiveLayersScript','js/flight-live-layers.js?v=20260804-live4');
    loadScript('esriSatelliteViewScript','js/esri-satellite-view.js?v=20260804-esri3');
    loadScript('centralOperationalMapScript','js/central-operational-map.js?v=20260804-map3');
    loadScript('redemetLiveBriefingScript','js/redemet-live-briefing.js?v=20260804-redemet2');
  }
  function centralLayout(main){
    main.classList.add('module-premium','flight-command-page');
    if(!document.getElementById('flightCommandCriticalLayout')){
      var style=document.createElement('style');
      style.id='flightCommandCriticalLayout';
      style.textContent=[
        '.dash-wrap .main.flight-deck.flight-command-page{grid-template-columns:minmax(0,1fr)!important;display:grid!important;width:calc(100% - 240px)!important;max-width:none!important;align-content:start!important}',
        '.main.flight-command-page>#flightCommand{grid-column:1/-1!important;width:100%!important;max-width:none!important;min-width:0!important;margin:0!important}',
        '.main.flight-command-page>.module-hero{display:none!important}',
        '.fc-suite-banner{position:relative!important;inset:auto!important;grid-column:1/-1!important;display:flex!important;align-items:center!important;justify-content:space-between!important;min-height:138px!important;width:100%!important;margin:0!important;padding:26px 30px!important;overflow:hidden!important;border:1px solid rgba(22,198,255,.24)!important;border-radius:20px!important;background:linear-gradient(105deg,rgba(12,29,45,.98),rgba(10,18,29,.9) 58%,rgba(6,11,18,.82))!important;box-shadow:0 20px 52px rgba(0,0,0,.22)!important}',
        '.fc-suite-banner:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 0 63%,rgba(22,198,255,.08)),repeating-linear-gradient(90deg,transparent 0 55px,rgba(77,215,255,.045) 56px);pointer-events:none}',
        '.fc-suite-banner>div,.fc-suite-banner>b{position:relative;z-index:1}',
        '.fc-suite-banner span{display:block;margin-bottom:8px;color:#5fe0ff;font-size:.63rem;font-weight:800;letter-spacing:.16em}',
        '.fc-suite-banner h2{margin:0;color:#f5f8fc;font:700 clamp(1.6rem,3vw,2.25rem)/1.05 "Space Grotesk",sans-serif;letter-spacing:-.055em}',
        '.fc-suite-banner p{margin:10px 0 0;color:#a7b3c5;font-size:.86rem;line-height:1.55}',
        '.fc-suite-banner>b{align-self:flex-start;display:flex;align-items:center;gap:8px;color:#8dc8d7;font:800 .61rem Inter,sans-serif;letter-spacing:.1em}',
        '.fc-suite-banner>b:before{content:"";width:8px;height:8px;border-radius:50%;background:#35d39a;box-shadow:0 0 13px #35d39a}',
        '.fc-mission-grid.fc-mission-grid--four{grid-template-columns:repeat(4,minmax(0,1fr))!important}',
        '.fc-aircraft-selector{display:block!important;margin:12px 0 14px;padding:12px;border-radius:12px;background:rgba(3,12,21,.72);border:1px solid rgba(24,200,255,.22)}',
        '.fc-aircraft-selector select{display:block!important;width:100%!important;min-height:42px!important;color:#f3f8fc!important;background:#07131f!important;border:1px solid rgba(105,168,210,.28)!important;border-radius:9px!important}',
        '@media(max-width:768px){.dash-wrap .main.flight-deck.flight-command-page{width:100%!important}.fc-suite-banner{display:block!important;padding:22px 20px!important}.fc-suite-banner>b{margin-bottom:14px}.fc-mission-grid.fc-mission-grid--four{grid-template-columns:1fr!important}}'
      ].join('');
      document.head.appendChild(style);
    }
    Array.from(main.querySelectorAll('.module-hero')).forEach(function(hero){hero.remove();});
    loadLiveLayers();
  }
  ready(function(){
    var main=document.querySelector('.main');
    if(!main)return;
    var current=key();
    if(current==='central'){
      centralLayout(main);
      return;
    }
    if(main.querySelector('.module-hero'))return;
    var data=titles[current]||['Centro operacional','Gestão profissional para operações com drones.'];
    main.classList.add('module-premium');
    var hero=document.createElement('section');
    hero.className='module-hero';
    hero.innerHTML='<div class="module-hero__copy"><span class="module-hero__eyebrow">DRONE HUB · OPERATIONAL SUITE</span><h1>'+data[0]+'</h1><p>'+data[1]+'</p></div><div class="module-hero__signal"><i></i>SISTEMA ATIVO</div>';
    var title=main.querySelector('.page-title');
    if(title)title.insertAdjacentElement('beforebegin',hero);else main.insertAdjacentElement('afterbegin',hero);
  });
}());