'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { paymentState, effectiveAccess, canWriteCollection, validUpload } = require('../lib/domain.cjs');

test('pagamentos aprovados, pendentes e estornados são normalizados', () => {
  assert.equal(paymentState('approved'), 'approved');
  assert.equal(paymentState('in_process'), 'pending');
  assert.equal(paymentState('refunded'), 'refunded');
  assert.equal(paymentState('rejected'), 'cancelled');
});

test('Pro vencido retorna ao Free; Admin ativo permanece Pro', () => {
  assert.equal(effectiveAccess({ plan:'pro', role:'pilot', status:'active', courtesy_expires_at:'2020-01-01' }).plan, 'free');
  assert.equal(effectiveAccess({ plan:'pro', role:'pilot', status:'active', courtesy_expires_at:'2099-01-01' }).plan, 'pro');
  assert.equal(effectiveAccess({ plan:'free', role:'admin', status:'active' }).role, 'admin');
});

test('Free grava apenas perfil e uma aeronave', () => {
  const free = { active:false };
  assert.equal(canWriteCollection(free, 'profile'), true);
  assert.equal(canWriteCollection(free, 'aircraft', 0), true);
  assert.equal(canWriteCollection(free, 'aircraft', 1), false);
  assert.equal(canWriteCollection(free, 'missions'), false);
});

test('upload aceita PDF/JPEG/PNG até 10 MB', () => {
  assert.equal(validUpload({ type:'application/pdf', size:1024 }), true);
  assert.equal(validUpload({ type:'text/html', size:1024 }), false);
  assert.equal(validUpload({ type:'application/pdf', size:11*1024*1024 }), false);
});

test('Fiscalização permanece disponível no Free', () => {
  const access = fs.readFileSync(path.join(__dirname, '../js/plan-access.js'), 'utf8');
  const mobileNav = fs.readFileSync(path.join(__dirname, '../js/mobile-nav.js'), 'utf8');
  const features = fs.readFileSync(path.join(__dirname, '../funcionalidades.html'), 'utf8');
  assert.doesNotMatch(access.match(/PRO_PAGES\s*=\s*\[[^\]]+\]/)?.[0] || '', /fiscalizacao\.html/);
  assert.match(access, /aircraft\.insertAdjacentElement\('afterend', inspection\)/);
  assert.match(mobileNav, /aircraftLink\.insertAdjacentElement\('afterend', inspectionLink\)/);
  assert.match(features, /Modo fiscalização[\s\S]*?tag free/);
});

test('menu Free bloqueia recursos Pro no desktop e no celular', () => {
  const access = fs.readFileSync(path.join(__dirname, '../js/plan-access.js'), 'utf8');
  const accessCss = fs.readFileSync(path.join(__dirname, '../css/plan-access.css'), 'utf8');
  const central = fs.readFileSync(path.join(__dirname, '../central-voo.html'), 'utf8');
  assert.match(access, /\.sidebar nav a, \.sidebar-nav a, \.mobile-nav-links a/);
  assert.match(access, /plan-nav-lock-icon/);
  assert.match(accessCss, /\.mobile-nav-links a\.plan-nav-lock/);
  assert.match(central, /css\/plan-access\.css/);
});

test('dashboard possui calendário funcional e notificações integradas', () => {
  const dashboard = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
  const tools = fs.readFileSync(path.join(__dirname, '../js/dashboard-calendar-notifications.js'), 'utf8');
  assert.match(dashboard, /dashboard-calendar-notifications\.js/);
  assert.match(tools, /function renderCalendar\(\)/);
  assert.match(tools, /data-calendar-date/);
  assert.match(tools, /function renderNotifications\(\)/);
  assert.match(tools, /dronehub:cloud-ready/);
  assert.match(tools, /getMissions/);
  assert.match(tools, /getDocuments/);
  assert.match(dashboard, /if \(weatherLoading\) weatherLoading\.textContent/);
});
