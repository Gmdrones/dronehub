(function () {
  'use strict';

  var calendarCursor = new Date();
  calendarCursor.setDate(1);
  var selectedDate = localDateKey(new Date());

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character];
    });
  }

  function localDateKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function dateKey(value) {
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match[1] + '-' + match[2] + '-' + match[3];
    var parsed = new Date(value);
    return isNaN(parsed.getTime()) ? '' : localDateKey(parsed);
  }

  function dateAtNoon(value) {
    var key = dateKey(value);
    return key ? new Date(key + 'T12:00:00') : null;
  }

  function daysFromToday(value) {
    var date = dateAtNoon(value);
    if (!date) return null;
    var today = new Date();
    today.setHours(12, 0, 0, 0);
    return Math.round((date.getTime() - today.getTime()) / 86400000);
  }

  function currentUid() {
    return window.uid || (window.user && (window.user.id || window.user.email)) || 'local';
  }

  function records(reader, fallback) {
    try {
      if (typeof window[reader] === 'function') return window[reader](currentUid()) || [];
    } catch (_) {}
    return Array.isArray(window[fallback]) ? window[fallback] : [];
  }

  function missions() { return records('getMissions', 'missions'); }
  function documents() { return records('getDocuments', 'docs'); }
  function aircraft() { return records('getAircraft', 'aircraft'); }
  function batteries() { return records('getBatteries', 'batteries'); }

  function missionStatus(mission) {
    var status = String(mission.status || 'agendada').replace(/_/g, ' ');
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function renderCalendar() {
    var target = document.getElementById('calContent');
    if (!target) return;
    var year = calendarCursor.getFullYear();
    var month = calendarCursor.getMonth();
    var firstWeekday = new Date(year, month, 1).getDay();
    var numberOfDays = new Date(year, month + 1, 0).getDate();
    var todayKey = localDateKey(new Date());
    var missionMap = Object.create(null);
    missions().forEach(function (mission) {
      var key = dateKey(mission.data);
      if (!key) return;
      (missionMap[key] || (missionMap[key] = [])).push(mission);
    });
    var cells = '';
    for (var blank = 0; blank < firstWeekday; blank++) cells += '<span class="dh-calendar-empty" aria-hidden="true"></span>';
    for (var day = 1; day <= numberOfDays; day++) {
      var key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      var count = (missionMap[key] || []).length;
      cells += '<button type="button" class="dh-calendar-day' + (key === todayKey ? ' is-today' : '') + (key === selectedDate ? ' is-selected' : '') + (count ? ' has-mission' : '') + '" data-calendar-date="' + key + '" aria-label="' + day + (count ? ', ' + count + ' missão' + (count > 1 ? 'ões' : '') : '') + '"><span>' + day + '</span>' + (count ? '<b>' + count + '</b>' : '') + '</button>';
    }
    var selected = missionMap[selectedDate] || [];
    var selectedLabel = dateAtNoon(selectedDate).toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' });
    target.innerHTML = '<div class="dh-calendar-head"><button type="button" data-calendar-move="-1" aria-label="Mês anterior">‹</button><strong>' + new Date(year, month, 1).toLocaleDateString('pt-BR', { month:'long', year:'numeric' }) + '</strong><button type="button" data-calendar-move="1" aria-label="Próximo mês">›</button></div>'
      + '<div class="dh-calendar-week"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div>'
      + '<div class="dh-calendar-grid">' + cells + '</div>'
      + '<section class="dh-calendar-events"><h4>' + esc(selectedLabel) + '</h4>'
      + (selected.length ? selected.map(function (mission) {
          return '<a href="missoes.html" class="dh-calendar-event"><i></i><span><strong>' + esc(mission.titulo || mission.cliente || 'Missão') + '</strong><small>' + esc((mission.horario ? mission.horario + ' · ' : '') + missionStatus(mission)) + '</small></span><b>→</b></a>';
        }).join('') : '<p>Nenhuma missão nesta data.</p>') + '</section>';
  }

  function notificationItems() {
    var items = [];
    missions().forEach(function (mission) {
      if (String(mission.status) === 'concluida') return;
      var days = daysFromToday(mission.data);
      if (days == null || days < 0 || days > 7) return;
      items.push({ type:days <= 1 ? 'red' : 'amber', icon:'calendar', title:days === 0 ? 'Missão hoje' : days === 1 ? 'Missão amanhã' : 'Missão em ' + days + ' dias', text:mission.titulo || mission.cliente || 'Missão agendada', href:'missoes.html' });
    });
    documents().forEach(function (document) {
      var expiry = document.expiry || document.validade;
      var days = daysFromToday(expiry);
      if (days == null || days > 30) return;
      items.push({ type:days < 0 || days <= 7 ? 'red' : 'amber', icon:'file', title:days < 0 ? 'Documento vencido' : 'Documento vence em ' + days + ' dias', text:document.name || document.nome || document.type || 'Documento', href:'documentos.html' });
    });
    aircraft().forEach(function (item) {
      var days = daysFromToday(item.seguroExpiry);
      if (days == null || days > 30) return;
      var name = ((item.marca || '') + ' ' + (item.modelo || '')).trim() || 'Aeronave';
      items.push({ type:days < 0 || days <= 7 ? 'red' : 'amber', icon:'shield', title:days < 0 ? 'Seguro RETA vencido' : 'Seguro RETA vence em ' + days + ' dias', text:name, href:'aeronaves.html' });
    });
    batteries().forEach(function (battery) {
      var cycles = Number(battery.cycles || battery.ciclos || 0);
      if (cycles < 200) return;
      items.push({ type:cycles >= 300 ? 'red' : 'amber', icon:'battery', title:'Bateria requer atenção', text:(battery.name || battery.nome || 'Bateria') + ' · ' + cycles + ' ciclos', href:'aeronaves.html#fleetHealth' });
    });
    var account = window.user || {};
    var planDays = daysFromToday(account.planExpiresAt || account.courtesy_expires_at);
    if ((account.plan === 'pro' || account.role === 'admin') && account.role !== 'admin' && planDays != null && planDays >= 0 && planDays <= 7) {
      items.push({ type:planDays <= 1 ? 'red' : 'amber', icon:'plan', title:planDays === 0 ? 'Seu Pro vence hoje' : 'Seu Pro vence em ' + planDays + ' dias', text:'Renove para manter os recursos profissionais.', href:'precos.html' });
    }
    [].concat(window.DroneHubOperationalAlerts || []).forEach(function (alert) {
      var text = alert.text || alert.texto;
      if (text) items.push({ type:alert.type || alert.tipo || 'amber', icon:'weather', title:'Alerta operacional', text:text, href:'central-voo.html' });
    });
    var seen = Object.create(null);
    return items.filter(function (item) {
      var key = item.title + '|' + item.text;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).sort(function (a, b) { return (a.type === 'red' ? 0 : 1) - (b.type === 'red' ? 0 : 1); });
  }

  function renderNotifications() {
    var target = document.getElementById('notifList');
    if (!target) return;
    var items = notificationItems();
    target.innerHTML = items.length ? items.map(function (item) {
      return '<a class="dh-notification ' + esc(item.type) + '" href="' + esc(item.href) + '"><i aria-hidden="true"></i><span><strong>' + esc(item.title) + '</strong><small>' + esc(item.text) + '</small></span><b>→</b></a>';
    }).join('') : '<div class="dh-notification-empty"><span>✓</span><strong>Tudo em dia</strong><p>Nenhuma notificação pendente.</p></div>';
    var dot = document.getElementById('notifDot');
    if (dot) {
      dot.style.display = items.length ? 'grid' : 'none';
      dot.textContent = items.length > 9 ? '9+' : String(items.length || '');
      dot.setAttribute('aria-label', items.length + ' notificações pendentes');
    }
    window.DroneHubNotifications = items;
  }

  window.abrirCalendario = function () {
    renderCalendar();
    document.getElementById('calModal').classList.add('open');
  };
  window.abrirNotificacoes = function () {
    renderNotifications();
    document.getElementById('notifModal').classList.add('open');
  };
  window.refreshDashboardTools = function () {
    renderNotifications();
    if (document.getElementById('calModal') && document.getElementById('calModal').classList.contains('open')) renderCalendar();
  };

  document.addEventListener('click', function (event) {
    var move = event.target.closest('[data-calendar-move]');
    if (move) {
      calendarCursor.setMonth(calendarCursor.getMonth() + Number(move.dataset.calendarMove));
      renderCalendar();
      return;
    }
    var day = event.target.closest('[data-calendar-date]');
    if (day) {
      selectedDate = day.dataset.calendarDate;
      renderCalendar();
    }
  });

  function boot() {
    renderNotifications();
    window.addEventListener('dronehub:cloud-ready', window.refreshDashboardTools);
    window.addEventListener('dronehub:dashboard-data-updated', window.refreshDashboardTools);
    window.addEventListener('dronehub:missions-updated', window.refreshDashboardTools);
    window.addEventListener('dronehub:operational-updated', window.refreshDashboardTools);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
}());
