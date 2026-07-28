'use strict';

function paymentState(status) {
  if (status === 'approved') return 'approved';
  if (status === 'refunded' || status === 'charged_back') return status;
  if (status === 'cancelled' || status === 'rejected') return 'cancelled';
  return 'pending';
}

function effectiveAccess(entitlement, now = Date.now()) {
  const item = entitlement || {};
  if (item.role === 'admin' && item.status === 'active') return { plan: 'pro', role: 'admin', active: true };
  const expired = item.courtesy_expires_at && new Date(item.courtesy_expires_at).getTime() <= now;
  const active = item.plan === 'pro' && item.status === 'active' && !expired;
  return { plan: active ? 'pro' : 'free', role: 'pilot', active };
}

function canWriteCollection(access, collection, aircraftCount = 0) {
  if (collection === 'profile') return true;
  if (collection === 'aircraft') return access.active || aircraftCount === 0;
  return Boolean(access.active);
}

function validUpload(file) {
  const allowed = ['application/pdf','image/jpeg','image/png'];
  return Boolean(file && allowed.includes(file.type) && file.size > 0 && file.size <= 10 * 1024 * 1024);
}

module.exports = { paymentState, effectiveAccess, canWriteCollection, validUpload };
