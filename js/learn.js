import { t } from './i18n.js';
import { S, gainXP, markKnown, unmarkKnown, knownMap } from './state.js';
import { h, ic, fa, norm, tokenize, openSheet, toast, speak } from './util.js';
import { mascot, confetti, sfx, buzz } from './fx.js';
import { corpus, knownSet, meaningOf, saveWord, marked } from './corpus.js';

const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const seen = () => (S.settings.testSeen = S.settings.testSeen || {});
const trOf = (ex) => (S.settings.meaning === 'en' ? ex.en : ex.fa) || ex.fa || ex.en || '';

function header(title, sub) { return h('div', { class: 'page-h' }, h('div', null, h('h1', null, title), h('div', { class: 'sub' }, sub))); }
function emptyBox(nav, msg) { return h('div', { class: 'empty' }, h('div', { class: 'mascot-big', html: mascot('sleep', 96) }), h('b', null, msg), h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: () => nav('home') }, t('بازگشت به خانه')))); }

// ------------------------------------------------------------------ quick word test
export async function renderWordTest(root, nav) {
  root.append(header('⚡ ' + t('تست سریع واژه‌ها'), t('واژه‌های پرتکرار را ببین؛ فقط بگو بلدی یا نه')));
  const box = h('div', { class: 'dict' }, h('div', { class: 'occ-n' }, t('در حال آماده‌سازی…'))); root.append(box);
  const C = await corpus(); const kn = knownSet();
  const pool = C.list.filter((e) => !kn.has(e.k) && !seen()[e.k] && e.ex && e.k.length >= 2).slice(0, 20);
  if (!pool.length) { box.replaceChildren(emptyBox(nav, t('واژهٔ تازه‌ای برای تست نمانده'))); return; }
  let idx = 0, yes = 0;
  function show() {
    if (idx >= pool.length) return end();
    const e = pool[idx]; let answered = false;
    const meaning = h('div', { class: 'wt-mean', style: { visibility: 'hidden' } }, meaningOf(e.w) || '—');
    const tr = h('div', { class: 's-tr ' + (S.settings.meaning === 'en' ? 'en' : 'fa'), style: { visibility: 'hidden' } }, trOf(e.ex));
    const actions = h('div', { class: 'wt-act' });
    const next = () => { idx++; show(); };
    const reveal = () => { meaning.style.visibility = ''; tr.style.visibility = ''; };
    const yesB = h('button', { class: 'btn wt-yes', onclick: () => { if (answered) return; answered = true; markKnown([e.w]); seen()[e.k] = Date.now(); yes++; sfx('good'); buzz(15); setTimeout(next, 150); } }, '✓ ' + t('بلدم'));
    const noB = h('button', { class: 'btn wt-no', onclick: () => {
      if (answered) return; answered = true; seen()[e.k] = Date.now(); sfx('again'); reveal();
      actions.replaceChildren(
        h('button', { class: 'btn sec', onclick: () => { if (saveWord(e)) { toast(t('به واژه‌هایت اضافه شد ✓ +۳ XP')); sfx('add'); } next(); } }, '📌 ' + t('ذخیره در واژگان')),
        h('button', { class: 'btn', onclick: next }, t('بعدی')));
    } }, '✗ ' + t('نمی‌دانم'));
    actions.append(noB, yesB);
    box.replaceChildren(
      h('div', { class: 'mg-info' }, t('واژه {0} از {1}', fa(idx + 1), fa(pool.length))),
      h('div', { class: 'dict-bar' }, h('i', { style: { width: `${(idx / pool.length) * 100}%` } })),
      h('div', { class: 'wt-card' },
        h('div', { class: 'wt-word de' }, e.w, h('button', { class: 'icon-btn sm', html: ic('vol'), 'aria-label': t('بشنو'), onclick: () => speak(e.w, 0.8, 'de') })),
        meaning,
        h('div', { class: 'wt-ex de' }, ...marked(e.ex.de, e.k)), tr),
      actions);
    speak(e.w, 0.85, 'de');
  }
  function end() {
    const xp = 4 + yes; gainXP(xp); sfx('done'); confetti(innerWidth / 2, innerHeight * 0.45, { n: 70 });
    box.replaceChildren(h('div', { class: 'empty mg-end' }, h('div', { class: 'mascot-big', html: mascot('cheer', 110) }), h('b', null, t('تست تمام شد!')),
      h('div', { class: 'sub' }, t('{0} واژه به فهرست «بلدم» اضافه شد', fa(yes)) + ` · +${fa(xp)} XP`),
      h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' } },
        h('button', { class: 'btn', onclick: () => { root.replaceChildren(); renderWordTest(root, nav); } }, t('دور تازه')),
        h('button', { class: 'btn sec', onclick: () => nav('freq') }, t('واژه‌های پرتکرار')),
        h('button', { class: 'btn sec', onclick: () => nav('home') }, t('بازگشت به خانه')))));
  }
  show();
}

// ------------------------------------------------------------------ frequency list
export async function renderFreq(root, nav) {
  root.append(header('📚 ' + t('واژه‌های پرتکرار'), t('پرکاربردترین واژه‌ها در کلیپ‌ها و داستان‌ها؛ با جمله‌ی نمونه')));
  const box = h('div', { class: 'freq' }, h('div', { class: 'occ-n' }, t('در حال آماده‌سازی…'))); root.append(box);
  const C = await corpus(); const TOP = Math.min(500, C.list.length); const all = C.list.slice(0, TOP);
  let filter = 'todo', shown = 60;
  const bar = h('div', { class: 'dict-bar' }); const stat = h('div', { class: 'mg-info' });
  const chips = h('div', { class: 'chips' }); const list = h('div', { class: 'fq-list' }); const more = h('button', { class: 'btn sec block', onclick: () => { shown += 60; paint(); } }, t('نمایش بیشتر'));
  box.replaceChildren(stat, bar, chips, list, more);
  const isK = (e, kn) => kn.has(e.k);
  function paint() {
    const kn = knownSet(); const nk = all.filter((e) => isK(e, kn)).length;
    stat.textContent = t('{0} از {1} واژهٔ پرتکرار را بلدی', fa(nk), fa(TOP)); bar.replaceChildren(h('i', { style: { width: `${(nk / TOP) * 100}%` } }));
    chips.replaceChildren(...[['todo', t('هنوز نه')], ['known', t('بلدم')], ['all', t('همه')]].map(([k, n]) => h('button', { class: 'chip' + (filter === k ? ' on' : ''), onclick: () => { filter = k; shown = 60; paint(); } }, n)));
    const rows = all.filter((e) => (filter === 'all' ? true : filter === 'known' ? isK(e, kn) : !isK(e, kn)));
    list.replaceChildren(...rows.slice(0, shown).map((e) => {
      const k = isK(e, kn);
      // quick "I know it" button: marks the word without opening the sheet
      const quick = k ? h('span', { class: 'fq-s' }, '✓')
        : h('button', { class: 'fq-k', title: t('بلدم'), 'aria-label': t('بلدم'), onclick: (ev) => { ev.stopPropagation(); markKnown([e.w]); sfx('good'); buzz(15); paint(); } }, '✓');
      return h('div', { class: 'fq-row' + (k ? ' ok' : ''), role: 'button', tabindex: '0', onclick: () => openWord(e), onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openWord(e); } } },
        h('span', { class: 'fq-w de' }, e.w), h('span', { class: 'fq-m' }, meaningOf(e.w) || ''), h('span', { class: 'fq-n num' }, '×' + fa(e.n)), quick);
    }));
    if (!rows.length) list.replaceChildren(h('div', { class: 'occ-n' }, filter === 'todo' ? t('آفرین! همه‌ی واژه‌های پرتکرار را بلدی 🎉') : t('چیزی اینجا نیست')));
    more.style.display = rows.length > shown ? '' : 'none';
  }
  function openWord(e) {
    speak(e.w, 0.85, 'de');
    const k = knownSet().has(e.k); const inVocab = [...S.vocab.values()].some((v) => norm(v.de) === e.k || norm(v.form || '') === e.k);
    const acts = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
    const sh = openSheet({ title: e.w, body: [
      h('div', { class: 'wt-mean' }, meaningOf(e.w) || '—'),
      e.ex ? h('div', { class: 'sent' }, h('div', { class: 's-de de' }, ...marked(e.ex.de, e.k)), trOf(e.ex) ? h('div', { class: 's-tr ' + (S.settings.meaning === 'en' ? 'en' : 'fa') }, trOf(e.ex)) : null) : null,
      h('div', { class: 'occ-n' }, t('{0} بار در کلیپ‌ها و داستان‌ها آمده', fa(e.n)))].filter(Boolean), actions: acts });
    if (!inVocab) acts.append(h('button', { class: 'btn sec', onclick: () => { if (saveWord(e)) { toast(t('به واژه‌هایت اضافه شد ✓ +۳ XP')); sfx('add'); } sh.close(); paint(); } }, '📌 ' + t('ذخیره در واژگان')));
    acts.append(k && !inVocab
      ? h('button', { class: 'btn sec', onclick: () => { unmarkKnown([e.w]); sh.close(); paint(); } }, '✗ ' + t('دیگر بلد نیستم'))
      : !k ? h('button', { class: 'btn', onclick: () => { markKnown([e.w]); sfx('good'); sh.close(); paint(); } }, '✓ ' + t('بلدم')) : null);
    if (e.ex && e.ex.lesson) acts.append(h('button', { class: 'btn sec', onclick: () => { sh.close(); nav('p-' + e.ex.lesson, { startAt: e.ex.s, loop: true }); }, html: ic('film') + ' ' + t('صحنه') }));
  }
  paint();
}

// ------------------------------------------------------------------ cloze (fill the gap)
export async function renderCloze(root, nav) {
  root.append(header('🧩 ' + t('جای‌خالی'), t('کلمه‌ی جاافتاده را از میان گزینه‌ها پیدا کن')));
  const box = h('div', { class: 'dict' }, h('div', { class: 'occ-n' }, t('در حال آماده‌سازی…'))); root.append(box);
  const C = await corpus(); const kn = knownSet();
  const ok = (x) => { const n = tokenize(x.de).filter((w) => w.w).length; return n >= 4 && n <= 10 && !/\d/.test(x.de); };
  const cand = shuffle(C.sents.filter(ok));
  // prefer sentences that contain a word the user is learning (vocab) or knows little about
  const items = []; const used = new Set();
  for (const s of cand) {
    if (items.length >= 10) break;
    if (used.has(norm(s.de))) continue;
    const toks = tokenize(s.de).filter((w) => w.w).filter((w) => w.t.length >= 4);
    if (!toks.length) continue;
    const learning = toks.filter((w) => !kn.has(norm(w.t)) || [...S.vocab.values()].some((v) => norm(v.form || v.de) === norm(w.t)));
    const pick = (learning.length ? learning : toks)[Math.floor(Math.random() * (learning.length || toks.length))];
    const pool = C.list.slice(0, 900).filter((e) => e.k !== norm(pick.t) && Math.abs(e.w.length - pick.t.length) <= 2 && e.n >= 2);
    const opts = shuffle(pool).slice(0, 3).map((e) => e.w);
    if (opts.length < 3) continue;
    used.add(norm(s.de)); items.push({ s, word: pick.t, opts: shuffle([pick.t, ...opts]) });
  }
  if (!items.length) { box.replaceChildren(emptyBox(nav, t('جمله‌ای پیدا نشد'))); return; }
  let idx = 0, score = 0;
  function show() {
    if (idx >= items.length) return end();
    const it = items[idx]; let done = false; let blanked = false;
    const sent = h('div', { class: 'cz-sent de' }, ...tokenize(it.s.de).map((x) => {
      if (!blanked && x.w && x.t === it.word) { blanked = true; return h('span', { class: 'cz-gap' }, '＿＿＿'); } return x.t; }));
    const tr = h('div', { class: 's-tr ' + (S.settings.meaning === 'en' ? 'en' : 'fa') }, trOf(it.s));
    const buttons = it.opts.map((o) => h('button', { class: 'qz-opt de', onclick: () => {
      if (done) return; done = true;
      const good = o === it.word; if (good) score++;
      sfx(good ? 'good' : 'again'); buzz(good ? 15 : 40);
      buttons.forEach((b) => { if (b.textContent === it.word) b.classList.add('ok'); else if (b === btn(o)) b.classList.add('bad'); });
      sent.querySelector('.cz-gap').textContent = it.word; sent.querySelector('.cz-gap').classList.add(good ? 'ok' : 'bad');
      speak(it.s.de, 0.85, 'de');
      nextB.style.display = '';
    } }, o));
    const btn = (o) => buttons.find((b) => b.textContent === o);
    const nextB = h('button', { class: 'btn block', style: { display: 'none', marginTop: '10px' }, onclick: () => { idx++; show(); } }, idx + 1 >= items.length ? t('پایان') : t('بعدی'));
    box.replaceChildren(h('div', { class: 'mg-info' }, t('جمله {0} از {1}', fa(idx + 1), fa(items.length))),
      h('div', { class: 'dict-bar' }, h('i', { style: { width: `${(idx / items.length) * 100}%` } })), sent, tr,
      h('div', { class: 'cz-opts' }, buttons), nextB);
  }
  function end() {
    const xp = 4 + score; gainXP(xp); sfx('done'); confetti(innerWidth / 2, innerHeight * 0.45, { n: score === items.length ? 100 : 50 });
    box.replaceChildren(h('div', { class: 'empty mg-end' }, h('div', { class: 'mascot-big', html: mascot(score >= items.length * 0.7 ? 'cheer' : 'happy', 110) }),
      h('b', null, t('آفرین! {0} از {1} درست', fa(score), fa(items.length))), h('div', { class: 'sub' }, `+${fa(xp)} XP`),
      h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px' } },
        h('button', { class: 'btn', onclick: () => { root.replaceChildren(); renderCloze(root, nav); } }, t('دور تازه')),
        h('button', { class: 'btn sec', onclick: () => nav('home') }, t('بازگشت به خانه')))));
  }
  show();
}
