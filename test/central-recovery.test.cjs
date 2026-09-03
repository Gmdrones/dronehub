const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync(require('node:path').join(__dirname, '../js/central-v2.js'), 'utf8');
function setup(fetchResult) {
  const errors = [], state = {weather:null, request:1, location:{lat:-23,lon:-43}};
  const ctx = {state, AbortController, setTimeout, clearTimeout, Promise, Array, Error,
    jsonRetry:fetchResult, moduleLoading(){}, moduleError(id){errors.push(id)},
    renderWeather(){}, writeWeatherCache(){}, document:{}, $(){}};
  vm.createContext(ctx);
  vm.runInContext(code.slice(code.indexOf('function weatherFailure('), code.indexOf('function pickStation(')), ctx);
  return {ctx,errors,state,req:{id:1,signal:new AbortController().signal}};
}
test('weather failure replaces every initial skeleton with retry UI', async()=>{
  const h=setup(()=>Promise.reject(Error('Offline')));
  await assert.rejects(h.ctx.loadWeather(h.req), /Offline/);
  assert.equal(h.errors.length,9);
  assert.ok(h.errors.includes('summary') && h.errors.includes('forecast'));
});
test('invalid forecast cannot become valid cached weather', async()=>{
  const h=setup(()=>Promise.resolve({}));
  await assert.rejects(h.ctx.loadWeather(h.req), /Previsão/);
  assert.equal(h.state.weather,null);
});
test('late failure from previous location cannot overwrite current UI', async()=>{
  const h=setup(()=>Promise.reject(Error('Offline')));h.state.request=2;
  await assert.rejects(h.ctx.loadWeather(h.req));assert.equal(h.errors.length,0);
});
test('valid weather renders successfully', async()=>{
  const d={daily:{time:['2026-09-02']}};const h=setup(()=>Promise.resolve(d));
  await h.ctx.loadWeather(h.req);assert.equal(h.state.weather,d);assert.equal(h.errors.length,0);
});
