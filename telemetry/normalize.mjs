const finite = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;
const positive = (v) => finite(v) !== null && v > 0 ? v : null;
const enumText = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 1) return keys[0] + ': ' + String(v[keys[0]]);
    try { return JSON.stringify(v); } catch { return null; }
  }
  return null;
};
const values = (arr, key) => arr.map(x => finite(x[key])).filter(v => v !== null);
const minOf = (arr, key) => { const v = values(arr, key); return v.length ? Math.min(...v) : null; };
const maxOf = (arr, key) => { const v = values(arr, key); return v.length ? Math.max(...v) : null; };
const avgOf = (arr, key) => { const v = values(arr, key); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
const firstFinite = (arr, key) => { for (const x of arr) { const v = finite(x[key]); if (v !== null) return v; } return null; };
const lastFinite = (arr, key) => { for (let i=arr.length-1;i>=0;i--) { const v=finite(arr[i][key]); if(v!==null)return v; } return null; };
const unique = (arr) => [...new Set(arr.filter(Boolean))];
const haversine = (aLat,aLon,bLat,bLon) => {
  const R=6371000, rad=Math.PI/180;
  const dLat=(bLat-aLat)*rad, dLon=(bLon-aLon)*rad;
  const s=Math.sin(dLat/2)**2 + Math.cos(aLat*rad)*Math.cos(bLat*rad)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(s)));
};

const validCoordinate = (latitude, longitude) =>
  finite(latitude) !== null && finite(longitude) !== null &&
  Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
  !(latitude === 0 && longitude === 0);

// A posição informada pelo OSD só é confiável com fix real e satélites
// suficientes. Nível GPS é usado como alternativa em modelos sem gpsNum.
const validGpsFix = (osd, latitude, longitude) => (
  osd.isGpdUsed === true && validCoordinate(latitude, longitude) &&
  (finite(osd.gpsNum) !== null ? osd.gpsNum >= 6 :
    (finite(osd.gpsLevel) !== null && osd.gpsLevel >= 3))
);

export function normalizeFlight(version, details, frames) {
  const samples = [], events = [], coordinates = [];
  let previousWarning = '', previousTip = '';
  const flightModes = [], flightActions = [], goHomeStates = [];
  const safetyFlags = new Set();
  let home = null;
  let maxDistanceFromHomeM = null;
  let previousGps = null;
  let gpsDistanceM = 0;
  let measuredSteps = 0;
  let validGpsFrames = 0;
  let rejectedPositionJumps = 0;
  let photosTriggered = 0;
  let videoFrames = 0;
  let sdCardProblemFrames = 0;
  let gpsUnavailableFrames = 0;
  let weakGpsFrames = 0;
  let downlinkLostFrames = 0;
  let uplinkLostFrames = 0;

  for (const f of frames) {
    const o = f.osd || {}, b = f.battery || {}, a = f.app || {}, r = f.rc || {};
    const g = f.gimbal || {}, c = f.camera || {}, h = f.home || {};
    const time = finite(o.flyTime);
    const lat = finite(o.latitude), lon = finite(o.longitude);
    let gps = validGpsFix(o, lat, lon);
    const cells = b.isCellVoltageEstimated === false ? (b.cellVoltages || []).filter(v => positive(v) !== null) : [];

    if (!home && h.isHomeRecord === true && validCoordinate(h.latitude, h.longitude)) {
      home = {
        latitude: h.latitude,
        longitude: h.longitude,
        altitudeM: finite(h.altitude),
        goHomeHeightM: finite(h.goHomeHeight),
        maxAllowedHeightM: finite(h.maxAllowedHeight ?? h.heightLimit),
        dynamicHomePoint: h.isDynamicHomePointEnabled === true
      };
    }

    // A distância ao Home é computada somente após validar que o Home Point
    // não está absurdamente longe do trajeto real.

    const mode = enumText(o.flycState);
    const action = enumText(o.flightAction);
    const gh = enumText(o.goHomeStatus);
    if (mode) flightModes.push(mode);
    if (action && action !== 'None') flightActions.push(action);
    if (gh && gh !== 'Standby') goHomeStates.push(gh);

    if (!gps) gpsUnavailableFrames++;
    if (finite(o.gpsLevel) !== null && o.gpsLevel <= 1) weakGpsFrames++;
    if (finite(r.downlinkSignal) !== null && r.downlinkSignal <= 0) downlinkLostFrames++;
    if (finite(r.uplinkSignal) !== null && r.uplinkSignal <= 0) uplinkLostFrames++;

    if (o.isCompassError) safetyFlags.add('Erro de bússola');
    if (o.isVibrating) safetyFlags.add('Vibração anormal');
    if (o.isMotorBlocked) safetyFlags.add('Motor bloqueado');
    if (o.isOutOfLimit) safetyFlags.add('Limite de voo atingido');
    if (o.isNotEnoughForce) safetyFlags.add('Força insuficiente');
    if (o.isBarometerDeadInAir) safetyFlags.add('Falha de barômetro');
    if (o.isAcceletorOverRange) safetyFlags.add('Acelerômetro fora da faixa');
    if (finite(o.voltageWarning) !== null && o.voltageWarning > 0) safetyFlags.add('Aviso de tensão da bateria');
    if (g.isStuck) safetyFlags.add('Gimbal travado');
    if (h.isNearDistanceLimit) safetyFlags.add('Próximo do limite de distância');
    if (h.isNearHeightLimit) safetyFlags.add('Próximo do limite de altura');

    if (c.isPhoto) photosTriggered++;
    if (c.isVideo) videoFrames++;
    const sdState = enumText(c.sdCardState);
    if (c.sdCardIsInserted === false || (sdState && !/normal/i.test(sdState))) sdCardProblemFrames++;

    const sample = {
      timeS: time,
      timestamp: f.custom?.dateTime || null,
      latitude: gps ? lat : null,
      longitude: gps ? lon : null,
      heightM: finite(o.height),
      altitudeM: finite(o.altitude),
      speedMS: finite(o.xSpeed) !== null && finite(o.ySpeed) !== null ? Math.hypot(o.xSpeed, o.ySpeed) : null,
      verticalSpeedMS: finite(o.zSpeed),
      pitchDeg: finite(o.pitch),
      rollDeg: finite(o.roll),
      yawDeg: finite(o.yaw),
      flightMode: mode,
      flightAction: action,
      gpsSatellites: finite(o.gpsNum),
      gpsLevel: finite(o.gpsLevel),
      batteryPercent: finite(b.chargeLevel) !== null && b.chargeLevel >= 0 && b.chargeLevel <= 100 ? b.chargeLevel : null,
      voltageV: positive(b.voltage),
      currentA: finite(b.current),
      currentCapacityMah: finite(b.currentCapacity),
      fullCapacityMah: finite(b.fullCapacity),
      temperatureC: positive(b.voltage) !== null ? finite(b.temperature) : null,
      cellVoltagesV: cells.length ? cells : null,
      cellDeviationV: cells.length > 1 ? Math.max(...cells) - Math.min(...cells) : null,
      uplinkPercent: finite(r.uplinkSignal),
      downlinkPercent: finite(r.downlinkSignal),
      gimbalPitchDeg: finite(g.pitch),
      gimbalRollDeg: finite(g.roll),
      gimbalYawDeg: finite(g.yaw)
    };

    if (gps) {
      // Descarta saltos de GPS que exigiriam velocidade fisicamente incompatível
      // com o voo. Não os repassa ao mapa, à missão ou às métricas.
      if (previousGps) {
        const stepM = haversine(previousGps.latitude, previousGps.longitude, lat, lon);
        const deltaS = time !== null && previousGps.time !== null ? time - previousGps.time : null;
        const indicatedSpeedMS = finite(sample.speedMS) ?? 0;
        const plausibleSpeedMS = Math.max(45, Math.min(120, indicatedSpeedMS * 3 + 10));
        if (deltaS !== null && deltaS > 0 && stepM / deltaS > plausibleSpeedMS) {
          gps = false;
          rejectedPositionJumps++;
        } else if (deltaS !== null && deltaS > 0 && deltaS <= 15) {
          gpsDistanceM += stepM;
          measuredSteps++;
        }
      }
      if (gps) {
        validGpsFrames++;
        coordinates.push([lon, lat]);
        previousGps = { latitude: lat, longitude: lon, time };
      }
    }
    // Não conecta segmentos separados por perda do fix: nunca soma distâncias
    // desconhecidas enquanto o GPS esteve indisponível.
    if (!gps) {
      sample.latitude = null;
      sample.longitude = null;
      // Em caso de salto isolado, compara o próximo ponto com o último fix
      // confiável, não com o ponto espúrio.
      if (!validGpsFix(o, lat, lon)) previousGps = null;
    }
    samples.push(sample);

    if (a.warn && a.warn !== previousWarning) events.push({ timeS: time, type: 'warning', message: String(a.warn) });
    if (a.tip && a.tip !== previousTip) events.push({ timeS: time, type: 'information', message: String(a.tip) });
    previousWarning = a.warn || '';
    previousTip = a.tip || '';
  }

  const startBattery = firstFinite(samples,'batteryPercent');
  const endBattery = lastFinite(samples,'batteryPercent');
  const startVoltage = firstFinite(samples,'voltageV');
  const endVoltage = lastFinite(samples,'voltageV');
  const batteryUsed = startBattery !== null && endBattery !== null ? Math.max(0,startBattery-endBattery) : null;

  const gpsPositionReliable = validGpsFrames >= Math.min(5, frames.length) &&
    validGpsFrames >= frames.length * 0.25 &&
    rejectedPositionJumps <= Math.max(2, validGpsFrames * 0.05);
  const maxSpeed = maxOf(samples, 'speedMS') ?? 0;
  const durationS = finite(details.totalTime) ?? lastFinite(samples, 'timeS') ?? 0;

  // Um Home Point a milhares de quilômetros durante um voo curto não
  // pode contaminar a distância do Home nem servir de ponto de partida.
  if (home && coordinates.length) {
    const first = coordinates[0];
    const startDistanceM = haversine(home.latitude, home.longitude, first[1], first[0]);
    const possibleRangeM = Math.max(200, Math.min(200000, (maxSpeed + 2) * Math.max(0, durationS) + 200));
    if (startDistanceM > possibleRangeM) {
      home = null;
      safetyFlags.add('Home Point inconsistente com duração e velocidade do voo: distância ocultada.');
    }
  }

  if (!gpsPositionReliable) {
    safetyFlags.add('GPS insuficiente ou inconsistente: posição e distância do voo indisponíveis.');
  }
  if (rejectedPositionJumps) {
    safetyFlags.add(rejectedPositionJumps + ' salto(s) GPS incompatíveis com a velocidade do voo foram descartados.');
  }

  if (home && gpsPositionReliable) {
    for (const [lon, lat] of coordinates) {
      const d = haversine(home.latitude, home.longitude, lat, lon);
      maxDistanceFromHomeM = maxDistanceFromHomeM === null ? d : Math.max(maxDistanceFromHomeM, d);
    }
  }
  const distanceM = gpsPositionReliable && measuredSteps > 0 ? gpsDistanceM : null;
  // totalDistance da DJI pode vir em quilômetros. Não usamos um fator
  // arbitrário: a trajetória filtrada determina a distância em metros.
  const rawDistance = finite(details.totalDistance);
  if (distanceM !== null && rawDistance !== null &&
      Math.min(Math.abs(rawDistance - distanceM), Math.abs(rawDistance * 1000 - distanceM)) >
        Math.max(50, distanceM * 0.20)) {
    safetyFlags.add('Distância do cabeçalho diverge do GPS: foi utilizada a distância geográfica validada.');
  }

  const rawAltitude = finite(details.takeOffAltitude);
  // Valores fora da faixa operacional segura não são convertidos nem
  // exibidos como altitudes comprovadas.
  const takeOffAltitudeM = rawAltitude !== null && rawAltitude >= -500 && rawAltitude <= 6500 ?
    rawAltitude : null;
  if (rawAltitude !== null && takeOffAltitudeM === null) {
    safetyFlags.add('Altitude absoluta de decolagem fora da faixa confiável: valor ocultado.');
  }

  const routeStart = gpsPositionReliable && coordinates.length ?
    { longitude:coordinates[0][0], latitude:coordinates[0][1] } : null;
  const routeEnd = gpsPositionReliable && coordinates.length ?
    { longitude:coordinates[coordinates.length-1][0], latitude:coordinates[coordinates.length-1][1] } : null;

  return {
    schemaVersion: 2,
    version,
    details,
    frameCount: frames.length,
    summary: {
      durationS: finite(details.totalTime),
      distanceM,
      maxHeightM: maxOf(samples,'heightM') ?? finite(details.maxHeight),
      maxSpeedMS: maxOf(samples,'speedMS') ?? finite(details.maxHorizontalSpeed),
      maxVerticalSpeedMS: maxOf(samples,'verticalSpeedMS') ?? finite(details.maxVerticalSpeed),
      minVerticalSpeedMS: minOf(samples,'verticalSpeedMS'),
      maxBatteryTemperatureC: maxOf(samples,'temperatureC'),
      minBatteryTemperatureC: minOf(samples,'temperatureC'),
      takeOffAltitudeM,
      photoCount: finite(details.captureNum) ?? finite(details.photoNum) ?? photosTriggered,
      videoTimeS: finite(details.videoTime),
      maxDistanceFromHomeM
    },
    aircraft: {
      name: details.aircraftName || null,
      productType: enumText(details.productType),
      aircraftSerial: details.aircraftSn || null,
      cameraSerial: details.cameraSn || null,
      remoteSerial: details.rcSn || null,
      batterySerial: details.batterySn || null,
      appPlatform: enumText(details.appPlatform),
      appVersion: details.appVersion || null
    },
    route: {
      start: routeStart,
      end: routeEnd,
      home: gpsPositionReliable ? home : null,
      minAltitudeM: minOf(samples,'altitudeM'),
      maxAltitudeM: maxOf(samples,'altitudeM'),
      maxHeightM: maxOf(samples,'heightM'),
      maxDistanceFromHomeM
    },
    gps: {
      minSatellites: minOf(samples,'gpsSatellites'),
      maxSatellites: maxOf(samples,'gpsSatellites'),
      averageSatellites: avgOf(samples,'gpsSatellites'),
      minGpsLevel: minOf(samples,'gpsLevel'),
      maxGpsLevel: maxOf(samples,'gpsLevel'),
      unavailableFrames: gpsUnavailableFrames + rejectedPositionJumps,
      weakFrames: weakGpsFrames,
      validFrames: validGpsFrames,
      rejectedJumps: rejectedPositionJumps,
      positionReliable: gpsPositionReliable
    },
    battery: {
      startPercent: startBattery,
      endPercent: endBattery,
      usedPercent: batteryUsed,
      minPercent: minOf(samples,'batteryPercent'),
      startVoltageV: startVoltage,
      endVoltageV: endVoltage,
      minVoltageV: minOf(samples,'voltageV'),
      maxVoltageV: maxOf(samples,'voltageV'),
      maxCurrentA: maxOf(samples,'currentA'),
      minCurrentA: minOf(samples,'currentA'),
      currentCapacityStartMah: firstFinite(samples,'currentCapacityMah'),
      currentCapacityEndMah: lastFinite(samples,'currentCapacityMah'),
      fullCapacityMah: maxOf(samples,'fullCapacityMah'),
      minTemperatureC: minOf(samples,'temperatureC'),
      maxTemperatureC: maxOf(samples,'temperatureC'),
      maxCellDeviationV: maxOf(samples,'cellDeviationV')
    },
    signal: {
      minUplinkPercent: minOf(samples,'uplinkPercent'),
      averageUplinkPercent: avgOf(samples,'uplinkPercent'),
      minDownlinkPercent: minOf(samples,'downlinkPercent'),
      averageDownlinkPercent: avgOf(samples,'downlinkPercent'),
      uplinkLostFrames,
      downlinkLostFrames
    },
    dynamics: {
      maxHorizontalSpeedMS: maxOf(samples,'speedMS'),
      maxClimbSpeedMS: maxOf(samples,'verticalSpeedMS'),
      maxDescentSpeedMS: minOf(samples,'verticalSpeedMS'),
      maxAbsPitchDeg: (()=>{const v=values(samples,'pitchDeg').map(Math.abs);return v.length?Math.max(...v):null;})(),
      maxAbsRollDeg: (()=>{const v=values(samples,'rollDeg').map(Math.abs);return v.length?Math.max(...v):null;})(),
      flightModes: unique(flightModes),
      flightActions: unique(flightActions),
      returnHomeStates: unique(goHomeStates)
    },
    media: {
      photoCount: finite(details.captureNum) ?? finite(details.photoNum) ?? photosTriggered,
      videoTimeS: finite(details.videoTime),
      videoActiveFrames: videoFrames,
      sdCardProblemFrames
    },
    safety: {
      flags: [...safetyFlags],
      warningCount: events.filter(e=>e.type==='warning').length,
      informationCount: events.filter(e=>e.type==='information').length
    },
    samples,
    events,
    track: {
      type: 'Feature',
      properties: {},
      geometry: gpsPositionReliable && coordinates.length >= 2 ? { type: 'LineString', coordinates } : null
    },
    limitations: [
      'Dados ausentes são apresentados como indisponíveis.',
      'Tensões estimadas de células não são incluídas.',
      'Avisos registrados não equivalem a diagnóstico técnico da bateria.'
    ]
  };
}
