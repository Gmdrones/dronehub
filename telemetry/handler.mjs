import { normalizeFlight } from './normalize.mjs';
import { batteryCounter } from './battery-counter.mjs';
const MAX_BYTES = 10 * 1024 * 1024;
export function createHandler(DJILog, fetcher = fetch) {
  return async function handle(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGIN || 'https://dronehub.app.br';
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
    if (origin === allowed) Object.assign(headers, { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' });
    const reply = (body, status) => new Response(JSON.stringify(body), { status, headers });
    if (origin && origin !== allowed) return reply({ error: 'Origem não autorizada.' }, 403);
    if (new URL(request.url).pathname !== '/flight-log') return reply({ error: 'Não encontrado.' }, 404);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
    const token = request.headers.get('Authorization') || '';
    if (!/^Bearer [^\s]+$/.test(token)) return reply({ error: 'Faça login para importar.' }, 401);
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.DJI_API_KEY) return reply({ error: 'Decodificador ainda não configurado.' }, 503);
    try {
      const authHeaders = { apikey: env.SUPABASE_ANON_KEY, Authorization: token, 'Content-Type': 'application/json' };
      const auth = await fetcher(`${env.SUPABASE_URL}/auth/v1/user`, { headers: authHeaders, signal: AbortSignal.timeout(10000) });
      if (!auth.ok) return reply({ error: 'Sessão inválida.' }, 401);
      const accessResponse = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/get_my_entitlement`, { method: 'POST', headers: authHeaders, body: '{}', signal: AbortSignal.timeout(10000) });
      if (!accessResponse.ok) return reply({ error: 'Não foi possível validar o plano.' }, 503);
      const payload = await accessResponse.json();
      const access = Array.isArray(payload) ? payload[0] : payload;
      const expiry = access?.courtesy_expires_at || access?.expires_at;
      const active = access?.status === 'active' && (!expiry || (Number.isFinite(Date.parse(expiry)) && Date.parse(expiry) > Date.now()));
      if (!(active && (access.plan === 'pro' || access.role === 'admin'))) return reply({ error: 'Importação completa é um recurso Pro.' }, 403);
      if (Number(request.headers.get('Content-Length')) > MAX_BYTES) return reply({ error: 'Arquivo excede 10 MB.' }, 413);
      if (!(request.headers.get('Content-Type') || '').startsWith('application/octet-stream')) return reply({ error: 'Envie o FlightRecord original.' }, 415);
      const reader = request.body?.getReader();
      if (!reader) return reply({ error: 'Arquivo vazio.' }, 400);
      const chunks = []; let length = 0;
      for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > MAX_BYTES) { await reader.cancel(); return reply({ error: 'Arquivo excede 10 MB.' }, 413); } chunks.push(value); }
      if (length < 100) return reply({ error: 'Arquivo incompleto.' }, 400);
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      let parser;
      try {
        parser = new DJILog(bytes);
        const version = parser.version, details = parser.details;
        // DJI receives only the keychain request, never the entire log or extracted route.
        const keychains = version >= 13 ? await parser.fetchKeychains(env.DJI_API_KEY) : undefined;
        const frames = parser.frames(keychains);
        if (!frames.length) return reply({ error: 'O arquivo não contém registros decodificáveis.' }, 422);
        const output = normalizeFlight(version, details, frames);
        const records = typeof parser.records === 'function' ? parser.records(keychains) : [];
        output.batteryCounter = batteryCounter(details, records);
        output.quality = { unknownRecords: records.filter(r=>r.type==='Unknown').length, invalidRecords: records.filter(r=>r.type==='Invalid').length, totalRecords: records.length };
        output.quality.partial = output.quality.unknownRecords > 0 || output.quality.invalidRecords > 0;
        output.firmware = [...new Map(records.filter(r=>r.type==='Firmware').map(r=>[r.content.senderType + ':' + r.content.version,{component:r.content.senderType,version:r.content.version}])).values()];
        // New aircraft layouts may report distance in a different unit. Do not silently
        // assume meters or scale by 1000 when the aircraft type is unsupported.
        if (typeof details.productType === 'object') { output.summary.distanceM = null; output.limitations.push('Distância total indisponível: modelo não reconhecido pelo decodificador.'); }
        return reply(output, 200);
      } catch { return reply({ error: 'Não foi possível decodificar o log. Verifique o arquivo original e a ativação da chave DJI.' }, 422); }
      finally { parser?.free(); }
    } catch { return reply({ error: 'Serviço temporariamente indisponível.' }, 503); }
  };
}
