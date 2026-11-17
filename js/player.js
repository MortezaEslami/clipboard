import { t } from './i18n.js';
import { S, MARKS, loadCues, loadGlossary, lookup as lookupDE, findVocab, addVocab, saveVocab, deleteVocab, setMark, removeMark, markId, saveProgress, saveSettings, KINDS, vocabLevel } from './state.js';
import { confetti, sfx, buzz } from './fx.js';
import * as Videos from './videos.js';
import { h, ic, icon, fmtTime, tokenize, norm, openSheet, toast, speak, fa, confirmSheet, LANG_NAMES } from './util.js';

const SPEEDS = [0.6, 0.75, 0.9, 1, 1.25];
const MODES = [
  { id: 'de', label: t('آلمانی') },
  { id: 'de-fa', label: t('آلمانی + فارسی') },
  { id: 'de-en', label: t('آلمانی + English') },
  { id: 'none', label: t('بدون زیرنویس') },
  { id: 'orig', label: t('زیرنویس اصلی ویدیو'), maskOnly: true },
];
const SEC_RE = /^(lektion\s+\w+,?\s*)?(aufgabe|modul|übung|ubung)\b/i;

export async function renderPlayer(root, lessonId, opts = {}) {
  const lesson = S.lessonMap.get(lessonId);
  const course = S.courses.find((c) => c.id === lesson.course);
  const lang = lesson.lang || 'de';
  const LN = LANG_NAMES[lang] || lang;
  const lookup = (w) => (lang === 'de' ? lookupDE(w) : null);
  const [cues] = await Promise.all([loadCues(lessonId), loadGlossary()]);
  let mode = S.settings.subMode;
  if (mode === 'orig' && !course.mask) mode = 'de-fa';
  let repeat = opts.loop ? 'loop' : S.settings.repeatMode;
  let cur = -1, handled = -1, playing = false, raf = 0, lastSave = 0, userScroll = 0, dur = 0;
  const known = new Map();   // normalised word -> SRS level (0 new, 1 learning, 2 young, 3 mature)
  const refreshKnown = () => { known.clear(); S.vocab.forEach((v) => { const l = vocabLevel(v); known.set(norm(v.de), l); known.set(norm(v.form), l); }); };
  refreshKnown();

  // ---------- DOM
  const video = h('video', { playsinline: '', preload: 'metadata', 'webkit-playsinline': '' });
  const mask = h('div', { class: 'mask' });
  const ovl = h('div', { class: 'ovl' });
  const bigPlay = h('div', { class: 'big', html: ic('play') });
  const tap = h('div', { class: 'tap', onclick: () => togglePlay() }, bigPlay);
  const fsBtn = h('button', { class: 'fs', onclick: (e) => { e.stopPropagation(); toggleFs(); }, html: ic('full'), 'aria-label': t('تمام‌صفحه') });
  const novideo = h('div', { class: 'novideo' });
  const vbox = h('div', { class: 'vbox paused' }, video, mask, ovl, tap, fsBtn, novideo);
  const stage = h('div', { class: 'pl-stage' }, vbox);

  const seek = h('input', { type: 'range', class: 'seek', min: 0, max: 100, step: 0.05, value: 0, 'aria-label': t('زمان') });
  const tmCur = h('span', { class: 'tm' }, '0:00');
  const tmDur = h('span', { class: 'tm' }, '0:00');

  const playBtn = h('button', { class: 'icon-btn play', onclick: () => togglePlay(), 'aria-label': t('پخش') });
  const speedBtn = h('button', { class: 'tg', onclick: cycleSpeed, 'aria-label': t('سرعت') });
  const repBtn = h('button', { class: 'tg', onclick: cycleRepeat, 'aria-label': t('تکرار') });
  const ctl = h('div', { class: 'pl-ctl' },
    speedBtn,
    h('button', { class: 'icon-btn', onclick: () => gotoCue(cur - 1), html: ic('prev'), 'aria-label': t('جمله قبل') }),
    h('button', { class: 'icon-btn', onclick: replayCue, html: ic('replay'), 'aria-label': t('پخش دوباره جمله') }),
    playBtn,
    h('button', { class: 'icon-btn', onclick: () => gotoCue(cur + 1), html: ic('next'), 'aria-label': t('جمله بعد') }),
    repBtn);

  const chips = h('div', { class: 'chips pl-modes' }, MODES.filter((m) => (!m.maskOnly || course.mask) && !(lang === 'en' && m.id === 'de-en')).map((m) => ({ ...m, label: m.label.replace(t('آلمانی'), LN) })).map((m) =>
    h('button', { class: 'chip', dataset: { m: m.id }, onclick: () => setMode(m.id) }, m.label)));

  const nowDe = h('div', { class: 'n-de de' });
  const nowTr = h('div', { class: 'n-tr' });
  const peekBtn = h('button', { class: 'icon-btn sm', onclick: peek, html: ic('eye'), 'aria-label': t('نگاه سریع') });
  const nowMark = h('button', { class: 'icon-btn sm', onclick: () => cur >= 0 && openMarkSheet(cur), html: ic('bookmark'), 'aria-label': t('مارک') });
  const now = h('div', { class: 'pl-now' }, h('div', { class: 'n-body' }, nowDe, nowTr), h('div', { class: 'n-act' }, peekBtn, nowMark));

  const list = h('div', { class: 'pl-list' });
  const rowEls = [], trEls = [], noteEls = [], mkEls = [];
  cues.forEach((c, i) => {
    const sec = SEC_RE.test(c.de.trim());
    const tr = h('div', { class: 't-tr' });
    const note = h('div', { class: 'note' });
    const mk = h('button', { class: 'mk', html: ic('bookmark'), 'aria-label': t('مارک') });
    const row = h('div', { class: 'row' + (sec ? ' sec' : ''), dataset: { i } },
      h('div', { class: 'tm' }, fmtTime(c.s)),
      h('div', { class: 'bd' }, h('div', { class: 't-de de' }, wordsNode(c.de)), tr, note),
      sec ? null : mk);
    rowEls.push(row); trEls.push(tr); noteEls.push(note); mkEls.push(mk);
    list.append(row);
  });

  const topbar = h('div', { class: 'pl-top' },
    h('button', { class: 'icon-btn', onclick: () => opts.nav('home'), html: ic('back'), 'aria-label': t('بازگشت') }),
    h('div', { class: 'ttl' }, h('b', null, lesson.title), h('small', null, lesson.sub || '')),
    h('button', { class: 'icon-btn', onclick: openMore, html: ic('more'), 'aria-label': t('بیشتر') }));

  const player = h('div', { class: 'player' }, topbar, stage,
    h('div', { class: 'pl-bar' }, tmCur, seek, tmDur), ctl, chips, now, list);
  root.append(player);

  // ---------- helpers
  function wordsNode(text) {
    const frag = document.createDocumentFragment();
    tokenize(text).forEach((tk) => {
      if (!tk.w) { frag.append(document.createTextNode(tk.t)); return; }
      const hit = lookup(tk.t);
      const kl = known.has(norm(tk.t)) ? known.get(norm(tk.t)) : (hit && known.has(norm(hit.lemma)) ? known.get(norm(hit.lemma)) : -1);
      frag.append(h('span', { class: 'w' + (kl >= 0 ? ' known lv' + kl : ''), dataset: { w: tk.t } }, tk.t));
    });
    return frag;
  }
  function trFor(c) {
    if (mode === 'de-fa') return c.fa ? { text: c.fa, cls: 'fa' } : c.en ? { text: c.en, cls: 'en' } : null;
    if (mode === 'de-en') return c.en ? { text: c.en, cls: 'en' } : null;
    return null;
  }
  function findCue(t) {
    let lo = 0, hi = cues.length - 1, r = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (cues[m].s <= t + 0.04) { r = m; lo = m + 1; } else hi = m - 1; }
    return r;
  }
  function paintRowTr(i) {
    const t = trFor(cues[i]); const el = trEls[i];
    el.textContent = t ? t.text : '';
    el.className = 't-tr ' + (t ? t.cls : '');
  }
  function paintRowMark(i) {
    const m = S.marks.get(markId(lessonId, i));
    const row = rowEls[i];
    row.classList.toggle('marked', !!m);
    ['yellow', 'blue', 'green', 'red'].forEach((c) => row.classList.remove('c-' + c));
    if (m) row.classList.add('c-' + m.color);
    noteEls[i].replaceChildren();
    if (m && m.note) noteEls[i].append(h('span', { html: ic('note') }), m.note);
    mkEls[i].innerHTML = ic('bookmark');
    const svg = mkEls[i].firstChild; if (svg && m) { svg.style.fill = 'currentColor'; }
  }
  function renderNow() {
    nowDe.replaceChildren(); nowTr.replaceChildren();
    if (cur < 0) { nowDe.append(h('span', { class: 'hint fa', style: { fontFamily: 'var(--f-fa)' } }, t('پخش را شروع کن یا روی یک جمله بزن'))); renderOvl(); return; }
    const c = cues[cur];
    nowDe.append(wordsNode(c.de));
    const t = trFor(c);
    if (t) { nowTr.textContent = t.text; nowTr.className = 'n-tr ' + t.cls; }
    const m = S.marks.get(markId(lessonId, cur));
    nowMark.style.color = m ? `var(--m-${m.color})` : '';
    renderOvl();
  }
  function renderOvl() {
    ovl.replaceChildren(); ovl.className = 'ovl';
    if (cur < 0 || mode === 'none' || mode === 'orig') return;
    const c = cues[cur]; const t = trFor(c);
    ovl.append(h('div', { class: 'o-de de' }, c.de));
    if (t) ovl.append(h('div', { class: 'o-tr ' + t.cls }, t.text));
    ovl.classList.add('has');
    if (course.mask) { ovl.style.height = `${(1 - S.settings.maskTop) * 100}%`; ovl.style.top = 'auto'; }
    else { ovl.classList.add('plain'); ovl.style.height = ''; }
  }
  function applyMask() {
    const on = course.mask && mode !== 'orig';
    player.classList.toggle('masked', !!on);
    mask.style.height = `${(1 - S.settings.maskTop) * 100 + 0.4}%`;
    renderOvl();
  }
  function setMode(m) {
    mode = m; S.settings.subMode = m; saveSettings();
    player.dataset.mode = m;
    chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.m === m));
    cues.forEach((_, i) => paintRowTr(i));
    applyMask(); renderNow();
  }
  function setCur(i, scroll = true) {
    if (i === cur) return;
    if (cur >= 0) rowEls[cur].classList.remove('cur');
    cur = i;
    if (cur >= 0) {
      rowEls[cur].classList.add('cur');
      if (scroll && performance.now() - userScroll > 3500) {
        const top = rowEls[cur].offsetTop - list.clientHeight / 2 + rowEls[cur].clientHeight / 2;
        list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
    }
    now.classList.remove('stale');
    renderNow();
  }
  function updateTimeUi(t) {
    seek.value = t;
    seek.style.setProperty('--p', dur ? `${(t / dur) * 100}%` : '0%');
    tmCur.textContent = fmtTime(t);
  }
  function updateButtons() {
    playBtn.innerHTML = ic(playing ? 'pause' : 'play');
    vbox.classList.toggle('paused', !playing);
    speedBtn.textContent = `${video.playbackRate || S.settings.speed}×`;
    repBtn.innerHTML = ic(repeat === 'loop' ? 'loop1' : repeat === 'pause' ? 'pausebar' : 'repeat');
    repBtn.classList.toggle('on', repeat !== 'off');
    repBtn.title = repeat === 'loop' ? t('تکرار جمله') : repeat === 'pause' ? t('توقف آخر هر جمله') : t('پخش عادی');
  }

  // ---------- playback
  function hasVideo() { return !!video.getAttribute('src'); }
  function togglePlay() {
    if (!hasVideo()) return;
    if (video.paused) video.play().catch(() => {}); else video.pause();
  }
  function seekTo(t, play = true) {
    if (!hasVideo()) return;
    video.currentTime = Math.max(0, t);
    if (play) video.play().catch(() => {});
    handled = -1;
  }
  function gotoCue(i) {
    i = Math.max(0, Math.min(cues.length - 1, i < 0 ? 0 : i));
    if (hasVideo()) { seekTo(cues[i].s - 0.05, true); setCur(i); } else { setCur(i); speak(cues[i].de, 0.85, lang); }
  }
  function replayCue() {
    const i = cur >= 0 ? cur : 0;
    if (hasVideo()) { seekTo(cues[i].s - 0.05, true); setCur(i); } else speak(cues[i].de, 0.85, lang);
  }
  function cycleSpeed() {
    const i = SPEEDS.indexOf(video.playbackRate || 1);
    const n = SPEEDS[(i + 1) % SPEEDS.length];
    video.playbackRate = n; S.settings.speed = n; saveSettings(); updateButtons();
  }
  function cycleRepeat() {
    repeat = repeat === 'off' ? 'pause' : repeat === 'pause' ? 'loop' : 'off';
    S.settings.repeatMode = repeat; saveSettings(); updateButtons();
    toast(repeat === 'loop' ? t('تکرار جمله روشن شد') : repeat === 'pause' ? t('ویدیو آخر هر جمله می‌ایستد') : t('پخش عادی'));
  }
  function peek() {
    player.classList.add('peek');
    clearTimeout(peek.t); peek.t = setTimeout(() => player.classList.remove('peek'), 4500);
  }
  function tick() {
    const t = video.currentTime;
    const i = findCue(t);
    if (i !== cur) { setCur(i); if (repeat === 'pause') handled = -1; }
    if (i >= 0) {
      const c = cues[i];
      if (repeat === 'loop' && t >= c.e - 0.03 && !video.paused) { video.currentTime = Math.max(0, c.s - 0.02); }
      else if (repeat === 'pause' && t >= c.e - 0.03 && handled !== i && !video.paused) { handled = i; video.pause(); }
      now.classList.toggle('stale', t > c.e + 1.2);
    }
    updateTimeUi(t);
    if (performance.now() - lastSave > 4000) { lastSave = performance.now(); saveProgress(lessonId, t, dur); }
    if (!video.paused) raf = requestAnimationFrame(tick);
  }
  video.addEventListener('play', () => { playing = true; updateButtons(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
  video.addEventListener('pause', () => { playing = false; updateButtons(); saveProgress(lessonId, video.currentTime, dur); });
  video.addEventListener('ended', () => { playing = false; updateButtons(); saveProgress(lessonId, dur, dur); });
  video.addEventListener('seeked', () => { if (video.paused) tick(); });
  video.addEventListener('timeupdate', () => { if (video.paused) tick(); });
  video.addEventListener('loadedmetadata', () => {
    dur = video.duration || lesson.dur || 0;
    seek.max = dur; tmDur.textContent = fmtTime(dur);
    video.playbackRate = S.settings.speed;
    const p = S.progress.get(lessonId);
    const start = opts.startAt != null ? Math.max(0, opts.startAt - 0.1) : (p && p.pos && p.pos < dur - 3 ? p.pos : 0);
    if (start) video.currentTime = start;
    if (opts.startAt != null) video.play().catch(() => {});
    updateButtons(); tick();
  });
  video.addEventListener('error', () => {
    showNoVideo(t('این ویدیو روی این دستگاه پخش نشد'), t('فرمت یا کدک پشتیبانی نمی‌شود. فایل mp4 (H.264) را انتخاب کن.'), true);
  });
  seek.addEventListener('input', () => { video.currentTime = +seek.value; handled = -1; updateTimeUi(+seek.value); });
  list.addEventListener('touchstart', () => { userScroll = performance.now(); }, { passive: true });
  list.addEventListener('wheel', () => { userScroll = performance.now(); }, { passive: true });

  function toggleFs() {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    const p = (stage.requestFullscreen || stage.webkitRequestFullscreen || (() => Promise.reject())).call(stage);
    Promise.resolve(p).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignore */ } }).catch(() => {});
  }
  const onFs = () => { if (!document.fullscreenElement) { try { screen.orientation.unlock(); } catch (e) { /* ignore */ } } };
  document.addEventListener('fullscreenchange', onFs);

  // ---------- video source
  function showNoVideo(title, sub, retry) {
    novideo.style.display = 'flex'; novideo.replaceChildren(
      h('div', { html: ic('film'), style: { fontSize: '30px', opacity: .8 } }),
      h('b', null, title), h('small', null, sub),
      h('button', { class: 'btn sm', onclick: pickFile }, retry ? t('انتخاب فایل دیگر') : t('انتخاب فایل ویدیو')));
  }
  async function attach() {
    if (Videos.has(lessonId)) {
      const url = await Videos.getURL(lessonId);
      if (url) { novideo.style.display = 'none'; video.src = url; return; }
    }
    showNoVideo(t('ویدیوی این درس هنوز اضافه نشده'), t('فایل را یک‌بار انتخاب کن تا برای همیشه (و آفلاین) در اپ بماند.'), false);
  }
  function pickFile() {
    const inp = h('input', { type: 'file', accept: 'video/*,.mkv,.mp4,.webm,.mov', style: { display: 'none' } });
    inp.addEventListener('change', async () => {
      const f = inp.files[0]; if (!f) return;
      novideo.replaceChildren(h('b', null, t('در حال افزودن ویدیو…')), h('div', { class: 'copybar', style: { width: '70%' } }, h('i', { id: 'cp' })));
      try {
        await Videos.save(lessonId, f, (p) => { const el = novideo.querySelector('#cp'); if (el) el.style.width = `${Math.round(p * 100)}%`; });
        await attach();
      } catch (e) { showNoVideo(t('ذخیره ویدیو انجام نشد'), t('فضای دستگاه کافی نیست یا مرورگر اجازه نداد.'), true); }
    });
    document.body.append(inp); inp.click(); setTimeout(() => inp.remove(), 60000);
  }

  // ---------- sheets
  function openMarkSheet(i) {
    const c = cues[i];
    const ex = S.marks.get(markId(lessonId, i));
    let color = ex ? ex.color : 'yellow';
    const note = h('textarea', { class: 'input', placeholder: t('یادداشت (اختیاری)') }, ex ? ex.note : '');
    const pick = h('div', { class: 'colorpick' }, MARKS.map((m) => h('button', {
      class: `c-${m.id}` + (m.id === color ? ' on' : ''), onclick: (e) => {
        color = m.id; pick.querySelectorAll('button').forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on');
      },
    }, h('span', { class: `dot c-${m.id}` }), m.name)));
    const s = openSheet({
      title: t('مارک جمله'),
      body: [h('div', { class: 'sent' }, h('div', { class: 's-de de' }, c.de), c.fa || c.en ? h('div', { class: 's-tr ' + (c.fa ? 'fa' : 'en') }, c.fa || c.en) : null), pick, h('div', { class: 'field' }, note)],
      actions: h('div', { style: { display: 'flex', gap: '10px' } },
        ex ? h('button', { class: 'btn danger', onclick: () => { removeMark(lessonId, i); paintRowMark(i); renderNow(); s.close(); } }, t('حذف مارک')) : null,
        h('button', { class: 'btn block', onclick: () => { setMark(lessonId, c, i, color, note.value.trim()); paintRowMark(i); renderNow(); s.close(); toast(t('مارک ذخیره شد')); } }, t('ذخیره'))),
    });
  }

  function openWordSheet(i, word) {
    const c = cues[i];
    const toks = []; let pos = 0;
    tokenize(c.de).forEach((tk) => { if (tk.w) toks.push({ t: tk.t, a: pos, b: pos + tk.t.length }); pos += tk.t.length; });
    let a = toks.findIndex((x) => x.t === word); if (a < 0) a = 0; let b = a;
    const wasPlaying = !video.paused; if (wasPlaying) video.pause();
    const deIn = h('input', { class: 'input de', dir: 'ltr', placeholder: t('لغت یا عبارت') });
    const faIn = h('input', { class: 'input fa', placeholder: t('معنی فارسی') });
    const enIn = h('input', { class: 'input en', dir: 'ltr', placeholder: 'English meaning' });
    const hint = h('div', { style: { fontSize: '12.5px', color: 'var(--muted)', margin: '-8px 0 12px' } });
    let touched = { de: false, fa: false, en: false };
    deIn.addEventListener('input', () => { touched.de = true; });
    faIn.addEventListener('input', () => { touched.fa = true; });
    enIn.addEventListener('input', () => { touched.en = true; });
    const chipsEl = h('div', { class: 'selchips' });
    const saveBtn = h('button', { class: 'btn block' });
    const delBtn = h('button', { class: 'btn danger' }, h('span', { html: ic('trash') }));
    let existing = null;

    function selText() { return c.de.slice(toks[a].a, toks[b].b); }
    function refresh(fromChip) {
      chipsEl.replaceChildren(...toks.map((tk, idx) => h('button', {
        class: 'c' + (idx >= a && idx <= b ? ' on' : ''), onclick: () => {
          if (idx < a) a = idx; else if (idx > b) b = idx;
          else if (idx === a && a < b) a++; else if (idx === b && b > a) b--;
          touched = { de: false, fa: false, en: false }; faIn.value = ''; enIn.value = ''; refresh(true);
        },
      }, tk.t)));
      const text = selText();
      const single = a === b;
      const g = single ? lookup(text) : null;
      if (!touched.de) deIn.value = g && g.lemma ? g.lemma : text;
      existing = findVocab(deIn.value);
      if (existing) { if (!touched.fa) faIn.value = existing.fa; if (!touched.en) enIn.value = existing.en; }
      else if (g) { if (!touched.fa) faIn.value = g.fa || ''; if (!touched.en) enIn.value = g.en || ''; }
      hint.textContent = g && g.lemma && norm(g.lemma) !== norm(text) ? t('در جمله: {0}', text) : '';
      hint.className = 'de';
      hint.style.fontFamily = 'var(--f-de)';
      saveBtn.textContent = existing ? t('به‌روزرسانی لغت') : t('ذخیره در لغت‌ها');
      delBtn.style.display = existing ? '' : 'none';
    }
    deIn.addEventListener('input', () => { existing = findVocab(deIn.value); saveBtn.textContent = existing ? t('به‌روزرسانی لغت') : t('ذخیره در لغت‌ها'); delBtn.style.display = existing ? '' : 'none'; });
    refresh();

    saveBtn.addEventListener('click', () => {
      const de = deIn.value.trim(); if (!de) { toast(t('لغت را وارد کن')); return; }
      const ctx = { lesson: lessonId, lang, i, s: c.s, e: c.e, de: c.de, en: c.en || '', fa: c.fa || '' };
      const ex = findVocab(de);
      if (ex) { ex.fa = faIn.value.trim(); ex.en = enIn.value.trim(); if (!ex.ctx) ex.ctx = ctx; saveVocab(ex); toast(t('لغت به‌روز شد')); }
      else { addVocab({ de, fa: faIn.value, en: enIn.value, form: selText(), ctx }); toast(t('به لغت‌ها اضافه شد ✓ +۳ XP')); sfx('add'); buzz(20); confetti(innerWidth / 2, innerHeight * 0.62, { n: 36, power: .8 }); }
      if (!S.marks.has(markId(lessonId, i))) { setMark(lessonId, c, i, 'yellow', ''); paintRowMark(i); }
      refreshKnown(); repaintWords(); renderNow(); sh.close();
    });
    delBtn.addEventListener('click', async () => {
      const ex = findVocab(deIn.value); if (!ex) return;
      if (await confirmSheet({ title: t('حذف لغت'), text: t('«{0}» و کارت‌هایش حذف شود؟', ex.de), okText: t('حذف'), danger: true })) { deleteVocab(ex.id); refreshKnown(); repaintWords(); toast(t('حذف شد')); sh.close(); }
    });

    const sh = openSheet({
      title: t('افزودن به لغت‌ها'),
      body: [
        h('div', { class: 'sent' }, h('div', { class: 's-de de' }, c.de), c.fa || c.en ? h('div', { class: 's-tr ' + (c.fa ? 'fa' : 'en') }, c.fa || c.en) : null),
        h('div', { style: { fontSize: '12.5px', color: 'var(--muted)', fontWeight: 700, marginBottom: '6px' } }, t('کلمه‌ها را بزن تا عبارت بسازی')),
        chipsEl,
        h('div', { class: 'field' }, h('label', null, LN), h('div', { style: { display: 'flex', gap: '8px' } }, deIn, h('button', { class: 'icon-btn', style: { background: 'var(--bg2)' }, html: ic('vol'), onclick: () => speak(deIn.value || selText(), undefined, lang), 'aria-label': t('تلفظ') }))),
        hint,
        h('div', { class: 'field' }, h('label', null, t('فارسی')), faIn),
        h('div', { class: 'field' }, h('label', null, 'English'), enIn),
      ],
      actions: h('div', { style: { display: 'flex', gap: '10px' } }, delBtn, saveBtn),
      onClose: () => { if (wasPlaying) video.play().catch(() => {}); },
    });
  }
  function repaintWords() {
    refreshKnown();
    list.querySelectorAll('.t-de').forEach((el, i) => { el.replaceChildren(wordsNode(cues[i].de)); });
  }

  function openMore() {
    const body = [];
    if (course.mask) {
      const val = h('span', { class: 'num' }, fa(t('{0}٪', Math.round(S.settings.maskTop * 100))));
      const rng = h('input', { type: 'range', min: 66, max: 86, step: 0.5, value: S.settings.maskTop * 100, class: 'seek', style: { width: '100%' } });
      rng.addEventListener('input', () => { S.settings.maskTop = rng.value / 100; val.textContent = fa(Math.round(rng.value)) + t('٪'); applyMask(); });
      rng.addEventListener('change', saveSettings);
      body.push(h('div', { class: 'field' }, h('label', null, t('ارتفاع نوار پوششی زیرنویس سوخته')), rng, h('div', { class: 'note-box' }, t('اگر پایین تصویر هنوز بخشی از زیرنویس اصلی پیداست، نوار را بالاتر ببر.') + ' ', val)));
    }
    body.push(h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
      h('button', { class: 'btn sec', onclick: () => { sh.close(); pickFile(); } }, t('تعویض فایل ویدیو')),
      Videos.has(lessonId) ? h('button', { class: 'btn danger', onclick: async () => { if (await confirmSheet({ title: t('حذف ویدیو'), text: t('فایل این درس از حافظه اپ پاک شود؟ (لغت‌ها و مارک‌ها می‌مانند)'), okText: t('حذف'), danger: true })) { await Videos.remove(lessonId); video.removeAttribute('src'); video.load(); attach(); sh.close(); } } }, t('حذف ویدیو از اپ')) : null));
    const sh = openSheet({ title: t('تنظیمات پلیر'), body });
  }

  // ---------- events
  list.addEventListener('click', (e) => {
    const w = e.target.closest('.w');
    const row = e.target.closest('.row'); if (!row) return;
    const i = +row.dataset.i;
    if (w) { setCur(i, false); openWordSheet(i, w.dataset.w); return; }
    if (e.target.closest('.mk')) { openMarkSheet(i); return; }
    gotoCue(i);
  });
  now.addEventListener('click', (e) => {
    const w = e.target.closest('.w');
    if (w && cur >= 0) openWordSheet(cur, w.dataset.w);
  });
  const onKey = (e) => {
    if (e.target.matches('input,textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowLeft') gotoCue(cur - 1);
    else if (e.key === 'ArrowRight') gotoCue(cur + 1);
    else if (e.key === 'r') replayCue();
  };
  document.addEventListener('keydown', onKey);

  // ---------- init
  document.body.classList.add('noTabs');
  setMode(mode);
  cues.forEach((_, i) => paintRowMark(i));
  updateButtons(); renderNow();
  await attach();
  if (opts.startAt != null) { const i = findCue(opts.startAt); if (i >= 0) { setCur(i); } }

  return function cleanup() {
    cancelAnimationFrame(raf);
    try { saveProgress(lessonId, video.currentTime || 0, dur); } catch (e) { /* ignore */ }
    video.pause(); video.removeAttribute('src'); video.load();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('fullscreenchange', onFs);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    document.body.classList.remove('noTabs');
  };
}
