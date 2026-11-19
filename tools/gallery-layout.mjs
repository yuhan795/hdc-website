// Writes the stored wall layouts for project pages into content/gallery.json.
//
//   node tools/gallery-layout.mjs            add layouts for projects that have none yet
//   node tools/gallery-layout.mjs <slug>     (re)generate one project's layout
//   node tools/gallery-layout.mjs --all      regenerate every project (overwrites hand edits)
//
// The layout comes from HDCGallery.autoLayout() in assets/js/gallery-core.js, which is the
// same deterministic layout the site uses for images that have no stored position. After
// generating, positions can be tuned by hand in content/gallery.json (units: 1000 = wall width).
// The "home" part of gallery.json is written by hand and never touched here.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/gallery-core.js'), 'utf8'), ctx);
const G = ctx.module.exports;

// Image width / height from the file header (JPEG, PNG, WebP).
function size(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89 && b[1] === 0x50) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString('ascii', 0, 4) === 'RIFF') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (kind === 'VP8L') { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
    return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  }
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  throw new Error('Unknown image size: ' + file);
}

const projects = JSON.parse(fs.readFileSync(path.join(root, 'content/projects.json'), 'utf8')).items;
const outFile = path.join(root, 'content/gallery.json');
const out = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};
out.projects = out.projects || {};
const arg = process.argv[2];

for (const p of projects) {
  if (arg && arg !== '--all' && arg !== p.slug) continue;
  if (!arg && out.projects[p.slug]) continue;
  const images = (p.images || []).map((im) => {
    const [w, h] = size(path.join(root, im.image.replace(/^\//, '')));
    return { image: im.image, kind: im.kind, size: im.size, ar: Math.round((w / h) * 10000) / 10000 };
  });
  if (!images.length) continue;
  const lay = G.autoLayout(p.slug, images);
  const ar = Object.fromEntries(images.map((im) => [im.image, im.ar]));
  out.projects[p.slug] = {
    height: lay.height,
    side: lay.side,
    items: lay.items.map((it) => ({ ...it, ar: ar[it.image] }))
  };
  console.log('layout', p.slug, lay.items.length, 'items, height', lay.height);
}
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
