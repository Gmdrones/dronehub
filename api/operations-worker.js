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

function validIcao(value) {
  const icao = String(value || '').trim().toUpperCase();
  return /^[A-Z]{4}$/.test(icao) ? icao : null;
}

function textValue(value) { return String(value == null ? '' : value).trim(); }
function numberValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined || String(value).trim() === '') continue;
    const number = Number(String(value == null ? '' : value).replace(',', '.'));
    if (Number.isFinite(number)) return number;
  }
  return null;
}
function distanceKm(lat1, lon1, lat2, lon2) {
  const radius = 6371, p = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * p / 2) ** 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin((lon2 - lon1) * p / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function findArrays(root, found = []) {
  if (Array.isArray(root)) { found.push(root); for (const item of root) findArrays(item, found); }
  else if (root && typeof root === 'object') for (const value of Object.values(root)) findArrays(value, found);
  return found;
}
function normalizeAerodromes(payload) {
  const arrays = findArrays(payload).sort((a, b) => b.length - a.length);
  for (const list of arrays) {
    const normalized = list.map((item) => {
      if (!item || typeof item !== 'object') return null;
      const icao = textValue(item.codigo_icao || item.icao || item.id_localidade || item.cod || item.code).toUpperCase();
      const latitude = numberValue(item.latitude_decimal, item.lat_dec, item.latitude, item.lat, item.latitude_dec);
      const longitude = numberValue(item.longitude_decimal, item.lon_dec, item.longitude, item.lon, item.lng, item.longitude_dec);
      if (!/^[A-Z]{4}$/.test(icao) || latitude === null || longitude === null) return null;
      const operations = textValue(item.operacao || item.tipo_operacao || item.regras_voo).toUpperCase();
      return {
        icao, name: textValue(item.nome || item.nome_aerodromo || item.name || icao),
        city: textValue(item.cidade || item.municipio || item.localidade), state: textValue(item.uf || item.estado),
        elevation_m: numberValue(item.altitude_m, item.altitude_metros, item.elevacao_m, item.altitude, item.elevation),
        latitude, longitude, ifr: Boolean(item.ifr || operations.includes('IFR')),
        vfr: Boolean(item.vfr || operations.includes('VFR'))
      };
    }).filter(Boolean);
    if (normalized.length) return normalized;
  }
  return [];
}

function xmlDecode(value) {
  return textValue(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function xmlTag(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match) return xmlDecode(match[1].replace(/<[^>]+>/g, ' '));
  }
  return '';
}
function normalizeNotams(xml, icao) {
  const blocks = [...xml.matchAll(/<(?:notam|item|record|row)(?:\s[^>]*)?>([\s\S]*?)<\/(?:notam|item|record|row)>/gi)].map((match) => match[1]);
  const source = blocks.length ? blocks : [xml];
  return source.map((block) => {
    const code = xmlTag(block, ['numero', 'number', 'notam', 'cod', 'codigo']);
    // No formato ICAO, o conteúdo operacional do NOTAM é publicado no campo E.
    const text = xmlTag(block, ['e', 'item_e', 'notam_text', 'texto_original', 'texto', 'text', 'descricao', 'description', 'mens', 'msg']);
    if (!code && !text) return null;
    const validFrom = xmlTag(block, ['dtInicio', 'inicio', 'valid_from', 'start', 'b']);
    const validTo = xmlTag(block, ['dtFim', 'fim', 'valid_to', 'end', 'c']);
    return { code: code || 'NOTAM', subject: xmlTag(block, ['assunto', 'subject', 'qcode', 'q']) || `Aviso para ${icao}`, text, valid_from: validFrom || null, valid_to: validTo || null, status: xmlTag(block, ['status', 'situacao']) || 'Em vigor', active: true };
  }).filter(Boolean);
}

async function aiswebNotams(icao, env) {
  if (!env.AISWEB_API_KEY || !env.AISWEB_API_PASS) throw new Error('Credenciais AISWEB não configuradas.');
  const upstream = new URL('https://api.decea.mil.br/aisweb/');
  upstream.searchParams.set('apiKey', env.AISWEB_API_KEY);
  upstream.searchParams.set('apiPass', env.AISWEB_API_PASS);
  upstream.searchParams.set('area', 'notam');
  upstream.searchParams.set('icaocode', icao);
  const response = await fetch(upstream, { headers: { Accept: 'application/xml,text/xml' } });
  const xml = await response.text();
  if (!response.ok) throw new Error(`AISWEB respondeu HTTP ${response.status}.`);
  if (/erro|invalid|negad|unauthor/i.test(xml) && !/<(?:notam|item|record|row)/i.test(xml)) throw new Error('AISWEB recusou a consulta.');
  return normalizeNotams(xml, icao);
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

async function redemet(path, env) {
  if (!env.REDEMET_API_KEY) {
    return { ok: false, status: 503, data: { error: 'REDEMET_API_KEY não configurada no Worker.' } };
  }
  const response = await fetch(`https://api-redemet.decea.mil.br${path}`, {
    headers: {
      Accept: 'application/json',
      'X-Api-Key': env.REDEMET_API_KEY
    }
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: response.ok, status: response.status, data };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return reply({ ok: true, service: 'dronehub-operations', redemet: Boolean(env.REDEMET_API_KEY), aisweb: Boolean(env.AISWEB_API_KEY && env.AISWEB_API_PASS), updatedAt: new Date().toISOString() }, 200, 'no-store');
    }

    // Toda a Central de Voo é Pro. A autorização é validada no servidor em
    // cada chamada; alterar o estado local do navegador não libera os dados.
    if (!(await requirePro(request, env))) {
      return reply({ error: 'A Central de Voo é exclusiva do plano Pro.' }, 403, 'no-store');
    }

    if (url.pathname === '/geocode') {
      const query = textValue(url.searchParams.get('q')).slice(0, 180);
      if (query.length < 2) return reply({ error: 'Informe uma cidade ou endereço.' }, 400, 'no-store');
      try {
        const upstream = new URL('https://nominatim.openstreetmap.org/search');
        upstream.searchParams.set('q', query); upstream.searchParams.set('format', 'jsonv2'); upstream.searchParams.set('addressdetails', '1'); upstream.searchParams.set('countrycodes', 'br'); upstream.searchParams.set('limit', '6');
        const response = await fetch(upstream, { headers: { Accept: 'application/json', 'User-Agent': 'DroneHub/1.0 (operations@dronehub.app.br)' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const rows = await response.json();
        const results = rows.map((item) => ({ latitude: Number(item.lat), longitude: Number(item.lon), name: item.display_name, city: item.address?.city || item.address?.town || item.address?.municipality || item.address?.village || '', state: item.address?.state || '' })).filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
        return reply({ source: 'OpenStreetMap Nominatim', results }, 200, 'public, max-age=86400');
      } catch (error) { return reply({ error: 'Não foi possível pesquisar a localização.', detail: String(error?.message || error) }, 502, 'no-store'); }
    }

    if (url.pathname === '/reverse-geocode') {
      const lat = validCoordinate(url.searchParams.get('lat'), 90), lon = validCoordinate(url.searchParams.get('lon'), 180);
      if (lat === null || lon === null) return reply({ error: 'Coordenadas inválidas.' }, 400, 'no-store');
      try {
        const upstream = new URL('https://nominatim.openstreetmap.org/reverse');
        upstream.searchParams.set('lat', String(lat)); upstream.searchParams.set('lon', String(lon)); upstream.searchParams.set('format', 'jsonv2'); upstream.searchParams.set('zoom', '16');
        const response = await fetch(upstream, { headers: { Accept: 'application/json', 'User-Agent': 'DroneHub/1.0 (operations@dronehub.app.br)' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`); const data = await response.json();
        return reply({ source: 'OpenStreetMap Nominatim', name: data.display_name || `${lat}, ${lon}` }, 200, 'public, max-age=86400');
      } catch (error) { return reply({ error: 'Não foi possível identificar a localização.', detail: String(error?.message || error) }, 502, 'no-store'); }
    }

    if (url.pathname === '/aviation/aerodromes') {
      try {
        const result = await redemet('/aerodromos/', env);
        return reply({ source: 'REDEMET/DECEA', fetchedAt: new Date().toISOString(), data: result.data }, result.ok ? 200 : result.status, result.ok ? 'public, max-age=86400' : 'no-store');
      } catch (error) {
        return reply({ error: 'Falha ao consultar aeródromos na REDEMET.', detail: String(error?.message || error) }, 502, 'no-store');
      }
    }

    if (url.pathname === '/aviation/nearest') {
      const lat = validCoordinate(url.searchParams.get('lat'), 90), lon = validCoordinate(url.searchParams.get('lon'), 180);
      if (lat === null || lon === null) return reply({ error: 'Coordenadas válidas são obrigatórias.' }, 400, 'no-store');
      try {
        const result = await redemet('/aerodromos/', env);
        if (!result.ok) return reply({ error: 'REDEMET não retornou os aeródromos.' }, result.status, 'no-store');
        const aerodromes = normalizeAerodromes(result.data).map((item) => ({ ...item, distance_km: distanceKm(lat, lon, item.latitude, item.longitude) })).sort((a, b) => a.distance_km - b.distance_km).slice(0, 8);
        return reply({ source: 'REDEMET/DECEA', fetchedAt: new Date().toISOString(), aerodromes }, 200, 'public, max-age=3600');
      } catch (error) { return reply({ error: 'Falha ao localizar aeródromos próximos.', detail: String(error?.message || error) }, 502, 'no-store'); }
    }

    if (url.pathname === '/aviation/notams') {
      const icao = validIcao(url.searchParams.get('icao'));
      if (!icao) return reply({ error: 'Informe um código ICAO válido.' }, 400, 'no-store');
      try { const notams = await aiswebNotams(icao, env); return reply({ source: 'AISWEB/DECEA', icao, fetchedAt: new Date().toISOString(), notams }, 200, 'public, max-age=300'); }
      catch (error) { return reply({ error: 'Falha ao consultar NOTAM na AISWEB.', detail: String(error?.message || error) }, 502, 'no-store'); }
    }

    if (url.pathname === '/radar/frames') {
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json'); if (!response.ok) throw new Error(`HTTP ${response.status}`); const data = await response.json();
        const observed = (data.radar?.past || []).slice(-8).map((frame) => ({ time: frame.time, type: 'observed', tile_url: `${url.origin}/radar/tile?path=${encodeURIComponent(frame.path)}&z={z}&x={x}&y={y}` }));
        const forecast = (data.radar?.nowcast || []).slice(0, 6).map((frame) => ({ time: frame.time, type: 'forecast', tile_url: `${url.origin}/radar/tile?path=${encodeURIComponent(frame.path)}&z={z}&x={x}&y={y}` }));
        const frames = observed.concat(forecast);
        return reply({ source: 'RainViewer', fetchedAt: new Date().toISOString(), mode: forecast.length ? 'observed-and-forecast' : 'observed-only', frames }, 200, 'public, max-age=120');
      } catch (error) { return reply({ error: 'Radar indisponível.', detail: String(error?.message || error) }, 502, 'no-store'); }
    }

    if (url.pathname === '/radar/tile') {
      const path = textValue(url.searchParams.get('path')), z = textValue(url.searchParams.get('z')), x = textValue(url.searchParams.get('x')), y = textValue(url.searchParams.get('y'));
      if (!/^\/v2\/radar\/[A-Za-z0-9_-]+$/.test(path) || !/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y) || Number(z) > 7) return new Response('Invalid tile', { status: 400, headers: CORS });
      const response = await fetch(`https://tilecache.rainviewer.com${path}/256/${z}/${x}/${y}/2/1_1.png`);
      return new Response(response.body, { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') || 'image/png', 'Cache-Control': 'public, max-age=300', ...CORS } });
    }

    if (url.pathname === '/aviation/metar' || url.pathname === '/aviation/taf') {
      const icao = validIcao(url.searchParams.get('icao'));
      if (!icao) return reply({ error: 'Informe um código ICAO válido, por exemplo SBRJ.' }, 400, 'no-store');
      const type = url.pathname.endsWith('/metar') ? 'metar' : 'taf';
      try {
        const result = await redemet(`/mensagens/${type}/${icao}`, env);
        return reply({ source: 'REDEMET/DECEA', type: type.toUpperCase(), icao, fetchedAt: new Date().toISOString(), data: result.data }, result.ok ? 200 : result.status, result.ok ? 'public, max-age=300' : 'no-store');
      } catch (error) {
        return reply({ error: `Falha ao consultar ${type.toUpperCase()} na REDEMET.`, detail: String(error?.message || error) }, 502, 'no-store');
      }
    }

    if (url.pathname === '/aviation/briefing') {
      const icao = validIcao(url.searchParams.get('icao'));
      if (!icao) return reply({ error: 'Informe um código ICAO válido, por exemplo SBRJ.' }, 400, 'no-store');
      try {
        const [metar, taf] = await Promise.all([
          redemet(`/mensagens/metar/${icao}`, env),
          redemet(`/mensagens/taf/${icao}`, env)
        ]);
        return reply({
          source: 'REDEMET/DECEA', icao, fetchedAt: new Date().toISOString(),
          metar: metar.data, taf: taf.data,
          status: { metar: metar.status, taf: taf.status }
        }, metar.ok || taf.ok ? 200 : 502, 'public, max-age=300');
      } catch (error) {
        return reply({ error: 'Falha ao consultar briefing aeronáutico.', detail: String(error?.message || error) }, 502, 'no-store');
      }
    }

    if (url.pathname === '/ai/document') {
      if (request.method !== 'POST') return reply({ error: 'Use POST para gerar um documento.' }, 405, 'no-store');
      if (!env.AI) return reply({ error: 'A IA ainda não foi ativada neste ambiente.' }, 503, 'no-store');
      try {
        const payload = await request.json();
        const prompt = String(payload.prompt || '').trim().slice(0, 12000);
        if (!prompt) return reply({ error: 'Informe os dados do documento.' }, 400, 'no-store');
        const result = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
          messages: [
            { role: 'system', content: 'Você é um redator profissional brasileiro especializado em operações com drones. Redija em português do Brasil, com estrutura clara. Use apenas os dados recebidos e nunca invente autorizações ou fatos.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1800
        });
        return reply({ text: result.response || '', provider: 'Cloudflare Workers AI', generatedAt: new Date().toISOString() }, 200, 'no-store');
      } catch (error) {
        return reply({ error: 'Não foi possível gerar o documento agora.', detail: String(error?.message || error) }, 502, 'no-store');
      }
    }

    if (url.pathname !== '/weather') {
      return reply({ error: 'Rota não encontrada.' }, 404, 'no-store');
    }

    const lat = validCoordinate(url.searchParams.get('lat'), 90);
    const lon = validCoordinate(url.searchParams.get('lon'), 180);
    if (lat === null || lon === null) return reply({ error: 'Latitude e longitude válidas são obrigatórias.' }, 400, 'no-store');

    const cacheKey = new Request(`${url.origin}/cache/weather?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return new Response(cached.body, { headers: { ...Object.fromEntries(cached.headers), ...CORS, 'X-DroneHub-Cache': 'HIT' } });

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
          const dataRows = Array.isArray(rows) ? rows.filter((row) => row && (Array.isArray(row) ? row[0] !== 'time_tag' : row.time_tag)) : [];
          const hourly = dataRows.slice(-24).map((row) => ({ observed_at: Array.isArray(row) ? row[0] : row.time_tag, kp: Number(Array.isArray(row) ? row[1] : (row.Kp ?? row.kp_index)) })).filter((row) => Number.isFinite(row.kp));
          const latest = hourly[hourly.length - 1];
          if (latest) spaceWeather = { kp: latest.kp, observed_at: latest.observed_at, source: 'NOAA SWPC', hourly };
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
    if (env.OPERATIONS_KV) ctx.waitUntil(env.OPERATIONS_KV.put('weather-service-heartbeat', JSON.stringify({ updatedAt: new Date().toISOString(), schedule: event.cron })));
    if (env.SITE_URL && env.CRON_SECRET) {
      ctx.waitUntil(fetch(`${env.SITE_URL.replace(/\/$/, '')}/api/cron/subscription-expiry`, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } }));
    }
  }
};
