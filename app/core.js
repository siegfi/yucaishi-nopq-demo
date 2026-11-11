'use strict';   // 2026-11-08 拆檔（W0）：原本整支包在一個函式裡；拆成多個一般 script 後頂層名稱整頁共用，已查過與落點引擎的 31 個全域名稱不撞名
// SUPABASE_URL、SUPABASE_ANON_KEY 定義在 index.html 的小段 script：本機伺服器與雲端打包只替換 .html 裡的佔位字
const YEAR = 115, CHANNEL = 'UNI';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nlen = (s) => String(s || '').replace(/\s/g, '').length;   // 字數＝去空白字元數（同資料庫 nopq_nonspace_len）
const AUTH_KEY = 'ycs-student-auth';
// 初載：存的登入過期了交給 supabase-js 自己用 refresh token 換新的（雲端學生幾天沒開也不用重登）；換不到、或帳號已不是學生，下面開機流程靜默回登入頁，不出錯誤句
let bootQuiet = true;   // 開機時還沒有人按過「登入」：存的登入若不能用，靜默回登入頁，不出錯誤句（按過登入或開機結束就改回 false）
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: AUTH_KEY } });
const S = { home: null, uid: '', doc: null, docId: null, ui: {}, poll: 0, rt: 0, terms: [], termsMiss: {}, sc: null, mine: null, reqSeen: null };   // ui：畫面上還沒存的輸入；rt：換頁計數（慢回應不蓋掉新頁）
const ACT = {}, IN = {}, KNOWN = new Set(['AUTH', 'DENIED', 'NET', 'NOT_STUDENT', 'NOT_TEACHER', 'NOT_STAFF']);
const ERRS = {
  NOT_STUDENT: '這個帳號不是學生帳號。老師請到老師頁登入。', NOT_TEACHER: '這個帳號不是老師帳號。', NOT_STAFF: '這個帳號不是 staff。',
  CASE_NOT_FOUND: '找不到這一篇（或不是你的）。', NOT_FOUND: '找不到這個項目（或不是你的）。', NOT_ASSIGNED: '這個項目不是你的。', CONSENT_MISSING: '同意書還沒登錄完成，暫時不能繼續，請聯絡育才仕。',
  AI_CONSENT_MISSING: '沒有 AI 處理同意，這一步改由老師進行。', STATE_INVALID: '現在這一步不能這樣做，已為你更新畫面。',
  STALE: '畫面已過期（別處有更新），已為你重新載入。', QUOTA_EXCEEDED: '今天的系統次數用完了，請明天再試或請老師接手。', VALIDATION: '資料不完整或格式不對',
  HAS_WISH_EVENT: '這版存過志願，會留著，不能刪。', ACK_REQUIRED: '請先看完落點分析的說明並勾選，再存成志願。', AI_DISABLED: 'AI 解讀目前沒有開放，請按「請老師看」。',
};
const FIELD_NAMES = { inventory: '八類盤點還沒做完，請聯絡育才仕協助', gridTemplate: '這一篇的欄位還沒準備好', answer: '回答不可空白（最多 2000 字）', turnId: '這一題已不存在',
  text: '內容不可空白或太長', assetIds: '文字或檔案至少要一項', decisions: '沒有選任何要點', pointId: '找不到這個要點', termIds: '能力標籤不在詞庫', freeText: '整段文字不可空白（最多 5000 字）',
  sectionMap: '對回欄位的資料格式不對', textBySection: '稿件格式不對', scores: '成績要在 0 到 15 級分之間', items: '志願最多六個，而且要是有效的校系', deptCode: '有一個校系代碼找不到',
  nopqType: '這份稿標的是另一篇，和你選的文件對不上', extractedText: '這個檔案沒有讀到文字，請改用「貼文字」' };
function detailText(x) {
  if (Array.isArray(x)) { const t = x.map(detailText).filter(Boolean); return t.length > 4 ? t.slice(0, 4).join('、') + `…等共 ${t.length} 項` : t.join('、'); }
  if (x && typeof x === 'object') return x.note || x.kind || '';
  const k = String(x).split(':')[0]; return FIELD_NAMES[k] || String(x);
}
function errText(d) {
  const base = ERRS[d.error] || ('這一步沒有成功（' + d.error + '）');
  return d.error === 'VALIDATION' && d.detail != null ? base + '：' + detailText(d.detail) : base;
}
let toastTimer = 0;
function toast(msg, bad) {
  const t = $('toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 4200);
}
async function call(fn, args, opts = {}) {
  const { data, error } = await sb.rpc(fn, args || {});
  if (error) {
    if (error.status === 401 || error.code === 'PGRST301' || /JWT|expired/i.test(error.message || '')) { await toLogin(bootQuiet ? '' : '登入已過期，請重新登入。'); throw new Error('AUTH'); }
    if (error.status === 403 || error.code === '42501') { if (!opts.quiet) toast('這個帳號沒有權限做這件事。', true); throw new Error('DENIED'); }
    if (!opts.quiet) toast('連線失敗，請稍後再試。', true);
    throw new Error('NET');
  }
  if (data && data.ok === false) {
    const code = data.error;
    if (code === 'NOT_STUDENT' || code === 'NOT_TEACHER' || code === 'NOT_STAFF') { await toLogin(bootQuiet ? '' : (ERRS[code] || '這個帳號不能使用此頁。')); throw new Error(code); }   // 開機時存的登入是舊的（帳號已不是學生）：靜默回登入頁；老師手動輸入帳密登進來才顯示這句
    if (!opts.quiet) toast(errText(data), true);
    if ((code === 'STALE' || code === 'STATE_INVALID') && S.docId && !opts.noRefresh) refreshDoc();
  }
  if (data && data.ok !== false && typeof keepAfterSave === 'function') keepAfterSave(fn, args || {});
  return data || { ok: false, error: 'EMPTY' };
}
// 存進伺服器成功 → 清掉對應的本機暫存（W1）
function keepAfterSave(fn, args) {
  const doc = S.docId ? 'doc:' + S.docId + ':' : '';
  if (doc && (fn === 'save_draft_grid' || fn === 'save_draft_free' || fn === 'submit_for_review' || fn === 'submit_self_check')) { keepClear(doc + 'cell:'); keepClear(doc + 'free'); }
  else if (doc && fn === 'interview_answer') keepClear(doc + 'answer');
  else if (doc && fn === 'submit_assignment') keepClear(doc + 'assign');
  else if (fn === 'upload_register' && args.p_file_name === 'pasted.txt') keepClear(args.p_kind === 'draft' ? 'mine:text1' : 'mine:text2');
}
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || el.disabled || !ACT[el.dataset.act]) return;
  try { await ACT[el.dataset.act](el, ev); } catch (e) { if (!KNOWN.has(e.message)) { toast('發生預期外的問題，請重新整理再試。', true); console.warn('act', el.dataset.act, e.message); } }
});
document.addEventListener('input', async (ev) => {   // select、checkbox、file 的選取變化也會觸發 input
  const el = ev.target.closest('[data-in]'); if (!el || !IN[el.dataset.in]) return;
  try { await IN[el.dataset.in](el, ev); } catch (e) { if (!KNOWN.has(e.message)) { toast('發生預期外的問題，請重新整理再試。', true); console.warn('in', el.dataset.in, e.message); } }
});
// ── 共用輸入框（2026-11-08 owner 試用回饋 #4，架構稿 W1）：打字自動暫存在這台電腦、回來接回；大框旁「用 Word 檔帶入」 ──
// 暫存鍵＝ycs-keep:<帳號>:<範圍>；範圍：mine:text1／mine:text2、doc:<文件>:answer｜assign｜free｜cell:<格>。
// 存進伺服器成功才清（見 call 的 KEEP_CLEAR）；按登出清這個帳號全部；超過 14 天自動丟。
// 接回條件：暫存的「起點」＝現在框裡的字（伺服器那邊沒被別人改過），才把暫存的字放回去，避免蓋掉老師改過的版本。
const KEEP_DAYS = 14, KEEP_WORD = new Set(['mtext', 'invText', 'answer', 'assignText', 'free']), keepOrig = new WeakMap(), keepTimers = {};
function keepScope(el) {
  const k = el.dataset.in;
  if (k === 'mtext') return 'mine:text' + el.dataset.n;
  if (k === 'invText') return 'mine:inv:' + el.dataset.k;   // W3 盤點頁「在這裡補寫」
  if (!S.docId) return '';
  if (k === 'answer') return 'doc:' + S.docId + ':answer';
  if (k === 'assignText') return 'doc:' + S.docId + ':assign';
  if (k === 'free') return 'doc:' + S.docId + ':free';
  if (k === 'cell' && el.tagName === 'TEXTAREA') return 'doc:' + S.docId + ':cell:' + el.dataset.key;
  return '';
}
const keepKey = (scope) => 'ycs-keep:' + (S.uid || 'x') + ':' + scope;
function keepGet(scope) {
  try {
    const raw = localStorage.getItem(keepKey(scope)); if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d.v !== 'string' || Date.now() - (d.t || 0) > KEEP_DAYS * 864e5) { localStorage.removeItem(keepKey(scope)); return null; }
    return d;
  } catch (e) { return null; }
}
function keepSet(scope, v, base) { try { localStorage.setItem(keepKey(scope), JSON.stringify({ v, base, t: Date.now() })); } catch (e) { /* 存不了不影響流程 */ } }
function keepClear(prefix) {   // prefix 是範圍開頭（例：'doc:abc:cell:'）；清掉這個帳號底下符合的暫存
  try { const p = keepKey(prefix); for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(p)) localStorage.removeItem(k); } } catch (e) { /* 忽略 */ }
}
document.addEventListener('input', (ev) => {
  const el = ev.target; if (!el || el.tagName !== 'TEXTAREA' || !el.dataset || ev.keepRestore) return;
  const scope = keepScope(el); if (!scope) return;
  clearTimeout(keepTimers[scope]);
  keepTimers[scope] = setTimeout(() => {
    const old = keepGet(scope), base = old ? old.base : (keepOrig.has(el) ? keepOrig.get(el) : '');
    if (el.value === base) keepClear(scope); else keepSet(scope, el.value, base);
  }, 400);
});
let keepQueued = false;
function keepScan() {
  keepQueued = false; let restored = 0, firstCell = null;
  document.querySelectorAll('#view textarea[data-in]').forEach((el) => {
    const scope = keepScope(el); if (!scope) return;
    if (!keepOrig.has(el)) {
      keepOrig.set(el, el.value);
      const d = keepGet(scope);
      if (d && d.v !== el.value && d.base === el.value && !el.disabled) {
        el.value = d.v; const e = new Event('input', { bubbles: true }); e.keepRestore = true; el.dispatchEvent(e); restored++;
      }
    }
    if (KEEP_WORD.has(el.dataset.in)) {
      const nx = el.nextElementSibling;
      if (!(nx && nx.classList.contains('keeprow'))) el.insertAdjacentHTML('afterend', '<div class="keeprow"><button type="button" class="btn ghost sm" data-act="wordIn">用 Word 檔帶入</button><span class="muted small">這台電腦會暫時記住你打的字，用公用電腦記得登出。</span></div>');
    } else if (!firstCell) firstCell = el.closest('.cell');
  });
  if (firstCell && !(firstCell.previousElementSibling && firstCell.previousElementSibling.classList.contains('keephint'))) firstCell.insertAdjacentHTML('beforebegin', '<div class="keephint muted small">這台電腦會暫時記住你打的字，按「儲存」才算存好；用公用電腦記得登出。</div>');
  if (restored) toast('接回你上次在這台電腦還沒存的字。');
}
new MutationObserver(() => { if (!keepQueued) { keepQueued = true; setTimeout(keepScan, 0); } }).observe($('view'), { childList: true, subtree: true });
// .docx 在瀏覽器裡直接讀出文字（不上傳、雲端也能用）：找 zip 裡的 word/document.xml，解壓後去標籤；追蹤修訂裡被刪掉的字不算
async function docxText(file) {
  const buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let e = buf.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('NOTDOCX');
  let p = dv.getUint32(e + 16, true);
  for (let i = 0, n = dv.getUint16(e + 10, true); i < n; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), fl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    if (new TextDecoder().decode(buf.subarray(p + 46, p + 46 + fl)) === 'word/document.xml') {
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true), raw = buf.subarray(start, start + csize);
      let xml;
      if (method === 0) xml = new TextDecoder().decode(raw);
      else if (method === 8) xml = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      else throw new Error('NOTDOCX');
      return xml.replace(/<w:del\b[\s\S]*?<\/w:del>/g, '').replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>|<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();
    }
    p += 46 + fl + xl + cl;
  }
  throw new Error('NOTDOCX');
}
ACT.wordIn = (el) => {
  const ta = el.closest('.keeprow') && el.closest('.keeprow').previousElementSibling; if (!ta || ta.tagName !== 'TEXTAREA' || ta.disabled) return;
  const pick = document.createElement('input'); pick.type = 'file'; pick.accept = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  pick.addEventListener('change', async () => {
    const f = pick.files && pick.files[0]; if (!f) return;
    let text = '';
    try { text = await docxText(f); } catch (e) { toast('讀不到這個 Word 檔。請確認是 .docx（舊的 .doc 請先另存成 .docx），或直接把文字貼上來。', true); return; }
    if (!text) { toast('這個 Word 檔裡沒有讀到文字，請直接貼上來。', true); return; }
    if (ta.value.trim() && !window.confirm('框裡已經有字了。要換成 Word 檔裡的內容嗎？')) return;
    const max = +ta.getAttribute('maxlength') || 0;
    if (max && text.length > max) { text = text.slice(0, max); toast(`Word 內容超過 ${max} 字，只帶入前 ${max} 字。`, true); } else toast('已帶入 Word 的內容，看過再存。');
    ta.value = text; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus();
  });
  pick.click();
};
// 落點引擎與資料檔用 defer 載入：要等頁面解析完（DOMContentLoaded）才確定都跑過了
let ldDone = document.readyState === 'complete';
document.addEventListener('DOMContentLoaded', () => { ldDone = true; });
const ldReady = () => (ldDone ? Promise.resolve() : new Promise((res) => document.addEventListener('DOMContentLoaded', () => res(), { once: true })));
// ── 登入／開機／路由 ──
const show = (id, on) => $(id).classList.toggle('hidden', !on);
function showLogin(msg) {
  S.home = null; S.doc = null; S.docId = null; S.ui = {}; S.sc = null; S.ack = null; S.lv = null; S.dinfo = null; S.mine = null; S.reqSeen = null; S.uid = ''; S.imp = null; stopPoll(); show('boot', false); show('app', false); show('login', true);
  $('l-err').textContent = msg || ''; show('l-err', !!msg); $('l-btn').disabled = false; loginBanner();
}
async function toLogin(msg) { try { await sb.auth.signOut(); } catch (e) { /* 本機已清除即可 */ } showLogin(msg); }
$('login-form').addEventListener('submit', async (ev) => {
  ev.preventDefault(); bootQuiet = false; $('l-btn').disabled = true; show('l-err', false);
  const { error } = await sb.auth.signInWithPassword({ email: $('l-email').value.trim(), password: $('l-pw').value });
  $('l-pw').value = '';
  if (error) { showLogin(/invalid|credentials/i.test(error.message || '') ? '帳號或密碼不對。' : '登入沒成功，請稍後再試。'); return; }
  await enter();
});
ACT.logout = async () => { if (S.uid) keepClear(''); await toLogin(''); };   // 按登出才清這個帳號的本機暫存（登入過期被踢回登入頁不清，回來還接得回）
// ── 從落點通帶志願來：#/import?ld1=<代碼>。先存 sessionStorage，登入後自動匯入，成功才清掉 ──
const LD1_KEY = 'ycs-ld1-pending';
function ssGet() { try { return sessionStorage.getItem(LD1_KEY) || ''; } catch (e) { return ''; } }
function ssSet(v) { try { if (v) sessionStorage.setItem(LD1_KEY, v); else sessionStorage.removeItem(LD1_KEY); } catch (e) { /* 存不了就只靠網址 */ } }
function hashParts() { const h = location.hash || '#/', i = h.indexOf('?'); return { path: i < 0 ? h : h.slice(0, i), q: i < 0 ? '' : h.slice(i + 1) }; }
function hashLd1() { const m = hashParts().q.match(/(?:^|&)ld1=([^&]*)/); if (!m) return ''; try { return decodeURIComponent(m[1]).trim(); } catch (e) { return m[1].trim(); } }
function capturePending() { const c = hashLd1(); if (c) ssSet(c); return c; }
function decodeLd1(raw) {   // 解碼不連網；年度、檢查碼不對就回 ld1_code.js 的原句
  if (typeof LD1 === 'undefined' || !LD1.decode) return { ok: false, message: '匯入功能還沒載入，請重新整理再試。' };
  const d = LD1.decode(raw, { openYear: YEAR }); if (!d.ok) return d;
  if (d.apiChannel !== CHANNEL) return { ok: false, message: '這份志願代碼不是大學申請入學的，NOPQ通目前只收大學申請，也可以改用手選。' };
  return d;
}
function loginBanner() {
  const el = $('l-import'); if (!el) return; const raw = ssGet(); let n = 0;
  if (raw && typeof LD1 !== 'undefined' && LD1.decode) { const d = decodeLd1(raw); if (d.ok) n = d.codes.length; }
  el.textContent = n ? `你帶了 ${n} 個志願過來，登入後就會存好。` : ''; show('l-import', !!n);
}
capturePending();
window.addEventListener('load', loginBanner);
async function enter() {
  show('login', false); show('boot', true);
  try {
    const ss = await sb.auth.getSession(); S.uid = (ss.data && ss.data.session && ss.data.session.user && ss.data.session.user.id) || '';
    const h = await call('me_home'); if (!h.ok) { showLogin('登入沒成功，請稍後再試。'); return; } S.home = h;
  } catch (e) { return; }
  show('boot', false); show('app', true); $('who').textContent = S.home.nickname;
  if (ssGet() && hashParts().path !== '#/import') { try { history.replaceState(null, '', '#/import'); } catch (e) { location.hash = '#/import'; } }   // 帶著志願代碼登入：直接到匯入頁，由它接手
  route();
}
window.addEventListener('hashchange', () => { capturePending(); if (S.home) route(); else loginBanner(); });
function route() {
  flushSave(); stopPoll(); S.rt++; window.scrollTo(0, 0); if (typeof modalClose === 'function') modalClose();
  const h = hashParts().path; const m = h.match(/^#\/doc\/([\w-]+)$/);
  if (m) return viewDoc(m[1]);
  S.docId = null; S.doc = null;
  // 2026-11-09 落點分析改版 L0：三個子分頁共用「落點分析」那一格（setTab('score')）
  const f = { '#/score': viewScore, '#/score/history': viewScoreHistory, '#/score/assess': viewScoreAssess, '#/wish': viewWish, '#/need': viewNeed, '#/mine': viewMine, '#/write': viewWrite, '#/import': viewImport }[h];
  return guard(f || viewHome);
}
// 每一頁載入失敗（連線斷了等）都給一個重試鈕，不要停在「載入中」
function guard(f) {
  return Promise.resolve().then(f).catch((e) => {
    if (e && (e.message === 'AUTH' || /^NOT_/.test(e.message))) return;   // 已經回到登入頁
    $('view').innerHTML = '<div class="card"><h2>這一頁沒有載入</h2><p class="muted">請檢查網路，再按「重新載入」。</p><button type="button" class="btn" data-act="reload">重新載入</button></div>';
    console.warn('view', e && e.message);
  });
}
ACT.reload = () => route();
function setTab(t) { document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.t === t)); show('tabs', t !== 'doc'); }
const view = (html) => { $('view').innerHTML = html; };
const loading = '<div class="center muted"><span class="spin"></span>載入中…</div>';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// ── 名稱對照 ──
const TYPE_NAME = { N_diverseSummary: 'N 多元表現綜整心得', O_reflection: 'O 學習歷程反思', P_motivation: 'P 就讀動機', Q_futurePlan: 'Q 未來計畫' };
const DOC_SHORT = { N: 'N 多元表現綜整', O: 'O 學習歷程反思', P: 'P 就讀動機', Q: 'Q 未來計畫' };
const DOC_TYPE_OF = { N: 'N_diverseSummary', O: 'O_reflection', P: 'P_motivation', Q: 'Q_futurePlan' };
const FMT = { onsite: '現場', live: '直播', recorded: '錄影', one_on_one: '1 對 1' };
const LPN = { safe: '保底', reach: '正常', dream: '夢幻' };   // 2026-11-09 owner：穩／衝／夢太抽象，改保底／正常／夢幻
const SUBJECTS = ['chi', 'eng', 'math_a', 'math_b', 'soc', 'sci'];
const SUBJ_NAME = { chi: '國文', eng: '英文', math_a: '數學A', math_b: '數學B', soc: '社會', sci: '自然' };
const SUBJ_ABBR = { chi: '國', eng: '英', math_a: '數A', math_b: '數B', soc: '社', sci: '自' };
const LV_NAME = ['底標', '後標', '均標', '前標', '頂標'];
const docTitle = (d) => (TYPE_NAME[d.nopqType] || d.nopqType) + (d.deptName ? '｜' + d.deptName : '');
const when = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const mdOf = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : `${d.getMonth() + 1}/${d.getDate()}`; };
const codeOf = (id) => { const p = String(id).split('-'); return p.length > 1 ? p[1] : String(id).slice(-6); };   // 校系 id 後六碼＝志願代碼
// 成績：me_home().journey.scores 可能是 {scores:{…}, listen} 或直接是各科鍵；兩種都收
function normScores(j) {
  const s = j && j.scores; if (!s || typeof s !== 'object') return null;
  const sc = (s.scores && typeof s.scores === 'object') ? s.scores : s, out = {};
  SUBJECTS.forEach((k) => { if (sc[k] != null && sc[k] !== '' && !isNaN(+sc[k])) out[k] = +sc[k]; });
  const listen = s.listen != null ? s.listen : (j.listen != null ? j.listen : '');
  return Object.keys(out).length ? { scores: out, listen: listen || '' } : null;
}
// 二階一行、二階事實、落點色塊：和第 4 幕卡片共用（上面 ng-pure 區塊）
const { s2Line, s2Facts, snapPill, safeUrl } = NG;
function needSentence(sum) {
  if (!sum || !sum.total) return '';
  const a = sum.needReview === sum.total ? `${sum.total} 系都要審查資料` : `${sum.total} 系裡有 ${sum.needReview || 0} 系要審查資料`;
  const w = sum.writtenOnly != null ? sum.writtenOnly : sum.hasWritten;   // writtenOnly＝嚴格只算筆試；hasWritten 另含座談、上機等其他二階考試
  return `${a}，${w ? w + ' 系有筆試' : '沒有筆試'}，${sum.hasInterview ? sum.hasInterview + ' 系有面試' : '沒有面試'}。`;
}
// ── 首頁：只有「下一步」卡，走過的幕縮成一行 ──
const STEP_CARD = {
  2: { t: '先填學測成績，看你的位置和能去的校系。', b: '填成績', href: '#/score' },
  3: { t: '從清單裡挑最多六個你想去的系，存成志願。', b: '去挑科系', href: '#/score' },
  4: { t: '看看這幾系要你交什麼。', b: '去看', href: '#/need' },
  5: { t: '說說你手上有什麼，老師才知道從哪裡幫你。', b: '回答兩個問題', href: '#/mine' },
};
function docTodo(h) {
  const d = h.docs || [], by = (st) => d.find((x) => x.state === st); let x;
  if ((x = by('submission_pending'))) return { t: `老師給了你一個題目：把「${docTitle(x)}」的答案寫好，交給老師。`, doc: x, b: '去寫答案' };
  if ((x = by('interviewing'))) return { t: `老師在等你講一件事（${docTitle(x)}）。說不清楚也可以。`, doc: x, b: '去回答' };
  if ((x = by('draft_open'))) return { t: `輪到你寫「${docTitle(x)}」的稿了，寫好按「改好再給我看一次」。`, doc: x, b: '去寫稿' };
  if ((x = by('feedback_published'))) return { t: `老師的話出來了，先看一下「${docTitle(x)}」。`, doc: x, b: '去看老師的話' };
  if ((x = d.find((z) => z.state === 'warmup' && (z.nopqType === 'N_diverseSummary' || z.nopqType === 'O_reflection')))) return { t: `開始「${docTitle(x)}」：老師會問你第一個問題。`, doc: x, b: '開始' };
  if ((x = by('review_pending') || by('self_check_pending') || by('feedback_pending'))) return { t: `「${docTitle(x)}」交給老師了，老師的話出來前不用再做什麼。`, doc: x, b: '看一下', wait: true };
  if ((x = by('assignment_pending'))) return { t: '你說的老師收到了，正在準備下一個題目。', doc: x, b: '看一下', wait: true };
  const core = d.filter((z) => z.nopqType === 'N_diverseSummary' || z.nopqType === 'O_reflection');
  if (core.length && core.every((z) => z.state === 'finalized')) return { t: 'N 和 O 都定稿了。接著寫每個志願系的 P、Q。', href: '#/write', b: '看稿', wait: true };
  return { t: '老師還沒幫你建立文件。請聯絡育才仕。', wait: true };
}
function scanText(j) {
  const sc = j.scan; if (!sc) return '';
  if (sc.scanType === 'hasDraft') return '有寫過的稿';
  if (sc.scanType === 'hasMaterial') return '有學習歷程的檔案' + (j.materialsCount ? '，整理出 ' + j.materialsCount + ' 件事' : '');
  return '都還沒有，從聊開始';
}
function doneRows(j, step) {
  const rows = [], ns = normScores(j), ws = j.wishlistSummary || {};
  if (step > 2 && ns) rows.push(['成績落點', Object.keys(ns.scores).map((k) => SUBJ_ABBR[k] + ' ' + ns.scores[k]).join('、') + (ns.listen ? '｜英聽 ' + ns.listen : ''), '#/score', '看／改']);
  if (step > 3 || (step === 3 && j.canSkipScore)) rows.push(['志願', '已選 ' + (ws.total || 0) + ' 系', '#/wish', '看']);
  if (step > 4) rows.push(['要交什麼', needSentence(ws) || '看過了', '#/need', '看']);
  if (step > 5 && j.scan) rows.push(['你手上有', scanText(j), '#/mine', '看']);
  return rows;
}
async function viewHome() {
  setTab(''); view(loading); const my = S.rt;
  const h = await call('me_home'); if (!h.ok || my !== S.rt) return; S.home = h;
  const j = h.journey || {}, step = Math.max(2, j.step || 2), skip = step === 3 && j.canSkipScore === true;   // 從落點通帶志願來、還沒填成績：志願已存好，成績可以晚點填
  const todo = skip ? { t: '你的志願已經存好；要看落點再填成績。', b: '填成績看落點', href: '#/score', b2: '先看每一系要交什麼', href2: '#/need' } : step >= 6 ? docTodo(h) : STEP_CARD[step] || STEP_CARD[2];
  const rows = doneRows(j, step);
  const btn = (todo.doc ? `<button class="btn" data-act="openDoc" data-id="${esc(todo.doc.caseDocId)}" data-state="${esc(todo.doc.state)}">${esc(todo.b)}</button>` : todo.href ? `<a class="btn" href="${esc(todo.href)}">${esc(todo.b)}</a>` : '')
    + (todo.href2 ? ` <a class="btn ghost" href="${esc(todo.href2)}">${esc(todo.b2)}</a>` : '')
    + (step <= 2 ? '<p class="muted small" style="margin:10px 0 0">已經在落點通挑好志願了？<a href="#/import">匯入志願</a></p>' : '');
  view(`<div class="card"><h2>${esc(h.nickname)}，你好。</h2><div>我們先看成績落點，再決定要寫什麼。</div>
    ${h.consent.general ? '' : '<div class="hint">同意書還沒登錄完成，暫時不能開始寫。請聯絡育才仕。</div>'}</div>
  <div class="card active"><h2>下一步</h2><p style="margin:0 0 10px">${esc(todo.t)}</p>${btn}</div>
  ${rows.length ? `<div class="card"><h3 style="margin-top:0">走過的</h3>${rows.map((r) => `<div class="done-row"><div><b>${esc(r[0])}</b>　${esc(r[1])}</div><a href="${esc(r[2])}">${esc(r[3])}</a></div>`).join('')}</div>` : ''}`);
}
ACT.openDoc = async (el) => {
  const id = el.dataset.id; el.disabled = true;
  try {
    if (el.dataset.state === 'warmup') { const r = await call('open_doc', { p_case_doc_id: id }, { noRefresh: true }); if (!r.ok) return; }
    location.hash = '#/doc/' + id;
  } finally { el.disabled = false; }
};
