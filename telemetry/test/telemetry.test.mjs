import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DJILog } from 'dji-log-parser-js';
import { normalizeFlight } from '../normalize.mjs';
import { createHandler } from '../handler.mjs';
import { batteryCounter } from '../battery-counter.mjs';
test('cycles require explicit counter and unambiguous serial', () => {
  const detail={batterySn:'sample-battery',startTime:'2026-05-17'};
  const record={type:'SmartBatteryGroup',content:{type:'SmartBatteryStatic',index:0,loop_times:12,designed_capacity:3000,full_voltage:8400}};
  assert.equal(batteryCounter(detail,[]),null);
  assert.equal(batteryCounter(detail,[record]).cycles,12);
  assert.equal(batteryCounter(detail,[record,record]).cycles,12);
  assert.equal(batteryCounter(detail,[record,{type:'Recover',content:{batterySn:'other'}}]),null);
  assert.equal(batteryCounter(detail,[{type:'CenterBattery',content:{numberOfDischarges:99}}]),null);
  assert.equal(batteryCounter(detail,[{...record,content:{...record.content,designed_capacity:1276416}}]),null);
});
test('original DJI v14 metadata and keychain structure', () => {
  const file = process.env.DJI_TEST_LOG;
  if (!file) return;
  const parser = new DJILog(readFileSync(file));
  try { assert.equal(parser.version, 14); assert.equal(parser.details.aircraftName, 'DJI Mini 5 Pro'); assert.equal(parser.details.totalTime, 79.6); assert.ok(parser.keychainsRequest().keychainsArray.length); }
  finally { parser.free(); }
});
test('route, units, warnings and no estimated cell voltages', () => {
  const frame = (lon) => ({ osd: { flyTime: 1, latitude: -22, longitude: lon, isGpdUsed: true, gpsNum: 15, xSpeed: 3, ySpeed: 4, height: 5 }, battery: { voltage: 8, chargeLevel: 90, temperature: 25, isCellVoltageEstimated: true, cellVoltages: [4,4] }, app: { warn: '<script>warning</script>' } });
  const result = normalizeFlight(14, {totalTime: 2,totalDistance: 4}, [frame(-43),frame(-43.01)]);
  assert.equal(result.summary.maxSpeedMS, 5); assert.equal(result.track.geometry.type, 'LineString'); assert.equal(result.events.length, 1); assert.equal(result.samples[0].cellVoltagesV, null);
});
const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY:'public', DJI_API_KEY:'secret' };
const req = () => new Request('https://telemetry/flight-log', { method:'POST', headers:{Authorization:'Bearer user', 'Content-Type':'application/octet-stream'}, body:new Uint8Array(120) });
const fakeFetch = (access) => async (url) => new Response(JSON.stringify(url.includes('/auth/') ? {id:'pilot'} : access), {status:200});
test('reject Free and expired Pro before parsing or contacting DJI', async () => {
  for (const access of [{plan:'free',status:'active'},{plan:'pro',status:'expired'},{plan:'pro',status:'active',courtesy_expires_at:'2020-01-01'}]) {
    const handler = createHandler(class { constructor(){throw Error('must not parse');}},fakeFetch(access));
    assert.equal((await handler(req(),env)).status,403);
  }
});
test('unauthenticated and unconfigured fail closed', async () => {
  const handler=createHandler(class {});
  assert.equal((await handler(new Request('https://t/flight-log',{method:'POST'}),env)).status,401);
  assert.equal((await handler(req(),{})).status,503);
});
test('success never exposes DJI keychains and frees parser', async () => {
  let freed=false;
  class Parser {version=14;details={totalTime:1};async fetchKeychains(key){assert.equal(key,'secret');return ['private-keychains'];} frames(){return [{osd:{}}];}free(){freed=true;}}
  const response=await createHandler(Parser,fakeFetch({plan:'pro',status:'active'}))(req(),env);
  assert.equal(response.status,200); assert.equal(freed,true); assert.ok(!(await response.text()).includes('private-keychains'));
});
test('invalid log errors do not leak credentials', async () => {
  class Parser {constructor(){throw Error('secret');}}
  const response=await createHandler(Parser,fakeFetch({plan:'pro',status:'active'}))(req(),env);
  assert.equal(response.status,422);assert.ok(!(await response.text()).includes('secret'));
});

const healthyFrame = (lon, time, satellites = 20, homeLatitude = -22) => ({
  osd: { flyTime: time, latitude: -22, longitude: lon, isGpdUsed: true,
    gpsNum: satellites, xSpeed: 12, ySpeed: 0, height: 3 },
  home: { isHomeRecord: true, latitude: homeLatitude, longitude: -43, altitude: 150 }
});

test('computes meters from trusted GPS rather than treating DJI km as meters', () => {
  const frames = [
    healthyFrame(-43, 0),
    healthyFrame(-43.0005, 5),
    healthyFrame(-43.001, 10)
  ];
  const result = normalizeFlight(14, {totalTime: 10, totalDistance: 0.103}, frames);
  assert.ok(result.summary.distanceM > 99 && result.summary.distanceM < 105);
  assert.equal(result.gps.positionReliable, true);
  assert.equal(result.route.start.longitude, -43);
  assert.ok(result.summary.maxDistanceFromHomeM > 99);
});

test('rejects faraway Home Point and implausible absolute altitude', () => {
  const frames = [
    healthyFrame(-43, 0, 20, -9),
    healthyFrame(-43.0002, 3, 20, -9),
    healthyFrame(-43.0004, 6, 20, -9)
  ];
  const result = normalizeFlight(14, {
    totalTime: 6, takeOffAltitude: 8261.6
  }, frames);
  assert.equal(result.route.home, null);
  assert.equal(result.summary.maxDistanceFromHomeM, null);
  assert.equal(result.summary.takeOffAltitudeM, null);
  assert.ok(result.safety.flags.some(s => s.includes('Home Point inconsistente')));
  assert.ok(result.safety.flags.some(s => s.includes('Altitude absoluta')));
});

test('weak or missing satellite fix never generates a mission location or distance', () => {
  const frames = Array.from({length: 20}, (_, i) =>
    healthyFrame(-43 - i * 0.0001, i, 1));
  const result = normalizeFlight(14, {totalTime: 20, totalDistance: 2.17}, frames);
  assert.equal(result.gps.positionReliable, false);
  assert.equal(result.summary.distanceM, null);
  assert.equal(result.route.start, null);
  assert.equal(result.track.geometry, null);
});

test('GPS teleport is filtered and not added to the track or distance', () => {
  const frames = [
    healthyFrame(-43, 0),
    healthyFrame(-43.0001, 1),
    { ...healthyFrame(-30, 2), osd: { ...healthyFrame(-30, 2).osd, latitude: -10 } },
    healthyFrame(-43.0002, 3),
    healthyFrame(-43.0003, 4),
    healthyFrame(-43.0004, 5)
  ];
  const result = normalizeFlight(14, {totalTime: 5}, frames);
  assert.equal(result.gps.rejectedJumps, 1);
  assert.equal(result.gps.positionReliable, true);
  assert.equal(result.track.geometry.coordinates.length, 5);
  assert.ok(result.summary.distanceM > 30 && result.summary.distanceM < 55);
});


test('rejects takeoff altitude that disagrees with the first DJI OSD sample', () => {
  const frames = [0, 1, 2].map(i => ({
    ...healthyFrame(-43 - i * 0.00002, i),
    osd: { ...healthyFrame(-43 - i * 0.00002, i).osd, altitude: 0 }
  }));
  const bad = normalizeFlight(14, { totalTime: 2, takeOffAltitude: -175.4 }, frames);
  assert.equal(bad.summary.takeOffAltitudeM, null);
  assert.ok(bad.safety.flags.some(s => s.includes('OSD')));
  const validFrames = frames.map(f => ({ ...f, osd: { ...f.osd, altitude: 12 } }));
  const good = normalizeFlight(14, { totalTime: 2, takeOffAltitude: 12 }, validFrames);
  assert.equal(good.summary.takeOffAltitudeM, 12);
});
