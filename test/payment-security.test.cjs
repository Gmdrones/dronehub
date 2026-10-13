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

test('annual plan must match BRL 358.80 and 12 months',async()=>{
 const {validatePaymentPurchase}=await security;
 const annual={...plan,planKey:'annual',months:12};
 const approved={...payment,transaction_amount:358.80};
 assert.doesNotThrow(()=>validatePaymentPurchase(approved,annual));
 assert.throws(()=>validatePaymentPurchase({...approved,transaction_amount:45},annual));
 assert.throws(()=>validatePaymentPurchase({...approved,currency_id:'USD'},annual));
});

test('rejects unsigned and malformed notifications',async()=>{
 const {verifyMercadoPagoSignature}=await security;
 const base={MERCADO_PAGO_WEBHOOK_SECRET:'test-secret'};
 for(const headers of [
   {'x-request-id':'a'},
   {'x-request-id':'a','x-signature':'ts=123,v1=invalid'},
   {'x-signature':'ts=123,v1='+'0'.repeat(64)},
 ]) await assert.rejects(()=>verifyMercadoPagoSignature({headers:new Headers(headers)},base,'123'));
});
