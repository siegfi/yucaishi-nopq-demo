'use strict';
// 2026-11-25 第 ① 步：首頁行程卡。讀 my_schedule()（後端 29l 多回 today 與每件的 daysLeft）；天數只用後端的 daysLeft，不用手機時鐘算。
// 回傳沒有 today、或函式不存在：整張卡不畫。卡不用 .card.active、不用 data-loading（看門狗會把它換成整頁失敗卡）。
// 畫面上的字：行程、下一個截止、還有 n 天、今天截止、看全部日期、選好志願那一句（12_五入口畫面稿_說明_v0.1.md 第 4 節新字表第 12、15、16、20、21 列）；收起＝待確認表第 84 條。
// 2026-11-25 第 ③ 步：行程卡加課（my_schedule 的 classes）與〔看上課頁〕；字照 nopq_step3_class_frontend_plan_20261125.md 第 4 節新字表第 13、14 行（課、申請、看上課頁）。

const SCHED = { r: null, open: false };
const SCHED_WD = '日一二三四五六';
const schedYmd = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? [+m[1], +m[2], +m[3]] : null; };
function schedDate(s) {   // 「2027-05-04」→「5/4（二）」；用年月日拆開組，不用 new Date(字串)（會被當零時區）
  const p = schedYmd(s); if (!p) return '';
  return `${p[1]}/${p[2]}（${SCHED_WD[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()]}）`;
}
// 把 events 與 general 攤成一串，照日期排；同一天、同一件事的系併成一列
function schedItems(r) {
  const out = [];
  (r.events || []).forEach((e) => {
    if (!schedYmd(e.date)) return;
    out.push({ date: String(e.date).slice(0, 10), end: e.endDate ? String(e.endDate).slice(0, 10) : '', kind: e.kind || '', label: e.label || '', name: (e.schoolName || '') + (e.name || ''), daysLeft: e.daysLeft });
  });
  (r.general || []).forEach((g) => {
    if (!schedYmd(g.dateFrom)) return;
    out.push({ date: String(g.dateFrom).slice(0, 10), end: g.dateTo ? String(g.dateTo).slice(0, 10) : '', kind: 'general', label: g.label || '', name: '', daysLeft: g.daysLeft });
  });
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const by = new Map(), rows = [];
  out.forEach((x) => {
    const k = x.date + '|' + x.kind + '|' + x.label; let g = by.get(k);
    if (!g) { g = Object.assign({}, x, { names: [] }); by.set(k, g); rows.push(g); }
    if (x.name && !g.names.includes(x.name)) g.names.push(x.name);
  });
  return rows;
}
const schedWho = (g) => (g.names.length > 1 ? `${g.names[0]} 等 ${g.names.length} 系` : g.names[0] || '');
function schedTail(g) {   // 還有 n 天；當天的繳交截止寫「今天截止」。n 一律是後端的 daysLeft
  const n = g.daysLeft; if (typeof n !== 'number') return '';
  return n > 0 ? `還有 ${n} 天` : n === 0 && g.kind === 'uploadDeadline' ? '今天截止' : '';
}
function schedRowHtml(g) {
  const dt = schedDate(g.date) + (g.end && g.end !== g.date ? '～' + schedDate(g.end) : ''), who = schedWho(g), tail = schedTail(g);
  return `<div class="sched-row"><span><span class="pill">申請</span>　<b>${esc(dt)}</b>　${esc(g.label)}${who ? '　' + esc(who) : ''}</span>${tail ? `<span class="muted">${esc(tail)}</span>` : ''}</div>`;   // 2026-11-25 第 ③ 步：小標「申請」（全站共同日期也標）
}
// 2026-11-25 第 ③ 步：課（my_schedule 的 classes；一對一 kind 是 tutor、直播課 kind 是 live）。日期與時間一律換成台北時間；daysLeft 是後端算的，負的（今天以前）不列；今天稍早已結束的課後端還會回，這裡不用手機時鐘去濾
function schedTp(iso) {
  try {
    const d = new Date(iso); if (!iso || isNaN(d)) return null;
    const ps = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
    const g = (k) => { const x = ps.find((q) => q.type === k); return x ? x.value : ''; };
    const y = Number(g('year')), mo = Number(g('month')), da = Number(g('day')); if (!y || !mo || !da) return null;
    return { date: `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`, hm: String(g('hour')).padStart(2, '0') + ':' + String(g('minute')).padStart(2, '0') };
  } catch (e) { return null; }
}
function schedClassItems(r) {
  const out = [];
  (Array.isArray(r.classes) ? r.classes : []).forEach((c) => {
    if (!c || (typeof c.daysLeft === 'number' && c.daysLeft < 0)) return;
    const tp = schedTp(c.startsAt); if (!tp) return;
    out.push({ date: tp.date, t: tp.hm, kind: 'class', label: c.title || '', teacher: c.teacherName || '', daysLeft: c.daysLeft });
  });
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  return out;
}
const schedCmp = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.kind === 'class' ? 0 : 1) - (b.kind === 'class' ? 0 : 1));   // 同一天課排在申請日期前面；其餘維持原順序（Array.sort 是穩定的）
function schedClassRowHtml(g) {
  return `<div class="sched-row"><span><span class="pill">課</span>　<b>${esc(schedDate(g.date))}${esc(g.t)}</b>　${esc(g.label)}${g.teacher ? '　' + esc(g.teacher) : ''}</span></div>`;
}
function schedCardHtml(r, open) {
  const all = schedItems(r), hasDepts = !!(r.depts && r.depts.length);
  const upc = all.filter((g) => typeof g.daysLeft !== 'number' || g.daysLeft >= 0);   // 申請日期：展開也只列今天以後的（過了的日期不再列）
  const cs = schedClassItems(r).slice(0, 2), apTop = upc.slice(0, 3 - cs.length), top = cs.concat(apTop).sort(schedCmp);   // 2026-11-25 第 ③ 步：接下來三件＝課最多 2 件，其餘補申請日期；展開只列申請日期、不列課（課在上課頁看全部）
  const rows = open ? upc : top;
  const nx = hasDepts ? upc.find((g) => g.kind === 'uploadDeadline') : null;
  const next = nx ? `<p class="sched-next"><b>下一個截止：${esc(schedDate(nx.date))}</b>${schedWho(nx) ? '　' + esc(schedWho(nx)) : ''}${schedTail(nx) ? '　<b>' + esc(schedTail(nx)) + '</b>' : ''}</p>` : '';
  const hint = hasDepts ? '' : '<div class="hint" style="margin:0 0 6px">選好志願，這裡會排出每一系的繳交截止、面試／口試、放榜。</div>';
  const more = upc.length > apTop.length ? `<button type="button" class="btn sm ghost" data-act="schedMore" aria-expanded="${open ? 'true' : 'false'}">${open ? '收起' : '看全部日期'}</button>` : '';   // 有沒有「還沒列出的申請日期」才出現，不算課
  const acts = `<div class="row" style="margin-top:8px">${more}<a class="btn sm ghost" id="sched-class" href="#/class">看上課頁</a></div>`;   // 卡一出現就有〔看上課頁〕，不論有沒有課
  return `<div class="card" id="sched-card"><h2>行程</h2>${schedPendHtml(r)}${next}${hint}${rows.map((g) => (g.kind === 'class' ? schedClassRowHtml(g) : schedRowHtml(g))).join('')}${acts}</div>`;
}
// 2026-11-25 第 ② 步：待付款訂單提醒（my_schedule 的 pendingOrders；後端 29m 只列沒逾時的、每張帶 expiresAt）。沒有 pendingOrders 或空的就不畫；期限用 shopDue（台北時間），沒有 shopDue 或沒有 expiresAt 就不寫期限
function schedPendHtml(r) {
  const list = Array.isArray(r.pendingOrders) ? r.pendingOrders : []; if (!list.length) return '';
  const money = (n) => (typeof shopMoney === 'function' ? shopMoney(n) : Number(n || 0).toLocaleString('en-US'));
  const sum = list.reduce((a, o) => a + (Number(o.totalTwd) || 0), 0);
  const dues = list.map((o) => ({ t: Date.parse(o.expiresAt || ''), iso: o.expiresAt })).filter((x) => !isNaN(x.t)).sort((a, b) => a.t - b.t);
  const due = dues.length && typeof shopDue === 'function' ? shopDue(dues[0].iso) : '';
  const t = list.length === 1 ? '有一張待付款訂單' : `有 ${list.length} 張待付款訂單`;
  const sub = list.length === 1 ? `${money(sum)} 元${due ? `，請在 ${due} 前付款。` : ''}` : `合計 ${money(sum)} 元${due ? `，最早的一張請在 ${due} 前付款。` : ''}`;
  return `<div class="sched-pend" id="sched-pend"><div><b>${esc(t)}</b><div class="muted">${esc(sub)}</div></div><a class="btn sm" href="#/acct">看訂單</a></div>`;
}
function schedErrHtml(msg) {
  return `<div class="card" id="sched-card"><h2>行程</h2><div class="state state-error" style="margin:0"><p style="margin:0">${esc(msg)}</p><div class="state-act"><button type="button" class="btn" data-act="schedRetry">重新載入</button></div></div></div>`;
}
// 首頁其他卡先畫；行程卡晚到再填，不卡住首頁（core.js viewHome 畫好之後呼叫）
async function homeSched(my) {
  const slot = $('home-sched'); if (!slot) return;
  slot.innerHTML = '<div class="state state-loading">正在讀你的資料…</div>';
  const keep = lastFailMsg; let r = null, miss = false, msg = '';
  try { r = await call('my_schedule', {}, { quiet: true }); }
  catch (e) {
    if (e && (e.message === 'AUTH' || /^NOT_/.test(e.message))) return;
    msg = (e && e.message === 'NET' && lastFailMsg) || '請檢查網路，再按「重新載入」。';
    if (e && e.message === 'NET') { try { const pr = await sb.rpc('my_schedule', {}); miss = !!(pr.error && pr.error.code === 'PGRST202'); } catch (e2) { /* 探不到就當一般連線失敗 */ } }
  }
  lastFailMsg = keep;
  if (my !== S.rt || $('home-sched') !== slot) return;   // 已經換頁，不蓋掉新的一頁
  if (miss) { slot.remove(); return; }
  if (!r) { slot.innerHTML = schedErrHtml(msg); return; }
  if (r.ok === false) { slot.innerHTML = schedErrHtml(errText(r)); return; }
  if (r.today == null) { slot.remove(); return; }   // 後端還沒多回 today：整張卡不畫
  SCHED.r = r; SCHED.open = false; slot.innerHTML = schedCardHtml(r, false);
}
ACT.schedMore = () => { const slot = $('home-sched'); if (!slot || !SCHED.r) return; SCHED.open = !SCHED.open; slot.innerHTML = schedCardHtml(SCHED.r, SCHED.open); };
ACT.schedRetry = () => { homeSched(S.rt); };
