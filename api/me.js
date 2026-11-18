// Vercel function: tells the admin page whether it is logged in (it goes to the login page if not).
import { readSession } from '../lib/auth.mjs';
import { json } from '../lib/github.mjs';

export async function GET(request) {
  const session = await readSession(process.env, request.headers.get('Cookie'));
  return session ? json({ user: session.u }) : json({ error: 'Please log in' }, 401);
}
