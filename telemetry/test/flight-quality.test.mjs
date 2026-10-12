import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFlight } from '../normalize.mjs';

function flight(speed = 2, details = {}, options = {}) {
  const frames = Array.from({ length: 11 }, (_, i) => ({
    osd: {
      flyTime: i,
      latitude: i === 1 && options.gpsJump ? -11 : -22,
      longitude: -43 + i * 0.00001,
      isGpdUsed: true,
      xSpeed: speed,
      ySpeed: 0,
      altitude: 12,
      height: 5
    },
    home: options.home || {}
  }));
  return normalizeFlight(14, { totalTime: 10, ...details }, frames);
}

test('kilometers metadata is converted to meters only when corroborated by velocity', () => {
  const normalized = flight(2, { totalDistance: 0.02 });
  assert.ok(Math.abs(normalized.summary.distanceM - 20) < 0.001);
  assert.ok(normalized.limitations.some(x => x.includes('quilômetros para metros')));
});

test('metadata already in meters is not multiplied again', () => {
  const normalized = flight(2, { totalDistance: 20 });
  assert.equal(normalized.summary.distanceM, 20);
  assert.ok(!normalized.limitations.some(x => x.includes('quilômetros para metros')));
});

test('missing, zero, invalid and unsupported-model distances fall back to measured velocity', () => {
  for (const data of [
    { totalDistance: 0 },
    { totalDistance: 90000 },
    { totalDistance: 0.02, productType: { Mini5Pro: 139 } }
  ]) {
    const normalized = flight(2, data);
    assert.ok(Math.abs(normalized.summary.distanceM - 20) < 0.001);
  }
});

test('bad GPS jump cannot pollute track, telemetry or auto-filled mission start', () => {
  const normalized = flight(2, {}, { gpsJump: true });
  assert.equal(normalized.gps.outlierFrames, 1);
  assert.equal(normalized.samples[1].latitude, null);
  assert.equal(normalized.track.geometry.coordinates.length, 10);
  assert.equal(normalized.route.start.latitude, -22);
});

test('malformed Home Point is hidden rather than displaying implausible distance', () => {
  const normalized = flight(2, { takeOffAltitude: 8261.6 }, {
    home: { isHomeRecord: true, latitude: -10, longitude: -43 }
  });
  assert.equal(normalized.route.home, null);
  assert.equal(normalized.summary.maxDistanceFromHomeM, null);
  assert.equal(normalized.summary.takeOffAltitudeM, null);
  assert.ok(normalized.limitations.some(x => x.includes('Home Point incompatível')));
});

test('consistent Home Point and altitude are retained', () => {
  const normalized = flight(2, { takeOffAltitude: 12 }, {
    home: { isHomeRecord: true, latitude: -22, longitude: -43 }
  });
  assert.ok(normalized.summary.maxDistanceFromHomeM >= 0);
  assert.equal(normalized.summary.takeOffAltitudeM, 12);
});
