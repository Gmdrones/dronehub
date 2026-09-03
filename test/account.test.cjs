const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const expiry=require('../js/admin-plan-expiry.js');
async function harness(mode){
  const nodes={},updates=[],signins=[];
  function el(id){return nodes[id]||(nodes[id]={value:'',textContent:'',hidden:false,disabled:false,addEventListener:(_,fn)=>{nodes[id].submit=fn},reset(){for(const key of ['currentPassword','newPassword','confirmPassword'])el(key).value=''}})}
  const account={id:'user-a',email:'account@example.test',user_metadata:{full_name:'Nome do cadastro'}};
  const context={document:{getElementById:el},window:{DroneHubPlanExpiry:expiry},logoutUser(){},supabaseClient:{
    auth:{getUser:async()=>mode==='unauth'?{error:{},data:{user:null}}:{data:{user:account}},
      signInWithPassword:async input=>{signins.push(input);return mode==='wrong'?{error:{},data:{}}:{data:{user:account}}},
      updateUser:async input=>{updates.push(input);return mode==='update-error'?{error:{code:'weak_password'}}:{data:{user:account}}}},
    rpc:async()=>mode==='plan-error'?{error:{}}:{data:[{plan:'pro',role:'member',status:'active',courtesy_expires_at:'2099-01-01T12:00:00Z'}]}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/account.js'),'utf8'),context);
  await new Promise(r=>setImmediate(r));
  return {nodes,updates,signins,submit:async(current='old-secret',next='new-secret',confirm=next)=>{
    el('currentPassword').value=current;el('newPassword').value=next;el('confirmPassword').value=confirm;
    await el('passwordForm').submit({preventDefault(){}});
  }};
}
test('account reads identity from Auth and expiry from server',async()=>{
  const h=await harness();assert.equal(h.nodes.accountName.value,'Nome do cadastro');
  assert.equal(h.nodes.accountHeaderName.textContent,h.nodes.accountName.value);
  assert.equal(h.nodes.accountEmail.value,'account@example.test');
  assert.equal(h.nodes.accountPlan.textContent,'Plano Pro');
  assert.match(h.nodes.accountExpiry.textContent,/2099/);
});
test('unverified session cannot change password',async()=>{
  const h=await harness('unauth');await h.submit();assert.equal(h.updates.length,0);
  assert.equal(h.nodes.accountLogin.hidden,false);
});
test('plan failure does not pretend access is Free or unlimited',async()=>{
  const h=await harness('plan-error');assert.equal(h.nodes.accountRetry.hidden,false);
  assert.match(h.nodes.accountStatus.textContent,/consultar o plano/);
});
test('password mismatch and weak input do not reach auth',async()=>{
  const h=await harness();await h.submit('old','short');await h.submit('old','new-secret','different');
  assert.equal(h.signins.length,0);assert.equal(h.updates.length,0);
});
test('incorrect current password never updates credentials',async()=>{
  const h=await harness('wrong');await h.submit();assert.equal(h.updates.length,0);
  assert.match(h.nodes.passwordStatus.textContent,/Senha atual incorreta/);
});
test('password update reauthenticates same account and changes only password',async()=>{
  const h=await harness();await h.submit();
  assert.equal(h.signins[0].email,'account@example.test');
  assert.deepEqual(Object.keys(h.updates[0]),['password']);
  assert.equal(h.updates[0].password,'new-secret');
  assert.equal(h.nodes.newPassword.value,'');
  assert.match(h.nodes.passwordStatus.textContent,/sucesso/);
});
test('failed password update is not reported as success',async()=>{
  const h=await harness('update-error');await h.submit();
  assert.equal(h.nodes.passwordFields.disabled,false);
  assert.match(h.nodes.passwordStatus.textContent,/mais forte/);
});
test('all operating pages load account navigation; profile stays separate',()=>{
  for(const file of ['dashboard','perfil','central-voo','aeronaves','documentos','missoes','financeiro','fiscalizacao']){
    assert.match(fs.readFileSync(require.resolve('../'+file+'.html'),'utf8'),/js\/account-nav.js/);
  }
  const page=fs.readFileSync(require.resolve('../conta.html'),'utf8');
  assert.match(page,/id="accountEmail"[^>]*readonly/);
  assert.match(page,/href="perfil.html"/);assert.match(page,/href="precos.html"/);
});
