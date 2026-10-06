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
  const frame = (lon) => ({ osd: { flyTime: 1, latitude: -22, longitude: lon, isGpdUsed: true, xSpeed: 3, ySpeed: 4, height: 5 }, battery: { voltage: 8, chargeLevel: 90, temperature: 25, isCellVoltageEstimated: true, cellVoltages: [4,4] }, app: { warn: '<script>warning</script>' } });
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
