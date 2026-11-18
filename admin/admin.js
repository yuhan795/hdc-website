// Content editor: edits content/projects.json and uploads images, then saves everything
// in one request to /api/save (the local dev server, or a GitHub-committing function online).
// Adapted from the BAD STUDIO admin.
const FILE = 'content/projects.json';
const UPLOAD_DIR = 'assets/uploads';
const MAX_SIDE = 2000;             // longest side of an uploaded image, like the site's own images
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const KINDS = [
  ['render', 'Rendering · 效果图'], ['drawing', 'Drawing · 图纸'], ['board', 'Material selection · 材料选样'],
  ['site', 'Existing condition · 现场'], ['built', 'Completed · 完成实景'], ['photo', 'Photo · 照片'],
];

const state = { content: null, saved: '', uploads: new Map(), project: null, busy: false };
// New projects keep their page address in step with the address until they are published.
const unpublished = new WeakSet();

const $ = selector => document.querySelector(selector);
const grid = $('.grid'), panel = $('.panel'), fileInput = $('.file-input');
const publishButton = $('.publish'), discardButton = $('.discard'), status = $('.status');
const projectView = $('.project-view'), previewFrame = $('.preview-frame iframe');

const items = () => state.content.items;
const isDirty = () => JSON.stringify(state.content) !== state.saved;
const preview = path => state.uploads.get(path)?.url ?? `../${path}`;
const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'project';

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

async function load() {
  // Online, the admin page itself is public: without a valid login it goes to the login page.
  if ((await fetch('/api/me', { cache: 'no-store' })).status === 401) {
    location.replace('login.html');
    return new Promise(() => {});
  }
  const response = await fetch(`../${FILE}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${FILE}`);
  state.content = await response.json();
  state.content.items ??= [];
  state.saved = JSON.stringify(state.content);
}

// ---------- images ----------
// Uploads are scaled to at most 2000 px and stored as WebP.
async function prepareImage(file, project) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image`);
  if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name} is larger than 25 MB`);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = el('canvas', { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .86));
  let ext = 'webp';
  if (blob?.type !== 'image/webp') { blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86)); ext = 'jpg'; }
  const path = `${UPLOAD_DIR}/${slug(project.slug)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.${ext}`;
  state.uploads.set(path, { blob, url: URL.createObjectURL(blob), published: false });
  return path;
}

function pickFiles() {
  return new Promise(resolve => {
    fileInput.value = '';
    fileInput.onchange = () => resolve([...fileInput.files]);
    fileInput.click();
  });
}

// ---------- project list ----------
function render() {
  $('.headline-count').textContent = `${items().length}`;
  grid.querySelectorAll('.card:not(.card-add)').forEach(card => card.remove());
  items().forEach((p, i) => grid.append(renderCard(p, i)));
  updateStatus();
}

function renderCard(p, i) {
  const cover = p.images?.[0]?.image;
  const isNew = unpublished.has(p) || (p.images ?? []).some(entry => state.uploads.get(entry.image)?.published === false);
  const flags = [isNew && '<span class="is-new">UNPUBLISHED</span>', p.type?.en, `${p.images?.length ?? 0} images`].filter(Boolean).join(' · ');
  const card = el('button', { type: 'button', className: 'card' },
    cover ? el('img', { className: 'card-img', src: preview(cover), alt: '', loading: 'lazy' }) : el('span', { className: 'card-img' }),
    el('span', { className: 'card-caption' },
      el('span', { className: 'card-n', textContent: String(i + 1).padStart(2, '0') }),
      el('span', { className: 'card-title', textContent: p.address || 'Untitled' }),
      el('span', { className: 'card-flags', innerHTML: flags })));
  card.addEventListener('click', () => openProject(p));
  return card;
}

function setStatus(text, error = false) {
  status.textContent = text;
  status.classList.toggle('is-error', error);
}
function updateStatus() {
  const dirty = isDirty();
  publishButton.disabled = !dirty || state.busy;
  discardButton.hidden = !dirty;
  if (!state.busy) setStatus(dirty ? 'Unpublished changes' : '');
}

$('.card-add').addEventListener('click', () => {
  const taken = new Set(items().map(p => p.slug));
  let s = 'new-project', n = 2;
  while (taken.has(s)) s = `new-project-${n++}`;
  const p = { slug: s, address: '', type: { en: '', zh: '' }, location: { en: '', zh: '' }, services: { en: '', zh: '' }, images: [] };
  unpublished.add(p);
  items().push(p);
  openProject(p);
});

// ---------- one project ----------
let previewReady = false, previewQueued = false;
const showHash = p => history.replaceState(null, '', p ? `#project/${p.slug}` : location.pathname);

function openProject(p) {
  state.project = p;
  document.body.classList.add('is-project');
  projectView.hidden = false;
  $('.page').hidden = true;
  // Loaded only now, so its "ready" message can't arrive before this script listens.
  if (!previewFrame.getAttribute('src')) previewFrame.src = '../project.html?preview';
  renderPanel(p);
  showHash(p);
}

function closeProject() {
  const p = state.project;
  // A new project left without an address is dropped rather than published empty.
  if (p && unpublished.has(p) && !p.address.trim() && !p.images.length) items().splice(items().indexOf(p), 1);
  state.project = null;
  document.body.classList.remove('is-project');
  projectView.hidden = true;
  $('.page').hidden = false;
  showHash(null);
  render();
}

// Sends the project being edited to the preview, once per batch of changes. New uploads
// are shown from their in-browser copies.
function sendPreview() {
  if (previewQueued) return;
  previewQueued = true;
  queueMicrotask(() => {
    previewQueued = false;
    const p = state.project;
    if (!p || !previewReady) return;
    const live = entry => ({ ...entry, image: state.uploads.get(entry.image)?.url ?? `../${entry.image}` });
    const draft = { ...p, images: p.images.map(live) };
    previewFrame.contentWindow.postMessage({ type: 'hdc-preview', project: draft, all: items().map(q => q === p ? draft : q) }, location.origin);
  });
}
addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== previewFrame.contentWindow || event.data?.type !== 'hdc-preview-ready') return;
  previewReady = true;
  sendPreview();
});

function changed() {
  $('.preview-title').textContent = state.project.address || 'Untitled';
  updateStatus();
  sendPreview();
}

// Typing only updates the data, so the cursor stays put.
function input(value, onInput, attrs = {}) {
  const node = el('input', { className: 'input', value: value ?? '', ...attrs });
  node.addEventListener('input', () => { onInput(node.value); changed(); });
  return node;
}
const label = (text, hint) => el('span', { className: 'label' }, text, hint ? el('em', {}, hint) : '');
function pair(obj, key, placeholderEn, placeholderZh) {
  obj[key] ??= { en: '', zh: '' };
  return el('div', { className: 'pair' },
    input(obj[key].en, v => { obj[key].en = v; }, { placeholder: placeholderEn }),
    input(obj[key].zh, v => { obj[key].zh = v; }, { placeholder: placeholderZh }));
}

function renderPanel(p) {
  const scroll = panel.parentElement.scrollTop;
  panel.replaceChildren();
  $('.preview-title').textContent = p.address || 'Untitled';
  const pageLink = el('em', { textContent: `hanzdesigncollective.com/project.html?p=${p.slug}` });

  panel.append(el('div', { className: 'panel-head' }, label('PROJECT PAGE', ''),
    unpublished.has(p) ? '' : el('a', { href: `../project.html?p=${p.slug}`, target: '_blank', rel: 'noopener', textContent: 'OPEN ↗', title: 'Shows the published version' })));
  panel.lastChild.firstChild.append(pageLink);

  // The Chinese name is optional; without it the English name shows in 中文 mode too.
  panel.append(el('div', { className: 'field' }, label('NAME', 'English · 中文. The big title on the page, in the list and on the map'),
    el('div', { className: 'pair' },
      input(p.address, v => {
        p.address = v;
        if (unpublished.has(p)) {
          const taken = new Set(items().filter(q => q !== p).map(q => q.slug));
          let s = slug(v), n = 2;
          while (taken.has(s)) s = `${slug(v)}-${n++}`;
          p.slug = s;
          pageLink.textContent = `hanzdesigncollective.com/project.html?p=${p.slug}`;
          showHash(p);
        }
      }, { maxLength: 80, placeholder: 'Project name' }),
      input(p.address_zh ?? '', v => { if (v.trim()) p.address_zh = v; else delete p.address_zh; }, { maxLength: 40, placeholder: '项目名称' }))));
  panel.append(
    el('div', { className: 'field' }, label('TYPE', 'English · 中文'), pair(p, 'type', 'Condo Renovation', '公寓翻新')),
    el('div', { className: 'field' }, label('LOCATION'), pair(p, 'location', 'Upper West Side, Manhattan', '曼哈顿上西区')),
    el('div', { className: 'field' }, label('SERVICES'), pair(p, 'services', 'Interior design', '室内设计')),
    el('label', { className: 'field' }, label('YEAR', 'Leave empty to hide'),
      input(p.year ?? '', v => { if (/^\d{4}$/.test(v.trim())) p.year = Number(v); else delete p.year; }, { inputMode: 'numeric', maxLength: 4, placeholder: '2026' })));

  // Optional credits: empty fields are left out of the page.
  const optional = (key, en, zh) => {
    const value = { en: p[key]?.en ?? '', zh: p[key]?.zh ?? '' };
    const set = () => { if (value.en.trim() || value.zh.trim()) p[key] = { ...value }; else delete p[key]; };
    return el('div', { className: 'pair' },
      input(value.en, v => { value.en = v; set(); }, { placeholder: en }),
      input(value.zh, v => { value.zh = v; set(); }, { placeholder: zh }));
  };
  panel.append(
    el('div', { className: 'field' }, label('CREDIT', 'Optional. For example a collaborator, or work done at a previous firm'), optional('credit', 'In collaboration with …', '与 … 合作')),
    el('div', { className: 'field' }, label('AWARD', 'Optional'), optional('award', 'AIANYS 2023 Design Awards Winner', '2023 年 AIANYS 设计奖')),
    el('label', { className: 'field' }, label('PHOTOGRAPHY', 'Optional. Photographer name(s)'),
      input(p.photos ?? '', v => { if (v.trim()) p.photos = v; else delete p.photos; }, { maxLength: 80 })));

  // Map position: latitude / longitude, found from the address or typed. Empty = not on the map.
  const lat = input(p.lat ?? '', v => setCoord('lat', v), { placeholder: 'Latitude' });
  const lng = input(p.lng ?? '', v => setCoord('lng', v), { placeholder: 'Longitude' });
  function setCoord(key, v) { const n = parseFloat(v); if (Number.isFinite(n)) p[key] = n; else delete p[key]; }
  const find = el('button', { type: 'button', className: 'button button-small button-quiet', textContent: 'FIND FROM ADDRESS' });
  find.addEventListener('click', async () => {
    if (!p.address.trim()) return setStatus('Type the name first', true);
    setStatus('Looking up the address…');
    try {
      const q = /,/.test(p.address) ? p.address : `${p.address}, New York`;
      const [hit] = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`)).json();
      if (!hit) return setStatus('Address not found. Type the coordinates instead', true);
      p.lat = Math.round(hit.lat * 1e5) / 1e5; p.lng = Math.round(hit.lon * 1e5) / 1e5;
      lat.value = p.lat; lng.value = p.lng;
      changed();
    } catch {
      setStatus('Could not reach the map service', true);
    }
  });
  const inset = el('input', { type: 'checkbox', checked: !!p.inset });
  inset.addEventListener('change', () => { if (inset.checked) p.inset = true; else delete p.inset; changed(); });
  panel.append(el('div', { className: 'field' }, label('MAP', 'Leave both empty to keep the project off the map (it still shows in the list). FIND FROM ADDRESS searches the English name, so it only works when the name is a street address'),
    el('div', { className: 'pair' }, lat, lng),
    el('div', { className: 'row' }, find, el('label', { className: 'check' }, inset, 'Show on the “Beyond NYC” mini map'))));

  // Images: the first one is the cover in the admin list; visitors get them in random places.
  const list = el('div', { className: 'images' });
  p.images.forEach((entry, index) => {
    entry.caption ??= { en: '', zh: '' };
    const kind = el('select', { title: 'What the image shows' },
      ...KINDS.map(([value, text]) => el('option', { value, textContent: text, selected: entry.kind === value })));
    kind.addEventListener('change', () => { entry.kind = kind.value; changed(); });
    const move = (text, title, to) => {
      const b = el('button', { type: 'button', className: 'icon-button', textContent: text, title });
      b.addEventListener('click', () => {
        if (to < 0 || to >= p.images.length) return;
        p.images.splice(to, 0, p.images.splice(index, 1)[0]);
        renderPanel(p); changed();
      });
      return b;
    };
    const remove = el('button', { type: 'button', className: 'icon-button danger', textContent: '×', title: 'Remove this image' });
    remove.addEventListener('click', () => { p.images.splice(index, 1); renderPanel(p); changed(); });
    list.append(el('div', { className: 'image-row' },
      el('img', { src: preview(entry.image), alt: '' }),
      el('div', { className: 'row' }, kind, index === 0 ? el('span', { className: 'cover-tag', textContent: 'COVER' }) : ''),
      el('div', { className: 'image-tools' }, move('↑', 'Earlier', index - 1), move('↓', 'Later', index + 1), remove),
      pair(entry, 'caption', 'Caption', '图注')));
  });
  const add = el('button', { type: 'button', className: 'button button-small', textContent: '+ ADD IMAGES' });
  add.addEventListener('click', async () => addImages(await pickFiles()));
  panel.append(el('div', { className: 'field' }, label(`IMAGES (${p.images.length})`, 'JPG, PNG or WebP, or drop them anywhere here. Each becomes a floating card on the page; the first is the cover here in the admin'),
    list, el('div', { className: 'row' }, add)));

  // Order in the list and on the map, and removal.
  const shift = (text, by) => {
    const b = el('button', { type: 'button', className: 'button button-small button-quiet', textContent: text });
    b.addEventListener('click', () => {
      const i = items().indexOf(p), to = i + by;
      if (to < 0 || to >= items().length) return;
      items().splice(to, 0, items().splice(i, 1)[0]);
      setStatus(`Now number ${to + 1} of ${items().length}`);
      updateStatus(); sendPreview();
    });
    return b;
  };
  const del = el('button', { type: 'button', className: 'button button-small button-danger', textContent: 'DELETE PROJECT' });
  del.addEventListener('click', () => {
    if (!confirm(`Delete “${p.address || 'this project'}”? It disappears from the site when you publish.`)) return;
    items().splice(items().indexOf(p), 1);
    state.project = null;
    closeProject();
  });
  panel.append(el('div', { className: 'panel-foot' }, shift('← EARLIER IN LIST', -1), shift('LATER IN LIST →', 1), del));
  panel.parentElement.scrollTop = scroll;
  sendPreview();
}

async function addImages(files) {
  const p = state.project;
  files = files.filter(file => file.type.startsWith('image/'));
  if (!p || !files.length) return;
  setStatus(`Preparing ${files.length} image${files.length > 1 ? 's' : ''}…`);
  for (const file of files) {
    try {
      const image = await prepareImage(file, p);
      p.images.push({ image, kind: 'render', caption: { en: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), zh: '' } });
    } catch (error) {
      setStatus(error.message, true);
    }
  }
  renderPanel(p);
  changed();
}

$('.project-back').addEventListener('click', closeProject);
document.querySelectorAll('.preview-sizes button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.preview-sizes button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  previewFrame.style.width = button.dataset.width ? `${button.dataset.width}px` : '';
}));

// ---------- publishing ----------
const toBase64 = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

async function post(url, body, failure) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const result = await response.json().catch(() => ({}));
  // Logged out mid-edit: keep the drafts here and log in again in a new tab.
  if (response.status === 401) {
    window.open('login.html', '_blank');
    throw new Error('Logged out. Log in again in the new tab, then press PUBLISH');
  }
  if (!response.ok) throw new Error(result.error || `${failure} (${response.status})`);
  return result;
}

async function publish() {
  const missing = items().find(p => !p.address.trim());
  if (missing) return setStatus('Every project needs a name before publishing', true);
  const referenced = new Set(items().flatMap(p => p.images.map(entry => entry.image)));
  // base: the content as loaded, so the server can refuse to overwrite newer changes.
  const files = [{ path: FILE, encoding: 'utf8', content: `${JSON.stringify(state.content, null, 2)}\n`, base: state.saved }];
  state.busy = true;
  updateStatus();
  try {
    // Each new image goes in its own request first; the publish request then names it by
    // the id the upload returned. One already uploaded by a failed publish isn't sent again.
    const pending = [...state.uploads].filter(([path, upload]) => !upload.published && referenced.has(path));
    for (const [index, [path, upload]] of pending.entries()) {
      if (!upload.sha) {
        setStatus(`Uploading ${index + 1} of ${pending.length}…`);
        const body = `{"encoding":"base64","content":"${await toBase64(upload.blob)}"}`;
        upload.sha = (await post(`/api/upload?path=${encodeURIComponent(path)}`, body, 'Upload failed')).sha;
      }
      files.unshift({ path, sha: upload.sha });
    }
    setStatus('Publishing…');
    const result = await post('/api/save', JSON.stringify({ files, message: 'Update projects' }), 'Publish failed');
    for (const path of referenced) if (state.uploads.has(path)) state.uploads.get(path).published = true;
    items().forEach(p => unpublished.delete(p));
    state.saved = JSON.stringify(state.content);
    state.busy = false;
    if (state.project) renderPanel(state.project); else render();
    updateStatus();
    setStatus(result.message || 'Published');
  } catch (error) {
    state.busy = false;
    updateStatus();
    setStatus(error.message, true);
  }
}

function discard() {
  if (!confirm('Discard all unpublished changes?')) return;
  if (state.project) { state.project = null; closeProject(); }
  state.content = JSON.parse(state.saved);
  render();
}

// ---------- wiring ----------
publishButton.addEventListener('click', publish);
discardButton.addEventListener('click', discard);
$('.logout').addEventListener('click', async () => {
  if (isDirty() && !confirm('You have unpublished changes. Log out and lose them?')) return;
  await fetch('/api/logout', { method: 'POST' });
  state.saved = JSON.stringify(state.content);
  location.replace('login.html');
});
window.addEventListener('beforeunload', event => { if (isDirty()) event.preventDefault(); });

let dragDepth = 0;
const hasFiles = event => [...(event.dataTransfer?.types ?? [])].includes('Files');
window.addEventListener('dragenter', event => {
  if (!hasFiles(event) || !state.project) return;
  dragDepth++;
  document.body.classList.add('is-dragging');
});
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) document.body.classList.remove('is-dragging');
});
window.addEventListener('dragover', event => { if (hasFiles(event)) event.preventDefault(); });
window.addEventListener('drop', event => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('is-dragging');
  if (state.project) addImages([...event.dataTransfer.files]);
  else setStatus('Open a project first, then drop its images', true);
});

load().then(() => {
  render();
  const s = location.hash.match(/^#project\/(.+)$/)?.[1];
  const p = s && items().find(q => q.slug === decodeURIComponent(s));
  if (p) openProject(p); else showHash(null);
}).catch(error => setStatus(error.message, true));
