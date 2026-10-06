(function () {
  'use strict';

  const endpoint = 'https://dronehub-telemetry.primesecureconsultoria.workers.dev/flight-log';
  let busy = false;

  const $el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  };
  const add = (parent, child) => { parent.appendChild(child); return child; };
  const finite = v => typeof v === 'number' && Number.isFinite(v);

  function fmt(v, suffix = '', digits = 2) {
    return finite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: digits }) + suffix : null;
  }
  function duration(seconds) {
    if (!finite(seconds)) return null;
    const s = Math.max(0, Math.round(seconds));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? h + 'h ' + m + 'min' : m ? m + 'min ' + sec + 's' : sec + 's';
  }
  function safeDate(value) {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d.toLocaleString('pt-BR') : 'Data não informada';
  }

  function iconHead(parent, icon, title, subtitle) {
    const section = add(parent, $el('section', 'flight-report__section'));
    const head = add(section, $el('div', 'flight-report__section-head'));
    const i = add(head, $el('i'));
    i.setAttribute('data-lucide', icon);
    add(head, $el('span', '', title));
    if (subtitle) {
      const p = add(section, $el('p', 'flight-report__map-help', subtitle));
      p.style.marginTop = '-3px';
    }
    return section;
  }

  function card(grid, label, value, help, options = {}) {
    if (value === null || value === undefined || value === '') return null;
    const c = add(grid, $el('div', 'flight-report__card'));
    add(c, $el('div', 'flight-report__card-label', label));
    add(c, $el('div', 'flight-report__card-value', String(value)));
    if (help) add(c, $el('div', 'flight-report__card-help', help));

    if (finite(options.progress)) {
      const bar = add(c, $el('div', 'flight-report__bar'));
      const fill = add(bar, $el('span'));
      fill.style.width = Math.max(0, Math.min(100, options.progress)) + '%';
    }
    if (options.status) {
      const s = add(c, $el('div', 'flight-report__status ' + (options.statusTone || 'good')));
      add(s, $el('span', '', options.status));
    }
    return c;
  }

  function gridSection(parent, icon, title, subtitle, items) {
    const section = iconHead(parent, icon, title, subtitle);
    const grid = add(section, $el('div', 'flight-report__grid'));
    for (const item of items) card(grid, ...item);
    if (!grid.childElementCount) section.remove();
    return section;
  }

  function chipsSection(parent, icon, title, values, emptyText) {
    const section = iconHead(parent, icon, title);
    if (!values || !values.length) {
      add(section, $el('div', 'flight-report__empty', emptyText || 'Nenhum registro encontrado.'));
      return;
    }
    const box = add(section, $el('div', 'flight-report__chips'));
    for (const value of values) add(box, $el('span', 'flight-report__chip', String(value)));
  }

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    return new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-dronehub-leaflet]')) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        css.crossOrigin = '';
        css.dataset.dronehubLeaflet = '1';
        document.head.appendChild(css);
      }
      let script = document.querySelector('script[data-dronehub-leaflet]');
      if (script) {
        script.addEventListener('load', () => resolve(window.L), { once: true });
        script.addEventListener('error', reject, { once: true });
        return;
      }
      script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.crossOrigin = '';
      script.dataset.dronehubLeaflet = '1';
      script.onload = () => resolve(window.L);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function renderMap(data, parent) {
    const coords = data.track?.geometry?.coordinates;
    const section = iconHead(parent, 'map', 'Mapa do voo', 'Visualize o trajeto real registrado pelo GPS. Use o zoom e alterne entre satélite e mapa.');
    if (!coords || coords.length < 2) {
      add(section, $el('div', 'flight-report__empty', 'Este FlightRecord não possui posições GPS suficientes para montar o trajeto.'));
      return null;
    }

    const mapEl = add(section, $el('div', 'flight-report__map'));
    try {
      const L = await loadLeaflet();
      const map = L.map(mapEl, { zoomControl: true, preferCanvas: true });
      const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 20, attribution: '&copy; OpenStreetMap'
      });
      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 20, attribution: 'Tiles &copy; Esri' }
      );
      satellite.addTo(map);
      L.control.layers({ 'Satélite': satellite, 'Mapa': streets }, null, { position: 'topright' }).addTo(map);

      const latLngs = coords
        .filter(p => Array.isArray(p) && finite(p[0]) && finite(p[1]))
        .map(p => [p[1], p[0]]);

      const route = L.polyline(latLngs, { color: '#00D2FF', weight: 4, opacity: .95 }).addTo(map);
      const start = latLngs[0], end = latLngs[latLngs.length - 1];

      L.circleMarker(start, { radius: 7, color: '#34D399', fillColor: '#34D399', fillOpacity: 1, weight: 2 })
        .bindTooltip('Decolagem').addTo(map);
      L.circleMarker(end, { radius: 7, color: '#F04438', fillColor: '#F04438', fillOpacity: 1, weight: 2 })
        .bindTooltip('Fim do voo').addTo(map);

      if (finite(data.route?.home?.latitude) && finite(data.route?.home?.longitude)) {
        L.circleMarker([data.route.home.latitude, data.route.home.longitude], {
          radius: 7, color: '#FFB020', fillColor: '#FFB020', fillOpacity: 1, weight: 2
        }).bindTooltip('Home Point').addTo(map);
      }

      const marker = L.circleMarker(start, {
        radius: 6, color: '#fff', fillColor: '#00D2FF', fillOpacity: 1, weight: 2
      }).addTo(map);

      map.fitBounds(route.getBounds(), { padding: [24, 24], maxZoom: 19 });
      setTimeout(() => map.invalidateSize(), 80);
      return { map, marker };
    } catch {
      mapEl.remove();
      add(section, $el('div', 'flight-report__empty', 'O mapa-base não carregou. Os demais dados do voo continuam disponíveis.'));
      return null;
    }
  }

  function renderTimeline(data, parent, mapState) {
    if (!data.samples?.length) return;
    const section = iconHead(parent, 'activity', 'Linha do tempo do voo', 'Mova o controle para acompanhar cada momento do voo. O marcador azul acompanha a posição no mapa.');
    const wrap = add(section, $el('div', 'flight-report__timeline'));
    const range = add(wrap, $el('input'));
    range.type = 'range';
    range.min = '0';
    range.max = String(data.samples.length - 1);
    range.value = '0';
    range.style.cssText = 'width:100%;margin:0 0 12px';
    const grid = add(wrap, $el('div', 'flight-report__grid'));

    function update() {
      const s = data.samples[Number(range.value)];
      grid.replaceChildren();
      const items = [
        ['Tempo', duration(s.timeS), 'Instante selecionado no voo'],
        ['Velocidade', fmt(finite(s.speedMS) ? s.speedMS * 3.6 : null, ' km/h'), 'Velocidade horizontal'],
        ['Altura', fmt(s.heightM, ' m'), 'Altura relativa à decolagem'],
        ['Bateria', fmt(s.batteryPercent, ' %', 0), 'Carga disponível neste momento', { progress: s.batteryPercent }],
        ['Temperatura', fmt(s.temperatureC, ' °C', 1), 'Temperatura da bateria'],
        ['Satélites', fmt(s.gpsSatellites, '', 0), 'Satélites GPS utilizados'],
        ['Sinal controle', fmt(s.uplinkPercent, ' %', 0), 'Comando enviado ao drone', { progress: s.uplinkPercent }],
        ['Sinal vídeo', fmt(s.downlinkPercent, ' %', 0), 'Telemetria/vídeo recebido', { progress: s.downlinkPercent }],
        ['Modo de voo', s.flightMode, 'Modo registrado pela aeronave'],
        ['Pitch', fmt(s.pitchDeg, '°', 1), 'Inclinação para frente/trás'],
        ['Roll', fmt(s.rollDeg, '°', 1), 'Inclinação lateral'],
        ['Yaw', fmt(s.yawDeg, '°', 1), 'Orientação da aeronave']
      ];
      for (const item of items) card(grid, ...item);
      if (mapState?.marker && finite(s.latitude) && finite(s.longitude)) {
        mapState.marker.setLatLng([s.latitude, s.longitude]);
      }
    }
    range.oninput = update;
    update();
  }

  function renderWarnings(data, parent) {
    const section = iconHead(parent, 'triangle-alert', 'Eventos e alertas', 'Avisos efetivamente registrados pelo aplicativo ou pela aeronave durante este voo.');
    const warnings = data.events?.filter(e => e.type === 'warning') || [];
    if (!warnings.length && !(data.safety?.flags?.length)) {
      add(section, $el('div', 'flight-report__empty', 'Nenhum alerta crítico foi identificado nos registros decodificados.'));
      return;
    }
    const box = add(section, $el('div', 'flight-report__alerts'));
    for (const flag of data.safety?.flags || []) {
      add(box, $el('div', 'flight-report__alert', flag));
    }
    for (const warning of warnings) {
      add(box, $el('div', 'flight-report__alert', (duration(warning.timeS) || 'Durante o voo') + ' — ' + warning.message));
    }
  }

  function renderTechnical(data, parent) {
    const details = add(parent, $el('details', 'flight-report__technical'));
    add(details, $el('summary', '', 'Dados técnicos e identificação'));
    const grid = add(details, $el('div', 'flight-report__grid'));
    const a = data.aircraft || {};
    const items = [
      ['Versão do FlightRecord', data.version, 'Versão do formato DJI'],
      ['Modelo', a.name || data.details?.aircraftName, 'Aeronave registrada no log'],
      ['Tipo DJI', a.productType, 'Identificação interna DJI'],
      ['Plataforma', a.appPlatform, 'Sistema/aplicativo usado'],
      ['Versão do app', a.appVersion, 'Versão registrada no voo'],
      ['Serial aeronave', a.aircraftSerial, 'Número de série'],
      ['Serial câmera', a.cameraSerial, 'Número de série'],
      ['Serial controle', a.remoteSerial, 'Número de série'],
      ['Serial bateria', a.batterySerial, 'Número de série']
    ];
    for (const item of items) card(grid, ...item);

    if (data.firmware?.length) {
      for (const fw of data.firmware) card(grid, 'Firmware ' + fw.component, fw.version, 'Versão registrada no log');
    }
  }

  async function renderReport(data, result) {
    const root = add(result, $el('div', 'flight-report'));

    const intro = add(root, $el('div', 'flight-report__intro'));
    const copy = add(intro, $el('div'));
    add(copy, $el('h4', '', 'FlightRecord analisado'));
    add(copy, $el('p', '',
      (data.aircraft?.name || data.details?.aircraftName || 'Aeronave DJI') + ' • ' +
      safeDate(data.details?.startTime) + ' • ' +
      Number(data.frameCount || 0).toLocaleString('pt-BR') + ' amostras processadas'
    ));
    add(intro, $el('div', 'flight-report__badge', '✓ Leitura concluída'));

    gridSection(root, 'gauge', 'Resumo do voo', 'Os principais números para entender rapidamente a operação.', [
      ['Duração', duration(data.summary?.durationS), 'Tempo total registrado'],
      ['Distância', fmt(data.summary?.distanceM, ' m'), 'Percurso total informado/calculado'],
      ['Altura máxima', fmt(data.summary?.maxHeightM, ' m'), 'Altura relativa à decolagem'],
      ['Velocidade máxima', fmt(finite(data.summary?.maxSpeedMS) ? data.summary.maxSpeedMS * 3.6 : null, ' km/h'), 'Maior velocidade horizontal'],
      ['Distância do Home', fmt(data.summary?.maxDistanceFromHomeM, ' m'), 'Maior afastamento do Home Point'],
      ['Fotos', finite(data.summary?.photoCount) ? data.summary.photoCount : null, 'Capturas registradas'],
      ['Vídeo', duration(data.summary?.videoTimeS), 'Tempo de gravação registrado']
    ]);

    gridSection(root, 'battery-charging', 'Bateria', 'Leitura dos dados energéticos presentes neste FlightRecord.', [
      ['Carga inicial', fmt(data.battery?.startPercent, ' %', 0), 'No início dos registros', { progress: data.battery?.startPercent }],
      ['Carga final', fmt(data.battery?.endPercent, ' %', 0), 'No fim dos registros', { progress: data.battery?.endPercent }],
      ['Consumo', fmt(data.battery?.usedPercent, ' p.p.', 0), 'Percentual utilizado durante o voo'],
      ['Tensão mínima', fmt(data.battery?.minVoltageV, ' V'), 'Menor tensão registrada'],
      ['Temperatura mínima', fmt(data.battery?.minTemperatureC, ' °C', 1), 'Menor temperatura registrada'],
      ['Temperatura máxima', fmt(data.battery?.maxTemperatureC, ' °C', 1), 'Maior temperatura registrada'],
      ['Capacidade registrada', fmt(data.battery?.fullCapacityMah, ' mAh', 0), 'Capacidade total informada pelo log'],
      ['Desvio entre células', finite(data.battery?.maxCellDeviationV) ? fmt(data.battery.maxCellDeviationV * 1000, ' mV', 0) : null, 'Maior diferença real entre células']
    ]);

    gridSection(root, 'satellite', 'GPS e comunicação', 'Ajuda a identificar a qualidade de posicionamento e do enlace com a aeronave.', [
      ['Satélites mínimos', fmt(data.gps?.minSatellites, '', 0), 'Menor quantidade registrada'],
      ['Satélites médios', fmt(data.gps?.averageSatellites, '', 1), 'Média durante o voo'],
      ['Satélites máximos', fmt(data.gps?.maxSatellites, '', 0), 'Maior quantidade registrada'],
      ['Controle mínimo', fmt(data.signal?.minUplinkPercent, ' %', 0), 'Menor uplink registrado', { progress: data.signal?.minUplinkPercent }],
      ['Controle médio', fmt(data.signal?.averageUplinkPercent, ' %', 0), 'Média do uplink', { progress: data.signal?.averageUplinkPercent }],
      ['Vídeo mínimo', fmt(data.signal?.minDownlinkPercent, ' %', 0), 'Menor downlink registrado', { progress: data.signal?.minDownlinkPercent }],
      ['Vídeo médio', fmt(data.signal?.averageDownlinkPercent, ' %', 0), 'Média do downlink', { progress: data.signal?.averageDownlinkPercent }]
    ]);

    gridSection(root, 'navigation', 'Dinâmica, Home e RTH', 'Dados de movimento e configurações operacionais registradas.', [
      ['Subida máxima', fmt(finite(data.summary?.maxVerticalSpeedMS) ? data.summary.maxVerticalSpeedMS * 3.6 : null, ' km/h'), 'Maior velocidade vertical positiva'],
      ['Descida máxima', fmt(finite(data.summary?.minVerticalSpeedMS) ? Math.abs(data.summary.minVerticalSpeedMS) * 3.6 : null, ' km/h'), 'Maior velocidade de descida'],
      ['Pitch máximo', fmt(data.dynamics?.maxAbsPitchDeg, '°', 1), 'Maior inclinação longitudinal'],
      ['Roll máximo', fmt(data.dynamics?.maxAbsRollDeg, '°', 1), 'Maior inclinação lateral'],
      ['Altura de RTH', fmt(data.route?.home?.goHomeHeightM, ' m'), 'Altura de retorno registrada'],
      ['Limite de altura', fmt(data.route?.home?.maxAllowedHeightM, ' m'), 'Limite registrado no voo'],
      ['Altitude de decolagem', fmt(data.summary?.takeOffAltitudeM, ' m'), 'Altitude absoluta registrada']
    ]);

    chipsSection(root, 'plane', 'Modos de voo utilizados', data.dynamics?.flightModes, 'Nenhum modo de voo foi identificado.');
    if (data.dynamics?.flightActions?.length) {
      chipsSection(root, 'workflow', 'Ações automáticas registradas', data.dynamics.flightActions);
    }

    const mapState = await renderMap(data, root);
    renderTimeline(data, root, mapState);
    renderWarnings(data, root);
    renderTechnical(data, root);

    if (data.batteryCounter) {
      const p = add(root, $el('div', 'flight-report__empty', 'Ciclos de bateria registrados pela DJI: ' + data.batteryCounter.cycles + '.'));
      p.style.marginTop = '14px';
    }

    const foot = add(root, $el('p', '', 'O DroneHub exibe somente dados presentes no FlightRecord. Campos ausentes não são estimados.'));
    foot.style.cssText = 'color:var(--text3);font-size:.7rem;margin:14px 2px 0';

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  async function importNative() {
    const file = document.getElementById('djiLog')?.files[0];
    const result = document.getElementById('logResult');
    if (!file || !result || busy) return;

    result.replaceChildren();
    if (file.size > 10 * 1024 * 1024) {
      add(result, $el('p', '', 'O limite por arquivo é 10 MB.'));
      return;
    }

    busy = true;
    add(result, $el('p', '', 'Analisando o FlightRecord e preparando o relatório…'));

    try {
      if (typeof supabaseClient === 'undefined' || !supabaseClient) throw Error('Faça login novamente.');
      const session = await supabaseClient.auth.getSession();
      const token = session.data?.session?.access_token;
      if (!token) throw Error('Sua sessão expirou. Faça login novamente.');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/octet-stream' },
        body: file,
        signal: AbortSignal.timeout(60000)
      });

      let data;
      try { data = await response.json(); }
      catch { throw Error('O serviço de leitura não respondeu corretamente. Tente novamente.'); }
      if (!response.ok) throw Error(data.error || 'Não foi possível importar.');

      result.replaceChildren();
      await renderReport(data, result);

      const counter = data.batteryCounter;
      if (counter) {
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        const battery = user && typeof getBatteries === 'function' && window.DroneHubBatteryIdentity
          ? window.DroneHubBatteryIdentity.findUnique(getBatteries(user.id), counter.serial)
          : null;
        if (battery && typeof saveBattery === 'function') {
          const previous = Math.max(Number(battery.cycles) || 0, Number(battery.ciclos) || 0);
          if (counter.cycles > previous) {
            battery.cycles = counter.cycles;
            battery.ciclos = counter.cycles;
            battery.cycleSource = counter.source;
            battery.cycleRecordedAt = counter.recordedAt;
            saveBattery(user.id, battery);
            window.dispatchEvent(new CustomEvent('dronehub:battery-updated'));
            if (typeof render === 'function') render();
          }
        }
      }
    } catch (error) {
      result.replaceChildren();
      add(result, $el('p', '', error.name === 'TimeoutError'
        ? 'A leitura excedeu o tempo limite. Tente novamente.'
        : error.message));
    } finally {
      busy = false;
    }
  }

  const input = document.getElementById('djiLog');
  if (!input) return;
  input.accept = '.txt,.csv,.json';
  const original = window.uploadLog;
  window.uploadLog = function () {
    if (/\.txt$/i.test(input.files[0]?.name || '')) return importNative();
    return original?.();
  };
  window.uploadNativeDjiLog = window.uploadLog;
  window.DroneHubDJIUpload = window.uploadLog;

  const result = document.getElementById('logResult');
  if (result && !result.textContent.trim()) {
    const p = add(result, $el('p', '', 'Selecione um FlightRecord para gerar o relatório do voo.'));
    p.style.cssText = 'color:var(--text3);font-size:.78rem';
  }
})();