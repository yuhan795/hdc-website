// Local preview server for the HDC website, with the content admin.
// Serves the site with caching off, and accepts saves from admin/ at POST /api/upload and
// /api/save, writing them to disk (commit and push afterwards to publish).
// The admin needs a login; local credentials are read from .dev.vars (never committed).
//
//   node tools/dev-server.mjs        then open http://localhost:5190  (admin: /admin/)
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLogin, clearedCookie, createSession, needsLogin, readSession, sessionCookie } from '../lib/auth.mjs';
import { checkFiles, checkUnchanged, checkUpload } from '../lib/save-rules.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Same KEY=value format Cloudflare's local tools use.
const env = Object.fromEntries((await readFile(join(ROOT, '.dev.vars'), 'utf8').catch(() => ''))
  .split(/\r?\n/).map(line => line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/)).filter(Boolean).map(m => [m[1], m[2]]));
const PORT = Number(process.env.PORT) || Number(process.argv[2]) || 5190;
const MAX_BODY = 60 * 1024 * 1024;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.otf': 'font/otf',
};

function inside(path) {
  const full = normalize(join(ROOT, path));
  return full === ROOT || full.startsWith(ROOT + sep) ? full : null;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Upload too large'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// Like GitHub, an upload is kept under its blob id until PUBLISH names it.
const blobs = new Map();
async function upload(req, res) {
  const problem = checkUpload(new URL(req.url, 'http://x').searchParams.get('path'));
  if (problem) return send(res, 400, { error: problem });
  const data = Buffer.from((await readBody(req)).content, 'base64');
  const sha = createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
  blobs.set(sha, data);
  send(res, 200, { sha });
}

async function save(req, res) {
  const { files } = await readBody(req);
  const problem = checkFiles(files);
  if (problem) return send(res, 400, { error: problem });
  const conflict = await checkUnchanged(files, path => readFile(inside(path), 'utf8').catch(() => null));
  if (conflict) return send(res, 409, { error: conflict });
  if (files.some(file => file.sha && !blobs.has(file.sha))) return send(res, 400, { error: 'An upload went missing (server restarted?). Reload the admin and add the file again' });
  for (const file of files) {
    const full = inside(file.path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, file.sha ? blobs.get(file.sha) : file.content);
  }
  console.log(`saved ${files.map(f => f.path).join(', ')}`);
  send(res, 200, { ok: true, saved: files.length, message: 'Saved on this computer. Commit and push to put it online' });
}

async function serve(req, res) {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  let full = inside(path);
  // Dotfiles (.dev.vars holds the login) and the server code are never served.
  if (!full || path.split('/').some(part => part.startsWith('.')) || /^(lib|tools|functions)\//.test(path)) return send(res, 403, 'Forbidden', 'text/plain');
  try {
    // Like Cloudflare Pages, /admin/login also serves admin/login.html.
    if (!extname(full)) full = await stat(`${full}.html`).then(() => `${full}.html`, () => full);
    if ((await stat(full)).isDirectory()) full = join(full, 'index.html');
    send(res, 200, await readFile(full), TYPES[extname(full).toLowerCase()] ?? 'application/octet-stream');
  } catch {
    send(res, 404, 'Not found', 'text/plain');
  }
}

async function login(req, res) {
  const { username, password } = await readBody(req);
  if (!(await checkLogin(env, username, password))) {
    await new Promise(resolve => setTimeout(resolve, 800)); // slow down password guessing
    return send(res, 401, { error: 'Wrong username or password' });
  }
  res.setHeader('Set-Cookie', sessionCookie(await createSession(env, String(username).trim()), false));
  send(res, 200, { ok: true });
}

createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/api/login' && req.method === 'POST') return await login(req, res);
    if (path === '/api/logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', clearedCookie(false));
      return send(res, 200, { ok: true });
    }
    const session = await readSession(env, req.headers.cookie);
    if (path === '/api/save' || path === '/api/upload') {
      if (!session) return send(res, 401, { error: 'Please log in again' });
      if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
      return await (path === '/api/save' ? save : upload)(req, res);
    }
    if (needsLogin(path) && !session) {
      res.writeHead(302, { Location: '/admin/login', 'Cache-Control': 'no-store' });
      return res.end();
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');
    await serve(req, res);
  } catch (error) {
    send(res, error.status ?? 500, { error: error.message });
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`HDC: http://localhost:${PORT}   admin: http://localhost:${PORT}/admin/`);
});
