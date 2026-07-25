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
