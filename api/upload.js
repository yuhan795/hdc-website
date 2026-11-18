// Vercel function: stores one uploaded image in the GitHub repo as a blob and returns its id;
// PUBLISH then commits it by that id. The body (GitHub's own blob JSON, built in the browser)
// is passed on unread. Vercel accepts request bodies up to 4.5 MB.
import { readSession } from '../lib/auth.mjs';
import { checkUpload } from '../lib/save-rules.mjs';
import { github, json } from '../lib/github.mjs';

export async function POST(request) {
  const env = process.env;
  if (!(await readSession(env, request.headers.get('Cookie')))) return json({ error: 'Please log in again' }, 401);
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return json({ error: 'Publishing is not configured on the server' }, 500);
  const path = new URL(request.url).searchParams.get('path');
  const problem = checkUpload(path);
  if (problem) return json({ error: problem }, 400);
  try {
    const { sha } = await github(env, '/git/blobs', { method: 'POST', body: await request.text() });
    return json({ sha });
  } catch (error) {
    return json({ error: `Upload failed. ${error.message}` }, 502);
  }
}
