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
    var founderAdmin = String(authUser.email || '').toLowerCase() === 'giorgiomendonca@gmail.com';

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
      if (founderAdmin) { localUser.plan = 'pro'; localUser.role = 'admin'; localUser.courtesyExpiresAt = null; }
    } else {
      // A conta fundadora mantém acesso administrativo mesmo durante uma falha de leitura da tabela de planos.
      localUser.plan = founderAdmin ? 'pro' : 'free';
      localUser.role = founderAdmin ? 'admin' : 'pilot';
      localUser.courtesyExpiresAt = null;
    }

    localStorage.setItem('dronehub_user', JSON.stringify(localUser));
    return localUser;
  } catch (e) {
    return getCurrentUser();
  }
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
function persistCloudRecord(collection, userId, data, fallbackId) {
  if (!supabaseClient || !userId || !CLOUD_COLLECTIONS[collection]) return;
  const recordId = cloudRecordId(data, fallbackId);
  supabaseClient.from('user_records').upsert({
    user_id: userId, collection: collection, record_id: recordId, payload: data || {}
  }, { onConflict: 'user_id,collection,record_id' }).then(function (result) {
    if (result && result.error) console.warn('Não foi possível sincronizar os dados.', result.error.message);
  });
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
      if (!grouped[collection]) return;
      const key = CLOUD_COLLECTIONS[collection];
      const others = JSON.parse(localStorage.getItem(key) || '[]').filter(function (item) { return item.userId !== userId; });
      const current = grouped[collection].map(function (row) { return Object.assign({}, row.payload || {}, { id: row.record_id, userId: userId }); });
      localStorage.setItem(key, JSON.stringify(others.concat(current)));
    });
    window.dispatchEvent(new CustomEvent('dronehub:cloud-ready'));
    return true;
  } catch (e) { return false; }
}
function migrateLocalDataToCloud(userId) {
  if (!userId || !supabaseClient) return;
  const profile = getProfile(userId);
  if (Object.keys(profile).length) persistCloudRecord('profile', userId, profile, 'primary');
  const readers = { aircraft: getAircraft, missions: getMissions, documents: getDocuments, transactions: getTransactions, clients: getClients, batteries: getBatteries };
  Object.keys(readers).forEach(function (collection) {
    readers[collection](userId).forEach(function (record) { persistCloudRecord(collection, userId, record); });
  });
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
function saveMission(userId, data) {
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
function getMissions(userId) { return JSON.parse(localStorage.getItem('dronehub_missoes') || '[]').filter(m => m.userId === userId); }
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

function saveDocument(userId, data) {
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
  migrateLocalDataToCloud(before.id);
  const updated = await syncCurrentEntitlement();
  await syncCloudData((updated && updated.id) || before.id);
  if (updated && (updated.plan !== beforePlan || updated.role !== beforeRole)) {
    window.location.reload();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', refreshCurrentEntitlement);
} else {
  refreshCurrentEntitlement();
}

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange(function (event) {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      setTimeout(function () { refreshCurrentEntitlement(); }, 0);
    }
  });
}
