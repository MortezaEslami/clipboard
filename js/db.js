// Tiny IndexedDB wrapper with an in-memory fallback (for sandboxes where IDB is blocked)
const NAME = 'klipp-db';
const STORES = ['vocab', 'cards', 'marks', 'progress', 'meta'];
let dbp = null;
const mem = Object.fromEntries(STORES.map((s) => [s, new Map()]));
export let persistent = false;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      const r = indexedDB.open(NAME, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
      };
      r.onsuccess = () => { persistent = true; res(r.result); };
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
  return dbp;
}
const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export async function getAll(store) {
  const d = await open();
  if (!d) return [...mem[store].values()];
  try { return await wrap(d.transaction(store).objectStore(store).getAll()); } catch (e) { return [...mem[store].values()]; }
}
export async function put(store, obj) {
  mem[store].set(obj.id, obj);
  const d = await open(); if (!d) return;
  try { await wrap(d.transaction(store, 'readwrite').objectStore(store).put(obj)); } catch (e) { /* ignore */ }
}
export async function putMany(store, arr) {
  arr.forEach((o) => mem[store].set(o.id, o));
  const d = await open(); if (!d) return;
  try {
    const tx = d.transaction(store, 'readwrite'); const os = tx.objectStore(store);
    arr.forEach((o) => os.put(o));
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } catch (e) { /* ignore */ }
}
export async function del(store, id) {
  mem[store].delete(id);
  const d = await open(); if (!d) return;
  try { await wrap(d.transaction(store, 'readwrite').objectStore(store).delete(id)); } catch (e) { /* ignore */ }
}
export async function clear(store) {
  mem[store].clear();
  const d = await open(); if (!d) return;
  try { await wrap(d.transaction(store, 'readwrite').objectStore(store).clear()); } catch (e) { /* ignore */ }
}
export async function get(store, id) {
  if (mem[store].has(id)) return mem[store].get(id);
  const d = await open(); if (!d) return undefined;
  try { return await wrap(d.transaction(store).objectStore(store).get(id)); } catch (e) { return undefined; }
}
