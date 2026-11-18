// Cloudflare Pages function: clears the session cookie.
import { clearedCookie } from '../../lib/auth.mjs';
import { json } from '../../lib/github.mjs';

export function onRequestPost({ request }) {
  return json({ ok: true }, 200, { 'Set-Cookie': clearedCookie(new URL(request.url).protocol === 'https:') });
}
