(function () {
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function normalizeAlert(alert) {
    if (!alert) return null;
    var text = alert.text || alert.texto;
    if (!text) return null;
    return { type: alert.type || alert.tipo || 'amber', text: String(text) };
  }

  function mergedAlerts() {
    var sources = []
      .concat(window.alerts || [])
      .concat(window.DroneHubIntelligentAlerts || [])
      .concat(window.DroneHubOperationalAlerts || []);
    var seen = Object.create(null);
    return sources.map(normalizeAlert).filter(function (alert) {
      if (!alert || seen[alert.text]) return false;
      seen[alert.text] = true;
      return true;
    });
  }

  function renderAlerts() {
    var target = document.getElementById('alertList');
    if (!target) return;
    var items = mergedAlerts();
    target.innerHTML = items.length
      ? items.slice(0, 6).map(function (alert) {
          return '<div class="alert-item ' + escapeHtml(alert.type) + '"><span>' + escapeHtml(alert.text) + '</span></div>';
        }).join('')
      : '<p class="dashboard-empty-state">Nenhum alerta operacional no momento.</p>';
    var notificationDot = document.getElementById('notifDot');
    if (notificationDot) notificationDot.style.display = items.length ? 'block' : 'none';
  }

  function documentAlerts() {
    try {
      var documents = typeof getDocuments === 'function' ? getDocuments(window.uid) : [];
      var now = Date.now();
      return documents.filter(function (document) { return document.expiry; }).map(function (document) {
        var days = Math.ceil((new Date(document.expiry).getTime() - now) / 86400000);
        if (days < 0) return { type: 'red', text: document.name + ' vencido há ' + Math.abs(days) + ' dias' };
        if (days <= 7) return { type: 'amber', text: document.name + ' vence em ' + days + ' dias' };
        return null;
      }).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  function fleetAlerts() {
    try {
      var fleet = JSON.parse(localStorage.getItem('dronehub_fleet_health') || '[]').filter(function (item) {
        return item.userId === (window.uid || 'local');
      });
      return fleet.filter(function (item) { return Number(item.cycles) >= 200; }).map(function (item) {
        return {
          type: Number(item.cycles) >= 300 ? 'red' : 'amber',
          text: 'Bateria com ' + item.cycles + ' ciclos: avalie manutenção ou substituição.'
        };
      });
    } catch (error) {
      return [];
    }
  }

  function refreshLocalAlerts() {
    window.DroneHubIntelligentAlerts = documentAlerts().concat(fleetAlerts());
    renderAlerts();
  }

  window.renderDroneHubAlerts = renderAlerts;
  window.addEventListener('dronehub:operational-updated', renderAlerts);
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.isPro) return;
    refreshLocalAlerts();
    setInterval(refreshLocalAlerts, 10 * 60 * 1000);
  });
}());
