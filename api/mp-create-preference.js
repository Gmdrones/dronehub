// DRONE HUB — WORKER MERCADO PAGO
// Cria preferência de pagamento via OAuth client_credentials

const CLIENT_ID = '4934588586838432';
const CLIENT_SECRET = 'APP_USR-4934588586838432-030918-8a7b3c2d1e5f6a7b8c9d0e1f2a3b4c5d-241983636';
const API_BASE = 'https://api.mercadopago.com';

addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors, status: 204 });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });
  }

  try {
    const body = await request.json();

    // Step 1: Get access token via client_credentials
    const tokenRes = await fetch(`${API_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_secret: CLIENT_SECRET,
        client_id: CLIENT_ID,
        grant_type: 'client_credentials',
        test_token: false
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return new Response(JSON.stringify({
        error: 'Falha ao obter token',
        details: tokenData
      }), { status: 500, headers: cors });
    }

    const accessToken = tokenData.access_token;

    // Step 2: Create preference
    const prefRes = await fetch(`${API_BASE}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        items: body.items || [{
          title: 'Drone Hub Pro',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: 358.80
        }],
        payer: body.payer || {
          name: 'Usuário',
          email: 'usuario@email.com'
        },
        back_urls: body.back_urls || {
          success: `${url.origin}/precos.html?status=success`,
          failure: `${url.origin}/precos.html?status=failure`,
          pending: `${url.origin}/precos.html?status=pending`
        },
        auto_return: 'approved',
        external_reference: body.external_reference || `dh_${Date.now()}`,
        payment_methods: { installments: 12 },
        statement_descriptor: 'DRONE HUB'
      })
    });

    const prefData = await prefRes.json();

    if (prefData.id) {
      return new Response(JSON.stringify({
        id: prefData.id,
        init_point: prefData.init_point
      }), { status: 200, headers: cors });
    }

    return new Response(JSON.stringify({
      error: 'Falha ao criar preferência',
      details: prefData
    }), { status: 500, headers: cors });

  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Erro interno',
      message: err.message
    }), { status: 500, headers: cors });
  }
}