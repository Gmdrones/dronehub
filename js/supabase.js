const SUPABASE_URL = 'https://tysvnppvgobztjllxsqw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1Oft25v5ZdG4U5_F77E7hg_QXgohL8b';
const USE_SUPABASE = true;

let supabaseClient = null;
if (USE_SUPABASE && SUPABASE_URL.includes('supabase.co')) {
  try { supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch(e) {}
}

async function syncCurrentEntitlement() {
  var localUser = getCurrentUser();
  if (!localUser || !supabaseClient || !localUser.id) return localUser;
  try {
    var result = await supabaseClient
      .from('account_entitlements')
      .select('plan, role, status, courtesy_expires_at')
      .eq('user_id', localUser.id)
      .maybeSingle();
    if (result.error || !result.data) return localUser;
    var access = result.data;
    var isExpired = access.courtesy_expires_at && new Date(access.courtesy_expires_at).getTime() < Date.now();
    localUser.plan = access.status === 'active' && !isExpired ? access.plan : 'free';
    localUser.role = access.role || 'pilot';
    localUser.courtesyExpiresAt = access.courtesy_expires_at || null;
    localStorage.setItem('dronehub_user', JSON.stringify(localUser));
    return localUser;
  } catch (e) { return localUser; }
}

// ===== AUTH =====
async function signUpWithSupabase(email, password, name) {
  if (supabaseClient) {
    const { data, error } = await supabaseClient.auth.signUp({
      email, password,
      options: { data: { full_name: name } }
    });
    if (error) throw error;
    if (data?.user) {
      const userData = { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.full_name || name, plan: 'free', role: 'pilot', createdAt: data.user.created_at };
      localStorage.setItem('dronehub_user', JSON.stringify(userData));
      await syncCurrentEntitlement();
    }
    return data;
  }
  const users = JSON.parse(localStorage.getItem('dronehub_users') || '[]');
  if (users.find(u => u.email === email)) throw new Error('Email ja cadastrado');
  const user = { id: Date.now().toString(), name, email, password, createdAt: new Date().toISOString(), plan: 'free' };
  users.push(user);
  localStorage.setItem('dronehub_users', JSON.stringify(users));
  localStorage.setItem('dronehub_user', JSON.stringify(user));
  return user;
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
  const users = JSON.parse(localStorage.getItem('dronehub_users') || '[]');
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) throw new Error('Email ou senha incorretos');
  localStorage.setItem('dronehub_user', JSON.stringify(user));
  return user;
}

async function resetPasswordWithSupabase(email) {
  if (supabaseClient) {
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/login.html' });
    if (error) throw error;
    return data;
  }
  return { message: 'Instrucoes enviadas para ' + email };
}

function getCurrentUser() { return JSON.parse(localStorage.getItem('dronehub_user') || 'null'); }
function logoutUser() { localStorage.removeItem('dronehub_user'); if (supabaseClient) supabaseClient.auth.signOut(); window.location.href = 'login.html'; }

// ===== PROFILES =====
function saveProfile(userId, data) {
  const p = JSON.parse(localStorage.getItem('dronehub_profiles') || '{}');
  p[userId] = { ...p[userId], ...data };
  localStorage.setItem('dronehub_profiles', JSON.stringify(p));
  return p[userId];
}
function getProfile(userId) { return JSON.parse(localStorage.getItem('dronehub_profiles') || '{}')[userId] || {}; }

// ===== AIRCRAFT =====
function saveAircraft(userId, data) {
  if (!data.id) data.id = Date.now().toString();
  data.userId = userId;
  data.createdAt = data.createdAt || new Date().toISOString();
  const a = JSON.parse(localStorage.getItem('dronehub_aircraft') || '[]');
  const idx = a.findIndex(x => x.id === data.id && x.userId === userId);
  if (idx >= 0) { a[idx] = data; } else { a.push(data); }
  localStorage.setItem('dronehub_aircraft', JSON.stringify(a));
  return data;
}
function getAircraft(userId) { return JSON.parse(localStorage.getItem('dronehub_aircraft') || '[]').filter(a => a.userId === userId); }
function deleteAircraft(userId, id) {
  const a = JSON.parse(localStorage.getItem('dronehub_aircraft') || '[]').filter(x => !(x.userId === userId && x.id === id));
  localStorage.setItem('dronehub_aircraft', JSON.stringify(a));
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
  return data;
}
function getMissions(userId) { return JSON.parse(localStorage.getItem('dronehub_missoes') || '[]').filter(m => m.userId === userId); }
function deleteMission(userId, id) {
  const m = JSON.parse(localStorage.getItem('dronehub_missoes') || '[]').filter(x => !(x.userId === userId && x.id === id));
  localStorage.setItem('dronehub_missoes', JSON.stringify(m));
}

// ===== DOCUMENTS =====
function saveDocument(userId, data) {
  if (!data.id) data.id = Date.now().toString();
  data.userId = userId; data.createdAt = data.createdAt || new Date().toISOString();
  const d = JSON.parse(localStorage.getItem('dronehub_docs') || '[]');
  const idx = d.findIndex(x => x.id === data.id && x.userId === userId);
  if (idx >= 0) { d[idx] = data; } else { d.push(data); }
  localStorage.setItem('dronehub_docs', JSON.stringify(d));
  return data;
}
function getDocuments(userId) { return JSON.parse(localStorage.getItem('dronehub_docs') || '[]').filter(d => d.userId === userId); }
function deleteDocument(userId, id) {
  const d = JSON.parse(localStorage.getItem('dronehub_docs') || '[]').filter(x => !(x.userId === userId && x.id === id));
  localStorage.setItem('dronehub_docs', JSON.stringify(d));
}

// ===== TRANSACTIONS =====
function saveTransaction(userId, data) {
  if (!data.id) data.id = Date.now().toString();
  data.userId = userId; data.date = data.date || new Date().toISOString().split('T')[0];
  const t = JSON.parse(localStorage.getItem('dronehub_transactions') || '[]');
  const idx = t.findIndex(x => x.id === data.id && x.userId === userId);
  if (idx >= 0) { t[idx] = data; } else { t.push(data); }
  localStorage.setItem('dronehub_transactions', JSON.stringify(t));
  return data;
}
function getTransactions(userId) { return JSON.parse(localStorage.getItem('dronehub_transactions') || '[]').filter(t => t.userId === userId); }
function deleteTransaction(userId, id) {
  const t = JSON.parse(localStorage.getItem('dronehub_transactions') || '[]').filter(x => !(x.userId === userId && x.id === id));
  localStorage.setItem('dronehub_transactions', JSON.stringify(t));
}

// ===== CLIENTS =====
function saveClient(userId, data) {
  if (!data.id) data.id = Date.now().toString(); data.userId = userId; data.createdAt = data.createdAt || new Date().toISOString();
  const c = JSON.parse(localStorage.getItem('dronehub_clientes') || '[]');
  const idx = c.findIndex(x => x.id === data.id && x.userId === userId);
  if (idx >= 0) { c[idx] = data; } else { c.push(data); }
  localStorage.setItem('dronehub_clientes', JSON.stringify(c)); return data;
}
function getClients(userId) { return JSON.parse(localStorage.getItem('dronehub_clientes') || '[]').filter(c => c.userId === userId); }
function deleteClient(userId, id) {
  const c = JSON.parse(localStorage.getItem('dronehub_clientes') || '[]').filter(x => !(x.userId === userId && x.id === id));
  localStorage.setItem('dronehub_clientes', JSON.stringify(c));
}

// ===== BATTERIES =====
function saveBattery(userId, data) {
  if (!data.id) data.id = Date.now().toString(); data.userId = userId; data.createdAt = data.createdAt || new Date().toISOString();
  const b = JSON.parse(localStorage.getItem('dronehub_baterias') || '[]');
  const idx = b.findIndex(x => x.id === data.id && x.userId === userId);
  if (idx >= 0) { b[idx] = data; } else { b.push(data); }
  localStorage.setItem('dronehub_baterias', JSON.stringify(b)); return data;
}
function getBatteries(userId) { return JSON.parse(localStorage.getItem('dronehub_baterias') || '[]').filter(b => b.userId === userId); }
function deleteBattery(userId, id) {
  const b = JSON.parse(localStorage.getItem('dronehub_baterias') || '[]').filter(x => !(x.userId === userId && x.id === id));
  localStorage.setItem('dronehub_baterias', JSON.stringify(b));
}
