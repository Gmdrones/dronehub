'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function browser(plan = 'pro', expiry = null) {
  const values = new Map();
  const events = {};
  const context = {
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    document: { readyState: 'loading', body: null, getElementById: () => null, addEventListener: () => {} },
    window: { addEventListener: () => {}, dispatchEvent: () => {}, setInterval: fn => { events.expiry = fn; } },
    CustomEvent: function () {}, setTimeout: () => {}, clearInterval: () => {}, Date, console
  };
  context.localStorage.setItem('dronehub_user', JSON.stringify({ id: 'pilot', plan, planExpiresAt: expiry }));
  context.localStorage.setItem('dronehub_aircraft', JSON.stringify([
    { userId: 'pilot', id: '300', modelo: 'Terceiro' },
    { userId: 'other', id: '001', modelo: 'Outro piloto' },
    { userId: 'pilot', id: '100', modelo: 'Primeiro' },
    { userId: 'pilot', id: '200', modelo: 'Segundo' }
  ]));
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../js/supabase.js'), 'utf8'), context);
  return context;
}

test('downgrade hides extra aircraft and renewal restores the preserved fleet', () => {
  const ctx = browser();
  assert.equal(ctx.getAircraft('pilot').length, 3);
  ctx.localStorage.setItem('dronehub_user', JSON.stringify({ id: 'pilot', plan: 'free' }));
  assert.equal(ctx.getAircraft('pilot').length, 1);
  assert.equal(ctx.getAircraft('pilot')[0].id, '100');
  assert.equal(JSON.parse(ctx.localStorage.getItem('dronehub_aircraft')).length, 4);
  ctx.localStorage.setItem('dronehub_user', JSON.stringify({ id: 'pilot', plan: 'pro' }));
  assert.equal(ctx.getAircraft('pilot').length, 3);
});

test('expired Pro limits access without waiting for login or the expiry job', () => {
  const ctx = browser('pro', '2020-01-01T00:00:00Z');
  assert.equal(ctx.getAircraft('pilot').length, 1);
  assert.throws(() => ctx.saveAircraft('pilot', { id: '200', modelo: 'Bloqueado' }), /apenas 1/);
  assert.throws(() => ctx.deleteAircraft('pilot', '200'), /não está disponível/);
});

test('Free blocks registration with an explicit ID and edits only its allowed aircraft', () => {
  const ctx = browser('free');
  assert.throws(() => ctx.saveAircraft('pilot', { id: '050', modelo: 'Novo' }), /apenas 1/);
  assert.throws(() => ctx.saveAircraft('pilot', { modelo: 'Novo' }), /apenas 1/);
  ctx.saveAircraft('pilot', { id: '100', modelo: 'Editado' });
  assert.equal(ctx.getAircraft('pilot')[0].modelo, 'Editado');
  ctx.deleteAircraft('pilot', '100');
  assert.equal(ctx.getAircraft('pilot').length, 1);
  assert.equal(ctx.getAircraft('pilot')[0].id, '200');
});

test('active admin retains fleet access', () => {
  const ctx = browser('free');
  ctx.localStorage.setItem('dronehub_user', JSON.stringify({ id: 'pilot', plan: 'free', role: 'admin' }));
  assert.equal(ctx.getAircraft('pilot').length, 3);
});

test('cloud sync does not restore locked queued aircraft after downgrade', async () => {
  const ctx = browser('free');
  ctx.localStorage.setItem('dronehub_sync_queue', JSON.stringify([
    { operation: 'upsert', userId: 'pilot', collection: 'aircraft', recordId: '050', data: { modelo: 'Bloqueado' } },
    { operation: 'upsert', userId: 'pilot', collection: 'aircraft', recordId: '100', data: { modelo: 'Edição pendente' } }
  ]));
  ctx.testClient = { from: () => ({ select: () => ({ eq: async () => ({ data: [{ collection: 'aircraft', record_id: '100', payload: { modelo: 'Nuvem' } }] }) }) }) };
  vm.runInContext('supabaseClient = testClient;', ctx);
  assert.equal(await ctx.syncCloudData('pilot'), true);
  assert.equal(ctx.getAircraft('pilot').length, 1);
  assert.equal(ctx.getAircraft('pilot')[0].id, '100');
  assert.equal(ctx.getAircraft('pilot')[0].modelo, 'Edição pendente');
  assert.equal(JSON.parse(ctx.localStorage.getItem('dronehub_sync_queue')).length, 2);
});
