# Endpoint de pagamento

O endpoint ativo do pagamento fica em `functions/api/payment/create.js`.

Em Cloudflare Pages, configure o segredo `MP_ACCESS_TOKEN` no painel do projeto.
Nunca inclua tokens, `client_secret` ou outras credenciais do Mercado Pago em arquivos publicados.

## Operações climáticas

`operations-worker.js` é um Worker independente da cobrança. Ele disponibiliza
`/weather?lat=&lon=` com cache de 10 minutos e a previsão para hoje + 3 dias.
O Worker não recebe credenciais de pagamento nem dados de usuário.
