/* Controle de acesso visual. A fonte de verdade do plano vem do Supabase. */
(function () {
  var PRO_PAGES = ['documentos.html', 'missoes.html', 'fiscalizacao.html', 'financeiro.html', 'admin.html'];
  var currentFile = (location.pathname.split('/').pop() || '').toLowerCase();

  function user() {
    try { return JSON.parse(localStorage.getItem('dronehub_user') || 'null') || {}; }
    catch (e) { return {}; }
  }
  function isPro() { return user().plan === 'pro'; }
  function isAdmin() { return user().role === 'admin'; }
  function isPremiumPage() { return PRO_PAGES.indexOf(currentFile) !== -1; }

  function renderLockedScreen(title, copy) {
    var render = function () {
      if (!document.body || document.querySelector('.plan-lock-shell')) return;
      document.documentElement.classList.add('plan-locked');
      document.body.innerHTML = '<main class="plan-lock-shell" role="main">'
        + '<section class="plan-lock-card">'
        + '<span class="plan-lock-eyebrow">RECURSO PRO</span>'
        + '<h1>' + title + '</h1>'
        + '<p>' + copy + '</p>'
        + '<div class="plan-lock-actions"><a class="plan-lock-primary" href="precos.html">Conhecer o Pro</a><a class="plan-lock-secondary" href="dashboard.html">Voltar ao painel</a></div>'
        + '<ul><li>Documentos e relatórios profissionais</li><li>Missões, checklist e diário operacional</li><li>Fiscalização por QR Code, financeiro e frota</li></ul>'
        + '</section></main>';
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once:true });
    else render();
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
    if (!isAdmin() || document.querySelector('.sidebar-nav a[href="admin.html"]')) return;
    document.querySelectorAll('.sidebar-nav').forEach(function (nav) {
      var link = document.createElement('a');
      link.href = 'admin.html'; link.className = 'plan-admin-link';
      link.innerHTML = '<span class="ico">⌁</span>Admin <span class="plan-admin-badge">ADMIN</span>';
      nav.appendChild(link);
    });
  }

  function addLogoutButton() {
    if (document.querySelector('.plan-logout')) return;
    var target = document.querySelector('.header-right');
    if (!target) return;
    var button = document.createElement('button');
    button.type = 'button'; button.className = 'plan-logout';
    button.setAttribute('aria-label', 'Sair da conta'); button.title = 'Sair da conta';
    button.innerHTML = '<span aria-hidden="true">↪</span><span>Sair</span>';
    button.addEventListener('click', function () {
      if (typeof logoutUser === 'function') logoutUser();
      else { localStorage.removeItem('dronehub_user'); location.href = 'login.html'; }
    });
    target.appendChild(button);
  }

  function lockNavigation() {
    if (isPro()) return;
    document.querySelectorAll('.sidebar-nav a').forEach(function (link) {
      var href = (link.getAttribute('href') || '').toLowerCase();
      if (PRO_PAGES.some(function (page) { return href.indexOf(page) !== -1; })) {
        link.classList.add('plan-nav-lock');
        link.setAttribute('aria-label', (link.textContent || '').trim() + ' — disponível no plano Pro');
        link.setAttribute('title', 'Disponível no plano Pro');
        link.setAttribute('href', 'precos.html');
        if (!link.querySelector('.plan-nav-lock-icon')) {
          var lock = document.createElement('span');
          lock.className = 'plan-nav-lock-icon'; lock.setAttribute('aria-hidden', 'true'); lock.textContent = '⌕';
          link.appendChild(lock);
        }
      }
    });
  }

  function initializeInterface() { addAdminLink(); addLogoutButton(); lockNavigation(); }

  // A verificação ocorre imediatamente e é repetida assim que o plano é lido do Supabase.
  enforce();
  if (typeof syncCurrentEntitlement === 'function') {
    syncCurrentEntitlement().then(function () { enforce(); initializeInterface(); }).catch(function () { enforce(); initializeInterface(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeInterface, { once:true });
  else initializeInterface();
})();
