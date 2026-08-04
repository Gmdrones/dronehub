(function () {
  'use strict';

  var sourceSelect = null;
  var applying = false;

  function textOf(el) {
    return String(el && el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function findSuiteCard() {
    var nodes = Array.from(document.querySelectorAll('section, article, div'));
    var matches = nodes.filter(function (el) {
      var text = textOf(el);
      return text.indexOf('DRONE HUB · OPERATIONAL SUITE') !== -1 ||
        text.indexOf('Central inteligente de voo') !== -1;
    });
    matches.sort(function (a, b) { return textOf(a).length - textOf(b).length; });
    return matches[0] || null;
  }

  function restoreSuiteBanner() {
    var command = document.getElementById('flightCommand');
    if (!command) return;

    var banner = findSuiteCard();
    if (!banner) {
      banner = document.createElement('section');
      banner.innerHTML = '<div><span>DRONE HUB · OPERATIONAL SUITE</span><h2>Central inteligente de voo</h2><p>Clima, aeronave e contexto operacional para decisões mais seguras.</p></div><b>SISTEMA ATIVO</b>';
    }

    banner.classList.add('fc-suite-banner');
    banner.style.display = '';
    banner.style.position = 'relative';
    banner.style.inset = 'auto';
    banner.style.transform = 'none';
    banner.style.width = '100%';
    banner.style.maxWidth = 'none';
    banner.style.zIndex = '1';

    var head = command.querySelector('.fc-head');
    var summary = document.getElementById('fcSummary');
    if (banner.parentElement !== command) command.insertBefore(banner, summary || command.firstChild);
    else if (head && banner.previousElementSibling !== head) command.insertBefore(banner, summary || head.nextSibling);
  }

  function removeSprayingCard() {
    var grid = document.getElementById('fcMissions');
    if (!grid) return;
    Array.from(grid.children).forEach(function (card) {
      if (/Pulveriza[cç][aã]o/i.test(textOf(card))) card.remove();
    });
    grid.classList.add('fc-mission-grid--four');
  }

  function syncProxyOptions(proxy) {
    sourceSelect = document.getElementById('droneSelect');
    if (!sourceSelect || !proxy) return;

    var signature = Array.from(sourceSelect.options).map(function (o) {
      return [o.value, o.text, o.dataset.model || '', o.dataset.limit || ''].join('|');
    }).join('||');

    if (proxy.dataset.signature !== signature) {
      proxy.innerHTML = '';
      Array.from(sourceSelect.options).forEach(function (option) {
        proxy.appendChild(option.cloneNode(true));
      });
      proxy.dataset.signature = signature;
    }

    proxy.value = sourceSelect.value;
    proxy.disabled = sourceSelect.options.length < 2;
  }

  function restoreAircraftSelector() {
    var grid = document.getElementById('fcMissions');
    if (!grid || !grid.firstElementChild) return;

    sourceSelect = document.getElementById('droneSelect');
    var aircraftCard = grid.firstElementChild;
    var holder = aircraftCard.querySelector('.fc-aircraft-selector');

    if (!holder) {
      holder = document.createElement('div');
      holder.className = 'fc-aircraft-selector';
      holder.innerHTML = '<label for="fcAircraftSelect">Aeronave da operação</label><select id="fcAircraftSelect"><option>Carregando aeronaves...</option></select><small>Selecione uma aeronave da sua lista cadastrada.</small>';
      var title = aircraftCard.querySelector('.fc-card-title');
      if (title) title.insertAdjacentElement('afterend', holder);
      else aircraftCard.prepend(holder);
    }

    var proxy = document.getElementById('fcAircraftSelect');
    syncProxyOptions(proxy);

    if (proxy && !proxy.dataset.bound) {
      proxy.dataset.bound = 'true';
      proxy.addEventListener('change', function () {
        sourceSelect = document.getElementById('droneSelect');
        if (!sourceSelect) return;
        sourceSelect.value = proxy.value;
        sourceSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
  }

  function applyFixes() {
    if (applying) return;
    applying = true;
    try {
      restoreSuiteBanner();
      removeSprayingCard();
      restoreAircraftSelector();
    } finally {
      applying = false;
    }
  }

  function injectStyles() {
    if (document.getElementById('flightCommandLayoutFixStyles')) return;
    var style = document.createElement('style');
    style.id = 'flightCommandLayoutFixStyles';
    style.textContent = [
      '#flightCommand{position:relative!important}',
      '.fc-suite-banner{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:24px!important;min-height:116px!important;margin:0!important;padding:24px 28px!important;border-radius:16px!important;background:linear-gradient(110deg,rgba(9,27,43,.98),rgba(5,16,28,.98))!important;border:1px solid rgba(24,200,255,.26)!important;box-shadow:0 18px 44px rgba(0,0,0,.24)!important;overflow:hidden!important}',
      '.fc-suite-banner:after{content:"";position:absolute;right:-70px;top:-110px;width:330px;height:330px;border-radius:50%;border:1px solid rgba(24,200,255,.09);box-shadow:0 0 0 44px rgba(24,200,255,.025),0 0 0 88px rgba(24,200,255,.018);pointer-events:none}',
      '.fc-suite-banner span{display:block;color:#18c8ff;font-size:.62rem;font-weight:800;letter-spacing:.14em}',
      '.fc-suite-banner h2{margin:7px 0 5px;font:700 1.8rem var(--title);letter-spacing:-.04em;color:#f4f8fc}',
      '.fc-suite-banner p{margin:0;color:#9bacc0;font-size:.8rem}',
      '.fc-suite-banner>b{position:relative;z-index:2;color:#7cf4c1;font-size:.64rem;letter-spacing:.1em}',
      '.fc-mission-grid.fc-mission-grid--four{grid-template-columns:1.2fr repeat(3,minmax(0,1fr))!important}',
      '.fc-aircraft-selector{margin:11px 0 13px;padding:12px;border-radius:11px;background:rgba(3,12,21,.72);border:1px solid rgba(24,200,255,.24)}',
      '.fc-aircraft-selector label{display:block;margin-bottom:7px;color:#18c8ff;font-size:.62rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}',
      '.fc-aircraft-selector select{display:block;width:100%;height:42px;padding:0 11px;border-radius:9px;background:#07131f;border:1px solid rgba(105,168,210,.3);color:#f3f8fc;font:600 .76rem Inter,sans-serif;outline:none}',
      '.fc-aircraft-selector select:focus{border-color:#18c8ff;box-shadow:0 0 0 3px rgba(24,200,255,.1)}',
      '.fc-aircraft-selector small{display:block;margin-top:7px;color:#8194aa;font-size:.62rem;line-height:1.4}',
      '@media(max-width:1100px){.fc-mission-grid.fc-mission-grid--four{grid-template-columns:repeat(2,minmax(0,1fr))!important}.fc-suite-banner{align-items:flex-start!important}}',
      '@media(max-width:640px){.fc-mission-grid.fc-mission-grid--four{grid-template-columns:1fr!important}.fc-suite-banner{display:block!important;padding:20px!important}.fc-suite-banner>b{display:block;margin-top:14px}}'
    ].join('');
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();
    applyFixes();

    var observer = new MutationObserver(function () {
      window.requestAnimationFrame(applyFixes);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('change', function (event) {
      if (event.target && event.target.id === 'droneSelect') window.setTimeout(applyFixes, 0);
    });
    window.addEventListener('dronehub:weather-ready', function () {
      window.setTimeout(applyFixes, 0);
    });
    window.addEventListener('dronehub:cloud-ready', function () {
      window.setTimeout(applyFixes, 0);
    });
  });
}());
