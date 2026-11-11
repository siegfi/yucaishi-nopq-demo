/* 第 4 幕指引卡與摘要句：純函式（不碰頁面、不連網），放在獨立區塊，離線測試（tests/walk_guide.mjs）直接載入這一塊。 */
(function (root) {
'use strict';
var DOCS = ['N', 'O', 'P', 'Q'];
var DOC_SHORT = { N: 'N 多元表現綜整', O: 'O 學習歷程反思', P: 'P 就讀動機', Q: 'Q 未來計畫' };
var LPN = { safe: '保底', reach: '正常', dream: '夢幻' };   // 2026-11-09 owner 改名
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function safeUrl(u) { return /^https:\/\//i.test(u || '') ? u : ''; }
function s2Line(s2) {
  if (!s2) return '二階資料還沒有';
  var parts = [];
  if (s2.gsatPct != null) parts.push('學測 ' + s2.gsatPct + '%');
  (s2.items || []).forEach(function (it) { parts.push(it.name + (it.pct != null ? ' ' + it.pct + '%' : '')); });
  return parts.join('｜') || '二階資料還沒有';
}
function s2Facts(s2) {
  var items = (s2 && s2.items) || [], rev = items.find(function (x) { return /審查/.test(x.name || ''); });
  return { hasReview: !!rev, reviewPct: rev ? rev.pct : null,
    written: !!(s2 && s2.hasWritten) || items.some(function (x) { return /筆試/.test(x.name || ''); }),
    interview: !!(s2 && s2.hasInterview) || items.some(function (x) { return /面試|口試/.test(x.name || ''); }) };
}
function snapPill(s) { return s && s.code && LPN[s.code] ? '<span class="lp ' + esc(s.code) + '">' + LPN[s.code] + '</span>' : ''; }
// 一系的指引：有沒有、是哪一態。missing＝學校沒公開或還沒整理（guide 為 null 或 guideSource 是 missing）
function hasGuide(it) { return !!(it && it.guide && typeof it.guide === 'object' && it.guideSource !== 'missing'); }
function reqState(g, k) { var d = g && g[k]; return d && typeof d === 'object' ? (d.required === true ? 'must' : d.required === false ? 'opt' : 'none') : 'none'; }
function factsOf(it) {
  var f0 = s2Facts(it.stage2);
  return { hasReview: it.reviewPct != null ? it.reviewPct > 0 : f0.hasReview, reviewPct: it.reviewPct != null ? it.reviewPct : f0.reviewPct,
    written: it.written != null ? !!it.written : f0.written, interview: it.interview != null ? !!it.interview : f0.interview };
}
// 頁首摘要句：全部從各系資料數出來。例「6 系都要 N，5 系要 O，4 系要 P，3 系要 Q；3 系有筆試、1 系有面試。」
function guideSummary(items) {
  items = items || []; var total = items.length; if (!total) return '';
  var parts = [], withG = items.filter(hasGuide), miss = total - withG.length;
  DOCS.forEach(function (k) {
    var c = withG.filter(function (it) { return reqState(it.guide, k) === 'must'; }).length;
    if (c) parts.push(c === total ? total + ' 系都要 ' + k : c + ' 系要 ' + k);
  });
  var nosplit = withG.filter(function (it) { return DOCS.every(function (k) { return reqState(it.guide, k) === 'none'; }); }).length;
  if (nosplit) parts.push(nosplit + ' 系指引沒分項');
  if (miss) parts.push(miss + ' 系的指引還沒整理');
  var fs = items.map(factsOf), w = fs.filter(function (x) { return x.written; }).length, iv = fs.filter(function (x) { return x.interview; }).length;
  var exam = (w ? w + ' 系有筆試' : '沒有筆試') + '、' + (iv ? iv + ' 系有面試' : '沒有面試');
  return (parts.length ? parts.join('，') + '；' : '') + exam + '。';
}
function limitText(l) {
  if (!l || typeof l !== 'object') return '';
  var body = l.quote;
  if (!body) { var b = []; if (l.chars != null) b.push('最多 ' + l.chars + ' 字'); if (l.pages != null) b.push((b.length ? '' : '最多 ') + l.pages + ' 頁'); if (l.images != null) b.push(l.images + ' 張圖'); body = b.join('、'); }
  return body ? (l.applies ? l.applies + '：' : '') + body : '';
}
function needLine(g) {
  var st = DOCS.map(function (k) { return reqState(g, k); });
  if (st.every(function (s) { return s === 'none'; })) return '<span class="pill warn">指引沒分項，照官方連結</span>';
  return DOCS.map(function (k, i) {
    return st[i] === 'must' ? '<span class="pill ok">' + k + ' 必交</span>' : st[i] === 'opt' ? '<span class="pill">' + k + ' 選交</span>' : '<span class="pill warn">' + k + ' 指引沒分項</span>';
  }).join('');
}
// 2026-11-08 owner 試用回饋 #3（W2）：卡片頂端「老師幫你畫重點」。只用指引資料裡真的有的欄位條列；沒指引的系只講二階（下方原本就有「先看校系分則」）
function digestLines(it) {
  var g = hasGuide(it) ? it.guide : null, f = factsOf(it), out = [];
  var gs = it.stage2 && it.stage2.gsatPct != null ? it.stage2.gsatPct : null;
  if (f.hasReview && f.reviewPct != null) {
    out.push('二階審查資料占 ' + f.reviewPct + '%' + (gs == null ? '' : f.reviewPct > gs ? '，比學測（' + gs + '%）還重，書面資料要花心思' : f.reviewPct === gs ? '，跟學測一樣重' : '，學測占 ' + gs + '%') + '。');
  }
  var ex1 = [f.written ? '筆試' : '', f.interview ? '面試' : ''].filter(Boolean);
  if (ex1.length) out.push('另外有' + ex1.join('和') + '，要另外準備。');
  if (!g) return out;
  var its = (Array.isArray(g.items) ? g.items : []).filter(function (x) { return x && x.label && DOCS.indexOf(x.code) < 0; });
  if (its.length) out.push('要準備的資料：' + its.map(function (x) { return x.label; }).join('、') + '。');
  var must = DOCS.filter(function (k) { return reqState(g, k) === 'must'; }), opt = DOCS.filter(function (k) { return reqState(g, k) === 'opt'; });
  if (must.length || opt.length) out.push('你要寫的自述：' + (must.length ? must.join('、') + ' 必交' : '') + (must.length && opt.length ? '；' : '') + (opt.length ? opt.join('、') + ' 選交' : '') + '。');
  var lims = (Array.isArray(g.limits) ? g.limits : []).map(limitText).filter(Boolean);
  if (lims.length) out.push('篇幅：' + lims.slice(0, 2).join('；') + (lims.length > 2 ? '（另有 ' + (lims.length - 2) + ' 條，見下方）' : ''));
  var qs = DOCS.map(function (k) { var d = g[k], n = d && Array.isArray(d.prompts) ? d.prompts.filter(Boolean).length : 0; return n ? k + ' ' + n + ' 題' : ''; }).filter(Boolean);
  if (qs.length) out.push('系上指定要回答的題目：' + qs.join('、') + '（原文在下方「自述要答」）。');
  var emp = (Array.isArray(g.emphasis) ? g.emphasis : []).filter(function (t) { return typeof t === 'string' && t; }).slice(0, 2);
  var jn = function (a) { return a.map(function (t) { return t.replace(/[。；;，,\s]+$/, ''); }).join('；') + '。'; };   // 原句多半自帶句號，接起來不要「。；」
  if (emp.length) out.push('系上特別強調：' + jn(emp));
  var iv = g.interview && Array.isArray(g.interview.notes) ? g.interview.notes.filter(function (t) { return typeof t === 'string' && t && !/面試現場為準|僅供參考|提供參考/.test(t); }) : [];
  if (iv.length) out.push('面試會看：' + jn(iv.slice(0, 3)).replace(/。$/, iv.length > 3 ? '…' : '。'));
  var ex = (Array.isArray(g.extra) ? g.extra : []).filter(function (t) { return typeof t === 'string' && t && !/^[A-Z]\s*[.．、]/.test(t); });
  ex = ex.filter(function (t, i) { return ex.indexOf(t) === i; }).slice(0, 2);
  if (ex.length) out.push('另外提醒：' + jn(ex));
  return out;
}
function renderDigest(it) {
  var l = digestLines(it);
  return l.length ? '<div class="digest"><b>老師幫你畫重點</b><ul class="plain">' + l.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' : '';
}
function renderGuideCard(it) {
  var f = factsOf(it), g = hasGuide(it) ? it.guide : null, name = (it.schoolName || '') + ' ' + (it.name || '');
  var h = '<div class="need guide-card"><div class="row spread"><b>' + esc(it.rank) + '. ' + esc(name.trim()) + '</b>' + snapPill(it.snapshot) + '</div>'
    + renderDigest(it)
    + '<div class="facts"><span><span class="k">審查資料</span>' + (f.hasReview ? (f.reviewPct != null ? esc(f.reviewPct) + '%' : '有') : '沒有') + '</span><span><span class="k">筆試</span>' + (f.written ? '有' : '沒有')
    + '</span><span><span class="k">面試</span>' + (f.interview ? '有' : '沒有') + '</span><span><span class="k">名額</span>' + (it.quota != null ? esc(it.quota) : '—') + '</span></div>'
    + '<div class="muted small">二階：' + esc(s2Line(it.stage2)) + '</div>';
  if (!g) {
    var rules = safeUrl(it.rulesUrl);
    return h + '<div class="gline">這系的指引學校沒公開／還沒整理，先看校系分則。' + (rules ? ' <a href="' + esc(rules) + '" target="_blank" rel="noopener noreferrer">' + esc(name.trim()) + ' 校系分則</a>' : '') + '</div></div>';
  }
  var src = g.source || {}, shared = Array.isArray(src.coversDepts) && src.coversDepts.length > 1;
  h += '<div class="gline"><span class="k">要交　</span>' + needLine(g) + (shared ? '<span class="pill">全校共用指引</span>' : '') + '</div>';
  var lims = (Array.isArray(g.limits) ? g.limits : []).map(limitText).filter(Boolean);
  if (lims.length) h += '<div class="gline"><span class="k">限制　</span>' + lims.map(esc).join('；') + '</div>';
  var abs = (Array.isArray(g.abilities) ? g.abilities : []).map(function (a) { return a && (a.term || a.quote); }).filter(Boolean).slice(0, 3);
  if (abs.length) h += '<div class="gline"><span class="k">這系看重</span><ul class="plain ab">' + abs.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
  var pr = '';
  DOCS.forEach(function (k) {
    var d = g[k]; if (!d || !Array.isArray(d.prompts)) return;
    d.prompts.filter(Boolean).forEach(function (t) { pr += '<li><b>' + k + '</b> ' + esc(t) + '</li>'; });   // 2026-11-08 W4：P、Q 已可寫，拿掉「之後寫」
  });
  if (pr) h += '<div class="gline"><span class="k">自述要答</span><ul class="plain pr">' + pr + '</ul></div>';
  var url = safeUrl(src.url), sn = it.schoolName || src.schoolName || '', dn = it.name || src.deptName || '';
  if (url) h += '<div class="gline"><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc((sn + ' ' + dn).trim() + ' ' + (g.year || 115) + ' 學年度審查資料準備指引（官方）') + '</a></div>';
  else h += '<div class="gline muted">官方連結還沒有，請看校系分則' + (safeUrl(it.rulesUrl) ? '：<a href="' + esc(it.rulesUrl) + '" target="_blank" rel="noopener noreferrer">校系分則</a>' : '') + '。</div>';
  var cf = g.confidence && typeof g.confidence === 'object' ? g.confidence : {};
  if (Object.keys(cf).some(function (k) { return cf[k] === 'low'; }) || !g.reviewedBy) h += '<div class="gfoot">機器整理，老師還沒確認；以官方連結為準</div>';
  return h + '</div>';
}
// 新作落點分析「這系在做什麼」（2026-11-09 設計稿 §4.1、§4.3①）：只用專案裡已有、查得到出處的資料拼句；
// 第一期不寫「這系在學什麼、畢業做什麼」這類摘要（寧缺勿編）。d＝CAAC_DEPTS 一筆；info＝dept_info 的一筆（可為 null）；has116＝示範庫有沒有匯 116。
function deptIntroLines(d, info, has116) {
  var out = [], y = (info && info.y) || {}, y6 = info && info.y116, intro = info && info.intro;
  if (d && d.group) out.push({ k: 'group', text: '屬於' + d.group });
  out.push({ k: 'stage2', text: '這系看：' + s2Line(d && d.stage2).replace(/｜/g, '、') });
  if (safeUrl(y.rulesUrl)) out.push({ k: 'rules115', text: '115 校系分則（甄選會）', url: y.rulesUrl });
  if (has116 && y6) {
    if (safeUrl(y6.rulesUrl)) out.push({ k: 'rules116', text: '116 校系分則（甄選會）', url: y6.rulesUrl });
    var items = (Array.isArray(y6.reviewItems) ? y6.reviewItems : []).map(function (x) { return x && (x.text || x.name); }).filter(Boolean);
    if (items.length) out.push({ k: 'need116', text: '116 簡章寫要交：' + items.join('、') });
    if (y6.reviewDesc) { var t = String(y6.reviewDesc).replace(/\s+/g, ' ').trim(); out.push({ k: 'desc116', text: '116 簡章說明原文：' + (t.length > 300 ? t.slice(0, 300) + '…' : t) }); }
    var seen = {};
    (Array.isArray(y6.links) ? y6.links : []).forEach(function (l) {
      var u = l && l.url;
      if (!l || l.via !== 'plaintext' || !safeUrl(u) || /cac\.edu\.tw/i.test(u) || seen[u] || Object.keys(seen).length >= 3) return;
      // 2026-11-10 L6a 抽查：分則上印的網址有系所網站、也有學校招生處網頁（例：reg.aca.ntu.edu.tw），不一律叫「系所網站」，照實寫主機名
      var host = (/^https?:\/\/([^\/?#]+)/i.exec(u) || [])[1] || u;
      seen[u] = 1; out.push({ k: 'site', text: '116 分則上印的網址：' + host, url: u });
    });
  }
  if (y.guideSource === 'official' && safeUrl(y.guideSourceUrl)) out.push({ k: 'guide', text: '學校的準備指引', url: y.guideSourceUrl });
  // 2026-11-10 L6b（owner「只接 ColleGo」）：外部介紹只放連結、不轉載內容，標來源與查證日（查證紀錄 source_assets/dept_intro_sources/00_查證紀錄.md）
  (intro && Array.isArray(intro.links) ? intro.links : []).forEach(function (l) {
    if (!l || !safeUrl(l.url)) return;
    out.push({ k: 'ext', text: (l.name || '外部介紹') + (l.checkedAt ? '・' + String(l.checkedAt).slice(0, 10) + ' 查證' : ''), url: l.url });
  });
  if (intro && intro.teacherNote) out.push({ k: 'teacher', text: intro.teacherNote, by: intro.teacherBy || '', at: intro.teacherAt || '' });
  return out;
}
function renderDeptIntro(lines, fmtDate) {
  var mach = lines.filter(function (l) { return l.k !== 'teacher'; }), tea = lines.filter(function (l) { return l.k === 'teacher'; });
  var li = function (l) { return '<li>' + (l.url ? '<a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.text) + '</a>' : esc(l.text)) + '</li>'; };
  return '<ul class="ilist">' + mach.map(li).join('') + '</ul><div class="muted small">機器整理，老師還沒確認。</div>'
    + tea.map(function (l) { return '<div class="tnote"><b>老師寫的</b>　' + esc(l.text) + '<span class="muted small">　— ' + esc(l.by) + (l.at && fmtDate ? '・' + esc(fmtDate(l.at)) : '') + '</span></div>'; }).join('');
}
root.NG = { DOC_SHORT: DOC_SHORT, deptIntroLines: deptIntroLines, renderDeptIntro: renderDeptIntro, esc: esc, safeUrl: safeUrl, s2Line: s2Line, s2Facts: s2Facts, snapPill: snapPill, hasGuide: hasGuide, reqState: reqState, factsOf: factsOf, guideSummary: guideSummary, limitText: limitText, digestLines: digestLines, renderDigest: renderDigest, renderGuideCard: renderGuideCard };
})(typeof window !== 'undefined' ? window : globalThis);
