// Runs for every route listed in _routes.json. /api/* goes on to the admin functions; the other
// listed paths are repo files that are not part of the website (notes, tooling, server code),
// so they answer 404 instead of being served as static files.
export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;
  if (path.startsWith('/api/')) return context.next();
  return new Response('Not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
  });
}
