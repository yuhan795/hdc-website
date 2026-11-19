// Project page: project.html?p=<slug>, filled from content/projects.json (edited in /admin).
// All images hang together on one shallow gallery wall, in the same frames: finished work first
// and larger (the first finished image is the entry point), drawings, boards and site photos
// mixed in after it, smaller. Positions come from content/gallery.json (written by
// tools/gallery-layout.mjs, tunable by hand); images without a stored position get the same
// automatic layout on the fly. Select a piece to look closer (the viewer keeps the frame and shows
// the project information in a bottom banner); drag to rearrange, "Reset arrangement" restores
// the composition. project.html?preview shows a draft sent by the admin.
(function () {
  var G = window.HDCGallery;
  var wallBox = document.getElementById('pwall');
  var resetBtn = document.getElementById('preset');
  var params = new URLSearchParams(location.search);
  var preview = params.has('preview');
  var project = null, layout = null, group = null, items = [], mode = '', flight = G.takeFlight();
  var both = G.both;

  // ---------- project text ----------
  function facts(p) {
    var year = p.year ? { en: String(p.year), zh: String(p.year) } : null;
    return [[{ en: 'Location', zh: '地点' }, p.location],
      [{ en: 'Services', zh: '服务' }, p.services],
      [{ en: 'Team', zh: '团队' }, p.credit],
      [{ en: 'Year', zh: '年份' }, year],
      [{ en: 'Status', zh: '状态' }, p.status]];
  }
  function metaList(p) {
    var meta = document.createElement('dl');
    meta.className = 'pmeta';
    facts(p).forEach(function (r) {
      if (!r[1] || !r[1].en) return;
      var dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.appendChild(both(r[0])); dd.appendChild(both(r[1]));
      var item = document.createElement('div');
      item.append(dt, dd);
      meta.appendChild(item);
    });
    return meta;
  }
  var bannerInfo = null;
  function renderInfo(p) {
    document.title = (p.address || 'Project') + ' · HANZ Design Collective';
    document.getElementById('ptitle').replaceChildren(both(G.nameOf(p)));
    var meta = metaList(p);
    meta.id = 'pmeta';
    document.getElementById('pmeta').replaceWith(meta);
    // The viewer's bottom banner: the project name and the same facts.
    bannerInfo = document.createElement('div');
    var name = document.createElement('p');
    name.className = 'viewer-name';
    name.appendChild(both(G.nameOf(p)));
    bannerInfo.append(name, metaList(p));
  }

  // ---------- layout ----------
  function storedLayout(p, gal) {
    var s = gal && gal.projects && gal.projects[p.slug];
    var imgs = p.images || [];
    if (!s || s.items.length !== imgs.length) return null;
    var have = {};
    s.items.forEach(function (it) { have[it.image] = 1; });
    return imgs.every(function (im) { return have[im.image]; }) ? s : null;
  }
  // Aspect ratios for images that have none stored (new uploads, admin drafts).
  function withRatios(p, gal) {
    var known = {};
    Object.keys((gal && gal.projects) || {}).forEach(function (s) { gal.projects[s].items.forEach(function (it) { known[it.image] = it.ar; }); });
    return Promise.all((p.images || []).map(function (im) {
      if (known[im.image]) return Promise.resolve(Object.assign({}, im, { ar: known[im.image] }));
      return new Promise(function (done) {
        var img = new Image();
        img.onload = function () { done(Object.assign({}, im, { ar: img.naturalWidth / img.naturalHeight })); };
        img.onerror = function () { done(null); };
        img.src = im.image;
      });
    })).then(function (list) { return list.filter(Boolean); });
  }
  function resolveLayout(p, gal) {
    var s = storedLayout(p, gal);
    if (s) return Promise.resolve(s);
    return withRatios(p, gal).then(function (imgs) {
      if (!imgs.length) return { height: 0, items: [] };
      var l = G.autoLayout(p.slug, imgs);
      var ar = {};
      imgs.forEach(function (im) { ar[im.image] = im.ar; });
      l.items.forEach(function (it) { it.ar = ar[it.image]; });
      return l;
    });
  }

  // Phones: one vertical sequence in the same order: finished work at near full width,
  // process pieces smaller, alternating left and right.
  function mobileLayout(l, kinds) {
    var out = [], y = 0, k = 0;
    l.items.forEach(function (it, i) {
      var finished = G.isFinished(kinds[it.image]);
      var w = i === 0 ? 1000 : finished ? (it.ar < 1 ? 720 : 880) : (it.ar < 0.6 ? 420 : it.ar < 1 ? 560 : 700);
      var x = i === 0 ? 0 : (k++ % 2 ? 1000 - w : 0);
      out.push(Object.assign({}, it, { x: x, y: y, w: w, r: 0, z: 0 }));
      y += w / it.ar + 110;
    });
    return { height: y, items: out };
  }

  // ---------- wall ----------
  function currentMode() { return innerWidth < 700 ? 'mobile' : 'wall'; }
  function renderWall() {
    if (!layout) return;
    mode = currentMode();
    var byImage = {}, kinds = {};
    (project.images || []).forEach(function (im) { byImage[im.image] = im; kinds[im.image] = im.kind; });
    var l = mode === 'mobile' ? mobileLayout(layout, kinds) : layout;
    wallBox.replaceChildren();
    items = [];
    var h = l.items.reduce(function (m, it) { return Math.max(m, it.y + it.w / it.ar); }, 0) + 40;
    var gv = document.createElement('div');
    gv.className = 'gv pgroup';
    var cam = document.createElement('div'); cam.className = 'gcam';
    var canvas = document.createElement('div'); canvas.className = 'gcanvas';
    var wall = document.createElement('div'); wall.className = 'gwall';
    canvas.appendChild(wall); cam.appendChild(canvas); gv.appendChild(cam);
    wallBox.appendChild(gv);
    var name = G.nameOf(project), year = project.year ? String(project.year) : '';
    l.items.forEach(function (pl, i) {
      var entry = Object.assign({}, byImage[pl.image] || { image: pl.image, kind: 'photo' }, { ar: pl.ar });
      var label = G.placard(name, entry.caption, year, [G.KIND[entry.kind], project.location]);
      var it = G.makeItem(entry, pl, {
        placard: label, eager: i < 3,
        label: G.join([G.KIND[entry.kind], entry.caption]).en + ', look closer'
      });
      wall.appendChild(it.pos);
      if (mode !== 'mobile' && G.finePointer()) G.draggable(it, bounds, function () { resetBtn.hidden = false; });
      items.push(it);
    });
    if (items[0]) items[0].pos.classList.add('glead');
    group = { el: gv, cam: cam, h: h };
    sizeGroup();
    G.parallax(gv, cam);
    var list = items.map(function (it) { return Object.assign({}, it.entry, { thumb: it.print, opener: it.act, year: year }); });
    items.forEach(function (it, i) {
      it.act.addEventListener('click', function (e) {
        if (it.suppressClick) { e.preventDefault(); return; }
        G.openViewer(list, i, { info: bannerInfo });
      });
    });
    resetBtn.hidden = true;
  }
  function sizeGroup() {
    if (!group) return;
    var u = group.el.clientWidth / 1000;
    group.el.style.setProperty('--u', u + 'px');
    group.el.style.height = Math.ceil(group.h * u) + 'px';
    group.u = u;
  }
  // Dragged pieces stay within the wall, so they can always be found again.
  function bounds(it) {
    var u = group.u, g = it.place, h = g.w / it.entry.ar;
    return { minX: -g.x * u, maxX: (1000 - g.x - g.w) * u, minY: -g.y * u, maxY: Math.max(0, group.h - g.y - h) * u };
  }
  resetBtn.addEventListener('click', function () {
    items.forEach(function (it) {
      if (!it.dx && !it.dy) return;
      it.dx = 0; it.dy = 0;
      it.pos.style.setProperty('--dx', '0px');
      it.pos.style.setProperty('--dy', '0px');
      it.pos.style.zIndex = '';
    });
    resetBtn.hidden = true;
    if (items[0]) items[0].act.focus({ preventScroll: true });
  });

  // ---------- render ----------
  var gallery = null;
  function render(p) {
    project = p;
    renderInfo(p);
    var token = {};
    render.token = token;
    resolveLayout(p, gallery).then(function (l) {
      if (render.token !== token) return; // a newer draft arrived meanwhile
      layout = l;
      if (!l.items.length) {
        wallBox.innerHTML = '<p class="pempty lbl"><span lang-en>Images coming soon</span><span lang-zh>图片即将更新</span></p>';
        return;
      }
      renderWall();
      // Entrance: the wall settles in once; if we came from a picture on the home page, that
      // picture flies from where it was into its place here.
      var landed = null;
      if (flight) {
        landed = items.filter(function (it) { return it.entry.image === flight.src; })[0];
        if (landed) { var f = flight; requestAnimationFrame(function () { G.landFlight(f, landed.print); }); }
        flight = null;
      }
      G.enter(items.filter(function (it) { return it !== landed; }));
    });
  }

  var resizeTimer = 0;
  addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!layout) return;
      if (currentMode() !== mode) renderWall(); else sizeGroup();
    }, 80);
  });

  var load = fetch('content/gallery.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { return {}; });
  if (preview) {
    // The admin sends the project being edited, including images not yet published.
    var lastImages = '';
    load.then(function (gal) {
      gallery = gal;
      addEventListener('message', function (e) {
        if (e.origin !== location.origin || !e.data || e.data.type !== 'hdc-preview') return;
        var p = e.data.project;
        var imgs = JSON.stringify(p.images || []);
        // Typing in the admin re-sends the draft; the wall only rebuilds when the images change.
        if (imgs === lastImages && project) { renderInfo(p); project = p; return; }
        lastImages = imgs;
        render(p);
      });
      parent.postMessage({ type: 'hdc-preview-ready' }, location.origin);
    });
    return;
  }
  Promise.all([fetch('content/projects.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }), load]).then(function (res) {
    gallery = res[1];
    var p = (res[0].items || []).find(function (q) { return q.slug === params.get('p'); });
    if (!p) { location.replace('index.html#projects'); return; }
    render(p);
  }).catch(console.error);
})();
