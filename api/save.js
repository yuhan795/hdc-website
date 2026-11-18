// Vercel function: publishes admin changes as one commit to GitHub; GitHub Pages then
// redeploys hanzdesigncollective.com (about a minute).
import { readSession } from '../lib/auth.mjs';
import { checkFiles, checkUnchanged } from '../lib/save-rules.mjs';
import { github, json } from '../lib/github.mjs';

export async function POST(request) {
  const env = process.env;
  const session = await readSession(env, request.headers.get('Cookie'));
  if (!session) return json({ error: 'Please log in again' }, 401);
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return json({ error: 'Publishing is not configured on the server' }, 500);

  const { files, message } = await request.json().catch(() => ({}));
  const problem = checkFiles(files);
  if (problem) return json({ error: problem }, 400);

  try {
    const branch = env.GITHUB_BRANCH || 'main';
    const conflict = await checkUnchanged(files, async path => {
      try {
        const { content } = await github(env, `/contents/${path}?ref=${branch}`);
        return Buffer.from(content, 'base64').toString('utf8');
      } catch (error) {
        if (String(error.message).startsWith('GitHub 404')) return null;
        throw error;
      }
    });
    if (conflict) return json({ error: conflict }, 409);
    const ref = await github(env, `/git/ref/heads/${branch}`);
    const parent = await github(env, `/git/commits/${ref.object.sha}`);
    const tree = await Promise.all(files.map(async file => {
      // Uploads were stored beforehand by /api/upload.
      if (file.sha) return { path: file.path, mode: '100644', type: 'blob', sha: file.sha };
      const blob = await github(env, '/git/blobs', { method: 'POST', body: JSON.stringify({ content: file.content, encoding: 'utf-8' }) });
      return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha };
    }));
    const newTree = await github(env, '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree }) });
    const commit = await github(env, '/git/commits', {
      method: 'POST',
      body: JSON.stringify({ message: `${String(message || 'Update projects').slice(0, 100)} (by ${session.u} via admin)`, tree: newTree.sha, parents: [ref.object.sha] }),
    });
    // Not forced: if the branch moved meanwhile this fails instead of overwriting someone else's commit.
    await github(env, `/git/refs/heads/${branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
    return json({ ok: true, saved: files.length, message: 'Published. Live on the site in about a minute' });
  } catch (error) {
    return json({ error: `Publish failed. ${error.message}` }, 502);
  }
}
