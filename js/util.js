import { t, lang } from './i18n.js';
// Small helpers shared by all views
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) return c.forEach(add);
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

const P = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  cards: '<rect x="3" y="6" width="14" height="14" rx="3"/><path d="M7 3h11a3 3 0 0 1 3 3v11"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 12h5"/>',
  bookmark: '<path d="M6 3h12v18l-6-4.5L6 21z"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  play: '<path d="M7 4.5v15l13-7.5z"/>',
  pause: '<rect x="6" y="4.5" width="4.2" height="15" rx="1.2"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2"/>',
  prev: '<path d="M6 5v14"/><path d="M19 5.5v13L9 12z"/>',
  next: '<path d="M18 5v14"/><path d="M5 5.5v13L15 12z"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V10a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  replay: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  back: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  chev: '<path d="m15 6-6 6 6 6"/>',
  vol: '<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 9a4 4 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  flame: '<path d="M12 2c.8 3.6 5 5.2 5 10.2a5 5 0 0 1-10 0c0-2 .9-3.2 2-4.2.1 1.8.9 2.7 2 3 .3-3.6-.4-6 1-9z"/>',
  down: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
  up: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M4 3h16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 4v16M16 4v16M3 9h5M16 9h5M3 15h5M16 15h5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  list: '<path d="M5 6h14M5 12h14M5 18h9"/>',
  note: '<path d="M5 4h14v12l-5 5H5z"/><path d="M14 21v-5h5"/>',
  pausebar: '<rect x="5" y="4" width="3" height="16" rx="1"/><path d="m11 5 8 7-8 7z"/>',
  loop1: '<path d="m17 2 4 4-4 4"/><path d="M3 11V10a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1.5v4"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 11 3.5 3.5 0 0 1 19 18z"/>',
};
export function ic(name, cls = '') {
  const fill = name === 'play' || name === 'pause' ? ' fill' : '';
  return `<svg class="ic${fill} ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
}
export const icon = (name, cls) => h('span', { html: ic(name, cls), style: { display: 'inline-flex' } });

const FA_D = '۰۱۲۳۴۵۶۷۸۹';
export const fa = (n) => (lang === 'fa' ? String(n).replace(/\d/g, (d) => FA_D[d]) : String(n).replace(/[۰-۹]/g, (d) => FA_D.indexOf(d)));
export const pad2 = (n) => String(n).padStart(2, '0');
export function fmtTime(t) {
  t = Math.max(0, t | 0);
  return `${(t / 60) | 0}:${pad2(t % 60)}`;
}
export function fmtIvl(ms) {
  const m = ms / 60000;
  if (m < 1) return t('< ۱ دقیقه');
  if (m < 60) return fa(Math.round(m)) + ' ' + t('دقیقه');
  const hr = m / 60;
  if (hr < 24) return fa(Math.round(hr)) + ' ' + t('ساعت');
  const d = hr / 24;
  if (d < 30) return fa(Math.round(d)) + ' ' + t('روز');
  if (d < 365) return fa(Math.round(d / 30)) + ' ' + t('ماه');
  return fa((d / 365).toFixed(1).replace('.0', '')) + ' ' + t('سال');
}
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const norm = (s) => (s || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const WORD_RE = /[\p{L}\p{M}]+(?:['’][\p{L}]+)?/gu;
export function tokenize(text) {
  const out = []; let last = 0; let m;
  WORD_RE.lastIndex = 0;
  while ((m = WORD_RE.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), w: false });
    out.push({ t: m[0], w: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), w: false });
  return out;
}

export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ---- toast
let toastT;
export function toast(msg) {
  const el = document.getElementById('toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---- bottom sheet
export function openSheet({ title, body, actions, onClose }) {
  const root = document.getElementById('sheet-root');
  const back = h('div', { class: 'backdrop' });
  const bodyEl = h('div', { class: 'sh-b' }, body);
  const sheet = h('div', { class: 'sheet', role: 'dialog' },
    h('div', { class: 'grab' }),
    h('div', { class: 'sh-h' }, h('h3', null, title || ''), h('button', { class: 'icon-btn sm', onclick: () => close(), html: ic('x') })),
    bodyEl);
  if (actions) sheet.append(h('div', { class: 'sh-b', style: { paddingTop: 0 } }, actions));
  root.append(back, sheet);
  requestAnimationFrame(() => requestAnimationFrame(() => { back.classList.add('in'); sheet.classList.add('in'); }));
  let closed = false;
  function close() {
    if (closed) return; closed = true;
    back.classList.remove('in'); sheet.classList.remove('in');
    setTimeout(() => { back.remove(); sheet.remove(); }, 260);
    onClose && onClose();
  }
  back.addEventListener('click', close);
  return { close, bodyEl, sheet };
}

export function confirmSheet({ title, text, okText = t('تأیید'), danger = false }) {
  return new Promise((res) => {
    let done = false;
    const s = openSheet({
      title, body: h('p', { style: { margin: '0 0 6px', color: 'var(--ink2)' } }, text),
      actions: h('div', { style: { display: 'flex', gap: '10px' } },
        h('button', { class: 'btn ghost block', onclick: () => { done = true; s.close(); res(false); } }, t('انصراف')),
        h('button', { class: 'btn block' + (danger ? ' danger' : ''), onclick: () => { done = true; s.close(); res(true); } }, okText)),
      onClose: () => { if (!done) res(false); },
    });
  });
}

// ---- speech (German TTS if the device has a voice)
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices(); } catch (e) { /* no tts */ } }
try { loadVoices(); speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) { /* no tts */ }
export const LANG_NAMES = { en: 'English', fr: 'Français', es: 'Español', tr: 'Türkçe', it: 'Italiano', ar: t('العربية'), de: 'Deutsch' };
const LOCALE = { de: 'de-DE', en: 'en-US', fr: 'fr-FR', es: 'es-ES', tr: 'tr-TR', it: 'it-IT', ar: 'ar-SA' };
export const vlang = (v) => (v && v.ctx && v.ctx.lang) || 'de';
export function speak(text, rate = 0.9, lang = 'de', onend = null) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const loc = LOCALE[lang] || lang;
    u.lang = loc; u.rate = rate;
    if (onend) { u.onend = onend; u.onerror = onend; }
    const v = voices.find((x) => x.lang.replace('_', '-').toLowerCase() === loc.toLowerCase()) || voices.find((x) => x.lang.toLowerCase().startsWith(lang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
    return true;
  } catch (e) { return false; }
}

export function download(name, text, mime = 'application/json') {
  try {
    if (window.KlippApp && window.KlippApp.save) { return !!window.KlippApp.save(name, mime, text); }
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (e) { return false; }
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
}
