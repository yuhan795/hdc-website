// Cloudflare Pages function: tells the admin page whether it is logged in (it goes to the login page if not).
import { readSession } from '../../lib/auth.mjs';
import { json } from '../../lib/github.mjs';

export async function onRequestGet({ request, env }) {
  const session = await readSession(env, request.headers.get('Cookie'));
  return session ? json({ user: session.u }) : json({ error: 'Please log in' }, 401);
}
