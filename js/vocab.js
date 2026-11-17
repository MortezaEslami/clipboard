import { t } from './i18n.js';
import { S, KINDS, addVocab, saveVocab, deleteVocab, vocabLevel, vocabCards, findVocab, activeKinds } from './state.js';
import { h, ic, fa, fmtTime, openSheet, toast, speak, confirmSheet, norm, vlang } from './util.js';

const LV = [t('جدید'), t('در حال یادگیری'), t('نسبتاً مسلط'), t('مسلط')];
let filter = { q: '', lv: 'all', lesson: 'all' };

export function renderVocab(root, nav) {
  const head = h('div', { class: 'page-h' }, h('div', null, h('h1', null, t('واژگان')), h('div', { class: 'sub', id: 'vsub' })),
    h('button', { class: 'btn sec sm', onclick: () => nav('review'), html: ic('cards') + ' ' + t('مرور') }));
  const q = h('input', { class: 'input', placeholder: t('جستجو در واژه‌ها…'), value: filter.q });
  q.addEventListener('input', () => { filter.q = q.value; paint(); });
  const search = h('div', { class: 'search' }, h('span', { html: ic('search') }), q);
  const lvChips = h('div', { class: 'chips' });
  const lessonSel = h('select', { class: 'input', style: { marginBottom: '10px' } });
  const list = h('div');
  const fab = h('button', { class: 'fab', onclick: () => openEdit(null), html: ic('plus'), 'aria-label': t('افزودن واژه') });
  root.append(head, search, lvChips, lessonSel, list, fab);

  lessonSel.addEventListener('change', () => { filter.lesson = lessonSel.value; paint(); });

  function paint() {
    const all = [...S.vocab.values()].sort((a, b) => b.created - a.created);
    document.getElementById('vsub').textContent = t('{0} واژه', fa(all.length));
    const levels = [['all', t('همه')], [0, LV[0]], [1, LV[1]], [2, LV[2]], [3, LV[3]]];
    lvChips.replaceChildren(...levels.map(([k, l]) => {
      const n = k === 'all' ? all.length : all.filter((v) => vocabLevel(v) === k).length;
      return h('button', { class: 'chip' + (filter.lv === k ? ' on' : ''), onclick: () => { filter.lv = k; paint(); } }, l, h('span', { class: 'n num' }, fa(n)));
    }));
    const used = [...new Set(all.map((v) => v.ctx && v.ctx.lesson).filter(Boolean))];
    lessonSel.replaceChildren(h('option', { value: 'all' }, t('همه درس‌ها')), ...S.lessons.filter((l) => used.includes(l.id)).map((l) => h('option', { value: l.id }, `${S.courses.find((c) => c.id === l.course).short} · ${l.title}`)));
    lessonSel.value = used.includes(filter.lesson) ? filter.lesson : (filter.lesson = 'all');
    const qq = norm(filter.q);
    const rows = all.filter((v) => (filter.lv === 'all' || vocabLevel(v) === filter.lv)
      && (filter.lesson === 'all' || (v.ctx && v.ctx.lesson === filter.lesson))
      && (!qq || norm(v.de).includes(qq) || norm(v.fa).includes(qq) || norm(v.en).includes(qq)));
    list.replaceChildren();
    if (!rows.length) {
      list.append(h('div', { class: 'empty' }, h('div', { html: ic('book') }), h('b', null, all.length ? t('چیزی پیدا نشد') : t('هنوز واژه‌ای نداری؛ بیا با هم شروع کنیم ✨')),
        all.length ? '' : t('داخل پلیر روی هر واژه‌ای بزن و «ذخیره در واژه‌ها» را بزن. یا با دکمه + دستی اضافه کن.')));
      return;
    }
    rows.forEach((v) => {
      const l = v.ctx && v.ctx.lesson ? S.lessonMap.get(v.ctx.lesson) : null;
      list.append(h('div', { class: 'card vitem', onclick: () => openEdit(v) },
        h('div', { class: 'lv l' + vocabLevel(v) }),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { class: 'de-w' }, v.de),
          v.fa ? h('div', { class: 'mean fa' }, v.fa) : null,
          v.en ? h('div', { class: 'mean en' }, v.en) : null,
          h('div', { class: 'src' }, h('span', { class: 'pill' }, LV[vocabLevel(v)]), l ? h('span', { class: 'pill acc' }, `${S.courses.find((c) => c.id === l.course).short} · ${fmtTime(v.ctx.s)}`) : null)),
        h('button', { class: 'icon-btn sm', onclick: (e) => { e.stopPropagation(); speak(v.de, undefined, vlang(v)); }, html: ic('vol'), 'aria-label': t('تلفظ') })));
    });
  }

  function openEdit(v) {
    const isNew = !v;
    const deIn = h('input', { class: 'input de', dir: 'ltr', value: v ? v.de : '', placeholder: t('واژه یا عبارت آلمانی') });
    const faIn = h('input', { class: 'input fa', value: v ? v.fa : '', placeholder: t('معنی فارسی') });
    const enIn = h('input', { class: 'input en', dir: 'ltr', value: v ? v.en : '', placeholder: 'English meaning' });
    const kinds = new Set(v ? v.kinds : activeKinds(false));
    const hasCtx = !!(v && v.ctx && v.ctx.lesson);
    const kindRow = h('div', { class: 'chips', style: { flexWrap: 'wrap' } }, Object.entries(KINDS).map(([k, info]) => {
      const dis = k === 'clip' && !hasCtx;
      const b = h('button', { class: 'chip' + (kinds.has(k) && !dis ? ' on' : ''), disabled: dis, style: dis ? { opacity: .4 } : null, onclick: () => {
        if (dis) return;
        if (kinds.has(k)) { if (kinds.size > 1) kinds.delete(k); } else kinds.add(k);
        kindRow.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('on', kinds.has(Object.keys(KINDS)[i]) && !(Object.keys(KINDS)[i] === 'clip' && !hasCtx)));
      } }, info.name);
      return b;
    }));
    const body = [];
    if (v && v.ctx && v.ctx.de) body.push(h('div', { class: 'sent' }, h('div', { class: 's-de de' }, v.ctx.de), (v.ctx.fa || v.ctx.en) ? h('div', { class: 's-tr ' + (v.ctx.fa ? 'fa' : 'en') }, v.ctx.fa || v.ctx.en) : null));
    body.push(
      h('div', { class: 'field' }, h('label', null, t('آلمانی')), h('div', { style: { display: 'flex', gap: '8px' } }, deIn, h('button', { class: 'icon-btn', style: { background: 'var(--bg2)' }, html: ic('vol'), onclick: () => speak(deIn.value) }))),
      h('div', { class: 'field' }, h('label', null, t('فارسی')), faIn),
      h('div', { class: 'field' }, h('label', null, 'English'), enIn),
      h('div', { class: 'field' }, h('label', null, t('نوع کارت‌ها')), kindRow));
    const acts = h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } });
    const sh = openSheet({ title: isNew ? t('واژه جدید') : t('ویرایش واژه'), body, actions: acts });
    if (!isNew) {
      acts.append(h('button', { class: 'btn danger', onclick: async () => { if (await confirmSheet({ title: t('حذف واژه'), text: t('«{0}» و کارت‌هایش حذف شود؟', v.de), okText: t('حذف'), danger: true })) { deleteVocab(v.id); sh.close(); paint(); toast(t('حذف شد')); } }, html: ic('trash') }));
      if (hasCtx) acts.append(h('button', { class: 'btn sec', onclick: () => { sh.close(); nav('p-' + v.ctx.lesson, { startAt: v.ctx.s, loop: true }); }, html: ic('film') + ' ' + t('صحنه') }));
    }
    acts.append(h('button', { class: 'btn block', style: { flex: 1 }, onclick: () => {
      const de = deIn.value.trim(); if (!de) { toast(t('واژه را وارد کن')); return; }
      if (isNew) {
        if (findVocab(de)) { toast(t('این واژه را قبلاً داشتی')); return; }
        addVocab({ de, fa: faIn.value, en: enIn.value, kinds: [...kinds] });
      } else {
        v.de = de; v.fa = faIn.value.trim(); v.en = enIn.value.trim(); v.kinds = [...kinds]; saveVocab(v);
      }
      sh.close(); paint(); toast(t('ذخیره شد ✓'));
    } }, t('ذخیره')));
  }

  paint();
}
