const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {webcrypto} = require('node:crypto');
globalThis.crypto ||= webcrypto;

const source = readFileSync(join(__dirname,'../functions/api/payment/payment-security.js'),'utf8');
const security = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const plan = {userId:'11111111-1111-4111-8111-111111111111',planKey:'monthly',months:1};
const payment = {transaction_amount:45,currency_id:'BRL',external_reference:plan.userId,metadata:{user_id:plan.userId}};

test('validates plan, amount, currency and user reference',async()=>{
 const {validatePaymentPurchase}=await security;
 assert.doesNotThrow(()=>validatePaymentPurchase(payment,plan));
 for(const invalid of [
  {...payment,transaction_amount:1},
  {...payment,currency_id:'USD'},
  {...payment,metadata:{user_id:'other'}},
 ]) assert.throws(()=>validatePaymentPurchase(invalid,plan));
 assert.throws(()=>validatePaymentPurchase(payment,{...plan,months:12}));
 assert.throws(()=>validatePaymentPurchase(payment,{...plan,planKey:'unknown'}));
});

test('accepts valid Mercado Pago HMAC and rejects changed request ID',async()=>{
 const {verifyMercadoPagoSignature}=await security;
 const id='1234', requestId='random-id', ts='1790000000', secret='sample-test-secret';
 const enc=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hex=Buffer.from(await crypto.subtle.sign('HMAC',key,enc.encode(`id:${id};request-id:${requestId};ts:${ts};`))).toString('hex');
 const makeRequest=(requestId)=>({headers:new Headers({'x-request-id':requestId,'x-signature':`ts=${ts},v1=${hex}`})});
 await assert.doesNotReject(()=>verifyMercadoPagoSignature(makeRequest(requestId),{MERCADO_PAGO_WEBHOOK_SECRET:secret},id));
 await assert.rejects(()=>verifyMercadoPagoSignature(makeRequest('wrong'),{MERCADO_PAGO_WEBHOOK_SECRET:secret},id));
 await assert.rejects(()=>verifyMercadoPagoSignature(makeRequest(requestId),{},id));
});
