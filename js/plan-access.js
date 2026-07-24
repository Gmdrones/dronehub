/* Drone Hub — controle visual de plano. A autorização definitiva é validada no backend. */
(function () {
  var PRO_PAGES = ['documentos.html', 'missoes.html', 'fiscalizacao.html', 'financeiro.html'];
  var currentFile = (location.pathname.split('/').pop() || '').toLowerCase();

  function currentPlan() {
    try { return (JSON.parse(localStorage.getItem('dronehub_user') || 'null') || {}).plan || 'free'; }
    catch (e) { return 'free'; }
  }

  function isPro() { return currentPlan() === 'pro'; }

  function isAdmin() {
    try { return (JSON.parse(localStorage.getItem('dronehub_user') || 'null') || {}).role === 'admin'; }
    catch (e) { return false; }
  }

  function addAdminLink() {
    if (!isAdmin() || document.querySelector('.sidebar-nav a[href="admin.html"]')) return;
    document.querySelectorAll('.sidebar-nav').forEach(function (nav) {
      var link = document.createElement('a');
      link.href = 'admin.html';
      link.className = 'plan-admin-link';
      link.innerHTML = '<span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg></span>Admin <span class="plan-admin-badge">ADMIN</span>';
      nav.appendChild(link);
    });
  }

  function showLockedScreen() {
    document.documentElement.classList.add('plan-locked');
    document.addEventListener('DOMContentLoaded', function () {
      document.body.innerHTML = '<main class="plan-lock-shell" role="main">'
        + '<section class="plan-lock-card">'
        + '<span class="plan-lock-eyebrow">RECURSO PRO</span>'
        + '<h1>Operação avançada,<br><em>sem limites.</em></h1>'
        + '<p>Este recurso faz parte do Drone Hub Pro. Continue organizando seu piloto, sua aeronave e sua Central de Voo no plano Free.</p>'
        + '<div class="plan-lock-actions"><a class="plan-lock-primary" href="precos.html">Conhecer o Pro</a><a class="plan-lock-secondary" href="dashboard.html">Voltar ao painel</a></div>'
        + '<ul><li>Documentos e relatórios profissionais</li><li>Missões, checklist e diário operacional</li><li>Fiscalização com QR Code e financeiro</li></ul>'
        + '</section></main>';
    });
  }

  function enforceCurrentPlan() {
    if (!isPro() && PRO_PAGES.indexOf(currentFile) !== -1) showLockedScreen();
  }

  function addLogoutButton() {
    if (document.querySelector('.plan-logout')) return;
    var target = document.querySelector('.header-right');
    if (!target) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'plan-logout';
    button.setAttribute('aria-label', 'Sair da conta');
    button.title = 'Sair da conta';
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 17l5-5-5-5"></path><path d="M15 12H3"></path><path d="M21 19V5a2 2 0 0 0-2-2h-6"></path></svg><span>Sair</span>';
    button.addEventListener('click', function () {
      if (typeof logoutUser === 'function') logoutUser();
      else { localStorage.removeItem('dronehub_user'); location.href = 'login.html'; }
    });
    target.appendChild(button);
  }

  var planBeforeSync = isPro();
  if (typeof syncCurrentEntitlement === 'function') {
    syncCurrentEntitlement().then(function (user) {
      if (user && user.plan === 'pro' && !planBeforeSync) {
        location.reload();
        return;
      }
      enforceCurrentPlan();
    });
  } else enforceCurrentPlan();

  document.addEventListener('DOMContentLoaded', function () {
    addAdminLink();
    addLogoutButton();
    if (isPro()) return;
    document.querySelectorAll('.sidebar-nav a').forEach(function (link) {
      var href = (link.getAttribute('href') || '').toLowerCase();
      if (PRO_PAGES.some(function (page) { return href.indexOf(page) !== -1; })) {
        link.classList.add('plan-nav-lock');
        link.setAttribute('aria-label', (link.textContent || '').trim() + ' — disponível no plano Pro');
        link.setAttribute('title', 'Recurso disponível no plano Pro');
        link.setAttribute('href', 'precos.html');
        if (!link.querySelector('.plan-nav-lock-icon')) {
          var lock = document.createElement('span');
          lock.className = 'plan-nav-lock-icon';
          lock.setAttribute('aria-hidden', 'true');
          lock.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>';
          link.appendChild(lock);
        }
      }
    });
    document.querySelectorAll('[data-pro-only]').forEach(function (node) { node.remove(); });
  });
})();
