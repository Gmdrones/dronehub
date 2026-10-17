(function () {
  'use strict';
  const LIMITS = { free: { aircraft: 1, batteries: 3 }, pro: { aircraft: 20, batteries: 60 } };
  async function check() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
    const auth = await supabaseClient.auth.getUser();
    const user = auth && auth.data && auth.data.user;
    if (!user) return;
    if (typeof syncCurrentEntitlement === 'function') await syncCurrentEntitlement();
    const current = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (user.id === '50fdfa0b-4187-49ed-a13b-96d3ecff513c' && current && current.plan === 'pro') {
      const key = 'dronehub_igor_courtesy_20261016';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483640;background:rgba(0,0,0,.82);display:grid;place-items:center;padding:20px';
        const dialog = document.createElement('section');
        dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
        dialog.style.cssText = 'max-width:480px;background:#111b29;color:white;border:1px solid #334155;border-radius:18px;padding:28px;font:16px/1.6 system-ui';
        dialog.innerHTML = '<h2>Igor, você ganhou 30 dias de DroneHub PRO!</h2><p>Sua cortesia gratuita está ativa até 15/11/2026, às 22h53 (Brasília). Aproveite seus equipamentos cadastrados e os recursos PRO.</p><p><strong>Nova política Free:</strong> 1 aeronave e 3 baterias por piloto. Após a cortesia, sem assinatura ativa, os excedentes ficam preservados e ocultos.</p><button type="button" style="padding:10px 18px;border:0;border-radius:8px;cursor:pointer">Entendi</button>';
        dialog.querySelector('button').onclick = function () { overlay.remove(); };
        overlay.appendChild(dialog); document.body.appendChild(overlay);
      }
      return;
    }
    if (!current || current.plan === 'pro' || current.role === 'admin') return;
    const response = await supabaseClient.rpc('get_my_equipment_counts');
    if (response.error || !response.data) return;
    const counts = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!counts || Number(counts.aircraft_count) <= 1 && Number(counts.battery_count) <= 3) return;
    const key = 'dronehub_equipment_limit_notice_' + user.id;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    const overlay = document.createElement('div');
    overlay.id = 'equipment-plan-notice';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483640;background:rgba(0,0,0,.82);display:grid;place-items:center;padding:20px';
    overlay.innerHTML = '<section role="dialog" aria-modal="true" aria-labelledby="equipment-plan-title" style="max-width:480px;background:#111b29;color:white;border:1px solid #334155;border-radius:18px;padding:28px;font:16px/1.6 system-ui;box-shadow:0 20px 70px #0009"><h2 id="equipment-plan-title" style="margin-top:0">Limites do plano Free</h2><p>As regras do DroneHub Free permitem utilizar somente <strong>1 aeronave e 3 baterias</strong>.</p><p>Seus equipamentos excedentes permanecem armazenados, mas não podem ser utilizados enquanto sua conta estiver no Free.</p><p>O <strong>DroneHub PRO</strong> permite até <strong>20 aeronaves e 60 baterias</strong>.</p><div style="display:flex;gap:12px;flex-wrap:wrap"><a href="/precos" style="background:#20c5ef;color:#071019;text-decoration:none;padding:11px 18px;border-radius:9px;font-weight:bold">Conhecer o PRO</a><button type="button" id="equipment-plan-close" style="background:#263448;color:white;border:0;border-radius:9px;padding:11px 18px;cursor:pointer">Entendi</button></div></section>';
    document.body.appendChild(overlay);
    overlay.querySelector('#equipment-plan-close').onclick = function () { overlay.remove(); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { check().catch(console.warn); });
  else check().catch(console.warn);
})();