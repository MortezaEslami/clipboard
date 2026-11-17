import { t } from './i18n.js';
import { S, vocabLevel, gainXP } from './state.js';
import { h, ic, fa } from './util.js';
import { mascot, confetti, sfx, buzz } from './fx.js';

const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const meaning = (v) => { const m = S.settings.meaning || 'fa'; return (m === 'en' ? v.en || v.fa : v.fa || v.en) || ''; };

export function renderGame(root, nav) {
  const pool = [...S.vocab.values()].filter((v) => v.de && meaning(v));
  const head = h('div', { class: 'page-h' }, h('div', null, h('h1', null, '🎮 ' + t('بازی جفت‌یابی')), h('div', { class: 'sub' }, t('واژه‌ها را به معنی‌شان وصل کن'))));
  root.append(head);
  if (pool.length < 3) {
    root.append(h('div', { class: 'empty' }, h('div', { class: 'mascot-big', html: mascot('sleep', 96) }), h('b', null, t('برای بازی حداقل ۳ واژه با معنی لازم است')),
      h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: () => nav('home') }, t('بازگشت به خانه')))));
    return;
  }
  // weaker words first, then random
  const order = shuffle(pool).sort((a, b) => vocabLevel(a) - vocabLevel(b) + (Math.random() - .5));
  const ROUNDS = Math.min(3, Math.ceil(order.length / 6)); let round = 0, mistakes = 0; const t0 = Date.now();
  const board = h('div', { class: 'mg-board' }); const info = h('div', { class: 'mg-info' });
  root.append(info, board);

  function start() {
    const words = order.slice(round * 6, round * 6 + 6); const fill = words.length < 3 ? shuffle(order).slice(0, 4) : words;
    let left = null, right = null, done = 0;
    info.textContent = t('دور {0} از {1}', fa(round + 1), fa(ROUNDS)) + ' · ' + t('اشتباه: {0}', fa(mistakes));
    const L = shuffle(fill).map((v) => h('button', { class: 'mg-card de', dataset: { id: v.id } }, v.de));
    const R = shuffle(fill).map((v) => h('button', { class: 'mg-card fa', dataset: { id: v.id } }, meaning(v)));
    const pick = (btn, side) => {
      if (btn.classList.contains('ok')) return; sfx('tap');
      const cur = side === 'l' ? left : right;
      if (cur) cur.classList.remove('sel');
      if (side === 'l') left = cur === btn ? null : btn; else right = cur === btn ? null : btn;
      const me = side === 'l' ? left : right; if (me) me.classList.add('sel');
      if (left && right) {
        if (left.dataset.id === right.dataset.id) {
          [left, right].forEach((b) => { b.classList.remove('sel'); b.classList.add('ok'); }); sfx('good'); buzz(15); done++;
          left = right = null;
          if (done === fill.length) setTimeout(next, 650);
        } else {
          const a = left, b = right; mistakes++; sfx('again'); buzz(40);
          [a, b].forEach((x) => { x.classList.add('bad'); x.classList.remove('sel'); setTimeout(() => x.classList.remove('bad'), 420); });
          left = right = null;
          info.textContent = t('دور {0} از {1}', fa(round + 1), fa(ROUNDS)) + ' · ' + t('اشتباه: {0}', fa(mistakes));
        }
      }
    };
    L.forEach((b) => b.addEventListener('click', () => pick(b, 'l'))); R.forEach((b) => b.addEventListener('click', () => pick(b, 'r')));
    board.replaceChildren(h('div', { class: 'mg-col' }, L), h('div', { class: 'mg-col' }, R));
  }
  function next() { round++; if (round < ROUNDS) start(); else finish(); }
  function finish() {
    const secs = Math.round((Date.now() - t0) / 1000); const xp = Math.max(3, 8 + ROUNDS * 3 - mistakes); gainXP(xp);
    sfx('done'); confetti(innerWidth / 2, innerHeight * 0.45, { n: 90 });
    info.replaceChildren(); board.replaceChildren(h('div', { class: 'empty mg-end' },
      h('div', { class: 'mascot-big', html: mascot('cheer', 110) }), h('b', null, t('آفرین! بازی تمام شد')),
      h('div', { class: 'sub' }, t('{0} اشتباه · {1} ثانیه', fa(mistakes), fa(secs)) + ` · +${fa(xp)} XP`),
      h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px' } },
        h('button', { class: 'btn', onclick: () => { round = 0; mistakes = 0; start(); } }, t('دوباره بازی')),
        h('button', { class: 'btn sec', onclick: () => nav('home') }, t('بازگشت به خانه')))));
  }
  start();
}
