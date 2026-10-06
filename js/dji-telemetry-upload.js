(function () {
  'use strict';
  const endpoint = 'https://dronehub-telemetry.primesecureconsultoria.workers.dev/flight-log';
  let busy = false;
  function element(tag, text, parent) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; }
  function format(v, suffix) { return typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + suffix : 'Indisponível'; }
  async function importNative() {
    const file = document.getElementById('djiLog')?.files[0], result = document.getElementById('logResult');
    if (!file || !result || busy) return;
    result.replaceChildren();
    if (file.size > 10 * 1024 * 1024) { element('p', 'O limite por arquivo é 10 MB.', result); return; }
    busy = true; element('p', 'Decodificando o FlightRecord original…', result);
    try {
      if (typeof supabaseClient === 'undefined' || !supabaseClient) throw Error('Faça login novamente.');
      const session = await supabaseClient.auth.getSession();
      const token = session.data?.session?.access_token;
      if (!token) throw Error('Sua sessão expirou. Faça login novamente.');
      const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/octet-stream' }, body: file, signal: AbortSignal.timeout(60000) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Não foi possível importar.');
      result.replaceChildren();
      element('h4', 'Telemetria DJI decodificada', result);
      if (data.quality?.partial) element('p', 'Leitura parcial: '+data.quality.unknownRecords+' registros não reconhecidos e '+data.quality.invalidRecords+' inválidos. Dados não suportados não são usados para atualizar a bateria.', result);
      element('p', data.details.aircraftName + ' · ' + new Date(data.details.startTime).toLocaleString('pt-BR') + ' · ' + data.frameCount + ' registros', result);
      const stats = element('div', undefined, result); stats.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px;margin:12px 0';
      for (const [label, value] of [['Duração', format(data.summary.durationS, ' s')], ['Distância', format(data.summary.distanceM, ' m')], ['Altura máxima', format(data.summary.maxHeightM, ' m')], ['Velocidade máxima', format(data.summary.maxSpeedMS === null ? null : data.summary.maxSpeedMS * 3.6, ' km/h')], ['Temperatura máxima da bateria', format(data.summary.maxBatteryTemperatureC, ' °C')]]) {
        const card = element('div', undefined, stats); element('small', label, card); element('p', value, card);
      }
      const coords = data.track?.geometry?.coordinates;
      if (coords?.length > 1) {
        element('h4', 'Trajeto registrado (sem mapa-base)', result);
        const xs = coords.map(p => p[0]), ys = coords.map(p => p[1]);
        const minX = xs.reduce((a,b)=>Math.min(a,b)), minY = ys.reduce((a,b)=>Math.min(a,b)), dx = xs.reduce((a,b)=>Math.max(a,b)) - minX || 0.00001, dy = ys.reduce((a,b)=>Math.max(a,b)) - minY || 0.00001;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 600 300'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Trajeto GPS do voo'); svg.style.cssText = 'width:100%;max-height:320px;background:var(--bg);border:1px solid var(--border);border-radius:12px';
        const line = document.createElementNS(svg.namespaceURI, 'polyline'); line.setAttribute('points', coords.map(p => (20 + (p[0] - minX) / dx * 560) + ',' + (280 - (p[1] - minY) / dy * 260)).join(' ')); line.setAttribute('fill','none'); line.setAttribute('stroke','#18c9f3'); line.setAttribute('stroke-width','2'); svg.appendChild(line); result.appendChild(svg);
      } else element('p', 'O log não contém posições GPS válidas suficientes para um trajeto.', result);
      element('h4', 'Avisos registrados', result);
      const warnings = data.events.filter(e => e.type === 'warning');
      if (!warnings.length) element('p', 'Nenhum aviso encontrado nos registros decodificados. Isso não comprova ausência de falhas.', result);
      for (const warning of warnings) element('p', format(warning.timeS, ' s') + ' — ' + warning.message, result);
      const firmware = data.firmware || [];
      for (const item of firmware) element('p', 'Firmware registrado — '+item.component+': '+item.version, result);
      const counter = data.batteryCounter;
      if (counter) {
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        const battery = user && typeof getBatteries === 'function' ? getBatteries(user.id).find(b=>b.serial===counter.serial) : null;
        if (battery && typeof saveBattery === 'function') {
          const previous=Math.max(Number(battery.cycles)||0,Number(battery.ciclos)||0);
          // Idempotent monotonic update: an old or duplicate log cannot increment or reset cycles.
          if (counter.cycles>previous) { battery.cycles=counter.cycles; battery.ciclos=counter.cycles; battery.cycleSource=counter.source; battery.cycleRecordedAt=counter.recordedAt; saveBattery(user.id,battery); window.dispatchEvent(new CustomEvent('dronehub:battery-updated')); if(typeof render==='function')render(); }
          element('p','Ciclos da bateria: '+Math.max(previous,counter.cycles)+' (contador registrado pela DJI).',result);
        } else element('p','Contador DJI: '+counter.cycles+' ciclos. Cadastre a bateria com o mesmo número de série para atualizar automaticamente.',result);
      } else element('p','Ciclos: contador confiável indisponível neste log. O cadastro da bateria foi mantido.',result);
      const download = element('button', 'Baixar telemetria completa (JSON)', result); download.type = 'button'; download.className = 'btn btn-secondary';
      download.onclick = function () { const url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'})); const a = element('a'); a.href = url; a.download = file.name.replace(/\.txt$/i, '') + '-telemetry.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
      element('p', 'O arquivo contém séries de velocidade, posição, bateria e sinal disponíveis. Dados ausentes não são estimados. Firmware é exibido por componente, sem substituir o cadastro da aeronave.', result);
    } catch (error) { result.replaceChildren(); element('p', error.name === 'TimeoutError' ? 'A leitura excedeu o tempo limite. Tente novamente.' : error.message, result); }
    finally { busy = false; }
  }
  const input = document.getElementById('djiLog');
  if (!input) return;
  input.accept = '.txt,.csv,.json';
  const original = window.uploadLog;
  window.uploadLog = function () { if (/\.txt$/i.test(input.files[0]?.name || '')) return importNative(); return original?.(); };
  window.uploadNativeDjiLog = window.uploadLog;
})();
