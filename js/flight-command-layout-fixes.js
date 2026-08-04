(function () {
  'use strict';

  var aircraftSelect = null;
  var manualLimitWrap = null;
  var applying = false;

  function textOf(el) {
    return String(el && el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function removeOperationalSuiteOverlay() {
    var nodes = Array.from(document.querySelectorAll('section, article, div'));
    var matches = nodes.filter(function (el) {
      var text = textOf(el);
      return text.indexOf('DRONE HUB · OPERATIONAL SUITE') !== -1 &&
        text.indexOf('Central inteligente de voo') !== -1;
    });

    if (!matches.length) return;

    matches.sort(function (a, b) {
      return textOf(a).length - textOf(b).length;
    });

    var target = matches[0];
    if (target && target.id !== 'flightCommand') target.remove();
  }

  function removeSprayingCard() {
    var missionGrid = document.getElementById('fcMissions');
    if (!missionGrid) return;

    Array.from(missionGrid.children).forEach(function (card) {
      if (/Pulveriza[cç][aã]o/i.test(textOf(card))) card.remove();
    });

    missionGrid.classList.add('fc-mission-grid--four');
  }

  function captureAircraftControls() {
    if (!aircraftSelect) aircraftSelect = document.getElementById('droneSelect');
    if (!manualLimitWrap) manualLimitWrap = document.getElementById('manualLimitWrap');
  }

  function restoreAircraftSelector() {
    captureAircraftControls();
    if (!aircraftSelect) return;

    var missionGrid = document.getElementById('fcMissions');
    if (!missionGrid || !missionGrid.firstElementChild) return;

    var aircraftCard = missionGrid.firstElementChild;
    var holder = aircraftCard.querySelector('.fc-aircraft-selector');

    if (!holder) {
      holder = document.createElement('div');
      holder.className = 'fc-aircraft-selector';
      holder.innerHTML = '<label for="droneSelect">Aeronave da operação</label>';

      var title = aircraftCard.querySelector('.fc-card-title');
      if (title) title.insertAdjacentElement('afterend', holder);
      else aircraftCard.prepend(holder);
    }

    if (aircraftSelect.parentElement !== holder) holder.appendChild(aircraftSelect);
    aircraftSelect.disabled = false;
    aircraftSelect.removeAttribute('hidden');
    aircraftSelect.style.display = '';

    if (manualLimitWrap && aircraftSelect.value && manualLimitWrap.classList.contains('is-visible')) {
      if (manualLimitWrap.parentElement !== holder) holder.appendChild(manualLimitWrap);
    }
  }

  function applyFixes() {
    if (applying) return;
    applying = true;

    try {
      removeOperationalSuiteOverlay();
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
      '.fc-mission-grid.fc-mission-grid--four{grid-template-columns:repeat(4,minmax(0,1fr))!important}',
      '.fc-aircraft-selector{margin:12px 0 14px;padding:12px;border-radius:12px;background:rgba(3,12,21,.72);border:1px solid rgba(24,200,255,.22)}',
      '.fc-aircraft-selector label{display:block;margin-bottom:7px;color:#18c8ff;font-size:.64rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}',
      '.fc-aircraft-selector select{display:block!important;width:100%!important;height:42px!important;padding:0 12px!important;border-radius:9px!important;background:#07131f!important;border:1px solid rgba(105,168,210,.28)!important;color:#f3f8fc!important;font:600 .78rem Inter,sans-serif!important;outline:none!important}',
      '.fc-aircraft-selector select:focus{border-color:#18c8ff!important;box-shadow:0 0 0 3px rgba(24,200,255,.1)!important}',
      '.fc-aircraft-selector .manual-limit{margin-top:10px!important}',
      '@media(max-width:1100px){.fc-mission-grid.fc-mission-grid--four{grid-template-columns:repeat(2,minmax(0,1fr))!important}}',
      '@media(max-width:640px){.fc-mission-grid.fc-mission-grid--four{grid-template-columns:1fr!important}}'
    ].join('');
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', function () {
    captureAircraftControls();
    injectStyles();
    applyFixes();

    var observer = new MutationObserver(function () {
      window.requestAnimationFrame(applyFixes);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('change', function (event) {
      if (event.target && event.target.id === 'droneSelect') {
        window.setTimeout(applyFixes, 0);
      }
    });

    window.addEventListener('dronehub:weather-ready', function () {
      window.setTimeout(applyFixes, 0);
    });
  });
}());
