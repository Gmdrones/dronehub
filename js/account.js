(function(){
  'use strict';
  var authenticatedUser=null;
  function el(id){return document.getElementById(id)}
  function message(id,text,error){el(id).textContent=text;el(id).className=error?'error':'success'}
  async function loadAccount(){
    el('accountRetry').hidden=true;el('accountLogin').hidden=true;el('passwordFields').disabled=true;
    el('accountNameFields').disabled=true;
    message('accountStatus','Verificando sua conta…',false);
    try {
      if(!supabaseClient) throw Error('Serviço de conta indisponível. Tente novamente.');
      var result=await supabaseClient.auth.getUser();
      if(result.error || !result.data.user) {
        authenticatedUser=null;el('accountLogin').hidden=false;
        throw Error('Não foi possível validar sua sessão. Entre novamente para acessar sua conta.');
      }
      authenticatedUser=result.data.user;
      var metadata=authenticatedUser.user_metadata||{};
      var name=metadata.full_name||metadata.name||authenticatedUser.email||'Piloto';
      el('accountName').value=name;el('accountEmail').value=authenticatedUser.email||'';
      el('accountHeaderName').textContent=name;el('accountAvatar').textContent=name.charAt(0).toUpperCase();
      el('passwordFields').disabled=false;
      el('accountNameFields').disabled=false;
      var access=await supabaseClient.rpc('get_my_entitlement');
      if(access.error) throw Error('Dados da conta carregados, mas não foi possível consultar o plano. Tente novamente.');
      var entitlement=Array.isArray(access.data)?access.data[0]:access.data;
      if(!entitlement) throw Error('Não foi possível consultar a validade do plano. Tente novamente.');
      var info=window.DroneHubPlanExpiry(entitlement);
      var active=entitlement.status==='active' && info.state!=='expired';
      var label=entitlement.role==='admin'?'Administrador':entitlement.plan==='pro'&&active?'Pro':'Free';
      el('accountPlan').textContent='Plano '+label;el('accountHeaderPlan').textContent=label;
      el('accountExpiry').textContent=info.date;el('accountExpiryDetail').textContent=info.detail;
      el('accountExpiryDetail').className=info.state==='expired'?'error':'';
      message('accountStatus','Dados atualizados com segurança.',false);
    }catch(error){
      message('accountStatus',error.message||'Não foi possível carregar sua conta.',true);
      el('accountRetry').hidden=false;
    }
  }
  el('accountRetry').onclick=loadAccount;
  el('accountLogout').onclick=function(){logoutUser()};
  el('accountNameForm').addEventListener('submit',async function(event){
    event.preventDefault();
    if(!authenticatedUser || el('accountNameFields').disabled) return;
    var name=el('accountName').value.trim().replace(/\s+/g,' ');
    if(!name || name.length>120){
      message('accountNameStatus','Informe seu nome, com até 120 caracteres.',true);return;
    }
    el('accountNameFields').disabled=true;
    message('accountNameStatus','Salvando nome…',false);
    try{
      var current=await supabaseClient.auth.getUser();
      if(current.error || !current.data.user || current.data.user.id!==authenticatedUser.id)
        throw Error('Sua sessão mudou ou expirou. Entre novamente antes de salvar.');
      var result=await supabaseClient.auth.updateUser({data:{full_name:name}});
      if(result.error || !result.data || !result.data.user)
        throw Error('Não foi possível salvar o nome. Tente novamente.');
      authenticatedUser=result.data.user;
      var savedName=(authenticatedUser.user_metadata||{}).full_name;
      if(!savedName) throw Error('Não foi possível confirmar o nome salvo. Atualize a página.');
      el('accountName').value=savedName;
      el('accountHeaderName').textContent=savedName;
      el('accountAvatar').textContent=savedName.charAt(0).toUpperCase();
      // Update only the same account's display cache, never access or identity fields.
      try{
        var cached=JSON.parse(localStorage.getItem('dronehub_user')||'null');
        if(cached && cached.id===authenticatedUser.id){
          cached.name=savedName;localStorage.setItem('dronehub_user',JSON.stringify(cached));
        }
      }catch(ignore){}
      message('accountNameStatus','Nome atualizado com sucesso.',false);
    }catch(error){message('accountNameStatus',error.message||'Não foi possível salvar o nome.',true)}
    finally{el('accountNameFields').disabled=false}
  });
  el('passwordForm').addEventListener('submit',async function(event){
    event.preventDefault();
    if(!authenticatedUser || el('passwordFields').disabled) return;
    var current=el('currentPassword').value,password=el('newPassword').value,confirm=el('confirmPassword').value;
    if(password.length<8){message('passwordStatus','Use pelo menos 8 caracteres na nova senha.',true);return}
    if(password!==confirm){message('passwordStatus','A confirmação não corresponde à nova senha.',true);return}
    if(current===password){message('passwordStatus','Escolha uma senha diferente da atual.',true);return}
    el('passwordFields').disabled=true;
    message('passwordStatus','Validando e alterando sua senha…',false);
    try{
      var verified=await supabaseClient.auth.signInWithPassword({email:authenticatedUser.email,password:current});
      if(verified.error || !verified.data.user || verified.data.user.id!==authenticatedUser.id) throw Error('Senha atual incorreta ou acesso não confirmado. Verifique e tente novamente.');
      var updated=await supabaseClient.auth.updateUser({password:password});
      if(updated.error){
        if(updated.error.code==='reauthentication_needed') throw Error('Entre novamente na sua conta para confirmar sua identidade e tente alterar a senha.');
        if(updated.error.code==='weak_password') throw Error('A senha não atende aos requisitos de segurança. Use uma senha mais forte.');
        throw Error('Não foi possível alterar a senha. Tente novamente ou entre novamente na conta.');
      }
      el('passwordForm').reset();
      message('passwordStatus','Senha alterada com sucesso. Use a nova senha no próximo acesso.',false);
    }catch(error){message('passwordStatus',error.message||'Não foi possível alterar a senha.',true)}
    finally{current='';password='';confirm='';el('currentPassword').value='';el('newPassword').value='';el('confirmPassword').value='';el('passwordFields').disabled=false}
  });
  loadAccount();
})();
