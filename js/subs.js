// Subtitle parsing (SRT / VTT / ASS) + merging a translation track
const clean = (t) => t.replace(/\{[^}]*\}/g, '').replace(/<[^>]+>/g, '').replace(/\\[Nn]/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/♪+/g, '').replace(/\s+/g, ' ').trim();
const TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;
const toSec = (m) => (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+((m[4] + '00').slice(0, 3))) / 1000;

export function parseSubs(text) {
  text = text.replace(/^﻿/, '').replace(/\r/g, '');
  const out = [];
  if (/^\s*\[Script Info\]/im.test(text) || /^Dialogue:/m.test(text)) {
    let cols = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
    for (const line of text.split('\n')) {
      if (/^Format:/i.test(line) && /start/i.test(line) && /text/i.test(line)) cols = line.slice(7).split(',').map((x) => x.trim().toLowerCase());
      if (!/^Dialogue:/i.test(line)) continue;
      const parts = line.slice(9).split(',');
      const get = (k) => parts[cols.indexOf(k)];
      const txt = parts.slice(cols.indexOf('text')).join(',');
      const t = (s) => { const m = /(\d+):(\d{2}):(\d{2})[.](\d{1,2})/.exec(s || ''); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / (m[4].length === 1 ? 10 : 100) : NaN; };
      const s = t(get('start')), e = t(get('end'));
      const c = clean(txt);
      if (c && s === s && e === e) out.push({ s, e, t: c });
    }
  } else {
    for (const block of text.split(/\n{2,}/)) {
      const lines = block.split('\n');
      const k = lines.findIndex((l) => l.includes('-->'));
      if (k < 0) continue;
      const [a, b] = lines[k].split('-->');
      const ma = TIME.exec(a), mb = TIME.exec(b);
      if (!ma || !mb) continue;
      const c = clean(lines.slice(k + 1).join(' '));
      if (c) out.push({ s: toSec(ma), e: toSec(mb), t: c });
    }
  }
  out.sort((x, y) => x.s - y.s);
  // drop exact duplicates (typical for karaoke/auto subs)
  return out.filter((c, i) => !(i && c.t === out[i - 1].t && c.s - out[i - 1].e < 0.3));
}

export async function readText(file) {
  const buf = await file.arrayBuffer();
  let s = new TextDecoder('utf-8').decode(buf);
  if (s.includes('�')) { try { s = new TextDecoder('windows-1252').decode(buf); } catch (e) { /* keep */ } }
  return s;
}

// attach translation text to the main cues by time overlap
export function merge(main, trans) {
  return main.map((c) => {
    if (!trans || !trans.length) return { s: c.s, e: c.e, t: c.t, x: '' };
    const hit = trans.filter((u) => { const mid = (u.s + u.e) / 2; return mid >= c.s - 0.25 && mid <= c.e + 0.25; });
    return { s: c.s, e: c.e, t: c.t, x: [...new Set(hit.map((u) => u.t))].join(' ') };
  });
}
