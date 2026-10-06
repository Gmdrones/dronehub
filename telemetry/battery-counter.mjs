// Use only an explicitly recorded charge-loop counter, never number of flights.
export function batteryCounter(details, records) {
  const serials = new Set(records.filter(r=>r.type==='Recover').map(r=>r.content?.batterySn).filter(Boolean));
  if (details.batterySn) serials.add(details.batterySn);
  const counters = records.filter(r=>r.type==='SmartBatteryGroup' && r.content?.type==='SmartBatteryStatic');
  // Unsupported/new static layouts can produce plausible loop_times alongside corrupt fields.
  if (counters.some(r=>!Number.isFinite(r.content.designed_capacity) || r.content.designed_capacity<100 || r.content.designed_capacity>100000 || !Number.isFinite(r.content.full_voltage) || r.content.full_voltage<1000 || r.content.full_voltage>100000)) return null;
  const indexes = new Set(counters.map(r=>r.content.index));
  if (serials.size !== 1 || indexes.size !== 1) return null;
  const values = counters.map(r=>r.content.loop_times);
  if (!values.length || values.some(v=>!Number.isSafeInteger(v) || v<0 || v>100000)) return null;
  return { serial: [...serials][0], cycles: Math.max(...values), source: 'DJI SmartBatteryStatic.loop_times', recordedAt: details.startTime };
}
