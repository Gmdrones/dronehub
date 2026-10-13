const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {webcrypto} = require('node:crypto');
globalThis.crypto ||= webcrypto;
const root=join(__dirname,'..');
const securitySource=readFileSync(join(root,'functions/api/payment/payment-security.js'),'utf8');
const helpers=import('data:text/javascript;base64,'+Buffer.from(securitySource).toString('base64'));
const webhookSource=readFileSync(join(root,'functions/api/payment/webhook.js'),'utf8')
 .replace(/import\s*\{[\s\S]*?\}\s*from\s*'\.\.\/\.\.\/_lib\/server\.js';/,
   'const {json,supabaseAdmin,logIntegration,sendEmail}=globalThis.__webhookServerMocks;')
 .replace(/import\s*\{\s*verifyMercadoPagoSignature\s*,\s*validatePaymentPurchase\s*\}\s*from\s*'\.\/payment-security\.js';/,
   'const {verifyMercadoPagoSignature,validatePaymentPurchase}=globalThis.__webhookSecurityHelpers;');
globalThis.__webhookSecurityHelpers = null;
const writes=[];
const mail=[];
globalThis.__webhookServerMocks={
 json:(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}}),
 supabaseAdmin:async(_env,endpoint,opts)=>{writes.push({endpoint,body:JSON.parse(opts.body)});return [];},
 logIntegration:async()=>{},
 sendEmail:async(_env,message)=>{mail.push(message);return {};}
};
const user='11111111-1111-4111-8111-111111111111';
const secret='MOCK_TEST_WEBHOOK_SECRET';
const timestamp='1790000000';
const requestId='test-mp-request-id';
const pid='99901234';
const payload=(overrides={})=>({
 id:pid, status:'approved',transaction_amount:358.80,currency_id:'BRL',
 external_reference:user,metadata:{user_id:user,plan:'annual',months:12,email:'pilot@example.com'},
 payer:{email:'pilot@example.com'}, ...overrides
});
async function requestForId(id, signed=true){
 const manifest=`id:${id};request-id:${requestId};ts:${timestamp};`;
 const enc=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,enc.encode(manifest))).toString('hex');
 return new Request('https://dronehub.app.br/api/payment/webhook',{
  method:'POST',headers:{
   'content-type':'application/json',
   'x-request-id':requestId,
   'x-signature':`ts=${timestamp},v1=${signed?sig:'0'.repeat(64)}`
  },
  body:JSON.stringify({type:'payment',data:{id}})
 });
}
async function setup(){
 globalThis.__webhookSecurityHelpers=await helpers;
 const module=import('data:text/javascript;base64,'+Buffer.from(webhookSource).toString('base64'));
 return module;
}
async function execute(mpPayment,{signed=true,id=pid}={}){
 writes.length=0;mail.length=0;
 const previous=globalThis.fetch;
 let consulted=0;
 globalThis.fetch=async(url)=>{
  consulted++;
  assert.equal(url,`https://api.mercadopago.com/v1/payments/${id}`);
  return new Response(JSON.stringify(mpPayment),{status:200});
 };
 try{
  const {onRequestPost}=await setup();
  const res=await onRequestPost({request:await requestForId(id,signed),env:{
   MERCADO_PAGO_WEBHOOK_SECRET:secret,MERCADO_PAGO_ACCESS_TOKEN:'MOCK_ONLY',
   SITE_URL:'https://dronehub.app.br'
  }});
  return {status:res.status,body:await res.json(),consulted,writes:[...writes],mail:[...mail]};
 }finally{globalThis.fetch=previous;}
}
test('valid signed annual payment is recorded and grants 12 months exactly once per call',async()=>{
 const result=await execute(payload());
 assert.equal(result.status,200);
 assert.equal(result.consulted,1);
 const transaction=result.writes.find(e=>e.endpoint.startsWith('payment_transactions'));
 const grant=result.writes.find(e=>e.endpoint==='rpc/apply_payment_entitlement');
 assert.ok(transaction,'Transaction was not saved');
 assert.equal(transaction.body.amount,358.80);
 assert.equal(transaction.body.currency,'BRL');
 assert.equal(transaction.body.status,'approved');
 assert.deepEqual(grant.body,{target_user:user,payment_status:'approved',access_months:12,payment_reference:pid});
 assert.equal(result.mail.length,1);
});
test('invalid webhook signature never contacts the payment provider or modifies database',async()=>{
 const result=await execute(payload(),{signed:false});
 assert.equal(result.status,401);
 assert.equal(result.consulted,0);
 assert.equal(result.writes.length,0);
 assert.equal(result.mail.length,0);
});
test('wrong payment amount is rejected before entitlement or transaction writes',async()=>{
 const result=await execute(payload({transaction_amount:357.80}));
 assert.equal(result.status,422);
 assert.equal(result.writes.length,0);
});
test('foreign user id and wrong currency are rejected before entitlement writes',async()=>{
 for(const p of [
   payload({metadata:{user_id:'22222222-2222-4222-8222-222222222222',plan:'annual',months:12}}),
   payload({currency_id:'USD'})
 ]){
  const res=await execute(p);
  assert.equal(res.status,422);
  assert.equal(res.writes.length,0);
 }
});
test('mismatched Mercado Pago payment ID cannot activate PRO',async()=>{
 const res=await execute(payload({id:'another-payment'}));
 assert.equal(res.status,500);
 assert.equal(res.writes.length,0);
});
test('pending signed payments are recorded but cannot grant PRO',async()=>{
 const res=await execute(payload({status:'pending'}));
 assert.equal(res.status,200);
 const grant=res.writes.find(e=>e.endpoint==='rpc/apply_payment_entitlement');
 assert.equal(grant.body.payment_status,'pending');
 assert.equal(res.mail.length,0);
});
