/* Controle de acesso visual. A fonte de verdade do plano vem do Supabase. */
(function () {
  var PRO_PAGES = ['central-voo.html', 'documentos.html', 'missoes.html', 'financeiro.html', 'admin.html'];
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
        + '<ul><li>Central de Voo e análise operacional</li><li>Documentos, missões e relatórios profissionais</li><li>Financeiro e gestão avançada da frota</li></ul>'
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
      renderLockedScreen('Operação avançada,<br><em>sem limites.</em>', 'Este recurso faz parte do Drone Hub Pro. No Free, você mantém o perfil do piloto e uma aeronave cadastrada.');
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
    document.querySelectorAll('.sidebar nav a, .sidebar-nav a, .mobile-nav-links a').forEach(function (link) {
      var href = (link.getAttribute('href') || '').toLowerCase();
      if (PRO_PAGES.some(function (page) { return href.indexOf(page) !== -1; })) {
        link.classList.add('plan-nav-lock');
        link.setAttribute('aria-label', (link.textContent || '').trim() + ' — disponível no plano Pro');
        link.setAttribute('title', 'Disponível no plano Pro');
        link.setAttribute('href', 'precos.html');
        if (!link.querySelector('.plan-nav-lock-icon')) {
          var lock = document.createElement('span');
          lock.className = 'plan-nav-lock-icon'; lock.setAttribute('aria-hidden', 'true');
          lock.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
          link.appendChild(lock);
        }
      }
    });
  }


  function showRenewalReminder() {
    // Reappear on every dashboard visit; no persistent dismissal flag.
    var account = user();
    if (currentFile !== 'dashboard.html' || !account.id || !isPro() || isAdmin() ||
        !account.planExpiresAt || document.querySelector('.plan-expiry-dialog')) return;
    var expires = new Date(account.planExpiresAt);
    var remaining = expires.getTime() - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0 || remaining > 7 * 86400000) return;
    var days = Math.ceil(remaining / 86400000);
    var today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    var expiryDate = expires.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    var title = expiryDate === today ? 'Seu plano Pro vence hoje' :
      'Seu plano Pro vence em ' + days + (days === 1 ? ' dia' : ' dias');
    var dialog = document.createElement('dialog');
    dialog.className = 'plan-expiry-dialog';
    dialog.setAttribute('aria-labelledby', 'plan-expiry-title');
    dialog.setAttribute('aria-describedby', 'plan-expiry-description');
    dialog.innerHTML = '<span class="plan-expiry-eyebrow">VENCIMENTO DO PLANO</span>' +
      '<button class="plan-expiry-close" type="button" aria-label="Fechar aviso">×</button>' +
      '<h2 id="plan-expiry-title"></h2><p id="plan-expiry-description"></p>' +
      '<div class="plan-expiry-actions"><a href="precos.html">Renovar meu Pro</a>' +
      '<button type="button" autofocus>Continuar no painel</button></div>';
    dialog.querySelector('h2').textContent = title;
    dialog.querySelector('p').textContent = 'Vencimento em ' + expiryDate +
      '. Renove seu plano para continuar utilizando os recursos Pro do DroneHub.';
    dialog.querySelectorAll('button').forEach(function (button) {
      button.addEventListener('click', function () { dialog.close(); });
    });
    dialog.addEventListener('close', function () { dialog.remove(); }, { once: true });
    document.body.appendChild(dialog);
    dialog.showModal();
  }

  function groupFreeNavigation() {
    document.querySelectorAll('.sidebar nav, .sidebar-nav').forEach(function (nav) {
      var aircraft = nav.querySelector('a[href*="aeronaves.html"]');
      var inspection = nav.querySelector('a[href*="fiscalizacao.html"]');
      if (aircraft && inspection && aircraft.nextElementSibling !== inspection) {
        aircraft.insertAdjacentElement('afterend', inspection);
      }
    });
  }

  function initializeInterface() { groupFreeNavigation(); addAdminLink(); addLogoutButton(); lockNavigation(); showRenewalReminder(); }



  function restorePremiumNavigation() {
    if (!isPro()) return;
    document.querySelectorAll('.sidebar nav a.plan-nav-lock, .sidebar-nav a.plan-nav-lock, .mobile-nav-links a.plan-nav-lock').forEach(function (link) {
      var label = (link.textContent || '').toLowerCase();
      var page = label.indexOf('document') >= 0 ? 'documentos.html'
        : label.indexOf('central') >= 0 ? 'central-voo.html'
        : label.indexOf('miss') >= 0 ? 'missoes.html'
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
    var planLink = document.getElementById('planLink');
    if (planLink && !isAdmin()) {
      planLink.href = 'conta.html';
      planLink.textContent = 'Minha conta';
      planLink.style.display = '';
      planLink.hidden = false;
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
    showRenewalReminder();
    window.dispatchEvent(new CustomEvent('dronehub:access-ready', { detail: user() }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAccess, { once:true });
  } else {
    bootAccess();
  }
})();
