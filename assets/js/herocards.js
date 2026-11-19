// Home page hero: a few project images float as small framed cards in the empty space around
// the headline (like the project pages' board). They drift with the mouse, rise at different
// speeds when the page scrolls (near cards faster), and link to their project page.
// Cards that would touch the text at the current screen size are left out.
(function () {
  var hero = document.querySelector('.hero');
  if (!hero) return;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Slots: centre x and top y in % of the hero, width in % of the viewport width, depth 0 (near) to 1 (far).
  var WIDE = [
    { x: 23, y: 4, w: 9, z: 0.5 }, { x: 46, y: 9, w: 6.5, z: 0.85 }, { x: 64, y: 2, w: 11, z: 0.15 },
    { x: 84, y: 16, w: 12, z: 0.05 }, { x: 94, y: 47, w: 7, z: 0.7 }, { x: 80, y: 57, w: 9.5, z: 0.35 },
    { x: 53, y: 70, w: 8, z: 0.6 },
  ];
  // Phones and tablets: all seven cards, spread over the whole first screen. Cards that land
  // behind the text stay there, blurred and faded, so the text remains readable.
  var NARROW = [
    { x: 20, y: 3, w: 28, z: 0.4 }, { x: 62, y: 1, w: 32, z: 0.05 }, { x: 86, y: 15, w: 20, z: 0.7 },
    { x: 30, y: 22, w: 22, z: 0.6 }, { x: 76, y: 40, w: 30, z: 0.3 }, { x: 22, y: 57, w: 26, z: 0.5 },
    { x: 72, y: 73, w: 24, z: 0.75 },
  ];

  // Which project goes in which slot (by slug, same order as the slots).
  // Each card shows the project's first image.
  var PICK = [
    '42-22-crescent-st',   // Dalongyi LIC
    '45-great-jones-st',   // Oncept Soho Store
    '211-w-84th-st',       // The Henry Residence
    '118-w-76th-st',       // UWS Townhouse (largest, nearest slot)
    '555-w-59th-st',       // The Elements Residence
    'jerkinhead-house',    // Jerkinhead House
    '6910-ny-28',          // Not-A-Cabin
  ];

  var layer = document.createElement('div');
  layer.className = 'hcards';
  layer.setAttribute('aria-hidden', 'true');
  hero.insertBefore(layer, hero.firstChild);
  var cards = [], mx = 0, my = 0, ticking = false;

  fetch('content/projects.json').then(function (r) { return r.json(); }).then(function (data) {
    var bySlug = {};
    data.items.forEach(function (p) { bySlug[p.slug] = p; });
    PICK.map(function (slug) { return bySlug[slug]; }).filter(function (p) { return p && p.images && p.images.length; }).forEach(function (p, i) {
      var a = document.createElement('a');
      a.className = 'hcard';
      a.href = 'project.html?p=' + encodeURIComponent(p.slug);
      a.tabIndex = -1;
      var img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.src = p.images[0].image;
      var cap = document.createElement('span');
      cap.className = 'hcard-cap';
      cap.textContent = p.address;
      a.appendChild(img);
      a.appendChild(cap);
      layer.appendChild(a);
      var card = { el: a, img: img, i: i, ratio: 4 / 3 };
      cards.push(card);
      img.onload = function () { card.ratio = img.naturalWidth / img.naturalHeight; layout(); a.classList.add('in'); setTimeout(function () { a.classList.add('ready'); }, 1800); };
    });
  });

  function layout() {
    var narrow = window.innerWidth <= 1000;
    var slots = narrow ? NARROW : WIDE;
    var hr = hero.getBoundingClientRect();
    var W = hr.width, H = hr.height;
    // Text to keep clear of, relative to the hero.
    var avoid = [];
    hero.querySelectorAll('.heroeyebrow, .herostmt, .heroright, .herobottom .lbl').forEach(function (el) {
      // Measure the text lines themselves, not the (full-width) boxes around them.
      var range = document.createRange();
      range.selectNodeContents(el);
      Array.prototype.forEach.call(range.getClientRects(), function (r) {
        if (r.width && r.height) avoid.push({ l: r.left - hr.left - 24, t: r.top - hr.top - 20, r: r.right - hr.left + 24, b: r.bottom - hr.top + 20 });
      });
    });
    cards.forEach(function (c) {
      var s = slots[c.i];
      if (!s) { c.el.style.display = 'none'; return; }
      // Same area whatever the shape: wide images get wider, tall ones narrower.
      var w = window.innerWidth * s.w / 100 * Math.min(1.25, Math.max(0.72, Math.sqrt(c.ratio / 1.33)));
      var h = w / c.ratio + w * 0.16; // image plus frame and caption
      var l = W * s.x / 100 - w / 2, t = H * s.y / 100;
      l = Math.max(8, Math.min(W - w - 8, l));
      var overText = avoid.some(function (r) { return l < r.r && l + w > r.l && t < r.b && t + h > r.t; });
      // Wide screens keep cards clear of the text; narrow ones let them sit behind it, blurred.
      var hide = t + h > H - 8 || (overText && !narrow);
      var behind = overText && narrow;
      c.el.style.display = hide ? 'none' : '';
      c.el.classList.toggle('behind', behind);
      c.el.style.width = w + 'px';
      c.el.style.left = l + 'px';
      c.el.style.top = t + 'px';
      c.z = s.z;
      c.el.style.zIndex = String(10 - Math.round(s.z * 9));
      // Phones: every card starts blurred and sharpens where the finger touches (see focus()).
      c.narrow = narrow; c.behind = behind;
      c.blur = narrow ? 4 : s.z * 1.6; // phones: the same blur for every card
      c.el.style.setProperty('--blur', c.blur.toFixed(2) + 'px');
      c.el.style.setProperty('--o', narrow && behind ? '.55' : '1');
      c.el.style.setProperty('--grey', (s.z * 0.55).toFixed(2));
      c.el.style.setProperty('--delay', (c.i * 90) + 'ms');
    });
    move();
  }

  function move() {
    ticking = false;
    var y = window.scrollY || document.documentElement.scrollTop;
    cards.forEach(function (c) {
      if (c.z == null) return;
      var near = 1 - c.z;
      var dy = still ? 0 : -y * (0.12 + near * 0.55) + my * near * 14;
      var dx = still ? 0 : mx * near * 18;
      c.el.style.transform = 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)';
    });
  }
  function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(move); } }

  // Phones: a card comes into focus as the finger gets near it, and blurs again after the
  // finger lifts.
  var touch = null, release = 0;
  function focus() {
    cards.forEach(function (c) {
      if (!c.narrow || c.el.style.display === 'none') return;
      var f = 0;
      if (touch) {
        var r = c.el.getBoundingClientRect();
        var d = Math.hypot(touch.x - (r.left + r.width / 2), touch.y - (r.top + r.height / 2));
        var inner = Math.max(r.width, r.height) / 2, outer = inner + 110;
        f = Math.max(0, Math.min(1, (outer - d) / (outer - inner)));
      }
      c.el.style.setProperty('--blur', (c.blur * (1 - f)).toFixed(2) + 'px');
      c.el.style.setProperty('--o', (c.behind ? 0.55 + 0.45 * f : 1).toFixed(2));
    });
  }
  function onTouch(e) {
    var t = e.touches[0];
    if (!t) return;
    clearTimeout(release);
    touch = { x: t.clientX, y: t.clientY };
    focus();
  }
  window.addEventListener('touchstart', onTouch, { passive: true });
  window.addEventListener('touchmove', onTouch, { passive: true });
  window.addEventListener('touchend', function () {
    clearTimeout(release);
    release = setTimeout(function () { touch = null; focus(); }, 700);
  }, { passive: true });
  window.addEventListener('scroll', function () { if (touch) focus(); }, { passive: true });

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', layout);
  if (!still) {
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
      schedule();
    }, { passive: true });
  }
  // The headline's last word changes width; re-check collisions when the language switches.
  document.getElementById('toggle-lang').addEventListener('click', function () { requestAnimationFrame(layout); });
})();
