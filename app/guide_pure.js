/* 第 4 幕指引卡與摘要句：純函式（不碰頁面、不連網），放在獨立區塊，離線測試（tests/walk_guide.mjs）直接載入這一塊。 */
(function (root) {
'use strict';
var DOCS = ['N', 'O', 'P', 'Q'];
var DOC_SHORT = { N: 'N 多元表現綜整心得', O: 'O 高中學習歷程反思', P: 'P 就讀動機', Q: 'Q 未來學習計畫與生涯規劃' };   // 2026-11-25 第 1 批 N10：116 簡章原名（owner 第 4 題甲）
// 2026-11-25 第 1 批 N04、N10（14_ 第 0 節；12_ 第 3 節 a；owner 第 3 題甲）：全站一套狀態字與按鈕字。[狀態字, 按鈕字, 小字]；
//   sysOn＝雲端「系統整理」功能開著（學生頁 write.js 的 aiIsOff 反過來）：那時 assignment／feedback／self_check 三種寫「整理中」，關著寫「等老師」
var STEP = { warmup: ['還沒開始', '開始', ''], interviewing: ['輪到你', '去回答', '有一題等你回答'], submission_pending: ['輪到你', '去寫答案', '題目出來了'],
  draft_open: ['輪到你', '去寫', ''], feedback_published: ['輪到你', '去看', '回覆出來了'], review_pending: ['等老師', '看一下', ''], finalized: ['定稿', '看稿', ''] };
function stepFor(state, sysOn) {
  if (state === 'assignment_pending' || state === 'feedback_pending' || state === 'self_check_pending') return [sysOn ? '整理中' : '等老師', '看一下', ''];
  return STEP[state] || ['還沒開始', '開始', ''];
}
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
  pqDraftOpenNone: '寫一段按「儲存」，確定了按「交給老師」。也可以用檔案帶入（Word、PDF、文字檔）。',
  focusNote: '交給老師之前，一條一條對照，確認每一點都寫到了。老師批改時也會對照這幾點。',
  focusNoteMulti: '交給老師之前，對照一下每一系要的都寫到了沒。老師批改時也會對照這幾點。',
  focusNoteNone: '寫好交給老師，老師會幫你看有沒有寫到。',
  focusAskShort: '要回答：',
  needIntro: 'N、O 各寫一篇；P、Q 每個志願系各寫一篇。每系卡片上「116 簡章寫要交」列的是今年簡章的原文；學校指引寫的題目我們正在重新核對，先看官方原文。都在「撰寫NOPQ」寫。',
  q116: '題目：',
  adv116: '說明：',
  optShort: '選繳',
  // 116 簡章區塊（卡片上方、「我要交的」頁）的區名與提示
  z116Title: '{y} 簡章寫要交',
  z116More: '116 簡章另外要交',
  z116Desc: '簡章原文',
  // 2026-11-19 改（設計稿 nopq_item_model_review_fable_20261119 第 5.1–5.3 節）。下面標「11-19 改，待楊老師確認」的五句是改過楊老師 11-17 審過的字。
  zWrite: '要寫的，在這裡寫',           // 11-19 改，待楊老師確認（舊：要自己寫的）
  zPrep: '從學習歷程檔案挑的',           // 11-19 改，待楊老師確認（舊句見設計稿 5.1）
  zOther: '其他資料',
  notYet: '這一篇現在還不能在這裡寫。先照題目寫在自己的檔案裡。',   // 11-19 改，待楊老師確認（舊：這一篇還不能在 NOPQ通 裡寫，先照題目準備）。11-20 起只在呼叫端沒給系碼時才用（正常頁面都換成下面兩顆鈕）
  startWrite: '開始', /* 2026-11-25 第 1 批 N04：跟全站狀態表同一個按鈕字（原：開始寫） */   // 11-20 審查資料第二步（28t）：R 以後要寫的（自傳、小論文…）在這裡寫
  contWrite: '繼續寫',
  xChanged: '題目換了',   // 11-20（28u）：已經開寫的那一篇，學校的題目換了
  hintUpload: '作品或影音',
  hintSchoolForm: '到這一系的網站下載表格，填好照學校說的方式交。',   // 11-19 改，待楊老師確認（舊：學校指定的表格）
  hintProof: '照簡章寫的方式交，有的要寄正本。',   // 11-19 改，待楊老師確認（舊：證明或推薦）
  // 以下是 11-19 新增的鍵（不是楊老師審過的）
  zSchool: '照學校說的方式交',
  pickIntro: '這些是你高中三年放在學校系統裡的。申請時到甄選會的系統勾選，不用重寫。',
  pickA: '學校提供，你不用交，也不能改。有錯請找學校。',
  // 2026-11-21 第三步（規格第 1 節第 1 條、驗收第 2 條）：上限的數字不寫在程式裡，從官方項目表大類那一列讀（OfficialGroup.pickLimit）
  pickLimitCourse: '每系最多勾 {limit} 件。',
  pickLimitMulti: '每系最多勾 {limit} 件。',
  pickLimitNone: '今年的上限還沒公告，先照你想的挑。',
  pickedN: '你勾了 {n} 件。',
  pickBtn: '去看你放了哪幾件',
  pickBtnDept: '挑這一系要勾的',
  // ── 2026-11-21 審查資料項目模型第三步（OUTPUTS/uiux_plan_20261119/04_項目模型第三步_畫面規格_v0.1.md；新句子清單見第 14.2 節，照「先推再微調」）──
  dpHiddenNote: '「{t}」你已經收起來了，這張清單裡也拿掉了。',   // 11-22 A4（規格 4.4）：收起來的那一件，那一系的頁面下次打開寫一次
  dlvDeptAll: '看這一系全部要交的',   // 11-22 A4（規格 14.1）：寫稿頁「我要交的」每一系多一行連結，連到這一系那一頁
  st3Loading: '讀取中，第一次打開會比較久。', st3LoadFail: '沒讀到。請檢查網路，再按一次。', st3Retry: '再讀一次',
  st3SaveFail: '剛剛那一下沒存到。請檢查網路，再按一次。', st3Saved: '存好了',
  dpBack: '回各系要交什麼', dpProgress: '要寫 {w} 篇，定稿 {f} 篇\n要勾的 {p} 件\n表格證明 {c}／{t}',   // 2026-11-25 第 1 批 N25-02、N31-05
  dpNotReady: '這一系今年要交什麼，我們還沒整理好。先看簡章原文。', dpSeeRules: '看簡章原文', dpNotWish: '這一系不在你現在的志願裡。',
  dpListed: '這一系的簡章列了：{list}', dpPickedTitle: '我打算勾的（{n}／{limit}）', dpPickedFull: '我打算勾的（{limit}／{limit}，滿了）',
  dpPickedNoLimit: '我打算勾的（{n}）', dpUnpickedTitle: '還沒勾的（{m}）',
  dpUp: '上移', dpDown: '下移', dpRemove: '拿掉', dpPickBtn: '勾這件',
  noCode: '還沒標代碼', noCodeHint: '可以先勾。標了代碼，老師比較好幫你看。', dpNotListed: '這一系的簡章沒列 {code}。',
  dpOver: '{group}每系最多勾 {limit} 件，你已經勾滿了。想換這一件，先從上面拿掉一件。',
  dpOverLowered: '上限改成 {limit} 件了，你現在勾了 {n} 件。請拿掉 {k} 件。',
  dpEmptyAll: '你還沒把學校系統裡的東西放進來。放進來，老師才能幫你挑。', dpGoPut: '去放',
  dpNotPicked: '你放進來 {n} 件，還沒挑。先勾你最想給這一系看的，最多 {limit} 件。', dpNotPickedNoLimit: '你放進來 {n} 件，還沒挑。先勾你最想給這一系看的。',
  dpNoPortfolio: '這一系的簡章沒有要你勾學習歷程檔案。', dpReminder: '這張清單是你的打算。真正的勾選，要到甄選會的系統做。',
  dpAsk: '請老師看我挑的', dpCopy: '套用到同學群的系', dpAskConfirm: '要請{t}看這一系你挑的嗎？可以順便留一句話。', dpAskPh: '想問老師什麼（可以不寫）',
  dpSend: '送出', dpNotNow: '先不要', dpReplyTitle: '{t}回了（{d}）', advPick: '老師建議勾', advSwap: '老師建議換掉',
  dpAccept: '照老師的建議改', dpKeep: '先不改', dpAccepted: '改好了：拿掉 {r} 件、加上 {a} 件。順序你還可以再調。',
  dpAsked: '已經請{t}看了（{d}）。老師回之前，你還是可以改。', dpChangedAfterAsk: '你在請老師看之後又改過，老師那邊看到的是最新的。',
  dpAskAgain: '改好了，再請老師看', dpNoTeacher: '你還沒有老師。想請老師幫你挑，先看方案和價格。', dpSeePlans: '看方案和價格',
  cpTitle: '把這一系挑的，套到別的系', cpFrom: '{name} 現在挑了：課程學習成果 {a} 件、多元表現 {b} 件。', cpSame: '同學群的系（{g}）',
  cpSameHint: '同學群的系先幫你勾好了，可以自己加減。', cpNone: '現在還沒挑', cpWill: '現在挑了 {n} 件，會被換成這一系的',
  cpOnly: '這一系的簡章沒列{g}，只會套{h}', cpOthers: '其他學群的系（{n}）', cpTip1: '套用之後，每一系還是可以各自再改。',
  cpTip2: '老師的建議不會跟著套過去。要老師看，到那一系再按一次。', cpGo: '套用到這 {n} 系', cpDone: '套好了：{n} 系的清單跟{name}一樣了。',
  cpNoSame: '你的志願裡，沒有其他同學群的系。要套到別的系，自己勾。', cpNoGroup: '這一系查不到學群，要套到哪幾系請自己勾。', cpPickOne: '先勾至少一系。',
  cpPartial: '{name} 沒套到，其他 {n} 系套好了。請再按一次。', cpStale: '你換過清單，老師的建議是針對舊的那一份。',
  scIntro: '這幾樣不在這裡交。準備好了就打勾，你和老師都看得到還缺什麼。', scReady: '準備好了', scDoneAt: '{d} 打勾的', scSkip: '這一項我不交',
  scSkipped: '你選了不交。', scUndo: '改回來', scAllDone: '都準備好了', scGo: '去打勾',
  miTitle: '我的學習歷程', miIntro: '' /* 2026-11-25 第 1 批 N16-07：拿掉解釋版面的句子（原：上面是…；下面是…） */, miTop: '學習歷程檔案（學校系統裡的）',
  miTopIntro: '把學校系統裡已經有的放進來，老師才能幫你挑每一系要勾哪幾件。內容照原樣放，不用重寫。', miTeacherSees: '你放進來的，你的老師都看得到。',
  miARef: '放進來是給老師參考用的。', miCount: '你放進來 {n} 件。', miByTeacher: '{t}幫你標的', miTagBtn: '標代碼',
  miUnclassified: '還沒分類的（{n}）', miUnclassHint: '先選它是哪一類，才會出現在上面。', miPickKind: '選類別', miPut: '放一件進來',
  miBottom: '申請時寫的', miBottomIntro: '這幾篇不在學校系統裡，是申請時才寫的。點一篇，就到「撰寫NOPQ」。', miShared: '全部志願共用一篇',
  miNotStarted: '還沒開始', miOldDrafts: '你放進來的舊稿 {n} 份', miPicksTitle: '每一系要勾哪幾件', miPicksIntro: '每一系可以勾的不一樣。一系一系挑，老師可以幫你看。',
  miGoPick: '去挑', miSeePick: '去看', miEmpty: '你還沒把學校系統裡的東西放進來。放進來，老師才能幫你挑。',
  miNoWish: '選好志願之後，這裡會列出每一系要寫的和要勾的。', miGoWish: '去選志願', miMore: '更多',
  tgQ1: '這一件是哪一類？', tgQ1Hint: '跟學校系統裡這一件的類別選一樣的。', tgQ2: '是哪一個代碼？', tgQ2Hint: '代碼是 116 簡章的編號。不確定就先這樣，老師會幫你標。',
  tgUnsure: '我不確定，先這樣', tgAOnly: '這一類只有 A 修課紀錄。', tgDone: '標好了：{code}。', tgDoneUnsure: '放好了。代碼晚點再補也可以。',
  tgTeacherSet: '這一件是{t}幫你標成 {code} 的。你確定要改嗎？', tgYes: '我要改', tgNo: '先不改',
  tgMoved: '這一件改成「{g}」了，已經從 {n} 系的{old}清單拿掉。',
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
function needPill(k, st) {
  if (st === 'cacOpt') return '<span class="pill ok">' + esc(k + ' ' + WORDS.cac) + '</span><span class="pill">' + esc(WORDS.optShort) + '</span>';   // 2026-11-25 第 1 批 N31-02：「116 簡章有列・選繳」一個標籤拆成兩個，字不變
  return '<span class="pill ' + (NEED_PILL[st] || '') + '">' + esc(k + ' ' + (WORDS[st] || '')) + '</span>';
}
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
  if (ex1.length) add('這系另外有' + ex1.join('和') + '。', s2y);
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
var FORM_ZONE = { write: 'write', portfolio: 'portfolio', upload: 'school', schoolForm: 'school', proof: 'school', misc: 'other', unknown: 'other' };
// 116 簡章審查資料項目 A–Q 的官方名稱。出處：甄選會「116學年度大學申請入學招生簡章總則」，https://www.cac.edu.tw/apply116/PDF_FileGet.php?Type=s1
// （從 https://www.cac.edu.tw/apply116/appform_1.php 點入），PDF 第 21 頁「乙、審查資料項目內容對照表」。2026-11-19 對照原文核對。
// D、E 的全名很長（含「或特殊類型班級之相關課程學習成果」）：這裡存全文，畫面只顯示「或」之前那段（見 codeName）。
var CAC_NAMES = { A: '修課紀錄', B: '書面報告', C: '實作作品', D: '自然科學領域探究與實作成果，或特殊類型班級之相關課程學習成果', E: '社會領域探究活動成果，或特殊類型班級之相關課程學習成果',
  F: '高中自主學習計畫與成果', G: '社團活動經驗', H: '擔任幹部經驗', I: '服務學習經驗', J: '競賽表現', K: '非修課紀錄之成果作品', L: '檢定證照', M: '特殊優良表現證明',
  N: '多元表現綜整心得', O: '高中學習歷程反思', P: '就讀動機', Q: '未來學習計畫與生涯規劃' };
function codeName(code) { var n = CAC_NAMES[code]; return n ? code + ' ' + n.split(/，?或/)[0] : ''; }
var FORM_HINT = { upload: WORDS.hintUpload, schoolForm: WORDS.hintSchoolForm, proof: WORDS.hintProof, unknown: WORDS.hintUnknown };
function gi116(it) { var g = it && it.guideItems; return g && typeof g === 'object' && Array.isArray(g.items) && g.items.length ? g : null; }
function giSource(gi) { return (Array.isArray(gi.sources) ? gi.sources : []).filter(function (s) { return s && s.kind === 'cac_rules'; })[0] || {}; }
function giYear(gi) { return giSource(gi).year || 116; }
function itemName(x) { return x.officialName ? x.code + ' ' + x.officialName : (DOC_SHORT[x.code] || x.code); }
// 2026-11-21 主線 P3②（「只有真的有題目的項目才能說『題目』」）：116 簡章那幾句的種類是匯入時照關鍵字分的（build_guide_items_cac116.py 的 QUESTION_RE），
//   項目層 19 句被標成題目、其中 10 句其實不是：網址裡的「?」被當問號（006302、030042）；「需含／須包含」寫的是證明、作品、檔案要有什麼
//   （001452 獸醫場所實習證明「需含實習時數、單位核章及獸醫師簽名」、056132 作品集、099422 證明、013012 等「需包含手寫自述…掃描成PDF」、018152）；
//   寫了「題目」兩個字但只是叫你去網站看（001642）。畫面上凡是要分「題目／說明」的地方一律用 isQ；學校指引（sg:）的種類是階段二管線給的，照原樣。
var Q_ASK = /請闡述|請論述|請論證|請說明|請回答|試述|試論|[？?]/, Q_WORD = /題目/, Q_MUST = /[需須應]包?含|必須包含/;
var Q_POINTER = /詳閱|詳見|參閱|請至|網站|網頁|下載/, Q_DOC = /證明|檔案|PDF|掃描|簽名|核章|作品|正本|影本|手寫|格式|表格|項目說明|上傳/i;
function isQ(p) {
  if (typeof p === 'string') return true;   // 舊後端：題目只給字串
  if (!p || typeof p !== 'object' || (p.kind && p.kind !== 'question')) return false;
  if (!p.kind || String(p.sourceId || '').indexOf('sg:') === 0) return true;
  var t = String(p.text || '').replace(/https?:\/\/[\x21-\x7e]+|www\.[\x21-\x7e]+/gi, ' ');   // 網址裡的 ? 不算問號（只吃到網址本身，中文不算網址）
  if (Q_ASK.test(t)) return true;
  if (Q_WORD.test(t)) return !Q_POINTER.test(t);   // 有「題目」：叫你去網站、網頁看的不算
  if (Q_MUST.test(t)) return !Q_DOC.test(t);       // 「需含／須包含」：寫的是要寫到的內容才算；證明、作品、檔案、格式要有什麼不算
  return false;
}
// 共用題目（kind＝question、appliesTo 兩項以上：學校指引同一列好幾項、分不出是哪一項）老師確認前不畫（主線 11-18 裁定第 3 題；後端 28q ④a 也收）
function sharedQ(p, x) { return !!p && isQ(p) && Array.isArray(p.appliesTo) && p.appliesTo.length > 1 && !(x && x.reviewed === true); }
// 共用的說明照畫（學校原文本來就寫在同一格），後面加小標記（主線 11-18 第二次裁定第 3 題）
function sameCellTag(p) { return p && Array.isArray(p.appliesTo) && p.appliesTo.length > 1 ? ' <span class="muted small">（' + esc(fill(WORDS.sameCell, { codes: p.appliesTo.join('、') })) + '）</span>' : ''; }
function prompt116(x) { return (Array.isArray(x.prompts) ? x.prompts : []).filter(function (p) { return p && p.text && isQ(p) && !sharedQ(p, x); }); }
// 四區（設計稿 5.1）：write＝N、O、P、Q 與 R 之後要寫的（N 一律在這一區：簡章註 3，N 是考生自己做 PDF 另外上傳的，資料裡 N 標在多元表現那一組也一樣）；
// portfolio＝A–M，從學習歷程檔案挑；school＝學校表格、作品、證明、推薦函，照學校說的方式交；other＝其他資料。
function zones116(gi) {
  var z = { write: [], portfolio: [], school: [], other: [] };
  gi.items.forEach(function (x) {
    if (!x || !x.code) return;
    var zone = x.code === 'N' ? 'write' : (FORM_ZONE[x.form] || 'other');
    z[zone].push(x);
  });
  z.write.sort(function (a, b) { return a.code < b.code ? -1 : a.code > b.code ? 1 : 0; });
  return z;
}
// o.title：區塊標題（預設「116 簡章寫要交」）；o.desc＝false 不放簡章原文；o.skipNQ＝true 時「要寫的」只列 R 之後（「我要交的」頁 N–Q 另有一列一列的稿）
function renderZones116(gi, o) {
  o = o || {};
  var src = giSource(gi), yr = giYear(gi), tag = yr + ' 簡章', z = zones116(gi);
  var zname = function (x) { return x.officialName ? x.code + ' ' + x.officialName : (codeName(x.code) || itemName(x)); };
  var li = function (x, note, btn) {   // 題目（question）與說明（advice）都照原文列，各標來源；名稱或原文寫了「選繳」才標選繳（owner 第②題）；btn＝已組好的按鈕 HTML（開始寫／繼續寫）
    var opt = /選繳/.test((x.needQuote || '') + (x.officialName || ''));
    var ps = (Array.isArray(x.prompts) ? x.prompts : []).filter(function (p) { return p && p.text && (p.kind === 'question' || p.kind === 'advice') && !sharedQ(p, x); });
    return '<li><b>' + esc(zname(x)) + '</b>' + (opt ? ' <span class="pill">' + esc(WORDS.optShort) + '</span>' : '') + (note ? ' <span class="muted small">' + esc(note) + '</span>' : '') + (btn || '')
      + ps.map(function (p) { return '<div class="q116">' + esc(isQ(p) ? WORDS.q116 : WORDS.adv116) + esc(p.text) + sameCellTag(p) + yrTag(srcLabel(p)) + '</div>'; }).join('') + '</li>';
  };
  var w = o.skipNQ ? z.write.filter(function (x) { return x.code > 'Q'; }) : z.write;
  // A–M 一碼一列、寫出名稱；A 單獨一列，B–E（課程學習成果）、F–M（多元表現）各一行小標；A–M 以外的碼（照理不會有）照原樣列
  var pickLi = function (x, note) { return '<li><b>' + esc(zname(x)) + '</b>' + (note ? ' <span class="muted small">' + esc(note) + '</span>' : '') + '</li>'; };
  var inR = function (x, lo, hi) { return x.code >= lo && x.code <= hi; };
  var pa = z.portfolio.filter(function (x) { return x.code === 'A'; }), pc = z.portfolio.filter(function (x) { return inR(x, 'B', 'E'); }), pm = z.portfolio.filter(function (x) { return inR(x, 'F', 'M'); });
  var po = z.portfolio.filter(function (x) { return !(x.code === 'A' || inR(x, 'B', 'E') || inR(x, 'F', 'M')); });
  var pick = pa.map(function (x) { return pickLi(x, WORDS.pickA); }).join('');
  if (pc.length) pick += '<li class="muted small">課程學習成果　' + esc(limitLine(o.official, '課程學習成果', o.picked)) + '</li>' + pc.map(function (x) { return pickLi(x); }).join('');
  if (pm.length) pick += '<li class="muted small">多元表現　' + esc(limitLine(o.official, '多元表現', o.picked)) + '</li>' + pm.map(function (x) { return pickLi(x); }).join('');
  pick += po.map(function (x) { return pickLi(x); }).join('');
  var desc = o.desc !== false && src.reviewDesc ? String(src.reviewDesc).replace(/\s+/g, ' ').trim() : '';
  if (!w.length && !z.portfolio.length && !z.school.length && !z.other.length && !desc) return '';
  var h = '<div class="i116"><div><b>' + esc(o.title || fill(WORDS.z116Title, { y: yr })) + '</b>' + yrTag(tag) + '</div>';
  if (desc) h += '<div class="desc116"><span class="k">' + esc(WORDS.z116Desc) + '　</span>' + esc(desc) + yrTag(tag) + '</div>';
  // 2026-11-20 審查資料第二步（28t）：R 以後要寫的那一項，呼叫端給了系碼（o.deptCode）就放「開始寫」（後端 open_extra_doc 建稿）；
  //   這一系這一項已經開過（o.docs 裡有同代碼的 X 稿）就放「繼續寫」直接連到那一篇。沒給系碼（例如離線測試只畫內容）才照舊寫 notYet。
  var xBtn = function (x) {
    if (!(x.code > 'Q') || !o.deptCode) return '';
    var d = (Array.isArray(o.docs) ? o.docs : []).filter(function (z) { return z && z.nopqType === 'X_extraWriting' && z.itemCode === x.code && String(z.deptCode) === String(o.deptCode); })[0];
    var flag = d && d.promptFlag === 'changed' ? ' <span class="pill warn">' + esc(WORDS.xChanged) + '</span>' : '';   // 28u
    return d ? flag + ' <a class="btn sm" href="#/doc/' + esc(d.caseDocId) + '">' + esc(stepFor(d.state, o.sysOn)[1]) + '</a>'
      : ' <button type="button" class="btn sm" data-act="openExtra" data-dept="' + esc(o.deptCode) + '" data-code="' + esc(x.code) + '">' + esc(WORDS.startWrite) + '</button>';
  };
  if (w.length) h += '<div class="gline"><span class="k">' + esc(WORDS.zWrite) + '</span><ul class="plain">' + w.map(function (x) { return li(x, x.code > 'Q' && !o.deptCode ? WORDS.notYet : '', xBtn(x)); }).join('') + '</ul></div>';
  if (z.portfolio.length) h += '<div class="gline"><span class="k">' + esc(WORDS.zPrep) + '</span><div class="muted small">' + esc(WORDS.pickIntro) + '</div><ul class="plain">' + pick + '</ul>'
    + '<div style="margin-top:6px">' + (o.deptCode && o.official && o.invN !== 0 ? '<a class="btn sm ghost" href="#/dept/' + esc(o.deptCode) + '">' + esc(WORDS.pickBtnDept) + '</a>'   // 11-21 第三步：連到這一系那一頁的畫面③；一件都還沒放維持連到畫面①
      : '<a class="btn sm ghost" href="#/mine">' + esc(WORDS.pickBtn) + '</a>') + '</div></div>';
  // 11-21 第三步（規格第 14.1 節）：打過勾的名稱前寫「準備好了」；整區底下加「去打勾」連到畫面⑤
  var ck = function (x) { var st = o.checks && o.checks[x.code]; var l = li(x, FORM_HINT[x.form] || ''); return st === 'ready' ? l.replace('<li><b>', '<li><span class="pill ok">' + esc(WORDS.scReady) + '</span> <b>') : l; };
  var goCk = o.deptCode && o.official ? '<div style="margin-top:6px"><a class="btn sm ghost" href="#/dept/' + esc(o.deptCode) + '">' + esc(WORDS.scGo) + '</a></div>' : '';
  if (z.school.length) h += '<div class="gline"><span class="k">' + esc(WORDS.zSchool) + '</span><ul class="plain">' + z.school.map(ck).join('') + '</ul>' + (z.other.length ? '' : goCk) + '</div>';
  if (z.other.length) h += '<div class="gline"><span class="k">' + esc(WORDS.zOther) + '</span><ul class="plain">' + z.other.map(ck).join('') + '</ul>' + goCk + '</div>';
  return h + '</div>';
}
// 寫稿頁對照欄（write.js focusCard）一系的內容。dp＝28q nopq_review_focus 的一系；full＝P、Q 單系（true）或 N、O 多系的一小段（false）。
// 題目只畫項目層給的（每條有 sourceId，標自己的來源年份）；沒過檢查的系不講「沒有題目」、不點名，一律同一句＋官方連結；過了檢查且真的沒題目才講「沒有」。
// 115 的系上強調、這系看重、篇幅不畫（後端也已收起；舊後端送來的一樣不畫）。
// 2026-11-21 主線裁示：題目出處是 116 簡章時，題目底下不放「去年學校指引的題目我們正在重新核對」那一句（對照欄到了、還沒到都一樣）；
//   那一句只跟 115 學校指引的內容放在一起（需求頁「去年（115）學校指引」那一行）。這一系列得出 116 題目 → 寫稿頁就不講 115 核對狀態。
function is116Prompt(p) { return !!p && typeof p === 'object' && !!p.text && !!p.sourceId && String(p.sourceId).indexOf('sg:') !== 0 && isQ(p); }
function focusUncShown(dp) {   // 寫稿頁對照欄要不要講「去年學校指引…正在重新核對」：沒過檢查，而且這一系沒有列出 116 題目
  dp = dp || {};
  var qs = (Array.isArray(dp.prompts) ? dp.prompts : []).filter(function (x) { return x && typeof x === 'object' && x.text && x.sourceId && isQ(x); });
  return dp.checked !== true && !qs.some(is116Prompt);
}
function focusDeptHtml(dp, L, full) {
  dp = dp || {};
  var pro = (Array.isArray(dp.prompts) ? dp.prompts : []).filter(function (x) { return x && typeof x === 'object' && x.text && x.sourceId; });
  // 11-18 主線第二次驗收 P2：題目（question）列「要回答」，說明（advice、criteria）另列「說明：」
  var qs = pro.filter(isQ), adv = pro.filter(function (x) { return !isQ(x); });   // 11-21 P3②：照 isQ 分
  var st = dp.listed116 ? (/選繳/.test(dp.needQuote116 || '') ? 'cacOpt' : 'cac') : dp.required === true || dp.required === false ? 'guide' : '';
  var req = st ? needPill(L, st) : '', unc = dp.checked !== true, uncShow = focusUncShown(dp), y115 = (dp.guideYear || 115) + ' 學校指引';
  var link = safeUrl(dp.guideUrl) ? ' <a href="' + esc(dp.guideUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(WORDS.officialLink) + '</a>' : '';
  var li = function (x) { return '<li>' + esc(x.text) + sameCellTag(x) + yrTag(srcLabel(x)) + '</li>'; };
  // 11-18 主線第二次驗收 P1：「沒有」只能來自正面事實——後端 promptsNone＝true 才講 checkedNone；過了檢查但沒題目可給（待複核、共用題目扣住、舊後端沒給旗標）講 checkedPending
  var pend = !unc && !qs.length && dp.promptsNone !== true, none = !unc && !qs.length && dp.promptsNone === true;
  if (!full) {
    return '<div class="fdept"><b>' + (dp.rank ? esc(dp.rank) + '. ' : '') + esc((dp.schoolName || '') + ' ' + (dp.name || '')) + '</b> ' + req
      + (qs.length ? '<div class="small">' + esc(WORDS.focusAskShort) + '</div><ul class="plain">' + qs.map(li).join('') + '</ul>' : '')
      + (adv.length ? '<div class="small">' + esc(WORDS.adv116) + '</div><ul class="plain">' + adv.map(li).join('') + '</ul>' : '')
      + (uncShow ? '<div class="small">' + esc(fill(WORDS.uncheckedLine, { y: dp.guideYear || 115 })) + link + yrTag(y115) + '</div>'
        : pend ? '<div class="small">' + esc(fill(WORDS.checkedPending, { y: dp.guideYear || 115 })) + link + yrTag(y115) + '</div>' : '') + '</div>';
  }
  return (req ? '<div style="margin:0 0 6px">' + req + '</div>' : '')
    + (qs.length ? '<div class="fsec"><b>' + esc(WORDS.focusAsk) + '</b><ul class="fchk">' + qs.map(li).join('') + '</ul></div>' : '')
    + (adv.length ? '<div class="fsec"><b>' + esc(WORDS.adv116) + '</b><ul class="plain">' + adv.map(li).join('') + '</ul></div>' : '')
    + (uncShow ? '<div class="fsec small">' + esc(WORDS.uncheckedDoc) + link + yrTag(y115) + '</div>'
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
  var qs = ps.filter(isQ);   // 11-21 P3②：照 isQ 分（字串、沒帶 kind 的照舊算題目）
  var adv = ps.filter(function (p) { return !isQ(p); }).concat((Array.isArray(d.advice) ? d.advice : []).filter(mine).filter(txt));
  var y = d.guideYear || 115;
  // 2026-11-21：X（自傳、小論文…）的題目是開稿時釘的快照（116 簡章，或去年學校指引），每條照對照欄標出處——對照欄還沒到或沒拿到時，
  //   畫面原本只有題目、不標出處（對照欄到了才有「116 簡章」）。
  var x = d.nopqType === 'X_extraWriting';
  var li = function (p) { return '<li>' + esc(txt(p)) + (typeof p === 'object' ? sameCellTag(p) + (x ? yrTag(srcLabel(p)) : '') : '') + '</li>'; };
  var h = qs.length ? '<ul class="plain">' + qs.map(li).join('') + '</ul>' : '';
  if (adv.length) h += '<div class="muted small">' + esc(WORDS.adv116) + '</div><ul class="plain">' + adv.map(li).join('') + '</ul>';
  // 2026-11-21 主線裁示：列出了 116 簡章的題目，底下就不放 115 學校指引的狀態句（「正在重新核對」「還沒有學校的準備指引」），跟對照欄同一條（focusUncShown）
  if (qs.some(is116Prompt)) return h;
  if (d.guideSource === 'missing' || !d.guideSource) h += '<div class="muted">' + esc(WORDS.noGuide) + '</div>';
  else if (d.checked === true) h += qs.length ? '' : '<div class="muted">' + esc(d.promptsNone === true ? fill(WORDS.checkedNone, { k: letter, y: y }) : fill(WORDS.checkedPending, { y: y })) + '</div>';
  else h += '<div class="muted">' + esc(WORDS.uncheckedNoUrl) + '</div>';
  return h;
}
function focusHasPoints(f) {
  return !!f && Array.isArray(f.depts) && f.depts.some(function (dp) { return dp && Array.isArray(dp.prompts) && dp.prompts.some(function (x) { return x && typeof x === 'object' && x.text && x.sourceId; }); });
}
// 2026-11-21 第三步：官方項目表（後端 28v 的 official：{items:[{code,shortName,groupName,status}], groups:[{groupName,pickLimit,status}]}）
// 沒有這份（後端還沒套 28v）＝不知道上限：不寫上限句、不擋；有這份但那一類是空的＝今年的上限還沒公告。
function offGroup(off, g) { var gs = off && Array.isArray(off.groups) ? off.groups : null; if (!gs) return null; return gs.filter(function (x) { return x && x.groupName === g; })[0] || { groupName: g, pickLimit: null }; }
function offLimit(off, g) { var x = offGroup(off, g); return x ? (x.pickLimit == null ? null : x.pickLimit) : undefined; }   // undefined＝不知道（舊後端）、null＝還沒公告
function offItem(off, code) { var it = off && Array.isArray(off.items) ? off.items.filter(function (x) { return x && x.code === code; })[0] : null; return it || null; }
function offName(off, code) { var it = offItem(off, code); if (it) return it.status === 'pending' ? code : code + ' ' + it.shortName; return codeName(code) || code; }   // 待確認只顯示代碼
function limitLine(off, g, picked) {
  var lim = offLimit(off, g); if (lim === undefined) return '';
  var n = picked && picked[g] != null ? picked[g] : null;
  return lim === null ? WORDS.pickLimitNone : fill(g === '課程學習成果' ? WORDS.pickLimitCourse : WORDS.pickLimitMulti, { limit: lim }) + (n != null ? fill(WORDS.pickedN, { n: n }) : '');
}
function renderItems116(it, o) { var gi = gi116(it); return gi ? renderZones116(gi, { deptCode: it && it.deptCode, docs: o && o.docs,
  official: o && o.official, picked: it && it.pickCounts, checks: it && it.checks, invN: o && o.invN }) : ''; }   // 11-21 第三步：官方項目表（上限）、兩類已勾件數、表格證明打勾、放進來幾件   // 11-20：帶系碼與該生的稿（開始寫／繼續寫）
// 2026-11-12 換 116（owner 拍板 D2／D3／D7）：116 簡章寫的審查資料、自述規定原文、AI 使用聲明提醒。只照原文顯示，不替學生判斷、不代填。
var SELF_LABEL = { aiFront: '要在學習歷程自述「首頁」放學校提供的 AI 使用聲明', aiSeparate: '要另外交 AI 使用聲明（檔案或表格）', aiNote: '作品或小論文用了 AI 要註明',
  chars: '分則寫了字數規定', pages: '分則寫了頁數規定' };
function selfRules(it) { var s = it && it.stage2; return s && Array.isArray(s.selfRules) ? s.selfRules.filter(function (r) { return r && SELF_LABEL[r.kind]; }) : []; }
// 2026-11-21 主線 P3①：分則原文片段（source_assets/cac_116/04_自述規定_116.tsv）是 11-07 照關鍵字各截一段、用「…」接起來的，
//   同一句會被截好幾次（臺大獸醫 001452：750 字、250 字、1000 字三個關鍵字各截一段，三段幾乎全重疊，畫面貼了三次）。
//   這裡把每段放回分則原文（stage2.reviewDesc，比對時不計空白）找位置，重疊或相鄰的合併成一段，照原文順序；
//   原文裡找不到的段，跟別段是包含或頭尾重疊（至少 6 個字）的也併進去，其餘照原樣留著。同一系的幾條規則（字數＋頁數、幾條 AI 聲明）一起合。
function quoteOverlap(a, b) { for (var n = Math.min(a.length, b.length); n > 0; n--) if (a.slice(-n) === b.slice(0, n)) return n; return 0; }
function mergeQuotes(quotes, src) {
  var parts = [];
  (quotes || []).forEach(function (q) { String(q || '').split('…').forEach(function (s) { s = s.replace(/\s+/g, ' ').trim(); if (s) parts.push(s); }); });
  var S = String(src || ''), nw = [], map = [];
  for (var i = 0; i < S.length; i++) if (!/\s/.test(S.charAt(i))) { nw.push(S.charAt(i)); map.push(i); }
  var N = nw.join(''), iv = [], loose = [];
  parts.forEach(function (s) { var w = s.replace(/\s+/g, ''), k = N && w ? N.indexOf(w) : -1; if (k >= 0) iv.push([k, k + w.length]); else loose.push(s); });
  iv.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
  var mg = [];
  iv.forEach(function (x) { var last = mg[mg.length - 1]; if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]); else mg.push([x[0], x[1]]); });   // 重疊或相鄰（下一段的開頭不晚於上一段的結尾）
  var out = mg.map(function (x) { return S.slice(map[x[0]], map[x[1] - 1] + 1).replace(/\s+/g, ' ').trim(); });
  loose.forEach(function (s) {
    for (var j = 0; j < out.length; j++) {
      var o = out[j], ov;
      if (o.indexOf(s) >= 0) return;
      if (s.indexOf(o) >= 0) { out[j] = s; return; }
      if ((ov = quoteOverlap(o, s)) >= 6) { out[j] = o + s.slice(ov); return; }
      if ((ov = quoteOverlap(s, o)) >= 6) { out[j] = s + o.slice(ov); return; }
    }
    out.push(s);
  });
  return out;
}
function needsAiStatement(it) { return selfRules(it).some(function (r) { return r.kind === 'aiFront' || r.kind === 'aiSeparate'; }); }
function rules116Html(it) {
  var s = it && it.stage2; if (!s || s.source !== 'cac-apply116') return '';
  var h = '', items = (Array.isArray(s.reviewItems) ? s.reviewItems : []).map(function (x) { return x && (x.text || x.name); }).filter(Boolean);
  var rs = selfRules(it), ai = rs.filter(function (r) { return /^ai/.test(r.kind); }), len = rs.filter(function (r) { return r.kind === 'chars' || r.kind === 'pages'; });
  if (ai.length) h += '<div class="issue small"><b>' + esc(SELF_LABEL[ai[0].kind]) + '。</b>聲明怎麼寫、檔案去哪下載，照分則說明到學校網站；NOPQ通不代填。'
    + mergeQuotes(ai.map(function (r) { return r.quote; }), s.reviewDesc).map(function (q) { return '<div class="muted small">分則原文：「…' + esc(q) + '…」</div>'; }).join('') + '</div>';
  var gi = gi116(it);   // 2026-11-17：有 116 項目層時，「要交什麼」與簡章原文改由卡片上方 renderItems116 顯示，這裡不重複
  if (items.length && !gi) h += '<div class="gline"><span class="k">116 簡章寫要交</span>' + esc(items.join('、')) + '</div>';
  if (len.length) h += '<div class="gline"><span class="k">篇幅（分則原文）</span>' + mergeQuotes(len.map(function (r) { return r.quote; }), s.reviewDesc).map(function (q) { return '「…' + esc(q) + '…」'; }).join('<br>') + yrTag('116 簡章') + '</div>';
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
function renderGuideCard(it, star, o) {   // o.docs＝學生的稿（me_home docs；11-20 起 R 以後要寫的那一項放開始寫／繼續寫）
  var f = factsOf(it), g = hasGuide(it) ? it.guide : null, name = (it.schoolName || '') + ' ' + (it.name || '');
  var h = '<div class="need guide-card"><div class="row spread"><b>' + esc(it.rank) + '. ' + esc(name.trim()) + '</b>' + snapPill(it.snapshot) + '</div>'
    + renderItems116(it, o)
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
    out.push({ k: 'ext', text: (l.name || '外部介紹') + (l.checkedAt ? '，' + String(l.checkedAt).slice(0, 10) + ' 查證' : ''), url: l.url });
  });
  if (intro && intro.teacherNote) out.push({ k: 'teacher', text: intro.teacherNote, by: intro.teacherBy || '', at: intro.teacherAt || '' });
  return out;
}
function renderDeptIntro(lines, fmtDate) {
  var mach = lines.filter(function (l) { return l.k !== 'teacher'; }), tea = lines.filter(function (l) { return l.k === 'teacher'; });
  var li = function (l) { return '<li>' + (l.url ? '<a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.text) + '</a>' : esc(l.text)) + '</li>'; };
  return '<ul class="ilist">' + mach.map(li).join('') + '</ul><div class="muted small">機器整理，老師還沒確認。</div>'
    + tea.map(function (l) { return '<div class="tnote"><b>老師寫的</b>　' + esc(l.text) + '<span class="muted small">　' + esc(l.by) + (l.at && fmtDate ? '，' + esc(fmtDate(l.at)) : '') + '</span></div>'; }).join('');
}
// ── 2026-11-24 A13 W15：N、O 的旁欄與挑件頁上半塊（各系要求分「都要的」「某系多要的」）。資料＝後端 28y my_doc_dept_diff 的 diff，兩處用同一份、同一套分法 ──
// common＝兩個系以上都有的句子（每句附哪幾系）；depts[].only＝只有這一系有；status＝checking 的系只回系名，不回任何句子（不帶 115）。
// 只有一個系通過檢查時：那一系的要求全部算「都要的」（只有一系，沒有「某系才有」可分）。
function diffZones(diff) {
  var ds = diff && Array.isArray(diff.depts) ? diff.depts.filter(Boolean) : [];
  var ok = ds.filter(function (d) { return d.status === 'ok'; }), chk = ds.filter(function (d) { return d.status === 'checking'; });
  var nm = function (d) { return ((d.schoolName || '') + ' ' + (d.name || '')).trim() || String(d.deptCode || ''); };
  var byCode = {}; ds.forEach(function (d) { byCode[d.deptCode] = nm(d); });
  var item = function (x, names) { return { text: String(x.text || ''), kind: x.kind || 'question', names: names || [] }; };
  var all = [], some = [];
  if (ok.length === 1) all = (ok[0].only || []).map(function (x) { return item(x); });
  else if (ok.length > 1) {
    all = (Array.isArray(diff.common) ? diff.common : []).map(function (c) { var cs = Array.isArray(c.depts) ? c.depts : []; return item(c, cs.length >= ok.length ? [] : cs.map(function (k) { return byCode[k] || k; })); });
    some = ok.filter(function (d) { return (d.only || []).length; }).map(function (d) { return { dept: nm(d), deptCode: d.deptCode, items: d.only.map(function (x) { return item(x); }) }; });
  }
  return { all: all, some: some, checking: chk.map(function (d) { return { dept: nm(d), deptCode: d.deptCode }; }), okCount: ok.length };
}
// o.t＝畫面字 { all, some（含 {dept}）, checking（含 {dept}）, none }；o.link(deptCode)＝這一系的官方原文連結（沒有就空字串）
function focusDiffHtml(diff, o) {
  var z = diffZones(diff), t = (o && o.t) || {}, link = (o && o.link) || function () { return ''; };
  var li = function (x) { return '<li>' + (isQ({ kind: x.kind, text: x.text }) ? '' : esc(WORDS.adv116)) + esc(x.text) + (x.names.length ? ' <span class="muted small">（' + esc(x.names.join('、')) + '）</span>' : '') + '</li>'; };
  var h = '';
  if (z.all.length) h += '<div class="fsec dzone dz-all"><b>' + esc(t.all) + '</b><ul class="plain">' + z.all.map(li).join('') + '</ul></div>';
  var some = z.some.map(function (s) { return '<div class="dsome"><b>' + esc(fill(t.some, { dept: s.dept })) + '</b><ul class="plain">' + s.items.map(li).join('') + '</ul></div>'; }).join('');
  // 2026-11-25 第 1 批 N13-01（owner 第 3 件甲）：核對中的系合成一行；〔看官方原文〕展開列出是哪幾系、各連官方原文；只有 1 系時直接寫系名；一個連結都沒有就不出按鈕
  var cl = z.checking.map(function (c) { return { dept: c.dept, u: safeUrl(link(c.deptCode)) }; }), chk = '';
  if (cl.length === 1) chk = '<div class="small dchk">' + esc(fill(t.checkingOne || t.checking, { dept: cl[0].dept, n: 1 })) + (cl[0].u ? ' <a href="' + esc(cl[0].u) + '" target="_blank" rel="noopener noreferrer">' + esc(WORDS.officialLink) + '</a>' : '') + '</div>';
  else if (cl.length > 1) { var withU = cl.filter(function (c) { return c.u; });
    chk = '<div class="small dchk">' + esc(fill(t.checkingN || t.checking, { n: cl.length, dept: '' })) + (withU.length ? '<details class="more dchk-more"><summary>' + esc(WORDS.officialLink) + '</summary><ul class="plain">'
      + cl.map(function (c) { return '<li>' + (c.u ? '<a href="' + esc(c.u) + '" target="_blank" rel="noopener noreferrer">' + esc(c.dept) + '</a>' : esc(c.dept)) + '</li>'; }).join('') + '</ul></details>' : '') + '</div>'; }
  if (some || chk) h += '<div class="fsec dzone dz-some">' + some + chk + '</div>';
  return h || '<p class="small dnone" style="margin:0 0 6px">' + esc(t.none) + '</p>';
}
root.NG = { stepFor: stepFor, STEP: STEP, diffZones: diffZones, focusDiffHtml: focusDiffHtml, isQ: isQ, mergeQuotes: mergeQuotes, offGroup: offGroup, offLimit: offLimit, offItem: offItem, offName: offName, limitLine: limitLine, CAC_NAMES: CAC_NAMES,codeName: codeName, pqGuideHtml: pqGuideHtml, sameCellTag: sameCellTag, DOC_SHORT: DOC_SHORT, WORDS: WORDS, fill: fill, needOf: needOf, needPill: needPill, isListed: isListed, srcLabel: srcLabel, unchecked: unchecked, focusDeptHtml: focusDeptHtml, focusUncShown: focusUncShown, is116Prompt: is116Prompt, focusHasPoints: focusHasPoints, needLine: needLine, gi116: gi116, zones116: zones116, itemName: itemName, prompt116: prompt116, renderItems116: renderItems116, renderZones116: renderZones116, digestRows: digestRows, yrTag: yrTag, renderStar: renderStar, selfRules: selfRules, needsAiStatement: needsAiStatement, rules116Html: rules116Html, deptIntroLines: deptIntroLines, renderDeptIntro: renderDeptIntro, esc: esc, safeUrl: safeUrl, s2Line: s2Line, s2Facts: s2Facts, snapPill: snapPill, hasGuide: hasGuide, reqState: reqState, factsOf: factsOf, guideSummary: guideSummary, limitText: limitText, digestLines: digestLines, renderDigest: renderDigest, renderGuideCard: renderGuideCard };
})(typeof window !== 'undefined' ? window : globalThis);
