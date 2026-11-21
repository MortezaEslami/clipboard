import { t } from './i18n.js';
import { h, ic, fa, fmtTime, norm, tokenize } from './util.js';
import { corpus } from './corpus.js';

// search every sentence of every clip and story (German text and translations)
export async function renderSearch(root, nav) {
  root.append(h('div', { class: 'page-h' }, h('div', null, h('h1', null, '🔎 ' + t('جستجو در همه‌ی کلیپ‌ها')), h('div', { class: 'sub' }, t('هر واژه یا عبارتی را در زیرنویس‌ها پیدا کن')))));
  const input = h('input', { class: 'input de', dir: 'auto', type: 'search', placeholder: t('مثلاً: Entschuldigung یا «ببخشید»'), autofocus: true });
  const out = h('div', { class: 'occ-l', style: { maxHeight: 'none', marginTop: '12px' } });
  root.append(h('div', { class: 'field' }, input), out);
  const C = await corpus(); let timer = 0;
  const hit = (s, q) => norm(s.de).includes(q) || norm(s.fa).includes(q) || norm(s.en).includes(q);
  function run() {
    const q = norm(input.value); if (q.length < 2) { out.replaceChildren(h('div', { class: 'occ-n' }, t('حداقل دو حرف بنویس'))); return; }
    const rows = C.sents.filter((s) => hit(s, q));
    if (!rows.length) { out.replaceChildren(h('div', { class: 'occ-n' }, t('چیزی پیدا نشد'))); return; }
    out.replaceChildren(h('div', { class: 'occ-n' }, t('{0} نتیجه', fa(rows.length))), ...rows.slice(0, 80).map((s) => h('button', { class: 'occ-r', onclick: () => (s.lesson ? nav('p-' + s.lesson, { startAt: s.s, loop: true }) : s.story ? nav('story/' + s.story) : nav('freq')) },
      h('div', { class: 'occ-w' }, h('span', { class: 'occ-c' }, (s.story ? '📖 ' : s.a2 ? '📚 ' : '') + s.lname), h('span', { class: 'occ-t' }, s.lesson ? fmtTime(s.s) : '')),
      h('div', { class: 'occ-de de' }, ...tokenize(s.de).map((x) => (x.w && q.split(' ').includes(norm(x.t)) ? h('b', { class: 'hl' }, x.t) : x.t))),
      (s.fa || s.en) ? h('div', { class: 'occ-tr ' + (s.fa ? 'fa' : 'en') }, s.fa || s.en) : null)));
  }
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 200); });
  run();
}
