(function(){
  function setStatus(message, type){var status=document.getElementById('formStatus');status.textContent=message;status.className='form-status '+(type||'');}
  async function boot(){
    var user=typeof getCurrentUser==='function'?getCurrentUser():null;
    if(!user){location.replace('login.html');return;}
    if(typeof syncCurrentEntitlement==='function') user=await syncCurrentEntitlement();
    if(!user||user.role!=='admin'){location.replace('dashboard.html');return;}
    document.getElementById('grantForm').addEventListener('submit',async function(event){
      event.preventDefault();
      var email=document.getElementById('pilotEmail').value.trim();
      var months=Number(document.getElementById('courtesyMonths').value);
      var note=document.getElementById('courtesyNote').value.trim()||null;
      var button=document.getElementById('grantButton');
      if(!email){setStatus('Informe o e-mail do piloto.','error');return;}
      if(typeof supabaseClient === 'undefined' || !supabaseClient){setStatus('A conexão segura não está disponível. Tente novamente em instantes.','error');return;}
      button.disabled=true;button.querySelector('span').textContent='Concedendo acesso…';setStatus('');
      try{
        var result=await supabaseClient.rpc('grant_partner_courtesy',{target_email:email,months:months,courtesy_note:note});
        if(result.error) throw result.error;
        setStatus('Pro concedido por '+months+' '+(months===1?'mês':'meses')+'. O piloto verá o acesso ao entrar novamente.','success');
        event.target.reset();document.getElementById('courtesyMonths').value='12';
      }catch(error){
        var msg=(error&&error.message)||'Não foi possível conceder a cortesia.';
        if(/Nenhum piloto encontrado/i.test(msg)) msg='Nenhuma conta encontrada com este e-mail. Peça ao piloto para criar a conta primeiro.';
        if(/Apenas administradores/i.test(msg)) msg='Sua sessão não possui permissão administrativa. Entre novamente.';
        setStatus(msg,'error');
      }finally{button.disabled=false;button.querySelector('span').textContent='Conceder Pro';}
    });
    document.getElementById('signOutBtn').addEventListener('click',async function(){if(typeof signOut==='function') await signOut();location.replace('login.html');});
    if(window.lucide) lucide.createIcons();
  }
  document.addEventListener('DOMContentLoaded',boot);
})();
