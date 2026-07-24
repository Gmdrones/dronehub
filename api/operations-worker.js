/*
 * Drone Hub Operations Worker
 *
 * Public endpoint for weather used by the operational panel. It intentionally
 * contains no payment or AI credential and must be deployed as a separate
 * Worker from the Mercado Pago payment Worker.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
      ...CORS,
      ...extra
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({ ok: true, service: 'dronehub-operations', updatedAt: new Date().toISOString() });
    }
    if (url.pathname !== '/weather') return json({ error: 'Use /weather?lat=-22.90&lon=-43.17' }, 404);

    const lat = Number(url.searchParams.get('lat'));
    const lon = Number(url.searchParams.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return json({ error: 'Latitude e longitude válidas são obrigatórias.' }, 400);
    }

    const cache = caches.default;
    const cacheKey = new Request(url.origin + '/cache/weather?lat=' + lat.toFixed(4) + '&lon=' + lon.toFixed(4));
    const cached = await cache.match(cacheKey);
    if (cached) {
      return new Response(cached.body, {
        headers: { ...Object.fromEntries(cached.headers), ...CORS, 'X-DroneHub-Cache': 'HIT' }
      });
    }

    const upstream = new URL('https://api.open-meteo.com/v1/forecast');
    upstream.searchParams.set('latitude', lat);
    upstream.searchParams.set('longitude', lon);
    upstream.searchParams.set('current', 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cloud_cover');
    upstream.searchParams.set('daily', 'wind_speed_10m_max,wind_gusts_10m_max,precipitation_probability_max,sunrise,sunset');
    upstream.searchParams.set('forecast_days', '4');
    upstream.searchParams.set('timezone', 'auto');

    const response = await fetch(upstream.toString(), { headers: { Accept: 'application/json' } });
    if (!response.ok) return json({ error: 'Não foi possível consultar o provedor meteorológico.' }, 502);

    const payload = await response.json();
    const output = json({ source: 'Open-Meteo', refreshedAt: new Date().toISOString(), ...payload });
    ctx.waitUntil(cache.put(cacheKey, output.clone()));
    return new Response(output.body, { headers: { ...Object.fromEntries(output.headers), 'X-DroneHub-Cache': 'MISS' } });
  }
};
