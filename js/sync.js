// Cross-device sync through a private GitHub Gist (free). Everything except the clips themselves is merged by recency.
import { t } from './i18n.js';
import { S, saveSettings, flushDays } from './state.js';
import * as DB from './db.js';

const KEY = 'lc-gh', GID = 'lc-gist', LAST = 'lc-sync', FILE = 'clipboard-sync.json';
export const getToken = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
export const setToken = (v) => { try { v ? localStorage.setItem(KEY, v.trim()) : (localStorage.removeItem(KEY), localStorage.removeItem(GID)); } catch (e) { /* ignore */ } };
export const lastSync = () => { try { return +localStorage.getItem(LAST) || 0; } catch (e) { return 0; } };
let busy = false;

async function api(path, opts = {}) {
  let r;
  try {
    r = await fetch('https://api.github.com' + path, { ...opts, headers: { Authorization: 'Bearer ' + getToken(), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } });
  } catch (e) { throw new Error(t('اتصال به GitHub ناموفق بود')); }
  if (r.status === 401 || r.status === 403) throw new Error(t('توکن درست نیست'));
  if (r.status === 404) { const e = new Error('404'); e.status = 404; throw e; }
  if (!r.ok) throw new Error('GitHub ' + r.status);
  return r.json();
}
async function findGist() {
  const id = localStorage.getItem(GID);
  if (id) { try { return await api('/gists/' + id); } catch (e) { if (e.status !== 404) throw e; localStorage.removeItem(GID); } }
  const list = await api('/gists?per_page=100');
  const g = list.find((x) => x.files && x.files[FILE]);
  if (g) { localStorage.setItem(GID, g.id); return api('/gists/' + g.id); }
  return null;
}
const payload = () => ({ v: 1, t: Date.now(), xp: S.settings.xp || 0, days: S.days, vocab: [...S.vocab.values()], cards: [...S.cards.values()], marks: [...S.marks.values()], progress: [...S.progress.values()], tomb: S.settings.tomb || {}, stories: S.settings.stories || {}, known: S.settings.known || {} });
const stamp = (o) => o.upd || o.created || o.t || 0;

async function merge(r) {
  const tomb = { ...(S.settings.tomb || {}) };
  for (const [k, v] of Object.entries(r.tomb || {})) tomb[k] = Math.max(tomb[k] || 0, v);
  S.settings.tomb = tomb;
  const putV = [], putC = [], putM = [], putP = [], dels = [];
  const kn = (S.settings.known = S.settings.known || {});
  for (const [w, ts] of Object.entries(r.known || {})) if ((tomb['k:' + w] || 0) < ts && (kn[w] || 0) < ts) kn[w] = ts;
  for (const w of Object.keys(kn)) if ((tomb['k:' + w] || 0) >= kn[w]) delete kn[w];
  const gone = (id, o) => tomb[id] && tomb[id] >= stamp(o);
  for (const v of r.vocab || []) {
    const l = S.vocab.get(v.id);
    if (gone(v.id, v)) continue;
    if (!l || stamp(v) > stamp(l)) { S.vocab.set(v.id, v); putV.push(v); }
  }
  for (const [id, l] of [...S.vocab]) if (gone(id, l)) { S.vocab.delete(id); dels.push(['vocab', id]); }
  for (const c of r.cards || []) {
    if (!S.vocab.has(c.vid)) continue;
    const l = S.cards.get(c.id);
    if (!l || (c.last || 0) > (l.last || 0) || ((c.last || 0) === (l.last || 0) && (c.reps || 0) > (l.reps || 0))) { S.cards.set(c.id, c); putC.push(c); }
  }
  for (const [id, c] of [...S.cards]) if (!S.vocab.has(c.vid)) { S.cards.delete(id); dels.push(['cards', id]); }
  for (const m of r.marks || []) {
    const l = S.marks.get(m.id);
    if (gone(m.id, m)) continue;
    if (!l || stamp(m) > stamp(l)) { S.marks.set(m.id, m); putM.push(m); }
  }
  for (const [id, m] of [...S.marks]) if (gone(id, m)) { S.marks.delete(id); dels.push(['marks', id]); }
  for (const p of r.progress || []) {
    const l = S.progress.get(p.id);
    if (!l || (p.t || 0) > (l.t || 0)) { S.progress.set(p.id, { ...p, done: Math.max(p.done || 0, (l && l.done) || 0) }); putP.push(S.progress.get(p.id)); }
    else if ((p.done || 0) > (l.done || 0)) { l.done = p.done; putP.push(l); }
  }
  for (const [k, v] of Object.entries(r.days || {})) {
    const c = S.days[k];
    if (!c) S.days[k] = v; else { c.r = Math.max(c.r || 0, v.r || 0); c.n = Math.max(c.n || 0, v.n || 0); c.w = Math.max(c.w || 0, v.w || 0); }
  }
  S.settings.xp = Math.max(S.settings.xp || 0, r.xp || 0);
  const sd = (S.settings.stories = S.settings.stories || {});
  for (const [k, v] of Object.entries(r.stories || {})) if (!sd[k] || (v.score || 0) > (sd[k].score || 0)) sd[k] = v;
  await Promise.all([DB.putMany('vocab', putV), DB.putMany('cards', putC), DB.putMany('marks', putM), DB.putMany('progress', putP), ...dels.map(([s, id]) => DB.del(s, id))]);
  flushDays(); saveSettings();
  return putV.length + putC.length + putM.length + putP.length + dels.length;
}

// returns number of records changed locally; throws Error(message) on failure
export async function syncNow() {
  if (busy) return 0; if (!getToken()) throw new Error(t('توکن درست نیست'));
  busy = true;
  try {
    const g = await findGist(); let changed = 0;
    if (g && g.files[FILE]) {
      const f = g.files[FILE];
      const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
      try { changed = await merge(JSON.parse(text)); } catch (e) { if (e instanceof SyntaxError) changed = 0; else throw e; }
    }
    const body = JSON.stringify({ description: 'Clipboard sync data', public: false, files: { [FILE]: { content: JSON.stringify(payload()) } } });
    if (g) await api('/gists/' + g.id, { method: 'PATCH', body });
    else { const n = await api('/gists', { method: 'POST', body }); localStorage.setItem(GID, n.id); }
    localStorage.setItem(LAST, String(Date.now()));
    return changed;
  } finally { busy = false; }
}
