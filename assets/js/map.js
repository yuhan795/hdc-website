// Projects map: MapLibre with OpenFreeMap vector tiles, loaded when the section scrolls near.
(function () {
  var MAPLIBRE = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl';
  var TILES = 'https://tiles.openfreemap.org/planet';
  var GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

  var PALETTES = {
    light: { land: '#F7F7F7', water: '#DCDCDC', park: '#EDEDED', road: '#E6E6E6', major: '#D6D6D6', building: '#ECECEC', label: '#8C8C8C', halo: '#F7F7F7' },
    dark:  { land: '#1D1D1D', water: '#121212', park: '#232323', road: '#2C2C2C', major: '#383838', building: '#2A2A2A', label: '#777777', halo: '#1D1D1D' }
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
      { id: 'buildings', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 13,
        paint: { 'fill-extrusion-color': p.building, 'fill-extrusion-height': ['get', 'render_height'], 'fill-extrusion-base': ['get', 'render_min_height'], 'fill-extrusion-opacity': 0.9 } }
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
    return { version: 8, glyphs: GLYPHS, sources: { omt: { type: 'vector', url: TILES } }, layers: layers };
  }

  function addMarker(map, p) {
    var el = document.createElement('button');
    el.className = 'pdot';
    el.type = 'button';
    el.setAttribute('aria-label', p.address + ', ' + p.type.en);
    el.innerHTML = '<span class="ptip"><span class="ptip-a"></span><span class="ptip-t"><span lang-en=""></span><span lang-zh=""></span></span></span>';
    el.querySelector('.ptip-a').textContent = p.address;
    el.querySelector('[lang-en]').textContent = p.type.en;
    el.querySelector('[lang-zh]').textContent = p.type.zh;
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
    // Touch screens have no hover: tap toggles the label
    el.addEventListener('click', function (e) {
      place();
      e.stopPropagation();
      var on = !el.classList.contains('on');
      document.querySelectorAll('.pdot.on').forEach(function (d) { d.classList.remove('on'); });
      el.classList.toggle('on', on);
    });
    new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
  }

  function init() {
    var projects = window.HDC_PROJECTS || [];
    var main = projects.filter(function (p) { return !p.inset; });
    var far = projects.filter(function (p) { return p.inset; });

    var bounds = new maplibregl.LngLatBounds();
    main.forEach(function (p) { bounds.extend([p.lng, p.lat]); });

    // Frame the projects flat, then tilt for a light 3D feel
    var narrow = document.getElementById('map').clientWidth < 700;
    var map = new maplibregl.Map({
      container: 'map', style: makeStyle(false), bounds: bounds,
      fitBoundsOptions: { padding: narrow ? { top: 60, bottom: 150, left: 30, right: 30 } : { top: 90, bottom: 90, left: 90, right: 90 } },
      maxPitch: 60, cooperativeGestures: true, attributionControl: false
    });
    map.setPitch(35);
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    main.forEach(function (p) { addMarker(map, p); });

    var inset = null;
    if (far.length) {
      // Show the far projects together with NYC for scale
      var ib = new maplibregl.LngLatBounds([-73.98, 40.75], [-73.98, 40.75]);
      far.forEach(function (p) { ib.extend([p.lng, p.lat]); });
      inset = new maplibregl.Map({
        container: 'map-inset', style: makeStyle(true), bounds: ib,
        fitBoundsOptions: { padding: { top: 34, bottom: 22, left: 26, right: 26 } },
        interactive: false, attributionControl: false
      });
      var nyc = document.createElement('span');
      nyc.className = 'pnyc';
      nyc.textContent = 'NYC';
      new maplibregl.Marker({ element: nyc, anchor: 'left', offset: [-4, 0] }).setLngLat([-73.98, 40.75]).addTo(inset);
      far.forEach(function (p) { addMarker(inset, p); });
    }

    document.addEventListener('click', function () {
      document.querySelectorAll('.pdot.on').forEach(function (d) { d.classList.remove('on'); });
    });

    // Follow the site's theme and language toggles
    new MutationObserver(function () {
      map.setStyle(makeStyle(false));
      if (inset) inset.setStyle(makeStyle(true));
    }).observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'data-lang'] });
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
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); load(); }
    }, { rootMargin: '600px' });
    io.observe(section);
  } else {
    load();
  }
})();
