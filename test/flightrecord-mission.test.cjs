'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const m = require('../js/flightrecord-mission.js');
const hash = 'a'.repeat(64);
const sample = {
  details: {startTime: '2026-05-17T19:21:54.000Z', aircraftName: 'Mini 4 Pro'},
  track: { geometry: { coordinates: [[-43.23456, -22.99887], [-43.23, -22.99]] } },
  summary: {durationS: 79.6, distanceM: 2.17, maxHeightM: 5}
};
test('cria rascunho apenas com telemetria real e posicao correta [longitude,latitude]', () => {
  const draft = m.buildDraft(sample, hash, 'pilot-1');
  assert.equal(draft.status, 'concluida');
  assert.equal(draft.data, new Date(sample.details.startTime).getFullYear() + '-' +
    String(new Date(sample.details.startTime).getMonth() + 1).padStart(2, '0') + '-' +
    String(new Date(sample.details.startTime).getDate()).padStart(2, '0'));
  assert.equal(draft.horario, new Date(sample.details.startTime).toTimeString().slice(0, 5));
  assert.equal(draft.latitude, -22.99887);
  assert.equal(draft.longitude, -43.23456);
  assert.equal(draft.local, '-22.998870, -43.234560');
  assert.match(draft.descricao, /Duração: 80 s/);
  assert.equal(draft.flightRecordHash, hash);
});
test('GPS ausente nao produz coordenadas falsas; horario ausente nao inventa data', () => {
  const draft = m.buildDraft({aircraft:{name:'Mini'},summary:{}}, hash, 'pilot-1');
  assert.equal(draft.local, '');
  assert.equal(draft.latitude, null);
  assert.equal(draft.longitude, null);
  assert.equal(draft.data, '');
  assert.equal(draft.horario, '');
});
test('usa home point quando trajetoria GPS nao existe', () => {
  assert.deepEqual(m.positionFrom({route:{home:{latitude:12.1,longitude:-42.2}}}),{latitude:12.1,longitude:-42.2});
});
test('nao aceita coordenadas invalidas nem hash arbitrario', () => {
  assert.deepEqual(m.positionFrom({track:{geometry:{coordinates:[[1000,400]]}}}),{});
  assert.equal(m.buildDraft(sample, 'x', 'pilot-1'), null);
});
test('impede duplicata do mesmo arquivo por hash', () => {
  const draft = m.buildDraft(sample,hash,'pilot-1');
  assert.equal(m.isDuplicate([{flightRecordHash:hash}], draft), true);
  assert.equal(m.isDuplicate([{flightRecordHash:'b'.repeat(64)}], draft), false);
});
test('rascunho tem TTL e pertence a conta correta', () => {
  const draft = m.buildDraft(sample,hash,'pilot-1');
  draft.createdAt = 1000;
  const map = new Map([[m.STORAGE_KEY,JSON.stringify(draft)]]);
  const store = {getItem:k=>map.get(k),removeItem:k=>map.delete(k)};
  assert.equal(m.takeDraft(store,'pilot-1',1000).userId,'pilot-1');
  assert.equal(m.takeDraft(store,'pilot-2',1000),null);
  assert.equal(map.has(m.STORAGE_KEY),false);
  map.set(m.STORAGE_KEY,JSON.stringify(draft));
  assert.equal(m.takeDraft(store,'pilot-1',1000 + m.TTL_MS + 1),null);
});
test('arquivo 404 esta na raiz, usa caminhos absolutos e nao e indexavel', () => {
  const html = fs.readFileSync(path.join(__dirname,'..','404.html'),'utf8');
  assert.match(html,/<title>.*Página não encontrada/);
  assert.match(html,/name="robots" content="noindex,follow"/);
  assert.match(html,/href="\//);
  assert.doesNotMatch(html,/href="(?:\.\/|css\/|js\/)/);
});

test('nao importa localizacao de FlightRecord com GPS de baixa confianca', () => {
  const risky = { ...sample, gps: {positionReliable: false} };
  const draft = m.buildDraft(risky, hash, 'pilot-1');
  assert.equal(draft.local, '');
  assert.equal(draft.latitude, null);
  assert.equal(draft.longitude, null);
  assert.equal(draft.data.length, 10);
});
