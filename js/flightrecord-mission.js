(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DroneHubFlightMission = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const STORAGE_KEY = 'dronehub_flightrecord_mission_draft_v1';
  const TTL_MS = 30 * 60 * 1000;

  function validPosition(latitude, longitude) {
    return Number.isFinite(latitude) && Number.isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  }

  function positionFrom(data) {
    // Bloqueia o preenchimento automático de missões com localização duvidosa.
    if (data?.gps?.positionReliable === false) return {};
    const coords = data?.track?.geometry?.coordinates;
    if (Array.isArray(coords)) {
      const point = coords.find(p => Array.isArray(p) && validPosition(p[1], p[0]));
      if (point) return { latitude: point[1], longitude: point[0] };
    }
    const home = data?.route?.home;
    if (validPosition(home?.latitude, home?.longitude)) {
      return { latitude: home.latitude, longitude: home.longitude };
    }
    const details = data?.details;
    if (validPosition(details?.latitude, details?.longitude)) {
      return { latitude: details.latitude, longitude: details.longitude };
    }
    return {};
  }

  function buildDraft(data, sourceHash, userId) {
    if (!data || !/^[a-f0-9]{64}$/.test(sourceHash || '') || !userId) return null;
    const rawTime = data.details?.startTime;
    const start = rawTime ? new Date(rawTime) : null;
    const validTime = start && Number.isFinite(start.getTime());
    const dataLocal = validTime
      ? [start.getFullYear(), String(start.getMonth() + 1).padStart(2, '0'), String(start.getDate()).padStart(2, '0')].join('-') : '';
    const horario = validTime
      ? [String(start.getHours()).padStart(2, '0'), String(start.getMinutes()).padStart(2, '0')].join(':') : '';
    const position = positionFrom(data);
    const aircraft = String(data.aircraft?.name || data.details?.aircraftName || 'DJI').replace(/[<>]/g, '').slice(0, 90);
    const extras = ['Gerada a partir de FlightRecord DJI; revise antes de salvar.'];
    if (Number.isFinite(data.summary?.durationS)) extras.push('Duração: ' + Math.round(data.summary.durationS) + ' s.');
    if (Number.isFinite(data.summary?.distanceM)) extras.push('Distância: ' + Math.round(data.summary.distanceM) + ' m.');
    if (Number.isFinite(data.summary?.maxHeightM)) extras.push('Altura máxima relativa: ' + data.summary.maxHeightM.toFixed(1) + ' m.');
    return {
      userId: String(userId),
      createdAt: Date.now(),
      flightRecordHash: sourceHash,
      source: 'dji-flightrecord',
      titulo: 'Voo DJI · ' + aircraft + (dataLocal ? ' · ' + dataLocal : ''),
      cliente: '',
      data: dataLocal,
      horario,
      local: Number.isFinite(position.latitude) ? position.latitude.toFixed(6) + ', ' + position.longitude.toFixed(6) : '',
      latitude: position.latitude ?? null,
      longitude: position.longitude ?? null,
      status: 'concluida',
      descricao: extras.join(' ')
    };
  }

  function takeDraft(storage, userId, now = Date.now()) {
    let raw;
    try { raw = storage.getItem(STORAGE_KEY); }
    catch { return null; }
    if (!raw) return null;
    try {
      const draft = JSON.parse(raw);
      if (draft.userId !== String(userId) || !Number.isFinite(draft.createdAt) ||
          now < draft.createdAt || now - draft.createdAt > TTL_MS ||
          !/^[a-f0-9]{64}$/.test(draft.flightRecordHash || '')) {
        storage.removeItem(STORAGE_KEY);
        return null;
      }
      return draft;
    } catch {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  function isDuplicate(missions, draft) {
    return Boolean(draft && Array.isArray(missions) &&
      missions.some(m => m && m.flightRecordHash === draft.flightRecordHash));
  }

  return { STORAGE_KEY, TTL_MS, positionFrom, buildDraft, takeDraft, isDuplicate };
});
