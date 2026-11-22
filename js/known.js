import { t } from './i18n.js';
import { S, unmarkKnown, loadGlossary, lookup } from './state.js';
import { meaningOf } from './corpus.js';
import { h, fa, norm, toast, speak } from './util.js';

// best display form for a normalised known-word key (lemma from the glossary, else the key itself)
function displayWord(key) {
  const hit = lookup(key);
  return (hit && hit.lemma) || key;
}

export async function renderKnown(root, nav) {
  root.append(h('div', { class: 'page-h' }, h('div', null, h('h1', null, '✓ ' + t('واژه‌هایی که بلدی')),
    h('div', { class: 'sub' }, t('واژه‌هایی که با دکمهٔ ✓ بلدم علامت زده‌ای؛ اینجا می‌توانی دوباره چکشان کنی')))));
  const box = h('div', { class: 'freq' }, h('div', { class: 'occ-n' }, t('در حال آماده‌سازی…'))); root.append(box);
  await loadGlossary().catch(() => {});
  const q = h('input', { class: 'input', placeholder: t('جستجو در این واژه‌ها…') });
  const stat = h('div', { class: 'mg-info' });
  const list = h('div', { class: 'fq-list' });
  box.replaceChildren(h('div', { class: 'field' }, q), stat, list);

  const rows = () => Object.entries(S.settings.known || {})
    .map(([k, ts]) => ({ k, ts, w: displayWord(k), m: meaningOf(k) }))
    .sort((a, b) => b.ts - a.ts);

  function paint() {
    const all = rows();
    const qq = norm(q.value);
    const filtered = all.filter((e) => !qq || norm(e.w).includes(qq) || (e.m && norm(e.m).includes(qq)));
    stat.textContent = t('{0} واژه', fa(all.length));
    list.replaceChildren();
    if (!filtered.length) {
      list.append(h('div', { class: 'occ-n' }, all.length ? t('چیزی پیدا نشد')
        : t('هنوز واژه‌ای را بلدم نزده‌ای؛ از «تست واژه» یا «پرتکرار» شروع کن')));
      return;
    }
    filtered.forEach((e) => list.append(h('div', { class: 'fq-row ok', role: 'button', tabindex: '0', onclick: () => speak(e.w, 0.85, 'de') },
      h('span', { class: 'fq-w de' }, e.w),
      h('span', { class: 'fq-m' }, e.m || ''),
      h('button', { class: 'fq-k', title: t('دیگر بلد نیستم'), 'aria-label': t('دیگر بلد نیستم'), onclick: (ev) => {
        ev.stopPropagation(); unmarkKnown([e.k]); toast(t('از فهرست «بلدم» برداشته شد')); paint();
      } }, '↺'))));
  }
  q.addEventListener('input', paint);
  paint();
}
