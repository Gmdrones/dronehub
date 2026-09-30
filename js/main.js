// ============================================
// DRONE HUB — MAIN.JS
// Utilitarios globais para todo o site
// ============================================

// Shared discoverability metadata for public pages. Internal pages are noindex.
(function () {
  var internal = /(?:dashboard|perfil|aeronaves|central-voo|documentos|missoes|financeiro|fiscalizacao|admin)\.html$/i.test(location.pathname);
  var title = document.title || 'Drone Hub';
  var description = 'Drone Hub: plataforma profissional para planejar, operar e organizar voos com drones.';
  function meta(name, value, property) {
    var selector = property ? 'meta[property="'+name+'"]' : 'meta[name="'+name+'"]';
    var el = document.querySelector(selector) || document.createElement('meta');
    if (!el.parentNode) { if (property) el.setAttribute('property', name); else el.setAttribute('name', name); document.head.appendChild(el); }
    el.setAttribute('content', value);
  }
  meta('description', description);
  meta('og:title', title, true); meta('og:description', description, true); meta('og:type', 'website', true);
  meta('twitter:card', 'summary_large_image');
  if (internal) meta('robots', 'noindex,nofollow');
  else if (!document.querySelector('link[rel="canonical"]')) { var canonical=document.createElement('link'); canonical.rel='canonical'; canonical.href=location.origin+location.pathname; document.head.appendChild(canonical); }
}());

// ===== MOBILE HAMBURGER =====
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.header').forEach(function(header) {
    var nav = header.querySelector('.nav');
    if (!nav || header.querySelector('.mobile-menu-toggle')) return;
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mobile-menu-toggle';
    toggle.setAttribute('aria-label', 'Abrir menu');
    toggle.innerHTML = '<span></span><span></span><span></span>';
    header.querySelector('.header-inner').appendChild(toggle);
    toggle.addEventListener('click', function() {
      var open = nav.classList.toggle('mobile-open');
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    });
  });
  var hamburger = document.getElementById('hamburger');
  var nav = document.getElementById('nav');
  if (hamburger && nav) {
    hamburger.addEventListener('click', function() {
      nav.classList.toggle('open');
      hamburger.classList.toggle('active');
    });
  }
});

// ===== HEADER BLUR ON SCROLL =====
document.addEventListener('DOMContentLoaded', function() {
  var header = document.querySelector('.header');
  if (header) {
    window.addEventListener('scroll', function() {
      header.style.background = window.scrollY > 50
        ? 'rgba(10, 13, 18, 0.95)'
        : 'rgba(10, 13, 18, 0.85)';
    });
  }
});

// ===== SMOOTH SCROLL =====
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      var href = this.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      var target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
});

// ===== FAQ ACCORDION =====
function toggleFAQ(el) { el.classList.toggle('open'); }

// ===== COPY TO CLIPBOARD =====
function copyToClipboard(text, msg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      alert(msg || 'Copiado!');
    }).catch(function() { fallbackCopy(text, msg); });
  } else { fallbackCopy(text, msg); }
}
function fallbackCopy(text, msg) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;';
  document.body.appendChild(ta); ta.select();
  document.execCommand('copy'); document.body.removeChild(ta);
  alert(msg || 'Copiado!');
}

// ===== DATE FORMATTER =====
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}
function formatDateTime(dateStr) {
  var d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}
function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

// ===== MONEY FORMATTER =====
function formatMoney(value) {
  return 'R$ ' + Number(value).toFixed(2).replace('.', ',');
}

// ===== VALIDATORS =====
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidPhone(phone) {
  return phone.replace(/\D/g, '').length >= 10;
}

// ===== MASKS =====
function maskCPF(input) {
  var v = input.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 3) v = v.slice(0, 3) + '.' + v.slice(3);
  if (v.length > 7) v = v.slice(0, 7) + '.' + v.slice(7);
  if (v.length > 11) v = v.slice(0, 11) + '-' + v.slice(11);
  input.value = v;
}
function maskPhone(input) {
  var v = input.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 2) v = '(' + v.slice(0, 2) + ') ' + v.slice(2);
  if (v.length > 10) v = v.slice(0, 10) + '-' + v.slice(10);
  else if (v.length > 6) v = v.slice(0, 6) + '-' + v.slice(6);
  input.value = v;
}
function maskMoney(input) {
  var v = input.value.replace(/\D/g, '');
  v = (parseInt(v) / 100).toFixed(2);
  if (v === 'NaN') v = '0,00';
  input.value = 'R$ ' + v.replace('.', ',');
}

// ===== LOCAL STORAGE HELPERS =====
function getStorage(key) { try { return JSON.parse(localStorage.getItem(key)); } catch(e) { return null; } }
function setStorage(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function removeStorage(key) { localStorage.removeItem(key); }

// ===== TOAST NOTIFICATION =====
function showToast(message, type) {
  type = type || 'info';
  var colors = {
    success: { bg: 'rgba(52,211,153,0.95)', color: '#0A0D12' },
    error:   { bg: 'rgba(240,68,56,0.95)', color: '#fff' },
    info:    { bg: 'rgba(0,210,255,0.95)', color: '#0A0D12' },
    warning: { bg: 'rgba(255,176,32,0.95)', color: '#0A0D12' }
  };
  var c = colors[type] || colors.info;
  var toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:9999;padding:14px 24px;' +
    'border-radius:12px;background:' + c.bg + ';color:' + c.color + ';' +
    'font-family:Inter,sans-serif;font-size:0.9rem;font-weight:600;' +
    'box-shadow:0 8px 32px rgba(0,0,0,0.4);' +
    'transform:translateY(20px);opacity:0;transition:all 0.3s ease;' +
    'max-width:400px;';
  document.body.appendChild(toast);
  requestAnimationFrame(function() {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });
  setTimeout(function() {
    toast.style.transform = 'translateY(20px)';
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

// ===== CONFETTI (leve) =====
function showConfetti() {
  var colors = ['#00D2FF', '#34D399', '#FFB020', '#F04438', '#F0F4F8'];
  for (var i = 0; i < 50; i++) {
    var el = document.createElement('div');
    var size = Math.random() * 8 + 4;
    var left = Math.random() * 100;
    var delay = Math.random() * 2;
    var color = colors[Math.floor(Math.random() * colors.length)];
    el.style.cssText =
      'position:fixed;top:-10px;left:' + left + '%;z-index:9998;' +
      'width:' + size + 'px;height:' + size + 'px;' +
      'background:' + color + ';border-radius:' + (Math.random() > 0.5 ? '50%' : '2px') + ';' +
      'animation:confettiFall ' + (2 + Math.random() * 2) + 's ease-in ' + delay + 's forwards;' +
      'opacity:0;';
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 5000);
  }
  if (!document.getElementById('confettiStyle')) {
    var style = document.createElement('style');
    style.id = 'confettiStyle';
    style.textContent =
      '@keyframes confettiFall {' +
      '0%{transform:translateY(0) rotate(0deg);opacity:1;}' +
      '100%{transform:translateY(100vh) rotate(720deg);opacity:0;}' +
      '}';
    document.head.appendChild(style);
  }
}

// ===== LAZY LOAD IMAGES =====
document.addEventListener('DOMContentLoaded', function() {
  var lazyImages = document.querySelectorAll('img[data-src]');
  if (lazyImages.length > 0 && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      });
    });
    lazyImages.forEach(function(img) { observer.observe(img); });
  } else {
    lazyImages.forEach(function(img) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  }
});

// ===== INIT LUCIDE ICONS =====
document.addEventListener('DOMContentLoaded', function() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// Mantém o vocabulário do menu público consistente em todas as páginas.
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('a[href*="funcionalidades"]').forEach(function(link) {
    if (link.textContent.trim().toLowerCase() === 'plataforma') link.textContent = 'Funcionalidades';
  });
  document.querySelectorAll('a[href*="funcionalidades"]').forEach(function(link) {
    if (link.textContent.trim().toLowerCase() === 'conhecer a plataforma') link.textContent = 'Conhecer funcionalidades';
  });
  var current=null;try{current=JSON.parse(localStorage.getItem('dronehub_user')||'null');}catch(e){}
  document.querySelectorAll('#planLink').forEach(function(link){
    if(current&&current.role==='admin'){link.href='admin.html';link.textContent='Gerenciar usuários';}
    else if(current){link.href='conta.html';link.textContent='Minha conta';}
  });
});

// Padroniza a navegação pública entre Home, Funcionalidades, Preços, Sobre e Blog.
document.addEventListener('DOMContentLoaded', function() {
  var isPublicPage = /(?:^\/$|\/(?:index|funcionalidades|precos|sobre|blog|login)(?:\.html)?$)/i.test(location.pathname);
  if (!isPublicPage || document.getElementById('dronehub-public-nav-style')) return;
  var style = document.createElement('style');
  style.id = 'dronehub-public-nav-style';
  style.textContent = '.site-header,body>header.header{height:64px!important;min-height:64px!important}.site-header{padding-inline:max(20px,calc((100vw - 1120px)/2))!important}.site-header nav,body>header.header nav{gap:22px!important}.site-header .header-actions{display:flex;align-items:center;gap:10px}@media(max-width:760px){.site-header{padding-inline:16px!important}.site-header nav{display:none!important}.site-header .header-actions .text-btn{display:inline-flex!important;padding:9px 11px;border:1px solid rgba(148,163,184,.28);border-radius:10px}.site-header .header-actions .primary-btn{padding:10px 12px!important}.site-header .header-actions{gap:8px!important}body>header.header .header-inner,body>header.header .nav-wrap{width:calc(100% - 28px)!important}}';
  document.head.appendChild(style);
});
// ============================================
// DRONE HUB — MAIN.JS
// Utilitarios globais para todo o site
// ============================================

// Shared discoverability metadata for public pages. Internal pages are noindex.
(function () {
  var internal = /(?:dashboard|perfil|aeronaves|central-voo|documentos|missoes|financeiro|fiscalizacao|admin)\.html$/i.test(location.pathname);
  var title = document.title || 'Drone Hub';
  var description = 'Drone Hub: plataforma profissional para planejar, operar e organizar voos com drones.';
  function meta(name, value, property) {
    var selector = property ? 'meta[property="'+name+'"]' : 'meta[name="'+name+'"]';
    var el = document.querySelector(selector) || document.createElement('meta');
    if (!el.parentNode) { if (property) el.setAttribute('property', name); else el.setAttribute('name', name); document.head.appendChild(el); }
    el.setAttribute('content', value);
  }
  meta('description', description);
  meta('og:title', title, true); meta('og:description', description, true); meta('og:type', 'website', true);
  meta('twitter:card', 'summary_large_image');
  if (internal) meta('robots', 'noindex,nofollow');
  else if (!document.querySelector('link[rel="canonical"]')) { var canonical=document.createElement('link'); canonical.rel='canonical'; canonical.href=location.origin+location.pathname; document.head.appendChild(canonical); }
}());

// ===== MOBILE HAMBURGER =====
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.header').forEach(function(header) {
    var nav = header.querySelector('.nav');
    if (!nav || header.querySelector('.mobile-menu-toggle')) return;
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mobile-menu-toggle';
    toggle.setAttribute('aria-label', 'Abrir menu');
    toggle.innerHTML = '<span></span><span></span><span></span>';
    header.querySelector('.header-inner').appendChild(toggle);
    toggle.addEventListener('click', function() {
      var open = nav.classList.toggle('mobile-open');
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    });
  });
  var hamburger = document.getElementById('hamburger');
  var nav = document.getElementById('nav');
  if (hamburger && nav) {
    hamburger.addEventListener('click', function() {
      nav.classList.toggle('open');
      hamburger.classList.toggle('active');
    });
  }
});

// ===== HEADER BLUR ON SCROLL =====
document.addEventListener('DOMContentLoaded', function() {
  var header = document.querySelector('.header');
  if (header) {
    window.addEventListener('scroll', function() {
      header.style.background = window.scrollY > 50
        ? 'rgba(10, 13, 18, 0.95)'
        : 'rgba(10, 13, 18, 0.85)';
    });
  }
});

// ===== SMOOTH SCROLL =====
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      var href = this.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      var target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
});

// ===== FAQ ACCORDION =====
function toggleFAQ(el) { el.classList.toggle('open'); }

// ===== COPY TO CLIPBOARD =====
function copyToClipboard(text, msg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      alert(msg || 'Copiado!');
    }).catch(function() { fallbackCopy(text, msg); });
  } else { fallbackCopy(text, msg); }
}
function fallbackCopy(text, msg) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;';
  document.body.appendChild(ta); ta.select();
  document.execCommand('copy'); document.body.removeChild(ta);
  alert(msg || 'Copiado!');
}

// ===== DATE FORMATTER =====
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}
function formatDateTime(dateStr) {
  var d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}
function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

// ===== MONEY FORMATTER =====
function formatMoney(value) {
  return 'R$ ' + Number(value).toFixed(2).replace('.', ',');
}

// ===== VALIDATORS =====
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidPhone(phone) {
  return phone.replace(/\D/g, '').length >= 10;
}

// ===== MASKS =====
function maskCPF(input) {
  var v = input.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 3) v = v.slice(0, 3) + '.' + v.slice(3);
  if (v.length > 7) v = v.slice(0, 7) + '.' + v.slice(7);
  if (v.length > 11) v = v.slice(0, 11) + '-' + v.slice(11);
  input.value = v;
}
function maskPhone(input) {
  var v = input.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 2) v = '(' + v.slice(0, 2) + ') ' + v.slice(2);
  if (v.length > 10) v = v.slice(0, 10) + '-' + v.slice(10);
  else if (v.length > 6) v = v.slice(0, 6) + '-' + v.slice(6);
  input.value = v;
}
function maskMoney(input) {
  var v = input.value.replace(/\D/g, '');
  v = (parseInt(v) / 100).toFixed(2);
  if (v === 'NaN') v = '0,00';
  input.value = 'R$ ' + v.replace('.', ',');
}

// ===== LOCAL STORAGE HELPERS =====
function getStorage(key) { try { return JSON.parse(localStorage.getItem(key)); } catch(e) { return null; } }
function setStorage(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function removeStorage(key) { localStorage.removeItem(key); }

// ===== TOAST NOTIFICATION =====
function showToast(message, type) {
  type = type || 'info';
  var colors = {
    success: { bg: 'rgba(52,211,153,0.95)', color: '#0A0D12' },
    error:   { bg: 'rgba(240,68,56,0.95)', color: '#fff' },
    info:    { bg: 'rgba(0,210,255,0.95)', color: '#0A0D12' },
    warning: { bg: 'rgba(255,176,32,0.95)', color: '#0A0D12' }
  };
  var c = colors[type] || colors.info;
  var toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:9999;padding:14px 24px;' +
    'border-radius:12px;background:' + c.bg + ';color:' + c.color + ';' +
    'font-family:Inter,sans-serif;font-size:0.9rem;font-weight:600;' +
    'box-shadow:0 8px 32px rgba(0,0,0,0.4);' +
    'transform:translateY(20px);opacity:0;transition:all 0.3s ease;' +
    'max-width:400px;';
  document.body.appendChild(toast);
  requestAnimationFrame(function() {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });
  setTimeout(function() {
    toast.style.transform = 'translateY(20px)';
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

// ===== CONFETTI (leve) =====
function showConfetti() {
  var colors = ['#00D2FF', '#34D399', '#FFB020', '#F04438', '#F0F4F8'];
  for (var i = 0; i < 50; i++) {
    var el = document.createElement('div');
    var size = Math.random() * 8 + 4;
    var left = Math.random() * 100;
    var delay = Math.random() * 2;
    var color = colors[Math.floor(Math.random() * colors.length)];
    el.style.cssText =
      'position:fixed;top:-10px;left:' + left + '%;z-index:9998;' +
      'width:' + size + 'px;height:' + size + 'px;' +
      'background:' + color + ';border-radius:' + (Math.random() > 0.5 ? '50%' : '2px') + ';' +
      'animation:confettiFall ' + (2 + Math.random() * 2) + 's ease-in ' + delay + 's forwards;' +
      'opacity:0;';
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 5000);
  }
  if (!document.getElementById('confettiStyle')) {
    var style = document.createElement('style');
    style.id = 'confettiStyle';
    style.textContent =
      '@keyframes confettiFall {' +
      '0%{transform:translateY(0) rotate(0deg);opacity:1;}' +
      '100%{transform:translateY(100vh) rotate(720deg);opacity:0;}' +
      '}';
    document.head.appendChild(style);
  }
}

// ===== LAZY LOAD IMAGES =====
document.addEventListener('DOMContentLoaded', function() {
  var lazyImages = document.querySelectorAll('img[data-src]');
  if (lazyImages.length > 0 && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      });
    });
    lazyImages.forEach(function(img) { observer.observe(img); });
  } else {
    lazyImages.forEach(function(img) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  }
});

// ===== INIT LUCIDE ICONS =====
document.addEventListener('DOMContentLoaded', function() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// Mantém o vocabulário do menu público consistente em todas as páginas.
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('a[href*="funcionalidades"]').forEach(function(link) {
    if (link.textContent.trim().toLowerCase() === 'plataforma') link.textContent = 'Funcionalidades';
  });
  document.querySelectorAll('a[href*="funcionalidades"]').forEach(function(link) {
    if (link.textContent.trim().toLowerCase() === 'conhecer a plataforma') link.textContent = 'Conhecer funcionalidades';
  });
});
// Links legais comuns, inclusive em páginas antigas que ainda usam rodapé próprio.
document.addEventListener('DOMContentLoaded', function () {
  var footer = document.querySelector('footer');
  if (footer && !footer.querySelector('[data-legal-links]')) {
    var legal = document.createElement('div'); legal.dataset.legalLinks = 'true';
    legal.innerHTML = '<a href="termos.html">Termos de Uso</a> · <a href="privacidade.html">Privacidade e LGPD</a>';
    footer.appendChild(legal);
  }
});

// Canal único de suporte. A mensagem é enviada pelo próprio DroneHub.
document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('dronehubSupport')) return;
  var link = document.createElement('button');
  link.id = 'dronehubSupport'; link.type = 'button';
  link.setAttribute('aria-label', 'Falar com o suporte do DroneHub');
  link.innerHTML = '<span aria-hidden="true">?</span><b>Suporte</b>';
  var dialog = document.createElement('div');
  dialog.id = 'dronehubSupportDialog'; dialog.hidden = true;
  dialog.innerHTML = '<div class="dronehub-support-backdrop" data-support-close></div><section class="dronehub-support-card" role="dialog" aria-modal="true" aria-labelledby="dronehubSupportTitle"><button class="dronehub-support-close" type="button" aria-label="Fechar" data-support-close>×</button><p class="dronehub-support-label">SUPORTE DRONEHUB</p><h2 id="dronehubSupportTitle">Como podemos ajudar?</h2><p>Envie sua mensagem sem sair do DroneHub. Nossa equipe responderá pelo e-mail cadastrado na sua conta.</p><form data-support-form><label for="dronehubSupportTopic">Assunto</label><input id="dronehubSupportTopic" name="topic" maxlength="100" minlength="3" required placeholder="Ex.: Não consigo acessar minha conta"><label for="dronehubSupportPhone">Telefone para contato <small>(opcional)</small></label><input id="dronehubSupportPhone" name="phone" inputmode="tel" maxlength="40" placeholder="(00) 00000-0000"><label for="dronehubSupportMessage">Mensagem</label><textarea id="dronehubSupportMessage" name="message" rows="5" maxlength="4000" minlength="10" required placeholder="Conte para a gente como podemos ajudar."></textarea><p class="dronehub-support-feedback" aria-live="polite" data-support-feedback></p><button class="dronehub-support-primary" type="submit" data-support-submit>Enviar mensagem</button></form></section>';
  document.body.appendChild(link); document.body.appendChild(dialog);
  function closeSupport() { dialog.hidden = true; link.focus(); }
  link.addEventListener('click', function () { dialog.hidden = false; dialog.querySelector('#dronehubSupportMessage').focus(); });
  dialog.querySelectorAll('[data-support-close]').forEach(function (button) { button.addEventListener('click', closeSupport); });
  dialog.querySelector('[data-support-form]').addEventListener('submit', async function (event) {
    event.preventDefault();
    var form = event.currentTarget, message = form.message.value.trim(), topic = form.topic.value.trim(), phone = form.phone.value.trim();
    var feedback = dialog.querySelector('[data-support-feedback]'), submit = dialog.querySelector('[data-support-submit]');
    if (topic.length < 3) { feedback.textContent = 'Informe o assunto da sua mensagem.'; return; }
    if (message.length < 10) { feedback.textContent = 'Escreva pelo menos 10 caracteres para enviar.'; return; }
    try {
      if (!window.supabaseClient) throw new Error('Faça login para enviar uma mensagem ao suporte.');
      var sessionResult = await window.supabaseClient.auth.getSession();
      var token = sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
      if (!token) throw new Error('Faça login para enviar uma mensagem ao suporte.');
      submit.disabled = true; submit.textContent = 'Enviando…'; feedback.textContent = '';
      var response = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ topic: topic, phone: phone, message: message }) });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(result.error || 'Não foi possível enviar sua mensagem agora.');
      form.reset(); feedback.textContent = 'Mensagem enviada. Vamos responder pelo e-mail da sua conta.'; submit.textContent = 'Mensagem enviada';
    } catch (error) {
      feedback.textContent = error.message || 'Não foi possível enviar sua mensagem agora.'; submit.disabled = false; submit.textContent = 'Enviar mensagem';
    }
  });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !dialog.hidden) closeSupport(); });
});
