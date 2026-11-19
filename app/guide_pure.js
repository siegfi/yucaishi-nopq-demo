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
// ══ 2026-11-17 owner「都照建議」第②題：要不要交的用語，學生看得到的字全部集中在這裡（楊老師看過要改，只改這裡）══
// 不再顯示「必交」（11-06 的「必交」只是代碼出現在清單裡，學校沒說必交）。依據兩個來源：116 簡章（甄選會分則）有沒有列、去年（115）學校指引有沒有列；
// 名稱或分則原文寫了「選繳」的才標「選繳」。第①題（題目沒過新檢查就請學生看官方原文）的句子也在這裡。
var WORDS = {
  cac: '116 簡章有列',                 // 這一篇在 116 分則的審查資料項目裡
  cacOpt: '116 簡章有列・選繳',        // 同上，而且原文寫了「選繳」
  guide: '去年指引有列',               // 116 簡章沒列，115 學校指引有列
  none: '簡章和去年指引都沒列',
  nodata: '還沒有資料，以官方分則為準',
  allNone: '簡章和指引都沒分 N、O、P、Q，照官方連結',
  noGuideYet: '指引還沒整理，看官方連結',
  sumListed: '{c} 系列了 {k}',          // 頁首摘要句
  sumListedAll: '{n} 系都列了 {k}',
  sumNone: '{c} 系的簡章和指引都沒分 N、O、P、Q',
  sumMissing: '{c} 系的指引還沒整理',
  digestCac: '116 簡章列了要你寫的：{list}。',
  digestGuide: '去年指引另外列了：{list}。',
  notListed: '這系的 116 簡章和去年指引都沒列 {k}',   // 撰寫頁某一篇旁邊的說明（回饋清單第 42 條那句的新版）
  wishCount: '你的 {total} 個志願系：{parts}。一篇給所有志願系，點進去看每一系對它的要求。',
  wishPart: '{c} 系列了 {k}',
  dlvCount: '列了 {n} 篇，定稿 {f} 篇。',
  dlvAllDone: '列了的都定稿了',
  // 第①題（主線 11-17 驗收後定案）：沒通過新檢查的系，N、O、P、Q 一律用同一句、不點名哪幾篇有題目、不講「沒有題目」
  uncheckedLine: '去年（{y}）學校指引：正在逐系重新核對，核對完之前請看官方原文',   // 指引卡學校指引那一段只留這一行
  uncheckedDigest: '這系去年學校指引的題目我們正在重新核對，寫之前先看官方原文（連結在下方）。',
  uncheckedDoc: '這系去年學校指引的題目我們正在重新核對，寫之前先看官方原文。',   // 寫稿頁對照欄（P、Q 單系）
  uncheckedMulti: '這幾系去年學校指引的題目我們正在重新核對，寫之前先看各系官方原文。',   // 寫稿頁對照欄（N、O 多系）
  uncheckedNoUrl: '這系去年學校指引的題目我們正在重新核對，寫之前先到「審查資料準備指引說明」點官方原文。',   // P、Q 卡沒有對照欄時
  officialLink: '看官方原文',
  officialMissing: '官方連結還沒有，請看校系分則。',
  noGuide: '這系還沒有學校的準備指引（學校沒公開，或我們還沒拿到），先看校系分則。',   // 只有「該系根本沒有 115 指引」才講沒有
  checkedNone: '去年（{y}）學校指引沒有 {k} 的題目。',   // 只有後端 promptsNone＝true（過了新檢查、這一篇確定沒題目）才講沒有（11-18 主線第二次驗收 P1；第三次裁定加年份）
  checkedPending: '去年（{y}）學校指引裡這一篇的題目還在逐條核對，寫之前先看官方原文。',   // 過了檢查、但題目被收起（待複核、共用題目扣住）；不點名、不講沒有（11-18 主線第三次裁定定稿）
  sameCell: '學校把 {codes} 寫在同一格',   // 共用的說明（appliesTo 兩項以上）後面的小標記（11-18 主線第三次裁定定稿）
  focusAsk: '這一篇要回答（自述要答）',
  // 寫稿頁（主線 11-17 驗收 P3）：有對照點（項目層給的題目）才說「照題目寫」「一條一條對照」；沒有就換成下面這幾句
  pqDraftOpen: '照這系的題目寫。寫一段按「儲存」，確定了按「交給老師」。也可以用檔案帶入（Word、PDF、文字檔）。',
  pqDraftOpenNone: '這系的題目先看官方原文。寫一段按「儲存」，確定了按「交給老師」。也可以用檔案帶入（Word、PDF、文字檔）。',
  focusNote: '交給老師之前，一條一條對照，確認每一點都寫到了。老師批改時也會對照這幾點。',
  focusNoteMulti: '交給老師之前，對照一下每一系要的都寫到了沒。老師批改時也會對照這幾點。',
  focusNoteNone: '題目核對好之前，先照官方原文寫；寫好交給老師，老師會幫你看有沒有寫到。',
  focusAskShort: '要回答：',
  needIntro: 'N、O 各寫一篇；P、Q 每個志願系各寫一篇。每系卡片上「116 簡章寫要交」列的是今年簡章的原文；學校指引寫的題目我們正在重新核對，先看官方原文。都在「撰寫NOPQ」寫。',
  q116: '題目：',
  adv116: '說明：',
  optShort: '選繳',
  // 116 簡章區塊（卡片上方、「我要交的」頁）的區名與提示
  z116Title: '{y} 簡章寫要交',
  z116More: '116 簡章另外要交',
  z116Desc: '簡章原文',
  zWrite: '要自己寫的',
  zPrep: '另外準備、不在這裡寫的',
  zOther: '其他資料',
  zPortfolio: '學習歷程檔案',
  notYet: '這一篇還不能在 NOPQ通 裡寫，先照題目準備',
  hintUpload: '作品或影音',
  hintSchoolForm: '學校指定的表格',
  hintProof: '證明或推薦',
  hintUnknown: '怎麼準備請看簡章原文或學校公告',
  digestMore: '{y} 簡章另外要交：{list}。',
  digestQ: '{y} 簡章寫了題目：{list}（原文在上面）。',
};
// 第①題：這一系的學校指引有沒有通過新檢查。後端（28q nopq_guide_withhold）回 checked；沒回（後端還沒套 28q）一律當沒過。
// 沒過的系：115 的逐句內容（題目、篇幅、看重、強調、面試、另外提醒）一句都不畫，只畫同一句＋官方連結；也不講「沒有題目」。
function unchecked(g) { return !!g && g.checked !== true; }
function fill(t, o) { return String(t).replace(/\{(\w+)\}/g, function (_, k) { return o && o[k] != null ? o[k] : ''; }); }
// 某一系某一篇（N–Q）要不要交：cac／cacOpt（116 簡章有列）＞ guide（只有去年指引有列）＞ none；兩邊都沒資料 → nodata
function needOf(it, k) {
  var gi = gi116(it), x = gi ? gi.items.filter(function (y) { return y && y.code === k; })[0] : null;
  if (x) return /選繳/.test((x.needQuote || '') + (x.officialName || '')) ? 'cacOpt' : 'cac';
  var g = hasGuide(it) ? it.guide : null;
  if (!gi && !g) return 'nodata';
  var s = g ? reqState(g, k) : 'none';
  return s === 'must' || s === 'opt' ? 'guide' : 'none';
}
var NEED_PILL = { cac: 'ok', cacOpt: 'ok', guide: '', none: 'warn', nodata: 'warn' };
function needPill(k, st) { return '<span class="pill ' + (NEED_PILL[st] || '') + '">' + esc(k + ' ' + (WORDS[st] || '')) + '</span>'; }
function isListed(st) { return st === 'cac' || st === 'cacOpt' || st === 'guide'; }
// 題目的來源標：116 簡章（分則）／YYY 學校指引（階段二過閘後的學校指引題目，來源 id 以 sg: 開頭）
function srcLabel(p) { return p && p.sourceId && String(p.sourceId).indexOf('sg:') === 0 ? (p.year || '') + ' 學校指引' : (p && p.year ? p.year : 116) + ' 簡章'; }
// 頁首摘要句：全部從各系資料數出來。例「6 系都列了 N，5 系列了 O，4 系列了 P，3 系列了 Q；3 系有筆試、1 系有面試。」
function guideSummary(items) {
  items = items || []; var total = items.length; if (!total) return '';
  var parts = [], miss = items.filter(function (it) { return !hasGuide(it) && !gi116(it); }).length, known = items.filter(function (it) { return hasGuide(it) || gi116(it); });
  DOCS.forEach(function (k) {
    var c = known.filter(function (it) { return isListed(needOf(it, k)); }).length;
    if (c) parts.push(c === total ? fill(WORDS.sumListedAll, { n: total, k: k }) : fill(WORDS.sumListed, { c: c, k: k }));
  });
  var nosplit = known.filter(function (it) { return DOCS.every(function (k) { return !isListed(needOf(it, k)); }); }).length;
  if (nosplit) parts.push(fill(WORDS.sumNone, { c: nosplit }));
  if (miss) parts.push(fill(WORDS.sumMissing, { c: miss }));
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
function needLine(it) {   // 2026-11-17 owner 第②題：參數由 guide 改成整筆志願（要看 116 項目層）
  var st = DOCS.map(function (k) { return needOf(it, k); });
  if (st.every(function (s) { return !isListed(s); })) return '<span class="pill warn">' + esc(WORDS.allNone) + '</span>';
  return DOCS.map(function (k, i) { return needPill(k, st[i]); }).join('');
}
// 2026-11-08 owner 試用回饋 #3（W2）：卡片頂端「老師幫你畫重點」。只用指引資料裡真的有的欄位條列；沒指引的系只講二階（下方原本就有「先看校系分則」）
// 2026-11-17 指引重建階段一（設計稿 guide_rebuild_design_v0.2 第零部 0.6⑥）：每一行帶來源年份（yr），畫面上標「116 簡章」「115 學校指引」。
//   owner 11-16「都照建議」：原本「你要寫的自述（必交／選交）」改成依 116 簡章／去年指引有沒有列（第②題）；「系上指定要回答的題目」改成請看官方原文（第①題）。
//   有 116 項目層（guideItems）時，「要準備的資料」改用 116 簡章的官方名稱（R 之後），不再用 115 指引那份（11-06 整理把 R、S 的名稱套錯）。
function digestRows(it) {
  var g = hasGuide(it) ? it.guide : null, f = factsOf(it), out = [], gi = gi116(it);
  var s2y = it.stage2 && it.stage2.source === 'cac-apply116' ? '116 簡章' : '', gy = g ? (g.year || 115) + ' 學校指引' : '';
  var add = function (t, yr) { out.push({ t: t, yr: yr || '' }); };
  var gs = it.stage2 && it.stage2.gsatPct != null ? it.stage2.gsatPct : null;
  if (f.hasReview && f.reviewPct != null) {
    add('二階審查資料占 ' + f.reviewPct + '%' + (gs == null ? '' : f.reviewPct > gs ? '，比學測（' + gs + '%）還重，書面資料要花心思' : f.reviewPct === gs ? '，跟學測一樣重' : '，學測占 ' + gs + '%') + '。', s2y);
  }
  var ex1 = [f.written ? '筆試' : '', f.interview ? '面試' : ''].filter(Boolean);
  if (ex1.length) add('另外有' + ex1.join('和') + '，要另外準備。', s2y);
  if (gi) {
    var gy6 = giYear(gi) + ' 簡章', rs = gi.items.filter(function (x) { return x && x.code > 'Q'; });
    if (rs.length) add(fill(WORDS.digestMore, { y: giYear(gi), list: rs.map(itemName).join('、') }), gy6);
    var q6 = gi.items.filter(function (x) { return prompt116(x).length; });
    if (q6.length) add(fill(WORDS.digestQ, { y: giYear(gi), list: q6.map(itemName).join('、') }), gy6);
  }
  // owner 第②題：「必交／選交」改成依 116 簡章、去年指引有沒有列（用語在 WORDS）
  var stv = DOCS.map(function (k) { return { k: k, s: needOf(it, k) }; });
  var lc = stv.filter(function (x) { return x.s === 'cac' || x.s === 'cacOpt'; }), lg = stv.filter(function (x) { return x.s === 'guide'; });
  if (lc.length) add(fill(WORDS.digestCac, { list: lc.map(function (x) { return x.k + (x.s === 'cacOpt' ? '（選繳）' : ''); }).join('、') }), (gi ? giYear(gi) : 116) + ' 簡章');
  if (lg.length) add(fill(WORDS.digestGuide, { list: lg.map(function (x) { return x.k; }).join('、') }), gy || '115 學校指引');
  if (!g) return out;
  // 主線 11-17 驗收裁定：沒過檢查的 115 逐句內容（項目名、篇幅、系上強調、面試會看、另外提醒）一律不上畫面；只留同一句、不點名哪幾篇。
  // 過了檢查的系，這些內容由項目層給（顯示在上面 116 區塊，各句標學校指引年份）。
  if (unchecked(g)) add(WORDS.uncheckedDigest, gy);
  return out;
}
function digestLines(it) { return digestRows(it).map(function (r) { return r.t; }); }   // 舊介面（純文字、不帶年份）
function yrTag(label) { return label ? ' <span class="yr">' + esc(label) + '</span>' : ''; }
function renderDigest(it) {
  var l = digestRows(it);
  return l.length ? '<div class="digest"><b>幫你畫重點</b><ul class="plain">' + l.map(function (r) { return '<li>' + esc(r.t) + yrTag(r.yr) + '</li>'; }).join('') + '</ul></div>' : '';
}
// ── 116 簡章項目層（28q：GuideItem → my_wishlist 的 items[].guideItems）──
// 只照分則原文：R 之後用官方名稱；題目只放規則能確定掛到該項的那一句（不猜）；A–Q 分則沒有名稱，用大類名＋代碼，不補名稱。
// 三區只照 form 分，標題不帶要不要交；寫了「選繳」的那一項另標（owner 第②題）。R 之後要寫的那幾篇系統還不能寫（設計稿階段四），照實講。
var FORM_ZONE = { write: 'write', portfolio: 'prep', upload: 'prep', schoolForm: 'prep', proof: 'prep', misc: 'other', unknown: 'other' };
var FORM_HINT = { upload: WORDS.hintUpload, schoolForm: WORDS.hintSchoolForm, proof: WORDS.hintProof, unknown: WORDS.hintUnknown };
function gi116(it) { var g = it && it.guideItems; return g && typeof g === 'object' && Array.isArray(g.items) && g.items.length ? g : null; }
function giSource(gi) { return (Array.isArray(gi.sources) ? gi.sources : []).filter(function (s) { return s && s.kind === 'cac_rules'; })[0] || {}; }
function giYear(gi) { return giSource(gi).year || 116; }
function itemName(x) { return x.officialName ? x.code + ' ' + x.officialName : (DOC_SHORT[x.code] || x.code); }
// 共用題目（kind＝question、appliesTo 兩項以上：學校指引同一列好幾項、分不出是哪一項）老師確認前不畫（主線 11-18 裁定第 3 題；後端 28q ④a 也收）
function sharedQ(p, x) { return !!p && p.kind === 'question' && Array.isArray(p.appliesTo) && p.appliesTo.length > 1 && !(x && x.reviewed === true); }
// 共用的說明照畫（學校原文本來就寫在同一格），後面加小標記（主線 11-18 第二次裁定第 3 題）
function sameCellTag(p) { return p && Array.isArray(p.appliesTo) && p.appliesTo.length > 1 ? ' <span class="muted small">（' + esc(fill(WORDS.sameCell, { codes: p.appliesTo.join('、') })) + '）</span>' : ''; }
function prompt116(x) { return (Array.isArray(x.prompts) ? x.prompts : []).filter(function (p) { return p && p.kind === 'question' && p.text && !sharedQ(p, x); }); }
function zones116(gi) {
  var z = { write: [], prep: [], other: [], portfolio: [] }, port = {}, order = [];
  gi.items.forEach(function (x) {
    if (!x || !x.code) return;
    if (x.form === 'portfolio') { var k = x.groupName || '學習歷程檔案'; if (!port[k]) { port[k] = []; order.push(k); } port[k].push(x.code); return; }
    z[FORM_ZONE[x.form] || 'other'].push(x);
  });
  z.portfolio = order.map(function (k) { return k + '（' + port[k].join('、') + '）'; });
  return z;
}
// o.title：區塊標題（預設「116 簡章寫要交」）；o.desc＝false 不放簡章原文；o.skipNQ＝true 時「要自己寫的」只列 R 之後（「我要交的」頁 N–Q 另有一列一列的稿）
function renderZones116(gi, o) {
  o = o || {};
  var src = giSource(gi), yr = giYear(gi), tag = yr + ' 簡章', z = zones116(gi);
  var li = function (x, note) {   // 題目（question）與說明（advice）都照原文列，各標來源；名稱或原文寫了「選繳」才標選繳（owner 第②題）
    var opt = /選繳/.test((x.needQuote || '') + (x.officialName || ''));
    var ps = (Array.isArray(x.prompts) ? x.prompts : []).filter(function (p) { return p && p.text && (p.kind === 'question' || p.kind === 'advice') && !sharedQ(p, x); });
    return '<li><b>' + esc(itemName(x)) + '</b>' + (opt ? ' <span class="pill">' + esc(WORDS.optShort) + '</span>' : '') + (note ? ' <span class="muted small">' + esc(note) + '</span>' : '')
      + ps.map(function (p) { return '<div class="q116">' + esc(p.kind === 'question' ? WORDS.q116 : WORDS.adv116) + esc(p.text) + sameCellTag(p) + yrTag(srcLabel(p)) + '</div>'; }).join('') + '</li>';
  };
  var w = o.skipNQ ? z.write.filter(function (x) { return x.code > 'Q'; }) : z.write;
  var prep = z.portfolio.map(function (t) { return '<li>' + esc(t) + ' <span class="muted small">' + esc(WORDS.zPortfolio) + '</span></li>'; }).concat(z.prep.map(function (x) { return li(x, FORM_HINT[x.form] || ''); }));
  var desc = o.desc !== false && src.reviewDesc ? String(src.reviewDesc).replace(/\s+/g, ' ').trim() : '';
  if (!w.length && !prep.length && !z.other.length && !desc) return '';
  var h = '<div class="i116"><div><b>' + esc(o.title || fill(WORDS.z116Title, { y: yr })) + '</b>' + yrTag(tag) + '</div>';
  if (desc) h += '<div class="desc116"><span class="k">' + esc(WORDS.z116Desc) + '　</span>' + esc(desc) + yrTag(tag) + '</div>';
  if (w.length) h += '<div class="gline"><span class="k">' + esc(WORDS.zWrite) + '</span><ul class="plain">' + w.map(function (x) { return li(x, x.code > 'Q' ? WORDS.notYet : ''); }).join('') + '</ul></div>';
  if (prep.length) h += '<div class="gline"><span class="k">' + esc(WORDS.zPrep) + '</span><ul class="plain">' + prep.join('') + '</ul></div>';
  if (z.other.length) h += '<div class="gline"><span class="k">' + esc(WORDS.zOther) + '</span><ul class="plain">' + z.other.map(function (x) { return li(x, FORM_HINT[x.form] || ''); }).join('') + '</ul></div>';
  return h + '</div>';
}
// 寫稿頁對照欄（write.js focusCard）一系的內容。dp＝28q nopq_review_focus 的一系；full＝P、Q 單系（true）或 N、O 多系的一小段（false）。
// 題目只畫項目層給的（每條有 sourceId，標自己的來源年份）；沒過檢查的系不講「沒有題目」、不點名，一律同一句＋官方連結；過了檢查且真的沒題目才講「沒有」。
// 115 的系上強調、這系看重、篇幅不畫（後端也已收起；舊後端送來的一樣不畫）。
function focusDeptHtml(dp, L, full) {
  dp = dp || {};
  var pro = (Array.isArray(dp.prompts) ? dp.prompts : []).filter(function (x) { return x && typeof x === 'object' && x.text && x.sourceId; });
  // 11-18 主線第二次驗收 P2：題目（question）列「要回答」，說明（advice、criteria）另列「說明：」
  var qs = pro.filter(function (x) { return x.kind === 'question'; }), adv = pro.filter(function (x) { return x.kind !== 'question'; });
  var st = dp.listed116 ? (/選繳/.test(dp.needQuote116 || '') ? 'cacOpt' : 'cac') : dp.required === true || dp.required === false ? 'guide' : '';
  var req = st ? needPill(L, st) : '', unc = dp.checked !== true, y115 = (dp.guideYear || 115) + ' 學校指引';
  var link = safeUrl(dp.guideUrl) ? ' <a href="' + esc(dp.guideUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(WORDS.officialLink) + '</a>' : '';
  var li = function (x) { return '<li>' + esc(x.text) + sameCellTag(x) + yrTag(srcLabel(x)) + '</li>'; };
  // 11-18 主線第二次驗收 P1：「沒有」只能來自正面事實——後端 promptsNone＝true 才講 checkedNone；過了檢查但沒題目可給（待複核、共用題目扣住、舊後端沒給旗標）講 checkedPending
  var pend = !unc && !qs.length && dp.promptsNone !== true, none = !unc && !qs.length && dp.promptsNone === true;
  if (!full) {
    return '<div class="fdept"><b>' + (dp.rank ? esc(dp.rank) + '. ' : '') + esc((dp.schoolName || '') + ' ' + (dp.name || '')) + '</b> ' + req
      + (qs.length ? '<div class="small">' + esc(WORDS.focusAskShort) + '</div><ul class="plain">' + qs.map(li).join('') + '</ul>' : '')
      + (adv.length ? '<div class="small">' + esc(WORDS.adv116) + '</div><ul class="plain">' + adv.map(li).join('') + '</ul>' : '')
      + (unc ? '<div class="small">' + esc(fill(WORDS.uncheckedLine, { y: dp.guideYear || 115 })) + link + yrTag(y115) + '</div>'
        : pend ? '<div class="small">' + esc(fill(WORDS.checkedPending, { y: dp.guideYear || 115 })) + link + yrTag(y115) + '</div>' : '') + '</div>';
  }
  return (req ? '<div style="margin:0 0 6px">' + req + '</div>' : '')
    + (qs.length ? '<div class="fsec"><b>' + esc(WORDS.focusAsk) + '</b><ul class="fchk">' + qs.map(li).join('') + '</ul></div>' : '')
    + (adv.length ? '<div class="fsec"><b>' + esc(WORDS.adv116) + '</b><ul class="plain">' + adv.map(li).join('') + '</ul></div>' : '')
    + (unc ? '<div class="fsec small">' + esc(WORDS.uncheckedDoc) + link + yrTag(y115) + '</div>'
      : pend ? '<div class="fsec small">' + esc(fill(WORDS.checkedPending, { y: dp.guideYear || 115 })) + link + yrTag(y115) + '</div>'
      : none ? '<div class="fsec muted small">' + esc(fill(WORDS.checkedNone, { k: L, y: dp.guideYear || 115 })) + '</div>' : '');
}
// 寫稿頁有沒有可以對照的點：項目層給的題目（每條有 sourceId）至少一條
// 撰寫頁 P／Q 卡（沒有對照欄時）的指引那一段（主線 11-18 第三次裁定：照對照欄的分法）。d＝nopq_doc_state 併進的 nopq_pq_info。
// 題目（prompts，kind＝question；舊後端沒帶 kind 的當題目）列在「要你回答」底下；說明（advice，及舊後端混在 prompts 裡的非題目）另列「說明：」；
// 沒有指引 → noGuide；過了檢查但沒題目 → promptsNone＝true 才講 checkedNone，否則 checkedPending；沒過檢查 → uncheckedNoUrl。
function pqGuideHtml(d, letter) {
  d = d || {};
  var mine = function (p) { return !!p && (typeof p === 'string' || !p.doc || p.doc === letter); };
  var txt = function (p) { return typeof p === 'string' ? p : (p && p.text) || ''; };
  var ps = (Array.isArray(d.prompts) ? d.prompts : []).filter(mine).filter(txt);
  var qs = ps.filter(function (p) { return typeof p === 'string' || !p.kind || p.kind === 'question'; });
  var adv = ps.filter(function (p) { return typeof p === 'object' && p.kind && p.kind !== 'question'; }).concat((Array.isArray(d.advice) ? d.advice : []).filter(mine).filter(txt));
  var y = d.guideYear || 115;
  var li = function (p) { return '<li>' + esc(txt(p)) + (typeof p === 'object' ? sameCellTag(p) : '') + '</li>'; };
  var h = qs.length ? '<ul class="plain">' + qs.map(li).join('') + '</ul>' : '';
  if (adv.length) h += '<div class="muted small">' + esc(WORDS.adv116) + '</div><ul class="plain">' + adv.map(li).join('') + '</ul>';
  if (d.guideSource === 'missing' || !d.guideSource) h += '<div class="muted">' + esc(WORDS.noGuide) + '</div>';
  else if (d.checked === true) h += qs.length ? '' : '<div class="muted">' + esc(d.promptsNone === true ? fill(WORDS.checkedNone, { k: letter, y: y }) : fill(WORDS.checkedPending, { y: y })) + '</div>';
  else h += '<div class="muted">' + esc(WORDS.uncheckedNoUrl) + '</div>';
  return h;
}
function focusHasPoints(f) {
  return !!f && Array.isArray(f.depts) && f.depts.some(function (dp) { return dp && Array.isArray(dp.prompts) && dp.prompts.some(function (x) { return x && typeof x === 'object' && x.text && x.sourceId; }); });
}
function renderItems116(it) { var gi = gi116(it); return gi ? renderZones116(gi) : ''; }
// 2026-11-12 換 116（owner 拍板 D2／D3／D7）：116 簡章寫的審查資料、自述規定原文、AI 使用聲明提醒。只照原文顯示，不替學生判斷、不代填。
var SELF_LABEL = { aiFront: '要在學習歷程自述「首頁」放學校提供的 AI 使用聲明', aiSeparate: '要另外交 AI 使用聲明（檔案或表格）', aiNote: '作品或小論文用了 AI 要註明',
  chars: '分則寫了字數規定', pages: '分則寫了頁數規定' };
function selfRules(it) { var s = it && it.stage2; return s && Array.isArray(s.selfRules) ? s.selfRules.filter(function (r) { return r && SELF_LABEL[r.kind]; }) : []; }
function needsAiStatement(it) { return selfRules(it).some(function (r) { return r.kind === 'aiFront' || r.kind === 'aiSeparate'; }); }
function rules116Html(it) {
  var s = it && it.stage2; if (!s || s.source !== 'cac-apply116') return '';
  var h = '', items = (Array.isArray(s.reviewItems) ? s.reviewItems : []).map(function (x) { return x && (x.text || x.name); }).filter(Boolean);
  var rs = selfRules(it), ai = rs.filter(function (r) { return /^ai/.test(r.kind); }), len = rs.filter(function (r) { return r.kind === 'chars' || r.kind === 'pages'; });
  if (ai.length) h += '<div class="issue small"><b>' + esc(SELF_LABEL[ai[0].kind]) + '。</b>聲明怎麼寫、檔案去哪下載，照分則說明到學校網站；NOPQ通不代填。'
    + ai.map(function (r) { return '<div class="muted small">分則原文：「…' + esc(r.quote) + '…」</div>'; }).join('') + '</div>';
  var gi = gi116(it);   // 2026-11-17：有 116 項目層時，「要交什麼」與簡章原文改由卡片上方 renderItems116 顯示，這裡不重複
  if (items.length && !gi) h += '<div class="gline"><span class="k">116 簡章寫要交</span>' + esc(items.join('、')) + '</div>';
  if (len.length) h += '<div class="gline"><span class="k">篇幅（分則原文）</span>' + len.map(function (r) { return '「…' + esc(r.quote) + '…」'; }).join('<br>') + yrTag('116 簡章') + '</div>';
  if (s.reviewDesc && !gi) { var d = String(s.reviewDesc).replace(/\s+/g, ' ').trim(); h += '<details class="small"><summary>116 簡章的審查資料說明（原文）</summary><div class="muted">' + esc(d.length > 600 ? d.slice(0, 600) + '…' : d) + '</div></details>'; }
  return h ? '<div class="r116">' + h + '</div>' : '';
}
// 2026-11-12 繁星顯示（OUTPUTS/nopq_star116_design_v0.1.md，owner「照預設做」）：照甄選會分則原文列，不算落點、不判斷能不能被推薦；
// 不顯示可填志願數與跨管道規則（設計稿 S3：對到 116 繁星簡章總則前不顯示）。s＝dept_info 的 star（只有核准且一對一的對應才有）
function renderStar(s) {
  if (!s || typeof s !== 'object') return '';
  var ex = (Array.isArray(s.exams) ? s.exams : []).filter(function (e) { return e && e.subject && e.standard; }).map(function (e) { return e.subject + ' ' + e.standard; });
  if (s.listen) ex.push('英聽 ' + s.listen + ' 級');
  var tb = (Array.isArray(s.tieBreak) ? s.tieBreak : []).filter(Boolean), yr = s.year || 116;
  var h = '<div class="hint small star"><b>這系也有繁星推薦</b>（' + esc(yr) + ' 學年，照甄選會分則原文）'
    + '<div>名額 ' + (s.quota != null ? esc(s.quota) + ' 人' : '—') + (s.groupCategory ? '｜' + esc(s.groupCategory) : '') + '</div>';
  if (ex.length) h += '<div>學測檢定：' + esc(ex.join('、')) + '</div>';
  if (s.schoolRankStd) h += '<div>' + esc(s.schoolName || '這所大學') + '的繁星校排標準：在校學業成績全校排名' + esc(s.schoolRankStd) + '（這是大學訂的標準；你能不能被推薦，由你的高中依規定決定）</div>';
  if (tb.length) h += '<div>分發比序（同分時依序比較，不是門檻）：' + esc(tb.slice(0, 3).join('　')) + (tb.length > 3 ? '<details><summary>看全部 ' + tb.length + ' 項</summary>' + esc(tb.join('　')) + '</details>' : '') + '</div>';
  else h += '<div>分發比序：請看分則</div>';
  var s2 = s.stage2 && Array.isArray(s.stage2.items) ? s.stage2 : null;
  if (s2 && s2.items.length) h += '<div>第二階段指定項目（分則原文）：' + esc(s2.items.map(function (x) { return x.name + ' ' + x.pct; }).join('、')) + (s2.date ? '｜甄試日期 ' + esc(s2.date) : '') + (s2.expected != null ? '｜預計甄試 ' + esc(s2.expected) + ' 人' : '') + '</div>';
  if (safeUrl(s.rulesUrl)) h += '<div><a href="' + esc(s.rulesUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(yr) + ' 繁星校系分則（甄選會）</a></div>';
  return h + '</div>';
}
function renderGuideCard(it, star) {
  var f = factsOf(it), g = hasGuide(it) ? it.guide : null, name = (it.schoolName || '') + ' ' + (it.name || '');
  var h = '<div class="need guide-card"><div class="row spread"><b>' + esc(it.rank) + '. ' + esc(name.trim()) + '</b>' + snapPill(it.snapshot) + '</div>'
    + renderItems116(it)
    + renderDigest(it)
    + '<div class="facts"><span><span class="k">審查資料</span>' + (f.hasReview ? (f.reviewPct != null ? esc(f.reviewPct) + '%' : '有') : '沒有') + '</span><span><span class="k">筆試</span>' + (f.written ? '有' : '沒有')
    + '</span><span><span class="k">面試</span>' + (f.interview ? '有' : '沒有') + '</span><span><span class="k">名額</span>' + (it.quota != null ? esc(it.quota) : '—') + '</span></div>'
    + '<div class="muted small">二階：' + esc(s2Line(it.stage2)) + (it.stage2 && it.stage2.source === 'cac-apply116' ? yrTag('116 簡章') : '') + '</div>' + rules116Html(it) + renderStar(star);
  if (!g) {
    var rules = safeUrl(it.rulesUrl);
    return h + '<div class="gline">' + esc(WORDS.noGuide) + (rules ? ' <a href="' + esc(rules) + '" target="_blank" rel="noopener noreferrer">' + esc(name.trim()) + ' 校系分則</a>' : '') + '</div></div>';
  }
  var src = g.source || {}, shared = Array.isArray(src.coversDepts) && src.coversDepts.length > 1, gy = (g.year || 115) + ' 學校指引';
  // 「要交」這一行依 116 簡章與去年指引兩個來源（字樣自帶來源，不另標年份）
  h += '<div class="gline"><span class="k">要交　</span>' + needLine(it) + (shared ? '<span class="pill">全校共用指引</span>' : '') + '</div>';
  // 主線 11-17 驗收裁定：學校指引那一段只留一行（沒過檢查的 115 逐句內容——限制、這系看重、自述要答——一律不畫）；過了檢查的系只留官方連結，內容在上面 116 區塊
  var url = safeUrl(src.url), sn = it.schoolName || src.schoolName || '', dn = it.name || src.deptName || '';
  var c = it.reviewGuide && it.reviewGuide.carriedFrom, y115 = c && c.year ? c.year : g.year || 115;
  if (unchecked(g)) h += '<div class="gline g115">' + esc(fill(WORDS.uncheckedLine, { y: y115 })) + (url ? ' <a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(WORDS.officialLink) + '</a>' : '　' + esc(WORDS.officialMissing)) + yrTag(gy) + '</div>';
  else if (url) h += '<div class="gline"><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc((sn + ' ' + dn).trim() + ' ' + y115 + ' 學年度審查資料準備指引（官方）') + '</a></div>';
  else h += '<div class="gline muted">' + esc(WORDS.officialMissing) + '</div>';
  return h + '</div>';
}
// 新作落點分析「這系在做什麼」（2026-11-09 設計稿 §4.1、§4.3①）：只用專案裡已有、查得到出處的資料拼句；
// 第一期不寫「這系在學什麼、畢業做什麼」這類摘要（寧缺勿編）。d＝CAAC_DEPTS 一筆；info＝dept_info 的一筆（可為 null）；has116＝示範庫有沒有匯 116。
function deptIntroLines(d, info, has116) {
  var out = [], y = (info && info.y) || {}, y6 = info && info.y116, intro = info && info.intro;
  if (d && d.group) out.push({ k: 'group', text: '屬於' + d.group });
  out.push({ k: 'stage2', text: '這系看：' + s2Line(d && d.stage2).replace(/｜/g, '、') });
  if (safeUrl(y.rulesUrl)) out.push({ k: 'rules115', text: (y.year || 115) + ' 校系分則（甄選會）', url: y.rulesUrl });   // 2026-11-12：換 116 後 y 就是 116 那列，照實標年度
  if (has116 && y6) {
    if (safeUrl(y6.rulesUrl) && y6.rulesUrl !== y.rulesUrl) out.push({ k: 'rules116', text: '116 校系分則（甄選會）', url: y6.rulesUrl });
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
root.NG = { pqGuideHtml: pqGuideHtml, sameCellTag: sameCellTag, DOC_SHORT: DOC_SHORT, WORDS: WORDS, fill: fill, needOf: needOf, needPill: needPill, isListed: isListed, srcLabel: srcLabel, unchecked: unchecked, focusDeptHtml: focusDeptHtml, focusHasPoints: focusHasPoints, needLine: needLine, gi116: gi116, zones116: zones116, itemName: itemName, prompt116: prompt116, renderItems116: renderItems116, renderZones116: renderZones116, digestRows: digestRows, yrTag: yrTag, renderStar: renderStar, selfRules: selfRules, needsAiStatement: needsAiStatement, rules116Html: rules116Html, deptIntroLines: deptIntroLines, renderDeptIntro: renderDeptIntro, esc: esc, safeUrl: safeUrl, s2Line: s2Line, s2Facts: s2Facts, snapPill: snapPill, hasGuide: hasGuide, reqState: reqState, factsOf: factsOf, guideSummary: guideSummary, limitText: limitText, digestLines: digestLines, renderDigest: renderDigest, renderGuideCard: renderGuideCard };
})(typeof window !== 'undefined' ? window : globalThis);
