const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

async function getUser(request, env) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Faça login para continuar.'), { status: 401 });
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw Object.assign(new Error('Sessão inválida ou expirada.'), { status: 401 });
  return response.json();
}

async function supabaseAdmin(env, path, options = {}) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.');
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.error || `Supabase ${response.status}`);
  return data;
}

async function logIntegration(env, service, event, level, details = {}, userId = null) {
  try {
    await supabaseAdmin(env, 'integration_events', {
      method: 'POST',
      body: JSON.stringify({ service, event, level, details, user_id: userId })
    });
  } catch (_) {}
}

async function sendEmail(env, message) {
  if (!env.BREVO_API_KEY) return false;
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Drone Hub', email: env.EMAIL_FROM || 'contato@dronehub.app.br' },
      to: [{ email: message.to, name: message.name || message.to }],
      subject: message.subject,
      htmlContent: message.html
    })
  });
  if (!response.ok) throw new Error(`Brevo ${response.status}: ${await response.text()}`);
  return true;
}

export { json, getUser, supabaseAdmin, logIntegration, sendEmail };
