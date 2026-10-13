const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {webcrypto} = require('node:crypto');
globalThis.crypto ||= webcrypto;
const source = readFileSync(join(__dirname, '../workers/dronehub-payment/index.js'),'utf8');
const workerModule = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const user = '11111111-1111-4111-8111-111111111111';
const secret = 'a'.repeat(64);
const env = {MP_ACCESS_TOKEN:'fake-test-token',DRONEHUB_WORKER_SHARED_SECRET:secret};
const request = (key, plan='monthly') => new Request('https://example.workers.dev/api/payment/create', {
 method:'POST', headers:{'Content-Type':'application/json','x-dronehub-worker-key':key},
 body:JSON.stringify({plan,external_reference:user,payer:{email:'pilot@example.com',name:'Pilot'}})
});

test('worker rejects unauthenticated requests before contacting Mercado Pago',async()=>{
 const {default:worker}=await workerModule;
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>{throw Error('Unexpected payment network call');};
 try{
  assert.equal((await worker.fetch(request('wrong'),env)).status,401);
  assert.equal((await worker.fetch(request(secret),{MP_ACCESS_TOKEN:'fake'})).status,503);
  assert.equal((await worker.fetch(request(secret,'invalid'),env)).status,400);
 }finally{globalThis.fetch=previous;}
});

test('worker preserves monthly BRL 45.00 and offers buyer up to 12 installments',async()=>{
 const {default:worker}=await workerModule;
 const previous=globalThis.fetch;
 let captured;
 globalThis.fetch=async(url,init)=>{
   assert.equal(url,'https://api.mercadopago.com/checkout/preferences');
   captured=JSON.parse(init.body);
   return new Response(JSON.stringify({id:'preference-123',init_point:'https://www.mercadopago.com.br/checkout'}),{status:201});
 };
 try{
  const res=await worker.fetch(request(secret),env);
  assert.equal(res.status,200);
  assert.equal((await res.json()).flow_revision,'worker_safe_v2');
  assert.equal(captured.external_reference,user);
  assert.deepEqual({plan:captured.metadata.plan,months:captured.metadata.months},{plan:'monthly',months:1});
  assert.equal(captured.notification_url,'https://dronehub.app.br/api/payment/webhook');
  assert.equal(captured.back_urls.success,'https://dronehub.app.br/precos?status=success');
  assert.equal(captured.payment_methods.installments,12);
  assert.equal(captured.items[0].unit_price,45);
 }finally{globalThis.fetch=previous;}
});

test('annual Worker checkout preserves advertised BRL 358.80 and allows up to 12 installments',async()=>{
 const {default:worker}=await workerModule;
 const previous=globalThis.fetch;
 let captured;
 globalThis.fetch=async(_url,init)=>{
   captured=JSON.parse(init.body);
   return new Response(JSON.stringify({id:'pref-anual',init_point:'https://mercadopago.com.br/checkout'}),{status:201});
 };
 try{
   assert.equal((await worker.fetch(request(secret,'annual'),env)).status,200);
   assert.equal(captured.metadata.months,12);
   assert.equal(captured.items[0].currency_id,'BRL');
   assert.equal(captured.items[0].unit_price,358.80);
   assert.equal(captured.payment_methods.installments,12);
 }finally{globalThis.fetch=previous;}
});
