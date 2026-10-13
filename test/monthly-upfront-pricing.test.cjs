const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {webcrypto} = require('node:crypto');
globalThis.crypto ||= webcrypto;

const root = join(__dirname, '..');
const pricePage = readFileSync(join(root, 'precos.html'), 'utf8');
const serverSource = readFileSync(join(root, 'functions/api/payment/create.js'), 'utf8')
  .replace(/import\s*\{[\s\S]*?\}\s*from\s*'\.\.\/\.\.\/_lib\/server\.js';/,
    'const {json,getUser,logIntegration,sendEmail}=globalThis.__monthlyPriceMocks;');
const user = {id:'11111111-1111-4111-8111-111111111111',email:'pilot@example.com',user_metadata:{full_name:'Pilot'}};
globalThis.__monthlyPriceMocks = {
  json:(body,status=200)=>new Response(JSON.stringify(body),{status}),
  getUser:async()=>user,
  logIntegration:async()=>{},
  sendEmail:async()=>{}
};
const handler = import('data:text/javascript;base64,' + Buffer.from(serverSource).toString('base64'));
const baseEnv = {SITE_URL:'https://dronehub.app.br',MERCADO_PAGO_ACCESS_TOKEN:'MOCK_TOKEN'};
const request = plan => new Request('https://dronehub.app.br/api/payment/create',{
  method:'POST',headers:{'content-type':'application/json','authorization':'Bearer mock'},
  body:JSON.stringify({plan})
});

test('pricing page advertises monthly 45 BRL only upfront and annual up to 12x',()=>{
  assert.match(pricePage,/Mensal<span class="small">30 dias · R\$ 45,00 à vista<\/span>/);
  assert.match(pricePage,/headline: 'R\$ 45,00 à vista'/);
  assert.match(pricePage,/sub: 'Pagamento único, sem parcelamento · 30 dias de acesso'/);
  assert.match(pricePage,/plan === 'monthly' \? 'Somente à vista \(1x\)' : 'Até 12x sem juros'/);
  assert.match(pricePage,/12x de R\$ 29,90/);
});

test('monthly payment preference uses one installment and total 45 BRL',async()=>{
  const oldFetch = globalThis.fetch;
  let calls=0;
  globalThis.fetch=async(url,init)=>{
    calls++;
    assert.equal(url,'https://api.mercadopago.com/checkout/preferences');
    const pref = JSON.parse(init.body);
    assert.equal(pref.items[0].unit_price,45);
    assert.equal(pref.items[0].currency_id,'BRL');
    assert.equal(pref.payment_methods.installments,1);
    return new Response(JSON.stringify({id:'mock-pref',init_point:'https://checkout.mercadopago.com/redirect'}),{status:201});
  };
  try {
    const {onRequestPost}=await handler;
    const res=await onRequestPost({request:request('monthly'),env:baseEnv});
    assert.equal(res.status,200);
    assert.equal(calls,1);
  } finally {globalThis.fetch=oldFetch}
});

test('annual checkout keeps 358.80 BRL with up to 12 installments',async()=>{
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async(url,init)=>{
    const pref=JSON.parse(init.body);
    assert.equal(pref.items[0].unit_price,358.8);
    assert.equal(pref.payment_methods.installments,12);
    return new Response(JSON.stringify({id:'mock-annual',init_point:'https://checkout.mercadopago.com/redirect'}),{status:201});
  };
  try {
    const {onRequestPost}=await handler;
    const res=await onRequestPost({request:request('annual'),env:baseEnv});
    assert.equal(res.status,200);
  } finally {globalThis.fetch=oldFetch}
});

test('monthly checkout never falls back to legacy Worker when provider fails',async()=>{
  const oldFetch=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async(url)=>{
    calls++;
    assert.equal(url,'https://api.mercadopago.com/checkout/preferences');
    return new Response(JSON.stringify({message:'Mock failure'}),{status:502});
  };
  try {
    const {onRequestPost}=await handler;
    const res=await onRequestPost({request:request('monthly'),env:baseEnv});
    assert.equal(res.status,502);
    assert.equal(calls,1);
  } finally {globalThis.fetch=oldFetch}
});

test('monthly checkout with no configured main token cannot use legacy Worker',async()=>{
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('Legacy worker must not be called')};
  try {
    const {onRequestPost}=await handler;
    const res=await onRequestPost({request:request('monthly'),env:{SITE_URL:'https://dronehub.app.br'}});
    assert.equal(res.status,502);
  } finally {globalThis.fetch=oldFetch}
});
