const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('pricing advertisement matches both checkout implementations and 12x maximum',()=>{
 const root=path.join(__dirname,'..');
 const pricing=fs.readFileSync(path.join(root,'precos.html'),'utf8');
 const direct=fs.readFileSync(path.join(root,'functions/api/payment/create.js'),'utf8');
 const fallback=fs.readFileSync(path.join(root,'workers/dronehub-payment/index.js'),'utf8');

 const literal=pricing.match(/var PLANOS\s*=\s*(\{[^\n]+\})\s*;/);
 assert.ok(literal,'Pricing page must declare advertised plan amounts');
 const offers=vm.runInNewContext('('+literal[1]+')');
 assert.equal(offers.annual.total,358.80);
 assert.equal(offers.monthly.total,45.00);
 assert.match(offers.annual.headline,/12x de R\$ 29,90/);

 for(const [label,source] of [['Pages checkout',direct],['fallback Worker',fallback]]){
   for(const [plan,price] of [['annual',358.80],['monthly',45.00]]){
     const block=source.match(new RegExp(plan+':\\s*\\{[^}]+\\}'))?.[0];
     assert.ok(block,label+' must include '+plan);
     const numeric=Number(block.match(/amount:\s*(\d+(?:\.\d+)?)/)?.[1]);
     assert.equal(numeric,price,label+' '+plan+' amount differs from advertisement');
   }
   assert.match(source,/payment_methods:\s*\{\s*installments:\s*(?:12|MAX_INSTALLMENTS)\s*\}/,
     label+' must allow buyer to choose up to 12 installments');
 }
});
