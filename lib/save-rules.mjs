// What the content admin is allowed to save. Shared by the local server and the online function.
// Paths are relative to the website root.
const CONTENT = /^content\/[a-z0-9-]+\.json$/;
const UPLOAD = /^assets\/uploads\/[a-z0-9-]+\.(webp|png|jpe?g)$/;

// For /api/upload: returns an error message, or null when the path may be uploaded.
export function checkUpload(path) {
  return typeof path === 'string' && UPLOAD.test(path) ? null : `Not allowed: ${path}`;
}

// Returns an error message, or null when every file may be saved. Uploads arrive either
// with their content or, already sent through /api/upload, as a blob id (sha).
export function checkFiles(files) {
  if (!Array.isArray(files) || !files.length) return 'No files to save';
  for (const file of files) {
    if (typeof file?.path !== 'string' || !(CONTENT.test(file.path) || UPLOAD.test(file.path))) return `Not allowed: ${file?.path}`;
    if (UPLOAD.test(file.path) && /^[0-9a-f]{40}$/.test(file.sha ?? '')) continue;
    if (typeof file.content !== 'string') return `Missing content: ${file.path}`;
    if (file.path.endsWith('.json')) {
      try { JSON.parse(file.content); } catch { return `Broken content file: ${file.path}`; }
    }
  }
  return null;
}

// A content file may only be replaced if it still matches what the admin page loaded
// (file.base), so an admin left open for days cannot overwrite newer changes.
// `readCurrent(path)` returns the stored text, or null if the file does not exist yet.
const canonical = text => JSON.stringify(JSON.parse(text));
export async function checkUnchanged(files, readCurrent) {
  for (const file of files) {
    if (!file.path.endsWith('.json')) continue;
    if (typeof file.base !== 'string') {
      return 'This admin page is out of date. Reload it, then make your changes again.';
    }
    const current = await readCurrent(file.path);
    if (current !== null && canonical(current) !== file.base) {
      return 'The projects were changed somewhere else after this admin page was opened. Reload the admin to get the latest version, then make your changes again.';
    }
  }
  return null;
}
