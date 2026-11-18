import { t } from './i18n.js';
import { S, loadCues, gainXP } from './state.js';
import { h, ic, fa, norm, tokenize, speak } from './util.js';
import { mascot, confetti, sfx, buzz } from './fx.js';

const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const words = (s) => tokenize(s || '').filter((x) => x.w).map((x) => x.t);
const ROUND = 8;

// word-level alignment (longest common subsequence) -> per target word: ok | miss, and extra typed words
export function compare(target, typed) {
  const A = words(target), B = words(typed); const a = A.map(norm), b = B.map(norm);
  const n = a.length, m = b.length; const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) d[i][j] = a[i] === b[j] ? d[i + 1][j + 1] + 1 : Math.max(d[i + 1][j], d[i][j + 1]);
  const ok = new Array(n).fill(false); let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { ok[i] = true; i++; j++; } else if (d[i + 1][j] >= d[i][j + 1]) i++; else j++; }
  return { A, ok, score: n ? ok.filter(Boolean).length / n : 0 };
}

async function pickSentences() {
  const ls = S.lessons.filter((l) => (l.lang || 'de') === 'de');
  const seen = ls.filter((l) => (S.progress.get(l.id) || {}).max > 0);
  const pool = shuffle(seen.length >= 2 ? seen : ls).slice(0, 6);
  const out = []; const dup = new Set();
  for (const l of pool) {
    let cues; try { cues = await loadCues(l.id); } catch (e) { continue; }
    cues.forEach((c, i) => { const n = words(c.de).length; const k = norm(c.de); if (n >= 3 && n <= 10 && !dup.has(k) && !/\d/.test(c.de)) { dup.add(k); out.push({ lesson: l, i, cue: c }); } });
  }
  return shuffle(out).slice(0, ROUND);
}

export async function renderDictation(root, nav) {
  root.append(h('div', { class: 'page-h' }, h('div', null, h('h1', null, '✍️ ' + t('دیکتهٔ شنیداری')), h('div', { class: 'sub' }, t('جمله را بشنو و بنویس؛ هم گوش‌ات قوی می‌شود هم املایت')))));
  const box = h('div', { class: 'dict' }); root.append(box);
  box.append(h('div', { class: 'occ-n' }, t('در حال آماده‌سازی…')));
  const items = await pickSentences();
  if (!items.length) { box.replaceChildren(h('div', { class: 'empty' }, h('div', { class: 'mascot-big', html: mascot('sleep', 96) }), h('b', null, t('جمله‌ای پیدا نشد')), h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: () => nav('home') }, t('بازگشت به خانه'))))); return; }
  const queue = [...items]; let idx = 0, total = 0, sum = 0, retried = new Set(), first = true;

  function show() {
    if (idx >= queue.length) return finish();
    const it = queue[idx]; const c = it.cue; let slow = false; let done = false;
    const say = () => { if (!speak(c.de, slow ? 0.6 : 0.85, 'de')) box.prepend(h('div', { class: 'note-box' }, t('صدای دستگاه برای آلمانی در دسترس نیست'))); };
    const input = h('textarea', { class: 'input de dict-in', dir: 'ltr', rows: 2, placeholder: t('آنچه شنیدی را بنویس…'), autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false' });
    const res = h('div', { class: 'dict-res' });
    const playBtn = h('button', { class: 'btn dict-play', onclick: () => { slow = false; say(); } }, h('span', { html: ic('vol') }), ' ', t('بشنو'));
    const slowBtn = h('button', { class: 'btn sec', onclick: () => { slow = true; say(); } }, '🐢 ' + t('آهسته'));
    const hintBtn = h('button', { class: 'btn sec', onclick: () => { const w = words(c.de); hintBtn.textContent = '💡 ' + w.map((x) => x[0] + '·'.repeat(Math.max(0, x.length - 1))).join(' '); hintBtn.disabled = true; } }, '💡 ' + t('کمک'));
    const check = h('button', { class: 'btn block', onclick: () => { if (done) { idx++; show(); return; } grade(); } }, t('بررسی'));
    function grade() {
      if (!input.value.trim()) { input.focus(); return; }
      done = true; input.readOnly = true;
      const r = compare(c.de, input.value); const pct = Math.round(r.score * 100);
      total++; if (!retried.has(it)) sum += r.score;
      if (pct >= 90) { sfx('good'); buzz(15); } else { sfx('again'); buzz(40); if (!retried.has(it)) { retried.add(it); queue.push(it); } }
      res.replaceChildren(
        h('div', { class: 'dict-score ' + (pct >= 90 ? 'ok' : pct >= 60 ? 'mid' : 'bad') }, pct >= 90 ? '✅ ' : pct >= 60 ? '🙂 ' : '🔁 ', t('{0}٪ درست', fa(pct))),
        h('div', { class: 'dict-ans de' }, ...r.A.flatMap((w, k) => [h('span', { class: r.ok[k] ? 'dw ok' : 'dw miss' }, w), ' '])),
        (c.fa || c.en) ? h('div', { class: 's-tr ' + (c.fa ? 'fa' : 'en') }, c.fa || c.en) : null,
        h('button', { class: 'btn sec sm', style: { marginTop: '8px' }, onclick: () => nav('p-' + it.lesson.id, { startAt: c.s, loop: true }), html: ic('film') + ' ' + t('صحنه') }));
      check.textContent = idx + 1 >= queue.length ? t('پایان') : t('بعدی');
      speak(c.de, 0.85, 'de');
    }
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); check.click(); } });
    box.replaceChildren(
      h('div', { class: 'mg-info' }, t('جمله {0} از {1}', fa(Math.min(idx + 1, queue.length)), fa(queue.length))),
      h('div', { class: 'dict-bar' }, h('i', { style: { width: `${(idx / queue.length) * 100}%` } })),
      h('div', { class: 'dict-btns' }, playBtn, slowBtn, hintBtn), input, res, check);
    setTimeout(() => { say(); first = false; }, 250);
  }
  function finish() {
    const avg = total ? Math.round((sum / Math.min(total, items.length)) * 100) : 0; const xp = Math.max(4, Math.round(items.length * 1.5 * (avg / 100)) + 4); gainXP(xp);
    sfx('done'); confetti(innerWidth / 2, innerHeight * 0.45, { n: 80 });
    box.replaceChildren(h('div', { class: 'empty mg-end' }, h('div', { class: 'mascot-big', html: mascot('cheer', 110) }), h('b', null, t('دیکته تمام شد!')),
      h('div', { class: 'sub' }, t('میانگین {0}٪', fa(avg)) + ` · +${fa(xp)} XP`),
      h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px' } },
        h('button', { class: 'btn', onclick: () => { root.replaceChildren(); renderDictation(root, nav); } }, t('دور تازه')),
        h('button', { class: 'btn sec', onclick: () => nav('home') }, t('بازگشت به خانه')))));
  }
  show();
}
