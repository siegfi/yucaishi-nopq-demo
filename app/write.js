'use strict';   // 原本整支主程式包在一個函式裡並開嚴格模式；拆檔後每個檔各自開
// ── 寫：文件清單 ──
const DOC_STEP = {
  warmup: ['還沒開始', '開始'], interviewing: ['老師在等你講一件事', '繼續'], assignment_pending: ['老師正在準備下一個題目', '看一下'],
  submission_pending: ['老師給了你一個題目', '去寫答案'], feedback_pending: ['已交給老師，等老師的話', '看一下'], feedback_published: ['老師的話出來了', '去看'],
  draft_open: ['輪到你寫稿', '去寫'], self_check_pending: ['老師正在看你的稿', '看一下'], review_pending: ['老師正在改你的稿', '看一下'], finalized: ['定稿了', '看稿'],
};
async function viewWrite() {
  setTab('write'); view(loading); const my = S.rt;
  const [h, w] = await Promise.all([call('me_home'), call('my_wishlist', {}, { quiet: true }).catch(() => null)]); if (!h.ok || my !== S.rt) return; S.home = h;
  const j = h.journey || {}, step = j.step || 2, docs = h.docs || [], early = step >= 2 && step < 6 ? STEP_CARD[step] : null;
  view(`<div class="card"><div class="row spread"><h2 style="margin:0">寫</h2><a class="btn ghost sm" href="#/deliver">我要交的（每個志願一張清單）</a></div>
    ${early ? `<div class="hint">前面還有一步沒走完：${esc(early.t)} <a href="${esc(early.href)}">去看看</a></div>` : ''}
    ${aiStatementHint(w && w.ok ? w.items : [], !!h.consent.ai)}
    ${h.consent.general ? '' : '<div class="hint">同意書還沒登錄完成，暫時不能開始寫。請聯絡育才仕。</div>'}
    ${!h.consent.ai ? '<div class="hint">目前沒有 AI 處理同意：你回答後，會由老師接著出題。</div>' : S.aiOn === false ? '<div class="hint">目前沒有開 AI：你回答、交稿之後，這一步由老師接手，不用在畫面上等。</div>' : ''}
    ${docs.length ? docListHtml(docs) : '<p class="muted">老師還沒幫你建立文件。</p>'}</div>`);
}
// 2026-11-12 換 116（owner 拍板 D7：提醒、不代填）：志願裡有系要交 AI 使用聲明時，在「寫」頁提醒；聲明是學生自己寫，系統不替他判斷
function aiStatementHint(items, aiOn) {
  const need = (items || []).filter((it) => NG.needsAiStatement(it)); if (!need.length) return '';
  const names = need.map((it) => (it.schoolName || '') + ' ' + (it.name || '')).join('、');
  return `<div class="hint"><b>你的志願裡有 ${need.length} 系要交「AI 使用聲明」</b>（${esc(names)}）。聲明要你自己寫${aiOn ? '；你在 NOPQ通用 AI 補問、拆格寫過的篇章，聲明時要照實寫' : ''}。怎麼交、檔案在哪下載，看<a href="#/need">「要交什麼」</a>裡那幾系的說明。</div>`;
}
// 2026-11-08 架構稿 W4：P、Q 每個志願系各一篇（整段稿）；已不在志願的系收在最下面，稿都還在
const isPQ = (d) => d.nopqType === 'P_motivation' || d.nopqType === 'Q_futurePlan';
function docRow(d) {
  const st = DOC_STEP[d.state] || ['', '進入'], later = d.state === 'warmup' && isPQ(d) && d.docMode !== 'free';   // 後端還沒放行 P、Q（沒套 28g）時維持「之後再寫」
  const extra = isPQ(d) && d.freeLen ? '｜已寫 ' + d.freeLen + ' 字' : '';
  return `<div class="doc-row"><div class="dmain"><div style="font-weight:700">${esc(docTitle(d))}</div><div class="muted small">${esc(later ? '之後再寫' : st[0])}${d.round ? '｜第 ' + d.round + ' 輪' : ''}${esc(extra)}</div></div>
    <button type="button" class="btn sm ${d.state === 'warmup' || d.state === 'interviewing' || d.state === 'draft_open' || d.state === 'submission_pending' ? '' : 'ghost'}" data-act="openDoc" data-id="${esc(d.caseDocId)}" data-state="${esc(d.state)}" ${later ? 'disabled' : ''}>${esc(st[1])}</button></div>`;
}
function docListHtml(docs) {
  const no = docs.filter((d) => !isPQ(d)), pq = docs.filter(isPQ), on = pq.filter((d) => d.inWishlist !== false), off = pq.filter((d) => d.inWishlist === false);
  return no.map(docRow).join('')
    + (on.length ? `<h3>P 就讀動機、Q 未來計畫（每個志願系各一篇）</h3>${on.map(docRow).join('')}` : '')
    + (off.length ? `<details style="margin-top:10px"><summary class="muted">已不在志願的系（${off.length} 篇，寫過的都還在）</summary>${off.map(docRow).join('')}</details>` : '');
}
// ── 第 6、7、8 幕：老師帶你寫、老師改稿、定稿（文件頁）──
const stopPoll = () => { S.poll++; };
const GET = (opts) => call('get_doc_state', { p_case_doc_id: S.docId }, Object.assign({ quiet: true, noRefresh: true }, opts));
async function viewDoc(id) {
  setTab('doc'); S.docId = id; S.ui = {}; S.terms = []; S.termsMiss = {}; view(loading);
  const d = await GET({ quiet: false }); if (!d.ok) { location.hash = '#/write'; return; }
  S.doc = d; await loadTerms(); syncUi(); renderDoc();
  if (d.pendingJobId) runAi(d.pendingJobId, '老師還在整理上一步，稍等一下…', true);
}
async function refreshDoc() { if (!S.docId) return null; const d = await GET(); if (d.ok && d.caseDocId === S.docId) { S.doc = d; if (termsStale()) await loadTerms(); syncUi(); renderDoc(); } return d; }
async function runAi(jobId, label, silent) {
  if (!jobId) return;
  const my = ++S.poll, fired = new Set(); S.ui.waiting = label || '老師在看，通常幾秒鐘…'; renderDoc();
  let dead = false;   // 2026-11-12 楊老師回饋階段 0①：AI 那一支叫不起來（雲端沒部署、連不上）就不再空等 60 秒，直接說由老師接手
  const fire = async (id) => {
    fired.add(id);
    try { const { error } = await sb.functions.invoke('nopq-ai', { body: { jobId: id } }); if (error) dead = true; }
    catch (e) { dead = true; }
  };
  await fire(jobId);
  for (let i = 0; i < 30 && S.poll === my && !dead; i++) {   // 每 2 秒查一次，最多 60 秒，直到沒有進行中的任務
    const d = await GET().catch(() => ({ ok: false })); if (!d.ok) break; S.doc = d;
    if (!d.pendingJobId) break;
    if (!fired.has(d.pendingJobId)) { await fire(d.pendingJobId); continue; }   // 資料庫接著建的下一個任務也要叫起來
    await sleep(2000);
  }
  if (dead && S.poll === my) { await GET().then((d) => { if (d.ok) S.doc = d; }).catch(() => null); if (!silent) toast('這一步由老師接手，你寫的內容都已保留。'); }
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
}
const HINTS = {
  warmup: '按「開始」，老師會問你第一個問題。',
  interviewing: '',
  assignment_pending: '你說的老師收到了，正在準備下一個題目，出好會顯示在這裡。',
  submission_pending: '老師給了你一個題目。把答案貼在下面的框，按「交給老師」。',
  feedback_pending: '已交給老師，等老師的話。出來前不用再做什麼。',
  feedback_published: '老師的話出來了。接下來老師會決定再問一輪，或讓你開始寫第一版。',
  draft_open: '輪到你寫稿了。每一欄寫完按「儲存」，都填好後按「改好再給我看一次」。',
  self_check_pending: '老師正在看你的稿，結果出來前稿件鎖定。',
  review_pending: '已交給老師改，稿件鎖定，等老師的話。',
  finalized: '這篇定稿了。稿件已鎖定。',
};
const PQ_HINTS = {
  draft_open: '照這系的題目寫。寫一段按「儲存」，確定了按「交給老師」。也可以用檔案帶入（Word、PDF、文字檔）。',
  review_pending: '已交給老師改，稿件鎖定，等老師的話。',
  finalized: '這篇定稿了。稿件已鎖定。',
};
const JOB_ERR = { CONSENT: '沒有 AI 處理同意', QUOTA: '今天的次數用完了', STALE: '等太久沒有回應' };
function headCard() {
  const d = S.doc, home = ((S.home || {}).docs || []).find((x) => x.caseDocId === d.caseDocId), lj = d.lastJob, jobFail = lj && !d.pendingJobId && (lj.status === 'failed' || lj.status === 'rejected');
  const aiOff = d.aiSwitch === false || (lj && lj.error === 'AI_OFF');   // 28l：AI 總開關關著（或上一次因為沒開而停掉）
  const hint = (d.docMode === 'free' ? PQ_HINTS : HINTS)[d.state];
  return `<div class="card active"><a href="#/write" class="small" style="text-decoration:none">← 回到「寫」</a>
    <h2 style="margin-top:4px">${esc(home ? docTitle(home) : (TYPE_NAME[d.nopqType] || d.nopqType) + (d.schoolName ? '｜' + d.schoolName + ' ' + (d.deptName || '') : ''))}</h2>
    ${hint ? `<div class="hint" style="margin-top:0">${esc(hint)}</div>` : ''}
    ${S.ui.waiting ? `<div class="hint" style="border-color:var(--accent)"><span class="spin"></span>${esc(S.ui.waiting)}</div>` : ''}
    ${jobFail && aiOff && d.docMode !== 'free' ? '<div class="hint">這一步由老師接手：你交出去的回答和稿都已保留，老師看過會回你，不用在畫面上等。</div>'
      : jobFail ? `<div class="issue">上一次沒有成功${lj.error ? '（' + esc(JOB_ERR[lj.error] || '暫時出錯') + '）' : ''}。你的內容都已保留，可以請老師接手。</div>` : ''}</div>`;
}
function renderDoc() {
  if (!S.doc || S.doc.caseDocId !== S.docId) return;
  const y = window.scrollY, d = S.doc; let main;
  if (d.docMode === 'free') { view(headCard() + finalCard() + reviewCard() + pqCard() + versionsCard()); window.scrollTo(0, y); return; }   // P、Q：整段稿，不經問答
  if (d.state === 'warmup') main = warmupCard();
  else if (d.state === 'interviewing') main = teacherCard();
  else if (['assignment_pending', 'submission_pending', 'feedback_pending', 'feedback_published'].includes(d.state)) main = assignmentCard();
  else main = reviewCard() + draftCard();
  view(headCard() + finalCard() + main + (d.state === 'interviewing' || d.state === 'warmup' ? '' : assignmentRest()) + pointsCard() + chatCard() + historyCard() + versionsCard());
  window.scrollTo(0, y);
}
const assignmentRest = () => (['assignment_pending', 'submission_pending', 'feedback_pending', 'feedback_published'].includes(S.doc.state) ? '' : assignmentCard());
const warmupCard = () => '<div class="card"><button class="btn" data-act="startDoc">開始</button></div>';
ACT.startDoc = async (el) => { el.disabled = true; const r = await call('open_doc', { p_case_doc_id: S.docId }); if (r.ok) { S.doc = r; syncUi(); renderDoc(); } else el.disabled = false; };
// ── 欄位規格展開（同資料庫 nopq_grid_fields／nopq_seg_count 的規則）──
function expandCells(spec, segs) {
  const out = [], four = (segs || 0) >= 4;
  ((spec && spec.sections) || []).forEach((s) => {
    const ch = s.children || [], qs = s.questions || [];
    if (ch.length) ch.forEach((c) => out.push({ section: s.key, secLabel: s.label, key: s.key + '.' + c.key, child: c.key, label: c.label, limit: four && c.limit4 ? c.limit4 : c.limit,
      req: s.required !== false && !!c.required, kind: c.kind || 'text', prompt: (qs.find((q) => q.key === c.key) || {}).prompt }));
    else out.push({ section: s.key, secLabel: s.label, key: s.key, child: 'text', label: s.label, limit: s.limit, req: !!s.required, kind: s.kind || 'text', prompt: qs[0] && qs[0].prompt });
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
  N_diverseSummary: 'N 分三段：你是誰、三件你做過的事、你想去哪。',
  O_reflection: 'O 分三段：高一到現在學習上的轉變、兩三件課程成果或活動、你想對審查老師說的最後一句話。',
};
const WHO = { system: '老師問', ai: '老師追問', teacher: '老師問' };
function teacherCard() {
  const d = S.doc, turns = (d.cycle && d.cycle.turns) || [], open = turns.find((t) => !t.answered), u = S.ui;
  const first = !turns.some((t) => t.answered), arch = first ? ARCH_LINE[d.nopqType] : '';
  let tail = '';
  if (open) {
    tail = `<textarea class="big" data-in="answer" placeholder="想到什麼寫什麼，不用整理。" maxlength="2000" ${u.waiting ? 'disabled' : ''}>${esc(u.answer || '')}</textarea>
      <div class="row spread" style="margin-top:6px"><span class="muted small" id="ans-cnt">${nlen(u.answer)} 字</span><button class="btn" data-act="sendAnswer" ${u.waiting ? 'disabled' : ''}>交給老師</button></div>`;
  } else if (!u.waiting) {
    tail = !d.aiEnabled || u.teacherAsks
      ? `<div class="hint">${d.aiSwitch === false ? '這一步由老師接手：' : ''}你的回答老師收到了，老師會接著出下一題。也可以按「今天先到這」。</div>`
      : '<div class="hint">老師沒有接著出題。你可以按「今天先到這」，等老師準備下一個題目。</div>';
  }
  if (!u.waiting) tail += u.confirmStop
    ? '<div class="hint">確定今天先到這？老師會根據你已經說的，準備下一個題目。<div class="row" style="margin-top:6px"><button class="btn sm" data-act="stopInterview">確定先到這</button><button class="btn sm ghost" data-act="stopCancel">繼續回答</button></div></div>'
    : '<div style="margin-top:10px"><button class="btn ghost sm" data-act="stopAsk">今天先到這</button></div>';
  return `<div class="card active"><div class="teach"><b>老師的話</b>${arch ? `<p>${esc(arch)}</p>` : ''}${open ? `<p><b>${esc(open.question)}</b></p>` : ''}</div>${tail}</div>`;
}
IN.answer = (el) => { S.ui.answer = el.value; const c = $('ans-cnt'); if (c) c.textContent = nlen(el.value) + ' 字'; };
ACT.stopAsk = () => { S.ui.confirmStop = true; renderDoc(); };
ACT.stopCancel = () => { S.ui.confirmStop = false; renderDoc(); };
ACT.sendAnswer = async (el) => {
  const t = ((S.doc.cycle || {}).turns || []).find((x) => !x.answered), text = (S.ui.answer || '').trim();
  if (!t) return; if (!text) return toast('先寫一點再交給老師。', true);
  el.disabled = true;
  const r = await call('interview_answer', { p_case_doc_id: S.docId, p_turn_id: t.id, p_answer: text, p_client_request_id: 'ans-' + t.id });
  if (!r.ok) { el.disabled = false; return; }
  S.ui.teacherAsks = !!r.teacherAsks; await refreshDoc();
  if (r.jobId) await runAi(r.jobId, '老師在讀你寫的，通常幾秒鐘…');
  else if (r.teacherAsks) toast(r.quotaExceeded ? '今天的系統次數用完了，這題由老師接手。' : r.aiOff ? '這一步由老師接手，你的回答已存好。' : '這題由老師出，你的回答已存好。');
};
ACT.stopInterview = async () => {
  S.ui.confirmStop = false; const r = await call('interview_stop', { p_case_doc_id: S.docId, p_state_version: S.doc.stateVersion }); if (!r.ok) return;
  await refreshDoc(); toast('好，今天先到這。老師會根據你說的準備下一個題目。'); if (r.jobId) runAi(r.jobId, '老師在準備下一個題目（你不用等）…', true);
};
function chatCard() {
  const turns = ((S.doc.cycle || {}).turns || []).filter((t) => t.answered); if (!turns.length) return '';
  return `<details class="card"><summary>之前聊的（${turns.length}）</summary><div class="chat">${turns.map((t) => `<div class="bub q"><span class="who">${esc(WHO[t.role] || '老師問')}｜${esc(cellLabel(t.sectionKey, t.fieldKey))}</span>${esc(t.question)}</div><div class="bub a"><span class="who">我說的</span>${esc(t.answer || '（略過）')}</div>`).join('')}</div></details>`;
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
  return `<details class="card"><summary>老師整理出的重點（${pts.length}）</summary>${Object.keys(groups).map((g) => `<h3>${esc(g)}</h3>` + groups[g].map((p) => `<div class="pt"><div class="txt">${esc(p.text)}</div></div>`).join('')).join('')}</details>`;
}
// ── 老師給的題目與老師的話 ──
const ASG_TYPE = { worksheet: '學習單', reply: '回覆老師的問題', write_section: '試寫一小段' };
const VERDICT = { needs_work: '還需要補強', almost: '接近了', ready: '可以了' };
const itemText = (x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? [x.note || x.text || x.issue || x.question || '', x.quote ? `（「${x.quote}」）` : ''].join('') : String(x));
function feedbackHtml(fb) {
  const b = fb.body || {}, ai = fb.reviewedLabel === 'ai_unreviewed', li = (arr) => `<ul class="plain">${arr.map((x) => `<li>${esc(itemText(x))}</li>`).join('')}</ul>`;
  const issues = (b.issues || []).map((i) => (i.sectionKey ? `【${cellLabel(i.sectionKey, i.fieldKey)}】` : '') + itemText(i));
  return `<h3>老師的話　${ai ? '<span class="badge ai">AI 老師的意見，真人老師還沒看過</span>' : ''}</h3>
    ${b.text ? `<div style="white-space:pre-wrap">${esc(b.text)}</div>` : ''}${Array.isArray(b.items) && b.items.length ? li(b.items) : ''}
    ${issues.length ? `<div class="muted small">可以再補強的地方</div>${li(issues)}` : ''}${Array.isArray(b.strengths) && b.strengths.length ? `<div class="muted small">做得不錯的地方</div>${li(b.strengths)}` : ''}
    ${b.verdict ? `<div class="pill">${esc(VERDICT[b.verdict] || b.verdict)}</div>` : ''}`;
}
function assignmentCard() {
  const d = S.doc, a = d.assignment; if (!a) return '';
  const sub = a.submission, canSubmit = d.state === 'submission_pending', pq = Array.isArray(a.personalQuestions) ? a.personalQuestions : [];
  return `<details class="card ${canSubmit ? 'active' : ''}" ${canSubmit || d.state === 'feedback_pending' || d.state === 'feedback_published' ? 'open' : ''}><summary>老師給你的題目（${esc(ASG_TYPE[a.type] || a.type)}）</summary>
    <p style="white-space:pre-wrap;margin:8px 0 4px"><b>題目：</b>${esc(a.prompt)}</p>
    ${pq.length ? `<div class="muted small">老師針對你的問題</div><ul class="plain">${pq.map((q) => `<li>${esc(itemText(q))}</li>`).join('')}</ul>` : ''}
    ${a.dueAt ? `<div class="muted small">截止：${esc(when(a.dueAt))}</div>` : ''}
    ${sub ? `<h3>我交的（第 ${sub.revision} 版，${esc(when(sub.submittedAt))}）</h3><div class="cell"><div class="ro">${esc(sub.text || '（沒有文字）')}</div></div>` : ''}
    ${canSubmit ? `<label class="f" for="asg-text">把答案貼在這裡（Word、PDF、文字檔可以用框下面的「用檔案帶入」）</label>
      <textarea id="asg-text" data-in="assignText" maxlength="5000" style="min-height:140px" ${d.pendingJobId ? 'disabled' : ''}>${esc(S.ui.assignText || '')}</textarea>
      <div class="row spread" style="margin-top:6px"><span class="muted small" id="asg-cnt">${nlen(S.ui.assignText)} 字</span><button class="btn" data-act="submitAssign" ${S.ui.waiting ? 'disabled' : ''}>交給老師</button></div>` : ''}
    ${a.feedback ? feedbackHtml(a.feedback) : (sub ? '<div class="hint">已交給老師，等老師的話。</div>' : '')}</details>`;
}
IN.assignText = (el) => { S.ui.assignText = el.value; const c = $('asg-cnt'); if (c) c.textContent = nlen(el.value) + ' 字'; };
ACT.submitAssign = async (el) => {
  const a = S.doc.assignment, text = (S.ui.assignText || '').trim(); if (!a) return; if (!text) return toast('先寫一點再交給老師。', true);
  el.disabled = true;
  const r = await call('submit_assignment', { p_assignment_id: a.id, p_text: text, p_asset_ids: [], p_client_request_id: `sub-${a.id}-${(a.submission ? a.submission.revision : 0) + 1}` });
  if (!r.ok) { el.disabled = false; return; }
  await refreshDoc(); toast('交給老師了。');
  if (r.jobId) await runAi(r.jobId, '老師在看你的答案，通常幾秒鐘…');
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
      ${f ? feedbackHtml(f) : s ? '<div class="muted small" style="margin-top:6px">這一輪沒有收到老師的話。</div>' : ''}</div>`;
  }).join('');
  return `<details id="hist-card" class="card" ${S.ui.histOpen ? 'open' : ''}><summary>之前的題目和老師的話（${past.length} 輪）</summary>${rows}</details>`;
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
    ${editable && c.prompt && c.kind === 'text' && !v ? `<div class="muted small">${esc(c.prompt)}</div>` : ''}${body}
    ${hit ? `<div class="small" style="margin-top:4px">老師改過｜原文：「${esc(hit.beforeText || '（空白）')}」</div>` : ''}</div>`;
}
IN.cell = (el) => {
  const key = el.dataset.key; S.ui.draft[key] = el.value; markDirty();
  const cell = el.closest('.cell'), cnt = cell.querySelector('.cnt'), lim = +el.dataset.limit || 0;
  if (cnt && lim) { const n = nlen(el.value); cnt.textContent = `已 ${n} 字／≤${lim} 字`; cnt.classList.toggle('over', n > lim); }
  const tot = $('tot-cnt'); if (tot) tot.textContent = totalText();
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
  if (u.mode === 'free') return `全篇 ${nlen(u.freeText)} 字${S.doc && S.doc.docMode === 'free' ? '／最多 ' + (S.doc.maxChars || 5000) + ' 字' : spec && spec.totalLimit ? '／≤' + spec.totalLimit + ' 字' : ''}`;
  const cells = expandCells(spec, segCount(spec, u.draft)).filter((c) => c.kind === 'text');
  const n = cells.reduce((s, c) => s + nlen(u.draft[c.key]), 0); return `全篇 ${n} 字${spec.totalLimit ? '／≤' + spec.totalLimit + ' 字' : ''}`;
}
IN.free = (el) => { S.ui.freeText = el.value; markDirty(); const t = $('tot-cnt'); if (t) t.textContent = totalText(); };
function markDirty() { S.ui.dirty = true; const b = $('dirty'); if (b) b.classList.remove('hidden'); }
function draftCard() {
  const d = S.doc, u = S.ui; if (!d.grid) return '';
  const hasV = !!(d.draft && d.draft.currentVersion), editable = d.state === 'draft_open', sc = d.draft && d.draft.selfCheck;
  if (!hasV && !['draft_open', 'self_check_pending', 'review_pending', 'finalized'].includes(d.state)) return '';
  const free = u.mode === 'free', vc = visibleCells(); let last = '';
  const cellsHtml = free ? '' : vc.cells.map((c) => {
    const head = c.child !== 'text' && c.section !== last ? `<div class="seg">${esc(c.secLabel)}</div>` : ''; last = c.section; return head + cellHtml(c, editable);
  }).join('');
  const freeHtml = !free ? '' : editable
    ? `<label class="f" for="free-text">你的稿</label><textarea id="free-text" class="big" data-in="free" maxlength="5000">${esc(u.freeText || '')}</textarea>`
    : `<div class="cell"><div class="ro">${esc(u.freeText || '') || '（沒有內容）'}</div></div>`;
  const checkList = (u.sqlIssues || []).map((i) => `<div class="issue">${esc(i.note)}${i.len ? `（${i.len}／${i.limit} 字）` : ''}</div>`).join('');
  return `<details class="card ${editable ? 'active' : ''}" open><summary>你的稿${d.state === 'finalized' ? '　<span class="pill ok">定稿了</span>' : ''}</summary>
    ${freeHtml}${cellsHtml}${editable && !free && vc.canAdd ? '<button class="btn ghost sm" data-act="addSeg">＋ 再加一段</button>' : ''}
    <div class="row spread" style="margin-top:10px"><span class="muted small" id="tot-cnt">${esc(totalText())}</span><span class="pill warn ${u.dirty && editable ? '' : 'hidden'}" id="dirty">還沒儲存</span></div>
    ${checkList ? `<h3>再給老師看之前要先處理</h3>${checkList}` : ''}
    ${editable ? `<div class="row" style="margin-top:10px"><button class="btn ghost" data-act="saveDraft">儲存</button><button class="btn" data-act="selfCheck" ${u.waiting ? 'disabled' : ''}>改好再給我看一次</button></div>` : ''}
    ${sc && sc.status !== 'queued' && sc.status !== 'running' ? selfCheckHtml(sc, d) : ''}</details>`;
}
// ── P、Q 整段稿（W4）：題目取該系指引；沒有題目就請他先看官方分則，不自編通用題 ──
function pqCard() {
  const d = S.doc, u = S.ui, letter = d.nopqType === 'P_motivation' ? 'P' : 'Q', editable = d.state === 'draft_open', max = d.maxChars || 5000;
  const prompts = (d.prompts || []).filter((p) => p && (!p.doc || p.doc === letter)).map((p) => (typeof p === 'string' ? p : p.text)).filter(Boolean);
  const lims = (d.limits || []).map((l) => (window.NG && NG.limitText ? NG.limitText(l) : '')).filter(Boolean);
  const others = ((S.home || {}).docs || []).filter((x) => x.nopqType === d.nopqType && x.caseDocId !== d.caseDocId && (x.freeLen || 0) > 0);
  const where = ((d.schoolName || '') + ' ' + (d.deptName || '')).trim() || '這系';
  return `<div class="card ${editable ? 'active' : ''}">
    ${d.inWishlist === false ? '<div class="hint" style="margin-top:0">這系已經不在你的志願裡，寫過的稿都還留著；選回來就會回到上面的清單。</div>' : ''}
    <h3 style="margin-top:0">${esc(where)} 要你回答</h3>
    ${prompts.length ? `<ul class="plain">${prompts.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : `<div class="muted">這系的指引裡沒有 ${letter} 的題目${d.guideSource === 'missing' || !d.guideSource ? '（學校沒公開或老師還沒建檔）' : ''}，先到「要交什麼」看官方連結。</div>`}
    ${lims.length ? `<div class="muted small" style="margin-top:4px">篇幅：${esc(lims.join('；'))}</div>` : ''}
    ${editable ? `<label class="f" for="free-text">你的${letter === 'P' ? '就讀動機' : '未來學習計畫'}</label><textarea id="free-text" class="big" data-in="free" maxlength="${max}">${esc(u.freeText || '')}</textarea>`
      : `<div class="cell"><div class="ro">${esc(u.freeText || '') || '（沒有內容）'}</div></div>`}
    <div class="row spread" style="margin-top:8px"><span class="muted small" id="tot-cnt">${esc(totalText())}</span><span class="pill warn ${u.dirty && editable ? '' : 'hidden'}" id="dirty">還沒儲存</span></div>
    ${editable ? `<div class="row" style="margin-top:10px"><button class="btn ghost" data-act="saveDraft">儲存</button><button class="btn" data-act="pqSubmit">交給老師</button></div>` : ''}
    ${editable && others.length ? `<details style="margin-top:10px"><summary class="muted small">從別系的 ${letter} 複製一份當起點</summary>${others.map((x) => `<div class="doc-row"><span class="dmain">${esc(docTitle(x))}（${x.freeLen} 字）</span><button type="button" class="btn sm ghost" data-act="pqCopy" data-from="${esc(x.caseDocId)}">複製過來</button></div>`).join('')}</details>` : ''}</div>`;
}
ACT.pqSubmit = async (el) => {
  el.disabled = true;
  try {
    if (S.ui.saving) await S.ui.saving.catch(() => null);
    if (!(S.ui.freeText || '').trim()) { toast('先寫一點再交。', true); return; }
    if (S.ui.dirty && !(await saveDraft())) return;
    const r = await call('submit_pq_draft', { p_case_doc_id: S.docId, p_state_version: S.doc.stateVersion });
    if (r.ok) { await refreshDoc(); toast('交給老師了。'); }
  } finally { el.disabled = false; }
};
ACT.pqCopy = async (el) => {
  const from = el.dataset.from; el.disabled = true;
  try {
    if (S.ui.dirty && !window.confirm('你這篇還有沒儲存的字，複製會蓋掉。要繼續嗎？')) return;
    let r = await call('copy_pq_draft', { p_target_doc_id: S.docId, p_source_doc_id: from }, { quiet: true });
    if (!r.ok && r.error === 'TARGET_NOT_EMPTY') {
      if (!window.confirm('這篇已經有內容了。要用別系那篇整個蓋掉嗎？（原本的會留在版本紀錄）')) return;
      r = await call('copy_pq_draft', { p_target_doc_id: S.docId, p_source_doc_id: from, p_force: true });
    } else if (!r.ok) { toast(errText(r), true); return; }
    if (r.ok) { S.ui.draftBase = undefined; await refreshDoc(); toast('複製好了，記得改成寫給這一系的內容。'); }
  } finally { el.disabled = false; }
};
// 老師發佈批改後：下載 Word（老師改的字＝追蹤修訂、逐句意見＝註解；W6b，本機伺服器 /export/review.docx）
ACT.dlReview = async (el) => {
  el.disabled = true;
  try {
    const ss = await sb.auth.getSession(), tok = ss.data && ss.data.session && ss.data.session.access_token;
    const res = await fetch('/export/review.docx?doc=' + encodeURIComponent(S.docId), { headers: { authorization: 'Bearer ' + (tok || '') } });
    if (!res.ok) { toast(res.status === 403 ? '老師還沒發佈這一輪，發佈後才下載得到。' : res.status === 404 ? '這個版本目前只能在本機試用版下載。' : '下載沒有成功，請稍後再試。', true); return; }
    const m = /filename\*=UTF-8''([^;]+)/i.exec(res.headers.get('content-disposition') || ''), name = m ? decodeURIComponent(m[1]) : 'NOPQ通批改版.docx';
    const url = URL.createObjectURL(await res.blob()), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) { toast('下載沒有成功，請稍後再試。', true); } finally { el.disabled = false; }
};
function selfCheckHtml(sc, d) {
  const failed = sc.status === 'failed' || sc.status === 'rejected', iss = (sc.issues || []).map((i) => `<div class="issue">${i.sectionKey && i.sectionKey !== 'total' ? '【' + esc(cellLabel(i.sectionKey, i.fieldKey)) + '】' : ''}${esc(i.note || i.kind)}${i.quote ? `<br><q>${esc(i.quote)}</q>` : ''}</div>`).join('');
  return `<h3>最近一次老師的話　<span class="badge ai">AI 老師的意見，真人老師還沒看過</span></h3>
    ${failed ? `<div class="issue">這次老師的話沒有出來，你的稿件內容都在。${d.state === 'self_check_pending' ? '可以直接交給老師看。' : ''}</div>${d.state === 'self_check_pending' ? '<button class="btn" data-act="sendReview">交給老師看</button>' : ''}`
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
  if (u.mode === 'free') {
    if (!(u.freeText || '').trim()) { toast('整段稿不可以空白。', true); return false; }
    r = await call('save_draft_free', { p_case_doc_id: S.docId, p_free_text: u.freeText, p_section_map: keepNonText(), p_base_version_id: u.draftBase || null });
  } else r = await call('save_draft_grid', { p_case_doc_id: S.docId, p_text_by_section: collectDraft(), p_base_version_id: u.draftBase || null });
  if (!r.ok) return false;
  u.draftBase = r.versionId; u.dirty = false; u.sqlIssues = null; await refreshDoc();
  toast(r.unchanged ? '內容沒有變動。' : `已儲存（第 ${r.versionNumber} 版）`); return true;
}
ACT.saveDraft = async (el) => { el.disabled = true; try { S.ui.saving = saveDraft(); await S.ui.saving; } finally { S.ui.saving = null; el.disabled = false; } };   // saving：P、Q「交給老師」要等儲存跑完，避免版本號撞在一起
ACT.selfCheck = async (el) => {
  el.disabled = true;
  try {
    if (S.ui.dirty && !(await saveDraft())) return;
    const r = await call('submit_self_check', { p_case_doc_id: S.docId, p_state_version: S.doc.stateVersion, p_client_request_id: `chk-${S.docId}-${S.doc.stateVersion}` }, { quiet: true });
    if (!r.ok) {
      if (r.error === 'VALIDATION' && Array.isArray(r.detail)) { S.ui.sqlIssues = r.detail; renderDoc(); toast('有欄位還沒填好或超過字數，請看下面的清單。', true); } else toast(errText(r), true);
      return;
    }
    S.ui.sqlIssues = null; await refreshDoc();
    if (r.jobId) await runAi(r.jobId, '老師在看你的稿，通常幾秒鐘…'); else if (r.manualCheck) toast(S.doc && S.doc.aiSwitch === false ? '已交給老師，這一步由老師接手。' : '已交給老師（沒有 AI 處理同意，由老師直接看）。');
  } finally { el.disabled = false; }
};
ACT.sendReview = async () => { const r = await call('submit_for_review', { p_case_doc_id: S.docId, p_state_version: S.doc.stateVersion }); if (r.ok) { await refreshDoc(); toast('已交給老師。'); } };
const DECISION = { return: '退回修改', reopen: '重開問答', finalize: '定稿' }, AUTHOR = { student: '你', teacher: '老師', ai: 'AI 老師' };
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
  if (!r || !r.ok) { toast(r && r.error === 'NOT_FOUND' ? '找不到這一版。' : '這一版現在還打不開（系統還沒更新到這個功能）。', true); return null; }
  return (vu.cache[id] = r.version);
}
const verName = (v) => `第 ${v.versionNumber} 版（${AUTHOR[v.authorType] || v.authorType}，${when(v.createdAt)}）`;
const segHtml = (segs) => segs.map((x) => x.t === '-' ? `<del style="background:#fde2e2;color:#9b1c1c">${esc(x.s)}</del>` : x.t === '+' ? `<ins style="background:#dcfce7;color:#14532d;text-decoration:none">${esc(x.s)}</ins>` : esc(x.s)).join('');
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
    verShow(`<div class="muted small" style="margin-top:10px">左邊是較早的第 ${o.versionNumber} 版、右邊是第 ${n.versionNumber} 版：<del style="background:#fde2e2;color:#9b1c1c">紅底劃線</del>＝後來拿掉的，<ins style="background:#dcfce7;color:#14532d;text-decoration:none">綠底</ins>＝後來加的。</div>
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
// 「我要交的」：首頁資料（me_home 的 docs）＋志願（my_wishlist 的指引：哪幾篇必交／選交）。N、O 每一系共用一份；P、Q 每系各一篇。
const DLV_TYPES = [['N', 'N_diverseSummary'], ['O', 'O_reflection'], ['P', 'P_motivation'], ['Q', 'Q_futurePlan']];
const REQ_TEXT = { must: '必交', opt: '選交', none: '指引沒列' };
async function viewDeliver() {
  setTab('write'); view(loading); const my = S.rt;
  const [h, w] = await Promise.all([call('me_home'), call('my_wishlist')]); if (!h.ok || !w.ok || my !== S.rt) return; S.home = h;
  const docs = h.docs || [], items = (w.items || []).slice().sort((a, b) => (a.rank || 99) - (b.rank || 99));
  const docOf = (type, code) => docs.find((d) => d.nopqType === type && (type === 'N_diverseSummary' || type === 'O_reflection' || d.deptCode === code));
  const row = (letter, d, req) => {
    const st = d ? (DOC_STEP[d.state] || [d.state])[0] : '還沒有這一篇', fin = d && d.state === 'finalized';
    return `<div class="doc-row"><div class="dmain"><b>${esc(DOC_SHORT[letter])}</b> <span class="pill ${req === 'must' ? 'main' : ''}">${esc(REQ_TEXT[req] || '')}</span>
      <div class="muted small">${fin ? '<span class="pill ok">定稿了</span>' : esc(st)}${d && d.freeLen ? '｜' + d.freeLen + ' 字' : ''}</div></div>
      ${d ? `<div class="row">${fin ? `<button type="button" class="btn sm" data-act="dlvCopy" data-id="${esc(d.caseDocId)}">複製全文</button>` : ''}<button type="button" class="btn sm ghost" data-act="openDoc" data-id="${esc(d.caseDocId)}" data-state="${esc(d.state)}">${fin ? '看' : '去寫'}</button></div>` : ''}</div>`;
  };
  const cards = items.map((it) => {
    const has = NG.hasGuide(it), g = has ? it.guide : null;   // 同「要交什麼」頁（guide_pure.js 的 hasGuide／reqState）
    const list = DLV_TYPES.map(([L, type]) => ({ L, d: docOf(type, it.deptCode), req: has ? NG.reqState(g, L) : 'must' })).filter((x) => x.req !== 'none' || x.d && x.d.state === 'finalized');
    const need = list.filter((x) => x.req === 'must'), fin = list.filter((x) => x.d && x.d.state === 'finalized');
    return `<div class="card"><h2 style="margin-top:0">第 ${esc(it.rank)} 志願｜${esc(it.schoolName || '')} ${esc(it.name || '')}</h2>
      <p style="margin:0 0 6px">要交 ${list.length} 篇${need.length !== list.length ? `（必交 ${need.length}）` : ''}，定稿 <b>${fin.length}</b> 篇${fin.length >= need.length && need.length ? '　<span class="pill ok">必交的都定稿了</span>' : ''}。${has ? '' : '<span class="muted small">這系還沒有建指引，先當四篇都要交，以官方分則為準。</span>'}</p>
      ${list.map((x) => row(x.L, x.d, x.req)).join('')}</div>`;
  });
  view(`<div class="card active"><h2>我要交的</h2><p style="margin:0">照你的志願，一系一張：每一系要交哪幾篇、哪幾篇定稿了。N、O 每一系用同一份；P、Q 每系各寫一篇。定稿的可以直接「複製全文」。</p>
    <p class="muted small" style="margin:6px 0 0">${esc(COPY_NOTE)} 排版（PPT、Canva）之後才做。</p></div>
    <div id="deliver-checklist" class="hidden"></div>
    ${cards.join('') || '<div class="card muted">還沒有存志願。先到「落點分析」挑系、存成志願。</div>'}`);
  // ↑ deliver-checklist：留給商業版本設計稿 T2（nopq_biz_versions_design_v0.1.md 16.1 第 8 條）的「定稿前檢查清單」；等楊老師確認原句才填，現在不顯示
}
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
