'use strict';   // 原本整支主程式包在一個函式裡並開嚴格模式；拆檔後每個檔各自開
// ── 第 5 幕：你手上有什麼（丟檔案／貼文字／沒有）──
const MINE_KEY = () => 'ycs-mine-' + (S.uid || 'x');
function mineSave() {
  try { const m = S.mine; localStorage.setItem(MINE_KEY(), JSON.stringify({ q1: m.q1, q2: m.q2, drafts: m.drafts, mats: m.mats })); } catch (e) { /* 存不了不影響流程 */ }
}
function mineInit() {
  let saved = null; try { saved = JSON.parse(localStorage.getItem(MINE_KEY()) || 'null'); } catch (e) { saved = null; }
  saved = saved && typeof saved === 'object' ? saved : {};
  S.mine = { q1: saved.q1 || null, q2: saved.q2 || null, drafts: Array.isArray(saved.drafts) ? saved.drafts : [], mats: Array.isArray(saved.mats) ? saved.mats : [],
    dtype: 'N', text1: '', text2: '', busy: '', msg: '', items: null, forceAsk: false, pick: {}, parseMsg: '' };
}
const curScan = () => ((S.home || {}).journey || {}).scan || null;
const usable = (list) => list.filter((f) => f.len > 0);
const pendingDrafts = () => S.mine.drafts.filter((f) => f.len > 0 && f.type !== 'P' && f.type !== 'Q');   // 現在只有 N、O 兩篇能接稿
const answered = (n) => { const m = S.mine, q = m['q' + n], list = n === 1 ? m.drafts : m.mats; return q === 'none' || usable(list).length > 0; };
function mineStage() {
  const m = S.mine, scan = curScan();
  if (!scan || m.forceAsk) return 'ask';
  if (scan.scanType === 'hasDraft') return pendingDrafts().length ? 'submit' : 'draftDone';
  if (scan.scanType === 'hasMaterial') return 'parse';
  return 'blank';
}
async function restoreFiles(kind) {
  const m = S.mine;
  try {
    const r = await call('my_files', {}, { quiet: true }); if (!r.ok) return;
    const mk = (x) => ({ id: x.id, name: x.fileName, len: x.textLength || 0, hint: '', type: x.nopqType || '' });
    const list = (r.items || []).filter((x) => x.kind === kind && x.textLength > 0 && !x.submittedDocId).map(mk);
    if (kind === 'draft') m.drafts = list; else m.mats = list;
  } catch (e) { /* 沒有這支函式或連不上：就用這台瀏覽器記的 */ }
}
async function viewMine() {
  setTab('mine'); view(loading); const my = S.rt;
  const h = await call('me_home'); if (!h.ok || my !== S.rt) return; S.home = h;
  if (!S.mine) mineInit();
  if (await invLoad() && my === S.rt) { renderMine(); return; }   // 2026-11-08 W3：後端有盤點函式就用盤點頁；沒有（還沒套 28g 第二批）就走下面舊的兩題問答
  if (my !== S.rt) return;
  const scan = (h.journey || {}).scan;
  if (scan && !S.mine.forceAsk) {
    if (scan.scanType === 'hasDraft' && !pendingDrafts().length) await restoreFiles('draft');
    if (scan.scanType === 'hasMaterial' && !S.mine.mats.length) await restoreFiles('portfolio');
    if (my !== S.rt) return;
  }
  if (scan && scan.scanType === 'hasMaterial' && !S.mine.forceAsk) {
    try { const x = await call('my_materials', {}, { quiet: true }); if (x.ok) S.mine.items = x.items || []; } catch (e) { /* 取不到就先不列 */ }
    if (my !== S.rt) return;
  }
  renderMine();
}
function fileRow(f, n, i) {
  const bad = !(f.len > 0);
  return `<div class="file"><span>${bad ? '△' : '✓'} ${esc(f.name)}${f.len > 0 ? `<span class="muted">　讀到約 ${f.len} 字</span>` : ''}${bad ? '<div class="small" style="color:var(--warn)">這個檔案讀不出文字（可能是掃描檔或圖片檔）。請改用「貼文字」，把內容貼上來。</div>' : ''}</span>
    <button type="button" class="btn sm ghost" data-act="rmFile" data-n="${n}" data-i="${i}">移除</button></div>`;
}
function qBlock(n) {
  const m = S.mine, q = m['q' + n], draft = n === 1, list = draft ? m.drafts : m.mats, busy = m.busy === 'q' + n;
  const ask = !LOCAL_SERVER   // 雲端版先不開放丟檔案（見 index.html 的 LOCAL_SERVER）
    ? (draft ? '你已經寫過 N、O、P、Q 任何一篇嗎？有就把文字貼上來（Word、PDF 打開後全選複製就好）。' : '學校學習歷程系統裡，你上傳過課程學習成果或多元表現嗎？有就把內容貼上來。')
    : (draft ? '你已經寫過 N、O、P、Q 任何一篇嗎？有就直接丟上來，Word、PDF、LINE 貼文字都可以。' : '學校學習歷程系統裡，你上傳過課程學習成果或多元表現嗎？有就把匯出的檔案丟上來。');
  const typeSel = draft && (q === 'file' || q === 'text') ? `<label class="f" for="dtype">這是哪一篇？</label><select id="dtype" data-in="dtype">${['N', 'O', 'P', 'Q'].map((k) => `<option value="${k}" ${m.dtype === k ? 'selected' : ''}>${esc(DOC_SHORT[k])}</option>`).join('')}</select>` : '';
  let body = '';
  if (q === 'file' && !LOCAL_SERVER) body = '<div class="muted small">這個版本先不開放丟檔案，請改用「貼文字」。</div>';
  else if (q === 'file') body = `${typeSel}<div class="drop" data-n="${n}"><label class="f" for="file${n}" style="margin-top:0">把檔案拖到這裡，或按下面選檔案（可以一次選幾個；Word、PDF、文字檔都可以）</label><input type="file" id="file${n}" data-in="file" data-n="${n}" multiple accept=".docx,.pdf,.txt,.md" ${busy ? 'disabled' : ''}></div>`;
  else if (q === 'text') body = `${typeSel}<label class="f" for="text${n}">把文字貼在這裡</label><textarea id="text${n}" class="big" data-in="mtext" data-n="${n}" maxlength="60000" placeholder="直接貼上來就好">${esc(m['text' + n])}</textarea>
    <div style="margin-top:6px"><button type="button" class="btn" data-act="saveText" data-n="${n}" ${busy ? 'disabled' : ''}>存下來</button></div>`;
  const btn = (v, t) => `<button type="button" class="btn ${q === v ? 'on' : 'ghost'}" data-act="qpick" data-n="${n}" data-v="${v}">${t}</button>`;
  return `<div class="card ${q ? '' : 'active'}"><p style="margin:0 0 6px"><b>${esc(ask)}</b></p>
    <div class="choice">${LOCAL_SERVER ? btn('file', '丟檔案') : ''}${btn('text', '貼文字')}${btn('none', '沒有')}</div>
    ${body}${busy ? `<div class="hint"><span class="spin"></span>${esc(m.msg || '處理中…')}</div>` : ''}
    ${list.length && q !== 'none' ? `<div style="margin-top:8px">${list.map((f, i) => fileRow(f, n, i)).join('')}</div>` : ''}</div>`;
}
function askFoot() {
  const m = S.mine, ready = answered(1) && answered(2);
  return `<div class="card">${ready ? '' : '<p class="muted" style="margin:0 0 8px">兩個問題都回答（丟上來，或選「沒有」），才能往下。</p>'}<button type="button" class="btn" data-act="scan" ${ready && !m.busy ? '' : 'disabled'}>好了，往下</button></div>`;
}
const draftTargets = () => ((S.home || {}).docs || []).filter((d) => ['warmup', 'interviewing', 'draft_open'].includes(d.state) && (d.nopqType === 'N_diverseSummary' || d.nopqType === 'O_reflection'));
function pickedDoc(i) {
  const m = S.mine, docs = draftTargets(), f = m.drafts[i] || {};
  if (m.pick[i] && docs.some((d) => d.caseDocId === m.pick[i])) return m.pick[i];
  const hit = docs.find((d) => d.nopqType === DOC_TYPE_OF[f.type]);
  return (hit || docs[0] || {}).caseDocId || '';
}
function submitBlock() {
  const m = S.mine, docs = draftTargets();
  return `<div class="card active"><h2>把稿交給老師</h2><p style="margin:0 0 6px">你丟上來的稿，老師會直接改。選好是哪一篇：</p>`
    + m.drafts.map((f, i) => (f.type === 'P' || f.type === 'Q' || !(f.len > 0)) ? `<div class="pt"><b>${esc(f.name)}</b> <div class="muted small">${f.len > 0 ? '這份是 ' + esc(f.type) + ' 的稿，先收著，寫到那一篇再交給老師。' : '這個檔案沒有讀到文字，交不出去。請回上一步改用「貼文字」。'}</div></div>` : `<div class="pt"><b>${esc(f.name)}</b> <span class="muted small">約 ${f.len} 字</span>
      <select data-in="dpick" data-i="${i}" aria-label="這份稿是哪一篇" style="margin-top:6px">${docs.map((d) => `<option value="${esc(d.caseDocId)}" ${pickedDoc(i) === d.caseDocId ? 'selected' : ''}>${esc(docTitle(d))}</option>`).join('')}</select>
      <div style="margin-top:8px"><button type="button" class="btn" data-act="subDraft" data-i="${i}" ${docs.length ? '' : 'disabled'}>交給老師</button></div></div>`).join('')
    + (docs.length ? '' : '<div class="hint">現在沒有可以接這份稿的文件。請聯絡育才仕。</div>') + '</div>';
}
const matRow = (it) => `<div class="pt"><b>${esc(it.title)}</b> <span class="muted small">${esc(it.when || '')}</span><div>${esc(it.what || '')}</div>${it.result ? `<div class="muted small">結果：${esc(it.result)}</div>` : ''}</div>`;
// 盤點寫有學習歷程、但實際一個檔案也沒有（示範資料的舊盤點就是這樣）：不給灰掉的「請老師讀一下」，直接請他回去丟
const noMatFiles = () => { const m = S.mine; return mineStage() === 'parse' && m.busy !== 'parse' && !(m.items || []).length && !m.mats.length; };
function parseBlock() {
  const m = S.mine, items = m.items || [];
  if (m.busy === 'parse') return '<div class="card active"><h2>正在讀你的檔案</h2><div class="hint"><span class="spin"></span>通常幾秒鐘…</div></div>';
  if (noMatFiles()) return '<div class="card active"><h2>還沒收到你的檔案</h2><p style="margin:0 0 10px">你說學習歷程有東西，但還沒丟上來。回去貼文字或丟檔案就好。</p><button type="button" class="btn" data-act="mineReset">回去丟</button></div>';
  if (items.length) return `<div class="card active"><h2>整理出 ${items.length} 件事</h2><p class="muted" style="margin:0 0 6px">這是系統從你的檔案裡整理出來的，老師還沒逐字看過。接下來會從這些事問起。</p>${items.map(matRow).join('')}<div style="margin-top:12px"><a class="btn" href="#/write">往下，開始寫</a></div></div>`;
  if (S.aiOn === false) return `<div class="card active"><h2>檔案收到了</h2><p style="margin:0 0 8px">老師會直接看你的檔案，找出你做過的事。你可以先往下寫。</p><a class="btn" href="#/write">往下寫</a></div>`;   // 28l：沒開 AI
  return `<div class="card active"><h2>檔案還沒整理</h2><p style="margin:0 0 8px">${esc(m.parseMsg || '你丟了學習歷程的檔案，按下面的按鈕整理一下，找出你做過的事。')}</p>
    <div class="row"><button type="button" class="btn" data-act="runParse" ${m.mats.length ? '' : 'disabled'}>整理我的檔案</button><a class="btn ghost" href="#/write">先不用，往下寫</a></div></div>`;
}
function lessonsCard() {
  const ls = (S.home || {}).lessons || []; if (!ls.length) return '';
  return `<details class="card"><summary>老師排的課（${ls.length}）</summary>${ls.map((l) => { const url = safeUrl(l.externalUrl);
    return `<div class="doc-row"><div class="dmain"><b>${esc(l.title)}</b> <span class="pill">${esc(FMT[l.format] || l.format || '')}</span><div class="muted small">${esc(when(l.scheduledAt))}</div>${url ? `<div class="small"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">老師的連結</a></div>` : ''}</div></div>`; }).join('')}</details>`;
}
function renderMine() {
  if (location.hash !== '#/mine' || !S.mine) return;
  if (S.mine.inv) { const y0 = window.scrollY; view(invHtml()); window.scrollTo(0, y0); return; }   // 11-13 第 35 條：「老師排的課」移進 invHtml，放在 N、O、P、Q 自述那一區前面
  const st = mineStage(); let html;
  if (st === 'ask') html = `<div class="card"><h2>你手上有什麼？</h2></div>${qBlock(1)}${qBlock(2)}${askFoot()}`;
  else if (st === 'submit') html = submitBlock();
  else if (st === 'draftDone') html = '<div class="card active"><h2>稿交給老師了</h2><p style="margin:0 0 10px">去「撰寫NOPQ」看老師的話。</p><a class="btn" href="#/write">去看</a></div>';
  else if (st === 'blank') html = '<div class="card active"><h2>好，我們從聊開始</h2><p style="margin:0 0 10px">會先問你做過的事，你想到什麼說什麼。</p><a class="btn" href="#/write">開始</a></div>';
  else html = parseBlock();
  if (st !== 'ask' && !noMatFiles()) html += '<div class="card"><button type="button" class="btn ghost sm" data-act="mineReset">重新回答這兩個問題</button></div>';   // 「還沒收到檔案」那張卡自己就有回去丟的鈕，不再多放一顆
  html += lessonsCard();
  const y = window.scrollY; view(html); window.scrollTo(0, y);
}
ACT.qpick = (el) => {
  const m = S.mine, n = +el.dataset.n, v = el.dataset.v;
  m['q' + n] = v; if (v === 'none') { if (n === 1) m.drafts = []; else m.mats = []; }
  mineSave(); renderMine();
};
IN.dtype = (el) => { S.mine.dtype = el.value; };
IN.mtext = (el) => { S.mine['text' + el.dataset.n] = el.value; };
IN.dpick = (el) => { S.mine.pick[+el.dataset.i] = el.value; };
ACT.rmFile = (el) => { const m = S.mine, n = +el.dataset.n; (n === 1 ? m.drafts : m.mats).splice(+el.dataset.i, 1); mineSave(); renderMine(); };
async function uploadFile(file, kind, nopqType) {
  const ss = await sb.auth.getSession(), tk = ss.data && ss.data.session && ss.data.session.access_token;
  if (!tk) { await toLogin('登入已過期，請重新登入。'); throw new Error('AUTH'); }
  let res, j = null;
  try {
    res = await fetch('/upload', { method: 'POST', headers: { authorization: 'Bearer ' + tk, 'x-kind': kind, 'x-nopq-type': nopqType || '', 'x-file-name': encodeURIComponent(file.name), 'content-type': file.type || 'application/octet-stream' }, body: file });
    j = await res.json().catch(() => null);
  } catch (e) { return { ok: false, error: 'NET' }; }
  if (res.status === 401) { await toLogin('登入已過期，請重新登入。'); throw new Error('AUTH'); }
  if (!j) return { ok: false, error: res.status === 404 ? 'NO_UPLOAD' : 'NET' };
  return j;
}
const UP_ERR = { NET: '傳不上去，請稍後再試。', NO_UPLOAD: '這裡目前還不能丟檔案，請改用「貼文字」。' };
IN.file = (el) => uploadMany(+el.dataset.n, Array.from(el.files || []));
const dropZone = (ev) => (ev.target && ev.target.closest ? ev.target.closest('.drop') : null);
document.addEventListener('dragover', (ev) => { const z = dropZone(ev); if (z) { ev.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', (ev) => { const z = dropZone(ev); if (z) z.classList.remove('over'); });
document.addEventListener('drop', (ev) => {
  const z = dropZone(ev); if (!z) return; ev.preventDefault(); z.classList.remove('over');
  if (ev.dataTransfer && ev.dataTransfer.files.length && !S.mine.busy) uploadMany(+z.dataset.n, Array.from(ev.dataTransfer.files)).catch((e) => { if (!KNOWN.has(e.message)) toast('傳不上去，請稍後再試。', true); });
});
async function uploadMany(n, files) {
  if (!files.length) return;
  const m = S.mine, draft = n === 1, type = draft ? m.dtype : '';
  for (const f of files) {
    if (f.size > 50 * 1024 * 1024) { toast(f.name + ' 超過 50 MB，傳不上去。', true); continue; }
    m.busy = 'q' + n; m.msg = '傳上去中：' + f.name; renderMine();
    const r = await uploadFile(f, draft ? 'draft' : 'portfolio', type);
    if (r.ok) (draft ? m.drafts : m.mats).push({ id: r.fileAssetId, name: f.name, len: r.textLength || 0, hint: r.hint || '', type });
    else toast(UP_ERR[r.error] || errText(r), true);
  }
  m.busy = ''; m.msg = ''; mineSave(); renderMine();
};
ACT.saveText = async (el) => {
  const m = S.mine, n = +el.dataset.n, draft = n === 1, text = (m['text' + n] || '').trim();
  if (!text) { toast('先貼一點文字再存。', true); return; }
  m.busy = 'q' + n; m.msg = '存起來中…'; renderMine();
  let r;
  try {
    r = await call('upload_register', { p_kind: draft ? 'draft' : 'portfolio', p_nopq_type: draft ? m.dtype : null, p_file_name: 'pasted.txt', p_mime: 'text/plain',
      p_size: new Blob([text]).size, p_storage_key: `${S.uid}/pasted/${Date.now()}.txt`, p_text: text });
  } catch (e) { r = { ok: false }; }
  m.busy = ''; m.msg = '';
  if (r.ok) { const list = draft ? m.drafts : m.mats; list.push({ id: r.fileAssetId, name: `貼上的文字 ${list.length + 1}`, len: r.textLength || nlen(text), hint: '', type: draft ? m.dtype : '' }); m['text' + n] = ''; toast('存好了。'); }
  mineSave(); renderMine();
};
ACT.scan = async (el) => {
  const m = S.mine; el.disabled = true;
  const dr = m.q1 === 'none' ? [] : usable(m.drafts), pf = m.q2 === 'none' ? [] : usable(m.mats);
  const r = await call('start_scan', { p_answers: { hasDraft: dr.length > 0, hasMaterial: pf.length > 0, draftFileIds: dr.map((f) => f.id), portfolioFileIds: pf.map((f) => f.id) } });
  if (!r.ok) { el.disabled = false; return; }
  m.drafts = dr; m.mats = pf; m.forceAsk = false; m.items = null; m.parseMsg = ''; m.pick = {}; mineSave();
  const h = await call('me_home', {}, { quiet: true }); if (h.ok) S.home = h;
  if (S.home) S.home.journey = Object.assign({}, S.home.journey || {}, { scan: (S.home.journey || {}).scan || { scanType: r.scanType, nextStep: r.nextStep } });
  if (r.scanType === 'blank') { location.hash = '#/write'; return; }
  renderMine();
  if (r.scanType === 'hasMaterial') runParse();
};
ACT.mineReset = () => { const m = S.mine; m.forceAsk = true; m.q1 = null; m.q2 = null; m.drafts = []; m.mats = []; m.items = null; m.parseMsg = ''; mineSave(); renderMine(); };
ACT.subDraft = async (el) => {
  const m = S.mine, i = +el.dataset.i, f = m.drafts[i], docId = pickedDoc(i); if (!f || !docId) return;
  el.disabled = true;
  const r = await call('submit_uploaded_draft', { p_case_doc_id: docId, p_file_asset_id: f.id });
  if (!r.ok) { el.disabled = false; return; }
  m.drafts.splice(i, 1); mineSave(); toast('稿交給老師了。'); location.hash = '#/doc/' + docId;
};
// 有料：請老師（AI）把上傳的學習歷程檔案拆成一件一件的事。parse_material 開任務，再叫 nopq-ai 去跑，最後讀 my_materials
async function runParse() {
  const m = S.mine; if (m.busy) return;
  m.busy = 'parse'; m.parseMsg = ''; renderMine();
  let fail = '';
  for (const f of m.mats) {
    try {
      const r = await call('parse_material', { p_file_asset_id: f.id }, { quiet: true });
      if (!r.ok) { fail = r.error === 'AI_OFF' ? '這一步由老師來做：老師會直接看你的檔案，你可以先往下寫。' : r.error === 'AI_CONSENT_MISSING' || r.error === 'QUOTA_EXCEEDED' ? errText(r) + '你可以直接往下，老師會看你的檔案。' : errText(r); if (r.error === 'AI_OFF') { S.aiOn = false; break; } continue; }
      // 2026-11-22 AI 改排隊：不再叫 nopq-ai、不再一個檔等一個檔；全部送出後一起等，工作由資料庫派給背景工作者，結果看 my_materials
    } catch (e) { fail = '連線失敗，稍後再試。'; }
  }
  let items = [];
  for (let i = 0; i < 20; i++) {   // 每 3 秒看一次，最多約 60 秒
    try { const x = await call('my_materials', {}, { quiet: true }); if (x.ok) { items = x.items || []; if (items.length) break; } } catch (e) { break; }
    if (fail) break;
    await sleep(3000);
  }
  m.busy = ''; m.items = items; m.parseMsg = items.length ? '' : (fail || '還沒整理出東西，等一下再回來看，或直接往下寫，會先從問答開始。');
  renderMine();
}
ACT.runParse = () => runParse();

// ══ 2026-11-08 owner 試用回饋 #2（架構稿 W3）：「我的東西」＝盤點學習歷程，四類逐類看：上傳已有的、在這裡補寫、交給老師看 ══
// 後端（28g §6）：my_inventory、set_inventory_item、submit_material_review。沒有這幾支時 invLoad 回 false，頁面退回舊的兩題問答。
const INV_KINDS = [
  { k: 'courseRecord', name: '修課紀錄', tip: '成績單、學校系統的修課紀錄（截圖或 PDF），高一、高二的也放進來。老師參考用。', write: false, review: false },
  { k: 'courseResult', name: '課程學習成果', tip: '課堂報告、實作、作品。學校系統裡有的、以前做的都可以放進來；還沒放上去的，可以在這裡補寫。寫好可以交給老師看。', write: true, review: true },
  { k: 'diverse', name: '多元表現', tip: '社團、競賽、志工、檢定、自主學習。以前的紀錄也可以放進來，或在這裡補寫；寫好交給老師看。', write: true, review: true },
  { k: 'statement', name: '學習歷程自述（N、O、P、Q）', tip: '已經寫好的 N、O、P、Q 稿上傳在這裡，再交給老師改；還沒寫的到「撰寫NOPQ」那一頁寫。', write: false, review: false },
];
const INV_NAME = Object.fromEntries(INV_KINDS.map((x) => [x.k, x.name]));
const REV_TEXT = { pending: '等老師看', replied: '老師回了', needMore: '老師請你補一下', withdrawn: '你收回了' };
function invNorm(r) {   // 後端回傳可能是 items 陣列（每筆帶 kind）或依類別分組；這裡一律整理成 {類別: [項目]}，沒分類的放 '_none'
  const out = { _none: [] }; INV_KINDS.forEach((x) => { out[x.k] = []; });
  const one = (it) => {
    const rv = it.review || it.lastReview || null;
    return { id: it.id || it.fileAssetId, name: it.title || it.fileName || '（沒有標題）', fileName: it.fileName || '', kind: it.kind || it.inventoryKind || null, self: !!(it.selfWritten),
      preview: it.preview || it.textPreview || it.text || '', type: it.nopqType || '', at: it.createdAt || '', canSubmit: it.canSubmit,
      canEdit: it.canEdit, canHide: it.canHide, canWithdraw: it.canWithdraw, submittedDocId: it.submittedDocId || null, replaces: it.replaces || null,
      code: it.itemCode || null, codeBy: it.itemCodeBy || null,   // 11-21 第三步（28v）：代碼（空＝還沒標代碼）、誰標的   // 28m（沒有＝undefined，新按鈕不出現）
      edited: it.editedAfterSubmit,   // 28o（11-13 第 34 條）：交給老師後又改過；沒有 28o＝undefined，等老師看時照舊只能收回
      rv: rv ? { status: rv.status, note: rv.teacherNote || rv.note || '', round: rv.round } : it.reviewStatus ? { status: it.reviewStatus, note: it.teacherNote || '', round: it.reviewRound } : null };
  };
  const push = (it) => { const x = one(it); (out[x.kind] || out._none).push(x); };
  if (Array.isArray(r.items)) r.items.forEach(push);
  if (r.kinds && typeof r.kinds === 'object') Object.keys(r.kinds).forEach((k) => (r.kinds[k] || []).forEach((it) => push(Object.assign({ kind: k }, it))));
  INV_KINDS.forEach((x) => { if (Array.isArray(r[x.k])) r[x.k].forEach((it) => push(Object.assign({ kind: x.k }, it))); });
  (r.unclassified || r.uncategorized || []).forEach((it) => push(Object.assign({}, it, { kind: null })));   // 28g §6 my_inventory 用 unclassified
  return out;
}
async function invLoad() {
  try {
    const r = await call('my_inventory', {}, { quiet: true }); if (!r || !r.ok) { S.mine.inv = null; return false; } S.mine.inv = invNorm(r); S.mine.invHidden = Array.isArray(r.hidden) ? r.hidden : null;
    // 11-21 第三步（28v）：有官方項目表才換成畫面①的兩塊；沒有（後端還沒套 28v）照舊畫原本的版面
    S.mine.official = r.official || null; S.mine.hasTeacher = !!r.hasTeacher; S.mine.teacherName = r.teacherName || '';
    if (S.mine.official) { const w = await call('my_wishlist', {}, { quiet: true }).catch(() => null); S.mine.wish = w && w.ok ? w : null; } else S.mine.wish = null;
    return true;
  }
  catch (e) { if (e && e.message === 'NET') throw e; S.mine.inv = null; return false; }   // 2026-11-12：連線失敗／等太久不退回舊的兩題問答，交給 guard 出重新載入鈕
}
// 2026-11-20（28t）：各系自訂的寫作（X）不收上傳的現成稿（後端 submit_uploaded_draft 刻意不收），所以不列進「交給老師改」的選單
const invDocs = (type) => ((S.home || {}).docs || []).filter((d) => ['warmup', 'interviewing', 'draft_open'].includes(d.state) && (!type || d.nopqType === DOC_TYPE_OF[type]) && d.inWishlist !== false && d.nopqType !== 'X_extraWriting');
// 2026-11-12 楊老師試用回饋 階段 1①（D4、D5）：每一筆可以改（標題、文字）、換一份、收起來（不真刪，最下面「收起來的」拿得回來）；
// 交給老師之後、老師還沒回之前不能改、不能收起，但可以「收回」；老師回了之後可以改，改完再交＝新的一輪。後端沒有 28m（清單沒有 canEdit）就不出這幾顆。
const REV_HINT = { pending: '等老師看的時候不能改、不能收起；要改先按「收回」。', needMore: '老師請你補一下：按「改」補好，再按「補好了，再交給老師看」（算新的一輪）。',
  replied: '老師回過了，還想改可以按「改」，改完再交給老師看算新的一輪。', withdrawn: '你收回了，可以改，改好再交給老師看（算新的一輪）。' };
// 2026-11-13 第 34 條（USER 原話「歷史性的紀錄，沒有可以編輯跟上傳修改的地方，這個地方要改」）：後端有 28o 時，等老師看的那一份也能改、換一份（上傳新的檔或貼上新的），
// 改了老師那邊看得到「學生交出後又改過」；收起來仍要先收回（不能把老師正在看的那一份藏起來）。這一條取代 11-12 照 D4 預設做的「等老師看時只能收回」。
const REV_HINT_O = { pending: '交給老師之後也可以改、換一份；改了老師那邊會看到「交出後又改過」，不用再交一次。不想給老師看了，按「收回」。' };
const srcName = (it) => (it.self ? '在這裡補寫' : it.fileName === 'pasted.txt' ? '貼上的' : '上傳的檔');
// 這一份到哪一步（總清單與每一筆共用）：[字, pill 樣式]
function invStep(it, kd) {
  if (it.submittedDocId) return ['已交進撰寫NOPQ', 'ok'];
  const rv = it.rv; if (rv) return [REV_TEXT[rv.status] || rv.status, rv.status === 'needMore' ? 'warn' : rv.status === 'replied' ? 'ok' : rv.status === 'pending' ? 'main' : ''];
  return kd.review ? ['還沒交老師看', ''] : ['放進來了', ''];
}
function invItem(it, kd) {
  const m = invMine(), rv = it.rv, canRev = kd.review && !(rv && rv.status === 'pending') && it.canSubmit !== false, has28m = it.canEdit !== undefined, has28o = it.edited !== undefined;
  const docs = kd.k === 'statement' ? invDocs(it.type) : [];
  const ed = m.invEdit && m.invEdit.id === it.id ? m.invEdit : null, sw = m.invSwap && m.invSwap.id === it.id ? m.invSwap : null;
  const canSwap = it.canHide || (has28o && it.canWithdraw), step = invStep(it, kd);
  const acts = has28m ? `<div class="row" style="margin-top:6px"><button type="button" class="btn sm ${rv && rv.status === 'pending' && has28o ? '' : 'ghost'}" data-act="invEdit" data-id="${esc(it.id)}">${it.canEdit || it.submittedDocId ? '改' : '看全文'}</button>
      ${canSwap ? `<button type="button" class="btn sm ghost" data-act="invSwapOpen" data-id="${esc(it.id)}">換一份</button>` : ''}${it.canHide ? `<button type="button" class="btn sm ghost" data-act="invHide" data-id="${esc(it.id)}">收起來</button>` : ''}
      ${it.canWithdraw ? `<button type="button" class="btn sm warn" data-act="invWithdraw" data-id="${esc(it.id)}">收回</button>` : ''}</div>` : '';
  const hint = has28m ? (it.submittedDocId && !it.canWithdraw ? '這份稿已經交進「撰寫NOPQ」的那一篇，內容請到「撰寫NOPQ」改那一篇；這裡可以改標題、換一份或收起來。' : rv ? (has28o && REV_HINT_O[rv.status]) || REV_HINT[rv.status] || '' : '') : '';
  const prev = String(it.preview || '');
  return `<div class="pt invitem" id="inv-it-${esc(it.id)}"><div class="row spread"><b>${esc(it.name)}</b><span><span class="pill ${step[1]}">${esc(step[0])}</span>${it.edited ? '<span class="pill warn">交出後又改過</span>' : ''}</span></div>
    <div class="muted small">${esc(srcName(it))}${it.type ? '｜' + esc(it.type) : ''}${it.at ? '｜' + esc(mdOf(it.at)) + ' 放進來' : ''}</div>
    ${prev ? `<div class="small invsumm"><span class="muted">摘要：</span>${esc(prev.replace(/\s+/g, ' ').slice(0, 120))}${prev.length > 120 ? '…' : ''}</div>` : '<div class="small" style="color:var(--warn)">這份沒有讀到文字（可能是掃描檔或圖片），老師看得到檔案，但系統讀不到內容。</div>'}
    ${it.replaces ? '<div class="muted small">這份是換上來的新的一份（舊的在最下面「收起來的」）。</div>' : ''}
    ${rv && rv.note ? `<div class="cm">老師：${esc(rv.note)}</div>` : ''}${hint ? `<div class="muted small" style="margin-top:4px">${esc(hint)}</div>` : ''}
    ${acts}${ed ? invEditHtml(it, ed) : ''}${sw ? invSwapHtml(it, kd, sw) : ''}
    ${canRev ? `<div style="margin-top:6px"><button type="button" class="btn sm ${rv && rv.status === 'needMore' ? '' : 'ghost'}" data-act="invReview" data-id="${esc(it.id)}">${rv && rv.status === 'needMore' ? '補好了，再交給老師看' : rv && rv.status === 'withdrawn' ? '再交給老師看' : '交給老師看'}</button></div>` : ''}
    ${kd.k === 'statement' ? (docs.length ? `<div class="row" style="margin-top:6px"><select data-in="invDoc" data-id="${esc(it.id)}" aria-label="這份稿是哪一篇">${docs.map((d) => `<option value="${esc(d.caseDocId)}" ${S.mine.invPick[it.id] === d.caseDocId ? 'selected' : ''}>${esc(docTitle(d))}</option>`).join('')}</select><button type="button" class="btn sm" data-act="invSubmitDraft" data-id="${esc(it.id)}">交給老師改</button></div>` : '<div class="muted small" style="margin-top:6px">現在沒有可以接這份稿的那一篇（可能已經交了或定稿了），到「撰寫NOPQ」看看。</div>') : ''}</div>`;
}
function invKindCard(kd) {
  const m = S.mine, list = m.inv[kd.k] || [], open = m.invWrite === kd.k, busy = m.busy === 'inv:' + kd.k;
  // 2026-11-12 階段 1（D3）：四類都能「貼上文字」（雲端沒有丟檔案，原本修課紀錄、學習歷程自述完全放不進東西）；貼的框底下有「用檔案帶入（Word、PDF、文字檔）」
  const typeSel = kd.k === 'statement' && (LOCAL_SERVER || open) ? `<label class="f" for="inv-type">${open ? '貼的' : '上傳的'}是哪一篇？</label><select id="inv-type" data-in="invType">${['N', 'O', 'P', 'Q'].map((k) => `<option value="${k}" ${m.invType === k ? 'selected' : ''}>${esc(DOC_SHORT[k])}</option>`).join('')}</select>` : '';
  const pasteName = kd.write ? '在這裡補寫' : '貼上文字';
  return `<div class="card" id="inv-${kd.k}"><h2>${esc(kd.name)}（${list.length}）</h2>${list.length ? `<p class="invline">${esc(kindLine(kd, list))}</p>` : ''}<p class="muted small" style="margin:0 0 6px">${esc(kd.tip)}</p>
    ${list.map((it) => invItem(it, kd)).join('') || '<div class="muted small">還沒有。</div>'}
    ${typeSel}<div class="row" style="margin-top:8px">${LOCAL_SERVER ? `<label class="btn ghost sm" style="cursor:pointer">上傳檔案<input type="file" data-in="invFile" data-k="${kd.k}" multiple accept=".docx,.pdf,.txt,.md" style="display:none" ${busy ? 'disabled' : ''}></label>` : ''}
      <button type="button" class="btn ghost sm" data-act="invWriteToggle" data-k="${kd.k}">${open ? '收起' + pasteName : pasteName}</button>
      ${kd.k === 'statement' ? '<a class="btn ghost sm" href="#/write">還沒寫：到「撰寫NOPQ」</a>' : ''}</div>
    ${open ? `<label class="f" for="inv-title-${kd.k}">一句話標題</label><input type="text" id="inv-title-${kd.k}" data-in="invTitle" data-k="${kd.k}" maxlength="60" value="${esc(m.invTitle[kd.k] || '')}" placeholder="${kd.k === 'statement' ? '例：N 第一次寫的稿（高三上）' : kd.k === 'courseRecord' ? '例：高一到高二上修課紀錄' : '例：高二上 物理專題：水火箭'}">
      <label class="f" for="inv-text-${kd.k}">內容</label><textarea id="inv-text-${kd.k}" class="big" data-in="invText" data-k="${kd.k}" maxlength="20000" placeholder="${kd.write ? '做了什麼、怎麼做、結果怎樣、學到什麼' : '把文字貼上來，或按下面「用檔案帶入」'}">${esc(m.invText[kd.k] || '')}</textarea>
      <div style="margin-top:6px"><button type="button" class="btn" data-act="invSaveText" data-k="${kd.k}">存下來</button></div>` : ''}
    ${busy ? `<div class="hint"><span class="spin"></span>${esc(m.msg || '處理中…')}</div>` : ''}</div>`;
}
// 2026-11-13 第 33 條（USER 原話「你要有個總清單去盤點確認一下目前的狀況」「每一個項目都要有個列表與摘要。比如說，多元表現摘要。然後歷史的可以丟進去，以及修改存檔」）：
// 最上面一張總清單（每一類幾筆、各到哪一步、最近放進來的日期，點了跳到那一類）；每一類標題下一行這一類的摘要，每一筆有到哪一步、日期、摘要。
function kindLine(kd, list) {
  const src = {}, st = {};
  list.forEach((it) => { const s = srcName(it); src[s] = (src[s] || 0) + 1; const t = invStep(it, kd)[0]; st[t] = (st[t] || 0) + 1; });
  const j = (o) => Object.keys(o).map((k) => k + ' ' + o[k]).join('、');
  const last = list.reduce((a, it) => (it.at && (!a || it.at > a) ? it.at : a), '');
  return `共 ${list.length} 筆：${j(src)}｜${j(st)}${last ? '｜最近放進來 ' + mdOf(last) : ''}`;
}
function invSumHtml() {
  const m = S.mine, inv = m.inv, none = inv._none || [], hid = m.invHidden || [];
  const row = (kd) => {
    const list = inv[kd.k] || [], st = {};
    list.forEach((it) => { const s = invStep(it, kd); st[s[0]] = st[s[0]] || [0, s[1]]; st[s[0]][0]++; });
    const edited = list.filter((it) => it.edited).length;
    return `<button type="button" class="invsum" data-act="invJump" data-k="${kd.k}"><span class="k">${esc(kd.name)}</span><span class="n">${list.length} 筆</span>
      <span class="st">${list.length ? Object.keys(st).map((t) => `<span class="pill ${st[t][1]}">${esc(t)} ${st[t][0]}</span>`).join('') + (edited ? `<span class="pill warn">交出後又改過 ${edited}</span>` : '') : '<span class="muted small">還沒有</span>'}</span></button>`;
  };
  const total = INV_KINDS.reduce((a, kd) => a + (inv[kd.k] || []).length, 0);
  return `<div class="card active"><h2>我的學習歷程</h2><p style="margin:0 0 8px">這裡列出你放進來的所有資料。共 ${total} 份${none.length ? `，另有 ${none.length} 份還沒分類` : ''}${hid.length ? `，收起來的 ${hid.length} 份` : ''}。點一類跳過去看。</p>
    <div class="invsums">${INV_KINDS.map(row).join('')}</div>
    <p class="muted small" style="margin:8px 0 0">高一、高二的作品、紀錄、寫過的稿都可以放進來。放進來的每一份都可以按「改」，交給老師之後也能改。課程學習成果和多元表現寫好後，可以交給老師看。N、O、P、Q 的稿在最下面交給老師改。</p></div>`;
}
ACT.invJump = (el) => { const c = $('inv-' + el.dataset.k); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
function invHtml() { return S.mine.official ? invHtml3() : invHtmlOld(); }   // 11-21 第三步：後端有 28v 才換新版面
function invHtmlOld() {
  const m = S.mine, inv = m.inv, none = inv._none || [];
  const nMat = (inv.courseResult || []).length + (inv.diverse || []).length, nSt = (inv.statement || []).length;
  // 11-13 第 35 條（USER 原話「NOPQ集中到最後面」）：N、O、P、Q 自述那一區排到這一頁最後面（後面只剩收起來的與「盤點好了」）
  return scanResultCard12() + invSumHtml()
    + INV_KINDS.filter((kd) => kd.k !== 'statement').map(invKindCard).join('')
    + (none.length ? `<div class="card"><h2>還沒分類的（${none.length}）</h2><p class="muted small" style="margin:0 0 6px">之前上傳的檔，選一下是哪一類。</p>${none.map((it) => `<div class="doc-row"><span class="dmain">${esc(it.name)}</span><select data-in="invKind" data-id="${esc(it.id)}" aria-label="這份是哪一類"><option value="">選類別</option>${INV_KINDS.map((x) => `<option value="${x.k}">${esc(x.name)}</option>`).join('')}</select></div>`).join('')}</div>` : '')
    + (m.items && m.items.length ? `<div class="card"><h2>從你的檔案整理出 ${m.items.length} 件事</h2><p class="muted small" style="margin:0 0 6px">系統整理的，老師還沒逐字看過。</p>${m.items.map(matRow).join('')}</div>` : '')
    + lessonsCard()
    + INV_KINDS.filter((kd) => kd.k === 'statement').map(invKindCard).join('')
    + invHiddenHtml()
    + invFoot12();   // 2026-11-24 A13 W12-15：〔讀我的檔案〕併進〔盤點好了〕，見 invFoot12
}
const invMine = () => { const m = S.mine; m.invTitle = m.invTitle || {}; m.invText = m.invText || {}; m.invPick = m.invPick || {}; m.invType = m.invType || 'N'; return m; };
// ── 2026-11-12 階段 1①：改、換一份、收起來、收回、拿回來（28m）──
const RV_ROUND = { pending: '等老師看', replied: '老師回了', needMore: '老師請你補', withdrawn: '你收回了' };
function invEditHtml(it, ed) {
  if (ed.loading) return '<div class="hint" style="margin-top:8px"><span class="spin"></span>讀全文中…</div>';
  const canText = ed.item.canEdit, canTitle = ed.item.canEdit || ed.item.submittedDocId;
  const rounds = (ed.item.reviews || []).map((r) => `<div class="small">第 ${r.round} 輪｜${esc(mdOf(r.createdAt))} 交給老師｜${esc(RV_ROUND[r.status] || r.status)}${r.teacherNote ? '｜老師：' + esc(r.teacherNote) : ''}</div>`).join('');
  return `<div class="hint" style="margin-top:8px">
    ${canTitle ? `<label class="f" for="ie-title-${esc(it.id)}" style="margin-top:0">標題</label><input type="text" id="ie-title-${esc(it.id)}" data-in="invEditTitle" maxlength="100" value="${esc(ed.title)}">` : `<b>${esc(ed.title || it.name)}</b>`}
    ${canText ? `<label class="f" for="ie-text-${esc(it.id)}">內容${it.self ? '' : '（老師看到的是這裡的字；原本的檔案不會跟著改）'}</label><textarea id="ie-text-${esc(it.id)}" class="big" data-in="invEditText" data-id="${esc(it.id)}" maxlength="60000">${esc(ed.text)}</textarea>`
      : `<div class="cell" style="margin-top:6px"><div class="ro" style="white-space:pre-wrap">${esc(ed.text) || '（沒有讀到文字）'}</div></div>`}
    <div class="row" style="margin-top:8px">${canTitle ? '<button type="button" class="btn sm" data-act="invEditSave">存下來</button>' : ''}<button type="button" class="btn sm ghost" data-act="invEditCancel">${canTitle ? '取消' : '收起'}</button></div>
    ${rounds ? `<div style="margin-top:8px"><div class="muted small">交給老師的紀錄</div>${rounds}</div>` : ''}</div>`;
}
function invSwapHtml(it, kd, sw) {
  return `<div class="hint" style="margin-top:8px"><b>換一份</b>：新的一份會沿用這一份的類別和標題。舊的會收到最下面「收起來的」，老師的紀錄也還在。
    <label class="f" for="is-text-${esc(it.id)}">新的內容</label><textarea id="is-text-${esc(it.id)}" class="big" data-in="invNewText" data-id="${esc(it.id)}" maxlength="60000" placeholder="把新的內容貼上來，或按下面「用檔案帶入」">${esc(sw.text || '')}</textarea>
    <div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-act="invSwapSave">換成這一份</button>
      ${LOCAL_SERVER ? `<label class="btn sm ghost" style="cursor:pointer">改成上傳一個檔案<input type="file" data-in="invSwapFile" accept=".docx,.pdf,.txt,.md" style="display:none"></label>` : ''}
      <button type="button" class="btn sm ghost" data-act="invSwapCancel">取消</button></div></div>`;
}
function invHiddenHtml() {
  const m = S.mine, hid = m.invHidden; if (!hid || !hid.length) return '';
  return `<details class="card" id="inv-hidden" ${m.invShowHidden ? 'open' : ''}><summary>收起來的（${hid.length}）</summary><p class="muted small" style="margin:6px 0">收起來的你在上面看不到，資料和老師的紀錄都還在。按「拿回來」放回原本那一類。</p>
    ${hid.map((x) => `<div class="doc-row"><div class="dmain">${esc(x.title || x.fileName || '（沒有標題）')}<div class="muted small">${esc(INV_NAME[x.kind] || '還沒分類')}｜${esc(mdOf(x.hiddenAt))} 收起${x.replacedById ? '｜已換成新的一份' : ''}</div></div><button type="button" class="btn sm ghost" data-act="invUnhide" data-id="${esc(x.id)}">拿回來</button></div>`).join('')}</details>`;
}
document.addEventListener('toggle', (ev) => { if (ev.target.id === 'inv-hidden' && S.mine) S.mine.invShowHidden = ev.target.open; }, true);
const invFind = (id) => { const inv = (S.mine && S.mine.inv) || {}; for (const k of Object.keys(inv)) { const x = (inv[k] || []).find((y) => String(y.id) === String(id)); if (x) return Object.assign({ kindKey: k }, x); } return null; };
ACT.invEdit = async (el) => {
  const m = invMine(), id = el.dataset.id; if (m.invEdit && m.invEdit.id === id) { m.invEdit = null; renderMine(); return; }
  m.invSwap = null; m.invEdit = { id, loading: true }; renderMine();
  const r = await call('my_inventory_item', { p_file_asset_id: id }, { quiet: true }).catch(() => ({ ok: false }));
  if (!r.ok) { m.invEdit = null; renderMine(); toast('這一份現在打不開，請重新整理再試。', true); return; }
  m.invEdit = { id, item: r.item, title: r.item.title || '', text: r.item.text || '' }; renderMine();
};
IN.invEditTitle = (el) => { if (S.mine.invEdit) S.mine.invEdit.title = el.value; };
IN.invEditText = (el) => { if (S.mine.invEdit) S.mine.invEdit.text = el.value; };
ACT.invEditCancel = () => { S.mine.invEdit = null; renderMine(); };
ACT.invEditSave = async (el) => {
  const m = invMine(), ed = m.invEdit; if (!ed || !ed.item) return;
  if (ed.item.canEdit && !ed.text.trim()) { toast('內容不可以空白；不要了請按「收起來」。', true); return; }
  el.disabled = true;
  const r = await call('update_inventory_item', { p_file_asset_id: ed.id, p_title: ed.title, p_text: ed.item.canEdit ? ed.text : null });
  if (!r.ok) { el.disabled = false; return; }
  keepClear('mine:edit:' + ed.id); m.invEdit = null;
  toast(!ed.item.canEdit ? '標題改好了。' : ed.item.canWithdraw ? '改好了。老師看到的是改過的內容，也會看到你交出後又改過，不用再交一次。' : '改好了。要老師再看，按「交給老師看」（算新的一輪）。');   // 11-13 第 34 條：等老師看時改
  await invLoad(); renderMine();
};
ACT.invSwapOpen = (el) => { const m = invMine(), id = el.dataset.id; m.invEdit = null; m.invSwap = m.invSwap && m.invSwap.id === id ? null : { id, text: '' }; renderMine(); };
IN.invNewText = (el) => { if (S.mine.invSwap) S.mine.invSwap.text = el.value; };
ACT.invSwapCancel = () => { S.mine.invSwap = null; renderMine(); };
// 11-13 第 34 條：等老師看的那一份換掉時，老師那一輪跟著移到新的一份（28o replace_inventory_item）
const swapMsg = (old) => (old && old.rv && old.rv.status === 'pending' ? '換好了。老師看到的會是新的這一份，也會看到你交出後又換過；舊的那份收在最下面「收起來的」。' : '換好了，舊的那份收在最下面「收起來的」。');
async function invSwapTo(oldId, newId) {   // 新的一份登記好之後：換上去（舊的收起來）、補回「補寫」標記
  const old = invFind(oldId), r = await call('replace_inventory_item', { p_old_id: oldId, p_new_id: newId });
  if (!r.ok) return false;
  if (old && old.self) await call('set_inventory_item', { p_file_asset_id: newId, p_kind: r.item.kind, p_title: r.item.title, p_self_written: true }, { quiet: true });
  return true;
}
ACT.invSwapSave = async (el) => {
  const m = invMine(), sw = m.invSwap; if (!sw) return; const old = invFind(sw.id), text = (sw.text || '').trim();
  if (!text) { toast('先貼上新的內容，或用檔案帶入。', true); return; }
  el.disabled = true;
  try {
    const statement = old && old.kindKey === 'statement';
    const r = await call('upload_register', { p_kind: statement ? 'draft' : 'portfolio', p_nopq_type: statement ? old.type || null : null, p_file_name: 'pasted.txt', p_mime: 'text/plain',
      p_size: new Blob([text]).size, p_storage_key: `${S.uid}/pasted/${Date.now()}.txt`, p_text: text });
    if (!r.ok || !(await invSwapTo(sw.id, r.fileAssetId))) return;
    keepClear('mine:swap:' + sw.id); m.invSwap = null; toast(swapMsg(old)); await invLoad(); renderMine();
  } finally { el.disabled = false; }
};
IN.invSwapFile = async (el) => {
  const m = invMine(), sw = m.invSwap, f = el.files && el.files[0]; if (!sw || !f) return; const old = invFind(sw.id);
  if (f.size > 50 * 1024 * 1024) { toast(f.name + ' 超過 50 MB，傳不上去。', true); return; }
  m.busy = 'inv:' + ((old && old.kindKey) || ''); m.msg = '傳上去中：' + f.name; renderMine();
  const r = await uploadFile(f, old && old.kindKey === 'statement' ? 'draft' : 'portfolio', old && old.kindKey === 'statement' ? old.type || '' : '');
  m.busy = ''; m.msg = '';
  if (!r.ok) { toast(UP_ERR[r.error] || errText(r), true); renderMine(); return; }
  if (await invSwapTo(sw.id, r.fileAssetId)) { m.invSwap = null; toast(swapMsg(old)); }
  await invLoad(); renderMine();
};
ACT.invHide = async (el) => {
  if (!window.confirm('收起來之後，這一份在清單上看不到；資料和老師的紀錄都還在，可以在最下面「收起來的」拿回來。要收起來嗎？')) return;
  el.disabled = true; const r = await call('inventory_hide', { p_file_asset_id: el.dataset.id, p_hide: true });
  if (!r.ok) { el.disabled = false; return; } const m = invMine(); if (m.invEdit && m.invEdit.id === el.dataset.id) m.invEdit = null;
  if (Array.isArray(r.removedDepts) && r.removedDepts.length) {   // 11-22 A4（規格 4.4）：從哪幾系的勾選清單拿掉了；那幾系的頁面下次打開寫一次（dept.js 讀）
    const it = Object.values(m.inv || {}).flat().find((x) => x && x.id === el.dataset.id);
    dpHidNoteAdd(it ? it.name : '', r.removedDepts);
  }
  toast('收起來了，在最下面「收起來的」可以拿回來。'); await invLoad(); renderMine();
};
ACT.invUnhide = async (el) => { el.disabled = true; const r = await call('inventory_hide', { p_file_asset_id: el.dataset.id, p_hide: false }); if (!r.ok) { el.disabled = false; return; } toast('拿回來了。'); await invLoad(); renderMine(); };
ACT.invWithdraw = async (el) => {
  if (!window.confirm('收回之後，老師就不用看這一份了。改好可以再交給老師看（算新的一輪）。要收回嗎？')) return;
  el.disabled = true; const r = await call('withdraw_material_review', { p_file_asset_id: el.dataset.id });
  if (!r.ok) { el.disabled = false; return; } toast('收回了，現在可以改。'); await invLoad(); renderMine();
};
IN.invType = (el) => { invMine().invType = el.value; };
IN.invTitle = (el) => { invMine().invTitle[el.dataset.k] = el.value; };
IN.invText = (el) => { invMine().invText[el.dataset.k] = el.value; };
IN.invDoc = (el) => { invMine().invPick[el.dataset.id] = el.value; };
ACT.invWriteToggle = (el) => { const m = invMine(); m.invWrite = m.invWrite === el.dataset.k ? null : el.dataset.k; renderMine(); };
async function invTag(id, kind, title, self) {
  const r = await call('set_inventory_item', { p_file_asset_id: id, p_kind: kind, p_title: title ? String(title).slice(0, 100) : null, p_self_written: !!self }, { quiet: true });
  if (!r.ok) toast('檔案存了，但分類沒有存成功，等一下在「還沒分類的」再選一次。', true);
}
IN.invFile = async (el) => {
  const m = invMine(), k = el.dataset.k, files = Array.from(el.files || []); if (!files.length) return;
  const statement = k === 'statement', type = statement ? m.invType : '';
  for (const f of files) {
    if (f.size > 50 * 1024 * 1024) { toast(f.name + ' 超過 50 MB，傳不上去。', true); continue; }
    m.busy = 'inv:' + k; m.msg = '傳上去中：' + f.name; renderMine();
    const r = await uploadFile(f, statement ? 'draft' : 'portfolio', type);
    if (r.ok) await invTag(r.fileAssetId, k, f.name.replace(/\.[^.]+$/, ''), false); else toast(UP_ERR[r.error] || errText(r), true);
  }
  m.busy = ''; m.msg = ''; await invLoad(); renderMine();
};
ACT.invSaveText = async (el) => {
  const m = invMine(), k = el.dataset.k, text = (m.invText[k] || '').trim(), title = (m.invTitle[k] || '').trim();
  if (!text) { toast('先寫一點再存。', true); return; }
  m.busy = 'inv:' + k; m.msg = '存起來中…'; renderMine();
  let r;
  try {
    r = await call('upload_register', { p_kind: k === 'statement' ? 'draft' : 'portfolio', p_nopq_type: k === 'statement' ? m.invType : null, p_file_name: 'pasted.txt', p_mime: 'text/plain',
      p_size: new Blob([text]).size, p_storage_key: `${S.uid}/pasted/${Date.now()}.txt`, p_text: text });
  } catch (e) { r = { ok: false }; }
  if (r.ok) {
    await invTag(r.fileAssetId, k, title || text.slice(0, 20), !!(INV_KINDS.find((x) => x.k === k) || {}).write); m.invText[k] = ''; m.invTitle[k] = ''; m.invWrite = null; keepClear('mine:inv:' + k); toast('存好了。');
    if (m.official && k === 'courseRecord') await call('set_inventory_code', { p_file_asset_id: r.fileAssetId, p_kind: 'courseRecord', p_code: null }, { quiet: true }).catch(() => null);   // 11-21：修課紀錄只有 A
    else if (m.official && (k === 'courseResult' || k === 'diverse')) m.tag = { id: r.fileAssetId, kind: k, step: 2 };   // 11-21 畫面②：放進來接著問代碼（不確定可以先這樣）
  }
  m.busy = ''; m.msg = ''; await invLoad(); renderMine();
};
IN.invKind = async (el) => { if (!el.value) return; await invTag(el.dataset.id, el.value, null, false); await invLoad(); renderMine(); };
ACT.invReview = async (el) => {
  el.disabled = true;
  const r = await call('submit_material_review', { p_file_asset_id: el.dataset.id, p_note: null });
  if (r.ok) { toast('交給老師了，老師看完會在這裡回你。'); await invLoad(); renderMine(); } else el.disabled = false;
};
ACT.invSubmitDraft = async (el) => {
  const m = invMine(), id = el.dataset.id, it = (m.inv.statement || []).find((x) => String(x.id) === id); if (!it) return;
  const docs = invDocs(it.type), docId = m.invPick[id] && docs.some((d) => d.caseDocId === m.invPick[id]) ? m.invPick[id] : (docs[0] || {}).caseDocId; if (!docId) return;
  el.disabled = true;
  const r = await call('submit_uploaded_draft', { p_case_doc_id: docId, p_file_asset_id: id });
  if (!r.ok) { el.disabled = false; return; }
  toast('稿交給老師了。'); location.hash = '#/doc/' + docId;
};
ACT.invParse = () => { const m = invMine(); m.mats = (m.inv.courseResult || []).concat(m.inv.diverse || []).filter((x) => x.preview).map((x) => ({ id: x.id, name: x.name, len: 1 })); runParse(); };
// ══ 2026-11-24 A13 W12（NOPQ 寫作改造前端包一）：〔盤點好了〕停在本頁出結果卡；〔讀我的檔案〕併進去；頁首「去哪裡拿」三行 ══
// 結果卡的資料＝start_scan 新回的 summary（後端 28y W05；沒有就叫 my_inventory_summary），不對照任何科系；字見文案對照表第 10 節 W12-13～W12-15。
const W12 = {
  whereTitle: '檔案去哪裡拿', where1: '到你學校的學習歷程系統登入。每間學校的平台不一樣，不知道在哪裡，就問學校的輔導室或註冊組。',
  where2: '把課程學習成果、多元表現的檔案，一件一件下載或截圖，照原樣就好，不用改。', where3: '回到這裡，一件放一次，標好是哪一類。不確定的先放，之後再標。',
  resTitle: '盤點結果', resNone: '你還沒放任何一件。沒關係，之後想到再回來放；現在也可以先開始寫 N、O。', resHave: '你放了 {n} 件：{g}。', resUncls: '另有 {n} 件還沒分類。',
  resEmpty: '還空著的：{c}。', resParse: '正在整理你放的 {n} 份檔案，不用等，可以先往下。', resWrite: '開始寫 N、O', resMore: '再放幾件',
};
const sumText12 = (sm) => {
  const g = (sm.groups || []).filter((x) => x.count > 0).map((x) => x.groupName + ' ' + x.count + ' 件').join('、');
  const emp = []; (sm.emptyCodes || []).forEach((x) => { if (x.shortName && !emp.includes(x.shortName)) emp.push(x.shortName); });
  return { have: sm.total ? NG.fill(W12.resHave, { n: sm.total, g }) + (sm.unclassified ? NG.fill(W12.resUncls, { n: sm.unclassified }) : '') : W12.resNone,
    empty: sm.total && emp.length ? NG.fill(W12.resEmpty, { c: emp.join('、') }) : '' };
};
function whereToGet12() {
  return `<h3 style="margin:12px 0 4px">${esc(W12.whereTitle)}</h3><ol style="margin:0;padding-left:22px"><li>${esc(W12.where1)}</li><li>${esc(W12.where2)}</li><li>${esc(W12.where3)}</li></ol>`;
}
function scanResultCard12() {
  const r = S.mine && S.mine.scanResult; if (!r || !r.summary) return '';
  const t = sumText12(r.summary);
  return `<div class="card active" id="scan-result" tabindex="-1" role="status"><h2>${esc(W12.resTitle)}</h2><p style="margin:0 0 6px">${esc(t.have)}</p>${t.empty ? `<p style="margin:0 0 6px">${esc(t.empty)}</p>` : ''}
    ${r.parseJobs > 0 ? `<p class="muted small" style="margin:0 0 6px"><span class="spin"></span>${esc(NG.fill(W12.resParse, { n: r.parseJobs }))}</p>` : ''}
    <div class="row" style="margin-top:8px"><a class="btn" href="#/write">${esc(W12.resWrite)}</a><button type="button" class="btn ghost" data-act="scanMore">${esc(W12.resMore)}</button></div></div>`;
}
function invFoot12() {
  const m = S.mine;
  return `<div class="card"><p class="muted small" style="margin:0 0 8px">盤點到一個段落就按「盤點好了」，會看到你放了什麼、還空著什麼，之後隨時回來補。</p><div class="row">
      <button type="button" class="btn" data-act="invDone" ${m.busy ? 'disabled' : ''}>盤點好了</button></div>
      ${m.busy === 'parse' ? '<div class="hint"><span class="spin"></span>正在讀你的檔案，通常幾秒鐘…</div>' : ''}${m.parseMsg ? `<div class="muted small" style="margin-top:6px">${esc(m.parseMsg)}</div>` : ''}</div>`;
}
ACT.scanMore = () => { const m = invMine(); m.scanResult = null; renderMine(); const t = $('inv-top') || $('view'); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start' }); };
ACT.invDone = async (el) => {   // 沿用舊的起點掃描（start_scan），旅程進度與首頁才接得上；2026-11-24 W12：做完停在本頁出盤點結果卡，不再直接跳去寫
  const m = invMine(), st = (m.inv.statement || []).filter((x) => x.preview), pf = (m.inv.courseResult || []).concat(m.inv.diverse || []).filter((x) => x.preview);
  el.disabled = true;
  const r = await call('start_scan', { p_answers: { hasDraft: st.length > 0, hasMaterial: pf.length > 0, draftFileIds: st.map((x) => x.id), portfolioFileIds: pf.map((x) => x.id) } });
  if (!r.ok) { el.disabled = false; return; }
  const h = await call('me_home', {}, { quiet: true }); if (h.ok) S.home = h;
  let sm = r.summary;
  if (!sm) { const q = await call('my_inventory_summary', {}, { quiet: true }).catch(() => null); sm = q && q.ok ? q.summary : null; }
  if (!sm) { location.hash = '#/write'; return; }   // 後端還沒有盤點結果（舊版）：照舊跳去寫
  m.scanResult = { summary: sm, parseJobs: +r.parseJobs || 0 }; m.parseMsg = ''; renderMine(); window.scrollTo(0, 0); const c = $('scan-result'); if (c) c.focus({ preventScroll: true });
};

// ══ 2026-11-21 審查資料項目模型第三步：畫面①「我的學習歷程」改成兩塊、畫面②標代碼（規格 04_項目模型第三步_畫面規格_v0.1.md 第 2、3 節）══
// 後端 28v（my_inventory 回 official 時）才用這個版面；每一件既有的動作（改、換一份、收起、交給老師看、收回、交給老師改）原樣收進「更多」（規格第 12 節第 11 條）。
const W3 = () => NG.WORDS;
const f3 = (k, o) => NG.fill(NG.WORDS[k], o);
const INV3_GROUP = { courseRecord: '修課紀錄', courseResult: '課程學習成果', diverse: '多元表現' };
const tName3 = () => { const n = (S.mine && S.mine.teacherName) || ''; return n ? (/老師/.test(n) ? n : n + '老師') : '老師'; };
function invRow3(it, kd) {
  const m = invMine(), off = m.official, open = m.tag && m.tag.id === it.id;
  const codeName = it.code ? NG.offName(off, it.code) : '';
  return `<div class="pk invrow" id="inv-row-${esc(it.id)}">${dpSq(it.code)}<span class="pt"><b>${esc(it.name)}</b>
      ${it.code ? `<div class="muted small">${esc(codeName)}</div>` : ` <span class="pill warn">${esc(W3().noCode)}</span>`}
      ${it.code && it.codeBy === 'teacher' ? ` <span class="pill">${esc(f3('miByTeacher', { t: tName3() }))}</span>` : ''}</span>
    <span class="pbtns">${kd.k !== 'courseRecord' ? `<button type="button" class="btn sm ghost" data-act="invTagOpen" data-id="${esc(it.id)}">${esc(W3().miTagBtn)}</button>` : ''}</span>
    ${open ? invTagHtml(it) : ''}
    <details class="more"><summary>${esc(W3().miMore)}</summary>${invItem(it, kd)}</details></div>`;
}
// 畫面②：先選大類（三顆），再選代碼（那一大類的幾顆＋「我不確定，先這樣」）；修課紀錄直接是 A
function invTagHtml(it) {
  const m = invMine(), t = m.tag, off = m.official, W = W3();
  if (t.confirm) return `<div class="tagbox"><p>${esc(f3('tgTeacherSet', { t: tName3(), code: it.code }))}</p>
    <div class="row"><button type="button" class="btn sm" data-act="invTagYes">${esc(W.tgYes)}</button><button type="button" class="btn sm ghost" data-act="invTagClose">${esc(W.tgNo)}</button></div></div>`;
  const kinds = ['courseRecord', 'courseResult', 'diverse'];
  let h = `<div class="tagbox"><p><b>${esc(W.tgQ1)}</b></p><div class="row">${kinds.map((k) => `<button type="button" class="btn sm ${t.kind === k ? '' : 'ghost'}" data-act="invTagKind" data-k="${k}">${esc(INV3_GROUP[k])}</button>`).join('')}</div>
    <p class="muted small">${esc(W.tgQ1Hint)}</p>`;
  if (t.kind === 'courseRecord') h += `<p class="muted small">${esc(W.tgAOnly)}</p>`;
  else if (t.kind && t.step === 2) {
    const g = INV3_GROUP[t.kind], codes = ((off && off.items) || []).filter((x) => x.groupName === g);
    h += `<p><b>${esc(W.tgQ2)}</b></p><p class="muted small">${esc(W.tgQ2Hint)}</p><div class="codes">${codes.map((x) => `<button type="button" class="btn sm ${it.code === x.code ? '' : 'ghost'}" data-act="invTagCode" data-code="${esc(x.code)}">${esc(NG.offName(off, x.code))}</button>`).join('')}
      <button type="button" class="btn sm ghost" data-act="invTagCode" data-code="">${esc(W.tgUnsure)}</button></div>`;
  }
  return h + `<div style="margin-top:6px"><button type="button" class="btn sm ghost" data-act="invTagClose">${esc(W.dpNotNow)}</button></div></div>`;
}
function invGroup3(kd, title, limitG) {
  const m = S.mine, list = m.inv[kd.k] || [], off = m.official, W = W3();
  const lim = limitG ? NG.offLimit(off, limitG) : undefined;
  const head = limitG ? `<h3 style="margin:12px 0 2px">${esc(title)}</h3><div class="muted small">${lim === undefined ? '' : lim === null ? '' : esc(f3(limitG === '課程學習成果' ? 'pickLimitCourse' : 'pickLimitMulti', { limit: lim })) + ' '}${esc(f3('miCount', { n: list.length }))}</div>`
    : `<div class="drow"><span><b>${esc(NG.offName(off, 'A'))}</b><div class="muted small">${esc(W.pickA)}</div><div class="muted small">${esc(W.miARef)}</div></span></div>`;
  const open = m.invWrite === kd.k;
  return head + list.map((it) => invRow3(it, kd)).join('')
    + `<div class="row" style="margin-top:6px"><button type="button" class="btn ghost sm" data-act="invWriteToggle" data-k="${kd.k}">${esc(open ? '收起' : W.miPut)}</button></div>`
    + (open ? `<label class="f" for="inv-title-${kd.k}">一句話標題</label><input type="text" id="inv-title-${kd.k}" data-in="invTitle" data-k="${kd.k}" maxlength="60" value="${esc(m.invTitle[kd.k] || '')}" placeholder="${kd.k === 'courseRecord' ? '例：高一到高二上修課紀錄' : '例：高二上 物理專題：水火箭'}">
      <label class="f" for="inv-text-${kd.k}">內容</label><textarea id="inv-text-${kd.k}" class="big" data-in="invText" data-k="${kd.k}" maxlength="20000" placeholder="把學校系統裡那一件的內容貼上來，或按下面「用檔案帶入」">${esc(m.invText[kd.k] || '')}</textarea>
      <div style="margin-top:6px"><button type="button" class="btn" data-act="invSaveText" data-k="${kd.k}">存下來</button></div>` : '')
    + (m.busy === 'inv:' + kd.k ? `<div class="hint"><span class="spin"></span>${esc(m.msg || '處理中…')}</div>` : '');
}
function invBottom3() {
  const m = S.mine, W = W3(), off = m.official, docs = (S.home || {}).docs || [], w = m.wish, st = m.inv.statement || [];
  const stateOf = (d) => (d ? `<span class="pill">${esc(d.stateLabel || '')}</span>` : `<span class="pill">${esc(W.miNotStarted)}</span>`);
  const olds = (type) => { const xs = st.filter((x) => x.type === type); return xs.length ? `<details class="more"><summary>${esc(f3('miOldDrafts', { n: xs.length }))}</summary>${xs.map((x) => invItem(x, INV_KINDS.find((k) => k.k === 'statement'))).join('')}</details>` : ''; };
  const row = (label, d, href, extra) => `<div class="drow"><span><b>${esc(label)}</b>${extra || ''}</span>${stateOf(d)}<a class="btn sm ghost" href="${esc(href)}">${esc(d ? W.contWrite : W.startWrite)}</a></div>`;
  const dN = docs.find((d) => d.nopqType === 'N_diverseSummary'), dO = docs.find((d) => d.nopqType === 'O_reflection');
  let h = `<div class="card" id="inv-bottom"><h2>${esc(W.miBottom)}</h2><p class="muted small" style="margin:0 0 6px">${esc(W.miBottomIntro)}</p>
    ${row(NG.offName(off, 'N'), dN, dN ? '#/doc/' + dN.caseDocId : '#/write', ` <span class="muted small">${esc(W.miShared)}</span>`)}${olds('N')}
    ${row(NG.offName(off, 'O'), dO, dO ? '#/doc/' + dO.caseDocId : '#/write', ` <span class="muted small">${esc(W.miShared)}</span>`)}${olds('O')}`;
  const items = w && Array.isArray(w.items) ? w.items.slice().sort((a, b) => a.rank - b.rank) : [];
  if (!items.length) return h + `<p>${esc(W.miNoWish)}</p><a class="btn" href="#/wish">${esc(W.miGoWish)}</a></div>`;
  items.forEach((it) => {
    const dc = String(it.deptCode), gi = it.guideItems && Array.isArray(it.guideItems.items) ? it.guideItems.items : [];
    const dP = docs.find((d) => d.nopqType === 'P_motivation' && d.deptCode === dc), dQ = docs.find((d) => d.nopqType === 'Q_futurePlan' && d.deptCode === dc);
    h += `<h4 style="margin:12px 0 2px">${esc(it.rank + '. ' + (it.schoolName || '') + ' ' + (it.name || ''))}</h4>`;
    if (!gi.length || gi.some((x) => x.code === 'P')) h += row(NG.offName(off, 'P'), dP, dP ? '#/doc/' + dP.caseDocId : '#/write');
    if (!gi.length || gi.some((x) => x.code === 'Q')) h += row(NG.offName(off, 'Q'), dQ, dQ ? '#/doc/' + dQ.caseDocId : '#/write');
    gi.filter((x) => x.code > 'Q' && x.form === 'write').forEach((x) => {
      const dX = docs.find((d) => d.nopqType === 'X_extraWriting' && d.deptCode === dc && d.itemCode === x.code);
      h += dX ? row(x.code + ' ' + (x.officialName || ''), dX, '#/doc/' + dX.caseDocId)
        : `<div class="drow"><span><b>${esc(x.code + ' ' + (x.officialName || ''))}</b></span>${stateOf(null)}<button type="button" class="btn sm" data-act="openExtra" data-dept="${esc(dc)}" data-code="${esc(x.code)}">${esc(W.startWrite)}</button></div>`;
    });
  });
  h += olds('P') + olds('Q');
  return h + '</div>';
}
function invPicks3() {
  const m = S.mine, W = W3(), off = m.official, w = m.wish;
  const items = w && Array.isArray(w.items) ? w.items.slice().sort((a, b) => a.rank - b.rank) : [];
  if (!items.length) return '';
  const rows = items.map((it) => {
    const gi = it.guideItems && Array.isArray(it.guideItems.items) ? it.guideItems.items : [], pc = it.pickCounts || {};
    const listed = (g, lo, hi) => gi.some((x) => x.form === 'portfolio' && x.code >= lo && x.code <= hi);
    const parts = [];
    [['課程學習成果', 'B', 'E'], ['多元表現', 'F', 'M']].forEach(([g, lo, hi]) => {
      if (!listed(g, lo, hi)) return;
      const lim = NG.offLimit(off, g);
      parts.push(g + ' ' + (pc[g] || 0) + (lim === undefined || lim === null ? '' : '／' + lim));
    });
    const any = Object.values(pc).some((n) => n > 0);
    return `<div class="drow"><span><b>${esc(it.rank + '. ' + (it.schoolName || '') + ' ' + (it.name || ''))}</b><div class="muted small">${esc(parts.length ? parts.join('、') : W.dpNoPortfolio)}</div></span>
      ${parts.length ? `<a class="btn sm ${any ? 'ghost' : ''}" href="#/dept/${esc(String(it.deptCode))}">${esc(any ? W.miSeePick : W.miGoPick)}</a>` : ''}</div>`;
  });
  return `<div class="card" id="inv-picks"><h2>${esc(W.miPicksTitle)}</h2><p class="muted small" style="margin:0 0 6px">${esc(W.miPicksIntro)}</p>${rows.join('')}</div>`;
}
function invHtml3() {
  const m = S.mine, inv = m.inv, none = inv._none || [], W = W3();
  const KD = (k) => INV_KINDS.find((x) => x.k === k), total = ['courseRecord', 'courseResult', 'diverse'].reduce((a, k) => a + (inv[k] || []).length, 0);
  let top = `<div class="card" id="inv-top"><h2>${esc(W.miTop)}</h2><p class="muted small" style="margin:0 0 6px">${esc(W.miTopIntro)}</p>${m.hasTeacher ? `<p class="small" style="margin:0 0 6px">${esc(W.miTeacherSees)}</p>` : ''}`;
  if (!total && !none.length) top += `<p>${esc(W.miEmpty)}</p>`;
  top += invGroup3(KD('courseRecord'), '', null) + invGroup3(KD('courseResult'), '課程學習成果（B–E）', '課程學習成果') + invGroup3(KD('diverse'), '多元表現（F–M）', '多元表現');
  if (none.length) top += `<h3 style="margin:12px 0 2px">${esc(f3('miUnclassified', { n: none.length }))}</h3><p class="muted small">${esc(W.miUnclassHint)}</p>
    ${none.map((it) => `<div class="doc-row"><span class="dmain">${esc(it.name)}</span><select data-in="invKind" data-id="${esc(it.id)}" aria-label="這份是哪一類"><option value="">${esc(W.miPickKind)}</option>${INV_KINDS.filter((x) => x.k !== 'statement').map((x) => `<option value="${x.k}">${esc(x.name)}</option>`).join('')}</select></div>`).join('')}`;
  top += '</div>';
  const nMat = (inv.courseResult || []).length + (inv.diverse || []).length;
  return scanResultCard12() + `<div class="card active"><h2>${esc(W.miTitle)}</h2><p style="margin:0">${esc(W.miIntro)}</p>${whereToGet12()}</div>`
    + `<div class="inv2">${top}${invBottom3()}</div>`
    + invPicks3()
    + (m.items && m.items.length ? `<div class="card"><h2>從你的檔案整理出 ${m.items.length} 件事</h2><p class="muted small" style="margin:0 0 6px">系統整理的，老師還沒逐字看過。</p>${m.items.map(matRow).join('')}</div>` : '')
    + lessonsCard() + invHiddenHtml()
    + invFoot12();   // 2026-11-24 A13 W12-15：〔讀我的檔案〕併進〔盤點好了〕，見 invFoot12
}
// 畫面②的動作
const invFind3 = (id) => { const inv = (S.mine && S.mine.inv) || {}; for (const k of Object.keys(inv)) { const x = (inv[k] || []).find((y) => String(y.id) === String(id)); if (x) return x; } return null; };
ACT.invTagOpen = (el) => {
  const m = invMine(), it = invFind3(el.dataset.id); if (!it) return;
  if (m.tag && m.tag.id === it.id) { m.tag = null; renderMine(); return; }
  m.tag = { id: it.id, kind: it.kind && it.kind !== 'statement' ? it.kind : null, step: it.kind && it.kind !== 'statement' ? 2 : 1, confirm: it.codeBy === 'teacher' };
  renderMine();
};
ACT.invTagClose = () => { const m = invMine(); m.tag = null; renderMine(); };
ACT.invTagYes = () => { const m = invMine(); if (m.tag) m.tag.confirm = false; renderMine(); };
async function invTagSave(kind, code) {
  const m = invMine(), t = m.tag; if (!t) return;
  const res = await call('set_inventory_code', { p_file_asset_id: t.id, p_kind: kind, p_code: code || null }, { quiet: true }).catch(() => null);
  if (!res || !res.ok) { toast(W3().st3SaveFail, true); return; }
  const it = invFind3(t.id), oldG = it && INV3_GROUP[it.kind];
  m.tag = null;
  if (res.removedPicks > 0 && oldG) toast(f3('tgMoved', { g: INV3_GROUP[kind], n: res.removedPicks, old: oldG }));
  else toast(res.item && res.item.itemCode ? f3('tgDone', { code: NG.offName(m.official, res.item.itemCode) }) : W3().tgDoneUnsure);
  await invLoad(); renderMine();
}
ACT.invTagKind = (el) => {
  const m = invMine(); if (!m.tag) return; const k = el.dataset.k;
  if (k === 'courseRecord') { invTagSave('courseRecord', 'A'); return; }   // 這一類只有 A，不問第二步
  m.tag.kind = k; m.tag.step = 2; renderMine();
};
ACT.invTagCode = (el) => { const m = invMine(); if (!m.tag || !m.tag.kind) return; invTagSave(m.tag.kind, el.dataset.code || null); };
