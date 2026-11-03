// Project page: project.html?p=<slug> fills itself from HDC_PROJECTS (projects.js).
(function () {
  var projects = window.HDC_PROJECTS || [];
  var slug = new URLSearchParams(location.search).get('p');
  var i = projects.findIndex(function (p) { return p.slug === slug; });
  if (i < 0) { location.replace('index.html#projects'); return; }
  var p = projects[i];

  // Text in both languages; CSS shows the active one
  function both(v) {
    var s = document.createElement('span');
    var en = document.createElement('span'), zh = document.createElement('span');
    en.setAttribute('lang-en', ''); zh.setAttribute('lang-zh', '');
    en.textContent = v.en; zh.textContent = v.zh;
    s.append(en, zh);
    return s;
  }

  document.title = p.address + ' — HANZ Design Collective';
  document.getElementById('ptitle').textContent = p.address;
  document.getElementById('pintro').appendChild(both(p.intro));

  var meta = document.getElementById('pmeta');
  [[{ en: 'Location', zh: '地点' }, p.location],
   [{ en: 'Type', zh: '类型' }, p.type],
   [{ en: 'Services', zh: '服务' }, p.services],
   [{ en: 'Year', zh: '年份' }, p.year && { en: String(p.year), zh: String(p.year) }]
  ].forEach(function (r) {
    if (!r[1]) return;
    var dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.appendChild(both(r[0])); dd.appendChild(both(r[1]));
    meta.append(dt, dd);
  });

  // Gallery: landscape images run full width, portrait ones pair up side by side
  var gal = document.getElementById('pgal');
  if (!p.images.length) {
    var empty = document.createElement('div');
    empty.className = 'pempty lbl';
    empty.appendChild(both({ en: 'Images coming soon', zh: '图片即将更新' }));
    gal.appendChild(empty);
  }
  var figs = p.images.map(function (im, n) {
    var fig = document.createElement('figure');
    fig.className = 'pfig';
    var img = document.createElement('img');
    img.src = 'assets/projects/' + p.slug + '/' + String(n + 1).padStart(2, '0') + '.jpg';
    img.alt = p.address + ' — ' + im.caption.en;
    var cap = document.createElement('figcaption');
    var kind = document.createElement('b');
    kind.appendChild(both(im.kind));
    cap.append(kind, both(im.caption));
    fig.append(img, cap);
    gal.appendChild(fig);
    return new Promise(function (done) {
      function size() { done({ fig: fig, tall: img.naturalHeight > img.naturalWidth }); }
      img.complete ? size() : (img.onload = img.onerror = size);
    });
  });
  Promise.all(figs).then(function (list) {
    for (var k = 0; k < list.length; k++) {
      if (list[k].tall && list[k + 1] && list[k + 1].tall) { k++; continue; }
      if (!list[k].tall) list[k].fig.classList.add('wide');
    }
  });

  // Previous / next project
  var nav = document.getElementById('pnext');
  [[projects[(i - 1 + projects.length) % projects.length], { en: '← Previous', zh: '← 上一个' }],
   [projects[(i + 1) % projects.length], { en: 'Next →', zh: '下一个 →' }]
  ].forEach(function (r) {
    var a = document.createElement('a');
    a.href = 'project.html?p=' + r[0].slug;
    var l = document.createElement('span'); l.className = 'lbl'; l.appendChild(both(r[1]));
    var t = document.createElement('span'); t.className = 'pn-a'; t.textContent = r[0].address;
    a.append(l, t);
    nav.appendChild(a);
  });
})();
