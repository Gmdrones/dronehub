const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = file => import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(file,'utf8')).toString('base64'));
const modulePromise = load('functions/_lib/renewal.js');
const NOW = Date.parse('2026-09-29T12:00:00Z'), DAY = 86400000;
const account = days => ({user_id:'pilot-1',plan:'pro',status:'active',role:'pilot',courtesy_expires_at:new Date(NOW+days*DAY).toISOString()});
function fixture(a = account(4)) {
  const ledger = new Map(), sends = [];
  const state = { fresh:a, profile:{email:'pilot@example.test',email_confirmed_at:'2026-01-01',user_metadata:{full_name:'Piloto'}}, sends, ledger };
  state.deps = {now:()=>NOW, getProfile:async()=>state.profile, send:async message=>{sends.push(message);return {messageId:'test-id'};}, db:async(path, options)=>{
    if(path.startsWith('account_entitlements')) return path.includes('order=') ? (path.includes('user_id=gt.')?[]:[a]) : [state.fresh];
    const data=JSON.parse(options.body);
    if(options.method==='POST') {const key=[data.user_id,data.expires_at,data.stage].join('|');if(ledger.has(key))return [];const row={...data,id:key};ledger.set(key,row);return [row];}
    Object.assign(ledger.get(path.split('id=eq.')[1]),data);return [];
  }};
  return state;
}
test('renewal windows, catch-up at four days, and exclusions',async()=>{
  const {renewalStage}=await modulePromise;
  for(const [days,stage] of [[8,null],[7,7],[4,7],[3,3],[1,1],[0,null],[-1,null]]) assert.equal(renewalStage(account(days),NOW),stage);
  for(const override of [{role:'admin'},{plan:'free'},{status:'expired'},{courtesy_expires_at:'invalid'},{courtesy_expires_at:null}]) assert.equal(renewalStage({...account(4),...override},NOW),null);
});
test('concurrent runs and later repeats send once per stage',async()=>{
  const {runRenewals}=await modulePromise;const f=fixture();
  const results=await Promise.all([runRenewals(f.deps),runRenewals(f.deps)]);
  assert.equal(f.sends.length,1);assert.equal(results.reduce((n,r)=>n+r.accepted,0),1);
  await runRenewals(f.deps);assert.equal(f.sends.length,1);
});
test('renewal or ban before send suppresses reminder',async()=>{
  const {runRenewals}=await modulePromise;const f=fixture();f.fresh=account(30);await runRenewals(f.deps);assert.equal(f.sends.length,0);
  const blocked=fixture();blocked.profile.banned_until=new Date(NOW+DAY).toISOString();await runRenewals(blocked.deps);assert.equal(blocked.sends.length,0);
});
test('dry run has no writes or emails',async()=>{
  const {runRenewals}=await modulePromise;const f=fixture();const r=await runRenewals(f.deps,true);
  assert.equal(r.eligible,1);assert.equal(f.ledger.size,0);assert.equal(f.sends.length,0);
});
test('ambiguous provider outcome is retained and never automatically resent',async()=>{
  const {runRenewals}=await modulePromise;const f=fixture();let attempts=0;f.deps.send=async()=>{attempts++;throw new Error('timeout');};
  assert.equal((await runRenewals(f.deps)).uncertain,1);await runRenewals(f.deps);assert.equal(attempts,1);assert.equal([...f.ledger.values()][0].state,'uncertain');
});
test('partial provider rejection does not count as success',async()=>{
  const {runRenewals}=await modulePromise;const f=fixture();f.deps.send=async()=>{throw Object.assign(new Error('reject'),{definitelyRejected:true,code:'brevo_400'});};
  const r=await runRenewals(f.deps);assert.equal(r.failed,1);assert.equal(r.accepted,0);
});
test('email escapes user metadata and uses Brasília expiry and renewal link',async()=>{
  const {renewalMessage}=await modulePromise;const m=renewalMessage({email:'test@example.test',user_metadata:{full_name:'<img src=x>'}},'2026-10-03T01:00:00Z');
  assert(m.html.includes('&lt;img'));assert(!m.html.includes('<img'));assert(m.html.includes('02/10/2026'));assert(m.html.includes('https://dronehub.app.br/precos?'));assert(m.text);
});
test('test email is visibly marked and does not alter the regular message',async()=>{
  const {renewalMessage}=await modulePromise;
  const message=renewalMessage({email:'test@example.test',user_metadata:{}},'2026-10-03T01:00:00Z',true);
  assert.match(message.subject,/^\[Teste\]/);assert.match(message.html,/Teste de entrega/);assert.match(message.text,/nenhum plano será alterado/);
});
test('missing Brevo key fails rather than reporting a sent email',async()=>{
  const {sendEmail}=await load('functions/_lib/server.js');await assert.rejects(()=>sendEmail({},{}),/BREVO_API_KEY/);
});

const endpointPromise = (async () => {
  let source = fs.readFileSync('functions/api/cron/subscription-expiry.js','utf8');
  for (const name of ['server','renewal']) {
    const url = 'data:text/javascript;base64,' + Buffer.from(fs.readFileSync(`functions/_lib/${name}.js`,'utf8')).toString('base64');
    source = source.replace(`../../_lib/${name}.js`, url);
  }
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
})();
test('endpoint rejects unauthorized requests before database or provider access', async () => {
  const {onRequestPost} = await endpointPromise;
  const response = await onRequestPost({request:new Request('https://example.test/api/cron/subscription-expiry',{method:'POST'}),env:{CRON_SECRET:'test-only'}});
  assert.equal(response.status,401);
});
test('endpoint defaults to disabled and validates configuration in dry run', async () => {
  const {onRequestPost} = await endpointPromise;
  const request = suffix => new Request('https://example.test/api/cron/subscription-expiry'+suffix,{method:'POST',headers:{Authorization:'Bearer test-only'}});
  const disabled = await onRequestPost({request:request(''),env:{CRON_SECRET:'test-only'}});
  assert.equal(disabled.status,503);
  const dry = await onRequestPost({request:request('?dry_run=true'),env:{CRON_SECRET:'test-only'}});
  assert.equal(dry.status,503);
  assert.deepEqual((await dry.json()).missing,['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']);
});
