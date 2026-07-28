/* Controle de acesso visual. A fonte de verdade do plano vem do Supabase. */
(function () {
  var PRO_PAGES = ['documentos.html', 'missoes.html', 'fiscalizacao.html', 'financeiro.html', 'admin.html'];
  var currentFile = (location.pathname.split('/').pop() || '').toLowerCase();
  // Cloudflare Pages atende tanto /documentos quanto /documentos.html.
  // Normalize as rotas limpas antes de aplicar as regras dos planos.
  if (currentFile && currentFile.indexOf('.') === -1) currentFile += '.html';


  function user() {
    try { return JSON.parse(localStorage.getItem('dronehub_user') || 'null') || {}; }
    catch (e) { return {}; }
  }
  function isPro() {
    var current = user();
    return current.plan === 'pro' || current.role === 'admin';
  }
  function isAdmin() {
    return user().role === 'admin';
  }
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



  function restorePremiumNavigation() {
    if (!isPro()) return;
    document.querySelectorAll('.sidebar-nav a.plan-nav-lock').forEach(function (link) {
      var label = (link.textContent || '').toLowerCase();
      var page = label.indexOf('document') >= 0 ? 'documentos.html'
        : label.indexOf('miss') >= 0 ? 'missoes.html'
        : label.indexOf('fiscal') >= 0 ? 'fiscalizacao.html'
        : label.indexOf('finance') >= 0 ? 'financeiro.html' : '';
      if (page) link.setAttribute('href', page);
      link.classList.remove('plan-nav-lock');
      link.removeAttribute('title');
      var icon = link.querySelector('.plan-nav-lock-icon');
      if (icon) icon.remove();
    });
  }

  function refreshAccessUI() {
    var current = user();
    var premium = isPro();
    var label = isAdmin() ? 'ADMIN' : (premium ? 'PRO' : 'FREE');
    var planBadge = document.getElementById('planBadge');
    var planName = document.getElementById('planName');
    var userBadge = document.getElementById('userBadge');
    if (planBadge) {
      planBadge.textContent = label;
      planBadge.className = 'plan' + (premium ? ' pro' : '');
    }
    if (planName) {
      planName.textContent = isAdmin() ? 'Admin' : (premium ? 'Pro' : 'Free');
      planName.className = 'sidebar-foot-name ' + (premium ? 'pro' : 'free');
    }
    if (userBadge) userBadge.textContent = (current.name || 'Usuário') + ' ' + label;
    document.querySelectorAll('.header-profile .plan').forEach(function (el) {
      el.textContent = label;
      el.classList.toggle('pro', premium);
    });
    document.querySelectorAll('#upgradeCard, .free-pro-tease').forEach(function (el) {
      el.style.display = premium ? 'none' : '';
    });
    restorePremiumNavigation();
    addAdminLink();
    addLogoutButton();
    if (!premium) lockNavigation();
  }

  async function bootAccess() {
    if (typeof syncCurrentEntitlement === 'function') {
      try { await syncCurrentEntitlement(); } catch (e) {}
    }
    enforce();
    refreshAccessUI();
    window.dispatchEvent(new CustomEvent('dronehub:access-ready', { detail: user() }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAccess, { once:true });
  } else {
    bootAccess();
  }
})();
