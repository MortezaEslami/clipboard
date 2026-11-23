import { t, locale } from './i18n.js';
import { S, saveSettings, vocabLevel, loadGlossary, lookup } from './state.js';
import { h, fa, dayKey, norm, openSheet, toast } from './util.js';
import { isProperNoun } from './names.js';

// rough vocabulary size (lemmas) at the end of each CEFR level
export const LEVEL_WORDS = { A1: 650, A2: 1300, B1: 2400 };
const DEF_GOALS = [{ lv: 'A2', date: '2026-12-31' }, { lv: 'B1', date: '2027-03-31' }];
const MAX_NEW_CARDS = 60;

const lemmaKey = (w) => { const g = lookup(w); return norm(g && g.lemma ? g.lemma : w); };
const endOf = (iso) => new Date(iso + 'T23:59:59').getTime();
const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(locale + '-u-ca-gregory', { day: 'numeric', month: 'long' });

// known = "I know it" words + flashcards that are at least "young"; learning = the rest of the flashcards
export function wordStats() {
  const known = new Set(), learning = new Set(), todayNew = new Set(); const tk = dayKey();
  for (const [w, ts] of Object.entries(S.settings.known || {})) {
    const k = lemmaKey(w); if (!k || isProperNoun(k)) continue; known.add(k);
    if (dayKey(new Date(ts)) === tk) todayNew.add(k);
  }
  S.vocab.forEach((v) => {
    const k = norm(v.de); if (!k) return;
    const fromLesson = !!(v.ctx && v.ctx.lesson);
    if (isProperNoun(k) && !fromLesson) return;  // a name you added yourself, not learned from a lesson
    (vocabLevel(v) >= 2 ? known : learning).add(k);
    if (v.created && dayKey(new Date(v.created)) === tk) todayNew.add(k);
  });
  known.forEach((k) => learning.delete(k));
  return { known: known.size, learning: learning.size, today: todayNew.size };
}

// the first goal not reached yet (or the last one, when all are reached)
export function activeGoal(st = wordStats()) {
  const gs = (S.settings.goals || []).filter((g) => g && g.lv && g.date && LEVEL_WORDS[g.lv]);
  if (!gs.length) return null;
  const g = gs.find((x) => st.known < LEVEL_WORDS[x.lv]) || gs[gs.length - 1];
  const target = LEVEL_WORDS[g.lv];
  const daysLeft = Math.max(1, Math.ceil((endOf(g.date) - Date.now()) / 864e5));
  const remaining = Math.max(0, target - st.known - st.learning);
  const need = remaining ? Math.ceil(remaining / daysLeft) : 0;
  return { ...g, target, daysLeft, need, done: st.known >= target, over: Date.now() > endOf(g.date) };
}

// keep "new cards per day" in step with the goal (each word = one card per enabled card kind)
function autoNewPerDay(goal) {
  if (!goal || S.settings.goalAuto === false) return;
  const kinds = Math.max(1, Object.values(S.settings.kinds || {}).filter(Boolean).length);
  const want = Math.min(MAX_NEW_CARDS, Math.max(5, goal.need * kinds));
  if (S.settings.newPerDay !== want) { S.settings.newPerDay = want; saveSettings(); }
}

// home-screen card; fills itself in once the glossary is loaded
export function goalCard(refresh) {
  const slot = h('div');
  loadGlossary().catch(() => {}).then(() => {
    if (!slot.isConnected && !slot.parentNode) return;
    const st = wordStats(); const g = activeGoal(st);
    if (!g) {
      if (S.settings.goalHidden) return;
      slot.replaceChildren(h('div', { class: 'card cont goal', onclick: () => openGoalSheet(refresh) },
        h('div', { class: 'thumb' }, '🎯'),
        h('div', { class: 'txt' }, h('b', null, t('هدف سطح بگذار')), h('small', { class: 'rec-s' }, t('مثلاً A2 تا آخر دسامبر؛ اپ می‌گوید هر روز چند واژهٔ تازه لازم است'))),
        h('span', { class: 'pill acc' }, '›')));
      return;
    }
    autoNewPerDay(g);
    const pct = Math.min(1, st.known / g.target);
    const line = g.done ? t('رسیدی! 🎉')
      : g.over ? t('تاریخ هدف گذشته؛ یک تاریخ تازه بگذار')
      : t('امروز {0} از {1} واژهٔ تازه', fa(st.today), fa(g.need));
    slot.replaceChildren(h('div', { class: 'card cont goal' + (st.today >= g.need ? ' ok' : ''), onclick: () => openGoalSheet(refresh) },
      h('div', { class: 'thumb' }, '🎯'),
      h('div', { class: 'txt' },
        h('small', null, t('هدف {0} تا {1} · {2} روز مانده', g.lv, fmtDate(g.date), fa(g.daysLeft))),
        h('b', { class: 'num' }, t('{0} از {1} واژه', fa(st.known), fa(g.target)) + (st.learning ? ' · ' + t('{0} در حال یادگیری', fa(st.learning)) : '')),
        h('div', { class: 'prog' }, h('i', { style: { width: `${Math.max(2, pct * 100)}%` } })),
        h('small', { class: 'rec-s' }, line)),
      h('span', { class: 'pill acc num' }, fa(Math.round(pct * 100)) + '٪')));
  });
  return slot;
}

// rough current-level estimate from vocabulary size alone (no grammar)
const BOUNDS = [['A1', 0], ['A2', LEVEL_WORDS.A1], ['B1', LEVEL_WORDS.A2], ['B2', LEVEL_WORDS.B1]];
export function cefrEstimate(st = wordStats()) {
  const known = st.known;
  let cur = BOUNDS[0], next = BOUNDS[1];
  for (let i = 0; i < BOUNDS.length - 1; i++) {
    if (known < BOUNDS[i + 1][1]) { cur = BOUNDS[i]; next = BOUNDS[i + 1]; break; }
    cur = BOUNDS[i + 1]; next = BOUNDS[i + 2] || null;
  }
  const into = known - cur[1];
  const need = next ? next[1] - cur[1] : null;
  return { lv: cur[0], next: next ? next[0] : null, into, need, known };
}

// home-screen badge: rough current level from vocabulary size, links to the known-words list
export function levelCard(nav) {
  const slot = h('div');
  loadGlossary().catch(() => {}).then(() => {
    if (!slot.isConnected && !slot.parentNode) return;
    const st = wordStats(); const est = cefrEstimate(st);
    const label = est.next ? t('سطح تقریبی {0} · {1} واژه تا {2}', est.lv, fa(Math.max(0, est.need - est.into)), est.next) : t('سطح تقریبی {0}+', est.lv);
    slot.replaceChildren(h('div', { class: 'card cont lvest', onclick: () => nav('known') },
      h('div', { class: 'thumb' }, '📈'),
      h('div', { class: 'txt' }, h('small', null, t('بر اساس {0} واژه‌ای که بلدی', fa(st.known))), h('b', null, label)),
      h('span', { class: 'pill acc' }, '›')));
  });
  return slot;
}

export function openGoalSheet(onDone) {
  const cur = S.settings.goals && S.settings.goals.length ? S.settings.goals : DEF_GOALS;
  const dateOf = (lv) => (cur.find((g) => g.lv === lv) || {}).date || '';
  const inp = (lv) => h('input', { class: 'input', type: 'date', value: dateOf(lv), style: { minHeight: '40px', maxWidth: '170px' } });
  const a2 = inp('A2'), b1 = inp('B1');
  const auto = h('input', { type: 'checkbox', checked: S.settings.goalAuto !== false });
  const st = wordStats();
  const r = (lbl, small, ctl) => h('div', { class: 'setrow' }, h('div', { class: 'l' }, h('span', null, lbl), small ? h('small', null, small) : null), ctl);
  const finish = () => { onDone && onDone(); };
  const sh = openSheet({ title: '🎯 ' + t('هدف سطح'), body: [
    h('p', { style: { margin: '0 0 10px', color: 'var(--ink2)' } }, t('الان حدود {0} واژه بلدی و {1} واژه در حال یادگیری است.', fa(st.known), fa(st.learning))),
    r(t('پایان A2'), t('حدود {0} واژه', fa(LEVEL_WORDS.A2)), a2),
    r(t('پایان B1'), t('حدود {0} واژه', fa(LEVEL_WORDS.B1)), b1),
    r(t('تنظیم خودکار کارت‌های جدید'), t('تعداد کارت جدید روزانه را با هدف هماهنگ می‌کند'), auto),
    h('p', { style: { margin: '10px 0 0', fontSize: '12.5px', color: 'var(--muted)' } }, t('عددها تخمینی‌اند و فقط واژه را می‌سنجند، نه گرامر.'))],
  actions: h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
    h('button', { class: 'btn', onclick: () => {
      const goals = [['A2', a2.value], ['B1', b1.value]].filter(([, d]) => d).map(([lv, date]) => ({ lv, date }));
      S.settings.goals = goals; S.settings.goalAuto = auto.checked; S.settings.goalHidden = !goals.length; saveSettings();
      toast(goals.length ? t('هدف ذخیره شد ✓') : t('هدف برداشته شد')); sh.close(); finish();
    } }, t('ذخیره')),
    h('button', { class: 'btn sec', onclick: () => { S.settings.goals = []; S.settings.goalHidden = true; saveSettings(); sh.close(); finish(); } }, t('بدون هدف'))) });
}
