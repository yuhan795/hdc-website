// Project page: project.html?p=<slug>, filled from content/projects.json (edited in /admin).
// The images float as cards at random places, like BAD STUDIO's Works board: drag one to
// move it, click it to enlarge it. project.html?preview shows a draft sent by the admin.
(function () {
  var KIND = {
    render:  { en: 'Rendering',          zh: '效果图' },
    drawing: { en: 'Drawing',            zh: '图纸' },
    board:   { en: 'Material selection', zh: '材料选样' },
    site:    { en: 'Existing condition', zh: '现场' },
    construction: { en: 'Construction', zh: '施工' },
    built:   { en: 'Completed',          zh: '完成实景' },
    photo:   { en: 'Photo',              zh: '照片' }
  };
  // The page is one screen. Cards share the space above the project text, sized so that
  // together they would cover about this much of it (they overlap, at different depths).
  var CARD_FILL = 0.6;
  var fit = 1;
  var board = document.getElementById('pboard');
  var params = new URLSearchParams(location.search);
  var preview = params.has('preview');
  var notes = [], drag = null, scrolling = 0, boardHeight = innerHeight, project = null;
  // Depth: every card sits at its own distance (0 far … 1 near). Far cards are smaller, softer
  // and drift less with the mouse; the card under the pointer floats up to the front.
  var FRONT = 1.12, frontNote = null, tiltX = 0, tiltY = 0;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Text in both languages; CSS shows the active one
  function both(v) {
    var s = document.createElement('span');
    var en = document.createElement('span'), zh = document.createElement('span');
    en.setAttribute('lang-en', ''); zh.setAttribute('lang-zh', '');
    en.textContent = (v && v.en) || ''; zh.textContent = (v && (v.zh || v.en)) || '';
    s.append(en, zh);
    return s;
  }
  // A project's name in both languages; the Chinese one is optional.
  function nameOf(p) { return { en: p.address || '', zh: p.address_zh || p.address || '' }; }
  function clamp(v, min, max) { return Math.max(min, Math.min(Math.max(min, max), v)); }
  function topInset() { return innerWidth < 640 ? 76 : 96; }

  // ---------- project text ----------
  function renderInfo(p, all) {
    document.title = (p.address || 'Project') + ' — HANZ Design Collective';
    document.getElementById('ptitle').replaceChildren(both(nameOf(p)));
    var meta = document.getElementById('pmeta');
    meta.replaceChildren();
    // The bar under the cards shows only these four; the title stays for screen readers.
    [[{ en: 'Location', zh: '地点' }, p.location],
     [{ en: 'Services', zh: '服务' }, p.services],
     [{ en: 'Team', zh: '团队' }, p.credit],
     [{ en: 'Status', zh: '状态' }, p.status]
    ].forEach(function (r) {
      if (!r[1] || !r[1].en) return;
      var dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.appendChild(both(r[0])); dd.appendChild(both(r[1]));
      var item = document.createElement('div');
      item.append(dt, dd);
      meta.appendChild(item);
    });
  }

  // ---------- cards ----------
  function look(note) {
    if (note === zoomed) {
      note.el.style.transform = 'translate3d(' + note.zoom.x + 'px,' + note.zoom.y + 'px,0) scale(1)';
      note.el.style.filter = 'none';
      note.el.style.zIndex = 2000;
      return;
    }
    var d = note === frontNote ? FRONT : note.depth;
    var drift = still ? 0 : d - 0.45;
    note.el.style.transform = 'translate3d(' + (note.x + tiltX * drift * 36) + 'px,' + (note.y + tiltY * drift * 24) + 'px,0) scale(' + (0.6 + 0.4 * d) + ')';
    // Far cards stay opaque (paper cards shouldn't show through each other) but go soft and pale.
    var far = Math.max(0, 0.8 - d);
    note.el.style.filter = far ? 'blur(' + (far * 2.6).toFixed(2) + 'px) saturate(' + (1 - far * 0.5).toFixed(2) + ') contrast(' + (1 - far * 0.35).toFixed(2) + ') brightness(' + (1 + far * 0.08).toFixed(2) + ')' : 'none';
    note.el.style.zIndex = note === frontNote ? 1000 : Math.round(d * 100);
  }
  function front(note) {
    if (frontNote === note) return;
    var previous = frontNote;
    frontNote = note;
    if (previous) look(previous);
    look(note);
  }
  function place(note, x, y) {
    note.x = clamp(x, 8, board.clientWidth - note.width - 8);
    note.y = clamp(y, topInset(), boardHeight - note.height - 8);
    look(note);
  }
  // The whole board shifts a little with the mouse; near cards move more than far ones.
  if (!still) document.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || drag) return;
    tiltX = e.clientX / innerWidth - 0.5; tiltY = e.clientY / innerHeight - 0.5;
    notes.forEach(look);
  }, { passive: true });
  // Landscape cards a little wider than portrait ones; each keeps its own size, from small to
  // large, and none is taller than the free space above the project text.
  function size(note) {
    var ratio = note.w / note.h;
    // A little larger than shown at the back: depth scales far cards down to about 0.65.
    var base = innerWidth < 640 ? innerWidth * 0.52 : clamp(innerWidth * 0.24, 260, 500);
    var width = Math.min(base * (ratio < 1 ? 0.72 : 1) * note.jitter * fit, board.clientWidth - 16);
    // Width animates in CSS, so measure the final size with the animation off, then animate
    // from the current width. (Reading the height mid-animation gave a wrong size, and the
    // next enlarge of that card came out far too small.)
    var from = note.el.style.width;
    note.el.style.transition = 'none';
    function measure(w) {
      note.el.style.width = w + 'px';
      note.el.style.setProperty('--frame', (w * 0.045).toFixed(1) + 'px'); // white margin around the image
      return note.el.offsetHeight; // includes the frame
    }
    var height = measure(width);
    var maxHeight = infoTop() - topInset() - 8;
    if (height > maxHeight) { width *= maxHeight / height; height = measure(width); }
    note.width = width;
    note.height = height || width / ratio;
    if (from && from !== note.el.style.width) { note.el.style.width = from; void note.el.offsetHeight; }
    note.el.style.transition = '';
    note.el.style.width = width + 'px';
  }
  function fitBoard() {
    boardHeight = innerHeight;
    board.style.height = boardHeight + 'px';
  }
  // Where the project text starts: cards are laid out above this line.
  function infoTop() { return document.getElementById('pmeta').getBoundingClientRect().top - 24; }
  function fitCards() {
    fit = 1;
    notes.forEach(size);
    var room = infoTop() - topInset();
    var area = notes.reduce(function (sum, n) { return sum + n.width * n.height; }, 0);
    fit = Math.min(1, Math.sqrt(CARD_FILL * board.clientWidth * room / area));
    notes.forEach(size);
  }
  function spread(created) {
    var bottom = infoTop();
    // Shuffled cards take turns across the width, each at a random height above the text.
    created.forEach(function (n, k) {
      var x = 8 + (k + Math.random()) / created.length * Math.max(0, board.clientWidth - n.width - 16);
      var y = topInset() + Math.random() * Math.max(0, bottom - topInset() - n.height);
      place(n, x, y);
    });
  }

  function makeNote(entry, index, img) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'pcard';
    el.setAttribute('aria-label', ((entry.caption && entry.caption.en) || 'Image') + '. Drag to move, click to enlarge.');
    img.alt = (entry.caption && entry.caption.en) || '';
    img.draggable = false;
    var frame = document.createElement('span');
    frame.className = 'pframe';
    el.append(img, frame);
    var note = { el: el, index: index, w: img.naturalWidth || 4, h: img.naturalHeight || 3,
      // Mostly small and medium cards, with a few large ones.
      jitter: 0.5 + Math.pow(Math.random(), 1.6) * 1.15, depth: 0.15 + Math.random() * 0.85, x: 0, y: 0, width: 0, height: 0, suppressClick: false };
    notes.push(note); board.appendChild(el); fillFrame(note); size(note);
    el.addEventListener('pointerenter', function () { if (!drag) front(note); });
    el.addEventListener('pointerdown', function (e) { startDrag(e, note); });
    el.addEventListener('click', function (e) {
      if (note.suppressClick) { note.suppressClick = false; e.preventDefault(); return; }
      if (zoomed === note) unzoom(); else zoom(note);
    });
    el.addEventListener('keydown', function (e) {
      var dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (dir) { e.preventDefault(); var step = e.shiftKey ? 30 : 10; place(note, note.x + dir[0] * step, note.y + dir[1] * step); }
    });
    return note;
  }

  // Each card is printed like a BAD STUDIO Works card: the image on white paper, with the
  // project, the image and the year typed underneath.
  function fillFrame(note) {
    var p = project, entry = p.images[note.index];
    if (!entry) return;
    function row(key, value) {
      var r = document.createElement('span');
      r.className = 'pframe-row';
      var k = document.createElement('span'); k.className = 'pframe-k'; k.appendChild(both(key));
      var v = document.createElement('span'); v.className = 'pframe-v'; v.appendChild(value);
      r.append(k, v);
      return r;
    }
    function join(a, b) {
      var en = [a && a.en, b && b.en].filter(Boolean).join(' · ');
      var zh = [a && (a.zh || a.en), b && (b.zh || b.en)].filter(Boolean).join(' · ');
      return both({ en: en, zh: zh });
    }
    var year = p.year ? String(p.year) : '';
    note.el.querySelector('.pframe').replaceChildren(
      row({ en: 'Project:', zh: '项目：' }, join(nameOf(p), p.type)),
      row({ en: 'Image:', zh: '图片：' }, join(KIND[entry.kind], entry.caption)),
      year ? row({ en: 'Year:', zh: '年份：' }, both({ en: year, zh: year })) : '');
  }

  function renderCards(p) {
    board.replaceChildren(); notes = []; frontNote = null; zoomed = null; board.classList.remove('zooming');
    var images = p.images || [];
    if (!images.length) {
      var empty = document.createElement('p');
      empty.className = 'pempty lbl';
      empty.appendChild(both({ en: 'Images coming soon', zh: '图片即将更新' }));
      board.appendChild(empty);
      fitBoard();
      return;
    }
    Promise.all(images.map(function (entry) {
      return new Promise(function (done) {
        var img = new Image();
        img.onload = function () { done(img); };
        img.onerror = function () { done(null); };
        img.src = entry.image;
      });
    })).then(function (loaded) {
      if (project !== p) return; // a newer draft arrived meanwhile
      var order = images.map(function (entry, i) { return i; }).filter(function (i) { return loaded[i]; });
      // Visitors get a random order; the admin preview keeps the list order.
      if (!preview) for (var i = order.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t;
      }
      // Cards appear where they belong instead of gliding in from the corner.
      board.classList.add('setup');
      requestAnimationFrame(function () { requestAnimationFrame(function () { board.classList.remove('setup'); }); });
      var created = order.map(function (i) { return makeNote(images[i], i, loaded[i]); });
      fitBoard();
      fitCards();
      if (created.length === 1) {
        var n = created[0];
        return place(n, (board.clientWidth - n.width) / 2, topInset() + (infoTop() - topInset() - n.height) / 2);
      }
      spread(created);
    });
  }

  // ---------- dragging (from BAD STUDIO's work.js) ----------
  function startDrag(e, note) {
    if (!e.isPrimary || e.button !== 0 || drag || note === zoomed) return;
    front(note); note.suppressClick = false;
    drag = { note: note, id: e.pointerId, x: e.clientX, y: e.clientY, originX: note.x, originY: note.y,
      scrollY: scrollY, currentX: e.clientX, currentY: e.clientY, moved: false };
    note.el.setPointerCapture(e.pointerId);
  }
  function updateDrag() {
    if (!drag) return;
    var dx = drag.currentX - drag.x, dy = drag.currentY - drag.y + scrollY - drag.scrollY;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    if (drag.moved) { drag.note.el.classList.add('dragging'); place(drag.note, drag.originX + dx, drag.originY + dy); }
  }
  function autoScroll() {
    scrolling = 0;
    if (!drag || !drag.moved) return;
    var edge = 65;
    var speed = drag.currentY < edge ? -(edge - drag.currentY) * 0.2
      : drag.currentY > innerHeight - edge ? (drag.currentY - innerHeight + edge) * 0.2 : 0;
    if (speed) { scrollBy(0, clamp(speed, -18, 18)); updateDrag(); }
    scrolling = requestAnimationFrame(autoScroll);
  }
  document.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag.currentX = e.clientX; drag.currentY = e.clientY;
    updateDrag();
    if (drag.moved && !scrolling) scrolling = requestAnimationFrame(autoScroll);
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var note = drag.note, id = drag.id;
    note.suppressClick = drag.moved || e.type === 'pointercancel';
    note.el.classList.remove('dragging');
    drag = null;
    if (note.el.hasPointerCapture(id)) note.el.releasePointerCapture(id);
    cancelAnimationFrame(scrolling); scrolling = 0;
  }
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  document.addEventListener('lostpointercapture', endDrag);
  addEventListener('resize', function () {
    fitBoard();
    unzoom();
    if (!notes.length) return;
    fitCards();
    notes.forEach(function (n) { place(n, n.x, Math.min(n.y, infoTop() - n.height)); });
  });

  // ---------- enlarged card ----------
  // Clicking a card grows that card itself to fill the space between the nav and the project
  // text; clicking it again (or anywhere else, or Esc) puts it back.
  var zoomed = null;
  function zoom(note) {
    if (zoomed) unzoom();
    zoomed = note;
    board.classList.add('zooming');
    note.el.classList.add('zoomed');
    var room = { w: board.clientWidth - 48, h: infoTop() - topInset() - 16 };
    // Measure the enlarged size with animation off, then animate from the card's size to it.
    var from = note.el.style.width;
    note.el.style.transition = 'none';
    function measure(width) {
      note.el.style.width = width + 'px';
      note.el.style.setProperty('--frame', (width * 0.03).toFixed(1) + 'px');
      return note.el.offsetHeight;
    }
    var width = Math.min(room.w, room.h * note.width / note.height);
    var height = measure(width);
    if (height > room.h) { width *= room.h / height; height = measure(width); }
    note.el.style.width = from;
    void note.el.offsetHeight;
    note.el.style.transition = '';
    note.el.style.width = width + 'px';
    note.zoom = { x: (board.clientWidth - width) / 2, y: topInset() + 8 + (room.h - height) / 2 };
    look(note);
  }
  function unzoom() {
    var note = zoomed;
    if (!note) return;
    zoomed = null;
    board.classList.remove('zooming');
    note.el.classList.remove('zoomed');
    size(note);
    look(note);
  }
  document.addEventListener('click', function (e) { if (zoomed && !zoomed.el.contains(e.target)) unzoom(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') unzoom(); });

  var shownImages = '';
  function render(p, all) {
    // Typing in the admin re-sends the draft; the cards only move when the images change.
    var images = JSON.stringify(p.images || []);
    var same = preview && images === shownImages;
    shownImages = images;
    if (!same) unzoom();
    renderInfo(p, all);
    if (same && project) {
      p.images = project.images;
      project = p;
      notes.forEach(fillFrame);
      return;
    }
    project = p;
    renderCards(p);
  }

  if (preview) {
    // The admin sends the project being edited, including images not yet published.
    addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.type !== 'hdc-preview') return;
      render(e.data.project, e.data.all || [e.data.project]);
    });
    parent.postMessage({ type: 'hdc-preview-ready' }, location.origin);
    return;
  }
  fetch('content/projects.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (data) {
    var all = data.items || [];
    var p = all.find(function (q) { return q.slug === params.get('p'); });
    if (!p) { location.replace('index.html#projects'); return; }
    render(p, all);
  }).catch(console.error);
})();
