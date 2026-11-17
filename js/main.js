import { t } from './i18n.js';
import { S, init, counts } from './state.js';
import * as Videos from './videos.js';
import { h, ic, fa } from './util.js';
import { renderHome } from './home.js';
import { renderPlayer } from './player.js';
import { renderReview } from './review.js';
import { renderVocab } from './vocab.js';
import { renderMarks } from './marks.js';
import { renderSettings } from './settings.js';

const view = document.getElementById('view');
const tabsEl = document.getElementById('tabs');
const TABS = [['home', t('خانه'), 'home'], ['review', t('مرور'), 'zap'], ['vocab', t('واژگان'), 'book'], ['marks', t('مارک‌ها'), 'bookmark'], ['settings', t('تنظیمات'), 'settings']];
let cleanup = null, pending = {}, seq = 0;

export function nav(name, opts) {
  pending = opts || {};
  const target = '#' + name;
  if (location.hash === target) render(); else location.hash = target;
}

async function render() {
  const my = ++seq;
  if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
  const name = (location.hash || '#home').slice(1) || 'home';
  const opts = pending; pending = {};
  view.replaceChildren(); view.className = ''; view.scrollTop = 0;
  document.body.classList.remove('noTabs');
  let key = name;
  try {
    if (name.startsWith('p-') && S.lessonMap.has(name.slice(2))) {
      view.classList.add('full'); key = '';
      const c = await renderPlayer(view, name.slice(2), { nav, ...opts });
      if (my !== seq) { c && c(); return; } cleanup = c;
    } else if (name === 'review') {
      view.classList.add('full'); key = '';
      const c = await renderReview(view, { nav, ...opts });
      if (my !== seq) { c && c(); return; } cleanup = c;
    } else if (name === 'vocab') renderVocab(view, nav);
    else if (name === 'marks') renderMarks(view, nav);
    else if (name === 'settings') await renderSettings(view, nav);
    else { key = 'home'; renderHome(view, nav); }
  } catch (e) {
    console.error(e);
    view.append(h('div', { class: 'empty' }, h('b', null, t('مشکلی پیش آمد')), String(e && e.message || e), h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: () => nav('home') }, t('خانه')))));
  }
  [...view.children].slice(0, 14).forEach((el, i) => el.style.setProperty('--i', i));
  drawTabs(key);
}

function drawTabs(active) {
  tabsEl.replaceChildren();
  const due = counts().due;
  tabsEl.append(h('div', { class: 'bar' }, TABS.map(([id, label, icon]) => h('button', { class: active === id ? 'on' : '', onclick: () => nav(id), 'aria-label': label },
    h('span', { html: ic(icon) }), label, id === 'review' && due ? h('span', { class: 'badge num' }, fa(due > 99 ? '99+' : due)) : null))));
}

document.title = 'Clipboard';
function applyTheme() {
  document.documentElement.dataset.theme = S.settings.theme || 'auto';
  const dark = S.settings.theme === 'dark' || (S.settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#0e131b' : '#f5f2ec';
}

(async function boot() {
  try {
    await init();
    await Videos.refresh();
    applyTheme();
    window.addEventListener('hashchange', render);
    await render();
    if (!window.KlippApp && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  } catch (e) {
    console.error(e);
    view.append(h('div', { class: 'empty' }, h('b', null, t('اپ بالا نیامد')), String(e && e.message || e)));
  }
})();
