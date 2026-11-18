// Cloudflare Pages function: checks the admin username/password and sets the session cookie.
import { checkLogin, createSession, sessionCookie } from '../../lib/auth.mjs';
import { json } from '../../lib/github.mjs';

export async function onRequestPost({ request, env }) {
  const { username, password } = await request.json().catch(() => ({}));
  try {
    if (!(await checkLogin(env, username, password))) {
      await new Promise(resolve => setTimeout(resolve, 800)); // slow down password guessing
      return json({ error: 'Wrong username or password' }, 401);
    }
    const secure = new URL(request.url).protocol === 'https:';
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(await createSession(env, String(username).trim()), secure) });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
