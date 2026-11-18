// Username/password login for the content admin, using signed session cookies.
// Uses only Web Crypto, so the same code runs in the local Node server and on Cloudflare.
// Needs three settings (secrets): ADMIN_USER, ADMIN_PASSWORD, SESSION_SECRET.
const encoder = new TextEncoder();
const COOKIE = 'hdc_session';
const MAX_AGE = 60 * 60 * 24 * 7; // stay logged in for a week

// Login page and its assets must load without a session. Cloudflare serves
// login.html as /admin/login, so both spellings are public.
const PUBLIC_ADMIN = new Set(['/admin/login', '/admin/login.html', '/admin/login.js', '/admin/admin.css']);
export const needsLogin = rawPath => {
  const path = rawPath.toLowerCase();
  return (path === '/admin' || path.startsWith('/admin/')) && !PUBLIC_ADMIN.has(path);
};

const toBase64Url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function sign(secret, text) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(text)));
}

// Comparing HMACs instead of raw strings avoids leaking the secret through timing.
async function same(secret, a, b) {
  const [x, y] = await Promise.all([sign(secret, a), sign(secret, b)]);
  return x === y;
}

function settings(env) {
  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) throw new Error('Login is not configured on the server');
  return env;
}

export async function checkLogin(env, username, password) {
  const { ADMIN_USER, ADMIN_PASSWORD, SESSION_SECRET } = settings(env);
  const [userOk, passwordOk] = await Promise.all([
    same(SESSION_SECRET, String(username ?? '').trim(), ADMIN_USER),
    same(SESSION_SECRET, String(password ?? ''), ADMIN_PASSWORD),
  ]);
  return userOk && passwordOk;
}

export async function createSession(env, username) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ u: username, exp: Date.now() + MAX_AGE * 1000 })));
  return `${payload}.${await sign(settings(env).SESSION_SECRET, payload)}`;
}

export async function readSession(env, cookieHeader) {
  const value = (cookieHeader ?? '').split(/;\s*/).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value || !env.SESSION_SECRET) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature || signature !== await sign(env.SESSION_SECRET, payload)) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export const sessionCookie = (value, secure) =>
  `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`;
export const clearedCookie = secure =>
  `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
