// Проверка лендинга без глаз: переполнение, картинки, ссылки, консоль.
const path = require('path');
const { launch, waitForWs, CDP, openPage, evalJs } = require('../donates-demo/recording/cdp.js');

const FILE = 'file://' + path.resolve(__dirname, 'index.html');
const PORT = 9341;

const PROBE = `(() => {
  const de = document.documentElement;
  const imgs = [...document.images].map(i => ({src: i.getAttribute('src'), w: i.naturalWidth, h: i.naturalHeight, ok: i.complete}));
  const vids = [...document.querySelectorAll('video')].map(v => ({src: v.getAttribute('src'), rs: v.readyState, dur: Math.round((v.duration || 0) * 10) / 10, w: v.videoWidth, h: v.videoHeight, poster: v.getAttribute('poster')}));
  const overflow = [...document.querySelectorAll('body *')]
    .filter(el => el.scrollWidth - el.clientWidth > 2 && getComputedStyle(el).overflowX !== 'auto')
    .slice(0, 12)
    .map(el => el.tagName + '.' + (el.className || '') + ' sw=' + el.scrollWidth + ' cw=' + el.clientWidth);
  const anchors = [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.querySelector(h));
  const ext = [...document.querySelectorAll('a[href^="http"]')].map(a => a.href);
  const sections = [...document.querySelectorAll('section[id]')].map(s => s.id);
  const rects = ['case-1','case-2','case-3','contact'].map(id => {
    const el = document.getElementById(id); if (!el) return id + ':missing';
    const r = el.getBoundingClientRect();
    return id + ':' + Math.round(r.top + window.scrollY) + 'h' + Math.round(r.height);
  });
  return {
    viewport: window.innerWidth + 'x' + window.innerHeight,
    scrollWidth: de.scrollWidth, clientWidth: de.clientWidth,
    docHeight: de.scrollHeight,
    hOverflow: de.scrollWidth - de.clientWidth,
    imgs, vids, overflow, deadAnchors: anchors, sections, rects,
    external: ext.length,
    h1: document.querySelectorAll('h1').length,
    h2: document.querySelectorAll('h2').length,
    textLen: document.body.innerText.length
  };
})()`;

(async () => {
  const proc = launch({ port: PORT, userDir: '/tmp/cdp-landing', width: 1280, height: 900 });
  const reports = [];
  try {
    const ws = await waitForWs(PORT);
    const cdp = await CDP.connect(ws);
    for (const [label, w, h] of [['desktop', 1280, 900], ['mobile', 390, 844]]) {
      const s = await openPage(cdp, FILE, { width: w, height: h, scale: 1, mobile: label === 'mobile' });
      const errs = [];
      cdp.listeners.push(m => {
        if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + JSON.stringify(m.params).slice(0, 200));
        if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errs.push('LOG ' + m.params.entry.text.slice(0, 200));
      });
      await cdp.send('Log.enable', {}, s);
      await new Promise(r => setTimeout(r, 400));
      const out = await evalJs(cdp, s, PROBE);
      reports.push({ label, errs, ...out });
      await cdp.send('Target.closeTarget', { targetId: (await cdp.send('Target.getTargets')).targetInfos.find(t => t.url.startsWith('file://') && t.type === 'page').targetId }).catch(() => {});
    }
  } finally {
    try { proc.kill(); } catch (e) {}
  }

  let bad = 0;
  for (const r of reports) {
    const brokenImgs = r.imgs.filter(i => !i.ok || i.w === 0);
    console.log(`\n=== ${r.label} ${r.viewport} docH=${r.docHeight}`);
    console.log(`horizontal overflow: ${r.hOverflow}px ${r.hOverflow > 0 ? 'FAIL' : 'ok'}`);
    console.log(`images: ${r.imgs.length}, broken: ${brokenImgs.length}`, brokenImgs.map(b => b.src).join(' '));
    const badVids = r.vids.filter(v => !v.dur || v.w === 0);
    console.log(`video: ${JSON.stringify(r.vids)} bad=${badVids.length}`);
    console.log(`element overflow: ${r.overflow.length ? JSON.stringify(r.overflow) : 'none'}`);
    console.log(`dead anchors: ${JSON.stringify(r.deadAnchors)} sections: ${r.sections.join(',')}`);
    console.log(`layout: ${r.rects.join(' ')}`);
    console.log(`h1=${r.h1} h2=${r.h2} textLen=${r.textLen} externalLinks=${r.external}`);
    console.log(`console errors: ${r.errs.length ? JSON.stringify(r.errs) : 'none'}`);
    if (r.hOverflow > 0 || brokenImgs.length || r.deadAnchors.length || r.errs.length || r.h1 !== 1 || r.h2 !== 3 || badVids.length) bad++;
  }
  console.log(bad ? `\nRESULT: ${bad} problem group(s)` : '\nRESULT: clean');
  process.exit(bad ? 1 : 0);
})();
