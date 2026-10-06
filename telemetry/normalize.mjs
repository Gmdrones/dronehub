const finite = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;
const positive = (v) => finite(v) !== null && v > 0 ? v : null;
export function normalizeFlight(version, details, frames) {
  const samples = [], events = [], coordinates = [];
  let previousWarning = '', previousTip = '';
  for (const f of frames) {
    const o = f.osd || {}, b = f.battery || {}, a = f.app || {}, r = f.rc || {};
    const time = finite(o.flyTime);
    const lat = finite(o.latitude), lon = finite(o.longitude);
    // Ignore default/no-fix coordinates; preserve only positions with a valid GPS flag.
    const gps = o.isGpdUsed === true && lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
    const cells = b.isCellVoltageEstimated === false ? (b.cellVoltages || []).filter(v => positive(v) !== null) : [];
    const sample = {
      timeS: time, timestamp: f.custom?.dateTime || null,
      latitude: gps ? lat : null, longitude: gps ? lon : null,
      heightM: finite(o.height), altitudeM: finite(o.altitude),
      speedMS: finite(o.xSpeed) !== null && finite(o.ySpeed) !== null ? Math.hypot(o.xSpeed, o.ySpeed) : null,
      verticalSpeedMS: finite(o.zSpeed), gpsSatellites: finite(o.gpsNum),
      batteryPercent: positive(b.voltage) !== null && finite(b.chargeLevel) !== null && b.chargeLevel >= 0 && b.chargeLevel <= 100 ? b.chargeLevel : null,
      voltageV: positive(b.voltage), temperatureC: positive(b.voltage) !== null ? finite(b.temperature) : null,
      cellVoltagesV: cells.length ? cells : null,
      cellDeviationV: cells.length > 1 ? Math.max(...cells) - Math.min(...cells) : null,
      uplinkPercent: finite(r.uplinkSignal), downlinkPercent: finite(r.downlinkSignal),
      flightMode: o.flycState || null, returnHomeStatus: o.goHomeStatus || null,
      voltageWarning: finite(o.voltageWarning),
    };
    samples.push(sample);
    if (gps) coordinates.push([lon, lat]);
    if (a.warn && a.warn !== previousWarning) events.push({ timeS: time, type: 'warning', message: String(a.warn) });
    if (a.tip && a.tip !== previousTip) events.push({ timeS: time, type: 'information', message: String(a.tip) });
    previousWarning = a.warn || ''; previousTip = a.tip || '';
  }
  const values = (field) => samples.map(s => s[field]).filter(v => v !== null);
  const maximum = (field) => { const v = values(field); return v.length ? v.reduce((a,b)=>Math.max(a,b)) : null; };
  return { schemaVersion: 1, version, details, frameCount: frames.length,
    summary: { durationS: finite(details.totalTime), distanceM: finite(details.totalDistance), maxHeightM: maximum('heightM'), maxSpeedMS: maximum('speedMS'), maxBatteryTemperatureC: maximum('temperatureC') },
    samples, events, track: { type: 'Feature', properties: {}, geometry: coordinates.length >= 2 ? { type: 'LineString', coordinates } : null },
    limitations: ['Dados ausentes são apresentados como indisponíveis.', 'Tensões estimadas de células não são incluídas.', 'Avisos registrados não equivalem a diagnóstico técnico da bateria.'] };
}
