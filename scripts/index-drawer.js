(function() {
  var drawer = document.getElementById('info-drawer');
  var tab = document.getElementById('info-drawer-tab');

  if (!drawer || !tab) return;

  tab.addEventListener('click', function() {
    var isOpen = drawer.classList.toggle('open');
    document.body.classList.toggle('drawer-open', isOpen);
    tab.setAttribute('aria-expanded', isOpen);

    if (typeof HeatFX !== 'undefined') {
      if (isOpen) HeatFX.haptics.medium();
      else HeatFX.haptics.light();
    }
  });
})();
