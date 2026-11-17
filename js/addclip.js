import { t } from './i18n.js';
import { S, addCustomLesson } from './state.js';
import * as Videos from './videos.js';
import { h, ic, openSheet, toast, LANG_NAMES, fa } from './util.js';
import { parseSubs, readText, merge } from './subs.js';
import { mascot, confetti, sfx } from './fx.js';

// Sheet to import the user's own clip: video + subtitle file(s), any language
export function openAddClip({ onDone } = {}) {
  let lang = 'en', tlang = 'fa', video = null, subMain = null, subTr = null;
  const title = h('input', { class: 'input', placeholder: t('اسم کلیپ (مثلاً Friends S01E01)') });
  const picker = (accept, set, label, icon) => {
    const inp = h('input', { type: 'file', accept, style: { display: 'none' } });
    const btn = h('button', { class: 'btn sec block pickbtn', onclick: () => inp.click() }, h('span', { html: ic(icon) }), label);
    inp.addEventListener('change', () => { const f = inp.files[0]; if (!f) return; set(f); btn.classList.add('got'); btn.replaceChildren(h('span', { html: ic('check') }), f.name); });
    return [inp, btn];
  };
  const [vi, vb] = picker('video/*,.mkv,.mp4,.webm,.mov', (f) => { video = f; if (!title.value) title.value = f.name.replace(/\.[^.]+$/, '').replace(/[._]+/g, ' '); }, t('انتخاب ویدیو'), 'film');
  const [si, sb] = picker('.srt,.vtt,.ass,.ssa,.txt', (f) => { subMain = f; }, t('زیرنویس اصلی (SRT / VTT / ASS)'), 'note');
  const [ti, tb] = picker('.srt,.vtt,.ass,.ssa,.txt', (f) => { subTr = f; }, t('زیرنویس برگردان (اختیاری)'), 'note');
  const chipRow = (opts, get, set) => {
    const el = h('div', { class: 'chips' });
    const paint = () => { el.replaceChildren(...opts.map(([k, l]) => h('button', { class: 'chip' + (get() === k ? ' on' : ''), onclick: () => { set(k); paint(); } }, l))); };
    paint(); return el;
  };
  const langs = Object.entries(LANG_NAMES).filter(([k]) => k !== 'de').concat([['de', LANG_NAMES.de]]);
  const prog = h('div', { class: 'copybar', style: { display: 'none', margin: '8px 0' } }, h('i'));
  const go = h('button', { class: 'btn block', onclick: run }, h('span', { html: ic('up') }), t('افزودن کلیپ'));
  const sh = openSheet({
    title: t('📥 افزودن کلیپ خودم'),
    body: [
      h('div', { class: 'note-box', style: { marginBottom: '12px' } }, t('ویدیو را از گوشی انتخاب کن و فایل زیرنویسش را هم بده. می‌توانی هر زبانی بگذاری. اگر زیرنویس برگردان (مثلاً فارسی) هم داری، کنارش نشان داده می‌شود.')),
      h('div', { class: 'field' }, h('label', null, t('زبان ویدیو')), chipRow(langs, () => lang, (k) => { lang = k; })),
      h('div', { class: 'field' }, h('label', null, t('اسم')), title),
      vi, vb, si, sb,
      h('div', { class: 'field', style: { marginTop: '10px' } }, h('label', null, t('زبان زیرنویس برگردان')), chipRow([['fa', t('فارسی')], ['en', 'English']], () => tlang, (k) => { tlang = k; })),
      ti, tb, prog,
    ],
    actions: go,
  });
  async function run() {
    if (!subMain) { toast(t('فایل زیرنویس اصلی را انتخاب کن')); return; }
    go.disabled = true;
    try {
      const main = parseSubs(await readText(subMain));
      if (!main.length) { toast(t('از این فایل زیرنویسی پیدا نکردم')); go.disabled = false; return; }
      const trans = subTr ? parseSubs(await readText(subTr)) : null;
      const cues = merge(main, trans).filter((c) => c.t.replace(/[^\p{L}]/gu, '').length >= 2).map((c) => ({
        s: Math.round(c.s * 100) / 100, e: Math.round(c.e * 100) / 100, de: c.t, en: tlang === 'en' ? c.x : '', fa: tlang === 'fa' ? c.x : '',
      }));
      const l = await addCustomLesson({ title: title.value.trim() || t('کلیپ من'), lang, cues, hasTr: !!trans, tlang });
      if (video) {
        prog.style.display = 'block';
        try { await Videos.save(l.id, video, (p) => { prog.firstChild.style.width = `${p * 100}%`; }); }
        catch (e) { toast(t('ذخیرهٔ ویدیو نشد (فضا کافی نیست؟) ولی زیرنویس اضافه شد')); }
      }
      sfx('done'); confetti(innerWidth / 2, innerHeight * 0.5, { n: 80, spread: 1.4 });
      toast(t('{0} جمله اضافه شد ✓', fa(cues.length)));
      sh.close(); onDone && onDone(l);
    } catch (e) { console.error(e); toast(t('مشکلی پیش آمد:') + ' ' + (e.message || e)); go.disabled = false; }
  }
}
export { mascot };
