import { t } from './i18n.js';
import { S, MARKS, removeMark } from './state.js';
import { h, ic, fa, fmtTime, toast } from './util.js';

let filter = { color: 'all', lesson: 'all' };

export function renderMarks(root, nav) {
  const head = h('div', { class: 'page-h' }, h('div', null, h('h1', null, t('مارک‌ها')), h('div', { class: 'sub', id: 'msub' })));
  const chips = h('div', { class: 'chips' });
  const sel = h('select', { class: 'input', style: { marginBottom: '10px' } });
  const list = h('div');
  root.append(head, chips, sel, list);
  sel.addEventListener('change', () => { filter.lesson = sel.value; paint(); });

  function paint() {
    const all = [...S.marks.values()].sort((a, b) => (a.lesson === b.lesson ? a.s - b.s : S.lessons.findIndex((l) => l.id === a.lesson) - S.lessons.findIndex((l) => l.id === b.lesson)));
    document.getElementById('msub').textContent = t('{0} مارک', fa(all.length));
    chips.replaceChildren(
      h('button', { class: 'chip' + (filter.color === 'all' ? ' on' : ''), onclick: () => { filter.color = 'all'; paint(); } }, t('همه'), h('span', { class: 'n num' }, fa(all.length))),
      ...MARKS.map((m) => h('button', { class: 'chip' + (filter.color === m.id ? ' on' : ''), onclick: () => { filter.color = m.id; paint(); } },
        h('span', { class: `dot c-${m.id}`, style: { marginInlineEnd: '6px' } }), m.name, h('span', { class: 'n num' }, fa(all.filter((x) => x.color === m.id).length)))));
    const used = [...new Set(all.map((m) => m.lesson))];
    sel.replaceChildren(h('option', { value: 'all' }, t('همه درس‌ها')), ...S.lessons.filter((l) => used.includes(l.id)).map((l) => h('option', { value: l.id }, `${S.courses.find((c) => c.id === l.course).short} · ${l.title}`)));
    sel.value = used.includes(filter.lesson) ? filter.lesson : (filter.lesson = 'all');
    const rows = all.filter((m) => (filter.color === 'all' || m.color === filter.color) && (filter.lesson === 'all' || m.lesson === filter.lesson));
    list.replaceChildren();
    if (!rows.length) {
      list.append(h('div', { class: 'empty' }, h('div', { html: ic('bookmark') }), h('b', null, all.length ? t('مارکی با این فیلتر نیست') : t('هنوز مارکی نداری')),
        all.length ? '' : t('داخل پلیر آیکون نشانک کنار هر جمله را بزن و یکی از چهار رنگ را انتخاب کن.')));
      return;
    }
    let lastLesson = null;
    rows.forEach((m) => {
      if (m.lesson !== lastLesson) {
        lastLesson = m.lesson; const l = S.lessonMap.get(m.lesson);
        list.append(h('div', { class: 'sect-t' }, l ? `${S.courses.find((c) => c.id === l.course).name} · ${l.title}` : m.lesson));
      }
      list.append(h('div', { class: `card vitem c-${m.color}`, onclick: () => nav('p-' + m.lesson, { startAt: m.s, loop: true }) },
        h('div', { class: 'lv', style: { background: 'var(--c)' } }),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { class: 'de-w', style: { fontSize: '16.5px', fontWeight: 600 } }, m.de),
          (m.fa || m.en) ? h('div', { class: 'mean ' + (m.fa ? 'fa' : 'en') }, m.fa || m.en) : null,
          m.note ? h('div', { class: 'mean fa', style: { color: 'var(--muted)', fontSize: '13px' } }, '✎ ' + m.note) : null,
          h('div', { class: 'src' }, h('span', { class: 'pill' }, fmtTime(m.s)), h('span', { class: 'pill', style: { background: 'color-mix(in srgb,var(--c) 18%,transparent)', color: 'var(--c)' } }, MARKS.find((x) => x.id === m.color).name))),
        h('button', { class: 'icon-btn sm', onclick: (e) => { e.stopPropagation(); removeMark(m.lesson, m.i); paint(); toast(t('مارک حذف شد')); }, html: ic('trash'), 'aria-label': t('حذف') })));
    });
  }
  paint();
}
