import { t } from './i18n.js';
import * as DB from './db.js';
import { uid, dayKey, norm, LANG_NAMES, fa } from './util.js';
import { newCard, schedule } from './fsrs.js';

export const MARKS = [
  { id: 'yellow', name: t('واژه جدید') },
  { id: 'blue', name: t('گرامر') },
  { id: 'green', name: t('عبارت خوب') },
  { id: 'red', name: t('دوباره گوش بده') },
];
export const KINDS = {
  de2m: { name: t('آلمانی ← معنی'), short: t('واژه') },
  m2de: { name: t('معنی ← آلمانی'), short: t('برعکس') },
  clip: { name: t('شنیداری + جای خالی'), short: t('شنیداری') },
};
export const DEFAULTS = {
  subMode: 'de-fa',          // de | de-fa | de-en | none | orig
  meaningLang: 'both',       // fa | en | both
  newPerDay: 10,
  retention: 0.9,
  kinds: { de2m: true, m2de: false, clip: true },
  typing: false,
  theme: 'auto',
  speed: 1,
  repeatMode: 'off',         // off | pause | wait | loop
  waitSec: 0.5,              // pause length in 'wait' mode
  maskTop: 0.765,
  autoplayClip: true,
  dailyGoal: 15, xp: 0, sound: true, haptics: true,
};

// ---------- XP & levels
export const XP = [0, 2, 6, 10, 14];
export const LEVEL_NAMES = [t('تازه‌کار'), t('کنجکاو'), t('گوش‌تیز'), t('فیلم‌باز'), t('لغت‌شکار'), t('زبان‌دان'), t('استاد صحنه'), t('افسانهٔ کلیپ')];
const lvStart = (L) => 30 * (L - 1) * (L - 1);
export function levelInfo(xp = S.settings.xp || 0) {
  const L = Math.floor(Math.sqrt(xp / 30)) + 1;
  const a = lvStart(L), b = lvStart(L + 1);
  return { level: L, name: LEVEL_NAMES[Math.min(L - 1, LEVEL_NAMES.length - 1)], xp, into: xp - a, need: b - a, pct: (xp - a) / (b - a) };
}
export function gainXP(n) { S.settings.xp = (S.settings.xp || 0) + n; saveSettings(); }

export const MINE = { id: 'mine', name: t('کلیپ‌های من'), short: t('من'), emoji: '📥', color: 'pink' };

export const S = {
  settings: { ...DEFAULTS }, courses: [], lessons: [], lessonMap: new Map(),
  vocab: new Map(), cards: new Map(), marks: new Map(), progress: new Map(),
  days: {}, glossary: null, cues: new Map(),
};

function localise() {
  const nums = (x) => (String(x).match(/[\d۰-۹]+/g) || []).map((v) => +String(v).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  for (const l of S.lessons) {
    if (l.custom) { l.sub = `${LANG_NAMES[l.lang] || l.lang}${l.hasTr ? ' + ' + (l.tlang === 'fa' ? t('فارسی') : 'English') : ''} · ${t('{0} جمله', fa(l.cues))}`; continue; }
    if (l.course === 'nicos') { const [a, z] = nums(l.sub); l.title = t('کلیپ {0}', fa(l.n)); l.sub = t('دقیقهٔ {0} تا {1} فیلم', fa(a), fa(z)); }
    else if (l.kind === 'lektion') l.title = t('درس {0}', fa(l.n));
    else if (l.kind === 'modul') l.title = t('مدول {0}', fa(l.n));
  }
  for (const c of S.courses) {
    if (c.id === 'nicos') c.short = t('نیکوس');
    (c.groups || []).forEach((g) => { g.title = g.kind === 'lektion' ? t('درس‌ها') : t('مدول‌ها (مرور)'); });
  }
}
export async function init() {
  const idx = await (await fetch('data/index.json')).json();
  S.courses = [...idx.courses, MINE]; S.lessons = [...idx.lessons];
  const [vocab, cards, marks, progress, meta] = await Promise.all(['vocab', 'cards', 'marks', 'progress', 'meta'].map(DB.getAll));
  meta.filter((m) => m.id.startsWith('cl-')).sort((a, b) => a.v.created - b.v.created).forEach((m) => S.lessons.push(m.v));
  meta.filter((m) => m.id.startsWith('cc-')).forEach((m) => S.cues.set(m.id.slice(3), m.v.cues));
  localise();
  S.lessonMap = new Map(S.lessons.map((l) => [l.id, l]));
  vocab.forEach((v) => S.vocab.set(v.id, v));
  cards.forEach((c) => S.cards.set(c.id, c));
  marks.forEach((m) => S.marks.set(m.id, m));
  progress.forEach((p) => S.progress.set(p.id, p));
  const st = meta.find((m) => m.id === 'settings');
  S.settings = { ...DEFAULTS, ...(st ? st.v : {}) };
  S.settings.kinds = { ...DEFAULTS.kinds, ...((st && st.v && st.v.kinds) || {}) };
  const dd = meta.find((m) => m.id === 'days');
  S.days = dd ? dd.v : {};
}

export const saveSettings = () => DB.put('meta', { id: 'settings', v: S.settings });
const saveDays = () => DB.put('meta', { id: 'days', v: S.days });

// ---------- user-imported clips (any language)
export async function addCustomLesson({ title, lang, cues, hasTr, tlang }) {
  const id = 'my-' + Date.now().toString(36);
  const n = S.lessons.filter((l) => l.course === 'mine').length + 1;
  const l = { id, course: 'mine', kind: 'clip', n, title, lang, hasTr: !!hasTr, tlang, custom: true, created: Date.now(), cues: cues.length,
    sub: t('{0}{1} · {2} جمله', LANG_NAMES[lang] || lang, hasTr ? ' + ' + (tlang === 'fa' ? t('فارسی') : 'English') : '', cues.length), dur: cues.length ? Math.ceil(cues[cues.length - 1].e) : 0 };
  S.lessons.push(l); S.lessonMap.set(id, l); S.cues.set(id, cues);
  await DB.put('meta', { id: 'cl-' + id, v: l }); await DB.put('meta', { id: 'cc-' + id, v: { cues } });
  return l;
}
export async function deleteCustomLesson(id) {
  S.lessons = S.lessons.filter((l) => l.id !== id); S.lessonMap.delete(id); S.cues.delete(id); S.progress.delete(id);
  await DB.del('meta', 'cl-' + id); await DB.del('meta', 'cc-' + id); await DB.del('progress', id);
}
export async function loadCues(id) {
  if (S.cues.has(id)) return S.cues.get(id);
  const r = await fetch(`data/cues/${id}.json`);
  const j = await r.json();
  S.cues.set(id, j.cues);
  return j.cues;
}

// ---------- glossary (tap a word -> suggested meaning)
export async function loadGlossary() {
  if (S.glossary) return S.glossary;
  try { S.glossary = await (await fetch('data/glossary.json')).json(); } catch (e) { S.glossary = {}; }
  return S.glossary;
}
export function lookup(word) {
  const g = S.glossary || {};
  const k = word.toLowerCase();
  const hit = g[k] || g[word];
  if (!hit) return null;
  return { lemma: hit[0], en: hit[1] || '', fa: hit[2] || '' };
}

// ---------- vocab & cards
export const cardId = (vid, kind) => `${vid}:${kind}`;
export function findVocab(de) {
  const n = norm(de);
  for (const v of S.vocab.values()) if (norm(v.de) === n) return v;
  return null;
}
export function vocabCards(v) { return Object.keys(KINDS).map((k) => S.cards.get(cardId(v.id, k))).filter(Boolean); }

export function addVocab({ de, fa, en, form, ctx, kinds }) {
  const v = { id: uid(), de: de.trim(), fa: (fa || '').trim(), en: (en || '').trim(), form: (form || de).trim(), ctx: ctx || null, created: Date.now(), upd: Date.now() };
  const ks = kinds || activeKinds(!!ctx);
  v.kinds = ks;
  S.vocab.set(v.id, v); DB.put('vocab', v);
  syncCards(v); gainXP(3);
  return v;
}
export function activeKinds(hasCtx) {
  const k = S.settings.kinds;
  const out = Object.keys(KINDS).filter((x) => k[x] && (x !== 'clip' || hasCtx));
  return out.length ? out : ['de2m'];
}
export function syncCards(v) {
  const want = new Set(v.kinds);
  for (const kind of Object.keys(KINDS)) {
    const id = cardId(v.id, kind);
    if (want.has(kind) && !S.cards.has(id)) {
      const c = { id, vid: v.id, kind, ...newCard() };
      S.cards.set(id, c); DB.put('cards', c);
    } else if (!want.has(kind) && S.cards.has(id)) {
      S.cards.delete(id); DB.del('cards', id);
    }
  }
}
export function saveVocab(v) { v.upd = Date.now(); S.vocab.set(v.id, v); DB.put('vocab', v); syncCards(v); }
export function deleteVocab(id) {
  const v = S.vocab.get(id); if (!v) return;
  Object.keys(KINDS).forEach((k) => { S.cards.delete(cardId(id, k)); DB.del('cards', cardId(id, k)); });
  S.vocab.delete(id); DB.del('vocab', id);
  tomb(id);
}
export function snapshotVocab(id) {
  const v = S.vocab.get(id); if (!v) return null;
  const cards = Object.keys(KINDS).map((k) => S.cards.get(cardId(id, k))).filter(Boolean).map((c) => ({ ...c }));
  return { v: { ...v }, cards };
}
export function restoreVocab(snap) {
  if (!snap) return;
  S.vocab.set(snap.v.id, snap.v); DB.put('vocab', snap.v);
  snap.cards.forEach((c) => { S.cards.set(c.id, c); DB.put('cards', c); });
  if (S.settings.tomb) delete S.settings.tomb[snap.v.id];
  saveSettings();
}
export const todayReviews = () => (S.days[dayKey()] || {}).r || 0;
export function vocabLevel(v) {
  const cs = vocabCards(v).filter((c) => c.state !== 0);
  if (!cs.length) return 0;                         // new
  const s = Math.min(...cs.map((c) => c.S));
  return s >= 21 ? 3 : s >= 4 ? 2 : 1;              // 1 learning, 2 young, 3 mature
}

// ---------- marks
export const markId = (lesson, i) => `${lesson}#${i}`;
export function setMark(lesson, cue, i, color, note) {
  const m = { id: markId(lesson, i), lesson, i, s: cue.s, e: cue.e, de: cue.de, en: cue.en || '', fa: cue.fa || '', color, note: note || '', t: Date.now() };
  S.marks.set(m.id, m); DB.put('marks', m); return m;
}
export function removeMark(lesson, i) { S.marks.delete(markId(lesson, i)); DB.del('marks', markId(lesson, i)); tomb(markId(lesson, i)); }
// words the user says they already know (without a flashcard): { normalisedWord: timestamp }
export const knownMap = () => (S.settings.known = S.settings.known || {});
export function markKnown(ws) {
  const k = knownMap(); const now = Date.now();
  ws.forEach((w) => { const n = w.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); if (n) { k[n] = now; if (S.settings.tomb) delete S.settings.tomb['k:' + n]; } });
  saveSettings();
}
export function unmarkKnown(ws) {
  const k = knownMap();
  ws.forEach((w) => { const n = w.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); if (n && k[n]) { delete k[n]; tomb('k:' + n); } });
  saveSettings();
}
export const knownCount = () => Object.keys(S.settings.known || {}).length;
export function tomb(id) { S.settings.tomb = S.settings.tomb || {}; S.settings.tomb[id] = Date.now(); saveSettings(); }

// ---------- progress
export function saveProgress(id, pos, dur) {
  const p = S.progress.get(id) || { id, pos: 0, max: 0, dur: dur || 0 };
  p.pos = pos; p.max = Math.max(p.max, pos); if (dur) p.dur = dur; p.t = Date.now();
  S.progress.set(id, p); DB.put('progress', p);
}
export function addDone(id, dur) {
  const p = S.progress.get(id) || { id, pos: 0, max: 0, dur: dur || 0 };
  p.done = (p.done || 0) + 1; p.pos = dur || p.pos; p.max = Math.max(p.max, dur || 0); if (dur) p.dur = dur; p.t = Date.now();
  S.progress.set(id, p); DB.put('progress', p);
}
export const lessonDone = (id) => (S.progress.get(id) || {}).done || 0;
export function lessonProgress(id) {
  const p = S.progress.get(id); if (!p || !p.dur) return 0;
  return Math.min(1, p.max / p.dur);
}

// ---------- study queue
const today = () => S.days[dayKey()] || { r: 0, n: 0 };
export function newLeftToday() { return Math.max(0, S.settings.newPerDay - today().n); }
export function counts(now = Date.now(), lesson = null) {
  let learn = 0, review = 0, fresh = 0;
  for (const c of S.cards.values()) {
    if (lesson && !cardInLesson(c, lesson)) continue;
    if (c.state === 0) fresh++;
    else if (c.due <= now) (c.state === 2 ? review++ : learn++);
  }
  return { learn, review, fresh: Math.min(fresh, lesson ? fresh : newLeftToday()), due: learn + review };
}
function cardInLesson(c, lesson) { const v = S.vocab.get(c.vid); return v && v.ctx && v.ctx.lesson === lesson; }
export function buildQueue({ lesson = null, extraNew = false } = {}) {
  const now = Date.now();
  const learn = [], review = [], fresh = [];
  for (const c of S.cards.values()) {
    if (lesson && !cardInLesson(c, lesson)) continue;
    if (c.state === 0) fresh.push(c);
    else if (c.due <= now + 20 * 60000 && c.state !== 2) learn.push(c);
    else if (c.due <= now && c.state === 2) review.push(c);
  }
  learn.sort((a, b) => a.due - b.due); review.sort((a, b) => a.due - b.due);
  fresh.sort((a, b) => (S.vocab.get(a.vid)?.created || 0) - (S.vocab.get(b.vid)?.created || 0));
  const limit = lesson || extraNew ? 9999 : newLeftToday();
  return [...learn, ...review, ...fresh.slice(0, limit)].map((c) => c.id);
}
export function answerCard(id, g) {
  const c = S.cards.get(id); if (!c) return null;
  const wasNew = c.state === 0;
  const n = { ...c, ...schedule(c, g, Date.now(), S.settings.retention) };
  S.cards.set(id, n); DB.put('cards', n);
  gainXP(XP[g] || 0);
  const k = dayKey(); const d = S.days[k] || { r: 0, n: 0 };
  d.r++; if (wasNew) d.n++; S.days[k] = d; saveDays();
  return n;
}
const WATCH_MIN = 30; // seconds of video in a day that count as an active day
export const dayActive = (d) => !!d && ((d.r || 0) > 0 || (d.w || 0) >= WATCH_MIN);
export function streak() {
  let n = 0; const d = new Date();
  if (!dayActive(S.days[dayKey(d)])) d.setDate(d.getDate() - 1);
  while (dayActive(S.days[dayKey(d)])) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function bestStreak() {
  const ks = Object.keys(S.days).filter((k) => dayActive(S.days[k])).sort(); let best = 0, run = 0, prev = null;
  for (const k of ks) { const dt = new Date(k + 'T12:00:00'); if (prev && Math.round((dt - prev) / 864e5) === 1) run++; else run = 1; best = Math.max(best, run); prev = dt; }
  return Math.max(best, streak());
}
export function lastDays(n = 7) {
  const out = []; const d = new Date(); d.setDate(d.getDate() - n + 1);
  for (let i = 0; i < n; i++) { const e = S.days[dayKey(d)] || {}; out.push({ k: dayKey(d), r: e.r || 0, w: e.w || 0, on: dayActive(e) }); d.setDate(d.getDate() + 1); }
  return out;
}
let _wSave = 0;
export function addWatch(sec = 1) {
  const k = dayKey(); const d = S.days[k] || { r: 0, n: 0 }; d.w = (d.w || 0) + sec; S.days[k] = d;
  if (Date.now() - _wSave > 8000) { _wSave = Date.now(); saveDays(); }
}
export const flushDays = () => saveDays();
export const todayWatch = () => (S.days[dayKey()] || {}).w || 0;

// ---------- backup / import / export
export function exportAll() {
  return { app: 'klipp', v: 1, t: Date.now(), settings: S.settings, days: S.days, vocab: [...S.vocab.values()], cards: [...S.cards.values()], marks: [...S.marks.values()], progress: [...S.progress.values()], custom: S.lessons.filter((l) => l.custom).map((l) => ({ lesson: l, cues: S.cues.get(l.id) || [] })) };
}
export async function importAll(o) {
  if (!o || o.app !== 'klipp') throw new Error(t('این فایل پشتیبان درست به نظر نمی‌رسد'));
  (o.vocab || []).forEach((v) => S.vocab.set(v.id, v));
  (o.cards || []).forEach((c) => S.cards.set(c.id, c));
  (o.marks || []).forEach((m) => S.marks.set(m.id, m));
  (o.progress || []).forEach((p) => S.progress.set(p.id, p));
  await Promise.all([DB.putMany('vocab', o.vocab || []), DB.putMany('cards', o.cards || []), DB.putMany('marks', o.marks || []), DB.putMany('progress', o.progress || [])]);
  for (const c of o.custom || []) {
    if (S.lessonMap.has(c.lesson.id)) continue;
    S.lessons.push(c.lesson); S.lessonMap.set(c.lesson.id, c.lesson); S.cues.set(c.lesson.id, c.cues);
    await DB.put('meta', { id: 'cl-' + c.lesson.id, v: c.lesson }); await DB.put('meta', { id: 'cc-' + c.lesson.id, v: { cues: c.cues } });
  }
  if (o.days) { for (const [k, v] of Object.entries(o.days)) { const cur = S.days[k]; if (!cur) S.days[k] = v; else { cur.r = Math.max(cur.r || 0, v.r || 0); cur.n = Math.max(cur.n || 0, v.n || 0); cur.w = Math.max(cur.w || 0, v.w || 0); } } saveDays(); }
  if (o.settings) { S.settings = { ...S.settings, ...o.settings }; saveSettings(); }
}

const csvEsc = (s) => /[",\n\t]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s);
export function vocabCSV() {
  const rows = [['de', 'fa', 'en', 'sentence_de', 'sentence_en', 'sentence_fa', 'lesson', 'time']];
  for (const v of S.vocab.values()) {
    const c = v.ctx || {};
    rows.push([v.de, v.fa, v.en, c.de || '', c.en || '', c.fa || '', c.lesson || '', c.s != null ? c.s : '']);
  }
  return rows.map((r) => r.map(csvEsc).join(',')).join('\n');
}
function parseCSV(text) {
  const first = text.split('\n')[0] || '';
  const delim = first.includes('\t') ? '\t' : first.split(';').length > first.split(',').length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
export function importCSV(text) {
  const rows = parseCSV(text.replace(/^﻿/, ''));
  if (!rows.length) return 0;
  const head = rows[0].map((x) => x.trim().toLowerCase());
  const col = (names, dflt) => { const i = head.findIndex((x) => names.includes(x)); return i >= 0 ? i : dflt; };
  const hasHead = head.some((x) => ['de', 'german', 'word', 'front', 'fa', 'en', 'persian', 'english', 'back'].includes(x));
  const iDe = col(['de', 'german', 'deutsch', 'word', 'front'], 0);
  const iFa = col(['fa', 'persian', 'farsi'], 1);
  const iEn = col(['en', 'english', 'back'], 2);
  const iEx = col(['sentence_de', 'example', 'sentence'], 3);
  let n = 0;
  for (const r of hasHead ? rows.slice(1) : rows) {
    const de = (r[iDe] || '').trim(); if (!de || findVocab(de)) continue;
    addVocab({ de, fa: r[iFa], en: r[iEn], ctx: r[iEx] ? { lesson: null, s: 0, e: 0, de: r[iEx].trim(), en: '', fa: '' } : null, kinds: activeKinds(false) });
    n++;
  }
  return n;
}
