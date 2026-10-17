(function () {
  'use strict';
  const root = document.getElementById('adminApp');
  if (!root) return;
  const section = document.createElement('section');
  section.className = 'admin-card accounts-card';
  section.innerHTML = '<div class="accounts-heading"><div><p class="eyebrow">FINANCEIRO</p><h2>Estornos e contestações</h2><p class="card-copy">Análise manual. Nenhuma ação aqui cancela o PRO automaticamente.</p></div><button class="admin-ghost" id="refreshPaymentReviews" type="button">Atualizar</button></div><div id="paymentReviewStatus" class="accounts-status">Aguardando carregamento.</div><div class="accounts-table-wrap"><table class="accounts-table"><thead><tr><th>Pagamento</th><th>Piloto</th><th>Motivo</th><th>Data</th><th>Ação</th></tr></thead><tbody id="paymentReviewRows"></tbody></table></div>';
  root.appendChild(section);
  const status = section.querySelector('#paymentReviewStatus');
  const tbody = section.querySelector('#paymentReviewRows');
  async function api(method, body) {
    const session = await supabaseClient.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) throw new Error('Sessão expirada. Entre novamente.');
    const response = await fetch('/api/admin/payment-reviews', { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erro na consulta de estornos.');
    return data;
  }
  async function load() {
    status.textContent = 'Consultando pendências...';
    tbody.replaceChildren();
    try {
      const data = await api('GET');
      const items = data.items || [];
      status.textContent = items.length ? items.length + ' ocorrência(s) aguardando revisão.' : 'Nenhuma pendência financeira.';
      items.forEach(function (item) {
        const tr = document.createElement('tr');
        [item.provider_payment_id, item.user_id, item.reason, new Date(item.created_at).toLocaleString('pt-BR')].forEach(function (value) {
          const td = document.createElement('td'); td.textContent = value || ''; tr.appendChild(td);
        });
        const td = document.createElement('td');
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'admin-ghost'; btn.textContent = 'Marcar analisado';
        btn.onclick = async function () {
          const notes = prompt('Registre a decisão e o motivo (mínimo de 10 caracteres). O PRO não será alterado automaticamente.');
          if (notes === null) return;
          btn.disabled = true;
          try { await api('POST', { action: 'resolve', payment_id: item.provider_payment_id, notes }); await load(); }
          catch (error) { alert(error.message); btn.disabled = false; }
        };
        td.appendChild(btn); tr.appendChild(td); tbody.appendChild(tr);
      });
    } catch (error) { status.textContent = 'Falha ao consultar: ' + error.message; }
  }
  section.querySelector('#refreshPaymentReviews').onclick = load;
  window.addEventListener('load', function () { setTimeout(load, 1500); });
}());
