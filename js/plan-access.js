/* Controle de acesso visual. A fonte de verdade do plano vem do Supabase. */
(function () {
  var PRO_PAGES = ['documentos.html', 'missoes.html', 'fiscalizacao.html', 'financeiro.html'];
  var currentFile = (location.pathname.split('/').pop() || '').toLowerCase();

  function user() {
    try { return JSON.parse(localStorage.getItem('dronehub_user') || 'null') || {}; }
    catch (e) { return {}; }
  }
  function isFounderAdmin() { return String(user().email || '').toLowerCase() === 'giorgiomendonca@gmail.com'; }
  function isAdmin() { return user().role === 'admin' || isFounderAdmin(); }
  function isPro() { var current = user(); return current.plan === 'pro' || current.role === 'admin' || isFounderAdmin(); }
  function isPremiumPage() { return PRO_PAGES.indexOf(currentFile) !== -1; }

  function renderLockedScreen(title, copy) {
    if (!document.body || document.querySelector('.plan-lock-shell')) return;
    document.documentElement.classList.add('plan-locked');
    document.body.innerHTML = '<main class="plan-lock-shell" role="main"><section class="plan-lock-card">'
      + '<span class="plan-lock-eyebrow">RECURSO PRO</span><h1>' + title + '</h1><p>' + copy + '</p>'
      + '<div class="plan-lock-actions"><a class="plan-lock-primary" href="precos.html">Conhecer o Pro</a><a class="plan-lock-secondary" href="dashboard.html">Voltar ao painel</a></div>'
      + '<ul><li>Documentos e relatórios profissionais</li><li>Missões, checklist e diário operacional</li><li>Fiscalização por QR Code, financeiro e frota</li></ul></section></main>';
  }

  function enforce() {
    if (currentFile === 'admin.html' && !isAdmin()) {
      renderLockedScreen('Área exclusiva<br><em>da administração.</em>', 'Somente administradores podem conceder cortesias e gerenciar acessos Pro.');
      return;
    }
    if (isPremiumPage() && !isPro()) {
      renderLockedScreen('Operação avançada,<br><em>sem limites.</em>', 'Este recurso faz parte do Drone Hub Pro. No Free, você mantém o perfil do piloto, uma aeronave e a Central de Voo.');
    }
  }

  function addAdminLink() {
    if (!isAdmin()) return;
    document.querySelectorAll('.sidebar-nav').forEach(function (nav) {
      if (nav.querySelector('a[href="admin.html"]')) return;
      var link = document.createElement('a');
      link.href = 'admin.html'; link.className = 'plan-admin-link';
      link.innerHTML = '<span class="ico">◈</span>Admin <span class="plan-admin-badge">ADMIN</span>';
      nav.appendChild(link);
    });
  }

  function addLogoutButton() {
    if (document.querySelector('.plan-logout')) return;
    var target = document.querySelector('.header-right');
    if (!target) return;
    var button = document.createElement('button');
    button.type = 'button'; button.className = 'plan-logout'; button.setAttribute('aria-label', 'Sair da conta'); button.title = 'Sair da conta';
    button.innerHTML = '<span aria-hidden="true">↪</span><span>Sair</span>';
    button.addEventListener('click', function () { if (typeof logoutUser === 'function') logoutUser(); else { localStorage.removeItem('dronehub_user'); location.href = 'login.html'; } });
    target.appendChild(button);
  }

  function lockNavigation() {
    document.querySelectorAll('.sidebar-nav a').forEach(function (link) {
      var href = (link.getAttribute('href') || '').toLowerCase();
      if (!link.dataset.originalHref && PRO_PAGES.some(function (page) { return href.indexOf(page) !== -1; })) link.dataset.originalHref = link.getAttribute('href');
      if (!link.dataset.originalHref) return;
      if (isPro()) {
        link.setAttribute('href', link.dataset.originalHref); link.classList.remove('plan-nav-lock'); link.removeAttribute('title');
        var oldLock = link.querySelector('.plan-nav-lock-icon'); if (oldLock) oldLock.remove();
      } else {
        link.classList.add('plan-nav-lock'); link.setAttribute('title', 'Disponível no plano Pro'); link.setAttribute('href', 'precos.html');
        if (!link.querySelector('.plan-nav-lock-icon')) { var lock = document.createElement('span'); lock.className = 'plan-nav-lock-icon'; lock.setAttribute('aria-hidden', 'true'); lock.textContent = '🔒'; link.appendChild(lock); }
      }
    });
  }

  function updateDashboardAccess() {
    var current = user(), pro = isPro(), label = isAdmin() ? 'ADMIN' : (pro ? 'PRO' : 'FREE');
    var planBadge = document.getElementById('planBadge'); if (planBadge) { planBadge.textContent = label; planBadge.className = 'plan' + (pro ? ' pro' : ''); }
    var userBadge = document.getElementById('userBadge'); if (userBadge) userBadge.textContent = (current.name || 'Usuário') + ' ' + label;
    var planName = document.getElementById('planName'); if (planName) { planName.textContent = isAdmin() ? 'Admin' : (pro ? 'Pro' : 'Free'); planName.className = 'sidebar-foot-name' + (pro ? ' pro' : ''); }
    ['upgradeCard'].forEach(function (id) { var element = document.getElementById(id); if (element) element.style.display = pro ? 'none' : ''; });
    document.querySelectorAll('.free-pro-tease').forEach(function (element) { element.style.display = pro ? 'none' : ''; });
  }

  function initializeInterface() { addAdminLink(); addLogoutButton(); lockNavigation(); updateDashboardAccess(); enforce(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeInterface, { once:true }); else initializeInterface();
  if (typeof syncCurrentEntitlement === 'function') syncCurrentEntitlement().then(initializeInterface).catch(initializeInterface);
  window.addEventListener('dronehub:entitlement-ready', initializeInterface);
})();
