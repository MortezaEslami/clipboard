import { t } from './i18n.js';
import { S, streak, bestStreak, dayActive, todayWatch } from './state.js';
import { h, fa, dayKey } from './util.js';

export function fmtDur(sec) {
  sec = Math.round(sec || 0);
  if (sec < 60) return `${fa(sec)} ${t('ثانیه')}`;
  const m = Math.round(sec / 60); const hr = Math.floor(m / 60); const mm = m % 60;
  return hr ? `${fa(hr)} ${t('ساعت')}${mm ? ' ' + fa(mm) + ' ' + t('دقیقه') : ''}` : `${fa(m)} ${t('دقیقه')}`;
}
const WD = [t('ی'), t('د'), t('س'), t('چ'), t('پ'), t('ج'), t('ش')];
let range = 'week';

export function renderStats(root, nav) {
  const head = h('div', { class: 'page-h' }, h('div', null, h('h1', null, '📊 ' + t('آمار یادگیری')), h('div', { class: 'sub' }, t('تماشای ویدیو هم برای سری روزها حساب می‌شود'))));
  const cards = h('div', { class: 'st-cards' });
  const seg = h('div', { class: 'seg st-seg' }, [['week', t('هفته')], ['month', t('ماه')]].map(([k, l]) => h('button', { class: range === k ? 'on' : '', onclick: () => { range = k; paint(); } }, l)));
  const c1 = h('div', { class: 'card st-chart' }); const c2 = h('div', { class: 'card st-chart' }); const meta = h('div', { class: 'st-meta' });
  root.append(head, cards, seg, c1, c2, meta);
  paint();

  function series(n) {
    const out = []; const d = new Date(); d.setDate(d.getDate() - n + 1);
    for (let i = 0; i < n; i++) { const e = S.days[dayKey(d)] || {}; out.push({ d: new Date(d), r: e.r || 0, w: e.w || 0, on: dayActive(e) }); d.setDate(d.getDate() + 1); }
    return out;
  }
  function bars(el, title, data, key, fmt, color) {
    const max = Math.max(1, ...data.map((x) => x[key]));
    el.replaceChildren(h('div', { class: 'st-t' }, title), h('div', { class: 'bars ' + range }, data.map((x, i) => {
      const hgt = Math.max(x[key] ? 6 : 2, (x[key] / max) * 100);
      const today = i === data.length - 1;
      return h('div', { class: 'bar-c' + (today ? ' today' : '') },
        h('span', { class: 'bv' }, x[key] && (range === 'week' || today) ? fmt(x[key]) : ''),
        h('i', { style: { height: hgt + '%', background: color } }),
        h('small', null, range === 'week' ? WD[x.d.getDay()] : ((x.d.getDate() % 5 === 0 && i > 2 && i < data.length - 3) || i === 0 || today ? fa(x.d.getDate()) : '')));
    })));
  }
  function paint() {
    seg.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', (i === 0) === (range === 'week')));
    const n = range === 'week' ? 7 : 30; const data = series(n);
    const all = Object.values(S.days);
    const totW = all.reduce((a, d) => a + (d.w || 0), 0), totR = all.reduce((a, d) => a + (d.r || 0), 0);
    const mk = (ic, v, l, cls) => h('div', { class: 'st-card ' + cls }, h('div', { class: 'ic' }, ic), h('b', null, v), h('small', null, l));
    cards.replaceChildren(
      mk('🔥', fa(streak()), t('سری فعلی'), 'a'), mk('🏆', fa(bestStreak()), t('بهترین سری'), 'b'),
      mk('⏱️', fmtDur(todayWatch()), t('زمان تماشای امروز'), 'c'), mk('🎬', fmtDur(totW), t('کل زمان تماشا'), 'd'));
    bars(c1, t('زمان تماشا (دقیقه در روز)'), data.map((x) => ({ ...x, m: Math.round(x.w / 60) })), 'm', (v) => fa(v), 'linear-gradient(180deg,#2e7bff,#8a4dff)');
    bars(c2, t('تعداد مرور در روز'), data, 'r', (v) => fa(v), 'linear-gradient(180deg,#ffb800,#ff4fa3)');
    const act = data.filter((x) => x.on).length; const sumW = data.reduce((a, x) => a + x.w, 0);
    meta.replaceChildren(h('div', null, t('روزهای فعال: {0}', fa(act) + ' / ' + fa(n))), h('div', null, t('میانگین هر روز فعال: {0}', fmtDur(act ? sumW / act : 0))),
      h('div', null, t('جمع این بازه: {0} · {1} مرور', fmtDur(sumW), fa(data.reduce((a, x) => a + x.r, 0)))), h('div', null, t('مرور‌های کل: {0}', fa(totR))));
  }
}
