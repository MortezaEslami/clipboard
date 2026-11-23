import { t } from './i18n.js';
import { S, loadCues, loadGlossary, lookup, addVocab, findVocab, markKnown } from './state.js';
import { h, norm, tokenize, toast } from './util.js';
import { loadStories } from './stories.js';
import { isProperNoun } from './names.js';

// every German sentence the app has (clips + stories), with word frequencies
let C = null;
export async function corpus() {
  if (C) return C;
  try { await loadGlossary(); } catch (e) { /* ignore */ }
  const freq = new Map(); const sents = [];
  const add = (src) => {
    const toks = tokenize(src.de).filter((x) => x.w); const n = toks.length;
    toks.forEach((x) => {
      const k = norm(x.t); if (k.length < 2 || /\d/.test(k)) return;
      if (isProperNoun(k)) return;
      let e = freq.get(k); if (!e) { e = { k, w: x.t, n: 0, ex: null }; freq.set(k, e); }
      e.n++; if (n >= 3 && n <= 10 && (!e.ex || n < e.ex.len)) e.ex = { ...src, len: n };
    });
    sents.push(src);
  };
  for (const l of S.lessons) {
    if ((l.lang || 'de') !== 'de') continue;
    let cues; try { cues = await loadCues(l.id); } catch (e) { continue; }
    cues.forEach((c, i) => add({ de: c.de, fa: c.fa || '', en: c.en || '', lesson: l.id, lname: l.title, s: c.s, e: c.e, i }));
  }
  for (const st of await loadStories()) st.s.forEach((c) => add({ de: c.de, fa: c.fa || '', en: c.en || '', story: st.id, lname: st.title.de }));
  const list = [...freq.values()].sort((a, b) => b.n - a.n);
  // A2 word list: [word, en, fa, example de, example fa, example en]; meanings go into the glossary
  const a2 = [];
  const G = S.glossary || (S.glossary = {});
  for (const [w, en, fa, de, xfa, xen] of await loadA2()) {
    const k = norm(w); if (!k || isProperNoun(k) || freq.has(k) && freq.get(k).n >= 3) continue;
    if (!G[w.toLowerCase()]) G[w.toLowerCase()] = [w, en, fa];
    const ex = { de, fa: xfa, en: xen, lname: 'A2', a2: true, len: tokenize(de).filter((x) => x.w).length };
    a2.push({ k, w, n: 0, lv: 'A2', ex, hk: hlKey(de, k) });
    sents.push(ex);
  }
  C = { freq, list, sents, a2 };
  return C;
}

let A2 = null;
async function loadA2() {
  if (!A2) { try { A2 = await (await fetch('data/a2.json')).json(); } catch (e) { A2 = []; } }
  return A2;
}
// the token in the example that is the word itself (or its closest inflected form) – for highlighting
function hlKey(de, k) {
  let best = k, bl = 0;
  for (const x of tokenize(de)) {
    if (!x.w) continue; const n = norm(x.t); if (n === k) return k;
    let i = 0; while (i < n.length && i < k.length && n[i] === k[i]) i++;
    if (i >= 3 && i > bl) { bl = i; best = n; }
  }
  return best;
}
// words of the chosen level for the frequency list and the word test
export const levelWords = (C, lv) => (lv === 'A2' ? C.a2 : C.list);

export const knownSet = () => {
  const s = new Set(Object.keys(S.settings.known || {}));
  S.vocab.forEach((v) => { s.add(norm(v.de)); s.add(norm(v.form || v.de)); });
  return s;
};
export const meaningOf = (word) => {
  const g = lookup(word); if (!g) return '';
  const m = S.settings.meaningLang || 'both';
  if (m === 'en') return g.en; if (m === 'fa') return g.fa || g.en;
  return [g.fa, g.en].filter(Boolean).join(' · ');
};
export const lemmaOf = (word) => { const g = lookup(word); return g && g.lemma ? g.lemma : word; };

// save a corpus word as a flashcard, with the example sentence as context
export function saveWord(e) {
  const g = lookup(e.w) || {}; const lemma = g.lemma || e.w;
  if (findVocab(lemma)) { toast(t('این واژه را قبلاً داشتی')); return false; }
  const ex = e.ex;
  const ctx = ex && ex.lesson ? { lesson: ex.lesson, lang: 'de', i: ex.i, s: ex.s, e: ex.e, de: ex.de, en: ex.en || '', fa: ex.fa || '' } : null;
  addVocab({ de: lemma, fa: g.fa || '', en: g.en || '', form: e.w, ctx });
  return true;
}
export { markKnown };

// sentence with the target word highlighted
export function marked(text, key) {
  return tokenize(text).map((x) => (x.w && norm(x.t) === key ? h('b', { class: 'hl' }, x.t) : x.t));
}

// the clip whose words you already know best-but-not-fully (about 90%) = best next clip
const covCache = new Map();
export async function lessonCoverage(l) {
  const kn = knownSet(); let tot = 0, ok = 0;
  const cues = await loadCues(l.id);
  cues.forEach((c) => tokenize(c.de).forEach((x) => { if (!x.w) return; const k = norm(x.t); if (k.length < 2) return; tot++; if (kn.has(k)) ok++; }));
  return tot ? ok / tot : 0;
}
export async function recommendNext(hasVideo, progressOf) {
  const ls = S.lessons.filter((l) => (l.lang || 'de') === 'de' && progressOf(l.id) < 0.9);
  const withV = ls.filter((l) => hasVideo(l.id)); const pool = (withV.length ? withV : ls).slice(0, 60);
  let best = null;
  for (const l of pool) {
    let cov; try { cov = await lessonCoverage(l); } catch (e) { continue; }
    const score = Math.abs(cov - 0.9) + (cov > 0.97 ? 0.2 : 0);
    if (!best || score < best.score) best = { l, cov, score };
  }
  return best;
}
