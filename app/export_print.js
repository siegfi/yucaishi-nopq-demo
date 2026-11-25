'use strict';
// NOPQ通 可列印版面（第 3 批；2026-11-24）。一般 script，掛 window.NX.print。純字串＋DOM，不連網、不用外部套件。
// 用法：NX.print.open(docOrDocs, opts) 在新分頁開一頁乾淨的 A4 版面（頂上有〔列印／存成 PDF〕，列印時自動隱藏）；
//       NX.print.printHere(docOrDocs, opts) 不開新分頁：放進列印專用容器（螢幕上看不到）、直接叫出列印。
// doc 的形狀同 NX.docx.buildDocBytes：{title, deptName, text | sections:[{heading, text, photo}], studentName?, charCount?}；一系要交的給 NX.print.fromDept(pack) 轉成 docs。
// 第 2 期設計基礎：新分頁連 nopq-base.css，只用它的變數（--fs-*、--text、--muted、--line…）與 .btn（≥44px）；列印時字級用 pt，只寫在 @media print 裡。
(function (root) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SHARED = '全部志願共用';
  const nlen = (s) => String(s || '').replace(/\s/g, '').length;
  const lines = (t) => String(t == null ? '' : t).replace(/\r\n?/g, '\n').split('\n').map((l) => (l === '' ? '<p class="blank">&nbsp;</p>' : '<p>' + esc(l) + '</p>')).join('');
  function sheetHtml(doc) {   // 一篇＝一張 .nx-sheet
    const secs = Array.isArray(doc.sections) ? doc.sections : [{ heading: '', text: doc.text }];
    let n = 0, chars = 0, body = '';
    secs.forEach((s) => {
      if (s.heading) body += '<h2>' + esc(s.heading) + '</h2>';
      body += lines(s.text); chars += nlen(s.text);
      if (s.photo) { n++; body += '<div class="nx-photo">〔圖 ' + n + '：' + esc((s.photo && s.photo.caption) || '圖說') + '〕</div>'; }
    });
    const count = doc.charCount != null ? doc.charCount : chars;
    // 2026-11-24 主線：一系要交的（planDept 給的 showMeta＝false）不印學生／系名／字數，同 Word；單篇照印
    const meta = doc.showMeta === false ? '' : '<div class="nx-meta">' + (doc.studentName ? '<div>學生：' + esc(doc.studentName) + '</div>' : '')
      + '<div>系名：' + esc(doc.deptName || SHARED) + '</div><div>字數：' + count + '</div></div>';
    return '<section class="nx-sheet"><h1>' + esc(doc.title) + '</h1>' + meta + '<div class="nx-body">' + body + '</div></section>';
  }
  const toDocs = (x) => (Array.isArray(x) ? x : [x]).filter(Boolean);
  const sheetsHtml = (x) => toDocs(x).map(sheetHtml).join('');
  function fromDept(pack) {   // 一系要交的資料（同 NX.docx.buildDeptFiles 的輸入）→ docs；沒定稿的篇不放
    const D = root.NX && root.NX.docx; return D && D.planDept ? D.planDept(pack).groups.map((g) => g.doc) : [];
  }
  // 列印樣式：版面樣式都在 .nx-sheet 底下，螢幕上是一張白紙；@media print 才用 pt、A4、頁邊距
  const PRINT_CSS = '.nx-sheet{background:var(--bg);color:var(--text);max-width:calc(210mm);margin:0 auto 16px;padding:16px;border:1px solid var(--line);border-radius:var(--radius);font-size:var(--fs-base);line-height:1.8;font-family:"標楷體","DFKai-SB","BiauKai","Times New Roman",serif}'
    + '.nx-sheet h1{font-size:var(--fs-lg);text-align:center;margin:0 0 8px}.nx-sheet h2{font-size:var(--fs-lg);margin:16px 0 4px}'
    + '.nx-meta{font-size:var(--fs-sm);color:var(--muted);border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:12px}'
    + '.nx-body p{margin:0;text-indent:2em;overflow-wrap:anywhere}.nx-body p.blank{text-indent:0}'
    + '.nx-photo{border:1px solid var(--border-strong);min-height:90px;display:flex;align-items:center;justify-content:center;margin:8px 0;text-align:center;break-inside:avoid}'
    + '.nx-bar{position:sticky;top:0;z-index:2;background:var(--soft);padding:8px 16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.nx-bar .nx-tip{font-size:var(--fs-sm);color:var(--muted)}'
    + '#nx-print-root{display:none}'
    + '@media print{@page{size:A4;margin:25.4mm}html,body{background:var(--white)!important}.nx-bar,.nx-noprint{display:none!important}'
    + '.nx-sheet{max-width:none;margin:0;padding:0;border:0;border-radius:0;font-size:12pt;line-height:1.8;color:var(--text);break-after:page}.nx-sheet:last-child{break-after:auto}'
    + '.nx-sheet h1{font-size:14pt}.nx-sheet h2{font-size:14pt;break-after:avoid}.nx-meta{font-size:12pt;color:var(--text);border-color:var(--text)}.nx-photo{border-color:var(--text);min-height:60mm}'
    + 'body.nx-printing>*:not(#nx-print-root){display:none!important}body.nx-printing #nx-print-root{display:block!important}}';
  const IOS_TIP = 'iPhone：按分享，選「列印」，兩指在預覽上放大，再按分享存成檔案。';
  function pageHtml(docs, opts) {
    opts = opts || {}; const base = opts.cssHref || (typeof document !== 'undefined' ? new URL('nopq-base.css', document.baseURI).href : 'nopq-base.css');
    return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(opts.title || (toDocs(docs)[0] || {}).title || '列印') + '</title>'
      + '<link rel="stylesheet" href="' + esc(base) + '"><style>body{margin:0;background:var(--soft);font-family:var(--font);font-size:var(--fs-base)}' + PRINT_CSS + '</style></head><body>'
      + '<div class="nx-bar"><button type="button" class="btn" onclick="window.print()">列印／存成 PDF</button><span class="nx-tip">' + esc(opts.tip || '在列印畫面選「另存為 PDF」。' + IOS_TIP) + '</span></div>'
      + sheetsHtml(docs) + '</body></html>';
  }
  function open(docs, opts) {   // 回 true＝新分頁開了；false＝被擋（呼叫端改用 printHere 或請學生允許彈出視窗）
    try {
      const w = root.open('', '_blank'); if (!w) return false;
      w.document.open(); w.document.write(pageHtml(docs, opts)); w.document.close(); try { w.focus(); } catch (e) { /* 略 */ } return true;
    } catch (e) { return false; }
  }
  function printHere(docs, opts) {   // 放進列印專用容器、直接列印；列印完清掉
    try {
      const d = root.document; let box = d.getElementById('nx-print-root');
      if (!box) { box = d.createElement('div'); box.id = 'nx-print-root'; d.body.appendChild(box); }
      if (!d.getElementById('nx-print-css')) { const st = d.createElement('style'); st.id = 'nx-print-css'; st.textContent = PRINT_CSS; d.head.appendChild(st); }
      box.innerHTML = sheetsHtml(docs); d.body.classList.add('nx-printing');
      const done = () => { d.body.classList.remove('nx-printing'); box.innerHTML = ''; root.removeEventListener('afterprint', done); };
      root.addEventListener('afterprint', done); root.print(); return true;
    } catch (e) { return false; }
  }
  // LINE 內建瀏覽器常擋下載與列印：偵測到就回一句提示，否則回空字串
  const isLine = (ua) => /\bLine\//i.test(ua == null ? ((root.navigator && root.navigator.userAgent) || '') : ua);
  const lineHint = (ua) => (isLine(ua) ? '用手機瀏覽器開才能下載。' : '');
  root.NX = root.NX || {};
  root.NX.print = { open, printHere, pageHtml, sheetsHtml, fromDept, isLine, lineHint, css: PRINT_CSS, IOS_TIP };
})(typeof window !== 'undefined' ? window : globalThis);
