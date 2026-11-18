import { t } from './i18n.js';
import { S, loadCues } from './state.js';
import { h, ic, fa, fmtTime, norm, tokenize } from './util.js';

const MAX = 80;
const toks = (s) => tokenize(s || '').filter((x) => x.w).map((x) => norm(x.t));

// every cue (in every clip with German cues) that contains the given word/phrase as consecutive words
export async function findOccurrences(de) {
  const want = toks(de); if (!want.length) return [];
  const out = [];
  for (const l of S.lessons) {
    if ((l.lang || 'de') !== 'de') continue;
    let cues; try { cues = await loadCues(l.id); } catch (e) { continue; }
    cues.forEach((c, i) => {
      const tk = toks(c.de);
      for (let a = 0; a + want.length <= tk.length; a++) {
        let ok = true; for (let k = 0; k < want.length; k++) if (tk[a + k] !== want[k]) { ok = false; break; }
        if (ok) { out.push({ lesson: l, i, cue: c }); break; }
      }
    });
    if (out.length >= MAX) break;
  }
  return out.slice(0, MAX);
}

function mark(text, de) {
  const want = toks(de); const parts = tokenize(text); const words = parts.map((p, i) => (p.w ? i : -1)).filter((i) => i >= 0);
  const hit = new Set();
  for (let a = 0; a + want.length <= words.length; a++) {
    if (want.every((w, k) => norm(parts[words[a + k]].t) === w)) for (let k = 0; k < want.length; k++) hit.add(words[a + k]);
  }
  return parts.map((p, i) => (hit.has(i) ? h('b', { class: 'hl' }, p.t) : p.t));
}

// a lazily-filled section; onGo(lessonId, startSec) is called when a row is tapped
export function occurSection(de, onGo, { skip } = {}) {
  const box = h('div', { class: 'occ' });
  const head = h('div', { class: 'occ-h' }, h('span', { html: ic('film') }), ' ', t('جاهایی که در کلیپ‌ها آمده'));
  const list = h('div', { class: 'occ-l' }, h('div', { class: 'occ-n' }, t('در حال جستجو…')));
  box.append(head, list);
  findOccurrences(de).then((r) => {
    const rows = r.filter((o) => !(skip && skip.lesson === o.lesson.id && skip.i === o.i));
    head.append(h('small', null, ' · ' + fa(r.length)));
    if (!rows.length) { list.replaceChildren(h('div', { class: 'occ-n' }, r.length ? t('فقط همین‌جا') : t('در کلیپی پیدا نشد'))); return; }
    list.replaceChildren(...rows.map((o) => h('button', { class: 'occ-r', onclick: () => onGo(o.lesson.id, o.cue.s) },
      h('div', { class: 'occ-w' }, h('span', { class: 'occ-c' }, o.lesson.title), h('span', { class: 'occ-t' }, fmtTime(o.cue.s))),
      h('div', { class: 'occ-de de' }, mark(o.cue.de, de)),
      (o.cue.fa || o.cue.en) ? h('div', { class: 'occ-tr ' + (o.cue.fa ? 'fa' : 'en') }, o.cue.fa || o.cue.en) : null)));
  }).catch(() => list.replaceChildren(h('div', { class: 'occ-n' }, '—')));
  return box;
}
