import { getToken, setToken, lastSync, syncNow } from './sync.js';
import { t, lang, locale, setLang } from './i18n.js';
import { S, saveSettings, exportAll, importAll, vocabCSV, importCSV } from './state.js';
import * as Videos from './videos.js';
import * as DB from './db.js';
import { openGoalSheet } from './goal.js';
import { h, ic, fa, toast, download, copyText, confirmSheet, speak, voicesFor, savedVoice, setVoice, ttsOK } from './util.js';

const sw = (on, fn) => { const el = h('button', { class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on, onclick: () => { el.classList.toggle('on'); fn(el.classList.contains('on')); } }); return el; };
const fmtSize = (b) => (b > 1e9 ? t('{0} گیگابایت', fa((b / 1e9).toFixed(1))) : t('{0} مگابایت', fa(Math.round(b / 1e6))));
const row = (l, small, ctl) => h('div', { class: 'setrow' }, h('div', { class: 'l' }, h('span', null, l), small ? h('small', null, small) : null), ctl);
function seg(opts, val, fn) {
  const el = h('div', { class: 'seg', style: { minWidth: '190px' } });
  opts.forEach(([k, l]) => el.append(h('button', { class: k === val ? 'on' : '', onclick: (e) => { el.querySelectorAll('button').forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); fn(k); } }, l)));
  return el;
}

export async function renderSettings(root, nav) {
  root.append(h('div', { class: 'page-h' }, h('div', null, h('h1', null, t('تنظیمات')), h('div', { class: 'sub' }, t('ویدیوها، زیرنویس، مرور و پشتیبان')))));

  // ---------- videos
  const stored = await Videos.refresh();
  const vbox = h('div', { class: 'card' });
  root.append(h('div', { class: 'sect-t' }, t('🎬 ویدیوها')), vbox);
  const prog = h('div', { class: 'copybar', style: { display: 'none', margin: '0 16px 6px' } }, h('i'));
  const status = h('div', { style: { padding: '4px 16px 14px', fontSize: '13px', color: 'var(--muted)', minHeight: '8px' } });
  async function addFiles(files) {
    const items = []; const skipped = [];
    [...files].forEach((f) => { const id = Videos.matchLesson(f.name, S.lessons); (id ? items : skipped).push({ f, id }); });
    if (!items.length) { toast(t('اسم فایل‌ها با هیچ درسی جور درنیامد')); status.textContent = t('شناخته نشد:') + ' ' + skipped.slice(0, 3).map((x) => x.f.name).join(t('،') + ' '); return; }
    prog.style.display = 'block'; let ok = 0;
    for (let i = 0; i < items.length; i++) {
      status.textContent = t('در حال افزودن {0} از {1} — {2}', fa(i + 1), fa(items.length), S.lessonMap.get(items[i].id).title);
      try { await Videos.save(items[i].id, items[i].f, (p) => { prog.firstChild.style.width = `${((i + p) / items.length) * 100}%`; }); ok++; }
      catch (e) { toast(t('فضای کافی نیست یا ذخیره نشد')); break; }
    }
    prog.style.display = 'none';
    toast(t('{0} ویدیو اضافه شد', fa(ok)) + (skipped.length ? ' ' + t('· {0} فایل نامشخص', fa(skipped.length)) : ''));
    root.replaceChildren(); renderSettings(root, nav);
  }
  const pick = h('input', { type: 'file', accept: 'video/*,.mkv,.mp4', multiple: true, style: { display: 'none' } });
  pick.addEventListener('change', () => addFiles(pick.files));
  document.body.append(pick); setTimeout(() => pick.remove(), 900000);
  vbox.append(
    h('div', { style: { padding: '16px 16px 12px' } }, h('div', { class: 'note-box' }, Videos.supported()
      ? t('فایل ویدیوها را یک‌بار انتخاب کن (چندتا با هم). اپ از روی اسم فایل می‌فهمد مال کدام درس است و آن را برای پخش آفلاین نگه می‌دارد.')
      : t('این مرورگر ذخیره دائمی ویدیو را پشتیبانی نمی‌کند. از Chrome اندروید استفاده کن.'))),
    h('div', { style: { padding: '0 16px 12px' } }, h('button', { class: 'btn block', onclick: () => pick.click() }, h('span', { html: ic('film') }), t('انتخاب ویدیوها'))),
    prog, status);
  if (stored.length) {
    const total = stored.reduce((a, b) => a + b.size, 0);
    vbox.append(h('div', { class: 'vlist' },
      h('div', { class: 'vrow', style: { background: 'var(--surface2)', fontWeight: 700 } }, h('span', { class: 'nm' }, t('{0} ویدیو در اپ', fa(stored.length))), h('span', { class: 'pill' }, fmtSize(total))),
      ...stored.sort((a, b) => a.id.localeCompare(b.id)).map((s) => {
        const l = S.lessonMap.get(s.id);
        return h('div', { class: 'vrow' }, h('span', { class: 'nm' }, l ? `${S.courses.find((c) => c.id === l.course).short} · ${l.title}` : s.id),
          h('span', { style: { color: 'var(--muted)', fontSize: '12px' } }, fmtSize(s.size)),
          h('button', { class: 'icon-btn sm', html: ic('trash'), 'aria-label': t('حذف'), onclick: async () => { await Videos.remove(s.id); root.replaceChildren(); renderSettings(root, nav); } }));
      })));
  }
  const u = await Videos.usage();
  if (u.quota) vbox.append(h('div', { style: { padding: '10px 16px', fontSize: '12.5px', color: 'var(--muted)', borderTop: '1px solid var(--line)' } }, t('حافظه مصرفی اپ: {0} از {1}', fmtSize(u.used), fmtSize(u.quota))));
  if (Videos.supported() && !(await Videos.isPersisted())) {
    vbox.append(row(t('محافظت از داده‌ها'), t('جلوی پاک‌شدن ویدیوها و واژه‌ها را بگیر'), h('button', { class: 'btn sec sm', onclick: async () => toast((await Videos.persist()) ? t('محافظت فعال شد؛ خیالت راحت 😌') : t('مرورگر اجازه نداد؛ اپ را نصب کن (Add to Home screen)')) }, t('فعال‌سازی'))));
  }

  // ---------- display
  root.append(h('div', { class: 'sect-t' }, t('🎨 نمایش')),
    h('div', { class: 'card' },
      row(t('زیرنویس پیش‌فرض'), null, seg([['de', 'DE'], ['de-fa', t('DE+فا')], ['de-en', 'DE+EN'], ['none', t('هیچ')]], S.settings.subMode === 'orig' ? 'de-fa' : S.settings.subMode, (k) => { S.settings.subMode = k; saveSettings(); })),
      row(t('زبان معنی در کارت‌ها'), null, seg([['fa', t('فارسی')], ['en', 'English'], ['both', t('هر دو')]], S.settings.meaningLang, (k) => { S.settings.meaningLang = k; saveSettings(); })),
      row(t('زبان برنامه'), null, seg([['fa', 'فارسی'], ['en', 'English'], ['de', 'Deutsch']], lang, (k) => setLang(k))),
      row(t('اندازه‌ی متن'), null, seg([['0.92', 'A−'], ['1', 'A'], ['1.12', 'A+'], ['1.25', 'A++']], String(S.settings.fontScale || 1), (k) => { S.settings.fontScale = +k; saveSettings(); document.documentElement.style.zoom = String(k); })),
      row(t('ظاهر'), null, seg([['auto', t('خودکار')], ['light', t('روشن')], ['dark', t('تیره')]], S.settings.theme, (k) => { S.settings.theme = k; saveSettings(); document.documentElement.dataset.theme = k; }))));

  // ---------- voice
  if (ttsOK()) {
    const vSel = h('select', { class: 'input', style: { maxWidth: '210px', minHeight: '40px' } });
    const fillV = () => { const l = voicesFor('de'); const cur = savedVoice(); vSel.replaceChildren(h('option', { value: '' }, t('خودکار (بهترین)')), ...l.map((v) => h('option', { value: v.name }, v.name + (/natural|online|neural|premium|enhanced/i.test(v.name) ? ' ★' : '')))); vSel.value = l.some((v) => v.name === cur) ? cur : ''; };
    fillV(); try { speechSynthesis.addEventListener('voiceschanged', fillV); } catch (e) { /* ignore */ }
    vSel.addEventListener('change', () => { setVoice(vSel.value); speak('Guten Tag! Ich lerne Deutsch.', 0.9, 'de'); });
    root.append(h('div', { class: 'sect-t' }, t('🔊 صدای آلمانی')),
      h('div', { class: 'card' }, row(t('صدا'), t('صدای‌های ★ طبیعی‌ترند؛ در Edge صدای Natural و در مک صدای Premium/Enhanced را نصب کن'), vSel),
        row(t('امتحان صدا'), null, h('button', { class: 'btn sm', onclick: () => speak('Guten Tag! Ich lerne Deutsch.', 0.9, 'de') }, '▶'))));
  }

  // ---------- review
  const nInp = h('input', { class: 'input', type: 'number', min: 0, max: 100, value: S.settings.newPerDay, style: { width: '84px', textAlign: 'center', minHeight: '40px' } });
  nInp.addEventListener('change', () => { S.settings.newPerDay = Math.max(0, +nInp.value || 0); if ((S.settings.goals || []).length) S.settings.goalAuto = false; saveSettings(); });
  const rInp = h('input', { class: 'seek', type: 'range', min: 80, max: 97, value: S.settings.retention * 100, style: { width: '130px' } });
  const rVal = h('span', { class: 'num', style: { minWidth: '40px', textAlign: 'center', fontWeight: 700 } }, fa(Math.round(S.settings.retention * 100)) + t('٪'));
  rInp.addEventListener('input', () => { rVal.textContent = fa(rInp.value) + t('٪'); });
  rInp.addEventListener('change', () => { S.settings.retention = rInp.value / 100; saveSettings(); });
  root.append(h('div', { class: 'sect-t' }, t('🎯 هدف سطح')), h('div', { class: 'card' },
    row(t('هدف A2 / B1'), t('تاریخ هدف و تعداد واژهٔ تازهٔ روزانه'), h('button', { class: 'btn sec', onclick: () => openGoalSheet(() => { root.replaceChildren(); renderSettings(root, nav); }) }, t('تنظیم')))));
  root.append(h('div', { class: 'sect-t' }, t('🧠 مرور هوشمند (FSRS)')),
    h('div', { class: 'card' },
      row(t('کارت جدید در روز'), (S.settings.goals || []).length && S.settings.goalAuto !== false ? t('خودکار از روی هدف سطح؛ تغییر دستی، حالت خودکار را خاموش می‌کند') : null, nInp),
      row(t('میزان یادآوری هدف'), t('بالاتر = مرور بیشتر'), h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, rInp, rVal)),
      row(t('هدف مرور روزانه'), t('برای حلقهٔ رنگی صفحهٔ خانه'), seg([['10', fa(10)], ['15', fa(15)], ['25', fa(25)], ['40', fa(40)]], String(S.settings.dailyGoal || 15), (k) => { S.settings.dailyGoal = +k; saveSettings(); })),
      row(t('صدای جلوه‌ها'), t('صدای کوتاه موقع مرور و افزودن واژه'), sw(S.settings.sound !== false, (v) => { S.settings.sound = v; saveSettings(); })),
      row(t('لرزش (هپتیک)'), null, sw(S.settings.haptics !== false, (v) => { S.settings.haptics = v; saveSettings(); })),
      row(t('پخش خودکار کلیپ صحنه'), null, sw(S.settings.autoplayClip, (v) => { S.settings.autoplayClip = v; saveSettings(); })),
      row(t('تایپ کردن پاسخ'), t('برای کارت‌های «معنی ← آلمانی» و شنیداری'), sw(S.settings.typing, (v) => { S.settings.typing = v; saveSettings(); }))),
    h('div', { class: 'sect-t' }, t('🃏 نوع کارت‌های واژهِ جدید')),
    h('div', { class: 'card' }, ...[['de2m', t('آلمانی ← معنی'), null], ['m2de', t('معنی ← آلمانی'), null], ['clip', t('شنیداری + جای خالی'), t('کلیپ همان صحنه؛ برای واژه‌های ذخیره‌شده از ویدیو')]]
      .map(([k, l, s]) => row(l, s, sw(S.settings.kinds[k], (v) => { S.settings.kinds[k] = v; if (!Object.values(S.settings.kinds).some(Boolean)) S.settings.kinds.de2m = true; saveSettings(); })))));

  // ---------- backup
  const ta = h('textarea', { class: 'input', style: { minHeight: '100px', direction: 'ltr', fontFamily: 'monospace', fontSize: '12px' }, placeholder: t('متن پشتیبان یا CSV را اینجا بچسبان') });
  const impFile = h('input', { type: 'file', accept: '.json,.csv,.tsv,.txt', style: { display: 'none' } });
  impFile.addEventListener('change', async () => { const f = impFile.files[0]; if (f) { ta.value = await f.text(); toast(t('فایل خوانده شد؛ «وارد کردن» را بزن')); } });
  document.body.append(impFile); setTimeout(() => impFile.remove(), 900000);
  const out = (name, text, mime) => { if (download(name, text, mime)) toast(t('فایل ساخته شد')); else { ta.value = text; toast(t('دانلود ممکن نبود؛ متن در کادر پایین است')); } };
  const syncStatus = h('div', { class: 'sync-st' });
  const tokIn = h('input', { class: 'input', type: 'password', placeholder: t('توکن GitHub'), value: getToken(), autocomplete: 'off' });
  const paintSync = () => { const l = lastSync(); syncStatus.textContent = l ? t('آخرین همگام‌سازی: {0}', new Date(l).toLocaleString(locale)) : t('هنوز همگام‌سازی نشده'); };
  paintSync();
  const doSync = async () => {
    setToken(tokIn.value);
    if (!getToken()) { toast(t('توکن درست نیست')); return; }
    syncBtn.disabled = true;
    try { const n = await syncNow(); paintSync(); toast(t('همگام‌سازی شد ✓')); if (n) { root.replaceChildren(); renderSettings(root, nav); } }
    catch (e) { toast(e.message || t('اتصال به GitHub ناموفق بود')); }
    syncBtn.disabled = false;
  };
  const syncBtn = h('button', { class: 'btn', onclick: doSync }, t('همگام‌سازی الان'));
  root.append(h('div', { class: 'sect-t' }, t('☁️ همگام‌سازی بین دستگاه‌ها')),
    h('div', { class: 'card', style: { padding: '14px 16px' } },
      h('div', { class: 'sync-help' }, t('واژه‌ها، کارت‌ها، مارک‌ها، پیشرفت و آمار روی یک Gist خصوصی در GitHub خودت ذخیره می‌شود. روی هر دو دستگاه (اپ و وب) همان توکن را وارد کن.')),
      h('div', { class: 'sync-help' }, t('توکن را از github.com/settings/tokens بساز: Generate new token (classic) و فقط تیک gist را بزن.')),
      h('div', { class: 'sync-help' }, t('کلیپ‌ها همگام نمی‌شوند؛ آن‌ها را روی هر دستگاه جدا اضافه کن.')),
      tokIn,
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 0 6px' } },
        h('button', { class: 'btn sec sm', onclick: () => { setToken(tokIn.value); toast(t('ذخیره شد ✓')); } }, t('ذخیره توکن')),
        syncBtn,
        h('button', { class: 'btn ghost sm', onclick: () => { setToken(''); tokIn.value = ''; paintSync(); } }, t('قطع اتصال'))),
      syncStatus));
  root.append(h('div', { class: 'sect-t' }, t('💾 پشتیبان و انتقال')),
    h('div', { class: 'card', style: { padding: '14px 16px' } },
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' } },
        h('button', { class: 'btn sec sm', onclick: () => out('klipp-backup.json', JSON.stringify(exportAll()), 'application/json') }, h('span', { html: ic('down') }), t('پشتیبان کامل')),
        h('button', { class: 'btn sec sm', onclick: () => out('klipp-vocab.csv', vocabCSV(), 'text/csv') }, h('span', { html: ic('down') }), t('واژگان (CSV)')),
        h('button', { class: 'btn ghost sm', onclick: () => impFile.click() }, h('span', { html: ic('up') }), t('انتخاب فایل')),
        h('button', { class: 'btn ghost sm', onclick: async () => { const js = JSON.stringify(exportAll()); ta.value = js; toast((await copyText(js)) ? t('پشتیبان کپی شد') : t('متن را در کادر پایین می‌بینی')); } }, t('کپی پشتیبان'))),
      ta,
      h('button', { class: 'btn block', style: { marginTop: '10px' }, onclick: async () => {
        const txt = ta.value.trim(); if (!txt) { toast(t('چیزی برای وارد کردن پیدا نشد')); return; }
        try {
          if (txt.startsWith('{')) { await importAll(JSON.parse(txt)); toast(t('پشتیبان وارد شد ✓')); } else { toast(t('{0} واژه وارد شد', fa(importCSV(txt)))); }
          ta.value = '';
        } catch (e) { toast(e.message || t('فرمت نامعتبر')); }
      } }, t('وارد کردن')),
      h('div', { style: { fontSize: '12.5px', color: 'var(--muted)', marginTop: '10px', lineHeight: 1.7 } }, t('CSV برای Anki/Quizlet: ستون‌های de, fa, en (و اختیاری sentence_de). جداکننده: کاما، سمی‌کالن یا تب.'))),
    h('div', { class: 'sect-t' }, t('⚠️ خطر')),
    h('div', { class: 'card' }, row(t('پاک‌کردن واژه‌ها و پیشرفت'), t('ویدیوها پاک نمی‌شوند'), h('button', { class: 'btn danger sm', onclick: async () => {
      if (!(await confirmSheet({ title: t('مطمئنی می‌خواهی همه‌چیز را پاک کنی؟'), text: t('واژه‌ها، کارت‌ها، مارک‌ها و پیشرفتت پاک می‌شود. بهتر است اول یک پشتیبان بگیری.'), okText: t('پاک کن'), danger: true }))) return;
      for (const s of ['vocab', 'cards', 'marks', 'progress']) { await DB.clear(s); S[s].clear(); }
      S.days = {}; await DB.put('meta', { id: 'days', v: {} }); toast(t('پاک شد')); nav('home');
    } }, t('پاک کردن')))),
    h('div', { style: { textAlign: 'center', color: 'var(--muted)', fontSize: '12px', padding: '20px 0 6px' } }, 'Clipboard · v2.0.0 — Nicos Weg & Momente'));
  collapsible(root);
}

// every ".sect-t" heading folds the cards below it (state remembered)
function collapsible(root) {
  let open; try { open = JSON.parse(localStorage.getItem('lc-sect') || 'null'); } catch (e) { open = null; }
  open = open || { '🎬': 1, '🎨': 1 };
  let cur = null;
  [...root.children].forEach((el) => {
    if (el.classList.contains('sect-t')) {
      const key = el.textContent.trim().slice(0, 2); const body = h('div', { class: 'sect-body' });
      el.after(body); cur = body;
      const on = !!open[key]; body.hidden = !on; el.classList.add('fold'); el.classList.toggle('open', on);
      el.addEventListener('click', () => { const o = body.hidden; body.hidden = !o; el.classList.toggle('open', o); open[key] = o ? 1 : 0; try { localStorage.setItem('lc-sect', JSON.stringify(open)); } catch (e) { /* ignore */ } });
    } else if (cur && !el.classList.contains('page-h')) cur.append(el);
  });
}
