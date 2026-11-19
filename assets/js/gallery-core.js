// Shared gallery engine for the home page and project pages.
//
// The walls are built from plain DOM layers inside a CSS perspective:
//   .gv   gallery viewport   perspective + clipping
//   .gcam camera             subtle pointer parallax (CSS variables --cam-*)
//   .gwall wall plane        shared orientation (main wall, or a slightly turned side wall)
//   .gpos  item position     coordinates, size, base depth, drag offset
//   .gact  item interaction  hover / focus lift (a link or button)
//   .gprint print surface    image, mat, edge, shadow  + .gcap caption
//
// Positions are in "units": 1000 units = the wall's width (see --u in style.css).
// Layouts are explicit data in content/gallery.json; G.autoLayout() is the deterministic
// fallback for images that have no stored position yet (new uploads, admin preview), and is
// also what tools/gallery-layout.mjs uses to write the stored layouts.
(function (root) {
  var G = {};
  var FINISHED = { render: 1, built: 1, photo: 1 };
  G.KIND = {
    render: { en: 'Rendering', zh: '效果图' },
    drawing: { en: 'Drawing', zh: '图纸' },
    board: { en: 'Material selection', zh: '材料选样' },
    site: { en: 'Existing condition', zh: '现场' },
    construction: { en: 'Construction', zh: '施工' },
    built: { en: 'Completed', zh: '完成实景' },
    photo: { en: 'Photo', zh: '照片' }
  };
  // Presentation family: finished work is matted and framed, drawings are loose sheets,
  // material boards are thicker card, site and construction photos are plain prints.
  G.typeOf = function (kind) {
    if (kind === 'drawing') return 'sheet';
    if (kind === 'board') return 'board';
    if (kind === 'construction' || kind === 'site') return 'snap';
    return 'photo';
  };
  G.isFinished = function (kind) { return !!FINISHED[kind]; };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  G.clamp = clamp;

  // Small seeded random generator, so the automatic layout is the same on every visit.
  function rng(seed) {
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5; var t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- automatic layout ----------
  // images: [{ image, kind, size, ar }] in the project's list order. One wall: finished work
  // first and larger (the first finished image is the entry point), drawings, boards and site
  // photos after it and smaller, all on the same wall in the same frames, all kept square to the
  // wall. Returns { height, items: [{ image, x, y, w, r, z, wall }] }.
  G.autoLayout = function (seed, images) {
    var R = rng(seed || 'hdc'), W = 1000, GAP = 30, items = [];
    var fin = images.filter(function (im) { return FINISHED[im.kind]; });
    var proc = images.filter(function (im) { return !FINISHED[im.kind]; });
    if (!fin.length) { fin = proc; proc = []; }
    function round(v) { return Math.round(v * 10) / 10; }
    function add(im, x, y, w, z) {
      items.push({ image: im.image, x: round(x), y: round(y), w: round(w), r: 0, z: z || 0, wall: 'main' });
      return y + w / im.ar;
    }
    // Process pieces hang at about 80% of the size of finished ones.
    function weight(im) {
      var base = FINISHED[im.kind] && fin !== proc ? 1 : 0.8;
      if (im.size === 'large') base = Math.max(base, 1);
      if (im.size === 'small') base *= 0.8;
      return base;
    }
    // Rows of pictures at roughly one height (cycling through a few heights), each picture a
    // little smaller than its slot and hung to the top, middle or bottom of the row: a salon hang
    // over a clear grid.
    function shelf(queue, y, heights) {
      var bottom = y, row = [], rowNo = 0, gap = GAP * 1.4;
      function hOf(im) { return heights[rowNo % heights.length] * weight(im) * (im.ar < 0.55 ? 1.7 : 1); }
      function flush() {
        if (!row.length) return;
        var natural = row.reduce(function (s, im) { return s + hOf(im) * im.ar; }, 0);
        var s = clamp((W - gap * (row.length - 1)) / natural, 0.6, 1.05);
        var x = 0;
        var rowH = Math.max.apply(null, row.map(function (im) { return hOf(im) * s; }));
        row.forEach(function (im) {
          var slotW = hOf(im) * im.ar * s;
          var f = im.size === 'large' ? 1 : 0.8 + R() * 0.2;
          var w = slotW * f, h = w / im.ar;
          var align = R(), dy = align < 0.33 ? 0 : align < 0.66 ? (rowH - h) / 2 : rowH - h;
          var z = FINISHED[im.kind] ? 10 : 0;
          bottom = Math.max(bottom, add(im, x + (slotW - w) * R(), y + dy, w, z));
          x += slotW + gap;
        });
        y = bottom + GAP * 2.2;
        row = []; rowNo++;
      }
      queue.forEach(function (im) {
        var widthSoFar = row.reduce(function (s, q) { return s + hOf(q) * q.ar + gap; }, 0);
        if (row.length && widthSoFar + hOf(im) * im.ar > W * 1.12) flush();
        row.push(im);
      });
      flush();
      return bottom;
    }

    // Entry point: the first finished image, large, at the top left and slightly proud.
    var a = fin[0];
    var aH = a.ar < 1 ? 400 : 300, aW = Math.min(540, aH * a.ar), aHt = aW / a.ar;
    var bottom = add(a, 0, 0, aW, 18);
    var rest = fin.slice(1).concat(proc);
    var bx = aW + GAP * 1.6, bw = W - bx;
    // Beside it: two pieces, one hung to its top edge, one to its bottom edge.
    if (rest.length && bw > 220) {
      var two = rest.length > 1 ? 2 : 1;
      var h2 = two === 2 ? (aHt - GAP * 1.4) / 2 : aHt * 0.66;
      for (var b = 0; b < two; b++) {
        var im = rest.shift();
        var w = Math.min(bw, h2 * im.ar), h = w / im.ar;
        var x = bx + (b ? (bw - w) * (0.35 + R() * 0.4) : 0);
        var y = b || two === 1 ? aHt - h : 0;
        bottom = Math.max(bottom, add(im, x, y, w, FINISHED[im.kind] ? 10 : 0));
      }
    }
    if (rest.length) bottom = shelf(rest, bottom + GAP * 2.4, [165, 130, 150]);
    return { height: Math.round(bottom + 60), items: items };
  };

  // ---------- prints ----------
  // One frame for every piece: a dark moulding with real depth (four side faces in CSS 3D, seen
  // at a slight angle when a piece sits off-centre), a white mat with a bevel, then the image.
  G.frame = function (img) {
    var print = document.createElement('span');
    print.className = 'gprint';
    ['t', 'r', 'b', 'l'].forEach(function (side) {
      var e = document.createElement('span');
      e.className = 'ge ge-' + side;
      print.appendChild(e);
    });
    var mat = document.createElement('span');
    mat.className = 'gmat';
    mat.appendChild(img);
    print.appendChild(mat);
    return print;
  };
  // A wall label, like the card beside a painting: name in bold, the title in italics with
  // the year, then a line or two of plain facts.
  G.placard = function (name, title, year, lines) {
    var el = document.createElement('span');
    el.className = 'glabel';
    el.setAttribute('aria-hidden', 'true');
    if (name && name.en) { var b = document.createElement('b'); b.appendChild(G.both(name)); el.appendChild(b); }
    if ((title && title.en) || year) {
      var t = document.createElement('span');
      if (title && title.en) { var em = document.createElement('em'); em.appendChild(G.both(title)); t.appendChild(em); }
      if (year) t.appendChild(document.createTextNode((title && title.en ? ', ' : '') + year));
      el.appendChild(t);
    }
    (lines || []).forEach(function (l) {
      if (!l || !l.en) return;
      var s = document.createElement('span');
      s.appendChild(G.both(l));
      el.appendChild(s);
    });
    return el;
  };
  // entry: { image, kind, caption, ar }; place: { x, y, w, z }; opts: { href, label, placard, eager }
  G.makeItem = function (entry, place, opts) {
    opts = opts || {};
    var pos = document.createElement('div');
    pos.className = 'gpos';
    setPlace(pos, place);
    // Pieces near the right edge open their label towards the left.
    if (place.x + place.w > 700) pos.classList.add('glab-r');
    var act = document.createElement(opts.href ? 'a' : 'button');
    act.className = 'gact';
    if (opts.href) act.href = opts.href; else act.type = 'button';
    if (opts.label) act.setAttribute('aria-label', opts.label);
    var img = document.createElement('img');
    img.src = entry.image;
    img.alt = opts.alt != null ? opts.alt : altOf(entry);
    img.decoding = 'async';
    img.draggable = false;
    if (opts.eager) { img.loading = 'eager'; img.fetchPriority = 'high'; } else img.loading = 'lazy';
    if (entry.ar) img.style.aspectRatio = String(entry.ar);
    var print = G.frame(img);
    act.appendChild(print);
    if (opts.placard) act.appendChild(opts.placard);
    pos.appendChild(act);
    return { pos: pos, act: act, img: img, print: print, place: place, entry: entry, dx: 0, dy: 0 };
  };
  function setPlace(el, p) {
    el.style.setProperty('--x', p.x);
    el.style.setProperty('--y', p.y);
    el.style.setProperty('--w', p.w);
    el.style.setProperty('--z', (p.z || 0) + 'px');
  }
  G.setPlace = setPlace;
  function altOf(entry) {
    var c = entry.caption && entry.caption.en;
    var k = G.KIND[entry.kind];
    return [k && k.en, c].filter(Boolean).join(': ');
  }

  // Text in both languages; CSS shows the active one.
  G.both = function (v) {
    var s = document.createElement('span');
    var en = document.createElement('span'), zh = document.createElement('span');
    en.setAttribute('lang-en', ''); zh.setAttribute('lang-zh', '');
    en.textContent = (v && v.en) || ''; zh.textContent = (v && (v.zh || v.en)) || '';
    s.append(en, zh);
    return s;
  };
  G.nameOf = function (p) { return { en: p.address || '', zh: p.address_zh || p.address || '' }; };
  G.join = function (parts) {
    return {
      en: parts.filter(function (v) { return v && v.en; }).map(function (v) { return v.en; }).join(' · '),
      zh: parts.filter(function (v) { return v && v.en; }).map(function (v) { return v.zh || v.en; }).join(' · ')
    };
  };

  G.reduced = function () { return matchMedia('(prefers-reduced-motion: reduce)').matches; };
  G.finePointer = function () { return matchMedia('(hover: hover) and (pointer: fine)').matches; };

  // ---------- entrance and scroll reveal ----------
  // Pieces rise ~14px and come forward a little, staggered 55ms, settling once.
  G.enter = function (items) {
    if (G.reduced()) return;
    items.forEach(function (it, k) {
      var el = it.pos || it;
      el.classList.add('g-pre');
      el.style.setProperty('--delay', Math.min(k * 55, 440) + 'ms');
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      items.forEach(function (it) { (it.pos || it).classList.remove('g-pre'); });
    }); });
  };
  // Wall groups further down the page settle into place as they come into view.
  G.reveal = function (els) {
    if (G.reduced() || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (list) {
      list.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.remove('g-hidden'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.88) return; // already on screen: leave it be
      el.classList.add('g-hidden');
      io.observe(el);
    });
  };

  // ---------- pointer parallax ----------
  // The camera turns a fraction of a degree toward the pointer and eases back when it leaves.
  var parallaxes = [];
  G.parallax = function (zone, camera) {
    var api = { pause: function () {}, resume: function () {} };
    if (G.reduced() || !G.finePointer()) return api;
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, last = 0, paused = 0, visible = true;
    function apply() {
      camera.style.setProperty('--cam-ry', (cx * 0.6).toFixed(3) + 'deg');
      camera.style.setProperty('--cam-rx', (-cy * 0.4).toFixed(3) + 'deg');
      camera.style.setProperty('--cam-tx', (-cx * 4).toFixed(2) + 'px');
      camera.style.setProperty('--cam-ty', (-cy * 3).toFixed(2) + 'px');
    }
    function step(t) {
      var dt = Math.min(64, t - last); last = t;
      var k = 1 - Math.pow(1 - 0.08, dt / 16.667); // same feel at 60 Hz and 120 Hz
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      if (Math.abs(tx - cx) + Math.abs(ty - cy) < 0.0015) { cx = tx; cy = ty; apply(); raf = 0; return; }
      apply();
      raf = requestAnimationFrame(step);
    }
    function kick() {
      if (raf || paused || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
    function stop() { cancelAnimationFrame(raf); raf = 0; }
    zone.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = zone.getBoundingClientRect();
      tx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1);
      ty = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
      kick();
    }, { passive: true });
    zone.addEventListener('pointerleave', function () { tx = 0; ty = 0; kick(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (list) {
        visible = list[0].isIntersecting;
        if (!visible) stop(); else kick();
      }).observe(zone);
    }
    api.pause = function () { paused++; stop(); };
    api.resume = function () { paused = Math.max(0, paused - 1); kick(); };
    parallaxes.push(api);
    return api;
  };
  function pauseAll() { parallaxes.forEach(function (p) { p.pause(); }); }
  function resumeAll() { parallaxes.forEach(function (p) { p.resume(); }); }

  // ---------- dragging ----------
  // Optional rearranging on project walls. A drag starts after 7px; a plain click still opens.
  var topZ = 10;
  G.draggable = function (it, bounds, onChange) {
    var el = it.act, start = null;
    el.addEventListener('pointerdown', function (e) {
      if (!e.isPrimary || e.button !== 0) return;
      start = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: it.dx, dy: it.dy, moved: false };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', cancel);
    });
    // Listen on the document: a quick first move can leave the piece before the drag starts.
    function move(e) {
      if (!start || e.pointerId !== start.id) return;
      var mx = e.clientX - start.x, my = e.clientY - start.y;
      if (!start.moved) {
        if (Math.hypot(mx, my) < 7) return;
        start.moved = true;
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
        it.pos.classList.add('dragging');
        it.pos.style.zIndex = ++topZ;
        pauseAll();
      }
      var b = bounds(it);
      it.dx = clamp(start.dx + mx, b.minX, b.maxX);
      it.dy = clamp(start.dy + my, b.minY, b.maxY);
      it.pos.style.setProperty('--dx', it.dx + 'px');
      it.pos.style.setProperty('--dy', it.dy + 'px');
    }
    function end(e, cancelled) {
      if (!start || e.pointerId !== start.id) return;
      var moved = start.moved;
      if (moved && cancelled) {
        it.dx = start.dx; it.dy = start.dy;
        it.pos.style.setProperty('--dx', it.dx + 'px');
        it.pos.style.setProperty('--dy', it.dy + 'px');
      }
      start = null;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
      if (moved) {
        it.suppressClick = true;
        setTimeout(function () { it.suppressClick = false; }, 0);
        it.pos.classList.remove('dragging');
        resumeAll();
        onChange && onChange();
      }
    }
    function up(e) { end(e, false); }
    function cancel(e) { end(e, true); }
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });
  };

  // ---------- image viewer ----------
  // Selecting a piece brings it closer, frame and all: the framed print grows from its place on
  // the wall (FLIP) to a comfortable size above a bottom banner with the project information.
  // Esc, arrows, focus trap; focus goes back to the piece on close.
  var V = null;
  var BUTTONS =
    '<button type="button" class="viewer-prev"><span lang-en>Previous</span><span lang-zh>上一张</span></button>' +
    '<span class="viewer-count"></span>' +
    '<button type="button" class="viewer-next"><span lang-en>Next</span><span lang-zh>下一张</span></button>' +
    '<button type="button" class="viewer-close"><span lang-en>Close</span><span lang-zh>关闭</span></button>';
  function buildViewer() {
    var el = document.createElement('div');
    el.className = 'viewer';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Image viewer');
    el.innerHTML =
      '<div class="viewer-bg"></div>' +
      '<div class="viewer-frame"></div>' +
      '<div class="viewer-bar pad">' +
        '<div class="viewer-info"></div>' +
        '<div class="viewer-side"><p class="viewer-cap"></p><div class="viewer-ctl">' + BUTTONS + '</div></div>' +
      '</div>';
    document.body.appendChild(el);
    var img = document.createElement('img');
    img.alt = '';
    var print = G.frame(img);
    el.querySelector('.viewer-frame').appendChild(print);
    V = {
      el: el, bg: el.querySelector('.viewer-bg'), frame: el.querySelector('.viewer-frame'), print: print, img: img,
      bar: el.querySelector('.viewer-bar'), info: el.querySelector('.viewer-info'),
      cap: el.querySelector('.viewer-cap'), count: el.querySelector('.viewer-count'),
      prev: el.querySelector('.viewer-prev'), next: el.querySelector('.viewer-next'),
      close: el.querySelector('.viewer-close'), list: null, i: 0, opener: null, anims: [], open: false
    };
    V.bg.addEventListener('click', closeViewer);
    V.frame.addEventListener('click', closeViewer);
    V.close.addEventListener('click', closeViewer);
    V.prev.addEventListener('click', function () { go(-1); });
    V.next.addEventListener('click', function () { go(1); });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeViewer(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'Tab') {
        var f = [V.prev, V.next, V.close].filter(function (b) { return !b.disabled; });
        var i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    addEventListener('resize', function () { if (V.open) fit(V.list[V.i]); });
  }
  // Frame sizes as on the wall: moulding ~1.7% of the frame width, mat ~4% of the inside width.
  function frameParts(W) {
    var m = clamp(W * 0.017, 4, 12), p = clamp((W - 2 * m) * 0.04, 5, 24);
    return { m: m, p: p };
  }
  // The framed print fits between the nav and the banner, with generous space at the sides.
  function target(entry) {
    var vw = innerWidth, vh = innerHeight, small = vw < 700;
    var top = small ? 70 : 110, bottom = V.bar.offsetHeight + (small ? 18 : 40);
    var side = small ? 16 : Math.max(80, vw * 0.17);
    var bw = vw - side * 2, bh = Math.max(120, vh - top - bottom);
    var ar = entry.ar || 1.5, W = bw, H = 0, f;
    for (var k = 0; k < 4; k++) {
      f = frameParts(W);
      H = (W - 2 * f.m - 2 * f.p) / ar + 2 * f.m + 2 * f.p;
      if (H <= bh + 0.5) break;
      W *= bh / H;
    }
    f = frameParts(W);
    H = (W - 2 * f.m - 2 * f.p) / ar + 2 * f.m + 2 * f.p;
    return { left: (vw - W) / 2, top: top + (bh - H) / 2, width: W, height: H, m: f.m, p: f.p };
  }
  function fit(entry) {
    var t = target(entry), s = V.frame.style;
    s.left = t.left + 'px'; s.top = t.top + 'px'; s.width = t.width + 'px';
    V.print.style.padding = t.m + 'px';
    V.print.querySelector('.gmat').style.padding = t.p + 'px';
    return t;
  }
  function cancelAnims() { V.anims.forEach(function (a) { a.cancel(); }); V.anims = []; }
  // FLIP: the framed print starts where the piece hangs and grows into place (or the reverse).
  function fly(from, to, back, done) {
    var dx = from.left - to.left, dy = from.top - to.top, s = from.width / to.width;
    var frames = [{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')' }, { transform: 'none' }];
    if (back) frames.reverse();
    var a = V.frame.animate(frames, { duration: back ? 480 : 560, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: back ? 'forwards' : 'none' });
    V.anims.push(a);
    a.onfinish = function () { done && done(); };
    return a;
  }
  function visibleRect(el) {
    if (!el || !el.isConnected) return null;
    var r = el.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  function show(entry) {
    V.img.src = entry.image;
    V.img.alt = altOf(entry);
    V.img.style.aspectRatio = String(entry.ar || 1.5);
    // Caption written like a wall label: the title in italics, the year, then the kind.
    var cap = document.createElement('span');
    if (entry.caption && entry.caption.en) { var em = document.createElement('em'); em.appendChild(G.both(entry.caption)); cap.appendChild(em); }
    if (entry.year) cap.appendChild(document.createTextNode(', ' + entry.year));
    var kind = G.KIND[entry.kind];
    if (kind) { var k = document.createElement('span'); k.className = 'viewer-kind'; k.appendChild(G.both(kind)); cap.appendChild(k); }
    V.cap.replaceChildren(cap);
    V.count.textContent = (V.i + 1) + ' / ' + V.list.length;
    var multi = V.list.length > 1;
    V.prev.disabled = !multi; V.next.disabled = !multi;
    return fit(entry);
  }
  // list: [{ image, kind, caption, ar, year, thumb (the piece's frame), opener (element) }]
  // opts.info: a node with the project information for the banner.
  G.openViewer = function (list, i, opts) {
    if (!V) buildViewer();
    cancelAnims();
    V.list = list; V.i = i; V.opener = list[i].opener || document.activeElement;
    V.info.replaceChildren(opts && opts.info ? opts.info.cloneNode(true) : '');
    var entry = list[i];
    var wasOpen = V.open;
    V.open = true;
    V.el.hidden = false;
    document.documentElement.classList.add('viewer-open');
    if (!wasOpen) { pauseAll(); document.dispatchEvent(new CustomEvent('hdc:viewer', { detail: { open: true } })); }
    var to = show(entry), from = visibleRect(entry.thumb);
    V.el.classList.add('on');
    if (!G.reduced() && from && !wasOpen) fly(from, to, false);
    V.close.focus({ preventScroll: true });
  };
  function go(d) {
    if (!V.open || V.list.length < 2) return;
    cancelAnims();
    V.i = (V.i + d + V.list.length) % V.list.length;
    show(V.list[V.i]);
    if (!G.reduced()) V.anims.push(V.frame.animate([{ opacity: 0, transform: 'translateX(' + (d * 16) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }));
  }
  function closeViewer() {
    if (!V || !V.open) return;
    cancelAnims();
    V.open = false;
    var entry = V.list[V.i];
    var to = visibleRect(entry.thumb);
    var from = target(entry);
    var opener = entry.opener || V.opener;
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      V.el.hidden = true;
      V.el.classList.remove('on', 'closing');
      cancelAnims();
      document.documentElement.classList.remove('viewer-open');
      resumeAll();
      document.dispatchEvent(new CustomEvent('hdc:viewer', { detail: { open: false } }));
    }
    V.el.classList.remove('on');
    V.el.classList.add('closing');
    if (G.reduced() || !to) setTimeout(finish, G.reduced() ? 120 : 280);
    else { var a = fly(to, from, true, finish); a.oncancel = finish; }
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  G.closeViewer = closeViewer;

  // ---------- page-to-page continuity ----------
  // When a picture on the home page is clicked, remember where it was; the project page then
  // flies the same picture from there into its place on the wall (FLIP), without delaying
  // the navigation itself.
  G.rememberFlight = function (img) {
    try {
      var r = img.getBoundingClientRect();
      sessionStorage.setItem('hdc-flight', JSON.stringify({ src: img.getAttribute('src'), l: r.left, t: r.top, w: r.width, h: r.height, at: Date.now() }));
    } catch (e) {}
  };
  G.takeFlight = function () {
    try {
      var f = JSON.parse(sessionStorage.getItem('hdc-flight') || 'null');
      sessionStorage.removeItem('hdc-flight');
      if (!f || Date.now() - f.at > 4000) return null;
      return f;
    } catch (e) { return null; }
  };
  G.landFlight = function (f, img) {
    if (!f || !img || G.reduced()) return;
    var r = img.getBoundingClientRect();
    if (!r.width) return;
    var dx = f.l - r.left, dy = f.t - r.top, s = f.w / r.width;
    img.animate([
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')', transformOrigin: '0 0' },
      { transform: 'none', transformOrigin: '0 0' }
    ], { duration: 620, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.HDCGallery = G;
})(typeof window !== 'undefined' ? window : globalThis);
