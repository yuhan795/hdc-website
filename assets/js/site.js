// Nav border on scroll, language and theme toggles
(function () {
  var nav = document.getElementById('nav');
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    nav.classList.toggle('scrolled', y > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.getElementById('toggle-lang').addEventListener('click', function () {
    var v = document.body.dataset.lang === 'zh' ? 'en' : 'zh';
    document.body.dataset.lang = v;
    localStorage.setItem('hdc-lang', v);
  });

  document.getElementById('toggle-theme').addEventListener('click', function () {
    var v = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = v;
    localStorage.setItem('hdc-theme', v);
  });
})();
