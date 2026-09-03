const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const expiry = require('../js/admin-plan-expiry.js');
const now = '2026-09-03T12:00:00Z';
test('admin expiration distinguishes Free, admin, undated and expired Pro', () => {
  assert.equal(expiry({plan:'free'}, now).state, 'free');
  assert.equal(expiry({role:'admin',plan:'pro'}, now).detail, 'Acesso administrativo');
  assert.equal(expiry({plan:'pro'}, now).state, 'unlimited');
  assert.equal(expiry({plan:'pro',courtesy_expires_at:'invalid'}, now).state, 'unknown');
  assert.equal(expiry({plan:'pro',courtesy_expires_at:'2026-09-02'}, now).state, 'expired');
});
test('expiry shows Brasília date, today, tomorrow and remaining days', () => {
  const a = {plan:'pro',courtesy_expires_at:'2026-09-04T01:00:00Z'};
  assert.match(expiry(a,now).date,/03\/09\/2026/);
  assert.match(expiry(a,now).detail,/Vence hoje/);
  a.courtesy_expires_at = '2026-09-04T12:00:00Z';
  assert.match(expiry(a,now).detail,/Vence amanhã/);
  a.courtesy_expires_at = '2026-10-03T12:00:00Z';
  assert.match(expiry(a,now).detail,/30 dias/);
});
function checkout(user, sessionMode) {
  const nodes = {}, requests = [];
  function element(id) {
    if(!nodes[id]) { const classes = new Set();
      nodes[id] = {style:{},innerHTML:'',textContent:'',classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},addEventListener:(_,cb)=>{nodes[id].click=cb}};
    }
    return nodes[id];
  }
  const context = {document:{getElementById:element,querySelectorAll:()=>[]},window:{location:{search:'',href:''}},URLSearchParams,console,
    localStorage:{getItem:()=>JSON.stringify(user)},sessionStorage:{setItem(){}},
    supabaseClient:{auth:{getSession:async()=>{if(sessionMode==='error') throw Error('offline');return {data:{session:sessionMode==='expired'?null:{access_token:'mock-token'}}}}}},
    fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({id:'mock',init_point:'https://checkout.example.test'})}}};
  const html = fs.readFileSync(require.resolve('../precos.html'),'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  vm.runInNewContext(scripts.at(-1)[1],context);
  return {nodes,requests,context,run:()=>nodes.checkoutBtn.click.call(nodes.checkoutBtn)};
}
for(const plan of ['free','pro']) test(plan+' can start checkout with a valid session',async()=>{
  const h=checkout({plan,email:'test@example.test'},'valid');await h.run();
  assert.equal(h.requests.length,1);
  assert.equal(h.requests[0].options.headers.Authorization,'Bearer mock-token');
  assert.equal(h.context.window.location.href,'https://checkout.example.test');
  assert.equal(h.nodes.checkoutBtn.classList.contains('loading'),false);
});
for(const mode of ['expired','error']) test('session '+mode+' prevents checkout and releases button',async()=>{
  const h=checkout({plan:'pro'},mode);await h.run();
  assert.equal(h.requests.length,0);
  assert.equal(h.nodes.checkoutBtn.classList.contains('loading'),false);
  assert.match(h.nodes.mpMsg.textContent,/sessão/);
});
test('logged out user cannot create checkout',async()=>{
  const h=checkout(null,'valid');await h.run();assert.equal(h.requests.length,0);
});
test('admin loads expiry renderer before account table',()=>{
  const html=fs.readFileSync(require.resolve('../admin.html'),'utf8');
  assert.ok(html.indexOf('js/admin-plan-expiry.js')<html.indexOf('js/admin.js'));
  assert.match(html,/<th>Vencimento do Pro<\/th>/);
});
