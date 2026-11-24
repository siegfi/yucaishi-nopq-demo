'use strict';   // 原本整支主程式包在一個函式裡並開嚴格模式；拆檔後每個檔各自開
// ── 寫：文件清單 ──
// 2026-11-24 A13 W12-05：AI 關（或沒有 AI 同意）時，N、O 照固定題一題接一題答完整篇（後端 28z noAiFlow＝fixed）；不再說「由老師出下一題」
const OFF_HANDED_HINT = '整篇交給老師看了，老師看完會再問你。不用在畫面上等。';
const OFF_FLOW_HINT = '照題目一題一題答，整篇答完就交給老師看，老師看完會再問你。不用在畫面上等。';
// 2026-11-24 A13 W13（NOPQ 寫作改造前端包二：挑件、引述）：字見文案對照表第 11 節 W13-01～W13-32；挑件頁的字照審閱稿 v0.2 第 77～84 句，O 的件數照 09 補充改成兩件（可以三件）
const W13 = {
  pickTitle: '先挑{n}件事', pickLead: '從下面挑{n}件（可以{m}件），每一件會變成這一篇的一段。',
  reqTitle: '你的志願系看重什麼', reqLead: '幾個志願系對這一篇的要求，分成「都要的」和「某系多要的」。', reqAll: '都要的', reqSome: '{dept}多要的',
  reqNone: '這幾個志願系對這一篇的要求還在整理，先看下面各系有採計的類別。',
  catLead: '最後一行是各志願系有採計的類別。挑的時候對照一下，盡量挑有對到的。', catRow: '第 {rank} 志願 {dept}：{list}', catNone: '還沒有整理出來',
  tagPicked: '{n}個志願系勾過', tagNone: '還沒勾給任何志願系',
  altLead: '還沒放件，或這些都不想用？按這裡，照題目一題一題寫也可以。', altBtn: '我先用寫的',
  short: '還沒挑滿{n}件。再挑到{n}件就能往下；真的不夠，可以按〔我先用寫的〕。', over: '最多挑{m}件。請拿掉一件，留下你最講得出細節的。',
  doneNote: '每一件會變成一段，標題先幫你帶好了。接著一段一段問你，每段三小格。', next: '下一步', count: '已挑 {n} 件', loading: '正在讀你放的件…',
  emptyInv: '你還沒放任何學習歷程。可以先寫，之後放進來再補引用。', goPut: '去放一件',
  panel: '我的學習歷程', cited: '這篇引用了', citedNone: '這一篇還沒引用任何一件。', items: '我放的件（{n}）', hereTag: '為這系勾的', citedAt: '這一篇引用在：{where}',
  btnCite: '引用這一件', btnView: '看內容', btnHide: '收起內容', btnDrop: '拿掉', btnDropCite: '拿掉引用', claimLab: '我用它證明什麼（選填，100 字內）', btnClaim: '存這一句',
  notHere: '這一件你沒有勾給這系，審查老師看不到原件。', goPick: '去勾', gone: '這一件已經收起來了。', whole: '整篇',
  noFree: '每一段都已經有引用的件了。要換的話，先拿掉一條。', full: '這一格已經引用滿了。要換的話，先拿掉一條。', exists: '這一件已經引用過了。', added: '引用好了。', dropped: '拿掉了。', claimed: '存好了。',
  loadFail: '我的學習歷程暫時讀不到，重新整理再看。', textFail: '這一件的內容現在讀不到。',
  abTitle: '能力對照表', abNote: '這張表由系統照每個檔案段的能力標籤排出，只看、不用填。要改，回到那一段改能力標籤。', abEmpty: '還沒選能力標籤，選好之後會排在這裡。', abCorner: '哪一件',
  deptNo: '這一件還沒在任何一篇裡提到。',
  pickedOk: '每一件都記成一段了。', pickGone: '有一件找不到了（可能已經收起來）。重新整理再挑。', noText: '（沒有讀到文字）',
};
const w13 = (k, o) => NG.fill(W13[k], o);
const zhN = (n) => ({ 1: '一', 2: '兩', 3: '三', 4: '四', 5: '五' }[n] || String(n));   // 件數寫成國字（審閱稿第 77、82、83 句）
// 2026-11-24 A13 W14（NOPQ 寫作改造前端包三：P、Q 分格畫面）：字見文案對照表第 12 節 W14-01～W14-14；格名由後端規格帶來（審閱稿 v0.2 第 67～76 句），這裡不寫死
const W14 = {
  toFree: '改成整段寫', toGrid: '改成分格寫',
  gridNote: '一格寫一段，格名就是那一段要講的事。交出去時，各格照順序拼成一整篇。',
  freeNote: '整段寫：全部寫在一個框裡。改回分格寫時，這個框裡的字不會自動搬進各格。',
  sharedTag: '每個志願系共用', sharedNote: '寫一次，你每個志願系的{L}都帶這一格的字。', btnSplit: '這一系另外寫',
  splitTag: '這一系自己寫', splitNote: '這一格現在只算這一系的，改了不會影響別系。', deptTag: '每一系各寫', empty: '（空白）',
  citeHint: '可以在「我的學習歷程」按〔引用這一件〕，引用的件會記在這一格。', citeHere: '這一格引用：{list}',
  keptTitle: '你整段寫的字還留著', keptNote: '這些字沒有搬進各格。要用的話，複製後貼進對應的那一格；存了分格寫之後，這段字還在版本紀錄裡。', btnCopyKept: '複製這段字', copied: '複製好了。',
  teacherTitle: '老師改過整篇', teacherNote: '老師改的是整篇，下面是改過的全文；各格裡是你原本寫的。',
  doneGrid: '改成分格寫了。', doneFree: '改成整段寫了。', doneSplit: '這一格改成這一系自己寫了。',
};
const w14 = (k, o) => NG.fill(W14[k], o);
// 2026-11-24 A13 W15（NOPQ 寫作改造前端包四：六系差異旁欄、檢查提示、圖位）：字見文案對照表第 13 節 W15-01～W15-10；R1～R10 的句子由後端 my_doc_check 帶來（審閱稿 v0.2 第 86～95 句），這裡不寫死
const W15 = {
  chkTop: '下面有{n}條還沒過。一條一條改，改完再按一次〔檢查〕。', btnCheck: '檢查', chkOk: '檢查過了，沒有還沒過的地方。', chkHow: '點一條，會跳到要改的那一格。',
  photoLab: '這段放圖', photoNote: '全篇最多三張。這裡只記這一段放不放，不用上傳圖檔。', photoFail: '這一段放不放圖沒有存成功，再按一次。',
  dChecking: '{dept}：這一系的要求還在核對，寫之前先看官方原文。', dNone: '這幾個志願系對這一篇的要求還在整理。',
};
const w15 = (k, o) => NG.fill(W15[k], o);
// 2026-11-24 A13 W23（NOPQ 寫作改造前端包五：句型與檢核句）：字見文案對照表第 14 節 W23-01～W23-05；句型與檢核句本體來自規格（後端 29c 版本 4：questions[].patterns／patternMode／checkLine，審閱稿 v0.2），這裡不寫死
const W23 = { patBtn: '看句型', patHide: '收起句型', patTitle: '句型：挑一種開頭，把＿＿填上', patNote: '寫完請改成自己的話。', selfChk: '自己檢查一下', selfChkOf: '自己檢查一下｜{label}', selfChkNote: '這只是提醒，不影響交出。' };
function qOf(secKey, fieldKey) {   // 這一格（段＋小格）在規格裡的整題；整段題（沒有小格）取 text 或第一題
  const s = (((gridSpec() || {}).sections) || []).find((x) => x.key === secKey), qs = (s && s.questions) || [];
  return (fieldKey && fieldKey !== 'text' ? qs.find((q) => q.key === fieldKey) : qs.find((q) => q.key === 'text') || qs[0]) || null;
}
const w23 = (k, o) => NG.fill(W23[k], o);
const patOpenS = () => (S.ui.patOpen = S.ui.patOpen || {});
function patHtml(q, pk) {   // 給＝直接列三種；卡住時給（缺省）＝一顆〔看句型〕、按了才展開；不給或沒有句型＝什麼都不出現
  if (!q || !Array.isArray(q.patterns) || !q.patterns.length || q.patternMode === 'none') return '';
  const list = `<div class="pat-box"><div class="pat-title">${esc(W23.patTitle)}</div><ol class="pat-list">${q.patterns.map((p) => `<li>${esc(p)}</li>`).join('')}</ol><div class="muted small">${esc(W23.patNote)}</div></div>`;
  if (q.patternMode === 'give') return `<div class="pat" data-pat="give">${list}</div>`;
  const open = !!patOpenS()[pk];
  return `<div class="pat" data-pat="stuck"><button type="button" class="btn ghost sm" data-act="patToggle" data-pk="${esc(pk)}" aria-expanded="${open}">${esc(open ? W23.patHide : W23.patBtn)}</button>${open ? list : ''}</div>`;
}
ACT.patToggle = (el) => { const o = patOpenS(), k = el.dataset.pk; o[k] = !o[k]; renderDoc(); };
const cellChkOn = (k) => !!(S.ui && S.ui.cellChk && S.ui.cellChk[k]);
const cellFilled = (c) => { const v = S.ui.draft[c.key]; return Array.isArray(v) ? v.length > 0 : String(v == null ? '' : v).trim() !== ''; };
function cellChkAll() {   // 按〔檢查〕：每一個寫了字（或選了詞）的格，把那一格的檢核句列在它下面
  if (!isNO(S.doc) || !gridSpec() || !S.ui.draft) return; const m = (S.ui.cellChk = S.ui.cellChk || {});
  visibleCells().cells.forEach((c) => { if (c.q && c.q.checkLine && cellFilled(c)) m[c.key] = 1; });
}
// 寫完一格（離開那個框、字不是空的）→ 那一格下面出現檢核句；等 0.5 秒再放，免得學生正要點〔儲存〕時按鈕被擠走；點到按鈕的不放（按〔檢查〕會一起列）
document.addEventListener('focusout', (ev) => {
  const el = ev.target; if (!el || !el.matches || !el.matches('textarea[data-in="cell"]') || !S.doc || !isNO(S.doc) || !S.ui || !S.ui.draft) return;
  if (ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest('button,a,.btn')) return;
  const key = el.dataset.key, id = S.docId;
  setTimeout(() => {
    if (id !== S.docId || !S.ui || !S.ui.draft || !gridSpec() || cellChkOn(key)) return;
    const c = visibleCells().cells.find((x) => x.key === key); if (!c || !c.q || !c.q.checkLine || !cellFilled(c)) return;
    (S.ui.cellChk = S.ui.cellChk || {})[key] = 1;
    const slot = [...document.querySelectorAll('.cellchk')].find((n) => n.dataset.ck === key); if (slot) slot.innerHTML = chkLineBox(c.q, W23.selfChk);
  }, 500);
});
const chkLineBox = (q, title) => (q && q.checkLine ? `<div class="selfchk" role="note"><div class="pat-title">${esc(title)}</div><div>${esc(q.checkLine)}</div><div class="muted small">${esc(W23.selfChkNote)}</div></div>` : '');
const isNO = (d) => !!d && (d.nopqType === 'N_diverseSummary' || d.nopqType === 'O_reflection');
const DOC_STEP = {
  warmup: ['還沒開始', '開始'], interviewing: ['有一題等你回答', '繼續'], assignment_pending: ['正在準備下一個題目', '看一下'],
  submission_pending: ['題目出來了', '去寫答案'], feedback_pending: ['已交出，等回覆', '看一下'], feedback_published: ['回覆出來了', '去看'],
  draft_open: ['輪到你寫稿', '去寫'], self_check_pending: ['正在整理你的稿', '看一下'], review_pending: ['老師正在改你的稿', '看一下'], finalized: ['定稿了', '看稿'],
};
// 2026-11-24 A13 W12-08：AI 關（或沒有同意）時，「待出作業」＝整篇已交給老師，不是系統在準備下一題
const aiIsOff = () => S.aiOn === false || !(((S.home || {}).consent || {}).ai);
function stepOf(state, dflt) {
  if (state === 'assignment_pending' && aiIsOff()) return ['整篇交給老師了', '看一下'];
  return DOC_STEP[state] || dflt || ['', '進入'];
}
async function viewWrite() {
  setTab('write'); view(loading); const my = S.rt;
  const [h, w] = await Promise.all([call('me_home'), call('my_wishlist', {}, { quiet: true }).catch(() => null)]); if (!h.ok || my !== S.rt) return; S.home = h;
  const j = h.journey || {}, step = j.step || 2, docs = h.docs || [], early = step >= 2 && step < 6 ? STEP_CARD[step] : null;
  view(`<div class="card"><div class="row spread"><h2 style="margin:0">撰寫NOPQ</h2><a class="btn ghost sm" href="#/deliver">我要交的（每個志願一張清單）</a></div>
    ${j.scan || !docs.some((x) => x.state === 'warmup' && (x.nopqType === 'N_diverseSummary' || x.nopqType === 'O_reflection')) ? '' : `<div class="hint">${esc(INV_GATE_TEXT)} <a class="btn sm" href="#/mine">去我的學習歷程</a></div>`}
    ${early ? `<div class="hint">前面還有一步沒走完：${esc(early.t)} <a href="${esc(early.href)}">去看看</a>${j.scan ? '。N、O 現在就可以先寫。' : ''}</div>` : ''}
    ${aiStatementHint(w && w.ok ? w.items : [], !!h.consent.ai)}
    ${h.consent.general ? '' : '<div class="hint">同意書還沒登錄完成，暫時不能開始寫。請聯絡育才仕。</div>'}
    ${S.aiOn === false || !h.consent.ai ? `<div class="hint">${esc(OFF_FLOW_HINT)}</div>` : ''}
    ${docs.length ? docListHtml(docs, w && w.ok ? w.items || [] : [], j.wishlistSummary || {}, !(w && w.ok)) :'<p class="muted">老師還沒幫你開好要寫的稿子。</p>'}</div>`);
}
// 2026-11-12 換 116（owner 拍板 D7：提醒、不代填）：志願裡有系要交 AI 使用聲明時，在「寫」頁提醒；聲明是學生自己寫，系統不替他判斷
function aiStatementHint(items, aiOn) {
  const need = (items || []).filter((it) => NG.needsAiStatement(it)); if (!need.length) return '';
  const names = need.map((it) => (it.schoolName || '') + ' ' + (it.name || '')).join('、');
  return `<div class="hint"><b>你的志願裡有 ${need.length} 系要交「AI 使用聲明」</b>（${esc(names)}）。聲明要你自己寫${aiOn ? '。你在 NOPQ通用過追問、寫作建議，或請育才仕代擬的稿，聲明裡要照實寫' : ''}。怎麼交、檔案在哪下載，看<a href="#/need">「審查資料準備指引說明」</a>裡那幾系的說明。</div>`;
}
// 2026-11-08 架構稿 W4：P、Q 每個志願系各一篇（整段稿）；已不在志願的系收在最下面，稿都還在
const isPQ = (d) => d.nopqType === 'P_motivation' || d.nopqType === 'Q_futurePlan';   // 只有 P、Q：可以從別系複製
// 2026-11-20 審查資料第二步（28t，設計稿審查 R20）：三種判斷分開——整段稿（P、Q、X）／可跨系複製（只有 P、Q）／系別稿（P、Q、X，放在該系那一組）
const isX = (d) => !!d && d.nopqType === 'X_extraWriting';
const isFree = (d) => isPQ(d) || isX(d);
// 28u（指引重建設計稿第 12 節）：題目換了／今年沒有這一項。後端還沒套 28u 時沒有 promptFlag、promptCheck 這兩個鍵，下面的提醒全部不出現。
const PROMPT_FLAG = { changed: ['warn', '題目換了'], gone: ['', '今年沒有這一項'] };
const flagPill = (d) => { const f = PROMPT_FLAG[d && d.promptFlag]; return f ? ` <span class="pill ${f[0]}">${esc(f[1])}</span>` : ''; };
function docRow(d, short, note) {   // short：放在某一系那一組裡，標題只寫「P 就讀動機」（系名在組的標題）
  const st = stepOf(d.state), later = d.state === 'warmup' && isPQ(d) && d.docMode !== 'free';   // 後端還沒放行 P、Q（沒套 28g）時維持「之後再寫」
  const extra = isFree(d) && d.freeLen ? '｜已寫 ' + d.freeLen + ' 字' : '';
  return `<div class="doc-row"><div class="dmain"><div style="font-weight:700">${esc(short ? typeName(d) : docTitle(d))}${flagPill(d)}</div><div class="muted small">${esc(later ? '之後再寫' : st[0])}${d.round ? '｜第 ' + d.round + ' 輪' : ''}${esc(extra)}</div>${note ? '<div class="muted small pq-noreq">' + esc(note) + '</div>' : ''}</div>
    <button type="button" class="btn sm ${d.state === 'warmup' || d.state === 'interviewing' || d.state === 'draft_open' || d.state === 'submission_pending' ? '' : 'ghost'}" data-act="openDoc" data-id="${esc(d.caseDocId)}" data-state="${esc(d.state)}" ${later ? 'disabled' : ''}>${esc(st[1])}</button></div>`;
}
// 2026-11-13 改版建議第 31 條（USER 原話「寫NOPQ，你這邊很亂。應該要每個科系繳交要一個群」）：一個科系一組，該系要交的 P、Q 收在同一組，照志願順序；
// N、O 不分系（一篇給所有志願系），另成一組放最上面；已不在志願的系也一系一組，收在最下面。組的標題寫該系要不要交（指引的必交／選交）與定稿幾篇。
const DOC_ORDER = { N_diverseSummary: 1, O_reflection: 2, P_motivation: 3, Q_futurePlan: 4, X_extraWriting: 5 };   // X（R 以後各系要寫的）排在 P、Q 後面、照代碼
// 2026-11-17 owner「都照建議」第②題：不再寫「必交」，改依 116 簡章／去年指引有沒有列（用語都在 guide_pure.js 的 NG.WORDS）
function reqPills(it) {
  if (!it || (!NG.hasGuide(it) && !NG.gi116(it))) return `<span class="pill warn">${esc(NG.WORDS.noGuideYet)}</span>`;
  return ['P', 'Q'].map((k) => { const s = NG.needOf(it, k); return NG.isListed(s) ? NG.needPill(k, s) : ''; }).join('') || `<span class="pill warn">${esc(NG.WORDS.allNone)}</span>`;
}
// 2026-11-14 回饋清單第 42 條：指引已整理、但沒寫這一篇（P 或 Q）要不要交 → 那一列加一句說明；指引還沒整理的系不加（組名已寫）；不改「每系都開 P、Q」
function noReqNote(it) {
  if (!it || (!NG.hasGuide(it) && !NG.gi116(it))) return null;
  return (d) => { const k = d.nopqType === 'P_motivation' ? 'P' : d.nopqType === 'Q_futurePlan' ? 'Q' : '', s = k ? NG.needOf(it, k) : 'x'; return k && !NG.isListed(s) ? NG.fill(NG.WORDS.notListed, { k }) : ''; };
}
function groupHtml(title, sub, list, extra, noteOf) {
  const fin = list.filter((d) => d.state === 'finalized').length;
  return `<section class="dgroup"><div class="dghead"><div><b>${title}</b>${extra || ''}</div><span class="muted small">定稿 ${fin}／${list.length} 篇</span></div>
    ${sub ? `<div class="muted small dgsub">${sub}</div>` : ''}${list.slice().sort((a, b) => (DOC_ORDER[a.nopqType] || 9) - (DOC_ORDER[b.nopqType] || 9) || String(a.itemCode || '').localeCompare(String(b.itemCode || ''))).map((d) => docRow(d, isFree(d), noteOf ? noteOf(d) : '')).join('')}</section>`;
}
function docListHtml(docs, wish, ws, wishFail) {   // wishFail＝志願資料（my_wishlist）讀不到或太慢：不能當成「指引還沒整理」（2026-11-14）
  const no = docs.filter((d) => !isFree(d)), pq = docs.filter(isFree), on = pq.filter((d) => d.inWishlist !== false), off = pq.filter((d) => d.inWishlist === false);   // 11-20：X 跟 P、Q 一樣放在該系那一組
  const byKey = (list) => { const m = new Map(); list.forEach((d) => { const k = String(d.deptCode || '') + '|' + (d.deptName || ''); if (!m.has(k)) m.set(k, []); m.get(k).push(d); }); return [...m.values()]; };
  const wishOf = (d) => (wish || []).find((it) => String(it.deptCode) === String(d.deptCode));
  // owner 第②題：N、O 幾系「列了」照每一系的 116 簡章／去年指引算（不再用後端 115 的 required 計數）；讀不到志願就退回一句話
  const nCount = (k) => (wish || []).filter((it) => NG.isListed(NG.needOf(it, k))).length;
  const nNeed = wish && wish.length ? NG.fill(NG.WORDS.wishCount, { total: wish.length, parts: ['N', 'O'].map((k) => NG.fill(NG.WORDS.wishPart, { c: nCount(k), k })).join('、') }) : '一篇給所有志願系。';
  const onGroups = byKey(on).sort((a, b) => (a[0].wishRank || 99) - (b[0].wishRank || 99));
  return (no.length ? groupHtml('N、O（每一系共用）', esc(nNeed), no) : '')
    + onGroups.map((g) => { const d = g[0], it = wishOf(d); return groupHtml(`${d.wishRank ? '第 ' + esc(d.wishRank) + ' 志願　' : ''}${esc(d.deptName || '（系名查不到）')}`, '', g, ' ' + (wishFail ? '<span class="pill warn">這一系的要求暫時讀不到，重新整理再看</span>' : reqPills(it)), wishFail ? null : noReqNote(it)); }).join('')
    + (off.length ? `<details style="margin-top:10px"><summary class="muted">已不在志願的系（${off.length} 篇，寫過的都還在）</summary>${byKey(off).map((g) => groupHtml(esc(g[0].deptName || '（系名查不到）'), '', g)).join('')}</details>` : '');
}
// ── 第 6、7、8 幕：老師帶你寫、老師改稿、定稿（文件頁）──
const stopPoll = () => { S.poll++; };
const GET = (opts) => call('get_doc_state', { p_case_doc_id: S.docId }, Object.assign({ quiet: true, noRefresh: true }, opts));
async function viewDoc(id) {
  setTab('doc'); S.docId = id; S.ui = {}; S.terms = []; S.termsMiss = {}; view(loading);
  const d = await GET({ quiet: false }); if (!d.ok) { location.hash = '#/write'; return; }
  S.doc = d; S.focus = null; await loadTerms(); syncUi(); renderDoc();
  ciLoad();   // 2026-11-24 A13 W13：挑件頁與「我的學習歷程」面板要的資料（件清單；還沒開始的 N、O 另讀志願）
  // 11-13 第 32 條：這一篇要對照的要點（28o my_doc_focus；跟之後送 AI 批改的是同一份）。先畫稿，要點回來再補；後端沒有這支就不出這一欄
  call('my_doc_focus', { p_case_doc_id: id }, { quiet: true, noRefresh: true }).then((r) => { if (r && r.ok && r.focus && S.docId === id) { S.focus = r.focus; renderDoc(); } }).catch(() => null);
  S.diff = null;   // 2026-11-24 A13 W15：N、O 的旁欄與挑件頁上半塊讀同一份各系差異（28y my_doc_dept_diff）；P、Q、X 單系不用；讀不到（false）就退回舊的畫法
  if (isNO(d)) call('my_doc_dept_diff', { p_case_doc_id: id }, { quiet: true, noRefresh: true }).then((r) => { if (S.docId === id) { S.diff = r && r.ok && r.diff ? r.diff : false; renderDoc(); } }).catch(() => { if (S.docId === id) { S.diff = false; renderDoc(); } });
  if (d.pendingJobId) runAi(d.pendingJobId, '還在整理上一步，稍等一下…', true);
}
async function refreshDoc() { if (!S.docId) return null; const d = await GET(); if (d.ok && d.caseDocId === S.docId) { S.doc = d; if (termsStale()) await loadTerms(); syncUi(); renderDoc(); } return d; }
// 2026-11-22 AI 改排隊（設計 OUTPUTS/nopq_ai_queue_design_v0.1.md 第 4.5 節）：前端不再叫 nopq-ai，工作由資料庫派給背景工作者。
//   只輪詢 ai_job_status：前 60 秒每 3 秒、之後每 10 秒；分頁在背景就暫停；工作結束才重讀整頁；資料庫接著建的下一件（例如出下一題）也接著等。
//   在重試、或等超過 slowSec（正式 60 秒）→ 換成 AI_SLOW；逾時 → 「等太久沒有完成」＋老師接手那一句。最多等 12 分鐘（總期限 10 分鐘＋餘裕）。
//   後端還沒有 ai_job_status（雲端還沒套 28w）：退回每 2 秒讀整頁、最多 60 秒（舊的等法，但不再叫函式）。學生畫面不出現 AI 字樣（改判乙）。
const AI_SLOW = '比平常久一點，還在整理。你可以先離開，回來再看。';
async function runAi(jobId, label, silent) {
  if (!jobId) return;
  const my = ++S.poll, t0 = Date.now(), base = label || '正在整理，通常幾秒鐘…'; S.ui.waiting = base; renderDoc();
  let id = jobId, st = null, legacy = false;
  for (let i = 0; S.poll === my && Date.now() - t0 < 12 * 60000; i++) {
    if (document.hidden) { await sleep(1000); continue; }   // 分頁在背景：先不問，回來再接著問
    st = legacy ? null : await call('ai_job_status', { p_job_id: id }, { quiet: true, noRefresh: true }).catch(() => null);
    if (!st || !st.ok) {   // 查不到進度：改讀整頁
      legacy = true;
      const d = await GET().catch(() => ({ ok: false })); if (!d.ok) break; S.doc = d;
      if (!d.pendingJobId || i >= 30) break;
      id = d.pendingJobId; await sleep(2000); continue;
    }
    if (['done', 'failed', 'timeout', 'rejected'].includes(st.phase)) {
      const d = await GET().catch(() => ({ ok: false })); if (d.ok) S.doc = d;
      if (d.ok && d.pendingJobId && d.pendingJobId !== id) { id = d.pendingJobId; continue; }   // 資料庫接著建的下一件，接著等
      break;
    }
    const w = st.phase === 'retrying' || (st.ageSec || 0) >= (st.slowSec || 60) ? AI_SLOW : base;
    if (S.ui.waiting !== w) { S.ui.waiting = w; renderDoc(); }
    await sleep(Date.now() - t0 < 60000 ? 3000 : 10000);
  }
  if (S.poll === my && st && st.phase === 'timeout' && !silent) toast('等太久沒有完成。這一步由老師來做，你寫的內容都已保留。');
  if (S.poll === my) { S.ui.waiting = null; if (S.doc && termsStale()) await loadTerms(); syncUi(); renderDoc(); }
}
// 畫面輸入的暫存：伺服器端版本或題目變了才重設，其餘重畫時保留使用者打到一半的字
function syncUi() {
  const d = S.doc, u = S.ui, turns = (d.cycle && d.cycle.turns) || [], open = turns.find((t) => !t.answered);
  if (u.answerFor !== (open ? open.id : null)) { u.answerFor = open ? open.id : null; u.answer = ''; }
  const a = d.assignment; if (u.assignFor !== (a ? a.id : null)) { u.assignFor = a ? a.id : null; u.assignText = a && a.submission ? a.submission.text || '' : ''; }
  const v = d.draft && d.draft.currentVersion, vid = v ? v.id : null;
  if (u.draftBase === undefined || u.draftBase !== vid) {
    u.draftBase = vid; u.draft = JSON.parse(JSON.stringify((v && v.textBySection) || {})); u.dirty = false;
    u.mode = (v && v.mode === 'free') || d.docMode === 'free' ? 'free' : 'grid';
    u.freeText = d.docMode === 'free' ? d.freeText || '' : (v && v.mode === 'free' && u.draft._free) || ''; delete u.draft._free;
  }
  pqSync();   // 2026-11-24 A13 W14：P、Q 分格寫的字（沒在打的格照伺服器放回）
}
const HINTS = {
  warmup: '按「開始」，先回答第一個問題。',
  interviewing: '',
  assignment_pending: '你說的收到了，正在準備下一個題目，出好會顯示在這裡。',   // AI 關時 headCard 換成 OFF_HANDED_HINT
  submission_pending: '題目出來了。把答案貼在下面的框，寫好就交出去。',
  feedback_pending: '已交出，等回覆。出來前不用再做什麼。',
  feedback_published: '回覆出來了，先看下面。接下來會再問一輪，或讓你開始寫第一版。',
  draft_open: '輪到你寫稿了。每一欄寫完按「儲存」，都填好後按「改好再給我看一次」。',
  self_check_pending: '正在整理你的稿，結果出來前稿件鎖定。',
  review_pending: '已交給老師改，稿件鎖定，等老師的話。',
  finalized: '這篇定稿了。稿件已鎖定。',
};
const PQ_HINTS = {
  draft_open: NG.WORDS.pqDraftOpen,   // 沒有對照點時 headCard 換成 NG.WORDS.pqDraftOpenNone（主線 11-17 驗收 P3）
  review_pending: '已交給老師改，稿件鎖定，等老師的話。',
  finalized: '這篇定稿了。稿件已鎖定。',
};
const JOB_ERR = { CONSENT: '這一步由老師來做', QUOTA: '今天的次數用完了', STALE: '等太久沒有回應', TIMEOUT: '等太久沒有完成' };   // TIMEOUT：28w 排隊的總期限到了（設計 4.5）
function headCard() {
  const d = S.doc, home = ((S.home || {}).docs || []).find((x) => x.caseDocId === d.caseDocId), lj = d.lastJob, jobFail = lj && !d.pendingJobId && (lj.status === 'failed' || lj.status === 'rejected');
  const aiOff = d.aiSwitch === false || (lj && lj.error === 'AI_OFF');   // 28l：AI 總開關關著（或上一次因為沒開而停掉）
  const gone = !!(d.promptCheck && d.promptCheck.status === 'gone');   // 28u：今年沒有這一項了 → 不出「寫、交給老師」的提示（下面那條提醒說唯讀）
  // 11-21：X 自己的快照裡有題目（對照欄還沒到也一樣）→ 不講「這系的題目先看官方原文」
  const ownQ = isX(d) && (d.prompts || []).some((p) => promptText(p));
  const handed = d.state === 'assignment_pending' && d.docMode !== 'free' && (d.aiEnabled === false || aiIsOff());   // 2026-11-24 W12-08：整篇答完交給老師
  const hint = gone || pickMode() ? '' : handed ? OFF_HANDED_HINT : d.docMode === 'free' && d.state === 'draft_open' && !NG.focusHasPoints(S.focus) && !ownQ ? NG.WORDS.pqDraftOpenNone : (d.docMode === 'free' ? PQ_HINTS : HINTS)[d.state];
  return `<div class="card active"><a href="#/write" class="small" style="text-decoration:none">← 回到「撰寫NOPQ」</a>
    <h2 style="margin-top:4px">${esc(home ? docTitle(home) : typeName(d) + (d.schoolName ? '｜' + d.schoolName + ' ' + (d.deptName || '') : ''))}</h2>
    ${hint ? `<div class="hint" style="margin-top:0">${esc(hint)}</div>` : ''}
    ${d.docMode === 'free' ? promptBanner(d) : ''}
    ${S.ui.waiting ? `<div class="hint" style="border-color:var(--accent)"><span class="spin"></span>${esc(S.ui.waiting)}</div>` : ''}
    ${jobFail && aiOff && d.docMode !== 'free' ? '<div class="hint">你交出去的回答和稿都已保留，老師看過會回你，不用在畫面上等。</div>'
      : jobFail ? `<div class="issue">上一次沒有成功${lj.error ? '（' + esc(JOB_ERR[lj.error] || '暫時出錯') + '）' : ''}。你的內容都已保留，可以請老師幫忙。</div>` : ''}</div>`;
}
// 28u：寫稿頁最上面的提醒（第 12 節那張表）。題目換了：原本／現在並列，可寫時給「照新題目改」（稿子一字不動）；已定稿只說明、由老師決定要不要重開；
// 今年沒有這一項：唯讀、可複製；開稿時只有去年的題目（X 的快照 basis＝guide115）：固定一條。
const promptText = (p) => (typeof p === 'string' ? p : p && p.text) || '';
function promptCol(title, side) {
  const qs = (side.prompts || []).map(promptText).filter(Boolean), adv = (side.advice || []).map(promptText).filter(Boolean);
  const lims = [...new Set((side.limits || []).map((l) => (l && (l.pages != null || l.chars != null) ? [l.chars != null ? '最多 ' + l.chars + ' 字' : '', l.pages != null ? '限 ' + l.pages + ' 頁' : ''].filter(Boolean).join('、') : (l && (l.quote || l.text)) || '')).filter(Boolean))];
  return `<div class="pcol"><div class="muted small">${esc(title)}</div>${qs.length ? `<ul class="plain">${qs.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<div class="small">（沒有指定題目）</div>'}
    ${adv.length ? `<div class="muted small">說明</div><ul class="plain">${adv.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}${lims.length ? `<div class="muted small">篇幅：${esc(lims.join('；'))}</div>` : ''}</div>`;
}
function promptBanner(d) {
  const pc = d.promptCheck;
  if (pc && pc.status === 'gone') return '<div class="issue" id="prompt-banner">今年的簡章沒有要你寫這一項了。這篇保留著，只能看和複製，不能再改或交出。</div>';
  if (pc && pc.status === 'changed') {
    const o = pc.old || {}, c = pc.current || {}, nameCh = (pc.diff || []).includes('name') && c.itemLabel;
    const lead = pc.finalized ? '這一篇定稿時用的題目，後來學校改了。要不要重開由老師決定，你不用動。'
      : pc.canAccept ? '題目換了。你寫的稿一個字都沒動；看完下面兩邊，按「照新題目改」，再照新題目修改。'
      : '題目換了。老師看完這一輪退回給你之後，就可以照新題目改。';
    return `<div class="issue" id="prompt-banner"><b>${esc(lead)}</b>
      ${nameCh ? `<div class="small">項目名稱：${esc(o.itemLabel || '')} → ${esc(c.itemLabel)}</div>` : ''}
      <div class="pcols">${promptCol('原本的題目', o)}${promptCol('現在的題目', c)}</div>
      ${pc.canAccept ? '<button type="button" class="btn sm" data-act="acceptPrompt">照新題目改</button>' : ''}</div>`;
  }
  if (isX(d) && d.promptBasis === 'guide115') return '<div class="hint" id="prompt-banner">這是去年的題目，今年的還沒公布。公布後如果不一樣，這裡會提醒你。</div>';
  return '';
}
ACT.acceptPrompt = async (el) => {
  el.disabled = true;
  try {
    if (S.ui.saving) await S.ui.saving.catch(() => null);
    if (S.ui.dirty && !(await saveDraft())) return;
    const id = S.docId, r = await call('accept_prompt_change', { p_case_doc_id: id });
    if (!r.ok || id !== S.docId) return;
    const h = ((S.home || {}).docs || []).find((x) => x.caseDocId === id); if (h) h.promptFlag = null;
    S.focus = null;   // 11-21：X 的對照欄照快照畫，手上這份還是舊題目；先拿掉，畫面先用剛換好的題目（標出處），新的對照欄回來再補（連線慢時才不會掛著舊題目）
    await refreshDoc();
    call('my_doc_focus', { p_case_doc_id: id }, { quiet: true, noRefresh: true }).then((f) => { if (f && f.ok && f.focus && S.docId === id) { S.focus = f.focus; renderDoc(); } }).catch(() => null);
    toast('題目換成現在的了。你的稿都還在，照新題目修改就好。');
  } finally { el.disabled = false; }
};
// 11-21 主線 6.7②（「重畫時保留輸入框的焦點和游標位置。學生正在打字時游標掉了，是真的會煩人的事」）：
// 寫稿頁會整頁重畫（對照欄晚到、存檔回來…）。重畫前記下學生正在打的那一格和游標，重畫後放回去。
// 注音、倉頡選字選到一半（composition）時先不重畫——重畫會把還沒選的注音符號當成字留在稿裡——選完字（或離開那一格）再補畫。
let docComposing = false, docRedraw = false;
function docRedrawNow() { docComposing = false; if (docRedraw) { docRedraw = false; setTimeout(renderDoc, 0); } }
document.addEventListener('compositionstart', (ev) => { if (ev.target && ev.target.closest && ev.target.closest('#view')) docComposing = true; });
document.addEventListener('compositionend', docRedrawNow);
document.addEventListener('focusout', (ev) => { if (docComposing && ev.target && ev.target.closest && ev.target.closest('#view')) docRedrawNow(); });
function caretOf(v) {
  const a = document.activeElement;
  if (!a || !v || !v.contains(a) || !(a.tagName === 'TEXTAREA' || a.tagName === 'INPUT')) return null;
  const q = a.id ? '#' + CSS.escape(a.id) : a.dataset.in ? '[data-in="' + CSS.escape(a.dataset.in) + '"]' + (a.dataset.key ? '[data-key="' + CSS.escape(a.dataset.key) + '"]' : '') : '';
  if (!q) return null;
  const c = { q, s: null, e: null, dir: 'none', top: a.scrollTop };
  try { c.s = a.selectionStart; c.e = a.selectionEnd; c.dir = a.selectionDirection || 'none'; } catch (e) { /* 數字框之類沒有游標 */ }
  return c;
}
function caretBack(v, c) {
  if (!c) return; const b = v.querySelector(c.q); if (!b || b.disabled) return;
  try { b.focus({ preventScroll: true }); if (c.s != null) b.setSelectionRange(c.s, c.e, c.dir); b.scrollTop = c.top; } catch (e) { /* 放不回去就算了，不擋畫面 */ }
}
function drawDoc(html) { const v = $('view'), c = caretOf(v); view(html); caretBack(v, c); }
function renderDoc() {
  if (!S.doc || S.doc.caseDocId !== S.docId) return;
  if (docComposing && $('view').contains(document.activeElement)) { docRedraw = true; return; }   // 選字中：選完再畫
  const y = window.scrollY, d = S.doc; let main;
  if (d.docMode === 'free') { drawDoc(withFocus(headCard(), finalCard() + reviewCard() + pqCard() + versionsCard())); window.scrollTo(0, y); return; }   // P、Q：整段稿，不經問答
  if (d.state === 'warmup') main = warmupCard();
  else if (d.state === 'interviewing') main = teacherCard();
  else if (['assignment_pending', 'submission_pending', 'feedback_pending', 'feedback_published'].includes(d.state)) main = assignmentCard();
  else main = reviewCard() + draftCard();
  drawDoc(withFocus(headCard(), finalCard() + main + (d.state === 'interviewing' || d.state === 'warmup' ? '' : assignmentRest()) + abilityCard() + pointsCard() + chatCard() + historyCard() + versionsCard()));
  window.scrollTo(0, y);
}
// ── 2026-11-13 改版建議第 32 條（USER 原話「要點進去後，要對照該科系的要點說明，特別去提醒學生要寫」「後面要自動批改的時候，這幾點要當作特別的說明」）──
// 寫稿畫面把該系的要點放在稿子旁邊：寬螢幕右邊一欄（捲動時黏在畫面上），手機放在標題下面、稿子上面。資料＝28o my_doc_focus（nopq_review_focus），
// 跟之後送 AI 批改的是同一份（DraftReview.focusPoints、AiJob.inputSnapshot.focusPoints；AI 現在沒開，只留位置）。
function withFocus(head, rest) {
  const fx = pickMode() ? '' : focusCard(), side = fx + citePanel();   // 2026-11-24 A13 W13：對照欄下面接「我的學習歷程」面板；挑件頁自己列志願系的要求，不再放對照欄
  document.body.classList.toggle('docwide', !!side);
  return side ? `${head}<div class="dwrap"><div class="dmainc">${rest}</div><aside class="dfocus" aria-label="這系要你寫到的要點">${side}</aside></div>` : head + rest;
}
// 2026-11-24 A13 W15：N、O 旁欄與挑件頁上半塊同一份（後端 my_doc_dept_diff）、同一套字；官方原文連結從對照欄資料（S.focus）照系碼找
const diffHtml = (none) => NG.focusDiffHtml(S.diff, { t: { all: W13.reqAll, some: W13.reqSome, checking: W15.dChecking, none }, link: (code) => { const dp = ((S.focus || {}).depts || []).find((x) => String(x.deptCode) === String(code)); return dp ? dp.guideUrl || '' : ''; } });
function focusCard() {
  if (S.doc && isNO(S.doc) && S.diff !== false) {   // N、O：兩區（都要的／某系多要的）；各系差異還沒讀到先不畫，讀到了再整欄一次出現
    const df = S.diff; if (!df || !Array.isArray(df.depts) || !df.depts.length) return '';
    const L = df.letter || (S.doc.nopqType === 'O_reflection' ? 'O' : 'N'), z = NG.diffZones(df), has = z.all.length || z.some.length;
    return `<div class="card focus" id="diff-card"><h3>對照：你的志願系對 ${L} 的要求</h3><p class="muted small" style="margin:0 0 6px">${L} 一篇給所有志願系，寫的時候把下面各系要的都照顧到。</p>
      ${diffHtml(W15.dNone)}<p class="fnote">${esc(has ? NG.WORDS.focusNoteMulti : NG.WORDS.focusNoteNone)}</p></div>`;
  }
  const f = S.focus; if (!f || !Array.isArray(f.depts) || !f.depts.length) return '';
  const L = f.letter, single = isFree(S.doc);   // 11-20：X（自傳、小論文…）也是單系那一種
  // 2026-11-17 主線驗收裁定：一系的內容由 guide_pure.js 的 NG.focusDeptHtml 畫（題目只來自項目層；沒過檢查的系不講「沒有題目」、不點名，一律同一句＋官方連結；115 的強調、看重、篇幅不畫）
  const dept = (dp, full) => NG.focusDeptHtml(dp, L, full);
  if (single) {
    const dp = f.depts[0];
    return `<div class="card focus"><h3>對照：${esc((dp.schoolName || '') + ' ' + (dp.name || ''))} 要你寫到</h3>${dept(dp, true)}
      <p class="fnote">${esc(NG.focusHasPoints(f) ? NG.WORDS.focusNote : NG.WORDS.focusNoteNone)}</p></div>`;
  }
  // 11-21 主線裁示：最上面那句「這幾系去年學校指引的題目我們正在重新核對」只在有系「沒過檢查、又沒列出 116 題目」時講（列得出 116 題目的系不講 115 核對狀態）
  const rows = f.depts.map((dp) => dept(dp, false)).filter(Boolean), unc = f.depts.some((dp) => (NG.focusUncShown ? NG.focusUncShown(dp) : dp.checked !== true));
  return `<div class="card focus"><h3>對照：你的志願系對 ${L} 的要求</h3><p class="muted small" style="margin:0 0 6px">${L} 一篇給所有志願系，寫的時候把下面各系要的都照顧到。</p>
    ${unc ? `<p class="small" style="margin:0 0 6px">${esc(NG.WORDS.uncheckedMulti)}</p>` : ''}${rows.join('')}
    <p class="fnote">${esc(NG.focusHasPoints(f) ? NG.WORDS.focusNoteMulti : NG.WORDS.focusNoteNone)}</p></div>`;
}
const assignmentRest = () => (['assignment_pending', 'submission_pending', 'feedback_pending', 'feedback_published'].includes(S.doc.state) ? '' : assignmentCard());
// 2026-11-24 A13 W12-03／11：被「還沒盤點」擋住（VALIDATION／inventory）時，開始卡換成指路與一顆直接去盤點的鈕（原本只跳一行錯誤字）
const scanBlocked = () => NEED_SCAN.has(S.docId) && (!hasScan() || NEED_SCAN.get(S.docId) === 'stuck');
const pickMode = () => !!S.doc && S.doc.state === 'warmup' && isNO(S.doc) && !scanBlocked();   // 2026-11-24 A13 W13：還沒開始的 N、O 先挑件（被「還沒盤點」擋住時仍是 W12 那張指路卡）
const warmupCard = () => (scanBlocked()   // 盤點過了（回來再按）就換回原本的〔開始〕；盤點過還是被擋，才一直留著這張指路卡
  ? `<div class="card active"><h2>先到「我的學習歷程」</h2><p style="margin:0 0 10px">${esc(INV_GATE_TEXT)}手上還沒有檔案，也可以直接按「盤點好了」。</p>
      <div class="row"><a class="btn" href="#/mine">去我的學習歷程盤點</a><button class="btn ghost" data-act="startDoc">我盤點好了，再試一次</button></div></div>`
  : isNO(S.doc) ? pickCard() : '<div class="card"><button class="btn" data-act="startDoc">開始</button></div>');
ACT.startDoc = async (el) => {
  el.disabled = true; const r = await call('open_doc', { p_case_doc_id: S.docId });
  if (r.ok) { NEED_SCAN.delete(S.docId); S.doc = r; syncUi(); renderDoc(); }
  else { el.disabled = false; if (isInvGate(r)) { NEED_SCAN.set(S.docId, hasScan() ? 'stuck' : 'new'); renderDoc(); } }
};
// ── 欄位規格展開（同資料庫 nopq_grid_fields／nopq_seg_count 的規則）──
function expandCells(spec, segs) {
  const out = [], four = (segs || 0) >= 4;
  ((spec && spec.sections) || []).forEach((s) => {
    const ch = s.children || [], qs = s.questions || [];
    if (ch.length) ch.forEach((c) => out.push({ section: s.key, secLabel: s.label, key: s.key + '.' + c.key, child: c.key, label: c.label, limit: four && c.limit4 ? c.limit4 : c.limit,
      req: s.required !== false && !!c.required, kind: c.kind || 'text', prompt: (qs.find((q) => q.key === c.key) || {}).prompt, q: qs.find((q) => q.key === c.key) || null }));   // 2026-11-24 A13 W23：q＝這一格的整題規格（句型、怎麼給、檢核句）
    else out.push({ section: s.key, secLabel: s.label, key: s.key, child: 'text', label: s.label, limit: s.limit, req: !!s.required, kind: s.kind || 'text', prompt: qs[0] && qs[0].prompt, q: qs[0] || null });
  });
  return out;
}
function segCount(spec, text) {
  const seg = spec && spec.segments; if (!seg) return 1; let mx = 0;
  Object.keys(text || {}).forEach((k) => { const m = k.startsWith(seg.prefix) && k.match(/\[(\d+)\]/), v = text[k]; if (m && v != null && JSON.stringify(v) !== '""' && JSON.stringify(v) !== '[]' && String(v).trim() !== '') mx = Math.max(mx, +m[1]); });
  return Math.max(seg.min || 1, mx);
}
const gridSpec = () => (S.doc.grid && S.doc.grid.spec) || null;
function cellLabel(sectionKey, fieldKey) {
  if (sectionKey === '_free') return '整段稿';   // 上傳稿與 P、Q 的整段稿（W4／W5）
  const cells = expandCells(gridSpec(), 4);
  if (!fieldKey) { const c0 = cells.find((x) => x.section === sectionKey); if (c0 && c0.child !== 'text') return c0.secLabel; }   // 整段題沒有 fieldKey：顯示整段的名稱
  const c = cells.find((x) => x.section === sectionKey && (x.child === fieldKey || !fieldKey));
  return c ? c.label : sectionKey || '';
}
// ── 老師帶你寫（第 6 幕）：只有老師的話（架構一句＋題目）、一個大框、一個鈕 ──
const ARCH_LINE = {
  N_diverseSummary: 'N 先講三件你做過的事，一件一段；講完再用幾句話說你是誰、你想去哪。',   // 2026-11-24 W12-04：跟 W07 新順序一致（原：你是誰、三件、想去哪）
  O_reflection: 'O 分三段：高一到現在學習上的轉變、兩三件課程成果或活動、你想對審查老師說的最後一句話。',
};
const WHO = { system: '育才仕題目', ai: '追問', teacher: '老師問' };
const fixedFlow = () => !!(S.doc && S.doc.grid && S.doc.grid.spec && S.doc.grid.spec.noAiFlow === 'fixed');   // 28z：新版格子，AI 關時照固定題一題接一題
function teacherCard() {
  const d = S.doc, turns = (d.cycle && d.cycle.turns) || [], open = turns.find((t) => !t.answered), u = S.ui;
  const first = !turns.some((t) => t.answered), arch = first ? ARCH_LINE[d.nopqType] : '';
  let tail = '';
  if (open) {
    tail = `<textarea class="big" data-in="answer" placeholder="想到什麼寫什麼，不用整理。" maxlength="2000" ${u.waiting ? 'disabled' : ''}>${esc(u.answer || '')}</textarea>
      <div class="row spread" style="margin-top:6px"><span class="muted small" id="ans-cnt">${nlen(u.answer)} 字</span><button class="btn" data-act="sendAnswer" ${u.waiting ? 'disabled' : ''}>${d.aiEnabled ? '交出去' : fixedFlow() ? '下一題' : '交給老師'}</button></div>`;   // 2026-11-24 W12-06：固定題一題接一題時，按鈕是「下一題」，不是交給老師
  } else if (!u.waiting) {
    tail = !d.aiEnabled || u.teacherAsks
      ? `<div class="hint">你的回答老師收到了，老師看完會再問你。也可以按「今天先到這」。</div>`
      : '<div class="hint">目前沒有接著的題目。你可以按「今天先到這」，等下一個題目。</div>';
  }
  if (!u.waiting) tail += u.confirmStop
    ? '<div class="hint">確定今天先到這？會根據你已經說的，準備下一個題目。<div class="row" style="margin-top:6px"><button class="btn sm" data-act="stopInterview">確定先到這</button><button class="btn sm ghost" data-act="stopCancel">繼續回答</button></div></div>'
    : '<div style="margin-top:10px"><button class="btn ghost sm" data-act="stopAsk">今天先到這</button></div>';
  // 2026-11-24 A13 W23：句型放在題目下面、輸入框上面（系統出的格子題才有）；檢核句放在輸入框與鈕的下面（剛答完那一格的，不擋在輸入框前面）
  const qNow = open && open.role === 'system' && open.kind === 'question' ? qOf(open.sectionKey, open.fieldKey) : null;
  const done = turns.filter((t) => t.answered).slice(-1)[0], qDone = done && done.role === 'system' && done.kind === 'question' ? qOf(done.sectionKey, done.fieldKey) : null;
  const pat = qNow ? patHtml(qNow, 'q:' + open.id) : '', ck = qDone ? chkLineBox(qDone, w23('selfChkOf', { label: cellLabel(done.sectionKey, done.fieldKey) })) : '';
  return `<div class="card active"><div class="teach"><b>${esc(open ? WHO[open.role] || '題目' : '題目')}</b>${arch ? `<p>${esc(arch)}</p>` : ''}${open ? `<p><b>${esc(open.question)}</b></p>` : ''}</div>${pat}${tail}${ck}</div>`;
}
IN.answer = (el) => { S.ui.answer = el.value; const c = $('ans-cnt'); if (c) c.textContent = nlen(el.value) + ' 字'; };
ACT.stopAsk = () => { S.ui.confirmStop = true; renderDoc(); };
ACT.stopCancel = () => { S.ui.confirmStop = false; renderDoc(); };
ACT.sendAnswer = async (el) => {
  const t = ((S.doc.cycle || {}).turns || []).find((x) => !x.answered), text = (S.ui.answer || '').trim();
  if (!t) return; if (!text) return toast('先寫一點再交。', true);
  el.disabled = true;
  const r = await call('interview_answer', { p_case_doc_id: S.docId, p_turn_id: t.id, p_answer: text, p_client_request_id: 'ans-' + t.id });
  if (!r.ok) { el.disabled = false; return; }
  S.ui.teacherAsks = !!r.teacherAsks; await refreshDoc();
  if (r.jobId) await runAi(r.jobId, '正在整理你寫的，通常幾秒鐘…');
  else if (r.handedToTeacher) toast('整篇答完了，交給老師看了。老師看完會再問你。');   // 2026-11-24 W12-07：28z 回 handedToTeacher＝必填的都答完，這一篇已進待出作業
  else if (r.nextTurnId) { /* 下一題已經在畫面上（refreshDoc 取回），不另外說話 */ }
  else if (r.teacherAsks) toast(r.quotaExceeded ? '今天的系統次數用完了，這題由老師來出。' : r.aiOff ? (fixedFlow() ? '你的回答已存好，老師看完會再問你。' : '這一步由老師來做，你的回答已存好。') : '這題由老師出，你的回答已存好。');
};
ACT.stopInterview = async () => {
  S.ui.confirmStop = false; const r = await call('interview_stop', { p_case_doc_id: S.docId, p_state_version: S.doc.stateVersion }); if (!r.ok) return;
  await refreshDoc(); toast('好，今天先到這。會根據你說的準備下一個題目。'); if (r.jobId) runAi(r.jobId, '正在準備下一個題目（你不用等）…', true);
};
function chatCard() {
  const turns = ((S.doc.cycle || {}).turns || []).filter((t) => t.answered); if (!turns.length) return '';
  return `<details class="card"><summary>之前聊的（${turns.length}）</summary><div class="chat">${turns.map((t) => `<div class="bub q"><span class="who">${esc(WHO[t.role] || '題目')}｜${esc(cellLabel(t.sectionKey, t.fieldKey))}</span>${esc(t.question)}</div><div class="bub a"><span class="who">我說的</span>${esc(t.answer || '（略過）')}</div>`).join('')}</div></details>`;
}
// ── 老師整理出的重點（唯讀）；能力詞庫來自 list_terms，稿裡的標籤欄要用 ──
const ORIGIN_NAME = { cluster: '學群通用', guide: '校系指引', teacher: '老師補充' };
const termName = (id) => { const t = (S.terms || []).find((x) => x.id === id); return t ? t.term : '（未知用語）'; };
const termOptions = () => S.terms || [];
const termIdsUsed = () => (((S.doc && S.doc.cycle) || {}).pointCard ? S.doc.cycle.pointCard.points || [] : []).reduce((a, p) => a.concat(p.termIds || [], p.termCandidates || []), []);
const termsStale = () => termIdsUsed().some((id) => !termOptions().some((t) => t.id === id) && !(S.termsMiss || {})[id]);
async function loadTerms() {
  const id = S.docId, r = await call('list_terms', { p_case_doc_id: id }, { quiet: true, noRefresh: true }); if (!r.ok || id !== S.docId) return;
  S.terms = r.terms || []; S.termsMiss = {}; termIdsUsed().forEach((x) => { if (!S.terms.some((t) => t.id === x)) S.termsMiss[x] = 1; });
}
function pointsCard() {
  const pc = S.doc.cycle && S.doc.cycle.pointCard; if (!pc) return '';
  const pts = (pc.points || []).filter((p) => p.status !== 'rejected'); if (!pts.length) return '';
  const groups = {}; pts.forEach((p) => { const g = cellLabel(p.sectionKey, p.fieldKey); (groups[g] = groups[g] || []).push(p); });
  return `<details class="card"><summary>整理出的重點（${pts.length}）</summary>${Object.keys(groups).map((g) => `<h3>${esc(g)}</h3>` + groups[g].map((p) => `<div class="pt"><div class="txt">${esc(p.text)}</div></div>`).join('')).join('')}</details>`;
}
// ── 老師給的題目與老師的話 ──
const ASG_TYPE = { worksheet: '學習單', reply: '回答幾個問題', write_section: '試寫一小段' };
const VERDICT = { needs_work: '還需要補強', almost: '接近了', ready: '可以了' };
const itemText = (x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? [x.note || x.text || x.issue || x.question || '', x.quote ? `（「${x.quote}」）` : ''].join('') : String(x));
function feedbackHtml(fb) {
  const b = fb.body || {}, ai = fb.reviewedLabel === 'ai_unreviewed', li = (arr) => `<ul class="plain">${arr.map((x) => `<li>${esc(itemText(x))}</li>`).join('')}</ul>`;
  const issues = (b.issues || []).map((i) => (i.sectionKey ? `【${cellLabel(i.sectionKey, i.fieldKey)}】` : '') + itemText(i));
  return `<h3>${ai ? '育才仕寫作建議　<span class="badge ai">依育才仕老師的批改標準由系統整理，老師還沒逐字看過</span>' : '老師的話'}</h3>
    ${b.text ? `<div style="white-space:pre-wrap">${esc(b.text)}</div>` : ''}${Array.isArray(b.items) && b.items.length ? li(b.items) : ''}
    ${issues.length ? `<div class="muted small">可以再補強的地方</div>${li(issues)}` : ''}${Array.isArray(b.strengths) && b.strengths.length ? `<div class="muted small">做得不錯的地方</div>${li(b.strengths)}` : ''}
    ${b.verdict ? `<div class="pill">${esc(VERDICT[b.verdict] || b.verdict)}</div>` : ''}`;
}
function assignmentCard() {
  const d = S.doc, a = d.assignment; if (!a) return '';
  const sub = a.submission, canSubmit = d.state === 'submission_pending', pq = Array.isArray(a.personalQuestions) ? a.personalQuestions : [];
  return `<details class="card ${canSubmit ? 'active' : ''}" ${canSubmit || d.state === 'feedback_pending' || d.state === 'feedback_published' ? 'open' : ''}><summary>這一輪的題目（${esc(ASG_TYPE[a.type] || a.type)}）</summary>
    <p style="white-space:pre-wrap;margin:8px 0 4px"><b>題目：</b>${esc(a.prompt)}</p>
    ${pq.length ? `<div class="muted small">針對你的問題</div><ul class="plain">${pq.map((q) => `<li>${esc(itemText(q))}</li>`).join('')}</ul>` : ''}
    ${a.dueAt ? `<div class="muted small">截止：${esc(when(a.dueAt))}</div>` : ''}
    ${sub ? `<h3>我交的（第 ${sub.revision} 版，${esc(when(sub.submittedAt))}）</h3><div class="cell"><div class="ro">${esc(sub.text || '（沒有文字）')}</div></div>` : ''}
    ${canSubmit ? `<label class="f" for="asg-text">把答案貼在這裡（Word、PDF、文字檔可以用框下面的「用檔案帶入」）</label>
      <textarea id="asg-text" data-in="assignText" maxlength="5000" style="min-height:140px" ${d.pendingJobId ? 'disabled' : ''}>${esc(S.ui.assignText || '')}</textarea>
      <div class="row spread" style="margin-top:6px"><span class="muted small" id="asg-cnt">${nlen(S.ui.assignText)} 字</span><button class="btn" data-act="submitAssign" ${S.ui.waiting ? 'disabled' : ''}>${d.aiEnabled ? '交出去' : '交給老師'}</button></div>` : ''}
    ${a.feedback ? feedbackHtml(a.feedback) : (sub ? '<div class="hint">已交出，等回覆。</div>' : '')}</details>`;
}
IN.assignText = (el) => { S.ui.assignText = el.value; const c = $('asg-cnt'); if (c) c.textContent = nlen(el.value) + ' 字'; };
ACT.submitAssign = async (el) => {
  const a = S.doc.assignment, text = (S.ui.assignText || '').trim(); if (!a) return; if (!text) return toast('先寫一點再交。', true);
  el.disabled = true;
  const r = await call('submit_assignment', { p_assignment_id: a.id, p_text: text, p_asset_ids: [], p_client_request_id: `sub-${a.id}-${(a.submission ? a.submission.revision : 0) + 1}` });
  if (!r.ok) { el.disabled = false; return; }
  await refreshDoc(); toast(r.jobId ? '交出去了。' : '交給老師了。');
  if (r.jobId) await runAi(r.jobId, '正在整理你的答案，通常幾秒鐘…');
};
// 之前各輪的題目、我交的、老師的話；目前這一輪在上面的「老師給你的題目」
document.addEventListener('toggle', (ev) => { if (ev.target.id === 'hist-card' && S.ui) S.ui.histOpen = ev.target.open; }, true);   // 重畫時保留摺疊
function historyCard() {
  const past = ((S.doc && S.doc.history) || []).filter((h) => !h.current && h.assignment); if (!past.length) return '';
  const rows = past.map((h) => {
    const a = h.assignment, s = h.submission, f = h.feedback;
    return `<div class="pt"><div class="row spread"><b>第 ${h.roundNumber} 輪</b><span class="pill">${esc(ASG_TYPE[a.type] || a.type)}</span></div>
      <p style="white-space:pre-wrap;margin:6px 0 2px"><b>題目：</b>${esc(a.prompt)}</p>${a.dueAt ? `<div class="muted small">截止：${esc(when(a.dueAt))}</div>` : ''}
      ${s ? `<h3>我交的（第 ${s.revision} 版，${esc(when(s.submittedAt))}）</h3><div class="cell"><div class="ro">${esc(s.text || '（沒有文字）')}</div></div>` : '<div class="muted small" style="margin-top:6px">這一輪沒有交。</div>'}
      ${f ? feedbackHtml(f) : s ? '<div class="muted small" style="margin-top:6px">這一輪沒有收到回覆。</div>' : ''}</div>`;
  }).join('');
  return `<details id="hist-card" class="card" ${S.ui.histOpen ? 'open' : ''}><summary>之前的題目和回覆（${past.length} 輪）</summary>${rows}</details>`;
}
// ── 稿（第 7 幕）：欄位稿；上傳的稿是整段稿，原樣顯示、原樣改 ──
const cellKeyOf = (e) => (!e.fieldKey || e.fieldKey === 'text' ? e.sectionKey : e.sectionKey + '.' + e.fieldKey);
const tableText = (v) => (Array.isArray(v) ? v.map((r) => [r.term || r[0] || '', r.subject || r[1] || '', r.score || r[2] || ''].join(',')).join('\n') : v || '');
function editFor(key, val) {   // 老師改過、而且目前這欄還是老師改的字 → 回傳那筆改字（畫黃底）
  const edits = (S.doc.review && S.doc.review.edits) || []; let hit = null;
  edits.forEach((e) => { if (cellKeyOf(e) === key && e.afterText === val) hit = e; }); return hit;
}
function visibleCells() {
  const spec = gridSpec(), u = S.ui, seg = spec.segments, segs = segCount(spec, u.draft), show = Math.max(segs, u.extraSeg && seg ? seg.max : 0);
  const all = expandCells(spec, segs).filter((c) => { const m = seg && c.section.startsWith(seg.prefix) && c.section.match(/\[(\d+)\]$/); return !m || +m[1] <= show; });
  return { cells: all, segs, show, canAdd: !!seg && show < seg.max };
}
function cellHtml(c, editable) {
  const u = S.ui, v = u.draft[c.key], hit = c.kind === 'text' ? editFor(c.key, v) : null;
  const star = c.req ? '<span style="color:var(--bad)"> *</span>' : '';
  let body = '', cnt = '';
  if (c.kind === 'terms') {
    const sel = Array.isArray(v) ? v : [];
    body = editable ? termOptions().map((o) => `<button type="button" class="pill ${sel.includes(o.id) ? 'on' : ''}" data-act="draftTerm" data-key="${esc(c.key)}" data-term="${esc(o.id)}" title="${esc(ORIGIN_NAME[o.origin] || '')}">${esc(o.term)}</button>`).join('')
      : sel.map((t) => `<span class="pill on">${esc(termName(t))}</span>`).join('') || '<span class="muted">（沒選）</span>';
    cnt = `<span class="cnt">已選 ${sel.length}（建議 1～2 個）</span>`;
  } else if (c.kind === 'table') {
    const t = tableText(v); cnt = '<span class="cnt">選填；每行：學期,科目,成績</span>';
    body = editable ? `<textarea data-in="cell" data-key="${esc(c.key)}" placeholder="例：高一上,數學,85">${esc(t)}</textarea>` : `<div class="ro">${esc(t) || '（沒填）'}</div>`;
  } else {
    const n = nlen(v), over = c.limit && n > c.limit; cnt = `<span class="cnt ${over ? 'over' : ''}">已 ${n} 字${c.limit ? '／≤' + c.limit + ' 字' : ''}</span>`;
    body = editable ? `<textarea data-in="cell" data-key="${esc(c.key)}" data-limit="${c.limit || ''}" rows="2">${esc(v || '')}</textarea>` : `<div class="ro">${esc(v || '') || '（沒填）'}</div>`;
  }
  return `<div class="cell ${hit ? 'edited' : ''}" ${hit ? `title="老師改過。原文：${esc(hit.beforeText)}"` : ''}><div class="lab"><span>${esc(c.label)}${star}</span>${cnt}</div>
    ${editable && c.prompt && c.kind === 'text' && !v ? `<div class="muted small">${esc(c.prompt)}</div>` : ''}${editable ? patHtml(c.q, 'c:' + c.key) : ''}${body}
    ${editable && c.q && c.q.checkLine ? `<div class="cellchk" data-ck="${esc(c.key)}">${cellChkOn(c.key) ? chkLineBox(c.q, W23.selfChk) : ''}</div>` : ''}
    ${hit ? `<div class="small" style="margin-top:4px">老師改過｜原文：「${esc(hit.beforeText || '（空白）')}」</div>` : ''}</div>`;
}
IN.cell = (el) => {
  const key = el.dataset.key; S.ui.draft[key] = el.value; markDirty();
  const cell = el.closest('.cell'), cnt = cell.querySelector('.cnt'), lim = +el.dataset.limit || 0;
  if (cnt && lim) { const n = nlen(el.value); cnt.textContent = `已 ${n} 字／≤${lim} 字`; cnt.classList.toggle('over', n > lim); }
  const tot = $('tot-cnt'); if (tot) tot.textContent = totalText();
  chkSoon();
};
ACT.draftTerm = (el) => {
  const u = S.ui, key = el.dataset.key, cur = Array.isArray(u.draft[key]) ? u.draft[key].slice() : [], i = cur.indexOf(el.dataset.term);
  if (i >= 0) cur.splice(i, 1); else cur.push(el.dataset.term);
  u.draft[key] = cur; markDirty(); el.classList.toggle('on', i < 0);
  const cnt = el.closest('.cell').querySelector('.cnt'); if (cnt) cnt.textContent = `已選 ${cur.length}（建議 1～2 個）`;
};
ACT.addSeg = () => { S.ui.extraSeg = true; renderDoc(); };
function totalText() {
  const spec = gridSpec(), u = S.ui;
  if (pqGridOn(S.doc)) return `全篇 ${nlen(pqPlain())} 字／最多 ${S.doc.maxChars || 5000} 字`;   // 2026-11-24 A13 W14：P、Q 分格寫＝各格加起來
  if (u.mode === 'free') return `全篇 ${nlen(u.freeText)} 字${S.doc && S.doc.docMode === 'free' ? '／最多 ' + (S.doc.maxChars || 5000) + ' 字' : spec && spec.totalLimit ? '／≤' + spec.totalLimit + ' 字' : ''}`;
  const cells = expandCells(spec, segCount(spec, u.draft)).filter((c) => c.kind === 'text');
  const n = cells.reduce((s, c) => s + nlen(u.draft[c.key]), 0); return `全篇 ${n} 字${spec.totalLimit ? '／≤' + spec.totalLimit + ' 字' : ''}`;
}
// ── 2026-11-24 A13 W14：P、Q 分格寫（後端 29c：get_doc_state 的 pqGrid、save_pq_cells、pq_split_cell、set_pq_mode）──
//   各格的字存在 S.ui.pqCells（key→字）、打過還沒存的格記在 S.ui.pqDirty；重讀（refreshDoc）時只把沒在打的格換成伺服器的字，打到一半的不蓋。
//   複製全文拼法同後端 nopq_pq_compose：沒空白的格照順序、中間空一行、不放格名（格名只在畫面上）。
const pqG = (d) => (d && isPQ(d) && d.pqGrid && Array.isArray(d.pqGrid.cells) && d.pqGrid.cells.length ? d.pqGrid : null);
const pqGridOn = (d) => { const g = pqG(d); return !!g && g.mode === 'grid'; };
function pqPlain() {
  const g = pqG(S.doc), u = S.ui; if (!g) return '';
  return g.cells.map((c) => String(u.pqCells && u.pqCells[c.key] != null ? u.pqCells[c.key] : c.text || '').trim()).filter(Boolean).join('\n\n');
}
function pqSync() {
  const g = pqG(S.doc), u = S.ui; if (!g || !u) return; u.pqCells = u.pqCells || {}; u.pqDirty = u.pqDirty || {};
  g.cells.forEach((c) => { if (!u.pqDirty[c.key]) u.pqCells[c.key] = c.text || ''; });
}
IN.pqc = (el) => {
  const u = S.ui, k = el.dataset.key; (u.pqCells = u.pqCells || {})[k] = el.value; (u.pqDirty = u.pqDirty || {})[k] = 1; markDirty();
  const t = $('tot-cnt'); if (t) t.textContent = totalText();
  chkSoon();
};
IN.free = (el) => { S.ui.freeText = el.value; markDirty(); const t = $('tot-cnt'); if (t) t.textContent = totalText(); };
function markDirty() { S.ui.dirty = true; const b = $('dirty'); if (b) b.classList.remove('hidden'); }
function draftCard() {
  const d = S.doc, u = S.ui; if (!d.grid) return '';
  const hasV = !!(d.draft && d.draft.currentVersion), editable = d.state === 'draft_open', sc = d.draft && d.draft.selfCheck;
  if (!hasV && !['draft_open', 'self_check_pending', 'review_pending', 'finalized'].includes(d.state)) return '';
  const free = u.mode === 'free', vc = visibleCells(); let last = '';
  const cellsHtml = free ? '' : vc.cells.map((c) => {
    const nw = c.section !== last, head = c.child !== 'text' && nw ? `<div class="seg">${esc(c.secLabel)}</div>` + photoRow(c.section, editable) : ''; last = c.section; return head + cellHtml(c, editable);   // 2026-11-24 W15：N 每段的段名下面多一個〔這段放圖〕
  }).join('');
  const freeHtml = !free ? '' : editable
    ? `<label class="f" for="free-text">你的稿</label><textarea id="free-text" class="big" data-in="free" maxlength="5000">${esc(u.freeText || '')}</textarea>`
    : `<div class="cell"><div class="ro">${esc(u.freeText || '') || '（沒有內容）'}</div></div>`;
  return `<details class="card ${editable ? 'active' : ''}" open><summary>你的稿${d.state === 'finalized' ? '　<span class="pill ok">定稿了</span>' : ''}</summary>
    ${freeHtml}${cellsHtml}${editable && !free && vc.canAdd ? '<button class="btn ghost sm" data-act="addSeg">＋ 再加一段</button>' : ''}
    <div class="row spread" style="margin-top:10px"><span class="muted small" id="tot-cnt">${esc(totalText())}</span><span class="pill warn ${u.dirty && editable ? '' : 'hidden'}" id="dirty">還沒儲存</span></div>
    ${editable ? chkHtml() : ''}
    ${editable ? `<div class="row" style="margin-top:10px"><button class="btn ghost" data-act="saveDraft">儲存</button><button class="btn ghost" data-act="chkRun">${esc(W15.btnCheck)}</button><button class="btn" data-act="selfCheck" ${u.waiting ? 'disabled' : ''}>改好再給我看一次</button></div>` : ''}
    ${sc && sc.status !== 'queued' && sc.status !== 'running' ? selfCheckHtml(sc, d) : ''}</details>`;
}
// ── P、Q 整段稿（W4）：題目取該系指引；沒有題目就請他先看官方分則，不自編通用題 ──
// 2026-11-20 審查資料第二步（28t）：X（R 以後各系要寫的，自傳、小論文…）也用這一張；代碼與名稱用 itemCode／itemLabel，題目與篇幅來自開稿當下的快照，
//   不能從別系複製（後端 canCopy＝false，各系題目不同）。「限一頁」系統量不出頁數，只照原文顯示篇幅，不擋送出。
function pqCard() {
  const d = S.doc, u = S.ui, x = isX(d), letter = x ? (d.itemCode || '') : d.nopqType === 'P_motivation' ? 'P' : 'Q', max = d.maxChars || 5000;
  const gone = !!(d.promptCheck && d.promptCheck.status === 'gone'), editable = d.state === 'draft_open' && !gone;   // 28u：今年沒有這一項了 → 唯讀、可複製
  // X 的限制（116 項目層快照）多半把整句題目當原文；有頁數、字數欄位就直接寫「限 1 頁」「最多 800 字」，沒有才照原文
  const lims = [...new Set((d.limits || []).map((l) => (x && l && (l.pages != null || l.chars != null) ? [l.chars != null ? '最多 ' + l.chars + ' 字' : '', l.pages != null ? '限 ' + l.pages + ' 頁' : ''].filter(Boolean).join('、')
    : window.NG && NG.limitText ? NG.limitText(l) : '')).filter(Boolean))];
  const g = pqG(d), gm = pqGridOn(d);   // 2026-11-24 A13 W14：P、Q 有後端 pqGrid 就分格畫（拿掉「從別系複製」）；X 照舊
  const what = x ? (d.itemLabel || '這一篇') : letter === 'P' ? '就讀動機' : '未來學習計畫';
  const where = ((d.schoolName || '') + ' ' + (d.deptName || '')).trim() || '這系';
  return `<div class="card ${editable ? 'active' : ''}">
    ${d.inWishlist === false ? '<div class="hint" style="margin-top:0">這系已經不在你的志願裡，寫過的稿都還留著；選回來就會回到上面的清單。</div>' : ''}
    ${S.focus ? `<h3 style="margin-top:0">${esc(where)}</h3><div class="muted small">題目和這系的要點在「對照」那一欄（寬螢幕在右邊，手機在上面），邊寫邊對照。</div>` : `<h3 style="margin-top:0">${esc(where)} 要你回答</h3>
    ${NG.pqGuideHtml(d, letter)}
    ${lims.length ? `<div class="muted small" style="margin-top:4px">篇幅：${esc(lims.join('；'))}</div>` : ''}`}
    ${x && S.focus && lims.length ? `<div class="muted small" style="margin-top:4px">篇幅：${esc(lims.join('；'))}（系統量不出頁數，交出去前自己排版確認）</div>` : ''}
    ${g && editable ? `<div class="row" style="margin:8px 0 0"><button type="button" class="btn sm ghost" data-act="pqMode" data-to="${gm ? 'free' : 'grid'}">${esc(gm ? W14.toFree : W14.toGrid)}</button></div>` : ''}
    ${g && editable && !gm ? `<div class="muted small" style="margin-top:4px">${esc(W14.freeNote)}</div>` : ''}
    ${gm ? pqCellsHtml(d, editable) : editable ? `<label class="f" for="free-text">你的${esc(what)}</label><textarea id="free-text" class="big" data-in="free" maxlength="${max}">${esc(u.freeText || '')}</textarea>`
      : `<div class="cell"><div class="ro">${esc(u.freeText || '') || '（沒有內容）'}</div></div>${gone && d.state !== 'finalized' ? `<div class="row" style="margin-top:8px"><button type="button" class="btn" data-act="copyFull" ${(u.freeText || '').trim() ? '' : 'disabled'}>複製全文</button></div>` : ''}`}
    <div class="row spread" style="margin-top:8px"><span class="muted small" id="tot-cnt">${esc(totalText())}</span><span class="pill warn ${u.dirty && editable ? '' : 'hidden'}" id="dirty">還沒儲存</span></div>
    ${editable && gm ? chkHtml() : ''}
    ${editable ? `<div class="row" style="margin-top:10px"><button class="btn ghost" data-act="saveDraft">儲存</button>${gm ? `<button class="btn ghost" data-act="chkRun">${esc(W15.btnCheck)}</button>` : ''}<button class="btn" data-act="pqSubmit">交給老師</button></div>` : ''}</div>`;   // 2026-11-24 W15：P、Q 分格寫也有〔檢查〕（照後端回什麼畫什麼）
}
// 2026-11-24 A13 W14：P、Q 分格畫面。格名、共用／每系各寫都來自後端 pqGrid.cells（key、label、scope、linked、text）
function pqCellsHtml(d, editable) {
  const g = pqG(d), u = S.ui, L = d.nopqType === 'P_motivation' ? 'P' : 'Q', cites = d.cites || [], cv = d.draft && d.draft.currentVersion;
  const whole = String(d.freeText || '').trim(), mine = whole && whole !== String(g.text || '').trim();   // 目前這一版的整篇跟各格拼出來的不一樣
  const gone = !!(d.promptCheck && d.promptCheck.status === 'gone');
  if (!editable && mine) return `<div class="cell"><div class="ro" style="white-space:pre-wrap">${esc(d.freeText)}</div></div>`;   // 交出去、定稿的那一版是什麼就顯示什麼
  const note = !editable ? '' : mine && cv && cv.authorType === 'teacher'
    ? `<div class="hint" id="pq-teacher"><b>${esc(W14.teacherTitle)}</b><div class="small">${esc(W14.teacherNote)}</div><div class="cell"><div class="ro" style="white-space:pre-wrap">${esc(d.freeText)}</div></div></div>`
    : mine && cv && cv.mode === 'free' ? `<details class="hint" id="pq-kept"><summary><b>${esc(W14.keptTitle)}</b></summary><div class="small">${esc(W14.keptNote)}</div><div class="cell"><div class="ro" style="white-space:pre-wrap">${esc(d.freeText)}</div></div>
      <div class="row" style="margin-top:6px"><button type="button" class="btn sm ghost" data-act="pqCopyKept">${esc(W14.btnCopyKept)}</button></div></details>` : '';
  const cells = g.cells.map((c) => {
    const val = u.pqCells && u.pqCells[c.key] != null ? u.pqCells[c.key] : c.text || '', shared = c.scope === 'shared', linked = shared && c.linked, here = cites.filter((x) => x.sectionKey === c.key);
    const tag = shared ? (linked ? W14.sharedTag : W14.splitTag) : W14.deptTag, sub = linked ? w14('sharedNote', { L }) : shared ? W14.splitNote : '';
    return `<div class="pqcell" data-cell="${esc(c.key)}"><div class="row spread" style="align-items:center"><label class="f pqlab" for="pqc-${esc(c.key)}">${esc(c.label)}</label><span class="pill ${linked ? 'warn' : ''}">${esc(tag)}</span></div>
      ${sub ? `<div class="muted small">${esc(sub)}</div>` : ''}
      ${editable ? `<div class="cell"><textarea id="pqc-${esc(c.key)}" data-in="pqc" data-key="${esc(c.key)}" maxlength="2000">${esc(val)}</textarea></div>` : `<div class="cell"><div class="ro" style="white-space:pre-wrap">${esc(val) || esc(W14.empty)}</div></div>`}
      ${here.length ? `<div class="small">${esc(w14('citeHere', { list: here.map((x) => x.title || '').filter(Boolean).join('、') }))}</div>` : ''}
      ${editable && c.key === 'P.c2' && !here.length ? `<div class="muted small">${esc(W14.citeHint)}</div>` : ''}
      ${editable && linked ? `<div class="row" style="margin-top:6px"><button type="button" class="btn sm ghost" data-act="pqSplit" data-key="${esc(c.key)}">${esc(W14.btnSplit)}</button></div>` : ''}</div>`;
  }).join('');
  return `${editable ? `<div class="muted small" style="margin-top:4px">${esc(W14.gridNote)}</div>` : ''}${note}${cells}${!editable && gone && d.state !== 'finalized' ? `<div class="row" style="margin-top:8px"><button type="button" class="btn" data-act="copyFull" ${whole ? '' : 'disabled'}>複製全文</button></div>` : ''}`;
}
ACT.pqSubmit = async (el) => {
  el.disabled = true;
  try {
    if (S.ui.saving) await S.ui.saving.catch(() => null);
    if (!(pqGridOn(S.doc) ? pqPlain() : S.ui.freeText || '').trim()) { toast('先寫一點再交。', true); return; }
    if (S.ui.dirty && !(await saveDraft())) return;
    const r = await call('submit_pq_draft', { p_case_doc_id: S.docId, p_state_version: S.doc.stateVersion });
    if (r.ok) { await refreshDoc(); toast('交給老師了。'); }
  } finally { el.disabled = false; }
};
// 換寫法前先把打到一半的字存起來（整段寫空白＝沒有東西可存，直接換）；換寫法不搬字，兩邊的字各自留著
ACT.pqMode = async (el) => {
  const to = el.dataset.to; el.disabled = true;
  try {
    if (S.ui.saving) await S.ui.saving.catch(() => null);
    const blankFree = !pqGridOn(S.doc) && !(S.ui.freeText || '').trim();
    if (S.ui.dirty && !blankFree && !(await saveDraft())) return;
    const r = await call('set_pq_mode', { p_case_doc_id: S.docId, p_mode: to });
    if (r.ok) { S.ui.draftBase = undefined; S.ui.dirty = false; await refreshDoc(); toast(to === 'grid' ? W14.doneGrid : W14.doneFree); }
  } finally { el.disabled = false; }
};
ACT.pqSplit = async (el) => {
  const key = el.dataset.key; el.disabled = true;
  try {
    if (S.ui.saving) await S.ui.saving.catch(() => null);
    if (S.ui.dirty && !(await saveDraft())) return;
    const r = await call('pq_split_cell', { p_case_doc_id: S.docId, p_cell_key: key });
    if (r.ok) { await refreshDoc(); toast(W14.doneSplit); }
  } finally { el.disabled = false; }
};
ACT.pqCopyKept = async () => { toast((await copyText(String((S.doc && S.doc.freeText) || ''))) ? W14.copied : '這個瀏覽器不讓我複製，請自己選取複製。', false); };
// 老師發佈批改後：下載 Word（老師改的字＝追蹤修訂、逐句意見＝註解；W6b，本機伺服器 /export/review.docx）
ACT.dlReview = async (el) => {
  el.disabled = true;
  try {
    const ss = await sb.auth.getSession(), tok = ss.data && ss.data.session && ss.data.session.access_token;
    const res = await fetch('/export/review.docx?doc=' + encodeURIComponent(S.docId), { headers: { authorization: 'Bearer ' + (tok || '') } });
    if (!res.ok) { toast(res.status === 403 ? '老師還沒發佈這一輪，發佈後才下載得到。' : res.status === 404 ? '現在還下載不到這份批改，請跟老師說。' : '下載沒有成功，請稍後再試。', true); return; }
    const m = /filename\*=UTF-8''([^;]+)/i.exec(res.headers.get('content-disposition') || ''), name = m ? decodeURIComponent(m[1]) : 'NOPQ通批改版.docx';
    const url = URL.createObjectURL(await res.blob()), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) { toast('下載沒有成功，請稍後再試。', true); } finally { el.disabled = false; }
};
function selfCheckHtml(sc, d) {
  const failed = sc.status === 'failed' || sc.status === 'rejected', iss = (sc.issues || []).map((i) => `<div class="issue">${i.sectionKey && i.sectionKey !== 'total' ? '【' + esc(cellLabel(i.sectionKey, i.fieldKey)) + '】' : ''}${esc(i.note || i.kind)}${i.quote ? `<br><q>${esc(i.quote)}</q>` : ''}</div>`).join('');
  return `<h3>最近一次的育才仕寫作建議　<span class="badge ai">依育才仕老師的批改標準由系統整理，老師還沒逐字看過</span></h3>
    ${failed ? `<div class="issue">這次的寫作建議沒有整理出來，你的稿件內容都在。${d.state === 'self_check_pending' ? '可以直接交給老師看。' : ''}</div>${d.state === 'self_check_pending' ? '<button class="btn" data-act="sendReview">交給老師看</button>' : ''}`
      : `${iss || '<div class="pill ok">沒有發現需要補的地方</div>'}${(sc.strengths || []).length ? `<div class="muted small">做得不錯</div><ul class="plain">${sc.strengths.map((s) => `<li>${esc(itemText(s))}</li>`).join('')}</ul>` : ''}${sc.verdict ? `<div class="pill">${esc(VERDICT[sc.verdict] || sc.verdict)}</div>` : ''}`}`;
}
function collectDraft() {   // 要送出的稿：空白的文字欄不送；表格欄把「學期,科目,成績」每行轉成物件
  const u = S.ui, out = {};
  expandCells(gridSpec(), 4).forEach((c) => {
    const v = u.draft[c.key]; if (v == null) return;
    if (c.kind === 'terms') { if (Array.isArray(v) && v.length) out[c.key] = v; }
    else if (c.kind === 'table') {
      if (Array.isArray(v)) { if (v.length) out[c.key] = v; } else if (String(v).trim()) out[c.key] = String(v).split(/\n/).map((l) => l.split(',').map((x) => x.trim())).filter((r) => r[0]).map((r) => ({ term: r[0], subject: r[1] || '', score: r[2] || '' }));
    } else if (typeof v === 'string' && v.trim()) out[c.key] = v;
  });
  return out;
}
function keepNonText() {   // 整段稿只要把非文字欄（標籤、成績表）一起帶著
  const u = S.ui, out = {};
  expandCells(gridSpec(), 4).forEach((c) => { if (c.kind === 'text') return; const v = u.draft[c.key]; if (Array.isArray(v) && v.length) out[c.key] = v; });
  return out;
}
async function saveDraft() {
  const u = S.ui; let r;
  if (pqGridOn(S.doc)) {   // 2026-11-24 A13 W14：P、Q 分格寫＝只送打過的格（沒打的格伺服器那邊的字原樣留著）
    const cells = {}; pqG(S.doc).cells.forEach((c) => { if ((u.pqDirty || {})[c.key]) cells[c.key] = String((u.pqCells || {})[c.key] || ''); });
    r = await call('save_pq_cells', { p_case_doc_id: S.docId, p_cells: cells, p_base_version_id: u.draftBase || null });
    if (!r.ok) return false;
    u.pqDirty = {};
  } else if (u.mode === 'free') {
    if (!(u.freeText || '').trim()) { toast('整段稿不可以空白。', true); return false; }
    r = await call('save_draft_free', { p_case_doc_id: S.docId, p_free_text: u.freeText, p_section_map: keepNonText(), p_base_version_id: u.draftBase || null });
  } else r = await call('save_draft_grid', { p_case_doc_id: S.docId, p_text_by_section: collectDraft(), p_base_version_id: u.draftBase || null });
  if (!r.ok) return false;
  u.draftBase = r.versionId; u.dirty = false; u.sqlIssues = null; await refreshDoc(); if (u.chk && u.chk.ran) chkRun(true);
  toast(r.unchanged ? '內容沒有變動。' : `已儲存（第 ${r.versionNumber} 版）`); return true;
}
ACT.saveDraft = async (el) => { el.disabled = true; try { S.ui.saving = saveDraft(); await S.ui.saving; } finally { S.ui.saving = null; el.disabled = false; } };   // saving：P、Q「交給老師」要等儲存跑完，避免版本號撞在一起
ACT.selfCheck = async (el) => {
  el.disabled = true;
  try {
    if (S.ui.dirty && !(await saveDraft())) return;
    if (await chkPause()) return;   // 2026-11-24 W15：這份字還沒看過檢查結果 → 先查一次；有提醒就停在清單（只提醒、不擋：不改字再按一次就照交）
    const r = await call('submit_self_check', { p_case_doc_id: S.docId, p_state_version: S.doc.stateVersion, p_client_request_id: `chk-${S.docId}-${S.doc.stateVersion}` }, { quiet: true });
    if (!r.ok) {
      if (r.error === 'VALIDATION' && Array.isArray(r.detail)) { S.ui.sqlIssues = r.detail; await chkRun(true); renderDoc(); chkShow(); toast(w15('chkTop', { n: chkItems().length }), true); } else toast(errText(r), true);   // 2026-11-24 W15：R0（審閱稿第 85 句）換掉原本那一句
      return;
    }
    S.ui.sqlIssues = null; await refreshDoc();
    if (r.jobId) await runAi(r.jobId, '正在整理你的稿，通常幾秒鐘…'); else if (r.manualCheck) toast(S.doc && S.doc.aiSwitch === false ? '已交給老師，這一步由老師來做。' : '已交給老師，這一步由老師來做。');
  } finally { el.disabled = false; }
};
ACT.sendReview = async () => { const r = await call('submit_for_review', { p_case_doc_id: S.docId, p_state_version: S.doc.stateVersion }); if (r.ok) { await refreshDoc(); toast('已交給老師。'); } };
const DECISION = { return: '退回修改', reopen: '重新問答', finalize: '定稿' }, AUTHOR = { student: '你', teacher: '老師', ai: '寫作建議' };
function reviewCard() {
  const rv = S.doc.review; if (!rv || !(rv.decision || (rv.items || []).length || (rv.edits || []).length || rv.summary)) return '';
  const items = (rv.items || []).map((i) => `<div class="cm">${i.sectionKey ? '【' + esc(cellLabel(i.sectionKey, i.fieldKey)) + '】' : ''}<q>${esc(i.quote)}</q><div>${esc(i.issue)}</div>${i.question ? `<div class="muted">老師問：${esc(i.question)}</div>` : ''}</div>`).join('');
  const edits = (rv.edits || []).map((e) => `<div class="cell edited"><div class="lab"><span>${esc(cellLabel(e.sectionKey, e.fieldKey))}</span></div><div class="small">原文：${esc(e.beforeText || '（空白）')}</div><div>改成：${esc(e.afterText)}</div></div>`).join('');
  return `<details class="card active" open><summary>老師的話${rv.decision ? `　<span class="pill main">${esc(DECISION[rv.decision] || rv.decision)}</span>` : ''}</summary>
    ${rv.summary ? `<p style="white-space:pre-wrap;margin:8px 0">${esc(rv.summary)}</p>` : ''}${items ? `<h3>逐句意見</h3>${items}` : ''}${edits ? `<h3>老師改字（黃底）</h3>${edits}` : ''}
    ${rv.decision && LOCAL_SERVER ? '<div class="row" style="margin-top:10px"><button type="button" class="btn ghost sm" data-act="dlReview">下載老師批改的 Word（含追蹤修訂）</button></div>' : ''}</details>`;
}
// ── 2026-11-12 楊老師試用回饋 階段 1②（D6）：版本紀錄每一版可以點開看、挑兩版並排比、把某一版設回目前的版本（照那一版的內容存成新的一版；不做自動合併）──
// 讀一版全文用 get_draft_version（28m）；資料庫還沒有這支時只說「還打不開」，清單照舊。
document.addEventListener('toggle', (ev) => { if (ev.target.id === 'ver-card' && S.ui) S.ui.verOpen = ev.target.open; }, true);
const verUi = () => (S.ui.ver = S.ui.ver || { cache: {} });
function verPlain(d, ver) {   // 一版的文字（比較用）：整段稿＝原文；分欄稿＝每一欄「【欄位】＋內容」
  const t = (ver && ver.textBySection) || {};
  if (typeof t._free === 'string' && t._free.trim()) return t._free;
  const spec = d.grid && d.grid.spec; if (!spec) return '';
  return expandCells(spec, segCount(spec, t)).filter((c) => c.kind === 'text' && String(t[c.key] || '').trim()).map((c) => `【${c.child !== 'text' ? c.secLabel + '・' : ''}${c.label}】\n${t[c.key]}`).join('\n\n');
}
async function verGet(id) {
  const vu = verUi(); if (vu.cache[id]) return vu.cache[id];
  let r; try { r = await call('get_draft_version', { p_case_doc_id: S.docId, p_version_id: id }, { quiet: true }); } catch (e) { r = null; }
  if (!r || !r.ok) { toast(r && r.error === 'NOT_FOUND' ? '找不到這一版。' : '這一版現在還不能打開。需要看的話，請找育才仕。', true); return null; }
  return (vu.cache[id] = r.version);
}
const verName = (v) => `第 ${v.versionNumber} 版（${AUTHOR[v.authorType] || v.authorType}，${when(v.createdAt)}）`;
const segHtml = (segs) => segs.map((x) => x.t === '-' ? `<del style="background:var(--bad-bg);color:var(--bad)">${esc(x.s)}</del>` : x.t === '+' ? `<ins style="background:var(--ok-bg);color:var(--ok);text-decoration:none">${esc(x.s)}</ins>` : esc(x.s)).join('');
function versionsCard() {
  const d = S.doc, vs = (d.draft && d.draft.versions) || []; if (!vs.length) return ''; const cur = d.draft.currentVersion, vu = verUi(), canSet = d.state === 'draft_open';
  const isCur = (v) => !!cur && cur.id === v.id, newest = vs.slice().reverse();
  const a = vu.a || (vs.length > 1 ? vs[vs.length - 2].id : vs[0].id), b = vu.b || (cur ? cur.id : vs[vs.length - 1].id);
  const opts = (sel) => newest.map((v) => `<option value="${esc(v.id)}" ${sel === v.id ? 'selected' : ''}>第 ${v.versionNumber} 版（${esc(AUTHOR[v.authorType] || v.authorType)}）${isCur(v) ? '・目前' : ''}</option>`).join('');
  const rows = newest.map((v) => `<div class="doc-row"><div class="dmain">第 ${v.versionNumber} 版｜${esc(AUTHOR[v.authorType] || v.authorType)}｜${v.mode === 'free' ? '整段寫' : '分欄寫'}｜${esc(when(v.createdAt))}${isCur(v) ? ' <span class="pill ok">目前</span>' : ''}</div>
    <div class="row"><button type="button" class="btn sm ghost" data-act="verView" data-id="${esc(v.id)}">看</button>${canSet && !isCur(v) ? `<button type="button" class="btn sm ghost" data-act="verSet" data-id="${esc(v.id)}">設回這一版</button>` : ''}</div></div>`).join('');
  return `<details id="ver-card" class="card" ${S.ui.verOpen ? 'open' : ''}><summary>版本紀錄（${vs.length}）</summary>
    <p class="muted small" style="margin:6px 0">每存一次就多一版。每一版都可以點開看、挑兩版並排比。${canSet ? '也可以把某一版「設回」目前的版本：照那一版的內容存成新的一版，現在這版也還留在紀錄裡。' : '輪到你寫稿的時候，還可以把某一版設回目前的版本。'}</p>
    ${rows}
    ${vs.length > 1 ? `<div class="row" style="margin-top:8px;align-items:center"><select data-in="verA" aria-label="比較：左邊那一版">${opts(a)}</select><span>和</span><select data-in="verB" aria-label="比較：右邊那一版">${opts(b)}</select><button type="button" class="btn sm" data-act="verCmp">並排比</button></div>` : ''}
    <div id="ver-out">${vu.html || ''}</div></details>`;
}
IN.verA = (el) => { verUi().a = el.value; }; IN.verB = (el) => { verUi().b = el.value; };
function verShow(html) { const vu = verUi(); vu.html = html; S.ui.verOpen = true; const box = $('ver-out'); if (box) box.innerHTML = html; else renderDoc(); }
ACT.verView = async (el) => {
  el.disabled = true;
  try {
    const v = await verGet(el.dataset.id); if (!v) return;
    verShow(`<h3>${esc(verName(v))}${v.isCurrent ? ' <span class="pill ok">目前</span>' : ''}</h3><div class="cell"><div class="ro" style="white-space:pre-wrap">${esc(verPlain(S.doc, v)) || '（沒有內容）'}</div></div>`);
  } finally { el.disabled = false; }
};
ACT.verCmp = async (el) => {
  const vs = S.doc.draft.versions || [], cur = S.doc.draft.currentVersion, vu = verUi();
  const aId = vu.a || (vs.length > 1 ? vs[vs.length - 2].id : vs[0].id), bId = vu.b || (cur ? cur.id : vs[vs.length - 1].id);
  if (aId === bId) { toast('選兩個不一樣的版本才比得出差別。', true); return; }
  el.disabled = true;
  try {
    const [A, B] = [await verGet(aId), await verGet(bId)]; if (!A || !B) return;
    const [o, n] = A.versionNumber <= B.versionNumber ? [A, B] : [B, A], df = TD.diffText(verPlain(S.doc, o), verPlain(S.doc, n));
    verShow(`<div class="muted small" style="margin-top:10px">左邊是較早的第 ${o.versionNumber} 版、右邊是第 ${n.versionNumber} 版：<del style="background:var(--bad-bg);color:var(--bad)">紅底劃線</del>＝後來拿掉的，<ins style="background:var(--ok-bg);color:var(--ok);text-decoration:none">綠底</ins>＝後來加的。</div>
      ${df.changed ? '' : '<div class="hint">這兩版的內容一樣。</div>'}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-top:6px">
        <div><h3 style="margin-top:0">${esc(verName(o))}</h3><div class="cell"><div class="ro" style="white-space:pre-wrap">${segHtml(df.left) || '（沒有內容）'}</div></div></div>
        <div><h3 style="margin-top:0">${esc(verName(n))}</h3><div class="cell"><div class="ro" style="white-space:pre-wrap">${segHtml(df.right) || '（沒有內容）'}</div></div></div></div>`);
  } finally { el.disabled = false; }
};
ACT.verSet = async (el) => {
  const d = S.doc, v = await verGet(el.dataset.id); if (!v || d.state !== 'draft_open') return;
  const curV = d.draft.currentVersion, teacherLater = (d.draft.versions || []).filter((x) => x.versionNumber > v.versionNumber && x.authorType === 'teacher').map((x) => x.versionNumber);
  const msg = `設回第 ${v.versionNumber} 版：會照第 ${v.versionNumber} 版的內容存成新的一版，現在這版也還留在紀錄裡。`
    + (teacherLater.length ? `\n\n注意：老師在第 ${teacherLater.join('、')} 版改的字，設回之後就不在稿裡了（老師改字的紀錄還在）。` : '')
    + (S.ui.dirty ? '\n\n你還沒儲存的字也會不見。' : '') + '\n\n確定嗎？';
  if (!window.confirm(msg)) return;
  el.disabled = true;
  try {
    const t = Object.assign({}, v.textBySection || {}), free = typeof t._free === 'string' ? t._free : null; delete t._free;
    const base = curV ? curV.id : null;
    const r = free != null && free.trim()
      ? await call('save_draft_free', { p_case_doc_id: S.docId, p_free_text: free, p_section_map: t, p_base_version_id: base })
      : await call('save_draft_grid', { p_case_doc_id: S.docId, p_text_by_section: v.textBySection || {}, p_base_version_id: base });
    if (!r.ok) return;
    S.ui.draftBase = undefined; S.ui.dirty = false; S.ui.ver = { cache: {} }; await refreshDoc();
    toast(r.unchanged ? '內容跟現在這版一樣，沒有多一版。' : `設回了：第 ${r.versionNumber} 版＝第 ${v.versionNumber} 版的內容。`);
  } finally { el.disabled = false; }
};
// ══ 2026-11-12 楊老師試用回饋 階段 1③④（D7）：定稿後拿得到一份乾淨的全文；「我要交的」一頁照志願列出每一系要交哪幾篇、哪幾篇定稿了 ══
// 乾淨全文：整段稿＝原文；分欄稿＝依欄位順序，每段一個小標，標籤欄與成績表不放（那是給老師看的，不是要交的字）。
function fullTextOf(d, ver) {
  const t = (ver && ver.textBySection) || {};
  if (typeof t._free === 'string' && t._free.trim()) return t._free.trim();
  const spec = d.grid && d.grid.spec; if (!spec) return '';
  const cells = expandCells(spec, segCount(spec, t)).filter((c) => c.kind === 'text'), out = []; let last = '';
  cells.forEach((c) => {
    const v = String(t[c.key] || '').trim(); if (!v) return;
    if (c.section !== last) { out.push((out.length ? '\n' : '') + '【' + c.secLabel + '】'); last = c.section; }
    out.push(v);
  });
  return out.join('\n');
}
async function copyText(text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* 改用下面的舊方法 */ }
  const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); return ok;
}
const COPY_NOTE = '複製出去再改的字，系統裡的定稿不會跟著變；要改請回這一篇，請老師重開。';
function finalCard() {   // 定稿那一篇：複製全文＋看全文（D7 先給複製全文；Word 等雲端匯出）
  const d = S.doc; if (!d || d.state !== 'finalized') return '';
  const text = fullTextOf(d, d.draft && d.draft.currentVersion), open = !!S.ui.showFull;
  return `<div class="card active"><h2 style="margin-top:0">確定版</h2><p style="margin:0 0 8px">這篇定稿了，全文 ${nlen(text)} 字。按「複製全文」貼到你的排版檔（PPT、Canva、Word）。</p>
    <div class="row"><button type="button" class="btn" data-act="copyFull" ${text ? '' : 'disabled'}>複製全文</button><button type="button" class="btn ghost" data-act="toggleFull">${open ? '收起全文' : '看全文'}</button><a class="btn ghost" href="#/deliver">我要交的</a></div>
    <div class="muted small" style="margin-top:6px">${esc(COPY_NOTE)}</div>
    ${open ? `<div class="cell" style="margin-top:8px"><div class="ro" style="white-space:pre-wrap">${esc(text) || '（沒有內容）'}</div></div>` : ''}</div>`;
}
ACT.toggleFull = () => { S.ui.showFull = !S.ui.showFull; renderDoc(); };
ACT.copyFull = async () => { const d = S.doc, t = fullTextOf(d, d.draft && d.draft.currentVersion); toast((await copyText(t)) ? '全文複製好了，可以貼到你的排版檔。' : '這個瀏覽器不讓我複製，請按「看全文」自己選取複製。', !t); };
// 「我要交的」：首頁資料（me_home 的 docs）＋志願（my_wishlist 的指引與 116 項目層：哪幾篇有列）。N、O 每一系共用一份；P、Q 每系各一篇。
const DLV_TYPES = [['N', 'N_diverseSummary'], ['O', 'O_reflection'], ['P', 'P_motivation'], ['Q', 'Q_futurePlan']];
// 2026-11-17 owner 第②題：「必交／選交／指引沒列」改用 NG.WORDS（116 簡章有列／去年指引有列／選繳…）
async function viewDeliver() {
  setTab('write'); view(loading); const my = S.rt;
  const [h, w] = await Promise.all([call('me_home'), call('my_wishlist')]); if (!h.ok || !w.ok || my !== S.rt) return; S.home = h;
  const docs = h.docs || [], items = (w.items || []).slice().sort((a, b) => (a.rank || 99) - (b.rank || 99));
  const docOf = (type, code) => docs.find((d) => d.nopqType === type && (type === 'N_diverseSummary' || type === 'O_reflection' || d.deptCode === code));
  const row = (letter, d, req) => {
    const st = d ? (stepOf(d.state, [d.state]))[0] : '還沒有這一篇', fin = d && d.state === 'finalized';
    return `<div class="doc-row"><div class="dmain"><b>${esc(DOC_SHORT[letter])}</b> <span class="pill ${req === 'cac' || req === 'cacOpt' ? 'main' : ''}">${esc(NG.WORDS[req] || '')}</span>
      <div class="muted small">${fin ? '<span class="pill ok">定稿了</span>' : esc(st)}${d && d.freeLen ? '｜' + d.freeLen + ' 字' : ''}${d ? flagPill(d) : ''}</div></div>
      ${d ? `<div class="row">${fin ? `<button type="button" class="btn sm" data-act="dlvCopy" data-id="${esc(d.caseDocId)}">複製全文</button>` : ''}<button type="button" class="btn sm ghost" data-act="openDoc" data-id="${esc(d.caseDocId)}" data-state="${esc(d.state)}">${fin ? '看' : '去寫'}</button></div>` : ''}</div>`;
  };
  const cards = items.map((it) => {
    const has = NG.hasGuide(it) || !!NG.gi116(it);   // 同「審查資料準備指引說明」頁（guide_pure.js 的 needOf）
    const list = DLV_TYPES.map(([L, type]) => ({ L, d: docOf(type, it.deptCode), req: NG.needOf(it, L) })).filter((x) => x.req !== 'none' || x.d && x.d.state === 'finalized');
    const fin = list.filter((x) => x.d && x.d.state === 'finalized');
    // 2026-11-17 指引重建階段一（設計稿 guide_rebuild_design_v0.2 0.6⑥）：116 簡章另外要交的（R 之後用官方名稱、學習歷程檔案大類）列在下面；
    // R 之後要寫的那幾篇系統還不能寫（階段四），照實講。上面 N–Q 那幾列的要不要交用 NG.WORDS（owner 第②題）。
    // 11-20 審查資料第二步（28t）：R 之後要寫的那幾篇現在可以在這裡寫——帶系碼與這一系已開的 X 稿，renderZones116 放「開始寫」或「繼續寫」
    const gi = NG.gi116 ? NG.gi116(it) : null, more = gi ? NG.renderZones116(gi, { skipNQ: true, desc: false, title: NG.WORDS.z116More, deptCode: it.deptCode, docs }) : '';
    return `<div class="card"><h2 style="margin-top:0">第 ${esc(it.rank)} 志願｜${esc(it.schoolName || '')} ${esc(it.name || '')}</h2>
      <p style="margin:0 0 6px">${esc(NG.fill(NG.WORDS.dlvCount, { n: list.length, f: fin.length }))}${fin.length >= list.length && list.length ? `　<span class="pill ok">${esc(NG.WORDS.dlvAllDone)}</span>` : ''}${has ? '' : `<span class="muted small">${esc(NG.WORDS.nodata)}</span>`}</p>
      ${list.map((x) => row(x.L, x.d, x.req)).join('')}${more}
      ${w.official ? `<div style="margin-top:6px"><a class="btn sm ghost" href="#/dept/${esc(it.deptCode)}">${esc(NG.WORDS.dlvDeptAll)}</a></div>` : ''}</div>`;   // 11-22 A4（規格 14.1）：多一行連到這一系那一頁；後端有第三步（官方項目表）才出現
  });
  view(`<div class="card active"><h2>我要交的</h2><p style="margin:0">照你的志願，一系一張：每一系要交哪幾篇、哪幾篇定稿了。N、O 每一系用同一份；P、Q 每系各寫一篇。定稿的可以直接「複製全文」。</p>
    <p class="muted small" style="margin:6px 0 0">${esc(COPY_NOTE)} 排版（PPT、Canva）之後才做。</p></div>
    <div id="deliver-checklist" class="hidden"></div>
    ${cards.join('') || '<div class="card muted">還沒有存志願。先到「落點分析」挑系、存成志願。</div>'}`);
  // ↑ deliver-checklist：留給商業版本設計稿 T2（nopq_biz_versions_design_v0.1.md 16.1 第 8 條）的「定稿前檢查清單」；等楊老師確認原句才填，現在不顯示
}
// 2026-11-20 審查資料第二步（28t）：R 以後要寫的（自傳、小論文…）按「開始寫」才建稿（後端 open_extra_doc 驗志願與項目、重複按回同一篇），建好直接打開那一篇
ACT.openExtra = async (el) => {
  el.disabled = true;
  try {
    const r = await call('open_extra_doc', { p_dept_code: el.dataset.dept, p_item_code: el.dataset.code });
    if (!r.ok || !r.caseDocId) return;
    const docs = (S.home && S.home.docs) || null;   // 首頁資料的快取補上這一篇（之後「審查資料準備指引」就顯示「繼續寫」），不另外重撈
    if (docs && !docs.some((z) => z.caseDocId === r.caseDocId)) docs.push({ caseDocId: r.caseDocId, nopqType: r.nopqType, itemCode: r.itemCode, itemLabel: r.itemLabel, deptCode: r.deptCode, deptName: ((r.schoolName || '') + ' ' + (r.deptName || '')).trim(), state: r.state, stateVersion: r.stateVersion, docMode: 'free', inWishlist: r.inWishlist, wishRank: r.wishRank });
    location.hash = '#/doc/' + r.caseDocId;
  } finally { el.disabled = false; }
};
ACT.dlvCopy = async (el) => {
  el.disabled = true;
  try {
    const d = await call('get_doc_state', { p_case_doc_id: el.dataset.id }); if (!d.ok) return;
    const t = fullTextOf(d, d.draft && d.draft.currentVersion);
    toast(!t ? '這一篇沒有讀到內容。' : (await copyText(t)) ? '全文複製好了，可以貼到你的排版檔。' : '這個瀏覽器不讓我複製，請點「看」打開那一篇再複製。', !t);
  } finally { el.disabled = false; }
};
window.addEventListener('beforeunload', (e) => { if (S.ui && S.ui.dirty) { e.preventDefault(); e.returnValue = ''; } });
sb.auth.onAuthStateChange((evt) => { if (evt === 'SIGNED_OUT' && S.home) showLogin('已登出。'); });
// ══ 2026-11-24 A13 W13（NOPQ 寫作改造前端包二）：N、O 開稿前先挑件；寫稿頁「我的學習歷程」面板；O 的能力對照表 ══
// 後端 29c W09：my_cite_items（可引用的件＋件數上下限）、pick_doc_items（還沒開始時挑件並開稿，件數不對回 VALIDATION 附 min／max）、add_doc_cite、update_doc_cite、
// remove_doc_cite、get_doc_state 的 cites（失效看 status／invalidReason）。引述不進正文：這裡只畫清單，從不寫進稿子的欄位，複製全文的字（fullTextOf）不經過這裡。
const ci = () => (S.ui.ci = S.ui.ci || { sel: [], msg: '', say: {}, full: {}, claim: {}, data: null, wish: null, open: undefined });
const ciPickN = (d) => { const p = (ci().data || {}).pick; return p && p.min ? p : d && d.nopqType === 'O_reflection' ? { min: 2, max: 3 } : { min: 3, max: 4 }; };
const ciItems = () => { const x = ci().data; return x && Array.isArray(x.items) ? x.items : null; };
const ciItem = (sid) => (ciItems() || []).find((i) => i.sourceId === sid);
async function ciLoad() {
  const id = S.docId, d = S.doc; if (!d || isX(d)) return;
  const jobs = [call('my_cite_items', { p_case_doc_id: id }, { quiet: true, noRefresh: true }).catch(() => null)];
  if (d.state === 'warmup' && isNO(d)) jobs.push(call('my_wishlist', {}, { quiet: true }).catch(() => null));   // 挑件頁最後一行要各志願系有採計的類別
  const [r, w] = await Promise.all(jobs); if (id !== S.docId) return;
  const c = ci(); c.data = r && r.ok ? r : false; if (w) c.wish = w.ok ? w.items || [] : null;
  renderDoc();
}
// 件的排序：後端已照「勾給幾個志願系」排好；N 把多元表現放前面、O 把課程學習成果放前面（同類裡維持後端的順序）
function ciOrdered(d) {
  const items = (ciItems() || []).slice(), first = d.nopqType === 'N_diverseSummary' ? '多元表現' : d.nopqType === 'O_reflection' ? '課程學習成果' : '';
  return first ? items.filter((i) => i.groupName === first).concat(items.filter((i) => i.groupName !== first)) : items;
}
const ciCode = (it) => [it.itemCode, it.codeName].filter(Boolean).join(' ') || it.groupName || '';
// ── 挑件頁（審閱稿第五節 第 77～84 句）──
function pickReq(d) {   // 2026-11-24 A13 W15：上半塊的「都要的／某系多要的」改讀各系差異（my_doc_dept_diff），跟寫稿頁旁欄同一份；核對中的系照實寫
  const wish = ci().wish || [], dif = S.diff;
  if (!(dif && Array.isArray(dif.depts) && dif.depts.length) && !wish.length) return '';   // 沒有存志願：不出現這一塊
  const nm = (dp) => ((dp.schoolName || '') + ' ' + (dp.name || '')).trim();
  const cats = (it) => { const gi = NG.gi116(it), cs = gi ? gi.items.map((x) => x.code).filter((c) => /^[B-M]$/.test(c)) : []; return cs.length ? [...new Set(cs)].sort().map((c) => NG.codeName(c) || c).join('、') : W13.catNone; };
  const zones = dif == null ? '' : dif === false || !dif.depts.length ? `<p class="small" style="margin:0 0 6px">${esc(W13.reqNone)}</p>` : diffHtml(W13.reqNone);
  return `<div class="card focus" id="pick-req"><h3>${esc(W13.reqTitle)}</h3><p class="muted" style="margin:0 0 6px">${esc(W13.reqLead)}</p>
    ${zones}
    <p class="small" style="margin:6px 0 2px">${esc(W13.catLead)}</p>
    ${wish.length ? `<ul class="plain small">${wish.map((it) => `<li>${esc(w13('catRow', { rank: it.rank, dept: nm(it), list: cats(it) }))}</li>`).join('')}</ul>` : ''}</div>`;
}
function pickCard() {
  const d = S.doc, c = ci(), p = ciPickN(d), items = ciOrdered(d);
  const row = (it) => { const n = it.pickedDepts || 0;
    return `<label class="crow citem"><input type="checkbox" data-in="pickSel" data-id="${esc(it.sourceId)}" ${c.sel.includes(it.sourceId) ? 'checked' : ''}>
      <span class="ptx"><b>${esc(it.title)}</b> <span class="pill">${esc(ciCode(it))}</span> <span class="pill ${n ? 'ok' : 'warn'}">${esc(n ? w13('tagPicked', { n }) : W13.tagNone)}</span>${it.what ? `<span class="ciw muted">${esc(it.what)}</span>` : ''}</span></label>`; };
  const list = c.data === null ? `<p class="muted"><span class="spin"></span>${esc(W13.loading)}</p>` : c.data === false ? `<div class="issue">${esc(W13.loadFail)}</div>`
    : items.length ? items.map(row).join('') : `<p style="margin:0 0 8px">${esc(W13.emptyInv)}</p><button type="button" class="btn sm" data-act="goMine">${esc(W13.goPut)}</button>`;
  return `<div class="card active" id="pick-card"><h2>${esc(w13('pickTitle', { n: zhN(p.min) }))}</h2><p style="margin:0">${esc(w13('pickLead', { n: zhN(p.min), m: zhN(p.max) }))}</p></div>${pickReq(d)}
    <div class="card" id="pick-list">${list}
      ${c.msg ? `<div class="issue" role="alert" id="pick-msg">${esc(c.msg)}</div>` : ''}
      <div class="row" style="margin-top:10px"><button type="button" class="btn" data-act="pickGo">${esc(W13.next)}</button><span class="muted small" id="pick-cnt">${esc(w13('count', { n: c.sel.length }))}</span></div>
      <p class="muted small" style="margin:6px 0 0">${esc(W13.doneNote)}</p></div>
    <div class="card"><div class="row"><button type="button" class="btn ghost" data-act="startDoc">${esc(W13.altBtn)}</button><span class="muted small ciw-alt">${esc(W13.altLead)}</span></div></div>`;
}
IN.pickSel = (el) => {
  const c = ci(), p = ciPickN(S.doc), id = el.dataset.id, i = c.sel.indexOf(id);
  if (el.checked) {
    if (c.sel.length >= p.max) { el.checked = false; c.msg = w13('over', { m: zhN(p.max) }); toast(c.msg, true); renderDoc(); return; }   // 勾到超過上限那一件：不勾，說原因
    if (i < 0) c.sel.push(id);
  } else if (i >= 0) c.sel.splice(i, 1);
  c.msg = ''; renderDoc();
};
function pickSay(c, r, n, p) {   // 件數不對：照後端回的 min／max 說（畫面上的上下限讀不到時也對得上）
  const mn = r && r.min ? r.min : p.min, mx = r && r.max ? r.max : p.max;
  c.msg = n < mn ? w13('short', { n: zhN(mn) }) : w13('over', { m: zhN(mx) });
}
ACT.pickGo = async (el) => {
  const c = ci(), p = ciPickN(S.doc), n = c.sel.length;
  if (n < p.min || n > p.max) { pickSay(c, null, n, p); renderDoc(); const m = $('pick-msg'); if (m && m.scrollIntoView) m.scrollIntoView({ block: 'nearest' }); return; }
  el.disabled = true;
  try {
    const r = await call('pick_doc_items', { p_case_doc_id: S.docId, p_source_ids: c.sel }, { quiet: true, noRefresh: true });
    if (r.ok) { NEED_SCAN.delete(S.docId); c.msg = ''; S.doc = r; syncUi(); await refreshDoc(); toast(W13.pickedOk); return; }
    if (isInvGate(r)) { NEED_SCAN.set(S.docId, hasScan() ? 'stuck' : 'new'); toast(INV_GATE_TEXT, true); renderDoc(); return; }
    if (r.error === 'VALIDATION' && JSON.stringify(r.detail || '').includes('count')) pickSay(c, r, n, p);
    else if (r.error === 'NOT_FOUND') c.msg = W13.pickGone;
    else c.msg = errText(r);
    renderDoc(); const m = $('pick-msg'); if (m && m.scrollIntoView) m.scrollIntoView({ block: 'nearest' });
  } finally { el.disabled = false; }
};
// ── 寫稿頁「我的學習歷程」面板：這篇引用了＋我放的件（對照欄下面；手機在稿子上面）──
document.addEventListener('toggle', (ev) => { if (ev.target.id === 'ci-items' && S.ui) ci().open = ev.target.open; }, true);   // 重畫時保留摺疊
function ciWhere(k) {   // 引述綁在哪一格：N、O 用段名，P、Q 用格名，整段寫＝整篇
  if (!k) return W13.whole;
  const g = ((S.doc && S.doc.pqGrid) || {}).cells; const hit = Array.isArray(g) ? g.find((x) => x.key === k) : null;
  return hit ? hit.label : cellLabel(k, '') || k;
}
function ciKeyFor(d) {   // 這一次「引用這一件」要綁哪一格：N、O＝下一個還沒有件的段（沒有＝''）；P、Q 照格寫＝P 第 2 格／Q 第 1 格，整段寫＝不綁格（null）
  const cites = d.cites || [];
  if (isNO(d)) {
    const pre = d.nopqType === 'O_reflection' ? 'O.file' : 'N.exp', sg = (gridSpec() || {}).segments, mx = (sg && sg.max) || ciPickN(d).max;
    for (let k = 1; k <= mx; k++) if (!cites.some((x) => x.sectionKey === pre + '[' + k + ']')) return pre + '[' + k + ']';
    return '';
  }
  const g = d.pqGrid; if (!g || g.mode === 'free') return null;
  const cells = g.cells || [], want = d.nopqType === 'P_motivation' ? 'P.c2' : (cells[0] || {}).key;
  return cells.some((x) => x.key === want) ? want : (cells[0] || {}).key || null;
}
function citeRow(x, d, locked) {
  const c = ci(), bad = x.status === 'invalid', it = ciItem(x.sourceId), code = [x.itemCode, x.codeName].filter(Boolean).join(' ');
  const val = c.claim[x.id] != null ? c.claim[x.id] : x.claim || '';
  const notHere = !bad && isPQ(d) && it && !it.pickedHere;   // 這一件沒勾給這一系：審查老師看不到原件
  return `<div class="cite" data-cite="${esc(x.id)}"><div><b>${esc(ciWhere(x.sectionKey))}</b>　${esc(x.title || '')}${code ? ` <span class="pill">${esc(code)}</span>` : ''}</div>
    ${bad ? `<div class="issue">${esc(W13.gone)}</div>` : ''}${notHere ? `<div class="issue">${esc(W13.notHere)}${d.deptCode ? ` <a class="btn sm ghost" href="#/dept/${esc(d.deptCode)}">${esc(W13.goPick)}</a>` : ''}</div>` : ''}
    ${!locked && !bad ? `<label class="f" for="cl-${esc(x.id)}">${esc(W13.claimLab)}</label><div class="row"><input type="text" id="cl-${esc(x.id)}" data-in="ciClaim" data-key="${esc(x.id)}" maxlength="100" value="${esc(val)}"><button type="button" class="btn sm ghost" data-act="ciClaimSave" data-id="${esc(x.id)}">${esc(W13.btnClaim)}</button></div>`
      : x.claim ? `<div class="small">${esc(x.claim)}</div>` : ''}
    ${!locked ? `<div class="row" style="margin-top:6px"><button type="button" class="btn sm ghost" data-act="ciDrop" data-id="${esc(x.id)}">${esc(bad ? W13.btnDropCite : W13.btnDrop)}</button></div>` : ''}</div>`;
}
function itemRow(it, d, cites, locked) {
  const c = ci(), here = cites.filter((x) => x.sourceId === it.sourceId), n = it.pickedDepts || 0, say = c.say[it.sourceId], full = c.full[it.sourceId];
  return `<div class="cite item" data-src="${esc(it.sourceId)}"><div><b>${esc(it.title)}</b> <span class="pill">${esc(ciCode(it))}</span>${isPQ(d) && it.pickedHere ? ` <span class="pill ok">${esc(W13.hereTag)}</span>` : ''}${n ? ` <span class="pill">${esc(w13('tagPicked', { n }))}</span>` : ''}</div>
    ${it.what ? `<div class="ciw muted">${esc(it.what)}</div>` : ''}${here.length ? `<div class="small">${esc(w13('citedAt', { where: here.map((x) => ciWhere(x.sectionKey)).join('、') }))}</div>` : ''}
    ${say ? `<div class="issue" role="alert">${esc(say)}</div>` : ''}${full != null ? `<div class="cell"><div class="ro" style="white-space:pre-wrap">${esc(full)}</div></div>` : ''}
    <div class="row" style="margin-top:6px">${!locked && !here.length ? `<button type="button" class="btn sm" data-act="ciAdd" data-id="${esc(it.sourceId)}">${esc(W13.btnCite)}</button>` : ''}<button type="button" class="btn sm ghost" data-act="ciView" data-id="${esc(it.sourceId)}">${esc(full != null ? W13.btnHide : W13.btnView)}</button></div></div>`;
}
function citePanel() {
  const d = S.doc; if (!d || isX(d) || (d.state === 'warmup' && isNO(d))) return '';
  const c = ci(), cites = d.cites || [], items = ciOrdered(d), locked = d.state === 'finalized' || !!(d.promptCheck && d.promptCheck.status === 'gone');
  const open = c.open === undefined ? isPQ(d) : c.open;   // P、Q：這一系勾的件一進來就攤開
  const listHtml = c.data === null ? `<p class="muted"><span class="spin"></span>${esc(W13.loading)}</p>` : c.data === false ? `<div class="issue">${esc(W13.loadFail)}</div>`
    : items.length ? items.map((it) => itemRow(it, d, cites, locked)).join('') : `<p style="margin:0 0 8px">${esc(W13.emptyInv)}</p><button type="button" class="btn sm" data-act="goMine">${esc(W13.goPut)}</button>`;
  return `<div class="card citepanel" id="cite-panel"><h3>${esc(W13.panel)}</h3><div class="ptitle">${esc(W13.cited)}</div>
    ${cites.length ? cites.map((x) => citeRow(x, d, locked)).join('') : `<p class="muted small" style="margin:0">${esc(W13.citedNone)}</p>`}
    <details class="more" id="ci-items" ${open ? 'open' : ''}><summary>${esc(w13('items', { n: items.length }))}</summary>${listHtml}</details></div>`;
}
ACT.ciAdd = async (el) => {
  const d = S.doc, c = ci(), sid = el.dataset.id, key = ciKeyFor(d); c.say = {};
  if (key === '') { c.say[sid] = W13.noFree; renderDoc(); return; }
  el.disabled = true;
  try {
    const r = await call('add_doc_cite', { p_case_doc_id: S.docId, p_source_id: sid, p_section_key: key, p_claim: null }, { quiet: true });
    if (!r.ok) { c.say[sid] = r.error === 'CITE_FULL' ? W13.full : r.error === 'CITE_EXISTS' ? W13.exists : errText(r); renderDoc(); return; }
    S.doc.cites = r.cites; toast(W13.added); renderDoc();
  } finally { el.disabled = false; }
};
ACT.ciDrop = async (el) => {
  el.disabled = true;
  try {
    const r = await call('remove_doc_cite', { p_cite_id: el.dataset.id }, { quiet: true });
    if (r.ok) { S.doc.cites = r.cites; ci().say = {}; toast(W13.dropped); } else toast(errText(r), true);
    renderDoc();
  } finally { el.disabled = false; }
};
IN.ciClaim = (el) => { ci().claim[el.dataset.key] = el.value; };
ACT.ciClaimSave = async (el) => {
  const id = el.dataset.id, c = ci(); el.disabled = true;
  try {
    const r = await call('update_doc_cite', { p_cite_id: id, p_claim: c.claim[id] != null ? c.claim[id] : '' }, { quiet: true });
    if (r.ok) { S.doc.cites = r.cites; delete c.claim[id]; toast(W13.claimed); renderDoc(); } else toast(errText(r), true);
  } finally { el.disabled = false; }
};
ACT.ciView = async (el) => {   // 〔看內容〕：就地展開這一件的文字，不離開寫稿頁
  const c = ci(), sid = el.dataset.id; if (c.full[sid] != null) { delete c.full[sid]; renderDoc(); return; }
  el.disabled = true;
  try {
    const r = await call('my_inventory_item', { p_file_asset_id: sid }, { quiet: true, noRefresh: true }).catch(() => null);
    c.full[sid] = r && r.ok ? (r.item && r.item.text) || W13.noText : W13.textFail; renderDoc();
  } finally { el.disabled = false; }
};
// O 的能力對照表：每個檔案段挑的能力標籤排成「哪一件 × 哪一項能力」，自動算、只看不填（沒有輸入框）
function abilityCard() {
  const d = S.doc; if (!d || d.nopqType !== 'O_reflection' || d.state === 'warmup') return '';
  const cs = (d.cites || []).filter((x) => /^O\.file\[\d+\]$/.test(x.sectionKey || '')); if (!cs.length) return '';
  const dr = (S.ui && S.ui.draft) || {}, rows = cs.map((x) => ({ x, ids: Array.isArray(dr[x.sectionKey + '.terms']) ? dr[x.sectionKey + '.terms'] : [] }));
  const cols = [...new Set(rows.reduce((a, r) => a.concat(r.ids), []))];
  const tbl = cols.length ? `<div class="tablewrap"><table class="cmp" id="ab-table"><thead><tr><th>${esc(W13.abCorner)}</th>${cols.map((id) => `<th>${esc(termName(id))}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr><th scope="row">${esc(r.x.title || ciWhere(r.x.sectionKey))}</th>${cols.map((id) => (r.ids.includes(id) ? '<td aria-label="有">✔</td>' : '<td></td>')).join('')}</tr>`).join('')}</tbody></table></div>`
    : `<p class="muted" style="margin:0">${esc(W13.abEmpty)}</p>`;
  return `<details class="card" id="ab-card" open><summary>${esc(W13.abTitle)}</summary><p class="muted small" style="margin:0 0 6px">${esc(W13.abNote)}</p>${tbl}</details>`;
}
ACT.goMine = () => { location.hash = '#/mine'; };   // 2026-11-24 A13 W13：〔去放一件〕
// ══ 2026-11-24 A13 W15（NOPQ 寫作改造前端包四）：交出去前的檢查清單、N 每段「這段放圖」 ══
// 後端 29c：my_doc_check(p_case_doc_id, p_text)＝issues[{rule, sectionKey, fieldKey, message}]（R1～R10 的句子，審閱稿第 86～95 句，後端已代換好）；
// set_section_photo(p_case_doc_id, p_section_key, p_on)＝回目前所有放圖的段（photos）。只提醒、不擋交稿；R0（第 85 句）是清單最上面那一句，由這裡畫。
// 後端沒有「讀目前放圖的段」的函式（get_doc_state 沒回）：這一頁記在 S.ui.photos、同一個瀏覽器記在 localStorage，每次設定後以後端回的 photos 為準，檢查回 R8 的段也補進來。
const chkS = () => (S.ui.chk = S.ui.chk || { issues: null, ran: false, seen: '' });
const photoKeyOf = (id) => 'nopq_photo_' + id;
function photoGet() {
  const u = S.ui; if (!u.photos) { let a = []; try { a = JSON.parse(localStorage.getItem(photoKeyOf(S.docId)) || '[]'); } catch (e) { a = []; } u.photos = (Array.isArray(a) ? a : []).filter((k) => /^N[.]exp\[[1-4]\]$/.test(k)); }
  return u.photos;
}
function photoSet(list) { S.ui.photos = (list || []).slice(); try { localStorage.setItem(photoKeyOf(S.docId), JSON.stringify(S.ui.photos)); } catch (e) { /* 存不了就只留在這一頁 */ } }
const photoSecs = () => (((gridSpec() || {}).sections) || []).filter((s) => s.photo === 'optional').map((s) => s.key);
function photoRow(sec, editable) {
  if (!S.doc || S.doc.nopqType !== 'N_diverseSummary' || !photoSecs().includes(sec)) return '';
  const on = photoGet().includes(sec), first = photoSecs()[0] === sec;
  if (!editable) return on ? `<div class="small"><span class="pill ok">${esc(W15.photoLab)}</span></div>` : '';
  return `<label class="crow photorow"><input type="checkbox" data-in="photoTog" data-sec="${esc(sec)}" ${on ? 'checked' : ''}><span class="ptx">${esc(W15.photoLab)}${first ? `<span class="muted small"> ${esc(W15.photoNote)}</span>` : ''}</span></label>`;
}
IN.photoTog = async (el) => {
  const key = el.dataset.sec, on = el.checked, id = S.docId;
  const r = await call('set_section_photo', { p_case_doc_id: id, p_section_key: key, p_on: on }, { quiet: true, noRefresh: true }).catch(() => null);
  if (id !== S.docId) return;
  if (!r || !r.ok) { el.checked = !on; toast(W15.photoFail, true); return; }
  photoSet(r.photos || []);
  if (chkS().ran) await chkRun(true); else renderDoc();
};
// 這一刻要送去檢查的字（還沒存的也算）；整段寫的 N、O 與整段寫的 P、Q 不帶字，後端用已存的那一版
function chkText() {
  const d = S.doc;
  if (isPQ(d)) { const o = {}; ((pqG(d) || {}).cells || []).forEach((c) => { o[c.key] = String(S.ui.pqCells && S.ui.pqCells[c.key] != null ? S.ui.pqCells[c.key] : c.text || ''); }); return o; }
  return S.ui.mode === 'free' ? null : collectDraft();
}
const chkSig = () => JSON.stringify([chkText(), photoGet()]);
async function chkRun(quiet) {
  const id = S.docId, d = S.doc; if (!d) return null;
  const c = chkS(), sig = chkSig();
  const r = await call('my_doc_check', { p_case_doc_id: id, p_text: isPQ(d) && !pqGridOn(d) ? null : chkText() }, { quiet: true, noRefresh: true }).catch(() => null);
  if (id !== S.docId) return null;
  if (!r || !r.ok) { if (r && !quiet) toast(errText(r), true); return null; }
  c.issues = r.issues || []; c.ran = true; c.seen = sig;
  const ph = photoGet().slice(); c.issues.forEach((i) => { if (i.rule === 'R8' && i.sectionKey && !ph.includes(i.sectionKey)) ph.push(i.sectionKey); });   // 後端說這段標了放圖：這邊也勾上
  if (ph.length !== photoGet().length) photoSet(ph);
  chkPaint(); return c.issues;
}
// 清單的每一條：後端的條（R1～R10）＋交出去時後端硬擋的「還沒填」（沒有對應的 R 條才留；超過字數那幾條已由 R1～R3 說了）
function chkItems() {
  const c = chkS(), out = (c.issues || []).map((i) => ({ rule: i.rule, sec: i.sectionKey || '', field: i.fieldKey || '', msg: i.message }));
  const have = new Set(out.map((x) => x.sec + '|' + x.field));
  (S.ui.sqlIssues || []).forEach((i) => {
    if (c.issues && (i.kind === 'over_limit' || have.has((i.sectionKey || '') + '|' + (i.fieldKey || '')))) return;
    out.push({ rule: '', sec: i.sectionKey || '', field: i.fieldKey || '', msg: i.note || i.kind || '' });
  });
  return out;
}
function chkHtml() {
  const c = chkS(), items = chkItems();
  const body = items.length ? `<div class="chk-top"><b>${esc(w15('chkTop', { n: items.length }))}</b></div><p class="muted small" style="margin:2px 0 4px">${esc(W15.chkHow)}</p>`
      + items.map((x) => `<button type="button" class="btn ghost chk-item" data-act="chkGo" data-rule="${esc(x.rule)}" data-sec="${esc(x.sec)}" data-field="${esc(x.field)}">${esc(x.msg)}</button>`).join('')
    : c.ran ? `<div class="pill ok chk-ok">${esc(W15.chkOk)}</div>` : '';
  return `<div id="chk-box" class="chkbox" aria-live="polite">${body}</div>`;
}
function chkPaint() { const b = $('chk-box'); if (b) b.outerHTML = chkHtml(); else renderDoc(); }
const chkShow = () => { const b = $('chk-box'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest' }); };
// 交出去那一下：這份字還沒看過檢查結果 → 先查；有提醒就停在清單上（不改字再按一次就照交，不擋）
async function chkPause() {
  const c = chkS(); if (c.ran && c.seen === chkSig()) return false;
  await chkRun(true); const n = chkItems().length; if (!n) return false;
  toast(w15('chkTop', { n }), true); chkShow(); return true;
}
let chkTimer = 0;
function chkSoon() {   // 檢查過一次之後，打字停 1.5 秒就自動再查一次，清單只換清單那一塊（不動輸入框）
  const c = S.ui && S.ui.chk; if (!c || !c.ran) return; clearTimeout(chkTimer); const id = S.docId;
  chkTimer = setTimeout(() => { if (S.docId === id) chkRun(true); }, 1500);
}
ACT.chkRun = async (el) => {
  el.disabled = true; const t0 = Date.now();
  // 2026-11-24 A13 第 2 輪查因：檢查晚回來時，學生若已點了一條提醒跳去那一格，就不再捲回清單（原本會把那一格捲出畫面）
  try { cellChkAll(); const r = await chkRun(false); if (r) { if (S.ui.cellChk) renderDoc(); if (!((S.ui.chkGoAt || 0) >= t0)) chkShow(); } } finally { el.disabled = false; }   // 2026-11-24 A13 W23：按〔檢查〕同時把各格的檢核句列出來（跟上面的 R 清單分開）
};
// 點一條 → 捲到那一格、把游標放進那一格的輸入框；整段（沒有指到哪一小格）放在那一段的第一格；全篇太長放在目前最長的那一格；放圖超過三段放在勾了放圖的那一格
function chkGoTo(sec, field, again) {
  const v = $('view'), cells = [...v.querySelectorAll('textarea[data-key]')];
  let t = null;
  if (sec === 'total') t = cells.filter((e) => e.dataset.in === 'cell').sort((a, b) => b.value.length - a.value.length)[0];
  else if (!sec) t = v.querySelector('input[data-in="photoTog"]:checked') || v.querySelector('input[data-in="photoTog"]');
  else t = (field && field !== 'text' ? cells.find((e) => e.dataset.key === sec + '.' + field) : null) || cells.find((e) => e.dataset.key === sec) || cells.find((e) => e.dataset.key.startsWith(sec + '.'));
  if (!t && sec && !again && S.ui.extraSeg !== true) { S.ui.extraSeg = true; renderDoc(); chkGoTo(sec, field, true); return; }   // 那一段還沒展開（四段的第四段）：展開再找
  if (!t) return;
  S.ui.chkGoAt = Date.now();   // 2026-11-24 A13：記下學生跳去哪一格的時間，晚回來的〔檢查〕就不捲回清單
  if (t.scrollIntoView) t.scrollIntoView({ block: 'center' });
  try { t.focus({ preventScroll: true }); } catch (e) { /* 放不進去就停在捲到的位置 */ }
}
ACT.chkGo = (el) => chkGoTo(el.dataset.sec, el.dataset.field, false);
