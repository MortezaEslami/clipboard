import { t } from './i18n.js';
import { S, KINDS, XP, buildQueue, answerCard, counts, levelInfo, streak } from './state.js';
import { mascot, confetti, rain, sfx, buzz, floatText, countUp } from './fx.js';
import * as Videos from './videos.js';
import { preview } from './fsrs.js';
import { h, ic, fa, fmtIvl, norm, speak, tokenize, toast, vlang } from './util.js';

const RATE = [null, t('دوباره'), t('سخت'), t('خوب'), t('آسان')];

export async function renderReview(root, { lesson = null, nav } = {}) {
  document.body.classList.add('noTabs');
  let queue = buildQueue({ lesson });
  const total = queue.length;
  let done = 0, again = 0, combo = 0, bestCombo = 0, sessionXP = 0, cleanup = () => {};
  const startLevel = levelInfo().level;
  const t0 = Date.now();
  const wrap = h('div', { class: 'rv' });
  root.append(wrap);
  const mean = () => S.settings.meaningLang;

  if (!total) { wrap.append(topbar(0, 0), h('div', { class: 'rv-body' }, emptyState())); return () => document.body.classList.remove('noTabs'); }
  next();

  function topbar(d, tot) {
    return h('div', { class: 'rv-top' },
      h('button', { class: 'icon-btn', onclick: () => nav('home'), html: ic('x'), 'aria-label': t('بستن') }),
      h('div', { class: 'bar' }, h('i', { style: { width: tot ? `${(d / tot) * 100}%` : '0%' } })),
      h('div', { class: 'cnt num' }, combo >= 3 ? h('span', { class: 'combo' }, '🔥×' + fa(combo)) : null, tot ? t('{0} مانده', fa(queue.length)) : ''));
  }
  function emptyState() {
    const c = counts();
    return h('div', { class: 'empty', style: { margin: 'auto' } }, h('div', { class: 'mascot-big', html: mascot(lesson ? 'think' : 'cheer', 120) }),
      h('b', null, lesson ? t('کارتی برای این درس نیست') : t('برای الان کارتی نمانده! 🎉')),
      c.fresh ? h('div', null, t('{0} کارت جدید هم هست', fa(c.fresh))) : h('div', null, t('از داخل ویدیو روی کلمه‌ها بزن تا لغت اضافه شود.')),
      h('div', { style: { marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' } },
        c.fresh && !lesson ? h('button', { class: 'btn sec', onclick: () => { queue = buildQueue({ extraNew: true }); wrap.replaceChildren(); if (queue.length) { next(); } } }, t('کارت جدید بیشتر')) : null,
        h('button', { class: 'btn', onclick: () => nav('home') }, t('برگشت'))));
  }

  function next() {
    cleanup();
    if (!queue.length) { finish(); return; }
    const id = queue[0];
    const card = S.cards.get(id);
    const v = card && S.vocab.get(card.vid);
    if (!card || !v) { queue.shift(); next(); return; }
    show(card, v);
  }

  function finish() {
    const lv = levelInfo();
    const acc = done ? Math.round(((done - again) / done) * 100) : 100;
    const mins = Math.max(1, Math.round((Date.now() - t0) / 60000));
    const xpEl = h('b', { class: 'num' }, fa(0));
    const levelUp = lv.level > startLevel;
    wrap.replaceChildren(topbar(1, 1), h('div', { class: 'rv-body' }, h('div', { class: 'rv-done' },
      h('div', { class: 'mascot-big', html: mascot('cheer', 140) }),
      h('h2', null, levelUp ? t('سطح {0}: {1} 🎊', fa(lv.level), lv.name) : t('مرور تمام شد!')),
      h('p', { style: { color: 'var(--muted)', margin: '2px 0 14px' } }, again ? t('{0} بار «دوباره» داشتی؛ طبیعی است، همین‌ها را بهتر یاد می‌گیری', fa(again)) : t('بی‌نقص بود، حتی یک بار هم «دوباره» نزدی!')),
      h('div', { class: 'res-grid' },
        h('div', { class: 'res xp' }, xpEl, h('small', null, t('XP امروز'))),
        h('div', { class: 'res ok' }, h('b', { class: 'num' }, fa(acc) + t('٪')), h('small', null, t('دقت'))),
        h('div', { class: 'res cards' }, h('b', { class: 'num' }, fa(done)), h('small', null, t('کارت'))),
        h('div', { class: 'res fire' }, h('b', { class: 'num' }, fa(bestCombo)), h('small', null, t('بهترین ردیف')))),
      streak() ? h('div', { class: 'streak-note' }, t('🔥 {0} روز پشت‌سرهم', fa(streak()))) : null,
      h('button', { class: 'btn block', style: { marginTop: '18px' }, onclick: () => nav('home') }, t('برگشت')))));
    countUp(xpEl, sessionXP, { fmt: (v) => '+' + fa(v) });
    setTimeout(() => { confetti(innerWidth / 2, innerHeight * 0.4, { n: 120, spread: 1.6, power: 1.3 }); rain(1400); sfx(levelUp ? 'level' : 'done'); buzz(40); }, 150);
  }

  function meanings(v) {
    const m = mean(); const out = [];
    if ((m === 'fa' || m === 'both') && v.fa) out.push(h('div', { class: 'rv-mean fa' }, v.fa));
    if ((m === 'en' || m === 'both') && v.en) out.push(h('div', { class: 'rv-mean en' }, v.en));
    if (!out.length) { if (v.fa) out.push(h('div', { class: 'rv-mean fa' }, v.fa)); if (v.en) out.push(h('div', { class: 'rv-mean en' }, v.en)); }
    if (!out.length) out.push(h('div', { class: 'rv-tr' }, t('(معنی ثبت نشده)')));
    return out;
  }
  function sentenceNode(v, { blank = false, hl = true } = {}) {
    const c = v.ctx; if (!c || !c.de) return null;
    const form = norm(v.form), de = norm(v.de);
    const el = h('div', { class: 'rv-sent' });
    const formWords = form.split(' ').filter(Boolean);
    const toks = tokenize(c.de);
    // mark the (possibly multi-word) form inside the sentence
    const wordIdx = toks.map((t, i) => (t.w ? i : -1)).filter((i) => i >= 0);
    let startW = -1;
    for (let k = 0; k + formWords.length <= wordIdx.length; k++) {
      if (formWords.every((fw, j) => norm(toks[wordIdx[k + j]].t) === fw)) { startW = k; break; }
    }
    if (startW < 0) { const single = wordIdx.findIndex((i) => norm(toks[i].t) === de); if (single >= 0) { startW = single; formWords.length = 1; } }
    if (startW < 0) { el.append(c.de); return el; }
    const a = wordIdx[startW], b = wordIdx[startW + formWords.length - 1];
    toks.forEach((t, i) => {
      if (i === a) {
        const txt = toks.slice(a, b + 1).map((x) => x.t).join('');
        el.append(blank ? h('span', { class: 'blank', style: { minWidth: `${Math.max(2.5, txt.length * 0.62)}em` } }, txt) : (hl ? h('mark', null, txt) : txt));
      } else if (i < a || i > b) el.append(t.t);
    });
    return el;
  }
  function transNode(v) {
    const c = v.ctx; if (!c) return null;
    const tx = mean() === 'en' ? c.en || c.fa : c.fa || c.en;
    return tx ? h('div', { class: 'rv-tr ' + (c.fa && tx === c.fa ? 'fa' : 'en') }, tx) : null;
  }

  async function clipNode(v, autoplay) {
    const c = v.ctx;
    if (!c || !c.lesson || !Videos.has(c.lesson)) return h('div', { class: 'rv-clip noclip' }, h('div', null, h('div', { html: ic('film') }), h('small', null, t('ویدیوی این درس در اپ نیست'))));
    const course = S.courses.find((x) => x.id === S.lessonMap.get(c.lesson).course);
    const url = await Videos.getURL(c.lesson);
    const video = h('video', { playsinline: '', preload: 'auto', src: url });
    const mk = course && course.mask ? h('div', { class: 'mask', style: { height: `${(1 - S.settings.maskTop) * 100 + 0.4}%` } }) : null;
    const rp = h('button', { class: 'replay', onclick: play, html: ic('replay'), 'aria-label': t('پخش دوباره') });
    const box = h('div', { class: 'rv-clip' }, video, mk, rp);
    let stopAt = 0;
    function play() {
      rp.style.opacity = 0;
      video.currentTime = Math.max(0, c.s - 0.15); stopAt = c.e + 0.25;
      video.play().catch(() => { rp.style.opacity = 1; });
    }
    video.addEventListener('timeupdate', () => { if (stopAt && video.currentTime >= stopAt) { video.pause(); stopAt = 0; rp.style.opacity = 1; } });
    video.addEventListener('loadedmetadata', () => { video.currentTime = Math.max(0, c.s - 0.15); if (autoplay && S.settings.autoplayClip) play(); else rp.style.opacity = 1; });
    video.addEventListener('pause', () => { rp.style.opacity = 1; });
    box.playClip = play;
    return box;
  }

  async function show(card, v) {
    const kind = card.kind;
    const body = h('div', { class: 'rv-card card' });
    const foot = h('div', { class: 'rv-foot' });
    wrap.replaceChildren(topbar(done, total), h('div', { class: 'rv-body' }, body), foot);
    body.append(h('div', { class: 'rv-kind' }, h('span', { class: 'pill acc' }, KINDS[kind].name), card.state === 0 ? h('span', { class: 'pill ok' }, t('جدید')) : card.state !== 2 ? h('span', { class: 'pill warn' }, t('در حال یادگیری')) : null));
    let revealed = false;
    let clipBox = null;
    const typed = S.settings.typing && kind !== 'de2m';
    let typedOk = null;


    // ---- front
    if (kind === 'de2m') {
      body.append(h('div', { class: 'rv-word' }, v.de),
        h('div', { class: 'rv-actions' }, h('button', { class: 'btn sec sm', onclick: () => speak(v.de, undefined, vlang(v)), html: ic('vol') + ' ' + t('تلفظ') })));
      const s = sentenceNode(v); if (s) body.append(s);
    } else if (kind === 'm2de') {
      body.append(...meanings(v));
    } else {
      clipBox = await clipNode(v, true);
      body.append(clipBox);
      const s = sentenceNode(v, { blank: true }); if (s) body.append(s);
      const tn = transNode(v); if (tn) body.append(tn);
      if (!clipBox.playClip) body.append(h('div', { class: 'rv-actions' }, h('button', { class: 'btn sec sm', onclick: () => speak(v.ctx.de.replace(v.form, '…'), undefined, vlang(v)), html: ic('vol') + ' ' + t('بشنو') })));
    }

    // ---- typing
    let inp = null;
    if (typed) {
      inp = h('input', { class: 'input', placeholder: t('تایپ کن…'), autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false', dir: 'ltr' });
      const box = h('div', { class: 'rv-type' }, inp, h('button', { class: 'btn', onclick: () => reveal(), html: ic('check') }));
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') reveal(); });
      body.append(box); setTimeout(() => inp.focus({ preventScroll: true }), 50);
      body._typebox = box;
    }

    const showBtn = h('button', { class: 'btn block', onclick: () => reveal() }, t('نمایش پاسخ'));
    foot.append(showBtn);

    function reveal() {
      if (revealed) return; revealed = true;
      if (typed && inp) {
        const ok = norm(inp.value) === norm(v.de) || norm(inp.value) === norm(v.form);
        typedOk = ok; body._typebox.classList.add(ok ? 'ok' : 'bad'); inp.disabled = true;
      }
      body.append(h('div', { class: 'hr' }));
      const extra = [];
      if (kind === 'de2m') { extra.push(...meanings(v)); const tn = transNode(v); if (tn) extra.push(tn); }
      else if (kind === 'm2de') { extra.push(h('div', { class: 'rv-word' }, v.de), h('div', { class: 'rv-actions' }, h('button', { class: 'btn sec sm', onclick: () => speak(v.de, undefined, vlang(v)), html: ic('vol') + ' ' + t('تلفظ') }))); const s = sentenceNode(v); if (s) extra.push(s); const tn = transNode(v); if (tn) extra.push(tn); }
      else { extra.push(h('div', { class: 'rv-word', style: { fontSize: '30px' } }, v.de)); extra.push(...meanings(v)); const s = sentenceNode(v); if (s) extra.push(s); const tn = transNode(v); if (tn) extra.push(tn); }
      // for clip card replace blanked sentence
      if (kind === 'clip') body.querySelectorAll('.rv-sent').forEach((e) => e.remove());
      body.append(...extra);
      if (kind === 'de2m' && S.settings.autoplayClip && v.ctx && v.ctx.lesson && Videos.has(v.ctx.lesson)) {
        clipNode(v, true).then((cb) => { clipBox = cb; body.append(cb); });
      }
      const pv = preview(card, Date.now(), S.settings.retention);
      foot.replaceChildren(h('div', { class: 'rates' }, [1, 2, 3, 4].map((g) => h('button', { class: `rate r${g}`, onclick: (e) => rate(g, e) }, RATE[g], h('small', null, fmtIvl(pv[g]))))));
      body.parentElement.scrollTo({ top: 1e5, behavior: 'smooth' });
    }

    let locked = false;
    function rate(g, e) {
      if (locked) return; locked = true;
      const id = card.id;
      queue.shift();
      const n = answerCard(id, g);
      done++; if (g === 1) again++;
      // ---- feedback
      const r = e && e.currentTarget ? e.currentTarget.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight - 90, width: 0 };
      const cx = r.left + r.width / 2, cy = r.top;
      let gain = XP[g];
      if (g === 1) { combo = 0; sfx('again'); buzz([30, 40, 30]); body.classList.add('shake'); }
      else { combo++; bestCombo = Math.max(bestCombo, combo); if (combo >= 5 && combo % 5 === 0) gain += 3; sfx(g === 4 ? 'easy' : g === 3 ? 'good' : 'hard'); buzz(15);
        confetti(cx, cy, { n: g === 4 ? 46 : g === 3 ? 28 : 12, power: g === 4 ? 1 : .7 });
        body.classList.add('pop'); }
      sessionXP += gain;
      floatText('+' + fa(gain) + ' XP', cx, cy - 20, g === 1 ? 'dim' : '');
      if (combo && combo % 5 === 0) floatText('🔥 ×' + fa(combo), innerWidth / 2, 120, 'combo');
      setTimeout(() => proceed(g, id, n), g === 1 ? 360 : 300);
    }
    function proceed(g, id, n) {
      // learning cards come back in this session when due soon
      if (n && n.state !== 2 && n.due - Date.now() < 20 * 60000) {
        const pos = queue.findIndex((q) => (S.cards.get(q) || {}).due > n.due);
        const wait = Math.max(0, n.due - Date.now());
        const insertAt = pos < 0 ? queue.length : pos;
        queue.splice(g === 1 ? Math.min(3, queue.length) : insertAt, 0, id); total_inc(wait);
      }
      next();
    }
    function total_inc() { /* keep progress bar based on distinct cards */ }
    cleanup = () => { const vid = wrap.querySelector('video'); if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); } };
  }

  return () => { cleanup(); document.body.classList.remove('noTabs'); };
}
