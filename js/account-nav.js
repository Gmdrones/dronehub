(function(){
  'use strict';
  var targets='.header-profile, .topbar .user-chip, #planLink, .sidebar-foot a';
  function refresh(){
    document.querySelectorAll(targets).forEach(function(node){
      if(node.matches('.sidebar-foot a') && /admin/.test(node.getAttribute('href')||'')) return;
      node.setAttribute('data-account-link','');
      if(node.tagName==='A') node.setAttribute('href','conta.html');
      else {node.setAttribute('role','link');node.tabIndex=0;node.style.cursor='pointer'}
      node.setAttribute('aria-label','Minha conta');
      if(node.matches('#planLink, .sidebar-foot a')) node.textContent='Minha conta';
    });
    document.querySelectorAll('.mobile-nav-links').forEach(function(nav){
      if(nav.querySelector('a[href="conta.html"]')) return;
      var link=document.createElement('a');link.href='conta.html';link.textContent='Minha conta';nav.appendChild(link);
    });
  }
  document.addEventListener('click',function(event){
    var target=event.target.closest('[data-account-link]');
    if(!target) return;
    if(target.tagName==='A' && (event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)) return;
    event.preventDefault();event.stopImmediatePropagation();window.location.href='conta.html';
  },true);
  document.addEventListener('keydown',function(event){
    var target=event.target.closest('[data-account-link]');
    if(target && target.tagName!=='A' && (event.key==='Enter'||event.key===' ')){
      event.preventDefault();window.location.href='conta.html';
    }
  });
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',refresh);else refresh();
  window.addEventListener('dronehub:access-ready',refresh);
  window.addEventListener('pageshow',refresh);
})();
