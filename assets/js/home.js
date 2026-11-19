// Home page: the opening gallery wall in the hero, then the three featured projects.
// Only finished work (renderings and photographs) hangs on the home page; drawings and other
// process material stay on the project pages. Compositions come from content/gallery.json
// ("home"); project facts from content/projects.json.
(function () {
  var G = window.HDCGallery;
  var stage = document.getElementById('hstage');
  var works = document.getElementById('works');
  if (!stage || !G) return;

  var projects = {}, entries = {}, ar = {};

  Promise.all([
    fetch('content/projects.json').then(function (r) { return r.json(); }),
    fetch('content/gallery.json').then(function (r) { return r.json(); })
  ]).then(function (res) {
    res[0].items.forEach(function (p) {
      projects[p.slug] = p;
      (p.images || []).forEach(function (im) { entries[im.image] = im; });
    });
    var layouts = res[1].projects || {};
    Object.keys(layouts).forEach(function (s) { layouts[s].items.forEach(function (it) { ar[it.image] = it.ar; }); });
    hero(res[1].home);
    selected(res[1].home.selected || []);
  }).catch(console.error);

  function entryFor(image) {
    var entry = Object.assign({ image: image, kind: 'render' }, entries[image] || {});
    entry.ar = ar[image] || 1.5;
    return entry;
  }
  // Only finished pieces on the home page, even if the configuration names a drawing.
  function finished(image) { return G.isFinished(entryFor(image).kind); }
  function href(slug) { return 'project.html?p=' + encodeURIComponent(slug); }
  function yearOf(p) { return p.year ? String(p.year) : ''; }
  // Wall label for a project: name, type and year, location, and the way in.
  function projectPlacard(p) {
    return G.placard(G.nameOf(p), p.type, yearOf(p), [p.location, { en: 'View project →', zh: '查看项目 →' }]);
  }
  function piece(p, image, place, eager) {
    var it = G.makeItem(entryFor(image), place, {
      href: href(p.slug), placard: projectPlacard(p), eager: eager,
      label: (p.address || '') + ', view project'
    });
    it.act.addEventListener('click', function () { G.rememberFlight(it.img); });
    return it;
  }

  // ---------- opening gallery ----------
  var heroItems = [], heroConf = null, mode = '';
  function hero(home) {
    heroConf = home;
    layoutHero(true);
    addEventListener('resize', function () { layoutHero(false); });
    G.parallax(document.querySelector('.hero'), stage.querySelector('.gcam'));
  }
  function currentMode() { return innerWidth < 700 ? 'mobile' : innerWidth <= 1000 ? 'tablet' : 'desktop'; }
  function layoutHero(first) {
    var m = currentMode();
    if (m !== mode) build(m, first);
    var conf = m === 'mobile' ? heroConf.heroMobile : heroConf.hero;
    var W = stage.clientWidth;
    var u = m === 'desktop' ? Math.min(W / conf.w, stage.clientHeight / conf.h) : W / conf.w;
    stage.style.setProperty('--u', u + 'px');
    stage.style.setProperty('--cw', conf.w);
    stage.style.setProperty('--ch', conf.h);
    stage.style.height = m !== 'desktop' ? Math.ceil(conf.h * u) + 'px' : '';
  }
  function build(m, first) {
    mode = m;
    var conf = m === 'mobile' ? heroConf.heroMobile : heroConf.hero;
    var cam = document.createElement('div'); cam.className = 'gcam';
    var canvas = document.createElement('div'); canvas.className = 'gcanvas';
    var main = document.createElement('div'); main.className = 'gwall';
    var side = document.createElement('div'); side.className = 'gwall gwall--side';
    canvas.append(side, main); cam.appendChild(canvas);
    heroItems = [];
    conf.items.forEach(function (c) {
      if (m === 'tablet' && c.tablet === false) return;
      var p = projects[c.slug];
      if (!p || !finished(c.image)) return;
      var it = piece(p, c.image, c, !!c.lead);
      if (c.lead) it.pos.classList.add('glead');
      (c.wall === 'side' && m !== 'mobile' ? side : main).appendChild(it.pos);
      heroItems.push(it);
    });
    stage.replaceChildren(cam);
    stage.dataset.mode = m;
    if (first) G.enter(heroItems);
  }

  // ---------- featured projects ----------
  var clusters = [];
  function selected(list) {
    if (!works) return;
    list.forEach(function (c, n) {
      var p = projects[c.slug];
      if (p) clusters.push(makeCluster(c, p, n));
    });
    layoutClusters();
    addEventListener('resize', layoutClusters);
    G.reveal(clusters.map(function (k) { return k.el; }));
  }

  function makeCluster(c, p, n) {
    var art = document.createElement('article');
    art.className = 'wk wk--' + (c.side === 'right' ? 'right' : 'left');
    var fig = document.createElement('div');
    fig.className = 'wk-fig';
    var text = document.createElement('div');
    text.className = 'wk-text';
    art.append(fig, text);
    works.appendChild(art);

    var k = { el: art, fig: fig, conf: c, pieces: [] };
    // A small group of finished pictures: one large, one in front of its lower corner, one smaller
    // behind at the top. Drawn back to front.
    var imgs = (c.images || []).filter(finished).slice(0, 3);
    [2, 0, 1].forEach(function (i) {
      if (!imgs[i]) return;
      var it = piece(p, imgs[i], { x: 0, y: 0, w: 0 }, false);
      it.role = i;
      it.pos.classList.add('wk-' + i);
      fig.appendChild(it.pos);
      k.pieces[i] = it;
    });

    var num = document.createElement('span'); num.className = 'wk-n'; num.textContent = String(n + 1).padStart(2, '0');
    var h = document.createElement('h3'); h.className = 'wk-name';
    var a = document.createElement('a'); a.href = href(p.slug); a.appendChild(G.both(G.nameOf(p))); h.appendChild(a);
    var meta = document.createElement('p'); meta.className = 'wk-meta';
    var year = p.year ? { en: String(p.year), zh: String(p.year) } : null;
    meta.appendChild(G.both(G.join([p.type, p.location, year])));
    var serv = document.createElement('p'); serv.className = 'wk-serv';
    serv.appendChild(G.both(G.join([p.services, p.credit])));
    var ctl = document.createElement('div'); ctl.className = 'wk-ctl';
    var go = document.createElement('a');
    go.className = 'wk-go'; go.href = href(p.slug);
    go.innerHTML = '<span lang-en>View project</span><span lang-zh>查看项目</span> →';
    ctl.appendChild(go);
    text.append(num, h, meta, serv, ctl);
    return k;
  }

  function layoutClusters() { clusters.forEach(layoutCluster); }
  // Positions are worked out from the figure width, so the composition keeps its proportions
  // from phone to large monitor. Right-hand groups are mirrored.
  function layoutCluster(k) {
    var fw = k.fig.clientWidth, right = k.conf.side === 'right';
    var pad = fw * 0.03, H = 0;
    function put(it, x, y, w) {
      if (!it) return;
      if (right) x = fw - x - w;
      var s = it.pos.style;
      s.setProperty('--px', x.toFixed(1) + 'px');
      s.setProperty('--py', y.toFixed(1) + 'px');
      s.setProperty('--pw', w.toFixed(1) + 'px');
      it.pos.classList.toggle('glab-r', x + w > fw * 0.75);
      H = Math.max(H, y + w / it.entry.ar);
    }
    var p0 = k.pieces[0], p1 = k.pieces[1], p2 = k.pieces[2];
    var aw = fw * 0.64, ah = aw / p0.entry.ar;
    put(p0, 0, pad, aw);
    // Upper right, smaller, clear of the large picture.
    if (p2) put(p2, fw * 0.69, 0, Math.min(fw * 0.28, (ah * 0.4) * p2.entry.ar));
    // Lower right, overlapping the large picture's corner, in front.
    if (p1) {
      var w1 = Math.min(fw * 0.38, ah * 0.62 * p1.entry.ar);
      put(p1, fw * 0.6, pad + ah * 0.48, w1);
    }
    k.fig.style.height = Math.ceil(H + fw * 0.06) + 'px';
  }
})();
