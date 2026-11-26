'use strict';
// 2026-11-25 第 ③ 步：上課頁（#/class；舊連結 #/book 也落到這裡並捲到「預約一對一」）。三塊各自讀、哪塊先到先畫：我的課表、開課列表、預約一對一。
// 後端：my_schedule（29l，回 classes）、my_course_list（29n）；預約一對一用 my_tutor、tutor_open_slots（28p），畫面由 ../shop/shop.js 的 renderBook 畫進 #cls-book。
// 寫法照 acct.js：各塊自己讀；已換頁、晚到的不蓋掉新的一頁；函式不存在（PGRST202）整塊不畫、跳轉鈕也不畫。
// 時間一律台北時間（Intl、hourCycle h23）。畫面上的字照 nopq_step3_class_frontend_plan_20261125.md 第 4 節新字表；形式與連結用網站現有的字（core.js 的 FMT、mine.js 的「老師的連結」）。
// 全域名稱一律 cls 開頭（viewClass、clsLoad…），避免跟學生頁其他檔撞名。

const CLS_KEYS = ['mine', 'list', 'book'];
const CLS_TITLE = { mine: '我的課表', list: '開課列表', book: '預約一對一' };
const CLS_WD = '日一二三四五六';
const CLS_WAIT = '正在讀你的資料…';
const CLS_NOTE = '請檢查網路，再按「重新載入」。';
// 台北時間各段；解析不了回 null
function clsTp(iso) {
  try {
    const t = new Date(iso); if (!iso || isNaN(t)) return null;
    const ps = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(t);
    const g = (k) => { const x = ps.find((p) => p.type === k); return x ? x.value : ''; };
    const y = Number(g('year')), mo = Number(g('month')), d = Number(g('day'));
    if (!y || !mo || !d) return null;
    return { mo, d, wd: CLS_WD[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()], hm: String(g('hour')).padStart(2, '0') + ':' + String(g('minute')).padStart(2, '0') };
  } catch (e) { return null; }
}
const clsDay = (iso) => { const p = clsTp(iso); return p ? `${p.mo}/${p.d}（${p.wd}）` : ''; };
const clsHM = (iso) => { const p = clsTp(iso); return p ? p.hm : ''; };
const clsByTime = (a, b) => { const x = Date.parse(a.startsAt), y = Date.parse(b.startsAt); return (isNaN(x) ? 0 : x) - (isNaN(y) ? 0 : y); };

// 課的一列（課表與開課列表共用）。第 ⑥ 步要加「名額」「報名」就只在這個函式裡多畫，外框、日期欄、標題欄不用重寫。
// c：{ kind, title, startsAt, endsAt, teacherName, format, url, mine }；opts.mine＝這一列是「我的」（課表裡的直播課一律是）
function clsRowHtml(c, opts) {
  const tutor = c.kind === 'tutor', mine = tutor || (opts && opts.mine) === true;
  const d = clsDay(c.startsAt), t1 = clsHM(c.startsAt), t2 = tutor && c.endsAt ? clsHM(c.endsAt) : '';
  const fmt = !tutor && FMT[c.format] ? FMT[c.format] : '';   // FMT（core.js）沒有的值不畫、不露出原字
  const tag = tutor ? '<span class="pill warn">已約</span>' : mine ? '<span class="pill">我班上</span>' : '';
  const second = tutor ? [(t1 && t2 ? `${t1}–${t2}` : t1), c.teacherName].filter(Boolean).join('　') : [t1, fmt, c.teacherName].filter(Boolean).join('，');
  const url = !tutor && mine && c.url ? safeUrl(c.url) : '';   // 不是我的課一律沒有連結；一對一沒有連結
  return `<div class="cls-row" data-kind="${esc(c.kind || '')}"><div class="cls-d">${esc(d)}</div><div class="cls-m"><div class="cls-t"><b>${esc(c.title || '')}</b>${tag}</div>${second ? `<div class="muted small">${esc(second)}</div>` : ''}</div>${url ? `<a class="btn sm ghost cls-b" href="${esc(url)}" target="_blank" rel="noopener noreferrer">老師的連結</a>` : ''}</div>`;
}
const clsCard = (id, k, inner) => `<div class="card" id="${id}"><h2>${CLS_TITLE[k]}</h2>${inner}</div>`;
function clsMineHtml(d) {
  const rows = (d.classes || []).slice().sort(clsByTime).map((c) => clsRowHtml(c, { mine: c.kind === 'live' })).join('');
  return clsCard('cls-mine-card', 'mine', `<p class="muted" style="margin:0 0 6px">已約的一對一，加上我班上的直播課，照日期排。</p>${rows || '<p class="muted" style="margin:4px 0">還沒有排好的課。</p>'}`);
}
function clsListHtml(d) {
  const rows = (d.items || []).slice().sort(clsByTime).map((c) => clsRowHtml(c, { mine: c.mine === true })).join('');   // mine 不是 true 的列：不畫連結、不畫「我班上」；url、cohortName 缺或 null 不報錯
  return clsCard('cls-list-card', 'list', rows || '<p class="muted" style="margin:4px 0">還沒有開的課。</p>');
}

// 讀一支後端函式。函式不存在（PGRST202）回 NOT_READY；其他連線失敗回 NET（原因帶在 msg）
async function clsRead(fn, args) {
  try { return await call(fn, args || {}, { quiet: true }); }
  catch (e) {
    if (!e || e.message !== 'NET') throw e;
    const keep = lastFailMsg; let missing = false;
    try { const pr = await sb.rpc(fn, args || {}); missing = !!(pr.error && pr.error.code === 'PGRST202'); } catch (e2) { /* 探不到就當一般連線失敗 */ }
    lastFailMsg = keep;
    return { ok: false, error: missing ? 'NOT_READY' : 'NET', msg: keep };
  }
}
const clsFail = (r) => (r.error === 'NET' ? { s: 'err', msg: r.msg || CLS_NOTE } : { s: 'err', msg: errText(r) });
// 每一塊自己的讀法：回 { s: 'ok' | 'miss' | 'err', … }
async function clsFetch(k) {
  if (k === 'mine') {
    const r = await clsRead('my_schedule');
    if (r.error === 'NOT_READY') return { s: 'miss' };
    if (!r.ok) return clsFail(r);
    return Array.isArray(r.classes) ? { s: 'ok', d: r } : { s: 'miss' };   // 舊後端沒有 classes：整塊不畫
  }
  if (k === 'list') {
    const r = await clsRead('my_course_list');
    if (r.error === 'NOT_READY') return { s: 'miss' };
    if (!r.ok) return clsFail(r);
    return Array.isArray(r.items) ? { s: 'ok', d: r } : { s: 'miss' };
  }
  // book：不能用 shop.js 的 shopLoad（它失敗時會把整頁換掉）；只動這一塊
  if (typeof renderBook !== 'function') return { s: 'miss' };
  const [t, o] = await Promise.all([clsRead('my_tutor'), clsRead('tutor_open_slots', { p: {} })]);
  if (t.error === 'NOT_READY' || o.error === 'NOT_READY') return { s: 'miss' };
  const bad = [t, o].find((r) => !r.ok);
  if (bad) return bad.error === 'NET' ? clsFail(bad) : { s: 'err', msg: typeof shopErr === 'function' ? shopErr(bad) : errText(bad) };
  const old = S.ui.bk || {};
  S.ui.bk = { tutor: t, slots: o.slots || [], teacher: old.teacher || '', ask: null, resched: null };
  if (S.ui.bk.teacher && !S.ui.bk.slots.some((s) => s.teacherId === S.ui.bk.teacher)) S.ui.bk.teacher = '';
  return { s: 'ok' };
}
async function clsLoad(k) {
  const C = S.ui.cls; if (!C) return;
  const my = C.my;
  if (!C[k] || C[k].s !== 'ok') { C[k] = { s: 'load' }; clsDraw(k); }   // 讀過的塊重讀時不閃成「正在讀」
  let x;
  try { x = await clsFetch(k); }
  catch (e) { if (e && (e.message === 'AUTH' || /^NOT_/.test(e.message))) return; console.warn('cls', k, e && e.message); x = { s: 'err', msg: CLS_NOTE }; }
  if (S.ui.cls !== C || S.rt !== my) return;   // 已經換頁，晚到的不蓋掉新的一頁
  C[k] = x; clsDraw(k); clsSettle(C);
}
function clsDraw(k) {
  const C = S.ui.cls, el = $('cls-' + k); if (!el || !C) return;
  const x = C[k]; let h = '';
  if (!x || x.s === 'load') h = clsCard('cls-' + k + '-card', k, `<div class="state state-loading" style="margin:0">${CLS_WAIT}</div>`);
  else if (x.s === 'err') h = clsCard('cls-' + k + '-card', k, `<div class="state state-error" style="margin:0"><p style="margin:0">${esc(x.msg)}</p><div class="state-act"><button type="button" class="btn" data-act="clsRetry" data-k="${k}">重新載入</button></div></div>`);
  else if (x.s === 'ok') { if (k === 'book') { renderBook(); clsJump(); clsNone(); return; } h = k === 'mine' ? clsMineHtml(x.d) : clsListHtml(x.d); }   // book：renderBook 自己畫進 #cls-book
  el.innerHTML = h; clsJump(); clsNone();
}
function clsJump() {   // 頁首跳轉鈕：只畫還有的那幾塊
  const C = S.ui.cls, el = $('cls-jump'); if (!C || !el) return;
  el.innerHTML = CLS_KEYS.filter((k) => C[k] && C[k].s !== 'miss').map((k) => `<button type="button" class="btn sm ghost" data-act="clsJump" data-to="cls-${k}">${CLS_TITLE[k]}</button>`).join('');
}
function clsNone() {   // 三塊都沒好：不空白，畫一句話
  const C = S.ui.cls, el = $('cls-none'); if (!C || !el) return;
  el.innerHTML = CLS_KEYS.every((k) => C[k] && C[k].s === 'miss') ? '<div class="card" id="cls-none-card"><p style="margin:0">上課的功能還沒開放，請先找育才仕。</p></div>' : '';
}
// 從 #/book 進來：預約一對一那塊畫好之後捲過去（上面兩塊晚到會把它擠下去，所以每塊畫完都再對一次，三塊都讀完才收手）
function clsSettle(C) {
  if (C.to !== 'book') return;
  if (C.book && C.book.s === 'ok') { const t = $('cls-book'); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start' }); }
  if (CLS_KEYS.every((k) => C[k] && C[k].s !== 'load')) C.to = '';
}
async function viewClass(to) {
  setTab('');
  const C = S.ui.cls = { my: S.rt, to: to === 'book' ? 'book' : '', mine: { s: 'load' }, list: { s: 'load' }, book: { s: 'load' } };
  view('<div class="row acct-jump" id="cls-jump"></div><div id="cls-mine"></div><div id="cls-list"></div><div id="cls-book"></div><div id="cls-none"></div>');
  CLS_KEYS.forEach((k) => clsDraw(k));
  CLS_KEYS.forEach((k) => { clsLoad(k).catch((e) => console.warn('cls', k, e && e.message)); });
  return C;
}
ACT.clsJump = (el) => { const t = $(el.dataset.to); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
ACT.clsRetry = (el) => { clsLoad(el.dataset.k).catch((e) => console.warn('cls', e && e.message)); };
