// Nav border on scroll, language and theme toggles
(function () {
  var nav = document.getElementById('nav');
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    nav.classList.toggle('scrolled', y > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Home page: the Studio text lights up word by word, gradually, as it rises through
  // the lower half of the screen (dim at 90% of the screen height, full at 45%).
  var lit = [];
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('[data-lit]').forEach(function (box) {
      var walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), nodes = [], n;
      while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push(n);
      nodes.forEach(function (node) {
        // English splits on spaces; Chinese (no spaces) one character at a time.
        var parts = node.nodeValue.match(/[　-鿿＀-￯]|[^\s　-鿿＀-￯]+|\s+/g) || [];
        var frag = document.createDocumentFragment();
        parts.forEach(function (part) {
          if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(part));
          var w = document.createElement('span');
          w.className = 'lit-w';
          w.textContent = part;
          frag.appendChild(w);
          lit.push(w);
        });
        node.parentNode.replaceChild(frag, node);
      });
    });
  }
  var ticking = false;
  function update() {
    ticking = false;
    var vh = window.innerHeight, start = vh * 0.9, end = vh * 0.45;
    for (var i = 0; i < lit.length; i++) {
      var w = lit[i];
      if (!w.offsetParent) continue; // the other language, hidden
      var t = (start - w.getBoundingClientRect().top) / (start - end);
      var o = (0.2 + 0.8 * Math.max(0, Math.min(1, t))).toFixed(2);
      if (w.style.opacity !== o) w.style.opacity = o;
    }
  }
  function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  if (lit.length) {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.getElementById('toggle-lang').addEventListener('click', schedule);
    update();
  }

  // Dark sections ([data-unfold]) arrive as a rounded card with light margins at the sides and
  // unfold to full width while their top edge rises through the screen; as their bottom edge
  // leaves at the top, they fold back into a card so the next light section shows around it.
  var folds = Array.prototype.slice.call(document.querySelectorAll('[data-unfold]'));
  if (folds.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var foldTicking = false;
    var ease = function (t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    var fold = function () {
      foldTicking = false;
      var vh = window.innerHeight, vw = window.innerWidth;
      var side = Math.min(vw * 0.06, 96), round = Math.min(vw * 0.04, 48);
      folds.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) return;
        var open = Math.min(ease((vh - r.top) / (vh * 0.85)), ease(r.bottom / (vh * 0.85)));
        var x = ((1 - open) * side).toFixed(1), rad = ((1 - open) * round).toFixed(1);
        el.style.clipPath = open >= 1 ? 'none' : 'inset(0 ' + x + 'px round ' + rad + 'px)';
      });
    };
    var foldLater = function () { if (!foldTicking) { foldTicking = true; requestAnimationFrame(fold); } };
    window.addEventListener('scroll', foldLater, { passive: true });
    window.addEventListener('resize', foldLater);
    fold();
  }

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
