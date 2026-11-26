'use strict';   // 2026-11-08 拆檔（W0）：原本整支包在一個函式裡；拆成多個一般 script 後頂層名稱整頁共用，已查過與落點引擎的 31 個全域名稱不撞名
// SUPABASE_URL、SUPABASE_ANON_KEY 定義在 index.html 的小段 script：本機伺服器與雲端打包只替換 .html 裡的佔位字
// 2026-11-12 換 116（OUTPUTS/nopq_cac116_update_plan_v0.1.md §九）：YEAR＝校系代碼年（志願、P／Q 文件、存版都用這一年的代碼；後端 nopq_code_year() 同值）；
// SCORE_YEAR＝級分尺度年（116 五標公布前仍是 115；後端 nopq_score_year()、落點引擎 INPUT_YEAR 同值）。
const YEAR = 116, SCORE_YEAR = 115, CHANNEL = 'UNI';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nlen = (s) => String(s || '').replace(/\s/g, '').length;   // 字數＝去空白字元數（同資料庫 nopq_nonspace_len）
const AUTH_KEY = 'ycs-student-auth';
// 初載：存的登入過期了交給 supabase-js 自己用 refresh token 換新的（雲端學生幾天沒開也不用重登）；換不到、或帳號已不是學生，下面開機流程靜默回登入頁，不出錯誤句
let bootQuiet = true;   // 開機時還沒有人按過「登入」：存的登入若不能用，靜默回登入頁，不出錯誤句（按過登入或開機結束就改回 false）
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: AUTH_KEY } });
const S = { home: null, uid: '', doc: null, docId: null, ui: {}, poll: 0, rt: 0, terms: [], termsMiss: {}, sc: null, mine: null, reqSeen: null };   // ui：畫面上還沒存的輸入；rt：換頁計數（慢回應不蓋掉新頁）
const ACT = {}, IN = {}, KNOWN = new Set(['AUTH', 'DENIED', 'NET', 'NOT_STUDENT', 'NOT_TEACHER', 'NOT_STAFF']);
// 2026-11-24 結案唯讀（文案對照表第 15 節 CL-01、CL-02）：err＝資料庫擋下寫入（錯誤訊息以 CASE_CLOSED 開頭）時顯示；bar＝每一頁頁首的說明
const CL = { err: '這一份已經結案，只能看、不能改。', bar: '這一份已經結案：你寫的、放的都還在，可以看、複製、下載，不能再改。' };
const ERRS = {
  CASE_CLOSED: CL.err,
  NOT_STUDENT: '這個帳號不是學生帳號。老師請到老師頁登入。', NOT_TEACHER: '這個帳號不是老師帳號。', NOT_STAFF: '這個帳號不是行政帳號，請改用行政帳號登入。',
  CASE_NOT_FOUND: '找不到這一篇（或不是你的）。', NOT_FOUND: '找不到這個項目（或不是你的）。', NOT_ASSIGNED: '這個項目不是你的。', CONSENT_MISSING: '同意書還沒登錄完成，暫時不能繼續，請聯絡育才仕。',
  AI_CONSENT_MISSING: '這一步由老師來做。', STATE_INVALID: '這個動作現在不能做，畫面已經更新，請再看一次。',
  STALE: '這一頁有更新，已經重新載入。剛才的動作請再做一次。', QUOTA_EXCEEDED: '今天的系統次數用完了，請明天再試，或請老師幫忙。', VALIDATION: '資料不完整或格式不對',
  NOT_IN_WISHLIST: '這一系現在不在你的志願裡，選回來才能寫。', NOT_WRITABLE: '這一項現在不是在這裡寫的，請看這一系的說明或問老師。',   // 11-20（28t）開始寫
  ITEM_GONE: '今年的簡章沒有要你寫這一項了，這篇只能看和複製。',   // 11-20（28u）題目換了：今年沒有這一項
  HAS_WISH_EVENT: '這版存過志願，會留著，不能刪。', ACK_REQUIRED: '請先看完落點分析的說明並勾選，再存成志願。', AI_DISABLED: '這個功能現在沒有開放，請按「請老師看」。',
  AI_OFF: '這一步由老師來做。',   // 2026-11-12 28l：AI 總開關關著
};
// 2026-11-24 A13 W12-03：N、O 被「盤點」擋住時，錯誤字改成指路（原：請找育才仕幫忙）；下面 errText 對這一種不再加「資料不完整」的前綴
const INV_GATE_TEXT = '先到「我的學習歷程」放幾件你做過的事，按「盤點好了」，這一篇就能開始。';
const FIELD_NAMES = { inventory: INV_GATE_TEXT, gridTemplate: '這一篇的欄位還沒準備好', answer: '回答不可空白（最多 2000 字）', turnId: '這一題已不存在',
  text: '內容不可空白或太長', assetIds: '文字或檔案至少要一項', decisions: '沒有選任何要點', pointId: '找不到這個要點', termIds: '這個能力標籤不在可以選的清單裡，請重新選', freeText: '整段文字不可空白（最多 5000 字）',
  sectionMap: '對回欄位的資料格式不對', textBySection: '稿件格式不對', scores: '成績要在 0 到 15 級分之間', items: '志願最多六個，而且要是有效的校系', deptCode: '有一個校系代碼找不到',
  nopqType: '這份稿標的是另一篇，和你選的文件對不上', extractedText: '這個檔案沒有讀到文字，請改用「貼文字」' };
function detailText(x) {
  if (Array.isArray(x)) { const t = x.map(detailText).filter(Boolean); return t.length > 4 ? t.slice(0, 4).join('、') + `…等共 ${t.length} 項` : t.join('、'); }
  if (x && typeof x === 'object') return x.note || x.kind || '';
  const k = String(x).split(':')[0]; return FIELD_NAMES[k] || String(x);
}
const NEED_SCAN = new Map();   // 按〔開始〕被「還沒盤點」擋住的文件 id → 當時有沒有盤點紀錄（'new'＝沒有、'stuck'＝有但還是被擋）：那一篇的開始卡改放「去盤點」的鈕（write.js warmupCard）
const hasScan = () => !!(((S.home || {}).journey || {}).scan);
const isInvGate = (d) => !!d && d.error === 'VALIDATION' && JSON.stringify(d.detail || '').includes('inventory');   // 2026-11-24 A13 W12-03
function errText(d) {
  if (isInvGate(d)) return INV_GATE_TEXT;
  const base = ERRS[d.error] || '這個動作沒做成，請再按一次。還是不行，請把畫面截圖給老師。';
  return d.error === 'VALIDATION' && d.detail != null ? base + '：' + detailText(d.detail) : base;
}
let toastTimer = 0;
let closedHitAt = 0;   // 剛被結案擋下的時間；那一瞬間各頁自己的「沒存成」不蓋掉結案那一句
function toast(msg, bad) {
  if (bad && msg !== CL.err && Date.now() - closedHitAt < 1500) return;
  const t = $('toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 4200);
}
// ── 2026-11-12 楊老師試用回饋 階段 0②④（OUTPUTS/nopq_yang_feedback_revision_v0.1.md 第四節）──
// 每一次跟資料庫要資料都有等待上限；「載入中」說得出在等什麼，久了加一句「還在讀」；失敗時把「載入中」換成一句話＋重新載入鈕（不再一直轉）。
// 首頁資料 me_home 換分頁不重撈：讀過 60 秒內直接用；只要叫了會寫資料的 RPC（存檔、交出…）就作廢，回首頁會重讀；首頁有「更新」鈕。
const RPC_LIMIT = 25000, HOME_TTL = 60000;
const READ_RPC = /^(me_home|my_|list_|get_|dept_|search_|export_|luodian_ai_status|ai_switch_status|ai_job_status)/;   // 只讀不寫的 RPC；其他的一叫就讓首頁資料作廢（ai_job_status：2026-11-22 排隊進度，輪詢用）
let homeCache = null, homeAt = 0, lastFailMsg = '';
const WAIT_MSG = { me_home: '正在讀你的資料…', get_doc_state: '正在打開這一篇…', open_doc: '正在打開這一篇…', my_inventory: '正在讀你的東西…', my_wishlist: '正在讀你的志願…',
  my_files: '正在讀你的檔案…', my_materials: '正在讀整理出的事…', list_terms: '正在讀能力標籤…', list_luodian_versions: '正在讀你存過的落點版本…' };
async function rpcLimited(fn, args) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null; let timer = 0, late = false;
  const limit = new Promise((res) => { timer = setTimeout(() => { late = true; if (ctl) ctl.abort(); res({ data: null, error: { message: 'TIMEOUT' } }); }, RPC_LIMIT); });
  let b = sb.rpc(fn, args || {}); if (ctl && b && typeof b.abortSignal === 'function') b = b.abortSignal(ctl.signal);
  try { const r = await Promise.race([b, limit]); return late ? { data: null, error: { message: 'TIMEOUT' }, late: true } : r; } finally { clearTimeout(timer); }
}
async function call(fn, args, opts = {}) {
  if (fn === 'me_home' && !opts.fresh && homeCache && Date.now() - homeAt < HOME_TTL) return structuredClone(homeCache);
  if (!READ_RPC.test(fn)) homeAt = 0;
  if (WAIT_MSG[fn]) setLoadingMsg(WAIT_MSG[fn]);
  const my = S.rt, { data, error, late } = await rpcLimited(fn, args);
  if (error) {
    if (error.status === 401 || error.code === 'PGRST301' || /JWT|expired/i.test(error.message || '')) { await toLogin(bootQuiet ? '' : '登入已過期，請重新登入。'); throw new Error('AUTH'); }
    if (error.status === 403 || error.code === '42501') { if (!opts.quiet) toast('這個帳號沒有權限做這件事。', true); throw new Error('DENIED'); }
    if (/^CASE_CLOSED/.test(String(error.message || ''))) { closedHit(); return { ok: false, error: 'CASE_CLOSED' }; }   // 2026-11-24 結案：不是連線失敗，也不換成「沒有載入」的重試卡
    const msg = late || error.message === 'TIMEOUT' ? '等太久沒有回應，請檢查網路再試一次。' : '連線失敗，請檢查網路再試一次。';
    lastFailMsg = msg;   // guard 接到例外時用這句說原因
    if (!opts.quiet) { toast(msg, true); loadFail(msg, my); }
    throw new Error('NET');
  }
  if (data && data.ok === false) {
    const code = data.error;
    if (code === 'NOT_STUDENT' || code === 'NOT_TEACHER' || code === 'NOT_STAFF') { await toLogin(bootQuiet ? '' : (ERRS[code] || '這個帳號不能使用此頁。')); throw new Error(code); }   // 開機時存的登入是舊的（帳號已不是學生）：靜默回登入頁；老師手動輸入帳密登進來才顯示這句
    if (code === 'CASE_CLOSED') closedHit();   // 2026-11-24：後端日後改回 JSON 也是同一句
    else if (!opts.quiet) { toast(errText(data), true); loadFail(errText(data), my); }
    if ((code === 'STALE' || code === 'STATE_INVALID') && S.docId && !opts.noRefresh) refreshDoc();
  }
  if (fn === 'me_home' && data && data.ok) { homeCache = structuredClone(data); homeAt = Date.now(); }
  if (data && data.ok !== false && typeof keepAfterSave === 'function') keepAfterSave(fn, args || {});
  return data || { ok: false, error: 'EMPTY' };
}
// 「載入中」：各頁都用同一個 loading（下面）。setLoadingMsg 改它的字；loadFail 把還在畫面上的「載入中」換成失敗卡（已經換頁就不動）；
// 看門狗每秒看一次：轉超過 6 秒加一句「還在讀，沒有壞掉」，超過等待上限＋10 秒還在轉就直接換成失敗卡（下載校系大檔時只加句子、不判失敗）。
function setLoadingMsg(text) { document.querySelectorAll('#view [data-loading] .ld-msg').forEach((el) => { el.textContent = text; }); }
const failCard = (msg) => `<div class="card" data-ldfail="1"><h2>這一頁沒有載入</h2><p class="muted">${esc(msg)}</p><button type="button" class="btn" data-act="reload">重新載入</button></div>`;
function loadFail(msg, my) {
  setTimeout(() => {
    if (my != null && my !== S.rt) return;
    document.querySelectorAll('#view [data-loading]').forEach((el) => { el.outerHTML = failCard(msg); });
  }, 0);
}
const ldSeen = new WeakMap();
setInterval(() => {
  document.querySelectorAll('#view [data-loading]').forEach((el) => {
    if (!ldSeen.has(el)) ldSeen.set(el, Date.now());
    const age = Date.now() - ldSeen.get(el), slow = el.querySelector('.ld-slow');
    if (age > 6000 && slow) slow.classList.remove('hidden');
    if (age > RPC_LIMIT + 10000 && !ldBusy) el.outerHTML = failCard('等太久沒有回應，請檢查網路再按「重新載入」。');
  });
}, 1000);
// 存進伺服器成功 → 清掉對應的本機暫存（W1）
function keepAfterSave(fn, args) {
  const doc = S.docId ? 'doc:' + S.docId + ':' : '';
  if (doc && (fn === 'save_draft_grid' || fn === 'save_draft_free' || fn === 'save_pq_cells' || fn === 'submit_for_review' || fn === 'submit_self_check')) { keepClear(doc + 'cell:'); keepClear(doc + 'free'); }
  else if (doc && fn === 'interview_answer') keepClear(doc + 'answer');
  else if (doc && fn === 'submit_assignment') keepClear(doc + 'assign');
  else if (fn === 'upload_register' && args.p_file_name === 'pasted.txt') keepClear(args.p_kind === 'draft' ? 'mine:text1' : 'mine:text2');
}
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || el.disabled || !ACT[el.dataset.act]) return;
  if (closedLocked(el)) { toast(CL.err, true); return; }   // 2026-11-24 結案：萬一有個鈕沒被關到，按了也不送出
  try { await ACT[el.dataset.act](el, ev); } catch (e) { if (!KNOWN.has(e.message)) { toast('發生預期外的問題，請重新整理再試。', true); console.warn('act', el.dataset.act, e.message); } }
});
document.addEventListener('input', async (ev) => {   // select、checkbox、file 的選取變化也會觸發 input
  const el = ev.target.closest('[data-in]'); if (!el || !IN[el.dataset.in]) return;
  if (closedLocked(el)) return;
  try { await IN[el.dataset.in](el, ev); } catch (e) { if (!KNOWN.has(e.message)) { toast('發生預期外的問題，請重新整理再試。', true); console.warn('in', el.dataset.in, e.message); } }
});
// ── 共用輸入框（2026-11-08 owner 試用回饋 #4，架構稿 W1）：打字自動暫存在這台電腦、回來接回；大框旁「用 Word 檔帶入」 ──
// 暫存鍵＝ycs-keep:<帳號>:<範圍>；範圍：mine:text1／mine:text2、doc:<文件>:answer｜assign｜free｜cell:<格>。
// 存進伺服器成功才清（見 call 的 KEEP_CLEAR）；按登出清這個帳號全部；超過 14 天自動丟。
// 接回條件：暫存的「起點」＝現在框裡的字（伺服器那邊沒被別人改過），才把暫存的字放回去，避免蓋掉老師改過的版本。
const KEEP_DAYS = 14, KEEP_WORD = new Set(['mtext', 'invText', 'invEditText', 'invNewText', 'answer', 'assignText', 'free']), keepOrig = new WeakMap(), keepTimers = {};
function keepScope(el) {
  const k = el.dataset.in;
  if (k === 'mtext') return 'mine:text' + el.dataset.n;
  if (k === 'invText') return 'mine:inv:' + el.dataset.k;   // W3 盤點頁「在這裡補寫」
  if (k === 'invEditText') return 'mine:edit:' + el.dataset.id;   // 2026-11-12 階段 1：改一份
  if (k === 'invNewText') return 'mine:swap:' + el.dataset.id;   // 2026-11-12 階段 1：換一份
  if (!S.docId) return '';
  if (k === 'answer') return 'doc:' + S.docId + ':answer';
  if (k === 'assignText') return 'doc:' + S.docId + ':assign';
  if (k === 'free') return 'doc:' + S.docId + ':free';
  if (k === 'cell' && el.tagName === 'TEXTAREA') return 'doc:' + S.docId + ':cell:' + el.dataset.key;
  if (k === 'pqc' && el.tagName === 'TEXTAREA') return 'doc:' + S.docId + ':cell:' + el.dataset.key;   // 2026-11-24 A13 W14：P、Q 分格寫的每一格也暫存在這台電腦
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
      if (d && d.v !== el.value && d.base === el.value && !el.disabled && !S.closed) {   // 結案後不把沒存的字接回去
        el.value = d.v; const e = new Event('input', { bubbles: true }); e.keepRestore = true; el.dispatchEvent(e); restored++;
      }
    }
    if (KEEP_WORD.has(el.dataset.in)) {
      const nx = el.nextElementSibling;
      if (!(nx && nx.classList.contains('keeprow'))) el.insertAdjacentHTML('afterend', '<div class="keeprow"><button type="button" class="btn ghost sm" data-act="wordIn">用檔案帶入（Word、PDF、文字檔）</button><span class="muted small">這台電腦會暫時記住你打的字，用公用電腦記得登出。</span></div>');
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
// 2026-11-12 楊老師回饋階段 1（D3）：在瀏覽器裡讀字，從 Word 擴到文字型 PDF、純文字（.txt／.md）。不上傳、雲端也能用。
// PDF 用 pdf.js（第一次讀 PDF 才從 CDN 載入，同 supabase-js 的 CDN）；掃描檔、圖片讀不到字就請他貼上。
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
let pdfjsLoad = null;
function pdfjsReady() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsLoad) {
    pdfjsLoad = new Promise((res, rej) => { const s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js'; s.onload = () => res(window.pdfjsLib); s.onerror = () => { pdfjsLoad = null; s.remove(); rej(new Error('PDFJS')); }; document.head.appendChild(s); })
      .then((lib) => { lib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; return lib; });
  }
  return pdfjsLoad;
}
async function pdfText(file) {
  const lib = await pdfjsReady(), doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise, out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    out.push(tc.items.map((x) => (x.str || '') + (x.hasEOL ? '\n' : '')).join(''));
  }
  return out.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
const FILE_KIND = (f) => { const n = (f.name || '').toLowerCase(); return n.endsWith('.docx') ? 'docx' : n.endsWith('.pdf') ? 'pdf' : /\.(txt|md)$/.test(n) ? 'txt' : n.endsWith('.doc') ? 'doc' : 'other'; };
async function fileText(f) {   // 回 {text} 或 {err: 給學生看的一句話}
  const k = FILE_KIND(f);
  try {
    if (k === 'docx') return { text: await docxText(f) };
    if (k === 'txt') return { text: (await f.text()).replace(/^﻿/, '').replace(/\r\n/g, '\n').trim() };
    if (k === 'pdf') { const t = await pdfText(f); return t ? { text: t } : { err: '這份 PDF 沒有讀到文字（可能是掃描檔或圖片），請直接把文字貼上來。' }; }
  } catch (e) {
    if (e && e.message === 'PDFJS') return { err: '讀 PDF 的工具沒有載入，請檢查網路，或直接把文字貼上來。' };
    return { err: k === 'docx' ? '讀不到這個 Word 檔。請確認是 .docx（舊的 .doc 請先另存成 .docx），或直接把文字貼上來。' : '讀不到這個檔案，請直接把文字貼上來。' };
  }
  return { err: k === 'doc' ? '舊的 .doc 讀不到，請先在 Word 另存成 .docx，或直接把文字貼上來。' : '這種檔案讀不到字（Word、PDF、文字檔才行；圖片、PPT 請把文字貼上來）。' };
}
ACT.wordIn = (el) => {
  const ta = el.closest('.keeprow') && el.closest('.keeprow').previousElementSibling; if (!ta || ta.tagName !== 'TEXTAREA' || ta.disabled) return;
  const pick = document.createElement('input'); pick.type = 'file'; pick.accept = '.docx,.pdf,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain';
  pick.addEventListener('change', async () => {
    const f = pick.files && pick.files[0]; if (!f) return;
    el.disabled = true; const r = await fileText(f); el.disabled = false;
    let text = r.text || '';
    if (r.err) { toast(r.err, true); return; }
    if (!text) { toast('這個檔案裡沒有讀到文字，請直接貼上來。', true); return; }
    if (ta.value.trim() && !window.confirm('框裡已經有字了。要換成檔案裡的內容嗎？')) return;
    const max = +ta.getAttribute('maxlength') || 0;
    if (max && text.length > max) { text = text.slice(0, max); toast(`檔案內容超過 ${max} 字，只帶入前 ${max} 字。`, true); } else toast('已帶入檔案的內容，看過再存。');
    ta.value = text; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus();
  });
  pick.click();
};
// 落點引擎與五標小檔用 defer 載入：要等頁面解析完（DOMContentLoaded）才確定都跑過了
let ldDone = document.readyState === 'complete';
document.addEventListener('DOMContentLoaded', () => { ldDone = true; });
const domReady = () => (ldDone ? Promise.resolve() : new Promise((res) => document.addEventListener('DOMContentLoaded', () => res(), { once: true })));
// 2026-11-12 楊老師回饋階段 0④：兩個落點大檔（校系約 1.7 MB、歷年約 2.0 MB）不在開頁時下載，第一次用到落點資料（落點分析三頁、要交什麼、匯入志願）才下載。
// 檔名寫在 index.html 的 <script type="text/x-lazy" data-src>（換年度只改那裡）。下載失敗：畫面換成重新載入鈕，再按會重下。用到大檔的地方一律先 await ldReady()。
let ldLoad = null, ldBusy = false;
function ldScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = () => res(); s.onerror = () => { s.remove(); rej(new Error('LDLOAD')); }; document.head.appendChild(s); });
}
function ldReady() {
  if (ldLoad) return ldLoad;
  ldLoad = domReady().then(() => {
    const lazy = Array.from(document.querySelectorAll('script[type="text/x-lazy"][data-src]')).map((s) => s.getAttribute('data-src'));
    if (!lazy.length || typeof CAAC_DEPTS !== 'undefined') return undefined;
    ldBusy = true; setLoadingMsg('正在下載校系資料，第一次比較久…');
    return Promise.all(lazy.map(ldScript)).finally(() => { ldBusy = false; });
  }).catch((e) => { ldLoad = null; ldBusy = false; loadFail('校系資料沒有下載成功，請檢查網路再按「重新載入」。'); throw e; });
  return ldLoad;
}
// ── 登入／開機／路由 ──
const show = (id, on) => $(id).classList.toggle('hidden', !on);
function showLogin(msg) {
  S.home = null; S.doc = null; S.docId = null; S.ui = {}; S.sc = null; S.ack = null; S.lv = null; S.dinfo = null; S.mine = null; S.reqSeen = null; S.closed = false; planAt = 0; S.uid = ''; S.imp = null; S.aiOn = null; homeCache = null; homeAt = 0; stopPoll(); show('boot', false); show('app', false); show('login', true);
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
// ── 2026-11-24 結案唯讀（V9 乙案）：my_plan().close.closed＝true 的學生，畫面只能看、複製、下載 ──
// 後端另有觸發器擋寫入（錯誤訊息以 CASE_CLOSED 開頭，上面 call 接住）；這裡先把會寫東西的鈕與輸入框關掉。my_plan 讀不到（舊後端）＝當沒結案。
// 名單＝會寫資料的 data-act／data-in 名稱（其他頁的檔裡定義）；看、複製、下載、取消、換頁、買東西、預約、標「看過」不在名單裡。
const CLOSED_ACT = new Set(['wordIn', 'acceptPrompt', 'startDoc', 'sendAnswer', 'stopAsk', 'stopInterview', 'submitAssign', 'pqSubmit', 'pqMode', 'pqSplit', 'saveDraft', 'selfCheck', 'sendReview',
  'verSet', 'openExtra', 'pickGo', 'ciAdd', 'ciDrop', 'ciClaimSave', 'draftTerm', 'addSeg',
  'qpick', 'scan', 'subDraft', 'runParse', 'rmFile', 'saveText', 'mineReset', 'invEdit', 'invEditSave', 'invSwapOpen', 'invSwapSave', 'invHide', 'invUnhide', 'invWithdraw', 'invWriteToggle',
  'invSaveText', 'invReview', 'invSubmitDraft', 'invParse', 'scanMore', 'invDone', 'invTagOpen', 'invTagYes', 'invTagKind', 'invTagCode',
  'dpPick', 'dpRemove', 'dpUp', 'dpDown', 'dpAskOpen', 'dpAskSend', 'dpAccept', 'dpCopyOpen', 'dpCopyGo', 'dpSkip', 'dpUnskip',
  'saveVer', 'saveWish', 'asWish', 'asLook', 'asAi', 'lvWish', 'lvEdit', 'lvEditSave', 'lvDel', 'lvRestore', 'carryOk', 'doImport', 'importForce']);
const CLOSED_IN = new Set(['answer', 'assignText', 'cell', 'pqc', 'free', 'pickSel', 'ciClaim', 'photoTog',
  'dtype', 'mtext', 'dpick', 'file', 'invEditTitle', 'invEditText', 'invNewText', 'invSwapFile', 'invType', 'invTitle', 'invText', 'invDoc', 'invFile', 'invKind', 'dpCopySel', 'dpCheck', 'score', 'listen', 'kind']);
const closedLocked = (el) => !!S.closed && !!el.dataset && (el.dataset.act ? (CLOSED_ACT.has(el.dataset.act) || (el.dataset.act === 'openDoc' && el.dataset.state === 'warmup')) : CLOSED_IN.has(el.dataset.in));
function closedHit() { closedHitAt = Date.now(); S.closed = true; toast(CL.err, true); closedQueue(); }   // 資料庫擋下寫入：這一份已結案，之後的畫面一律唯讀
let planAt = 0, closedQ = false;
async function loadPlan() {   // 讀 my_plan().close；讀不到（舊後端、網路）＝不動現在的狀態
  const keep = lastFailMsg; planAt = Date.now();
  try { const r = await call('my_plan', {}, { quiet: true }); if (r && r.ok && r.close) S.closed = r.close.closed === true; } catch (e) { /* 讀不到就當沒結案，畫面照舊 */ }
  lastFailMsg = keep; closedQueue();
}
function lockEl(el) {
  el.classList.add('is-closed');
  if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|number|search|url|tel)?$/.test(el.type))) el.readOnly = true;
  else if ('disabled' in el) el.disabled = true; else { el.setAttribute('aria-disabled', 'true'); el.tabIndex = -1; }
  const lb = el.closest('label.btn'); if (lb) lb.classList.add('is-closed');
}
function closedSweep() {
  closedQ = false;
  let bar = $('closed-bar'); if (!bar) { bar = document.createElement('div'); bar.id = 'closed-bar'; bar.className = 'hint closed-bar hidden'; bar.setAttribute('role', 'note'); bar.textContent = CL.bar; $('view').parentNode.insertBefore(bar, $('view')); }
  const p = hashParts().path, mine = !!S.home && !!S.closed && !/^#\/(shop|book)/.test(p);
  bar.classList.toggle('hidden', !mine); if (!S.closed) return;
  document.querySelectorAll('[data-act],[data-in]').forEach((el) => { if (closedLocked(el)) lockEl(el); });
  const imp = $('imp-code'); if (imp) imp.readOnly = true;
  document.querySelectorAll('#view .keeprow, #view .keephint').forEach((e) => e.classList.add('hidden'));   // 「這台電腦會記住你打的字」在唯讀時沒有意義
}
function closedQueue() { if (!closedQ) { closedQ = true; setTimeout(closedSweep, 0); } }
new MutationObserver(closedQueue).observe(document.body, { childList: true, subtree: true });
// 2026-11-24 第 2 批 phase2_verify：Chrome 把焦點放進唯讀的文字框時不會捲過去（結案後的格子按 Tab 會跳到畫面外），這裡補捲進畫面
document.addEventListener('focusin', (ev) => { const t = ev.target; if (t && t.readOnly && t.scrollIntoView) t.scrollIntoView({ block: 'nearest' }); });
// ── 從落點通帶志願來：#/import?ld1=<代碼>。先存 sessionStorage，登入後自動匯入，成功才清掉 ──
const LD1_KEY = 'ycs-ld1-pending';
function ssGet() { try { return sessionStorage.getItem(LD1_KEY) || ''; } catch (e) { return ''; } }
function ssSet(v) { try { if (v) sessionStorage.setItem(LD1_KEY, v); else sessionStorage.removeItem(LD1_KEY); } catch (e) { /* 存不了就只靠網址 */ } }
function hashParts() { const h = location.hash || '#/', i = h.indexOf('?'); return { path: i < 0 ? h : h.slice(0, i), q: i < 0 ? '' : h.slice(i + 1) }; }
function hashLd1() { const m = hashParts().q.match(/(?:^|&)ld1=([^&]*)/); if (!m) return ''; try { return decodeURIComponent(m[1]).trim(); } catch (e) { return m[1].trim(); } }
function capturePending() { const c = hashLd1(); if (c) ssSet(c); return c; }
function decodeLd1(raw) {   // 解碼不連網；年度、檢查碼不對就回 ld1_code.js 的原句
  if (typeof LD1 === 'undefined' || !LD1.decode) return { ok: false, message: '匯入功能還沒載入，請重新整理再試。' };
  let d = LD1.decode(raw, { openYear: YEAR });
  if (!d.ok) {   // 2026-11-12：落點通改版前產生的 LD1-115 代碼，照 115→116 對照（同校＋系名）換成 116 碼；對不到的列出來請學生重選（D4，不替學生換）
    const old = LD1.decode(raw, { openYear: YEAR - 1 }); if (!old.ok) return d;
    d = Object.assign({}, old, { fromYear: YEAR - 1, codes115: old.codes.slice(), codes: [], unmapped: [] });
    if (typeof ldIndex === 'function' && typeof CAAC_DEPTS !== 'undefined') {
      const L = ldIndex(); old.codes.forEach((c) => { const x = L.by115.get(String(c)); if (x) d.codes.push(codeOf(x.id)); else d.unmapped.push(String(c)); });
    } else d.unmapped = old.codes.slice();
  }
  if (d.apiChannel !== CHANNEL) return { ok: false, message: '這組代碼不是大學申請入學的，NOPQ通只收申請入學。你可以改成自己選系。' };
  return d;
}
function loginBanner() {
  const el = $('l-import'); if (!el) return; const raw = ssGet(); let n = 0;
  if (raw && typeof LD1 !== 'undefined' && LD1.decode) { const d = decodeLd1(raw); if (d.ok) n = (d.codes115 || d.codes).length; }
  el.textContent = n ? `你帶了 ${n} 個志願過來，登入後就會存好。` : ''; show('l-import', !!n);
}
capturePending();
window.addEventListener('load', loginBanner);
// 開機：連不上（網路斷、系統暫停）時開機畫面不再一直轉，改成一句話＋「再試一次」。同時問一次 AI 總開關（28l；舊資料庫沒有這支就當不知道）
const BOOT_HTML = $('boot').innerHTML;
function bootFail() {
  $('boot').innerHTML = '<div class="card" style="max-width:440px;margin:40px auto;text-align:left"><h2>連不上系統</h2><p class="muted">請檢查網路，再按「再試一次」。還是連不上，請找育才仕。</p><div class="row"><button type="button" class="btn" data-act="bootRetry">再試一次</button><button type="button" class="btn ghost" data-act="logout">回登入頁</button></div></div>';
}
ACT.bootRetry = () => { $('boot').innerHTML = BOOT_HTML; enter(); };
async function enter() {
  show('login', false); show('boot', true);
  try {
    const ss = await sb.auth.getSession(); S.uid = (ss.data && ss.data.session && ss.data.session.user && ss.data.session.user.id) || '';
    const [h, sw] = await Promise.all([call('me_home', {}, { fresh: true }), call('ai_switch_status', {}, { quiet: true }).catch(() => null), loadPlan()]);   // 2026-11-24 loadPlan：結案了沒（讀不到＝沒結案）
    if (!h.ok) { showLogin('登入沒成功，請稍後再試。'); return; } S.home = h; S.aiOn = sw && sw.ok ? !!sw.enabled : null;
  } catch (e) { if (!(e && (e.message === 'AUTH' || /^NOT_/.test(e.message)))) bootFail(); return; }
  show('boot', false); show('app', true); $('who').textContent = S.home.nickname;
  if (ssGet() && hashParts().path !== '#/import') { try { history.replaceState(null, '', '#/import'); } catch (e) { location.hash = '#/import'; } }   // 帶著志願代碼登入：直接到匯入頁，由它接手
  route();
}
window.addEventListener('hashchange', () => { capturePending(); if (S.home) route(); else loginBanner(); });
function route() {
  if (S.home && Date.now() - planAt > 20000) loadPlan();   // 2026-11-24 結案：換頁時（20 秒內不重讀）順便確認一次，做好最後一項後下一頁就是唯讀
  closedQueue(); flushSave(); stopPoll(); S.rt++; lastFailMsg = ''; window.scrollTo(0, 0); if (typeof modalClose === 'function') modalClose();
  document.body.classList.remove('docwide');   // 11-13 第 32 條：寫稿頁有「對照」欄時內容欄放寬，離開就恢復
  const h = hashParts().path; const m = h.match(/^#\/doc\/([\w-]+)$/);
  if (m) return guard(() => viewDoc(m[1]));   // 2026-11-12：開一篇也經過 guard（原本失敗會停在「載入中」）
  S.docId = null; S.doc = null;
  const md = h.match(/^#\/dept\/([0-9A-Z]{6})$/);   // 2026-11-21 第三步：這一系要交的（dept.js 畫面③④⑤）
  if (md && typeof viewDept === 'function') return guard(() => viewDept(md[1]));
  // 2026-11-09 落點分析改版 L0：三個子分頁共用「落點分析」那一格（setTab('score')）
  const f = { '#/score': viewScore, '#/score/history': viewScoreHistory, '#/score/assess': viewScoreAssess, '#/wish': viewWish, '#/need': viewNeed, '#/mine': viewMine, '#/write': viewWrite, '#/import': viewImport,
    '#/deliver': viewDeliver,   // 2026-11-12 階段 1：我要交的（write.js）
    ...(typeof viewShop === 'function' ? { '#/shop': viewShop, '#/book': viewBook } : {}) }[h];   // 2026-11-13 第 38 條：購買、預約（../shop/shop.js；沒載到就回首頁）
  return guard(f || viewHome);
}
// 每一頁載入失敗（連線斷了等）都給一個重試鈕，不要停在「載入中」
function guard(f) {
  const my = S.rt;   // 2026-11-20：已經換頁了，舊那一頁晚到的錯誤只記下來、不蓋掉新的一頁（寫稿頁還在載入就切到「撰寫NOPQ」會撞到：S.doc 已清空）
  return Promise.resolve().then(f).catch((e) => {
    if (e && (e.message === 'AUTH' || /^NOT_/.test(e.message))) return;   // 已經回到登入頁
    if (my !== S.rt) { console.warn('view（已換頁，略過）', e && e.message); return; }
    $('view').innerHTML = failCard(lastFailMsg || '請檢查網路，再按「重新載入」。');
    console.warn('view', e && e.message);
  });
}
ACT.reload = () => { homeAt = 0; route(); };
function setTab(t) { document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.t === t)); show('tabs', t !== 'doc'); }
const view = (html) => { $('view').innerHTML = html; };
const loading = '<div class="center muted" data-loading="1"><span class="spin"></span><span class="ld-msg">載入中…</span><div class="ld-slow small hidden" style="margin-top:6px">第一次打開會比較久，請再等一下。</div></div>';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// ── 名稱對照 ──
const TYPE_NAME = { N_diverseSummary: 'N 多元表現綜整心得', O_reflection: 'O 高中學習歷程反思', P_motivation: 'P 就讀動機', Q_futurePlan: 'Q 未來學習計畫與生涯規劃' };   // 2026-11-25 第 1 批 N10：116 簡章原名（owner 第 4 題甲）
const DOC_SHORT = { N: 'N 多元表現綜整心得', O: 'O 高中學習歷程反思', P: 'P 就讀動機', Q: 'Q 未來學習計畫與生涯規劃' };
const DOC_TYPE_OF = { N: 'N_diverseSummary', O: 'O_reflection', P: 'P_motivation', Q: 'Q_futurePlan' };
const FMT = { onsite: '現場', live: '直播', recorded: '錄影', one_on_one: '1 對 1' };
const LPN = { safe: '保底', reach: '正常', dream: '夢幻' };   // 2026-11-09 owner：穩／衝／夢太抽象，改保底／正常／夢幻
const SUBJECTS = ['chi', 'eng', 'math_a', 'math_b', 'soc', 'sci'];
const SUBJ_NAME = { chi: '國文', eng: '英文', math_a: '數學A', math_b: '數學B', soc: '社會', sci: '自然' };
const SUBJ_ABBR = { chi: '國', eng: '英', math_a: '數A', math_b: '數B', soc: '社', sci: '自' };
const LV_NAME = ['底標', '後標', '均標', '前標', '頂標'];
// 2026-11-20 審查資料第二步（28t）：各系自訂的寫作（自傳、小論文…）＝X_extraWriting，名稱用「代碼＋建立當下的官方名稱」（例：S 小論文）
const typeName = (d) => (d && d.nopqType === 'X_extraWriting' ? ((d.itemCode || '') + ' ' + (d.itemLabel || '這一系要寫的')).trim() : (TYPE_NAME[d.nopqType] || d.nopqType));
const docTitle = (d) => typeName(d) + (d.deptName ? '｜' + d.deptName : '');
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
  // 2026-11-24 A13 W12-01／02／16：第 2 步卡加「成績還沒出來」那一句（可先填模考）與不綁科系的入口；第 5 步卡對齊新版「我的學習歷程」頁（不再是兩個問題）
  2: { t: '先填學測成績，看你的位置和能去的校系。成績還沒出來？可以先填模考成績，或先把學習歷程整理好。', b: '填成績', href: '#/score', b2: '先整理學習歷程', href2: '#/mine' },
  3: { t: '從清單裡挑最多六個你想去的系，存成志願。', b: '去挑科系', href: '#/score' },
  4: { t: '看這幾系要你交哪些審查資料。', b: '看各系要交什麼', href: '#/need' },
  5: { t: '把學校系統裡你高中三年的東西放進來，按「盤點好了」，老師才知道從哪裡幫你。', b: '去放學習歷程', href: '#/mine' },
};
function docTodo(h) {
  const d = h.docs || [], by = (st) => d.find((x) => x.state === st); let x;
  if ((x = by('submission_pending'))) return { t: `題目出來了：把「${docTitle(x)}」的答案寫好交出去。`, doc: x, b: '去寫答案' };
  if ((x = by('interviewing'))) return { t: `「${docTitle(x)}」有一題等你回答。說不清楚也可以。`, doc: x, b: '去回答' };
  if ((x = by('draft_open'))) return { t: `輪到你寫「${docTitle(x)}」的稿了，寫好按「改好再給我看一次」。`, doc: x, b: '去寫稿' };
  if ((x = by('feedback_published'))) return { t: `「${docTitle(x)}」的回覆出來了，先看一下。`, doc: x, b: '去看回覆' };
  if ((x = d.find((z) => z.state === 'warmup' && (z.nopqType === 'N_diverseSummary' || z.nopqType === 'O_reflection')))) return { t: `開始「${docTitle(x)}」：先回答第一個問題。`, doc: x, b: '開始' };
  if ((x = by('review_pending') || by('self_check_pending') || by('feedback_pending'))) return { t: x.state === 'review_pending' ? `「${docTitle(x)}」交給老師了，老師的話出來前不用再做什麼。` : `「${docTitle(x)}」交出去了，回覆出來前不用再做什麼。`, doc: x, b: '看一下', wait: true };
  if ((x = by('assignment_pending'))) return { t: S.aiOn === false || !(h.consent && h.consent.ai) ? `「${docTitle(x)}」整篇交給老師看了，老師看完會再問你。` : '你說的收到了，正在準備下一個題目。', doc: x, b: '看一下', wait: true };   // 2026-11-24 A13 W12-08：AI 關（或沒有同意）時不再說「正在準備下一個題目」
  const core = d.filter((z) => z.nopqType === 'N_diverseSummary' || z.nopqType === 'O_reflection');
  if (core.length && core.every((z) => z.state === 'finalized')) return { t: 'N 和 O 都定稿了。接著寫每個志願系的 P、Q。', href: '#/write', b: '看稿', wait: true };
  return { t: '老師還沒幫你開好要寫的稿子。請找育才仕。', wait: true };
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
  if (step > 3 || (step === 3 && j.canSkipScore)) rows.push(['我的志願', '已選 ' + (ws.total || 0) + ' 系', '#/wish', '看']);
  if (step > 4) rows.push(['審查資料準備指引說明', needSentence(ws) || '看過了', '#/need', '看']);
  if (step > 5 && j.scan) rows.push(['你手上有', scanText(j), '#/mine', '看']);
  return rows;
}
async function viewHome() {
  setTab(''); view(loading); const my = S.rt;
  const h = await call('me_home'); if (!h.ok || my !== S.rt) return; S.home = h;
  const j = h.journey || {}, step = Math.max(2, j.step || 2), skip = step === 3 && j.canSkipScore === true;   // 從落點通帶志願來、還沒填成績：志願已存好，成績可以晚點填
  const todo = skip ? { t: '你的志願已經存好；要看落點再填成績。', b: '填成績看落點', href: '#/score', b2: '先看每一系的準備指引', href2: '#/need' } : step >= 6 ? docTodo(h) : STEP_CARD[step] || STEP_CARD[2];
  const rows = doneRows(j, step);
  const btn = (todo.doc ? `<button class="btn" data-act="openDoc" data-id="${esc(todo.doc.caseDocId)}" data-state="${esc(todo.doc.state)}">${esc(todo.b)}</button>` : todo.href ? `<a class="btn" href="${esc(todo.href)}">${esc(todo.b)}</a>` : '')
    + (todo.href2 ? ` <a class="btn ghost" href="${esc(todo.href2)}">${esc(todo.b2)}</a>` : '')
    + (step <= 2 ? '<p class="muted small" style="margin:10px 0 0">已經在落點通挑好志願了？<a href="#/import">匯入志願</a></p>' : '');
  view(`<div class="card"><h2>${esc(h.nickname)}，你好。</h2><div>我們先看成績落點，再決定要寫什麼。</div>
    ${h.consent.general ? '' : '<div class="hint">同意書還沒登錄完成，暫時不能開始寫。請聯絡育才仕。</div>'}</div>
  <div class="card active"><h2>下一步</h2><p style="margin:0 0 10px">${esc(todo.t)}</p>${btn}
    <p class="muted small" style="margin:10px 0 0">${homeAt ? esc(when(new Date(homeAt).toISOString())) + ' 讀的資料。' : ''}老師那邊剛改過？<button type="button" class="btn ghost sm" data-act="homeFresh">更新</button></p></div>
  ${rows.length ? `<div class="card"><h3 style="margin-top:0">走過的</h3>${rows.map((r) => `<div class="done-row"><div><b>${esc(r[0])}</b>　${esc(r[1])}</div><a href="${esc(r[2])}">${esc(r[3])}</a></div>`).join('')}</div>` : ''}`);
}
ACT.homeFresh = () => { homeAt = 0; route(); };
ACT.openDoc = async (el) => {
  const id = el.dataset.id; el.disabled = true;
  try {
    // 2026-11-24 A13 W13：還沒開始的 N、O 不在這裡直接開稿——先去那一篇挑件（write.js 的挑件頁），挑好或按〔我先用寫的〕才開
    const hd = ((S.home || {}).docs || []).find((x) => x.caseDocId === id), pickFirst = !!hd && (hd.nopqType === 'N_diverseSummary' || hd.nopqType === 'O_reflection');
    if (el.dataset.state === 'warmup' && !pickFirst) { const r = await call('open_doc', { p_case_doc_id: id }, { noRefresh: true });
      if (!r.ok) { if (isInvGate(r)) { NEED_SCAN.set(id, hasScan() ? 'stuck' : 'new'); location.hash = '#/doc/' + id; } return; } }   // 2026-11-24 A13 W12-03：被盤點擋住 → 帶去那一篇，那裡有直接去盤點的鈕
    location.hash = '#/doc/' + id;
  } finally { el.disabled = false; }
};
