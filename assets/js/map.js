// Projects map: MapLibre with OpenFreeMap vector tiles, loaded when the section scrolls near.
// A flat plan of the New York region sits beside the project list, showing every project.
// Resting the mouse on a project zooms the plan in to it; leaving the list zooms back out.
(function () {
  var MAPLIBRE = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl';
  var TILES = 'https://tiles.openfreemap.org/planet';
  var GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

  var PALETTES = {
    light: { land: '#F8F6F2', water: '#DDDAD3', park: '#EEEBE4', road: '#E7E4DD', major: '#D7D3CB', building: '#EAE7E1', label: '#8D8A84', halo: '#F8F6F2' },
    dark:  { land: '#1E1D1B', water: '#131211', park: '#242320', road: '#2D2B28', major: '#393733', building: '#2B2927', label: '#7A7771', halo: '#1E1D1B' }
  };

  function theme() { return document.body.dataset.theme === 'dark' ? 'dark' : 'light'; }
  function lang() { return document.body.dataset.lang === 'zh' ? 'zh' : 'en'; }

  function nameField() {
    return lang() === 'zh' ? ['coalesce', ['get', 'name:zh'], ['get', 'name:en'], ['get', 'name']] : ['coalesce', ['get', 'name:en'], ['get', 'name']];
  }

  function makeStyle(inset) {
    var p = PALETTES[theme()];
    var label = { 'text-color': p.label, 'text-halo-color': p.halo, 'text-halo-width': 1.2 };
    var layers = [
      { id: 'land', type: 'background', paint: { 'background-color': p.land } },
      { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': p.park } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': p.water } },
      { id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['==', ['get', 'admin_level'], 4], paint: { 'line-color': p.major, 'line-width': 1 } },
      { id: 'roads-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12,
        filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary']]],
        paint: { 'line-color': p.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 4] } },
      { id: 'roads-major', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
        paint: { 'line-color': p.major, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 11, 1, 16, 6] } },
      // Building footprints, flat (plan view)
      { id: 'buildings', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14,
        paint: { 'fill-color': p.building, 'fill-outline-color': p.major } }
    ];
    if (!inset) {
      var text = { 'text-field': nameField(), 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-letter-spacing': 0.25, 'text-transform': 'uppercase' };
      layers.push(
        { id: 'water-label-line', type: 'symbol', source: 'omt', 'source-layer': 'water_name',
          filter: ['==', ['geometry-type'], 'LineString'],
          layout: Object.assign({ 'symbol-placement': 'line' }, text), paint: label },
        { id: 'water-label-point', type: 'symbol', source: 'omt', 'source-layer': 'water_name',
          filter: ['==', ['geometry-type'], 'Point'], layout: text, paint: label },
        { id: 'place-label', type: 'symbol', source: 'omt', 'source-layer': 'place',
          filter: ['all', ['!=', ['get', 'class'], 'island'], ['in', ['get', 'name:en'], ['literal', ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Roslyn', 'Astoria', 'Long Island City']]]],
          layout: text, paint: label }
      );
    }
    // One light from the upper left, so each face of a building reads as a separate plane.
    return { version: 8, glyphs: GLYPHS, sources: { omt: { type: 'vector', url: TILES } }, layers: layers };
  }

  var canHover = window.matchMedia('(hover: hover)').matches;

  function addMarker(map, p) {
    var el = document.createElement('a');
    el.className = 'pdot';
    el.href = 'project.html?p=' + p.slug;
    el.dataset.slug = p.slug;
    el.setAttribute('aria-label', p.address + ', ' + p.type.en);
    el.innerHTML = '<span class="ptip"><span class="ptip-a"><span lang-en=""></span><span lang-zh=""></span></span><span class="ptip-t"><span lang-en=""></span><span lang-zh=""></span></span><span class="ptip-go"><span lang-en="">View project</span><span lang-zh="">查看项目</span> →</span></span>';
    el.querySelectorAll('.ptip-a span')[0].textContent = p.address;
    el.querySelectorAll('.ptip-a span')[1].textContent = p.address_zh || p.address;
    el.querySelector('.ptip-t [lang-en]').textContent = p.type.en;
    el.querySelector('.ptip-t [lang-zh]').textContent = p.type.zh;
    // Keep the label inside the map when the dot is near an edge
    function place() {
      var box = el.closest('.pmap').getBoundingClientRect(), r = el.getBoundingClientRect();
      var x = r.left - box.left, y = r.top - box.top;
      el.classList.toggle('tip-l', x < 140);
      el.classList.toggle('tip-r', x > box.width - 140);
      el.classList.toggle('tip-b', y < 80);
    }
    el.addEventListener('mouseenter', place);
    el.addEventListener('focus', place);
    // Touch screens have no hover: the first tap shows the label and zooms in there,
    // a second tap opens the project
    el.addEventListener('click', function (e) {
      if (canHover || el.classList.contains('on')) return;
      e.preventDefault();
      place();
      e.stopPropagation();
      document.querySelectorAll('.pdot.on').forEach(function (d) { d.classList.remove('on'); });
      el.classList.add('on');
      flyTo(p);
    });
    new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
  }

  var map = null, home = null, back = 0;

  function init() {
    var projects = (window.HDC_PROJECTS || []).filter(function (p) { return p.lat != null; });
    var box = document.getElementById('map').parentNode;

    // Home view: a flat plan with every project on it.
    var bounds = new maplibregl.LngLatBounds();
    projects.forEach(function (p) { bounds.extend([p.lng, p.lat]); });
    map = new maplibregl.Map({
      container: 'map', style: makeStyle(false), bounds: bounds, fitBoundsOptions: { padding: 60 },
      pitchWithRotate: false, dragRotate: false, cooperativeGestures: true, attributionControl: false
    });
    map.touchZoomRotate.disableRotation();
    home = { center: map.getCenter().toArray(), zoom: map.getZoom() };
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    projects.forEach(function (p) { addMarker(map, p); });

    // A count in the corner of the overview.
    var count = document.createElement('span');
    count.className = 'pcount lbl';
    count.innerHTML = '<span lang-en="">' + projects.length + ' projects · New York region</span><span lang-zh="">' + projects.length + ' 个项目 · 纽约地区</span>';
    box.appendChild(count);
    map.on('zoom', function () { box.classList.toggle('zoomed-in', map.getZoom() > home.zoom + 1); });

    // Tapping anywhere else closes the label (and on touch screens, zooms back out).
    document.addEventListener('click', function () {
      var open = document.querySelector('.pdot.on');
      document.querySelectorAll('.pdot.on').forEach(function (d) { d.classList.remove('on'); });
      if (open && !canHover) flyHome();
    });

    // Follow the site's theme and language toggles
    new MutationObserver(function () {
      map.setStyle(makeStyle(false));
    }).observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'data-lang'] });
  }

  // Resting on a project zooms the plan in to it from the wider view; leaving the list zooms out.
  function flyTo(p) {
    if (!map || p.lat == null) return;
    clearTimeout(back);
    map.flyTo({ center: [p.lng, p.lat], zoom: p.inset ? 14.5 : 16, speed: 0.8, curve: 1.5, essential: true });
  }
  function flyHome() {
    if (!map || !home) return;
    clearTimeout(back);
    back = setTimeout(function () { map.flyTo(Object.assign({ speed: 0.9, curve: 1.5, essential: true }, home)); }, 350);
  }

  function load() {
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = MAPLIBRE + '.css';
    document.head.appendChild(css);
    var s = document.createElement('script');
    s.src = MAPLIBRE + '.js';
    s.onload = init;
    document.head.appendChild(s);
  }

  var section = document.getElementById('projects');
  if (!section) return;

  // Projects come from content/projects.json, which the admin edits.
  fetch('content/projects.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (data) {
    window.HDC_PROJECTS = data.items || [];
    buildList();
    watch();
  }).catch(console.error);

  // Project list under the map; hovering a row lights up its dot
  function buildList() {
    var list = document.getElementById('plist');
    window.HDC_PROJECTS.forEach(function (p, i) {
      var row = document.createElement('a');
      row.className = 'prow';
      row.href = 'project.html?p=' + p.slug;
      row.innerHTML = '<span class="prow-n"></span><span class="prow-a"><span lang-en=""></span><span lang-zh=""></span></span>' +
        '<span class="prow-t"><span lang-en=""></span><span lang-zh=""></span></span>' +
        '<span class="prow-l"><span lang-en=""></span><span lang-zh=""></span></span>' +
        '<span class="prow-go">→</span>';
      row.querySelector('.prow-n').textContent = String(i + 1).padStart(2, '0');
      row.querySelectorAll('.prow-a span')[0].textContent = p.address;
      row.querySelectorAll('.prow-a span')[1].textContent = p.address_zh || p.address;
      // The list's middle column shows the services (Interior, Architecture, …).
      var svc = p.services || p.type || {};
      row.querySelectorAll('.prow-t span')[0].textContent = svc.en || '';
      row.querySelectorAll('.prow-t span')[1].textContent = svc.zh || svc.en || '';
      row.querySelectorAll('.prow-l span')[0].textContent = p.location.en;
      row.querySelectorAll('.prow-l span')[1].textContent = p.location.zh;
      function dot(on) {
        var d = document.querySelector('.pdot[data-slug="' + p.slug + '"]');
        if (d) d.classList.toggle('lit', on);
      }
      // Dive once the mouse rests on a row for a moment (not while sweeping past rows).
      var rest = 0;
      row.addEventListener('mouseenter', function () { dot(true); if (canHover) { clearTimeout(rest); rest = setTimeout(function () { flyTo(p); }, 260); } });
      row.addEventListener('mouseleave', function () { dot(false); clearTimeout(rest); });
      list.appendChild(row);
    });
    if (canHover) list.addEventListener('mouseleave', flyHome);
  }

  function watch() {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { io.disconnect(); load(); }
      }, { rootMargin: '600px' });
      io.observe(section);
    } else {
      load();
    }
  }
})();
