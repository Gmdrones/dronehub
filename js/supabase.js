const SUPABASE_URL = 'https://oibcspkfbrlsleupqijl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IFGuGtD7X2sR7FPdaQHzdQ_o7cgUaO1';
const USE_SUPABASE = true;

let supabaseClient = null;
if (USE_SUPABASE && SUPABASE_URL.includes('supabase.co')) {
  try { supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch(e) {}
}

async function syncCurrentEntitlement() {
  if (!supabaseClient) return getCurrentUser();
  try {
    var authResult = await supabaseClient.auth.getUser();
    var authUser = authResult && authResult.data && authResult.data.user;
    if (!authUser) return getCurrentUser();

    // Nunca reutilize o mesmo objeto da tela: ele pode ter plano antigo no navegador.
    var savedUser = getCurrentUser() || {};
    var localUser = Object.assign({}, savedUser, {
      id: authUser.id,
      email: authUser.email || savedUser.email || '',
      name: (authUser.user_metadata && (authUser.user_metadata.full_name || authUser.user_metadata.name)) || savedUser.name || authUser.email || 'Piloto'
    });

    var result = await supabaseClient.rpc('get_my_entitlement');
    if (result && !result.error && Array.isArray(result.data)) result.data = result.data[0] || null;
    if (!result || result.error) {
      result = await supabaseClient
        .from('account_entitlements')
        .select('plan, role, status, courtesy_expires_at')
        .eq('user_id', authUser.id)
        .maybeSingle();
    }

    if (result && result.data) {
      var access = result.data;
      var isExpired = access.courtesy_expires_at && new Date(access.courtesy_expires_at).getTime() < Date.now();
      localUser.plan = access.status === 'active' && !isExpired && access.plan === 'pro' ? 'pro' : 'free';
      localUser.role = access.role === 'admin' ? 'admin' : 'pilot';
      localUser.courtesyExpiresAt = access.courtesy_expires_at || null;
    } else {
      // A conta fundadora mantém acesso administrativo mesmo durante uma falha de leitura da tabela de planos.
      localUser.plan = 'free';
      localUser.role = 'pilot';
      localUser.courtesyExpiresAt = null;
    }

    localStorage.setItem('dronehub_user', JSON.stringify(localUser));
    return localUser;
  } catch (e) {
    return getCurrentUser();
  }
}
window.syncCurrentEntitlement = syncCurrentEntitlement;

// O navegador guarda somente o contexto temporario da tentativa de pagamento.
// O plano continua sendo definido exclusivamente pelo entitlement do Supabase.
const PAYMENT_PENDING_KEY = 'payment_pending';
const PAYMENT_PENDING_TTL = 30 * 60 * 1000;
const PAYMENT_POLL_INTERVAL = 5000;
const PAYMENT_POLL_DURATION = 2 * 60 * 1000;
let paymentPollTimer = null;
let paymentPollStartedAt = 0;
let paymentSuccessInProgress = false;

function savePendingPayment(payment) {
  if (!payment || !payment.preference_id) return;
  sessionStorage.setItem(PAYMENT_PENDING_KEY, JSON.stringify(payment));
}
window.savePendingPayment = savePendingPayment;

function getPendingPayment() {
  try {
    var pending = JSON.parse(sessionStorage.getItem(PAYMENT_PENDING_KEY) || 'null');
    if (!pending || pending.payment_pending !== true || !pending.created_at) return null;
    if (Date.now() - Number(pending.created_at) > PAYMENT_PENDING_TTL) {
      sessionStorage.removeItem(PAYMENT_PENDING_KEY);
      return null;
    }
    return pending;
  } catch (e) {
    sessionStorage.removeItem(PAYMENT_PENDING_KEY);
    return null;
  }
}

function ensurePaymentStatusStyles() {
  if (document.getElementById('payment-status-styles')) return;
  var style = document.createElement('style');
  style.id = 'payment-status-styles';
  style.textContent = '.payment-status-overlay{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:20px;background:rgba(3,7,13,.78);backdrop-filter:blur(10px)}.payment-status-card{width:min(460px,100%);padding:30px;border:1px solid rgba(24,200,255,.28);border-radius:20px;background:#111925;box-shadow:0 24px 80px rgba(0,0,0,.5);color:#f5f8fc;text-align:center;font-family:Inter,system-ui,sans-serif}.payment-status-icon{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 18px;border-radius:50%;background:rgba(24,200,255,.12);color:#18c8ff;font-size:28px}.payment-status-card.is-success .payment-status-icon{background:rgba(54,211,153,.15);color:#36d399}.payment-status-card h2{margin:0 0 10px;font-size:24px}.payment-status-card p{margin:0;color:#a7b3c5;line-height:1.6}.payment-status-card button{margin-top:22px;min-height:44px;padding:0 22px;border:0;border-radius:12px;background:#18c8ff;color:#071019;font-weight:750;cursor:pointer}.payment-status-card button:disabled{opacity:.65;cursor:wait}.payment-status-spinner{width:24px;height:24px;border:3px solid rgba(24,200,255,.25);border-top-color:#18c8ff;border-radius:50%;animation:payment-spin .8s linear infinite}@keyframes payment-spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);
}

function showPendingPaymentNotice() {
  ensurePaymentStatusStyles();
  var overlay = document.getElementById('payment-status-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'payment-status-overlay';
    overlay.className = 'payment-status-overlay';
    overlay.innerHTML = '<section class="payment-status-card" role="dialog" aria-modal="true" aria-labelledby="payment-status-title"><div class="payment-status-icon"><span class="payment-status-spinner" aria-hidden="true"></span></div><h2 id="payment-status-title">Seu pagamento ainda está aguardando confirmação.</h2><p>Assim que o Mercado Pago confirmar,<br>seu plano será ativado automaticamente.</p><button type="button" id="payment-status-refresh">Atualizar status</button></section>';
    document.body.appendChild(overlay);
    overlay.querySelector('#payment-status-refresh').addEventListener('click', async function () {
      this.disabled = true;
      await checkPendingPayment();
      this.disabled = false;
    });
  }
  overlay.hidden = false;
}

function showPaymentSuccess() {
  if (paymentSuccessInProgress) return;
  paymentSuccessInProgress = true;
  if (paymentPollTimer) clearInterval(paymentPollTimer);
  sessionStorage.removeItem(PAYMENT_PENDING_KEY);
  ensurePaymentStatusStyles();
  var overlay = document.getElementById('payment-status-overlay') || document.createElement('div');
  overlay.id = 'payment-status-overlay';
  overlay.className = 'payment-status-overlay';
  overlay.hidden = false;
  overlay.innerHTML = '<section class="payment-status-card is-success" role="status"><div class="payment-status-icon" aria-hidden="true">&#10003;</div><h2>Pagamento confirmado!</h2><p>Seu Drone Hub PRO foi ativado com sucesso.</p></section>';
  if (!overlay.parentNode) document.body.appendChild(overlay);
  setTimeout(function () { window.location.href = '/dashboard'; }, 2000);
}

async function checkPendingPayment() {
  if (!getPendingPayment() || paymentSuccessInProgress) return null;
  var user = await syncCurrentEntitlement();
  if (user && (user.plan === 'pro' || user.role === 'admin')) {
    showPaymentSuccess();
  } else {
    showPendingPaymentNotice();
  }
  return user;
}
window.checkPendingPayment = checkPendingPayment;

function startPendingPaymentMonitor() {
  if (!getPendingPayment()) return;
  paymentPollStartedAt = Date.now();
  checkPendingPayment();
  paymentPollTimer = setInterval(function () {
    if (!getPendingPayment() || Date.now() - paymentPollStartedAt >= PAYMENT_POLL_DURATION) {
      clearInterval(paymentPollTimer);
      paymentPollTimer = null;
      return;
    }
    checkPendingPayment();
  }, PAYMENT_POLL_INTERVAL);
}

// ===== AUTH =====
async function signUpWithSupabase(email, password, name) {
  if (supabaseClient) {
    const { data, error } = await supabaseClient.auth.signUp({
      email, password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin + '/login.html?confirmed=1'
      }
    });
    if (error) throw error;
    if (data?.user) {
      const userData = { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.full_name || name, plan: 'free', role: 'pilot', createdAt: data.user.created_at };
      localStorage.setItem('dronehub_user', JSON.stringify(userData));
      await syncCurrentEntitlement();
    }
    return data;
  }
  // Never keep passwords in browser storage. Production access requires Supabase Auth.
  throw new Error('O cadastro seguro está indisponível no momento. Tente novamente em instantes.');
}

async function signInWithSupabase(email, password) {
  if (supabaseClient) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data?.user) {
      const userData = { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.full_name || email.split('@')[0], plan: 'free', role: 'pilot', createdAt: data.user.created_at };
      localStorage.setItem('dronehub_user', JSON.stringify(userData));
      await syncCurrentEntitlement();
    }
    return data;
  }
  throw new Error('O acesso seguro está indisponível no momento. Tente novamente em instantes.');
}

async function resetPasswordWithSupabase(email) {
  if (supabaseClient) {
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/login.html?recovery=1' });
    if (error) throw error;
    return data;
  }
  throw new Error('A recuperação de senha está indisponível no momento.');
}
async function updatePasswordWithSupabase(password) {
  if (!supabaseClient) throw new Error('A recuperação de senha está indisponível no momento.');
  const { data, error } = await supabaseClient.auth.updateUser({ password: password });
  if (error) throw error;
  try {
    const session = await supabaseClient.auth.getSession();
    const token = session && session.data && session.data.session && session.data.session.access_token;
    if (token) await fetch('/api/email/password-changed', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
  } catch (_) {}
  return data;
}

function getCurrentUser() { return JSON.parse(localStorage.getItem('dronehub_user') || 'null'); }
function logoutUser() { localStorage.removeItem('dronehub_user'); if (supabaseClient) supabaseClient.auth.signOut(); window.location.href = 'login.html'; }

// ===== CLOUD DATA SYNC =====
// Os módulos continuam rápidos no navegador, mas cada alteração é espelhada
// no Supabase para que o piloto não perca a operação ao trocar de aparelho.
const CLOUD_COLLECTIONS = {
  profile: 'dronehub_profiles', aircraft: 'dronehub_aircraft', missions: 'dronehub_missoes',
  documents: 'dronehub_docs', transactions: 'dronehub_transactions', clients: 'dronehub_clientes',
  batteries: 'dronehub_baterias'
};
function cloudRecordId(data, fallback) { return String((data && data.id) || fallback || 'primary'); }
function setCloudSyncStatus(state) {
  localStorage.setItem('dronehub_sync_state', JSON.stringify({ state: state, at: new Date().toISOString() }));
  var badge = document.getElementById('cloudSyncStatus');
  if (!badge && document.body) {
    badge = document.createElement('button'); badge.id = 'cloudSyncStatus'; badge.type = 'button';
    badge.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9999;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:8px 12px;background:#0f1724;color:#ffb84d;font:600 12px Inter,sans-serif;display:none';
    badge.onclick = retryCloudQueue; document.body.appendChild(badge);
  }
  if (!badge) return;
  badge.style.display = state === 'ok' ? 'none' : 'block';
  badge.textContent = state === 'error' ? 'Dados não sincronizados · tentar novamente' : 'Sincronizando…';
}
function queueCloudWrite(item) {
  var queue = JSON.parse(localStorage.getItem('dronehub_sync_queue') || '[]');
  queue = queue.filter(function (x) { return !(x.collection === item.collection && x.userId === item.userId && x.recordId === item.recordId); });
  queue.push(item); localStorage.setItem('dronehub_sync_queue', JSON.stringify(queue));
}
async function retryCloudQueue() {
  var queue = JSON.parse(localStorage.getItem('dronehub_sync_queue') || '[]');
  if (!queue.length) return setCloudSyncStatus('ok');
  localStorage.removeItem('dronehub_sync_queue');
  for (var i = 0; i < queue.length; i++) await persistCloudRecord(queue[i].collection, queue[i].userId, queue[i].data, queue[i].recordId);
}
function persistCloudRecord(collection, userId, data, fallbackId) {
  if (!supabaseClient || !userId || !CLOUD_COLLECTIONS[collection]) return Promise.resolve(false);
  const recordId = cloudRecordId(data, fallbackId);
  setCloudSyncStatus('syncing');
  return supabaseClient.from('user_records').upsert({
    user_id: userId, collection: collection, record_id: recordId, payload: data || {}
  }, { onConflict: 'user_id,collection,record_id' }).then(function (result) {
    if (result && result.error) { queueCloudWrite({ collection: collection, userId: userId, recordId: recordId, data: data || {} }); setCloudSyncStatus('error'); return false; }
    setCloudSyncStatus('ok'); return true;
  }).catch(function () { queueCloudWrite({ collection: collection, userId: userId, recordId: recordId, data: data || {} }); setCloudSyncStatus('error'); return false; });
}
function removeCloudRecord(collection, userId, id) {
  if (!supabaseClient || !userId) return;
  supabaseClient.from('user_records').delete().eq('user_id', userId).eq('collection', collection).eq('record_id', String(id)).then(function () {});
}
async function syncCloudData(userId) {
  if (!supabaseClient || !userId) return false;
  try {
    const result = await supabaseClient.from('user_records').select('collection,record_id,payload,updated_at').eq('user_id', userId);
    if (result.error || !result.data) return false;
    const grouped = result.data.reduce(function (acc, row) { (acc[row.collection] || (acc[row.collection] = [])).push(row); return acc; }, {});
    if (grouped.profile && grouped.profile[0]) {
      const profiles = JSON.parse(localStorage.getItem(CLOUD_COLLECTIONS.profile) || '{}');
      profiles[userId] = grouped.profile[0].payload || {};
      localStorage.setItem(CLOUD_COLLECTIONS.profile, JSON.stringify(profiles));
    }
    ['aircraft','missions','documents','transactions','clients','batteries'].forEach(function (collection) {
      const key = CLOUD_COLLECTIONS[collection];
      const others = JSON.parse(localStorage.getItem(key) || '[]').filter(function (item) { return item.userId !== userId; });
      const current = (grouped[collection] || []).map(function (row) { return Object.assign({}, row.payload || {}, { id: row.record_id, userId: userId }); });
      localStorage.setItem(key, JSON.stringify(others.concat(current)));
    });
    window.dispatchEvent(new CustomEvent('dronehub:cloud-ready'));
    setCloudSyncStatus('ok'); return true;
  } catch (e) { setCloudSyncStatus('error'); return false; }
}

let userRecordsRealtimeChannel = null;
function applyCloudRecordChange(payload, userId) {
  const row = payload.new && payload.new.user_id ? payload.new : payload.old;
  if (!row || row.user_id !== userId || !CLOUD_COLLECTIONS[row.collection]) return;
  const key = CLOUD_COLLECTIONS[row.collection];
  if (row.collection === 'profile') {
    const profiles = JSON.parse(localStorage.getItem(key) || '{}');
    if (payload.eventType === 'DELETE') delete profiles[userId];
    else profiles[userId] = row.payload || {};
    localStorage.setItem(key, JSON.stringify(profiles));
  } else {
    let records = JSON.parse(localStorage.getItem(key) || '[]');
    records = records.filter(function (item) { return !(item.userId === userId && String(item.id) === String(row.record_id)); });
    if (payload.eventType !== 'DELETE') records.push(Object.assign({}, row.payload || {}, { id: row.record_id, userId: userId }));
    localStorage.setItem(key, JSON.stringify(records));
  }
  window.dispatchEvent(new CustomEvent('dronehub:cloud-record-change', { detail: { collection: row.collection, eventType: payload.eventType, recordId: row.record_id } }));
  if (row.collection === 'missions') window.dispatchEvent(new CustomEvent('dronehub:missions-updated'));
}
function startCloudRealtime(userId) {
  if (!supabaseClient || !userId) return;
  if (userRecordsRealtimeChannel) supabaseClient.removeChannel(userRecordsRealtimeChannel);
  userRecordsRealtimeChannel = supabaseClient.channel('user-records-' + userId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_records', filter: 'user_id=eq.' + userId }, function (payload) {
      applyCloudRecordChange(payload, userId);
    })
    .subscribe(function (status) {
      if (status === 'SUBSCRIBED') setCloudSyncStatus('ok');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setCloudSyncStatus('error');
    });
}
window.startCloudRealtime = startCloudRealtime;
async function migrateLocalDataToCloud(userId) {
  if (!userId || !supabaseClient) return;
  const writes = [];
  const profile = getProfile(userId);
  if (Object.keys(profile).length) writes.push(persistCloudRecord('profile', userId, profile, 'primary'));
  const readers = { aircraft: getAircraft, missions: getMissions, documents: getDocuments, transactions: getTransactions, clients: getClients, batteries: getBatteries };
  Object.keys(readers).forEach(function (collection) {
    readers[collection](userId).forEach(function (record) { writes.push(persistCloudRecord(collection, userId, record)); });
  });
  await Promise.all(writes);
}

// ===== PROFILES =====
function saveProfile(userId, data) {
  const p = JSON.parse(localStorage.getItem('dronehub_profiles') || '{}');
  p[userId] = { ...p[userId], ...data };
  localStorage.setItem('dronehub_profiles', JSON.stringify(p));
  persistCloudRecord('profile', userId, p[userId], 'primary');
  return p[userId];
}
function getProfile(userId) { return JSON.parse(localStorage.getItem('dronehub_profiles') || '{}')[userId] || {}; }

// ===== AIRCRAFT =====
function saveAircraft(userId, data) {
  const currentUser = getCurrentUser() || {};
  const existing = getAircraft(userId);
  if (currentUser.plan !== 'pro' && !data.id && existing.length >= 1) {
    throw new Error('O plano Free permite cadastrar apenas 1 aeronave. Faça upgrade para adicionar mais.');
  }
  if (!data.id) data.id = Date.now().toString();
  data.userId = userId;
  data.createdAt = data.createdAt || new Date().toISOString();
  const a = JSON.parse(localStorage.getItem('dronehub_aircraft') || '[]');
  const idx = a.findIndex(x => x.id === data.id && x.userId === userId);
  if (idx >= 0) { a[idx] = data; } else { a.push(data); }
  localStorage.setItem('dronehub_aircraft', JSON.stringify(a));
  persistCloudRecord('aircraft', userId, data);
  return data;
}
function getAircraft(userId) { return JSON.parse(localStorage.getItem('dronehub_aircraft') || '[]').filter(a => a.userId === userId); }
function deleteAircraft(userId, id) {
  const a = JSON.parse(localStorage.getItem('dronehub_aircraft') || '[]').filter(x => !(x.userId === userId && x.id === id));
  localStorage.setItem('dronehub_aircraft', JSON.stringify(a));
  removeCloudRecord('aircraft', userId, id);
}

// ===== MISSIONS =====
function requireProCapability(feature) {
  var account = getCurrentUser() || {};
  if (account.plan !== 'pro' && account.role !== 'admin') {
    throw new Error((feature || 'Este recurso') + ' está disponível no plano Pro.');
  }
  return true;
}
function saveMission(userId, data) {
  requireProCapability('Salvar missões e checklists');
  if (!data.id) data.id = Date.now().toString();
  data.userId = userId; data.createdAt = data.createdAt || new Date().toISOString();
  data.status = data.status || 'agendada';
  const m = JSON.parse(localStorage.getItem('dronehub_missoes') || '[]');
  const idx = m.findIndex(x => x.id === data.id && x.userId === userId);
  if (idx >= 0) { m[idx] = data; } else { m.push(data); }
  localStorage.setItem('dronehub_missoes', JSON.stringify(m));
  persistCloudRecord('missions', userId, data);
  return data;
}
function getMissions(userId) {
  const all = JSON.parse(localStorage.getItem('dronehub_missoes') || '[]');
  const now = new Date();
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  let changed = false;
  all.forEach(function (mission) {
    if (mission.userId === userId && mission.status === 'agendada' && mission.data && mission.data < today) {
      mission.status = 'concluida';
      mission.completedAutomaticallyAt = new Date().toISOString();
      mission.updatedAt = mission.completedAutomaticallyAt;
      changed = true;
      persistCloudRecord('missions', userId, mission);
    }
  });
  if (changed) {
    localStorage.setItem('dronehub_missoes', JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('dronehub:missions-updated', { detail: { source: 'automatic-completion' } }));
  }
  return all.filter(m => m.userId === userId);
}
function deleteMission(userId, id) {
  const m = JSON.parse(localStorage.getItem('dronehub_missoes') || '[]').filter(x => !(x.userId === userId && x.id === id));
  localStorage.setItem('dronehub_missoes', JSON.stringify(m));
  removeCloudRecord('missions', userId, id);
}

// ===== DOCUMENTS =====
function isSarpasDocument(data) {
  const raw = [
    data && data.type,
    data && data.category,
    data && data.name,
    data && data.title
  ].filter(Boolean).join(' ');
  return raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('sarpas');
}

// Consolida dados gravados por versoes antigas sob o e-mail do piloto.
// O Supabase usa UUID; sem esta migracao celular e computador podem parecer
// contas diferentes mesmo pertencendo ao mesmo login.
function migrateLocalOwnerAliases(oldId, newId, email) {
  if (!newId) return;
  const aliases = [oldId, email].filter(function (value, index, list) {
    return value && value !== newId && list.indexOf(value) === index;
  });
  if (!aliases.length) return;
  const profileStore = JSON.parse(localStorage.getItem('dronehub_profiles') || '{}');
  aliases.forEach(function (alias) {
    if (profileStore[alias]) {
      profileStore[newId] = Object.assign({}, profileStore[alias], profileStore[newId] || {});
      delete profileStore[alias];
    }
  });
  localStorage.setItem('dronehub_profiles', JSON.stringify(profileStore));
  Object.keys(CLOUD_COLLECTIONS).filter(function (name) { return name !== 'profile'; }).forEach(function (collection) {
    const key = CLOUD_COLLECTIONS[collection];
    const records = JSON.parse(localStorage.getItem(key) || '[]');
    let changed = false;
    records.forEach(function (record) {
      if (aliases.indexOf(record.userId) >= 0) { record.userId = newId; changed = true; }
    });
    if (changed) {
      const unique = new Map();
      records.forEach(function (record) { unique.set(String(record.userId) + ':' + String(record.id), record); });
      localStorage.setItem(key, JSON.stringify(Array.from(unique.values())));
    }
  });
}

function saveDocument(userId, data) {
  requireProCapability('Gerar e salvar documentos');
  if (!data.id) data.id = Date.now().toString();
  data.userId = userId; data.createdAt = data.createdAt || new Date().toISOString();
  let d = JSON.parse(localStorage.getItem('dronehub_docs') || '[]');
  if (isSarpasDocument(data)) {
    const superseded = d.filter(x =>
      x.userId === userId &&
      x.id !== data.id &&
      isSarpasDocument(x)
    );
    superseded.forEach(x => removeCloudRecord('documents', userId, x.id));
    d = d.filter(x => !(
      x.userId === userId &&
      x.id !== data.id &&
      isSarpasDocument(x)
    ));
    data.replacesPreviousAuthorization = true;
  }
  const idx = d.findIndex(x => x.id === data.id && x.userId === userId);
  if (idx >= 0) { d[idx] = data; } else { d.push(data); }
  localStorage.setItem('dronehub_docs', JSON.stringify(d));
  persistCloudRecord('documents', userId, data);
  return data;
}
function getDocuments(userId) { return JSON.parse(localStorage.getItem('dronehub_docs') || '[]').filter(d => d.userId === userId); }
function deleteDocument(userId, id) {
  const d = JSON.parse(localStorage.getItem('dronehub_docs') || '[]').filter(x => !(x.userId === userId && x.id === id));
  localStorage.setItem('dronehub_docs', JSON.stringify(d));
  removeCloudRecord('documents', userId, id);
}

// ===== TRANSACTIONS =====
function saveTransaction(userId, data) {
  requireProCapability('O módulo financeiro');
  if (!data.id) data.id = Date.now().toString();
  data.userId = userId; data.date = data.date || new Date().toISOString().split('T')[0];
  const t = JSON.parse(localStorage.getItem('dronehub_transactions') || '[]');
  const idx = t.findIndex(x => x.id === data.id && x.userId === userId);
  if (idx >= 0) { t[idx] = data; } else { t.push(data); }
  localStorage.setItem('dronehub_transactions', JSON.stringify(t));
  persistCloudRecord('transactions', userId, data);
  return data;
}
function getTransactions(userId) { return JSON.parse(localStorage.getItem('dronehub_transactions') || '[]').filter(t => t.userId === userId); }
function deleteTransaction(userId, id) {
  const t = JSON.parse(localStorage.getItem('dronehub_transactions') || '[]').filter(x => !(x.userId === userId && x.id === id));
  localStorage.setItem('dronehub_transactions', JSON.stringify(t));
  removeCloudRecord('transactions', userId, id);
}

// ===== CLIENTS =====
function saveClient(userId, data) {
  requireProCapability('O cadastro de clientes');
  if (!data.id) data.id = Date.now().toString(); data.userId = userId; data.createdAt = data.createdAt || new Date().toISOString();
  const c = JSON.parse(localStorage.getItem('dronehub_clientes') || '[]');
  const idx = c.findIndex(x => x.id === data.id && x.userId === userId);
  if (idx >= 0) { c[idx] = data; } else { c.push(data); }
  localStorage.setItem('dronehub_clientes', JSON.stringify(c));
  persistCloudRecord('clients', userId, data);
  return data;
}
function getClients(userId) { return JSON.parse(localStorage.getItem('dronehub_clientes') || '[]').filter(c => c.userId === userId); }
function deleteClient(userId, id) {
  const c = JSON.parse(localStorage.getItem('dronehub_clientes') || '[]').filter(x => !(x.userId === userId && x.id === id));
  localStorage.setItem('dronehub_clientes', JSON.stringify(c));
  removeCloudRecord('clients', userId, id);
}

// ===== BATTERIES =====
function saveBattery(userId, data) {
  requireProCapability('A gestão de baterias');
  if (!data.id) data.id = Date.now().toString(); data.userId = userId; data.createdAt = data.createdAt || new Date().toISOString();
  const b = JSON.parse(localStorage.getItem('dronehub_baterias') || '[]');
  const idx = b.findIndex(x => x.id === data.id && x.userId === userId);
  if (idx >= 0) { b[idx] = data; } else { b.push(data); }
  localStorage.setItem('dronehub_baterias', JSON.stringify(b));
  persistCloudRecord('batteries', userId, data);
  return data;
}
function getBatteries(userId) { return JSON.parse(localStorage.getItem('dronehub_baterias') || '[]').filter(b => b.userId === userId); }
function deleteBattery(userId, id) {
  const b = JSON.parse(localStorage.getItem('dronehub_baterias') || '[]').filter(x => !(x.userId === userId && x.id === id));
  localStorage.setItem('dronehub_baterias', JSON.stringify(b));
  removeCloudRecord('batteries', userId, id);
}

// Mantém o plano e a função do usuário atualizados em toda abertura do painel.
// Isso evita que uma alteração de acesso feita pelo administrador só apareça
// depois de um novo login.
async function refreshCurrentEntitlement() {
  const before = getCurrentUser();
  if (!before || !supabaseClient) return;
  const beforePlan = before.plan;
  const beforeRole = before.role;
  const updated = await syncCurrentEntitlement();
  const canonicalId = (updated && updated.id) || before.id;
  migrateLocalOwnerAliases(before.id, canonicalId, (updated && updated.email) || before.email);
  await syncCloudData(canonicalId);
  startCloudRealtime(canonicalId);
  if (getPendingPayment()) {
    if (updated && (updated.plan === 'pro' || updated.role === 'admin')) showPaymentSuccess();
  } else if (updated && (updated.plan !== beforePlan || updated.role !== beforeRole)) {
    window.location.reload();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    refreshCurrentEntitlement();
    startPendingPaymentMonitor();
  });
} else {
  refreshCurrentEntitlement();
  startPendingPaymentMonitor();
}

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange(function (event) {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      setTimeout(function () { refreshCurrentEntitlement(); }, 0);
    }
  });
}
window.addEventListener('online', retryCloudQueue);
