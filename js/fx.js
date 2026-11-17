// Fun layer: mascot, confetti, sounds, haptics, count-up
import { S } from './state.js';

const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- mascot "Klippy" (a cheerful clapperboard)
let _mid = 0;
export function mascot(mood = 'happy', size = 96) {
  const id = 'm' + (++_mid);
  const mouth = {
    happy: '<path d="M48 84q12 11 24 0" fill="none" stroke="#3a1d5c" stroke-width="4" stroke-linecap="round"/>',
    cheer: '<path d="M46 82q14 22 28 0z" fill="#3a1d5c"/><path d="M52 90q8 6 16 0" fill="#ff6f91"/>',
    sleep: '<path d="M52 86h16" stroke="#3a1d5c" stroke-width="4" stroke-linecap="round"/>',
    think: '<path d="M52 86q8-4 16 0" fill="none" stroke="#3a1d5c" stroke-width="4" stroke-linecap="round"/>',
    wow: '<ellipse cx="60" cy="87" rx="6" ry="7" fill="#3a1d5c"/>',
  }[mood] || '';
  const eyes = mood === 'sleep'
    ? '<path d="M38 72q8 6 16 0M66 72q8 6 16 0" fill="none" stroke="#3a1d5c" stroke-width="4" stroke-linecap="round"/>'
    : `<g class="k-eyes"><ellipse cx="46" cy="72" rx="9" ry="10.5" fill="#fff"/><ellipse cx="74" cy="72" rx="9" ry="10.5" fill="#fff"/>
       <circle cx="${mood === 'think' ? 49 : 47}" cy="${mood === 'think' ? 69 : 73}" r="5" fill="#2a1450"/><circle cx="${mood === 'think' ? 77 : 75}" cy="${mood === 'think' ? 69 : 73}" r="5" fill="#2a1450"/>
       <circle cx="49" cy="70" r="1.7" fill="#fff"/><circle cx="77" cy="70" r="1.7" fill="#fff"/></g>`;
  const extra = mood === 'sleep' ? '<text x="92" y="38" font-size="14" font-weight="800" fill="#8b5cf6" class="k-z">z</text><text x="100" y="26" font-size="10" font-weight="800" fill="#8b5cf6" class="k-z k-z2">z</text>'
    : mood === 'cheer' ? '<path d="M14 40l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z" fill="#ffd24a" class="k-spark"/><path d="M104 30l2 5 5 1-4 4 1 5-4-3-4 3 1-5-4-4 5-1z" fill="#ff8ac2" class="k-spark k-s2"/>' : '';
  return `<svg class="klippy mood-${mood}" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d6bff"/><stop offset="1" stop-color="#b24dff"/></linearGradient>
    <clipPath id="${id}c"><rect x="14" y="22" width="92" height="22" rx="7"/></clipPath>
  </defs>
  <ellipse cx="60" cy="112" rx="34" ry="5" fill="rgba(40,20,90,.18)" class="k-shadow"/>
  <g class="k-body">
    <g class="k-armL"><circle cx="14" cy="80" r="8" fill="#8a62ff"/></g>
    <g class="k-armR"><circle cx="106" cy="80" r="8" fill="#8a62ff"/></g>
    <rect x="16" y="46" width="88" height="62" rx="16" fill="url(#${id}b)"/>
    <rect x="16" y="46" width="88" height="62" rx="16" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
    <g class="k-clap">
      <rect x="14" y="22" width="92" height="22" rx="7" fill="#1d1a3d"/>
      <g clip-path="url(#${id}c)" fill="#fff"><path d="M22 22h10l-10 22H12z"/><path d="M44 22h10L44 44H34z"/><path d="M66 22h10L66 44H56z"/><path d="M88 22h10L88 44H78z"/><path d="M110 22h10l-10 22h-10z"/></g>
    </g>
    <rect x="14" y="40" width="92" height="9" rx="4" fill="#1d1a3d"/>
    ${eyes}
    <circle cx="35" cy="86" r="6" fill="#ff8ac2" opacity=".55"/><circle cx="85" cy="86" r="6" fill="#ff8ac2" opacity=".55"/>
    ${mouth}
  </g>${extra}</svg>`;
}

// ---------- confetti
const COLORS = ['#ff5fa2', '#ffb347', '#ffd24a', '#34d399', '#38bdf8', '#8b5cf6', '#6d6bff'];
let cv = null, ctx = null, parts = [], raf = 0;
function ensureCanvas() {
  if (cv) return;
  cv = document.createElement('canvas'); cv.className = 'fx-canvas';
  const fit = () => { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; };
  fit(); addEventListener('resize', fit);
  document.body.append(cv); ctx = cv.getContext('2d');
}
function tick() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  const dpr = devicePixelRatio;
  parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
  for (const p of parts) {
    p.vy += p.g; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 1;
    ctx.save(); ctx.translate(p.x * dpr, p.y * dpr); ctx.rotate(p.r);
    ctx.globalAlpha = Math.min(1, p.life / 25); ctx.fillStyle = p.c;
    if (p.s) { ctx.beginPath(); ctx.arc(0, 0, p.w * dpr * .5, 0, 7); ctx.fill(); }
    else ctx.fillRect(-p.w * dpr / 2, -p.h * dpr / 2, p.w * dpr, p.h * dpr);
    ctx.restore();
  }
  if (parts.length) raf = requestAnimationFrame(tick); else { raf = 0; ctx.clearRect(0, 0, cv.width, cv.height); }
}
export function confetti(x = innerWidth / 2, y = innerHeight * 0.55, { n = 60, spread = 1, power = 1 } = {}) {
  if (reduce()) return;
  ensureCanvas();
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * spread;
    const v = (4 + Math.random() * 8) * power;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.28, r: Math.random() * 6, vr: (Math.random() - .5) * .35,
      w: 5 + Math.random() * 6, h: 7 + Math.random() * 8, s: Math.random() < .3, c: COLORS[(Math.random() * COLORS.length) | 0], life: 70 + Math.random() * 50 });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}
export function rain(ms = 1600) {
  if (reduce()) return;
  const t0 = performance.now();
  const iv = setInterval(() => {
    confetti(Math.random() * innerWidth, -10, { n: 7, spread: 0.3, power: .15 });
    parts.slice(-7).forEach((p) => { p.vy = 2 + Math.random() * 3; p.vx = (Math.random() - .5) * 2; p.y = -10; });
    if (performance.now() - t0 > ms) clearInterval(iv);
  }, 90);
}

// ---------- sound & haptics
let ac = null;
function tone(freq, t0, dur, type = 'sine', vol = 0.12) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime + t0);
  g.gain.setValueAtTime(0.0001, ac.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t0 + dur);
  o.connect(g); g.connect(ac.destination); o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + dur + 0.05);
}
export function sfx(kind) {
  if (S.settings.sound === false) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const N = { c5: 523.25, e5: 659.25, g5: 783.99, c6: 1046.5, e6: 1318.5, a4: 440, d5: 587.33 };
    if (kind === 'good') { tone(N.c5, 0, .16); tone(N.e5, .08, .2); }
    else if (kind === 'easy') { tone(N.c5, 0, .14); tone(N.e5, .07, .14); tone(N.g5, .14, .26); }
    else if (kind === 'hard') { tone(N.a4, 0, .18, 'triangle'); tone(N.d5, .09, .18, 'triangle'); }
    else if (kind === 'again') { tone(196, 0, .22, 'triangle', .14); tone(165, .12, .3, 'triangle', .12); }
    else if (kind === 'add') { tone(N.e5, 0, .1); tone(N.c6, .07, .22); }
    else if (kind === 'level') { [N.c5, N.e5, N.g5, N.c6, N.e6].forEach((f, i) => tone(f, i * .09, .3)); }
    else if (kind === 'done') { [N.g5, N.c6, N.e6].forEach((f, i) => tone(f, i * .12, .35)); }
    else if (kind === 'tap') tone(880, 0, .05, 'sine', .06);
  } catch (e) { /* audio blocked */ }
}
export function buzz(ms = 20) { if (S.settings.haptics !== false && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } }

// ---------- misc
export function countUp(el, to, { ms = 800, fmt = (v) => String(v) } = {}) {
  if (reduce() || !to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (t) => { const k = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(to * e)); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
export function floatText(text, x, y, cls = '') {
  const el = document.createElement('div'); el.className = 'fx-float ' + cls; el.textContent = text;
  el.style.left = x + 'px'; el.style.top = y + 'px'; document.body.append(el);
  setTimeout(() => el.remove(), 1100);
}
export function ring(pct, size = 92, stroke = 10, inner = '') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<div class="ringw" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#ff7ab6"/></linearGradient></defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="${stroke}"/>
    <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#rg)" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c}" data-target="${c * (1 - Math.min(1, pct))}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>
    <div class="ring-in">${inner}</div></div>`;
}
export function animateRings(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => root.querySelectorAll('.ring-fg').forEach((c) => { c.style.strokeDashoffset = c.dataset.target; })));
}
