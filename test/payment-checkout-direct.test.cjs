const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {webcrypto} = require('node:crypto');
globalThis.crypto ||= webcrypto;
const uuid = '11111111-1111-4111-8111-111111111111';
const member = {id:uuid,email:'pilot@example.com',user_metadata:{full_name:'Pilot'}};
const source = readFileSync(join(__dirname,'../functions/api/payment/create.js'),'utf8')
  .replace(/import\s*\{[\s\S]*?\}\s*from\s*'\.\.\/\.\.\/_lib\/server\.js';/,
    'const {json,getUser,logIntegration,sendEmail} = globalThis.__checkoutServerMocks;');
globalThis.__checkoutServerMocks = {
  json: (body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}}),
  getUser:async()=>member,
  logIntegration:async()=>{},
  sendEmail:async()=>{}
};
const handler=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const env={SITE_URL:'https://dronehub.app.br',MERCADO_PAGO_ACCESS_TOKEN:'TEST_ONLY'};
function req(plan){
 return new Request('https://dronehub.app.br/api/payment/create',{
  method:'POST',headers:{'content-type':'application/json','authorization':'Bearer stub'},
  body:JSON.stringify({plan})
 });
}
async function withFakeMercadoPago(plan,verify){
 const previous=globalThis.fetch;
 let hits=0;
 globalThis.fetch=async(url,init)=>{
   assert.equal(url,'https://api.mercadopago.com/checkout/preferences');
   assert.equal(init.method,'POST');
   hits++;
   verify(JSON.parse(init.body));
   return new Response(JSON.stringify({id:'pref-123',init_point:'https://www.mercadopago.com.br/checkout/v1/redirect'}),{
    status:201,headers:{'content-type':'application/json'}});
 };
 try{
  const {onRequestPost}=await handler;
  const response=await onRequestPost({request:req(plan),env});
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.route,'pages');
  assert.equal(hits,1,'Should only create one preference');
 }finally{globalThis.fetch=previous}
}

test('direct monthly checkout advertises BRL 45.00 and allows buyer to select up to 12 installments',async()=>{
 await withFakeMercadoPago('monthly',p=>{
  assert.equal(p.items[0].unit_price,45);
  assert.equal(p.items[0].currency_id,'BRL');
  assert.equal(p.metadata.plan,'monthly');
  assert.equal(p.metadata.months,1);
  assert.equal(p.external_reference,uuid);
  assert.equal(p.notification_url,'https://dronehub.app.br/api/payment/webhook');
  assert.equal(p.payment_methods.installments,12);
 });
});
test('direct annual checkout advertises BRL 358.80 and allows up to 12 installments',async()=>{
 await withFakeMercadoPago('annual',p=>{
  assert.equal(p.items[0].unit_price,358.80);
  assert.equal(p.items[0].currency_id,'BRL');
  assert.equal(p.metadata.plan,'annual');
  assert.equal(p.metadata.months,12);
  assert.equal(p.payment_methods.installments,12);
 });
});
test('unknown plan never reaches payment provider or defaults to expensive annual plan',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>{throw new Error('Should never create payment preference');};
 try{
  const {onRequestPost}=await handler;
  for(const plan of ['unexpected',null,'']){
   const res=await onRequestPost({request:req(plan),env});
   assert.equal(res.status,400);
  }
 }finally{globalThis.fetch=previous}
});
test('failed direct checkout does not silently invoke unconfigured legacy Worker',async()=>{
 const previous=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async(url)=>{
  calls++;
  assert.equal(url,'https://api.mercadopago.com/checkout/preferences');
  return new Response(JSON.stringify({message:'temporary provider issue'}),{status:502});
 };
 try{
  const {onRequestPost}=await handler;
  const res=await onRequestPost({request:req('annual'),env});
  assert.equal(res.status,502);
  assert.equal(calls,1);
 }finally{globalThis.fetch=previous}
});
