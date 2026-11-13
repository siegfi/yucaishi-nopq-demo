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
  if (m.busy === 'parse') return '<div class="card active"><h2>老師在讀你的檔案</h2><div class="hint"><span class="spin"></span>通常幾秒鐘…</div></div>';
  if (noMatFiles()) return '<div class="card active"><h2>還沒收到你的檔案</h2><p style="margin:0 0 10px">你說學習歷程有東西，但還沒丟上來。回去貼文字或丟檔案就好。</p><button type="button" class="btn" data-act="mineReset">回去丟</button></div>';
  if (items.length) return `<div class="card active"><h2>整理出 ${items.length} 件事</h2><p class="muted" style="margin:0 0 6px">這是老師從你的檔案裡讀出來的。接下來老師會從這些事問起。</p>${items.map(matRow).join('')}<div style="margin-top:12px"><a class="btn" href="#/write">往下，開始寫</a></div></div>`;
  if (S.aiOn === false) return `<div class="card active"><h2>檔案收到了</h2><p style="margin:0 0 8px">這一步由老師接手：老師會直接看你的檔案，找出你做過的事。你可以先往下寫。</p><a class="btn" href="#/write">往下寫</a></div>`;   // 28l：沒開 AI
  return `<div class="card active"><h2>檔案還沒整理</h2><p style="margin:0 0 8px">${esc(m.parseMsg || '你丟了學習歷程的檔案，讓老師讀一下，找出你做過的事。')}</p>
    <div class="row"><button type="button" class="btn" data-act="runParse" ${m.mats.length ? '' : 'disabled'}>請老師讀一下</button><a class="btn ghost" href="#/write">先不用，往下寫</a></div></div>`;
}
function lessonsCard() {
  const ls = (S.home || {}).lessons || []; if (!ls.length) return '';
  return `<details class="card"><summary>老師排的課（${ls.length}）</summary>${ls.map((l) => { const url = safeUrl(l.externalUrl);
    return `<div class="doc-row"><div class="dmain"><b>${esc(l.title)}</b> <span class="pill">${esc(FMT[l.format] || l.format || '')}</span><div class="muted small">${esc(when(l.scheduledAt))}</div>${url ? `<div class="small"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">老師的連結</a></div>` : ''}</div></div>`; }).join('')}</details>`;
}
function renderMine() {
  if (location.hash !== '#/mine' || !S.mine) return;
  if (S.mine.inv) { const y0 = window.scrollY; view(invHtml() + lessonsCard()); window.scrollTo(0, y0); return; }
  const st = mineStage(); let html;
  if (st === 'ask') html = `<div class="card"><h2>你手上有什麼？</h2></div>${qBlock(1)}${qBlock(2)}${askFoot()}`;
  else if (st === 'submit') html = submitBlock();
  else if (st === 'draftDone') html = '<div class="card active"><h2>稿交給老師了</h2><p style="margin:0 0 10px">去「寫」看老師的話。</p><a class="btn" href="#/write">去看</a></div>';
  else if (st === 'blank') html = '<div class="card active"><h2>好，我們從聊開始</h2><p style="margin:0 0 10px">老師會先問你做過的事，你想到什麼說什麼。</p><a class="btn" href="#/write">開始</a></div>';
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
      if (!r.ok) { fail = r.error === 'AI_OFF' ? '這一步由老師接手：老師會直接看你的檔案，你可以先往下寫。' : r.error === 'AI_CONSENT_MISSING' || r.error === 'QUOTA_EXCEEDED' ? errText(r) + '你可以直接往下，老師會看你的檔案。' : errText(r); if (r.error === 'AI_OFF') { S.aiOn = false; break; } continue; }
      try { await sb.functions.invoke('nopq-ai', { body: { jobId: r.jobId } }); } catch (e) { /* 結果看 my_materials */ }
    } catch (e) { fail = '連線失敗，稍後再試。'; }
  }
  let items = [];
  for (let i = 0; i < 20; i++) {
    try { const x = await call('my_materials', {}, { quiet: true }); if (x.ok) { items = x.items || []; if (items.length) break; } } catch (e) { break; }
    if (fail) break;
    await sleep(2000);
  }
  m.busy = ''; m.items = items; m.parseMsg = items.length ? '' : (fail || '還沒整理出東西，等一下再回來看，或直接往下寫，老師會先問你。');
  renderMine();
}
ACT.runParse = () => runParse();

// ══ 2026-11-08 owner 試用回饋 #2（架構稿 W3）：「我的東西」＝盤點學習歷程，四類逐類看：上傳已有的、在這裡補寫、交給老師看 ══
// 後端（28g §6）：my_inventory、set_inventory_item、submit_material_review。沒有這幾支時 invLoad 回 false，頁面退回舊的兩題問答。
const INV_KINDS = [
  { k: 'courseRecord', name: '修課紀錄', tip: '成績單、學校系統的修課紀錄（截圖或 PDF）。上傳就好，老師參考用。', write: false, review: false },
  { k: 'courseResult', name: '課程學習成果', tip: '課堂報告、實作、作品。學校系統裡有的直接上傳；還沒放上去的，可以在這裡補寫。寫好可以交給老師看。', write: true, review: true },
  { k: 'diverse', name: '多元表現', tip: '社團、競賽、志工、檢定、自主學習。一樣可以上傳或補寫，寫好交給老師看。', write: true, review: true },
  { k: 'statement', name: '學習歷程自述（N、O、P、Q）', tip: '已經寫好的 N、O、P、Q 稿上傳在這裡，再交給老師改；還沒寫的到「寫」那一頁寫。', write: false, review: false },
];
const INV_NAME = Object.fromEntries(INV_KINDS.map((x) => [x.k, x.name]));
const REV_TEXT = { pending: '等老師看', replied: '老師回了', needMore: '老師請你補一下', withdrawn: '你收回了' };
function invNorm(r) {   // 後端回傳可能是 items 陣列（每筆帶 kind）或依類別分組；這裡一律整理成 {類別: [項目]}，沒分類的放 '_none'
  const out = { _none: [] }; INV_KINDS.forEach((x) => { out[x.k] = []; });
  const one = (it) => {
    const rv = it.review || it.lastReview || null;
    return { id: it.id || it.fileAssetId, name: it.title || it.fileName || '（沒有標題）', fileName: it.fileName || '', kind: it.kind || it.inventoryKind || null, self: !!(it.selfWritten),
      preview: it.preview || it.textPreview || it.text || '', type: it.nopqType || '', at: it.createdAt || '', canSubmit: it.canSubmit,
      canEdit: it.canEdit, canHide: it.canHide, canWithdraw: it.canWithdraw, submittedDocId: it.submittedDocId || null, replaces: it.replaces || null,   // 28m（沒有＝undefined，新按鈕不出現）
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
  try { const r = await call('my_inventory', {}, { quiet: true }); if (!r || !r.ok) { S.mine.inv = null; return false; } S.mine.inv = invNorm(r); S.mine.invHidden = Array.isArray(r.hidden) ? r.hidden : null; return true; }
  catch (e) { if (e && e.message === 'NET') throw e; S.mine.inv = null; return false; }   // 2026-11-12：連線失敗／等太久不退回舊的兩題問答，交給 guard 出重新載入鈕
}
const invDocs = (type) => ((S.home || {}).docs || []).filter((d) => ['warmup', 'interviewing', 'draft_open'].includes(d.state) && (!type || d.nopqType === DOC_TYPE_OF[type]) && d.inWishlist !== false);
// 2026-11-12 楊老師試用回饋 階段 1①（D4、D5）：每一筆可以改（標題、文字）、換一份、收起來（不真刪，最下面「收起來的」拿得回來）；
// 交給老師之後、老師還沒回之前不能改、不能收起，但可以「收回」；老師回了之後可以改，改完再交＝新的一輪。後端沒有 28m（清單沒有 canEdit）就不出這幾顆。
const REV_HINT = { pending: '等老師看的時候不能改、不能收起；要改先按「收回」。', needMore: '老師請你補一下：按「改」補好，再按「補好了，再交給老師看」（算新的一輪）。',
  replied: '老師回過了，還想改可以按「改」，改完再交給老師看算新的一輪。', withdrawn: '你收回了，可以改，改好再交給老師看（算新的一輪）。' };
function invItem(it, kd) {
  const m = invMine(), rv = it.rv, canRev = kd.review && !(rv && rv.status === 'pending') && it.canSubmit !== false, has28m = it.canEdit !== undefined;
  const docs = kd.k === 'statement' ? invDocs(it.type) : [];
  const ed = m.invEdit && m.invEdit.id === it.id ? m.invEdit : null, sw = m.invSwap && m.invSwap.id === it.id ? m.invSwap : null;
  const acts = has28m ? `<div class="row" style="margin-top:6px"><button type="button" class="btn sm ghost" data-act="invEdit" data-id="${esc(it.id)}">${it.canEdit || it.submittedDocId ? '改' : '看全文'}</button>
      ${it.canHide ? `<button type="button" class="btn sm ghost" data-act="invSwapOpen" data-id="${esc(it.id)}">換一份</button><button type="button" class="btn sm ghost" data-act="invHide" data-id="${esc(it.id)}">收起來</button>` : ''}
      ${it.canWithdraw ? `<button type="button" class="btn sm warn" data-act="invWithdraw" data-id="${esc(it.id)}">收回</button>` : ''}</div>` : '';
  const hint = has28m ? (it.submittedDocId && !it.canWithdraw ? '這份稿已經交進「寫」的那一篇，內容請到「寫」改那一篇；這裡可以改標題、換一份或收起來。' : rv ? REV_HINT[rv.status] || '' : '') : '';
  return `<div class="pt"><div class="row spread"><b>${esc(it.name)}</b><span><span class="pill">${it.self ? '在這裡補寫' : it.fileName === 'pasted.txt' ? '貼上的' : '上傳的檔'}</span>${it.type ? `<span class="pill">${esc(it.type)}</span>` : ''}${rv ? `<span class="pill ${rv.status === 'needMore' ? 'warn' : rv.status === 'replied' ? 'ok' : ''}">${esc(REV_TEXT[rv.status] || rv.status)}</span>` : ''}</span></div>
    ${it.preview ? `<div class="muted small" style="white-space:pre-wrap">${esc(String(it.preview).slice(0, 200))}${String(it.preview).length > 200 ? '…' : ''}</div>` : '<div class="small" style="color:var(--warn)">這份沒有讀到文字（可能是掃描檔或圖片），老師看得到檔案，但系統讀不到內容。</div>'}
    ${it.replaces ? '<div class="muted small">這份是換上來的新的一份（舊的在最下面「收起來的」）。</div>' : ''}
    ${rv && rv.note ? `<div class="cm">老師：${esc(rv.note)}</div>` : ''}${hint ? `<div class="muted small" style="margin-top:4px">${esc(hint)}</div>` : ''}
    ${acts}${ed ? invEditHtml(it, ed) : ''}${sw ? invSwapHtml(it, kd, sw) : ''}
    ${canRev ? `<div style="margin-top:6px"><button type="button" class="btn sm ${rv && rv.status === 'needMore' ? '' : 'ghost'}" data-act="invReview" data-id="${esc(it.id)}">${rv && rv.status === 'needMore' ? '補好了，再交給老師看' : rv && rv.status === 'withdrawn' ? '再交給老師看' : '交給老師看'}</button></div>` : ''}
    ${kd.k === 'statement' ? (docs.length ? `<div class="row" style="margin-top:6px"><select data-in="invDoc" data-id="${esc(it.id)}" aria-label="這份稿是哪一篇">${docs.map((d) => `<option value="${esc(d.caseDocId)}" ${S.mine.invPick[it.id] === d.caseDocId ? 'selected' : ''}>${esc(docTitle(d))}</option>`).join('')}</select><button type="button" class="btn sm" data-act="invSubmitDraft" data-id="${esc(it.id)}">交給老師改</button></div>` : '<div class="muted small" style="margin-top:6px">現在沒有可以接這份稿的那一篇（可能已經交了或定稿了），到「寫」看看。</div>') : ''}</div>`;
}
function invKindCard(kd) {
  const m = S.mine, list = m.inv[kd.k] || [], open = m.invWrite === kd.k, busy = m.busy === 'inv:' + kd.k;
  // 2026-11-12 階段 1（D3）：四類都能「貼上文字」（雲端沒有丟檔案，原本修課紀錄、學習歷程自述完全放不進東西）；貼的框底下有「用檔案帶入（Word、PDF、文字檔）」
  const typeSel = kd.k === 'statement' && (LOCAL_SERVER || open) ? `<label class="f" for="inv-type">${open ? '貼的' : '上傳的'}是哪一篇？</label><select id="inv-type" data-in="invType">${['N', 'O', 'P', 'Q'].map((k) => `<option value="${k}" ${m.invType === k ? 'selected' : ''}>${esc(DOC_SHORT[k])}</option>`).join('')}</select>` : '';
  const pasteName = kd.write ? '在這裡補寫' : '貼上文字';
  return `<div class="card"><h2>${esc(kd.name)}（${list.length}）</h2><p class="muted small" style="margin:0 0 6px">${esc(kd.tip)}</p>
    ${list.map((it) => invItem(it, kd)).join('') || '<div class="muted small">還沒有。</div>'}
    ${typeSel}<div class="row" style="margin-top:8px">${LOCAL_SERVER ? `<label class="btn ghost sm" style="cursor:pointer">上傳檔案<input type="file" data-in="invFile" data-k="${kd.k}" multiple accept=".docx,.pdf,.txt,.md" style="display:none" ${busy ? 'disabled' : ''}></label>` : ''}
      <button type="button" class="btn ghost sm" data-act="invWriteToggle" data-k="${kd.k}">${open ? '收起' + pasteName : pasteName}</button>
      ${kd.k === 'statement' ? '<a class="btn ghost sm" href="#/write">還沒寫：到「寫」</a>' : ''}</div>
    ${open ? `<label class="f" for="inv-title-${kd.k}">一句話標題</label><input type="text" id="inv-title-${kd.k}" data-in="invTitle" data-k="${kd.k}" maxlength="60" value="${esc(m.invTitle[kd.k] || '')}" placeholder="${kd.k === 'statement' ? '例：N 第一次寫的稿（高三上）' : kd.k === 'courseRecord' ? '例：高一到高二上修課紀錄' : '例：高二上 物理專題：水火箭'}">
      <label class="f" for="inv-text-${kd.k}">內容</label><textarea id="inv-text-${kd.k}" class="big" data-in="invText" data-k="${kd.k}" maxlength="20000" placeholder="${kd.write ? '做了什麼、怎麼做、結果怎樣、學到什麼' : '把文字貼上來，或按下面「用檔案帶入」'}">${esc(m.invText[kd.k] || '')}</textarea>
      <div style="margin-top:6px"><button type="button" class="btn" data-act="invSaveText" data-k="${kd.k}">存下來</button></div>` : ''}
    ${busy ? `<div class="hint"><span class="spin"></span>${esc(m.msg || '處理中…')}</div>` : ''}</div>`;
}
function invHtml() {
  const m = S.mine, inv = m.inv, none = inv._none || [];
  const nMat = (inv.courseResult || []).length + (inv.diverse || []).length, nSt = (inv.statement || []).length;
  return `<div class="card active"><h2>盤點你的學習歷程</h2><p style="margin:0">四類一類一類看：學校系統裡有的直接上傳；還沒放上去、或想先寫寫看的，就在這裡補寫。課程學習成果和多元表現寫好，可以交給老師看；N、O、P、Q 的稿交給老師改。</p></div>`
    + INV_KINDS.map(invKindCard).join('')
    + (none.length ? `<div class="card"><h2>還沒分類的（${none.length}）</h2><p class="muted small" style="margin:0 0 6px">之前上傳的檔，選一下是哪一類。</p>${none.map((it) => `<div class="doc-row"><span class="dmain">${esc(it.name)}</span><select data-in="invKind" data-id="${esc(it.id)}" aria-label="這份是哪一類"><option value="">選類別</option>${INV_KINDS.map((x) => `<option value="${x.k}">${esc(x.name)}</option>`).join('')}</select></div>`).join('')}</div>` : '')
    + (m.items && m.items.length ? `<div class="card"><h2>老師從你的檔案整理出 ${m.items.length} 件事</h2>${m.items.map(matRow).join('')}</div>` : '')
    + invHiddenHtml()
    + `<div class="card"><p class="muted small" style="margin:0 0 8px">盤點到一個段落就可以往下寫，之後隨時回來補。</p><div class="row">
      ${nMat && S.aiOn !== false ? `<button type="button" class="btn ghost" data-act="invParse" ${m.busy ? 'disabled' : ''}>請老師讀一下，整理出我做過的事</button>` : ''}
      <button type="button" class="btn" data-act="invDone" ${m.busy ? 'disabled' : ''}>盤點好了，往下寫</button></div>
      ${m.busy === 'parse' ? '<div class="hint"><span class="spin"></span>老師在讀你的檔案，通常幾秒鐘…</div>' : ''}${m.parseMsg ? `<div class="muted small" style="margin-top:6px">${esc(m.parseMsg)}</div>` : ''}</div>`;
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
  return `<div class="hint" style="margin-top:8px"><b>換一份</b>：新的一份會接手這一份的類別和標題；舊的收起來（在最下面「收起來的」找得到，老師的紀錄也還在）。
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
  keepClear('mine:edit:' + ed.id); m.invEdit = null; toast(ed.item.canEdit ? '改好了。要老師再看，按「交給老師看」（算新的一輪）。' : '標題改好了。'); await invLoad(); renderMine();
};
ACT.invSwapOpen = (el) => { const m = invMine(), id = el.dataset.id; m.invEdit = null; m.invSwap = m.invSwap && m.invSwap.id === id ? null : { id, text: '' }; renderMine(); };
IN.invNewText = (el) => { if (S.mine.invSwap) S.mine.invSwap.text = el.value; };
ACT.invSwapCancel = () => { S.mine.invSwap = null; renderMine(); };
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
    keepClear('mine:swap:' + sw.id); m.invSwap = null; toast('換好了，舊的那份收在最下面「收起來的」。'); await invLoad(); renderMine();
  } finally { el.disabled = false; }
};
IN.invSwapFile = async (el) => {
  const m = invMine(), sw = m.invSwap, f = el.files && el.files[0]; if (!sw || !f) return; const old = invFind(sw.id);
  if (f.size > 50 * 1024 * 1024) { toast(f.name + ' 超過 50 MB，傳不上去。', true); return; }
  m.busy = 'inv:' + ((old && old.kindKey) || ''); m.msg = '傳上去中：' + f.name; renderMine();
  const r = await uploadFile(f, old && old.kindKey === 'statement' ? 'draft' : 'portfolio', old && old.kindKey === 'statement' ? old.type || '' : '');
  m.busy = ''; m.msg = '';
  if (!r.ok) { toast(UP_ERR[r.error] || errText(r), true); renderMine(); return; }
  if (await invSwapTo(sw.id, r.fileAssetId)) { m.invSwap = null; toast('換好了，舊的那份收在最下面「收起來的」。'); }
  await invLoad(); renderMine();
};
ACT.invHide = async (el) => {
  if (!window.confirm('收起來之後，這一份在清單上看不到；資料和老師的紀錄都還在，可以在最下面「收起來的」拿回來。要收起來嗎？')) return;
  el.disabled = true; const r = await call('inventory_hide', { p_file_asset_id: el.dataset.id, p_hide: true });
  if (!r.ok) { el.disabled = false; return; } const m = invMine(); if (m.invEdit && m.invEdit.id === el.dataset.id) m.invEdit = null;
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
  if (r.ok) { await invTag(r.fileAssetId, k, title || text.slice(0, 20), !!(INV_KINDS.find((x) => x.k === k) || {}).write); m.invText[k] = ''; m.invTitle[k] = ''; m.invWrite = null; keepClear('mine:inv:' + k); toast('存好了。'); }
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
ACT.invDone = async (el) => {   // 沿用舊的起點掃描（start_scan），旅程進度與首頁才接得上
  const m = invMine(), st = (m.inv.statement || []).filter((x) => x.preview), pf = (m.inv.courseResult || []).concat(m.inv.diverse || []).filter((x) => x.preview);
  el.disabled = true;
  const r = await call('start_scan', { p_answers: { hasDraft: st.length > 0, hasMaterial: pf.length > 0, draftFileIds: st.map((x) => x.id), portfolioFileIds: pf.map((x) => x.id) } });
  if (!r.ok) { el.disabled = false; return; }
  const h = await call('me_home', {}, { quiet: true }); if (h.ok) S.home = h;
  location.hash = '#/write';
};
