import { t, locale, lang, setLang } from './i18n.js';
import { S, counts, streak, lastDays, lessonProgress, levelInfo, todayReviews } from './state.js';
import * as Videos from './videos.js';
import { h, ic, fa, fmtTime } from './util.js';
import { openAddClip } from './addclip.js';
import { deleteCustomLesson } from './state.js';
import { confirmSheet } from './util.js';
import { mascot, ring, animateRings, countUp, confetti, sfx } from './fx.js';

let courseId = null;
const WD = [t('ی'), t('د'), t('س'), t('چ'), t('پ'), t('ج'), t('ش')];   // Sunday..Saturday (Persian initials)

function langPicker() {
  const flags = [['fa', '🇮🇷', 'فارسی'], ['en', '🇬🇧', 'English'], ['de', '🇩🇪', 'Deutsch']];
  const globe = h('button', { class: 'globe-btn', 'aria-label': 'Language', html: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>' });
  const menu = h('div', { class: 'flag-menu' }, flags.map(([k, f, n]) => h('button', { class: 'flag' + (k === lang ? ' on' : ''), title: n, 'aria-label': n, onclick: () => { if (k !== lang) setLang(k); else menu.classList.remove('open'); } }, f)));
  globe.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click', () => menu.classList.remove('open'));
  return h('div', { class: 'lang-pick' }, h('small', { class: 'ver' }, 'v1.4.6'), globe, menu);
}

export function renderHome(root, nav) {
  if (!courseId) courseId = lastCourse() || S.courses[0].id;
  const c = counts();
  const hr = new Date().getHours();
  const greet = hr < 5 ? t('شب‌بخیر') : hr < 12 ? t('صبح‌بخیر') : hr < 18 ? t('سلام') : t('عصر‌بخیر');
  const dayName = new Date().toLocaleDateString(locale + '-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long' });
  const st = streak();
  const lv = levelInfo();
  const goal = S.settings.dailyGoal || 15, today = todayReviews();
  const goalDone = today >= goal;

  root.append(h('div', { class: 'page-h home-h' },
    h('div', { class: 'mascot-wrap', html: mascot(goalDone ? 'cheer' : (c.due + c.fresh ? 'happy' : 'sleep'), 66), onclick: (e) => { const k = e.currentTarget; k.classList.remove('boing'); void k.offsetWidth; k.classList.add('boing'); sfx('tap'); const r = k.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + 20, { n: 22, power: .6 }); } }),
    h('div', { class: 'grow' }, h('h1', null, greet), h('div', { class: 'sub' }, dayName)),
    h('div', { class: 'hdr-end' },
      h('div', { class: 'streak' + (st ? ' lit' : '') }, h('span', { class: 'flame', html: ic('flame') }), h('b', { class: 'num' }, fa(st))),
      langPicker())));

  // ---- review hero with daily-goal ring
  const hasVocab = S.vocab.size > 0;
  const hero = h('div', { class: 'card hero' });
  const ringHtml = ring(today / goal, 96, 11, t('<b class="num">{0}</b><small>از {1}</small>', fa(today), fa(goal)));
  if (hasVocab && (c.due || c.fresh)) {
    hero.append(
      h('div', { class: 'hero-row' }, h('div', { html: ringHtml }),
        h('div', { class: 'hero-t' }, h('div', { class: 'big num' }, fa(c.due + c.fresh)), h('div', { class: 't' }, t('کارت برای مرور')),
          h('div', { class: 'hero-chips' }, h('span', null, t('{0} تکرار', fa(c.due))), h('span', null, t('{0} جدید', fa(c.fresh)))))),
      h('button', { class: 'btn pulse', onclick: () => nav('review') }, h('span', { html: ic('zap') }), t('شروع مرور')));
  } else if (hasVocab) {
    hero.append(h('div', { class: 'hero-row' }, h('div', { html: ringHtml }), h('div', { class: 'hero-t' }, h('div', { class: 'big' }, '🎉'), h('div', { class: 't' }, t('مرور امروزت تمام شد؛ آفرین به تو! 🎉')))),
      h('button', { class: 'btn', onclick: () => nav('vocab') }, t('واژگان')));
  } else {
    hero.append(h('div', { class: 'hero-row' }, h('div', { class: 'hero-mascot', html: mascot('think', 84) }),
      h('div', { class: 'hero-t' }, h('div', { class: 't', style: { fontSize: '15px', fontWeight: 700, maxWidth: '100%' } }, t('یک درس را باز کن و روی هر واژه‌ای که نمی‌دانی بزن؛ خودش می‌رود توی واژه‌هایت 😊')))));
  }
  hero.append(...['✦', '✧', '★'].map((x, i) => h('span', { class: 'spark s' + i }, x)));
  root.append(hero);
  animateRings(hero);

  // ---- level / XP
  const lvCard = h('div', { class: 'card lvcard' },
    h('div', { class: 'lv-badge num' }, fa(lv.level)),
    h('div', { class: 'lv-mid' }, h('div', { class: 'lv-t' }, h('b', null, lv.name), h('small', { class: 'num' }, `XP ${fa(lv.into)}/${fa(lv.need)}`)),
      h('div', { class: 'xpbar' }, h('i', { style: { width: '0%' }, 'data-w': `${Math.max(4, lv.pct * 100)}%` }))));
  root.append(lvCard);
  requestAnimationFrame(() => requestAnimationFrame(() => lvCard.querySelectorAll('.xpbar i').forEach((i) => { i.style.width = i.dataset.w; })));

  // ---- week streak dots
  const days = lastDays(7);
  root.append(h('div', { class: 'card weekdots' }, h('div', { class: 'wd-row' }, days.map((d, i) => {
    const dt = new Date(d.k + 'T12:00:00');
    return h('div', { class: 'wd' + (d.r ? ' on' : '') + (i === 6 ? ' today' : '') },
      h('span', { class: 'dot', html: d.r ? ic('flame') : '' }), h('small', null, WD[dt.getDay()]));
  })), h('div', { class: 'wk-l' }, st >= 2 ? t('{0} روز پشت‌سرهم 🔥', fa(st)) : t('هر روز چند کارت مرور کن تا زنجیره بسازی'))));

  // ---- stats
  const statEls = [];
  const mk = (n, label, icon, color) => { const b = h('b', { class: 'num' }, fa(0)); statEls.push([b, n]); return h('div', { class: `card stat s-${color}` }, h('div', { class: 'si', html: ic(icon) }), b, h('div', { class: 'sl' }, label)); };
  root.append(h('div', { class: 'stats' }, mk(S.vocab.size, t('واژگان'), 'book', 'indigo'), mk(today, t('مرور امروز'), 'zap', 'amber'), mk(S.marks.size, t('مارک'), 'bookmark', 'rose')));
  statEls.forEach(([el, n]) => countUp(el, n, { fmt: fa }));

  // ---- continue
  const last = [...S.progress.values()].filter((p) => p.pos > 3 && p.dur && p.pos < p.dur - 5).sort((a, b) => (b.t || 0) - (a.t || 0))[0];
  if (last && S.lessonMap.has(last.id)) {
    const l = S.lessonMap.get(last.id);
    root.append(h('div', { class: 'card cont', onclick: () => nav('p-' + l.id) },
      h('div', { class: 'thumb', html: ic('play') }),
      h('div', { class: 'txt' }, h('small', null, t('ادامه تماشا')), h('b', null, l.title), h('div', { class: 'prog' }, h('i', { style: { width: `${(last.pos / last.dur) * 100}%` } }))),
      h('span', { class: 'pill acc num' }, fmtTime(last.pos))));
  }

  // ---- course tabs
  root.append(h('div', { class: 'courses' }, S.courses.map((co) => {
    const ls = S.lessons.filter((l) => l.course === co.id);
    const done = ls.filter((l) => lessonProgress(l.id) > 0.9).length;
    return h('button', { class: `course c-${co.color}` + (co.id === courseId ? ' on' : ''), onclick: () => { courseId = co.id; root.replaceChildren(); renderHome(root, nav); } },
      h('span', { class: 'ce' }, co.emoji), h('b', null, co.name), h('small', { class: 'num' }, t('{0} از {1}', fa(done), fa(ls.length))));
  })));

  const course = S.courses.find((x) => x.id === courseId);
  const groups = course.groups || [{ title: '', kind: null }];
  const lessons = S.lessons.filter((l) => l.course === courseId);
  const vCount = {}; S.vocab.forEach((v) => { if (v.ctx && v.ctx.lesson) vCount[v.ctx.lesson] = (vCount[v.ctx.lesson] || 0) + 1; });
  const mCount = {}; S.marks.forEach((m) => { mCount[m.lesson] = (mCount[m.lesson] || 0) + 1; });
  const wrap = h('div', { class: `lessons c-${course.color}` });
  if (course.id === 'mine') {
    wrap.append(h('button', { class: 'card addclip', onclick: () => openAddClip({ onDone: () => { root.replaceChildren(); renderHome(root, nav); } }) },
      h('span', { class: 'plus' }, '+'), h('div', null, h('b', null, t('افزودن کلیپ خودم')), h('small', null, t('ویدیو + زیرنویس (SRT / VTT / ASS) · هر زبانی، مثلاً انگلیسی')))));
    if (!lessons.length) wrap.append(h('div', { class: 'empty' }, h('div', { class: 'mascot-big', html: mascot('think', 110) }), h('b', null, t('هنوز کلیپی اضافه نکرده‌ای')), t('فیلم، سریال یا ویدیوی یوتیوب با زیرنویس؛ اینجا مثل درس‌های آلمانی کار می‌کند.')));
  }
  groups.forEach((g) => {
    const ls = lessons.filter((l) => !g.kind || l.kind === g.kind);
    if (!ls.length) return;
    if (g.title) wrap.append(h('div', { class: 'sect-t' }, g.title));
    ls.forEach((l) => {
      const p = lessonProgress(l.id);
      const has = Videos.has(l.id);
      wrap.append(h('div', { class: 'card lesson' + (p > 0.9 ? ' done' : p > 0.02 ? ' part' : ''), onclick: () => nav('p-' + l.id) },
        h('div', { class: 'no num' }, p > 0.9 ? h('span', { html: ic('check') }) : fa(l.n), h('span', { class: 'vstat' + (has ? ' ok' : ''), title: has ? t('ویدیو آماده') : t('ویدیو اضافه نشده') })),
        h('div', { class: 'mid' }, h('b', null, l.title), h('small', null, l.sub || ''),
          h('div', { class: 'meta' },
            has ? null : h('span', { class: 'pill warn' }, t('بدون ویدیو')),
            vCount[l.id] ? h('span', { class: 'pill acc' }, t('{0} واژه', fa(vCount[l.id]))) : null,
            mCount[l.id] ? h('span', { class: 'pill' }, t('{0} مارک', fa(mCount[l.id]))) : null),
          p > 0.02 && p <= 0.9 ? h('div', { class: 'prog' }, h('i', { style: { width: `${p * 100}%` } })) : null),
        l.custom ? h('button', { class: 'icon-btn sm', html: ic('trash'), 'aria-label': t('حذف'), onclick: async (e) => { e.stopPropagation(); if (await confirmSheet({ title: t('حذف کلیپ'), text: t('«{0}» و ویدیویش از اپ حذف شود؟ (واژه‌ها می‌مانند)', l.title), okText: t('حذف'), danger: true })) { await Videos.remove(l.id).catch(() => {}); await deleteCustomLesson(l.id); root.replaceChildren(); renderHome(root, nav); } } }) : h('span', { class: 'go', html: ic('chev') })));
    });
  });
  root.append(wrap);
}
const stat = (n, l, icon, color) => h('div', { class: `card stat s-${color}` }, h('span', { class: 'si', html: ic(icon) }), h('b', { class: 'num' }, n), h('span', { class: 'sl' }, l));
function lastCourse() {
  const p = [...S.progress.values()].sort((a, b) => (b.t || 0) - (a.t || 0))[0];
  const l = p && S.lessonMap.get(p.id);
  return l ? l.course : null;
}
