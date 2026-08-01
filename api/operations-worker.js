/* Drone Hub — operações, meteorologia e documentos assistidos por IA. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function reply(body, status = 200, cacheControl = 'public, max-age=600') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cacheControl, ...CORS }
  });
}

function validCoordinate(value, maximum) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= maximum ? number : null;
}

async function requirePro(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;
  const headers = { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers });
  if (!userResponse.ok) return false;
  const entitlementResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_my_entitlement`, {
    method: 'POST', headers, body: '{}'
  });
  if (!entitlementResponse.ok) return false;
  const entitlement = await entitlementResponse.json();
  const access = Array.isArray(entitlement) ? entitlement[0] : entitlement;
  return access && (access.role === 'admin' || access.plan === 'pro');
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return reply({ ok: true, service: 'dronehub-operations', updatedAt: new Date().toISOString() }, 200, 'no-store');
    }

    if (url.pathname === '/ai/document') {
      if (request.method !== 'POST') return reply({ error: 'Use POST para gerar um documento.' }, 405, 'no-store');
      if (!(await requirePro(request, env))) return reply({ error: 'Este recurso exige um plano Pro ativo.' }, 403, 'no-store');
      if (!env.AI) return reply({ error: 'A IA ainda não foi ativada neste ambiente.' }, 503, 'no-store');
      try {
        const payload = await request.json();
        const prompt = String(payload.prompt || '').trim().slice(0, 12000);
        if (!prompt) return reply({ error: 'Informe os dados do documento.' }, 400, 'no-store');

        const result = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
          messages: [
            {
              role: 'system',
              content: 'Você é um redator profissional brasileiro especializado em operações com drones. Redija em português do Brasil, com estrutura clara, títulos, cláusulas ou seções adequadas ao tipo de documento solicitado. Use apenas os dados recebidos. Não invente CNPJ, licenças, seguros, autorizações, valores, datas, garantias ou fatos. Nunca afirme que um voo foi autorizado por órgão oficial.'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1800
        });
        return reply({
          text: result.response || '',
          provider: 'Cloudflare Workers AI',
          generatedAt: new Date().toISOString()
        }, 200, 'no-store');
      } catch (error) {
        return reply({ error: 'Não foi possível gerar o documento agora.', detail: String(error && error.message || error) }, 502, 'no-store');
      }
    }

    if (url.pathname !== '/weather') {
      return reply({ error: 'Use /weather?lat=-22.90&lon=-43.17' }, 404, 'no-store');
    }

    const lat = validCoordinate(url.searchParams.get('lat'), 90);
    const lon = validCoordinate(url.searchParams.get('lon'), 180);
    if (lat === null || lon === null) {
      return reply({ error: 'Latitude e longitude válidas são obrigatórias.' }, 400, 'no-store');
    }

    const cacheKey = new Request(`${url.origin}/cache/weather?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      return new Response(cached.body, { headers: { ...Object.fromEntries(cached.headers), ...CORS, 'X-DroneHub-Cache': 'HIT' } });
    }

    const upstream = new URL('https://api.open-meteo.com/v1/forecast');
    upstream.searchParams.set('latitude', String(lat));
    upstream.searchParams.set('longitude', String(lon));
    upstream.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,is_day,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cloud_cover');
    upstream.searchParams.set('hourly', 'temperature_2m,precipitation_probability,precipitation,cloud_cover,visibility,uv_index,is_day,wind_speed_10m,wind_direction_10m,wind_gusts_10m,wind_speed_80m,wind_direction_80m,wind_speed_120m,wind_direction_120m');
    upstream.searchParams.set('daily', 'wind_speed_10m_max,wind_gusts_10m_max,precipitation_probability_max,sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max');
    upstream.searchParams.set('forecast_days', '4');
    upstream.searchParams.set('timezone', 'auto');

    try {
      const response = await fetch(upstream.toString(), { headers: { Accept: 'application/json' } });
      if (!response.ok) return reply({ error: 'Não foi possível consultar o provedor meteorológico.' }, 502, 'no-store');
      const weather = await response.json();
      let spaceWeather = null;
      try {
        const kpResponse = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
        if (kpResponse.ok) {
          const rows = await kpResponse.json();
          const latest = Array.isArray(rows) && rows.length > 1 ? rows[rows.length - 1] : null;
          const kp = latest ? Number(latest[1]) : NaN;
          if (Number.isFinite(kp)) spaceWeather = { kp, observed_at: latest[0], source: 'NOAA SWPC' };
        }
      } catch {}
      const output = reply({ source: 'Open-Meteo', refreshedAt: new Date().toISOString(), space_weather: spaceWeather, ...weather });
      ctx.waitUntil(cache.put(cacheKey, output.clone()));
      return new Response(output.body, { headers: { ...Object.fromEntries(output.headers), 'X-DroneHub-Cache': 'MISS' } });
    } catch {
      return reply({ error: 'Não foi possível consultar o provedor meteorológico.' }, 502, 'no-store');
    }
  },

  async scheduled(event, env, ctx) {
    if (env.OPERATIONS_KV) {
      ctx.waitUntil(env.OPERATIONS_KV.put('weather-service-heartbeat', JSON.stringify({ updatedAt: new Date().toISOString(), schedule: event.cron })));
    }
    if (env.SITE_URL && env.CRON_SECRET) {
      ctx.waitUntil(fetch(`${env.SITE_URL.replace(/\/$/, '')}/api/cron/subscription-expiry`, {
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` }
      }));
    }
  }
};
