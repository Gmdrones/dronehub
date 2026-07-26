const PAYMENT_WORKER_URL = 'https://dronehub-payment.primesecureconsultoria.workers.dev/api/payment/create';

export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return Response.json({ error: 'Método não permitido' }, { status: 405 });
  }

  try {
    const body = await context.request.text();
    const upstream = await fetch(PAYMENT_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return Response.json({
      error: 'Pagamento temporariamente indisponível',
      message: error instanceof Error ? error.message : 'Falha de comunicação com o provedor.'
    }, { status: 502 });
  }
}
