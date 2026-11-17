// Video storage: files are copied once into the app's private storage (OPFS) so they play offline.
const DIRNAME = 'videos';
const urls = new Map();       // lessonId -> object URL
const names = new Map();      // lessonId -> stored file name
const session = new Map();    // lessonId -> File (used when OPFS isn't available)

export const supported = () => !!(navigator.storage && navigator.storage.getDirectory);
async function dir() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIRNAME, { create: true });
}

export async function refresh() {
  names.clear();
  if (!supported()) return [];
  const out = [];
  try {
    const d = await dir();
    for await (const [name, handle] of d.entries()) {
      if (handle.kind !== 'file') continue;
      const f = await handle.getFile();
      const id = name.replace(/\.[^.]+$/, '');
      names.set(id, name);
      out.push({ id, name, size: f.size });
    }
  } catch (e) { /* ignore */ }
  return out;
}
export const has = (id) => names.has(id) || session.has(id);

export async function getURL(id) {
  if (urls.has(id)) return urls.get(id);
  let file = session.get(id);
  if (!file && names.has(id)) {
    const d = await dir();
    file = await (await d.getFileHandle(names.get(id))).getFile();
  }
  if (!file) return null;
  const u = URL.createObjectURL(file);
  urls.set(id, u);
  return u;
}

export async function save(id, file, onProgress) {
  const ext = (/\.([a-z0-9]+)$/i.exec(file.name) || [, 'mp4'])[1].toLowerCase();
  if (!supported()) { session.set(id, file); urls.delete(id); return { stored: false }; }
  const name = `${id}.${ext}`;
  const d = await dir();
  let w;
  try {
    const fh = await d.getFileHandle(name, { create: true });
    w = await fh.createWritable();
    let done = 0;
    const ts = new TransformStream({
      transform(chunk, ctrl) { done += chunk.length; onProgress && onProgress(done / file.size); ctrl.enqueue(chunk); },
    });
    await file.stream().pipeThrough(ts).pipeTo(w);
  } catch (e) {
    try { await d.removeEntry(name); } catch (e2) { /* ignore */ }
    throw e;
  }
  if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
  names.set(id, name);
  return { stored: true };
}

export async function remove(id) {
  session.delete(id);
  if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
  if (names.has(id) && supported()) {
    try { await (await dir()).removeEntry(names.get(id)); } catch (e) { /* ignore */ }
    names.delete(id);
  }
}

export async function usage() {
  try { const e = await navigator.storage.estimate(); return { used: e.usage || 0, quota: e.quota || 0 }; } catch (e) { return { used: 0, quota: 0 }; }
}
export async function persist() {
  try { return navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { return false; }
}
export async function isPersisted() {
  try { return navigator.storage.persisted ? await navigator.storage.persisted() : false; } catch (e) { return false; }
}

// Work out which lesson a file belongs to from its name
export function matchLesson(filename, lessons) {
  const base = filename.replace(/\.[^.]+$/, '');
  const direct = lessons.find((l) => l.id === base.toLowerCase());
  if (direct) return direct.id;
  const pad = (n) => String(n).padStart(2, '0');
  let m = /nicos.?weg.*?a1[^0-9]*(\d{1,2})/i.exec(base);
  if (m) { const id = `nicos-a1-${pad(m[1])}`; return lessons.some((l) => l.id === id) ? id : null; }
  m = /momente.*?(lektion|modul)[-_ ]*(\d{1,2})/i.exec(base);
  if (m && /de.?en/i.test(base)) {
    const id = `momente-a1-${m[1].toLowerCase() === 'modul' ? 'm' : 'l'}${pad(m[2])}`;
    return lessons.some((l) => l.id === id) ? id : null;
  }
  return null;
}
