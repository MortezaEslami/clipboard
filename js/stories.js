import { t, lang, locale } from './i18n.js';
import { S, loadGlossary, lookup, findVocab, addVocab, saveVocab, gainXP, addWatch, flushDays, saveSettings } from './state.js';
import { h, ic, fa, norm, tokenize, openSheet, toast, speak } from './util.js';
import { mascot, confetti, sfx, buzz } from './fx.js';

let CACHE = null;
export async function loadStories() {
  if (!CACHE) { try { CACHE = await (await fetch('data/stories.json')).json(); } catch (e) { CACHE = []; } }
  return CACHE;
}
const tr = (o) => (lang === 'fa' ? o.fa : lang === 'de' ? o.de : o.en) || o.en;
const trText = (o) => { const m = S.settings.meaning || 'fa'; return (m === 'en' ? o.en : o.fa) || o.en; };
const done = () => (S.settings.stories = S.settings.stories || {});
const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const grad = (c) => `linear-gradient(135deg,${c.split(',')[0]},${c.split(',')[1]})`;

export async function renderStoryList(root, nav) {
  const list = await loadStories();
  const nDone = list.filter((x) => done()[x.id]).length;
  root.append(h('div', { class: 'page-h' }, h('div', null, h('h1', null, '📖 ' + t('داستان‌ها')),
    h('div', { class: 'sub' }, t('داستان‌های ساده و جذاب سطح A1 · {0} از {1} خوانده شد', fa(nDone), fa(list.length))))));
  root.append(h('div', { class: 'story-grid' }, list.map((st, i) => {
    const d = done()[st.id];
    return h('button', { class: 'story-card', style: { background: grad(st.color), '--i': i }, onclick: () => nav('story/' + st.id) },
      h('span', { class: 'sc-emoji' }, st.emoji),
      h('span', { class: 'sc-body' }, h('b', { class: 'de' }, st.title.de), h('small', null, lang === 'de' ? '' : tr(st.title))),
      h('span', { class: 'sc-meta' }, h('i', null, 'A1'), h('i', null, t('{0} جمله', fa(st.s.length))), d ? h('i', { class: 'ok' }, '✓ ' + fa(d.score) + '/' + fa(st.q.length)) : null));
  })));
}

export async function renderStory(root, nav, id) {
  const [list] = await Promise.all([loadStories(), loadGlossary && loadGlossary()]);
  const st = list.find((x) => x.id === id);
  if (!st) { nav('stories'); return; }
  let showTr = localStorage.getItem('lc-story-tr') !== '0'; let reading = null; let stopAll = false;
  const known = () => { const m = new Set(); S.vocab.forEach((v) => m.add(norm(v.de))); return m; };
  const body = h('div', { class: 'story-body' });
  const titleDe = h('h1', { class: 'de' }, st.emoji + ' ' + st.title.de);
  const trBtn = h('button', { class: 'icon-btn sm' + (showTr ? ' on' : ''), 'aria-label': t('ترجمه'), html: '<span style="font-size:16px">🌐</span>', onclick: () => { showTr = !showTr; localStorage.setItem('lc-story-tr', showTr ? '1' : '0'); trBtn.classList.toggle('on', showTr); body.classList.toggle('hide-tr', !showTr); } });
  const listenBtn = h('button', { class: 'btn sm', onclick: toggleListen }, h('span', { html: ic('vol') }), ' ', t('گوش دادن به داستان'));
  const top = h('div', { class: 'story-top' }, h('button', { class: 'icon-btn', html: ic('back'), onclick: () => { stopAll = true; speechSynthesis.cancel(); nav('stories'); } }),
    h('div', { class: 'grow' }), listenBtn, trBtn);
  body.classList.toggle('hide-tr', !showTr);
  const rows = st.s.map((c, i) => {
    const de = h('div', { class: 'ss-de de' });
    const fill = () => { const k = known(); de.replaceChildren(...tokenize(c.de).map((tk) => tk.w ? h('span', { class: 'w' + (k.has(norm(tk.t)) ? ' known' : ''), onclick: () => openWord(tk.t, c) }, tk.t) : tk.t)); };
    fill();
    const row = h('div', { class: 'ss', style: { '--i': i } }, h('button', { class: 'ss-play', html: ic('vol'), 'aria-label': t('گوش بده'), onclick: () => { stopAll = true; speak(c.de, 0.85, 'de'); mark(i); } }), h('div', { class: 'ss-txt' }, de, h('div', { class: 'ss-tr fa' }, trText(c))));
    row._fill = fill; return row;
  });
  body.append(...rows);
  const quizBox = h('div', { class: 'story-quiz' });
  root.append(top, h('div', { class: 'story-head' }, titleDe, h('small', null, lang === 'de' ? '' : tr(st.title))), body, quizBox);
  quizBox.append(h('button', { class: 'btn block', onclick: startQuiz }, '🧠 ' + t('آزمون درک مطلب')));

  const mark = (i) => { rows.forEach((r, j) => r.classList.toggle('now', j === i)); rows[i].scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  function toggleListen() {
    if (reading) { stopAll = true; reading = null; speechSynthesis.cancel(); listenBtn.classList.remove('on'); rows.forEach((r) => r.classList.remove('now')); return; }
    stopAll = false; reading = true; listenBtn.classList.add('on'); let i = 0;
    const next = () => { if (stopAll || i >= st.s.length) { reading = null; listenBtn.classList.remove('on'); rows.forEach((r) => r.classList.remove('now')); return; } mark(i); speak(st.s[i].de, 0.82, 'de', () => { i++; setTimeout(next, 250); }); };
    next();
  }
  function openWord(word, c) {
    stopAll = true; speak(word, 0.8, 'de');
    const g = lookup(word); const lemma = g && g.lemma ? g.lemma : word;
    const ex = findVocab(lemma);
    const faIn = h('input', { class: 'input fa', placeholder: t('معنی فارسی'), value: ex ? ex.fa : (g && g.fa) || '' });
    const enIn = h('input', { class: 'input en', dir: 'ltr', placeholder: 'English meaning', value: ex ? ex.en : (g && g.en) || '' });
    const save = h('button', { class: 'btn block' }, ex ? t('به‌روزرسانی واژه') : t('ذخیره در واژه‌ها'));
    const sh = openSheet({ title: lemma, body: [h('div', { class: 'sent' }, h('div', { class: 's-de de' }, c.de), h('div', { class: 's-tr fa' }, trText(c))),
      h('div', { class: 'field' }, h('label', null, t('فارسی')), faIn), h('div', { class: 'field' }, h('label', null, 'English'), enIn)], actions: save });
    save.addEventListener('click', () => {
      if (ex) { ex.fa = faIn.value.trim(); ex.en = enIn.value.trim(); saveVocab(ex); toast(t('واژه به‌روز شد')); }
      else { addVocab({ de: lemma, fa: faIn.value, en: enIn.value, form: word }); toast(t('به واژه‌هایت اضافه شد ✓ +۳ XP')); sfx('add'); buzz(20); confetti(innerWidth / 2, innerHeight * 0.62, { n: 30, power: .8 }); }
      rows.forEach((r) => r._fill()); sh.close();
    });
  }
  function startQuiz() {
    stopAll = true; speechSynthesis.cancel(); let qi = 0, score = 0;
    const qs = st.q.map((q) => ({ ...q, opts: shuffle(q.o), right: q.o[q.a] }));
    function show() {
      const q = qs[qi]; let answered = false;
      const opts = q.opts.map((o) => h('button', { class: 'qz-opt de', onclick: () => {
        if (answered) return; answered = true;
        const ok = o === q.right; if (ok) score++;
        sfx(ok ? 'good' : 'again'); buzz(ok ? 15 : 40);
        opts.forEach((b) => { if (b.textContent === q.right) b.classList.add('ok'); else if (b === btnOf(o)) b.classList.add('bad'); });
        setTimeout(() => { qi++; qi < qs.length ? show() : finish(); }, 900);
      } }, o));
      const btnOf = (o) => opts.find((b) => b.textContent === o);
      quizBox.replaceChildren(h('div', { class: 'qz-n' }, t('پرسش {0} از {1}', fa(qi + 1), fa(qs.length))), h('div', { class: 'qz-q de' }, q.q.de), lang === 'de' ? null : h('div', { class: 'qz-qt fa' }, tr(q.q)), h('div', { class: 'qz-opts' }, opts));
      quizBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function finish() {
      const first = !done()[st.id]; const best = Math.max(score, (done()[st.id] || {}).score || 0);
      done()[st.id] = { t: Date.now(), score: best, n: qs.length }; saveSettings();
      const xp = (first ? 10 : 3) + score * 2; gainXP(xp); sfx('done'); confetti(innerWidth / 2, innerHeight * 0.5, { n: score === qs.length ? 110 : 50 });
      quizBox.replaceChildren(h('div', { class: 'empty' }, h('div', { class: 'mascot-big', html: mascot(score === qs.length ? 'cheer' : 'happy', 100) }),
        h('b', null, t('آفرین! {0} از {1} درست', fa(score), fa(qs.length))), h('div', { class: 'sub' }, `+${fa(xp)} XP`),
        h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '14px' } }, h('button', { class: 'btn', onclick: startQuiz }, t('دوباره')), h('button', { class: 'btn sec', onclick: () => nav('stories') }, t('داستان‌های دیگر')))));
    }
    show();
  }
  const timer = setInterval(() => { if (!document.hidden) addWatch(1); }, 1000);
  return () => { clearInterval(timer); flushDays(); stopAll = true; try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } };
}
