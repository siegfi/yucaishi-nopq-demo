'use strict';
// ── 購買（#/shop）與預約一對一（#/book）──
// 2026-11-13 改版建議第 38 條（owner 轉交 1113.docx：「沒有課程購買頁、以及跟預約時間排程頁」）。後端 profile-db/28p_booking.sql。
// 寫法跟學生頁其他分頁一樣（用 core.js 的 call／view／loading／toast／esc／setTab／S／ACT／IN）：
//   接進學生頁＝index.html 加 <script src="../shop/shop.js">、core.js 的路由表加 '#/shop': viewShop, '#/book': viewBook（由學生頁施工線動手）。
//   接進去之前由同資料夾的 index.html 小外殼提供上面那幾個，獨立網址 /shop/ 測。
// 規矩：錢照舊人工收（下單＝一張待付款訂單，育才仕確認收到款項後額度才出現）；畫面不寫任何期限、條款與退費規則，期限只照後台設定顯示。
// 全域名稱一律 shop／SHOP_／bk 開頭，避免跟學生頁其他檔撞名。
const SHOP_ERR = {
  PAYER_REQUIRED: '請把付款的家長資料填完整：姓名、關係、聯絡方式。', PAYER_GUARDIAN_CONFIRM_REQUIRED: '請勾選「付款的家長是我的法定代理人，同意這筆購買」。',
  TOO_MANY_PENDING: '你已經有 5 張待付款的訂單。請先付款，或取消用不到的，再下新的一張。', PRODUCT_NOT_FOUND: '有商品剛下架或改了，已為你更新畫面，請再選一次。',
  QTY_INVALID: '數量要在 1 到 20 之間。', ITEMS_REQUIRED: '請先選要買的項目。', DUPLICATE_PRODUCT: '同一個項目請合在一起選數量。',
  CLIENT_REQUEST_ID_TAKEN: '這一張沒有送出，請重新整理再試一次。', ORDER_NOT_FOUND: '找不到這張訂單，已為你更新畫面。', ORDER_NOT_PENDING: '這張訂單已經不是待付款，已為你更新畫面。',
  NOT_ENOUGH_HOURS: '你的時數不夠約這一段。', SLOT_TAKEN: '這段剛被別人約走了，已為你更新畫面。', SLOT_NOT_OPEN: '這段已經不開放了，已為你更新畫面。',
  SLOT_NOT_FOUND: '找不到這段時間，已為你更新畫面。', STUDENT_BUSY: '這段時間你已經約了別堂一對一。', SAME_SLOT: '這就是你原本約的那一段，請選別的時間。',
  TOO_LATE_TO_CHANGE: '離上課時間太近，不能自己改期或取消，請直接找老師。', BOOKING_NOT_FOUND: '找不到這筆預約，已為你更新畫面。',
  BOOKING_NOT_ACTIVE: '這筆預約已經取消或上完了，已為你更新畫面。', VALIDATION: '資料格式不對，請檢查後再送出。', VALIDATION_FAILED: '資料格式不對，請檢查後再送出。',
};
const shopErr = (r) => SHOP_ERR[r.error] || (typeof errText === 'function' ? errText(r) : '這個動作沒做成，請再按一次。還是不行，請把畫面截圖給育才仕。');
const SHOP_STATUS = { pending: ['待付款', 'warn'], paid: ['已付款', 'ok'], cancelled: ['已取消', ''], refunded: ['已退款', ''], partiallyRefunded: ['部分退款', ''] };
const SHOP_KIND = { reviewRound: '完整批改', autoDept: '訪談成稿', tutorHour: '一對一' };
const SHOP_UNIT = { reviewRound: '次', autoDept: '個科系', tutorHour: '小時' };
const shopMoney = (n) => Number(n || 0).toLocaleString('en-US');
const SHOP_WD = '日一二三四五六', shopP2 = (n) => String(n).padStart(2, '0');
const shopDT = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getMonth() + 1}/${d.getDate()}（${SHOP_WD[d.getDay()]}）${shopP2(d.getHours())}:${shopP2(d.getMinutes())}`; };
const shopHM = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${shopP2(d.getHours())}:${shopP2(d.getMinutes())}`; };
const shopDay = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
// 2026-11-25 第 ② 步：待付款期限一律用台北時間（shopDT 用手機時區，學生在國外或手機時區不對，期限就會錯）。取 formatToParts 的各段自己組字；失敗回空字串＝當沒有期限。
// 時刻用 hourCycle:'h23'（不用 hour12:false，午夜在部分環境會顯示成 24 點）。
const shopDue = (iso) => {
  try {
    const d = new Date(iso); if (!iso || isNaN(d)) return '';
    const ps = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
    const g = (t) => { const x = ps.find((p) => p.type === t); return x ? x.value : ''; };
    const y = Number(g('year')), mo = Number(g('month')), da = Number(g('day'));
    if (!y || !mo || !da) return '';
    return `${mo}/${da}（${SHOP_WD[new Date(Date.UTC(y, mo - 1, da)).getUTCDay()]}）${shopP2(g('hour'))}:${shopP2(g('minute'))}`;
  } catch (e) { return ''; }
};
// 這兩頁自己的幾條樣式（接進學生頁時不用改 app.css）
(function shopCss() {
  if (document.getElementById('shop-css')) return;
  const st = document.createElement('style'); st.id = 'shop-css';
  st.textContent = '.shop-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:6px 0 4px}.shop-tile{border:1px solid var(--line);border-radius:6px;padding:8px;font-size:var(--fs-sm);color:var(--muted);background:var(--white)}'
    + '.shop-tile b{display:block;font-size:24px;line-height:1.15;color:var(--main)}.shop-price{color:var(--main);font-size:18px;white-space:nowrap}';
  document.head.appendChild(st);
})();
const shopRid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
// ── 2026-11-25 第 ② 步：購物車（只存代號與數量，價錢每次從 my_shop 讀）──
// 存瀏覽器：重用 core.js 的 keepGet／keepSet／keepClear，鍵是 ycs-keep:<S.uid>:cart（鍵含使用者代號：甲登出、乙在同一台登入，乙看不到甲的購物車）。
// S.uid 是空的、或沒有這組函式（獨立購買頁 shop/index.html）就只留記憶體。每一處讀寫都包 try/catch，存不到照樣能用。
const SHOP_CART_SCOPE = 'cart', SHOP_QTY_MAX = 20;
const cartPersist = () => { try { return typeof keepGet === 'function' && typeof keepSet === 'function' && typeof keepClear === 'function' && !!S.uid; } catch (e) { return false; } };
function cartRead() {   // 回 { 商品代號: 數量 }；只收 1～20 的整數；讀不到、格式不對都回 {}
  const out = {};
  try {
    if (!cartPersist()) return out;
    const d = keepGet(SHOP_CART_SCOPE); if (!d) return out;
    const q = (JSON.parse(d.v) || {}).q || {};
    Object.keys(q).forEach((c) => { const n = q[c]; if (Number.isInteger(n) && n >= 1 && n <= SHOP_QTY_MAX) out[c] = n; });
  } catch (e) { /* 讀不到就當空的 */ }
  return out;
}
function cartSave() {   // 把 S.ui.shop.qty 存起來；存不了就算了（畫面照常用，只是重新整理後會掉）
  try {
    const u = S.ui && S.ui.shop; if (!u || !cartPersist()) return;
    const q = {}; Object.keys(u.qty || {}).forEach((c) => { if (u.qty[c] > 0) q[c] = u.qty[c]; });
    if (Object.keys(q).length) keepSet(SHOP_CART_SCOPE, JSON.stringify({ q }), ''); else keepClear(SHOP_CART_SCOPE);
  } catch (e) { /* 存不了不影響使用 */ }
}
const cartCount = () => { const q = (S.ui && S.ui.shop && S.ui.shop.qty) || cartRead(); return Object.keys(q).filter((c) => q[c] > 0).length; };   // 件數＝項數（一對一買 2 小時算 1 項）
function cartHead() {   // 畫頂欄的件數；找不到 #cart-n（獨立購買頁外殼）就什麼都不做
  const el = document.getElementById('cart-n'), a = document.getElementById('cart-link'); if (!el || !a) return;
  const n = cartCount();
  el.textContent = n ? String(n) : ''; el.classList.toggle('hidden', !n);
  a.setAttribute('aria-label', n ? `購物車（${n} 項）` : '購物車');
}
const shopBlankPayer = () => ({ name: '', relation: '', contact: '', isGuardian: false });
function shopState() {   // S.ui.shop：沒有就用瀏覽器存的購物車建起來
  if (!S.ui.shop) S.ui.shop = { qty: cartRead(), payer: shopBlankPayer(), rid: shopRid(), last: null, cancelAsk: null, dropped: 0, carry: false, over: false };
  return S.ui.shop;
}
function shopRebuild() {   // 讀到 my_shop 之後重建 S.ui.shop：購物車、付款的家長、請求代號、剛送出的單照舊；carry＝從別頁轉回來，下架提示要留著
  const old = S.ui.shop || {};
  S.ui.shop = { qty: old.qty || cartRead(), payer: old.payer || shopBlankPayer(), rid: old.rid || shopRid(), last: old.last || null, cancelAsk: null,
    dropped: old.carry ? (old.dropped || 0) : 0, carry: false, over: !!old.over };
  return S.ui.shop;
}
// 照 my_shop 的商品表校正購物車：下架的拿掉、數量裁到 1～20；回傳拿掉幾項，累加記在 dropped（畫面照 cartDropHtml 說一聲，不再靜默）。carry＝等學生打開購物車或購買頁時才說
function cartReconcile(d, carry) {
  const u = shopState(), codes = new Set(((d && d.products) || []).map((p) => p.code)); let gone = 0;
  Object.keys(u.qty).forEach((c) => {
    const n = Math.min(SHOP_QTY_MAX, Math.floor(Number(u.qty[c])));
    if (!codes.has(c)) { delete u.qty[c]; gone++; } else if (n >= 1) u.qty[c] = n; else delete u.qty[c];
  });
  if (gone) { u.dropped = (u.dropped || 0) + gone; if (carry) u.carry = true; }
  cartSave(); cartHead();
  return gone;
}
// 開機（core.js enter）：購物車有東西才背景讀一次 my_shop，把已下架的拿掉、頂欄件數校正；空車不多叫；讀不到就維持原數字（不跳錯、不動 lastFailMsg），同一次登入只做一次
async function cartSync() {
  try {
    const u = shopState(); if (S.ui.cartSynced || !S.uid || !Object.keys(u.qty).length) return;
    S.ui.cartSynced = true; const me = S.uid, keep = lastFailMsg;
    try { const r = await call('my_shop', {}, { quiet: true }); if (S.uid === me && r && r.ok && Array.isArray(r.products)) cartReconcile(r, true); } catch (e) { /* 讀不到就維持原來的件數 */ }
    lastFailMsg = keep;
  } catch (e) { /* 不影響開機 */ }
}
const cartDropHtml = (u) => (u && u.dropped > 0 ? `<div class="hint" id="cart-dropped" role="status">有 ${u.dropped} 項商品剛下架，已從購物車拿掉。</div>` : '');
function shopCartSummary(d) {   // 購物車裡還在架上的：{ n: 項數, total: 合計, lines: [{ p, n, amt }] }
  const q = (S.ui && S.ui.shop && S.ui.shop.qty) || {}, lines = []; let total = 0;
  ((d && d.products) || []).forEach((p) => { const n = q[p.code] || 0; if (n > 0) { const amt = p.priceTwd * n; total += amt; lines.push({ p, n, amt }); } });
  return { n: lines.length, total, lines };
}
// 每個商品「買到什麼、怎麼用」：照商品表的額度種類與含幾個單位寫，之後改單位或價格不用改這裡
function shopWhat(p) {
  const n = p.unitsPerQty;
  if (p.quotaKind === 'reviewRound') return { what: `一篇稿，可以交給老師改 ${n} 次。每次是你交稿、老師改完還你。`, use: '交稿給老師批改時用；一篇用一份。' };
  if (p.quotaKind === 'autoDept') return { what: `${n} 個科系的稿。你先回答幾題自己的經歷，再照育才仕老師的標準寫成該系的就讀動機與未來學習計畫`, use: '付款後育才仕會跟你聯絡安排。' };
  if (p.quotaKind === 'tutorHour') return { what: n > 1 ? `一對一 ${n} 小時，可以分次約，每次最少一小時` : '一對一一小時', use: '付款後到「預約一對一」選老師開的時段。' };
  return { what: p.name, use: '' };
}

// 讀資料：失敗時分兩種——後端還沒套 28p（函式不存在，PGRST202；例如示範庫或雲端還沒更新）→ 說「還沒開通」；其他（斷線、逾時）→ 照學生頁的重新載入卡
const SHOP_NOT_READY = '<div class="card" id="shop-not-ready"><h2>購買與預約還沒開通</h2><p class="muted">購買和預約功能還沒開放。要買或約一對一，請先找育才仕。</p></div>';
async function shopLoad(reads) {
  const my = S.rt;
  try {
    const rs = await Promise.all(reads.map(([fn, args]) => call(fn, args || {}, { quiet: true })));
    const bad = rs.find((r) => !r.ok);
    if (bad) { if (my === S.rt) view(failCard(shopErr(bad))); return null; }
    return my === S.rt ? rs : null;
  } catch (e) {
    if (e && e.message !== 'NET') throw e;   // 登入過期、不是學生：call 已經處理
    let missing = false;
    try { const pr = await sb.rpc(reads[0][0], reads[0][1] || {}); missing = !!(pr.error && pr.error.code === 'PGRST202'); } catch (e2) { /* 探不到就當一般連線失敗 */ }
    if (my === S.rt) view(missing ? SHOP_NOT_READY : failCard(lastFailMsg || '請檢查網路，再按「重新載入」。'));
    return null;
  }
}

// ═════════ 購買頁（2026-11-25 第 ② 步起：這裡是選品頁；選好的放進購物車，到 #/cart 結帳）═════════
async function viewShop() {
  setTab('shop'); view(loading); const my = S.rt;
  const rs = await shopLoad([['my_shop']]); if (!rs || my !== S.rt) return; const d = rs[0];
  S.ui.shopData = d;
  shopRebuild(); cartReconcile(d);   // 2026-11-25 第 ② 步：下架的商品拿掉並記下幾項（原本靜默濾掉），頁首說一聲
  renderShop();
}
function renderShop() {
  const d = S.ui.shopData, u = S.ui.shop, sm = shopCartSummary(d);
  const cards = d.products.map((p) => {
    const w = shopWhat(p), q = u.qty[p.code] || 0;
    return `<div class="card shop-p" data-code="${esc(p.code)}"><div class="row spread"><h3 style="margin:0">${esc(p.name)}</h3><b class="shop-price">${shopMoney(p.priceTwd)} 元</b></div>
      <p style="margin:6px 0 2px">${esc(w.what)}</p>${w.use ? `<p class="muted small" style="margin:0 0 8px">${esc(w.use)}</p>` : ''}
      <div class="row"><button type="button" class="btn sm ghost" data-act="shopQty" data-code="${esc(p.code)}" data-d="-1" ${q ? '' : 'disabled'} aria-label="少一份">－</button><span class="shop-q" style="min-width:4.5em;text-align:center">${q ? `${q} 份` : '還沒選'}</span><button type="button" class="btn sm ghost" data-act="shopQty" data-code="${esc(p.code)}" data-d="1" ${q >= 20 ? 'disabled' : ''} aria-label="多一份">＋</button></div></div>`;
  }).join('');
  // 2026-11-25 第 ② 步：「這次要買的」改成購物車摘要；付款的家長、須知、〔送出訂單〕搬到購物車第 2、3 步（#/cart2、#/cart3）
  const cart = `<div class="card ${sm.n ? 'active' : ''}" id="shop-cart"><h2>${sm.n ? `購物車（${sm.n} 項，合計 <span id="shop-total">${shopMoney(sm.total)}</span> 元）` : '購物車'}</h2>${sm.n ? `<ul class="plain" style="padding-left:18px;margin:4px 0">${sm.lines.map((x) => `<li>${esc(x.p.name)} × ${x.n}：${shopMoney(x.amt)} 元</li>`).join('')}</ul><div style="margin-top:10px"><a class="btn" id="shop-gocart" href="#/cart">去購物車</a></div>` : '<p class="muted" style="margin:4px 0">還沒選。在上面按「＋」選數量。</p>'}</div>`;
  const quota = shopQuotaHtml(d), orders = shopOrdersHtml(d, u);   // 2026-11-25 第 ① 步：額度、訂單兩段抽成函式（下面），帳號頁的購買卡共用；畫面不變
  view(`<div class="card"><h2>購買</h2><p class="muted" style="margin:0">選好項目和數量，放進購物車，到購物車一起結帳。</p></div>${cartDropHtml(u)}
    <div id="shop-products">${cards}</div>${cart}
    <div class="card" id="shop-quota"><h2>我的額度</h2>${quota}</div>
    <div class="card" id="shop-orders"><h2>我的訂單</h2>${orders}</div>`);
}
// 2026-11-25 第 ① 步：從 renderShop 抽出來的兩段（原文不動），讓學生頁帳號頁（#/acct）的購買卡共用
function shopQuotaHtml(d) {
  return d.quota && d.quota.length ? d.quota.map((q) => `<div class="row spread" style="padding:4px 0;border-top:1px solid var(--line)"><span>${esc(SHOP_KIND[q.quotaKind] || q.quotaKind)}</span><span><b>還有 ${q.remainingUnits} ${esc(SHOP_UNIT[q.quotaKind] || '')}</b><span class="muted small">（共 ${q.totalUnits}、用掉 ${q.usedUnits}${q.nextExpiresAt ? `；最近一份到 ${esc(shopDay(q.nextExpiresAt))}` : ''}）</span></span></div>`).join('')
    + (d.quota.some((q) => q.quotaKind === 'tutorHour' && q.remainingUnits > 0) ? '<div style="margin-top:8px"><a class="btn sm" href="#/book">去預約一對一</a></div>' : '')
    : '<p class="muted" style="margin:4px 0">你還沒有可用的額度。付款後，這裡會列出能交幾篇稿、能約幾小時。</p>';
}
function shopOrdersHtml(d, u) {
  return d.orders.length ? d.orders.map((o) => {
    const exp = o.status === 'pending' && o.isExpired === true;   // 2026-11-25 第 ② 步：後端 29m 才有 isExpired；沒有就當沒逾時
    const st = exp ? ['已逾時', 'bad'] : (SHOP_STATUS[o.status] || [o.status, '']), ask = u.cancelAsk === o.id;
    const due = o.status === 'pending' && !exp && o.expiresAt ? shopDue(o.expiresAt) : '';   // 台北時間；空字串＝不寫
    return `<div class="shop-o" data-order="${esc(o.id)}" style="padding:8px 0;border-top:1px solid var(--line)"><div class="row spread"><span><b>${esc(o.orderNo)}</b> <span class="muted small">${esc(shopDay(o.createdAt))}</span></span><span><span class="pill ${st[1]}">${esc(st[0])}</span> <b>${shopMoney(o.totalTwd)} 元</b></span></div>
      <div class="small">${(o.items || []).map((i) => `${esc(i.productName)} × ${i.qty}`).join('、')}${o.payerName ? `<span class="muted">｜付款：${esc(o.payerName)}${o.payerRelation ? `（${esc(o.payerRelation)}）` : ''}</span>` : ''}</div>
      ${due ? `<div class="small">請在 ${esc(due)} 前付款。</div>` : ''}${exp ? '<div class="small" style="margin-top:4px">這張已過付款期限。如果你已經付款，請聯絡育才仕，不用再下單。還沒付款、還要買的話，可以到購物車再選一次，開一張新的。</div><div style="margin-top:4px"><a class="btn sm" href="#/cart">重新下一張</a></div>' : ''}
      ${o.status === 'pending' ? (ask ? `<div class="hint"><div>取消這張訂單？取消後就不用付款了。</div><div class="row" style="margin-top:6px"><button type="button" class="btn sm warn" data-act="shopCancelGo" data-id="${esc(o.id)}">確定取消</button><button type="button" class="btn sm ghost" data-act="shopCancelNo">先不要</button></div></div>` : `<div style="margin-top:4px"><button type="button" class="btn sm ghost" data-act="shopCancelAsk" data-id="${esc(o.id)}">取消這張</button></div>`) : ''}</div>`;
  }).join('') : '<p class="muted" style="margin:4px 0">還沒有訂單。</p>';
}
ACT.shopQty = (el) => {
  const u = S.ui.shop, c = el.dataset.code, n = Math.max(0, Math.min(20, (u.qty[c] || 0) + Number(el.dataset.d)));
  if (n) u.qty[c] = n; else delete u.qty[c];
  u.last = null; u.dropped = 0; cartSave(); cartHead(); renderShop();   // 2026-11-25 第 ② 步：改數量就存起來、頂欄件數跟著變
};
IN.shopPayer = (el) => { S.ui.shop.payer[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; };
// 2026-11-25 第 ② 步：付款的家長沒填齊（未成年或年齡未確認才要）：回現有那兩句，齊了回空字串
const shopPayerErr = (d, u) => {
  if (d.student.ageStatus === 'adult') return '';
  const p = u.payer, nm = String(p.name || '').trim(), ct = String(p.contact || '').trim();
  if (!nm || !p.relation || !ct) return SHOP_ERR.PAYER_REQUIRED;
  return p.isGuardian ? '' : SHOP_ERR.PAYER_GUARDIAN_CONFIRM_REQUIRED;
};
const shopHashPath = () => String(location.hash || '').split('?')[0];
// 2026-11-25 第 ② 步：送不出去的三種情況不是照舊 toast 而已（舊寫法 PRODUCT_NOT_FOUND 會 viewShop，在第 3 步變成選品頁）
function shopOrderFail(r) {
  toast(shopErr(r), true);
  if (r.error === 'PRODUCT_NOT_FOUND') { S.ui.shop.carry = true; location.hash = '#/cart'; return; }   // 回購物車重讀：下架的拿掉並說一聲
  if (r.error === 'TOO_MANY_PENDING') { S.ui.shop.over = true; if (shopHashPath() === '#/cart3') viewCart3(); }   // 第 3 步當場列出待付款的單，可以取消
}
ACT.shopOrder = async (el) => {
  const d = S.ui.shopData, u = S.ui.shop, minor = d.student.ageStatus !== 'adult';
  const items = Object.keys(u.qty).filter((c) => u.qty[c] > 0).map((c) => ({ productCode: c, qty: u.qty[c] }));
  if (!items.length) return toast(SHOP_ERR.ITEMS_REQUIRED, true);
  const pz = { name: String(u.payer.name || '').trim(), relation: u.payer.relation || '', contact: String(u.payer.contact || '').trim(), isGuardian: !!u.payer.isGuardian };
  const pe = shopPayerErr(d, u); if (pe) return toast(pe, true);
  el.disabled = true;
  let r; try { r = await call('my_create_order', { p: { items, payer: minor ? pz : {}, clientRequestId: u.rid } }, { quiet: true }); } finally { el.disabled = false; }
  if (!r.ok) return shopOrderFail(r);
  S.ui.shop = { qty: {}, payer: u.payer, rid: shopRid(), last: r.order, cancelAsk: null, dropped: 0, carry: false, over: false };   // 下一張用新的請求編號
  cartSave(); cartHead(); toast('已送出，開了一張待付款訂單。');
  if (shopHashPath() === '#/cart3') renderCart3();   // 同頁換成「送出之後」；人已經離開第 3 步就不重畫
};
ACT.shopCancelAsk = (el) => { S.ui.shop.cancelAsk = el.dataset.id; shopRefresh(); };
ACT.shopCancelNo = () => { S.ui.shop.cancelAsk = null; shopRefresh(); };
// 2026-11-25 第 ① 步：取消訂單那幾顆鈕在帳號頁（#/acct）也會按到：在帳號頁就重畫那張購買卡，其他照舊（fresh＝要重讀資料）
function shopRefresh(fresh) {
  if (location.hash.indexOf('#/acct') === 0 && typeof acctShopRefresh === 'function') return acctShopRefresh(fresh);
  if (location.hash.indexOf('#/cart3') === 0) return fresh ? viewCart3() : renderCart3();   // 2026-11-25 第 ② 步：結帳第 3 步的「待付款的訂單」卡也有取消鈕
  return fresh ? viewShop() : renderShop();
}
ACT.shopCancelGo = async (el) => {
  el.disabled = true; let r; try { r = await call('my_cancel_order', { p_order_id: el.dataset.id }, { quiet: true }); } finally { el.disabled = false; }
  S.ui.shop.cancelAsk = null; S.ui.shop.last = null;
  if (!r.ok) { toast(shopErr(r), true); return shopRefresh(true); }
  toast('已取消這張訂單。'); shopRefresh(true);
};

// ═════════ 購物車三步（2026-11-25 第 ② 步）：#/cart 看車、#/cart2 付款的家長與須知、#/cart3 確認後送出 ═════════
const cartSteps = (now, all) => `<ol class="cart-steps" id="cart-steps" aria-label="結帳三步">${['看車', '付款的家長與須知', '送出'].map((t, i) => `<li class="${all || i < now ? 'done' : i === now ? 'now' : ''}"${i === now && !all ? ' aria-current="step"' : ''}>${esc(t)}</li>`).join('')}</ol>`;
const cartBar = (inner) => `<div class="cartbar" id="cartbar"><div class="cartbar-in">${inner}</div></div><div class="cart-spacer" aria-hidden="true"></div>`;
const shopPendingCount = (d) => (d.orders || []).filter((o) => o.status === 'pending' && o.isExpired !== true).length;   // 後端上限不數已逾時的
// 付款的家長（未成年或年齡未確認才畫）：原本在購買頁，2026-11-25 第 ② 步搬到購物車第 2 步；欄位 id 與 IN.shopPayer 不變
function shopPayerHtml(u) {
  return `<h3>付款的家長</h3><p class="muted small" style="margin:0 0 4px">未滿 18 歲（或年齡還沒確認）的同學，要由家長付款，請填家長的資料。</p>
    <label class="f" for="sp-name">家長姓名（必填）</label><input type="text" id="sp-name" data-in="shopPayer" data-k="name" maxlength="50" value="${esc(u.payer.name)}">
    <label class="f" for="sp-rel">關係（必填）</label><select id="sp-rel" data-in="shopPayer" data-k="relation"><option value="">請選</option>${['父', '母', '其他監護人'].map((x) => `<option ${u.payer.relation === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <label class="f" for="sp-contact">聯絡方式（必填，電話或 Email）</label><input type="text" id="sp-contact" data-in="shopPayer" data-k="contact" maxlength="100" value="${esc(u.payer.contact)}">
    <label class="row" style="margin-top:10px;align-items:flex-start"><input type="checkbox" id="sp-guard" data-in="shopPayer" data-k="isGuardian" ${u.payer.isGuardian ? 'checked' : ''} style="margin-top:4px"><span>付款的家長是我的法定代理人，同意這筆購買。</span></label>`;
}
function cartLineHtml(x, edit) {
  const p = x.p, c = esc(p.code);
  if (!edit) return `<div class="cart-line cart-ro" data-code="${c}"><span class="cart-main">${esc(p.name)} × ${x.n}</span><b class="cart-amt">${shopMoney(x.amt)} 元</b></div>`;
  const w = shopWhat(p);
  return `<div class="cart-line" data-code="${c}"><div class="cart-main"><b>${esc(p.name)}</b><div class="muted small">${esc(w.what)}</div><div class="muted small">每份 ${shopMoney(p.priceTwd)} 元</div>
    <div class="row cart-qty"><button type="button" class="btn sm ghost" data-act="cartQty" data-code="${c}" data-d="-1" aria-label="少一個">－</button><span class="shop-q cart-q">${x.n} 份</span><button type="button" class="btn sm ghost" data-act="cartQty" data-code="${c}" data-d="1" ${x.n >= SHOP_QTY_MAX ? 'disabled' : ''} aria-label="多一個">＋</button><button type="button" class="btn sm ghost" data-act="cartDrop" data-code="${c}">拿掉</button></div></div>
    <b class="shop-price cart-amt">${shopMoney(x.amt)} 元</b></div>`;
}
// 三頁共用的讀取：讀 my_shop、校正購物車；回 d，或 null（已經換頁、讀不到、或轉走了）。第 2、3 步讀到下架／空車／家長沒填，一律轉回前面那一步
async function cartLoad(step) {
  setTab('cart'); view(loading); const my = S.rt;
  const rs = await shopLoad([['my_shop']]); if (!rs || my !== S.rt) return null; const d = rs[0];
  S.ui.shopData = d; const u = shopRebuild(), gone = cartReconcile(d);
  if (u.over && shopPendingCount(d) < 5) u.over = false;   // 取消到不滿 5 張，那張卡就收起來
  if (step > 1) {
    if (gone > 0) { u.carry = true; location.replace('#/cart'); return null; }
    if (!shopCartSummary(d).n && !(step === 3 && u.last)) { location.replace('#/cart'); return null; }
    if (step === 3 && !u.last && shopPayerErr(d, u)) { location.replace('#/cart2'); return null; }
  }
  return d;
}
// 第 1 步：看車
async function viewCart() { const d = await cartLoad(1); if (d) renderCart(); }
function renderCart() {
  const d = S.ui.shopData, u = S.ui.shop, sm = shopCartSummary(d);
  const body = sm.n
    ? `<div class="card" id="cart-list">${sm.lines.map((x) => cartLineHtml(x, true)).join('')}<div class="row spread cart-total"><span>合計</span><b><span id="cart-total">${shopMoney(sm.total)}</span> 元</b></div></div>
      <div class="row"><a class="btn ghost" href="#/shop">去購買</a><a class="btn ghost" href="#/acct">回帳號</a></div>`
    : '<div class="card" id="cart-empty"><p style="margin:0 0 10px">購物車是空的。</p><div class="row"><a class="btn" href="#/shop">去購買</a><a class="btn ghost" href="#/acct">回帳號</a></div></div>';
  view(`<div class="card"><h2>購物車${sm.n ? `（${sm.n} 項）` : ''}</h2>${cartSteps(0)}</div>${cartDropHtml(u)}${body}
    ${cartBar(`<span class="cartbar-sum">合計 <b>${shopMoney(sm.total)} 元</b></span>${sm.n ? '<a class="btn" id="cart-next" href="#/cart2">下一步</a>' : '<button type="button" class="btn" id="cart-next" disabled>下一步</button>'}`)}`);
}
function cartChange(el, drop) {
  const u = S.ui.shop, c = el.dataset.code;
  if (drop) delete u.qty[c]; else { const n = Math.max(0, Math.min(SHOP_QTY_MAX, (u.qty[c] || 0) + Number(el.dataset.d))); if (n) u.qty[c] = n; else delete u.qty[c]; }
  u.dropped = 0; cartSave(); cartHead(); renderCart();   // 不重讀後端
}
ACT.cartQty = (el) => cartChange(el, false);
ACT.cartDrop = (el) => cartChange(el, true);
// 第 2 步：付款的家長（未成年或年齡未確認才有）與須知
async function viewCart2() { const d = await cartLoad(2); if (d) renderCart2(); }
function renderCart2() {
  const d = S.ui.shopData, u = S.ui.shop, minor = d.student.ageStatus !== 'adult';
  view(`<a class="back" href="#/cart">回購物車</a><div class="card"><h2>付款的家長與須知</h2>${cartSteps(1)}</div>
    ${minor ? `<div class="card" id="cart-payer">${shopPayerHtml(u)}</div>` : ''}
    <div class="card" id="cart-notice"><h3>須知</h3><p style="margin:4px 0 0">送出後會開一張待付款的訂單。育才仕會在 1 個工作天內跟你聯絡付款方式，收到款後，額度才會出現在帳號頁的「我的額度」。</p></div>
    ${cartBar('<a class="btn ghost" href="#/cart">回上一步</a><button type="button" class="btn" id="cart-next" data-act="cartTo3">下一步</button>')}`);
}
ACT.cartTo3 = () => { const e = shopPayerErr(S.ui.shopData, S.ui.shop); if (e) return toast(e, true); location.hash = '#/cart3'; };
// 第 3 步：確認後送出；送出之後同頁換成「已開一張待付款訂單」
async function viewCart3() { const d = await cartLoad(3); if (d) renderCart3(); }
function renderCart3() {
  const d = S.ui.shopData, u = S.ui.shop;
  if (u.last) return renderCartDone();
  const sm = shopCartSummary(d), minor = d.student.ageStatus !== 'adult';
  const payer = minor ? `<div class="cart-line cart-ro"><span class="cart-main">付款的家長</span><span>${esc(u.payer.name)}（${esc(u.payer.relation)}）</span></div>` : '';
  const over = u.over ? `<div class="card" id="cart-over"><h2>待付款的訂單</h2><p style="margin:0 0 6px">${esc(SHOP_ERR.TOO_MANY_PENDING)}</p>${shopOrdersHtml({ orders: (d.orders || []).filter((o) => o.status === 'pending') }, u)}</div>` : '';
  view(`<a class="back" href="#/cart2">回上一步</a><div class="card"><h2>確認後送出</h2>${cartSteps(2)}</div>${over}
    <div class="card" id="cart-list">${sm.lines.map((x) => cartLineHtml(x, false)).join('')}${payer}<div class="row spread cart-total"><span>合計</span><b>${shopMoney(sm.total)} 元</b></div></div>
    ${cartBar(`<span class="cartbar-sum">合計 <b>${shopMoney(sm.total)} 元</b></span><button type="button" class="btn" data-act="shopOrder">送出訂單</button>`)}`);
}
function renderCartDone() {
  const o = S.ui.shop.last, due = o.expiresAt ? shopDue(o.expiresAt) : '';   // 沒有期限（後台沒設天數、或後端還沒套 29m）整句不寫
  view(`<div class="card"><h2>確認後送出</h2>${cartSteps(2, true)}</div>
    <div class="hint" id="shop-done" style="margin:0 0 12px">已開一張待付款訂單：編號 <b>${esc(o.orderNo)}</b>，金額 <b>${shopMoney(o.totalTwd)} 元</b>。${due ? `請在 ${esc(due)} 前付款。` : ''}育才仕會在 1 個工作天內跟你聯絡付款方式。收到款後，額度會出現在帳號頁的「我的額度」。</div>
    <div><a class="btn" href="#/acct">看我的訂單</a></div>`);
}

// ═════════ 預約一對一 ═════════
async function viewBook() {
  setTab('book'); view(loading); const my = S.rt;
  const rs = await shopLoad([['my_tutor'], ['tutor_open_slots', { p: {} }]]); if (!rs || my !== S.rt) return; const [t, o] = rs;
  const old = S.ui.bk || {};
  S.ui.bk = { tutor: t, slots: o.slots || [], teacher: old.teacher || '', ask: null, resched: null };
  if (S.ui.bk.teacher && !S.ui.bk.slots.some((s) => s.teacherId === S.ui.bk.teacher)) S.ui.bk.teacher = '';
  renderBook();
}
function renderBook() {
  const b = S.ui.bk, h = b.tutor.hours || { remaining: 0, reserved: 0, available: 0 }, now = Date.now();
  const lim = b.tutor.changeHoursBefore;
  const rule = lim == null ? '上課開始之前，都可以自己改期或取消。' : `上課開始前 ${lim} 小時內，要改期或取消請直接找老師。`;
  const head = `<div class="card" id="bk-hours"><h2>預約一對一</h2>
    <div class="shop-tiles"><div class="shop-tile"><b id="bk-avail">${h.available}</b>還能約的時數</div><div class="shop-tile"><b id="bk-reserved">${h.reserved}</b>已約、還沒上的時數</div><div class="shop-tile"><b id="bk-remaining">${h.remaining}</b>合計剩下的時數</div></div>
    <p class="muted small" style="margin:4px 0 0">上完課、老師按「已完成」才會扣時數。${esc(rule)}</p>
    ${h.remaining === 0 && !b.tutor.bookings.some((x) => x.status === 'booked') ? '<div class="hint">你還沒有一對一時數。先到「購買」買一對一，育才仕確認收到款項後就能約。<div style="margin-top:6px"><a class="btn sm" href="#/shop">去購買</a></div></div>' : ''}</div>`;
  const upcoming = b.tutor.bookings.filter((x) => x.status === 'booked').sort((x, y) => new Date(x.startsAt) - new Date(y.startsAt));
  const past = b.tutor.bookings.filter((x) => x.status !== 'booked').slice(0, 20);
  const bkRow = (x) => {
    const ask = b.ask && b.ask.kind === 'cancel' && b.ask.id === x.id, st = { booked: ['已約', 'warn'], completed: ['已上完', 'main'], cancelled: ['已取消', ''] }[x.status] || [x.status, ''];
    const btns = x.status === 'booked' && x.canChange && !ask ? `<div class="row" style="margin-top:4px"><button type="button" class="btn sm ghost" data-act="bkReschedAsk" data-id="${esc(x.id)}">改期</button><button type="button" class="btn sm ghost" data-act="bkCancelAsk" data-id="${esc(x.id)}">取消</button></div>`
      : x.status === 'booked' && !x.canChange && new Date(x.startsAt).getTime() > now ? '<div class="muted small">要改期或取消，請直接找老師。</div>' : '';
    return `<div class="bk-b" data-booking="${esc(x.id)}" style="padding:8px 0;border-top:1px solid var(--line)"><div class="row spread"><span><b>${esc(shopDT(x.startsAt))}–${esc(shopHM(x.endsAt))}</b> ${esc(x.teacherName)}</span><span><span class="pill ${st[1]}">${esc(st[0])}</span><span class="pill">${x.hours} 小時</span></span></div>
      ${x.status === 'booked' && x.slotNote ? `<div class="small">上課方式：${esc(x.slotNote)}</div>` : ''}${x.status === 'cancelled' && x.cancelledBy === 'teacher' ? `<div class="muted small">老師取消了這堂${x.cancelReason ? `：${esc(x.cancelReason)}` : ''}；時數沒有扣。</div>` : ''}
      ${btns}${ask ? `<div class="hint"><div>取消這堂？保留的 ${x.hours} 小時會還給你。</div><div class="row" style="margin-top:6px"><button type="button" class="btn sm warn" data-act="bkCancelGo" data-id="${esc(x.id)}">確定取消</button><button type="button" class="btn sm ghost" data-act="bkAskNo">先不要</button></div></div>` : ''}</div>`;
  };
  const mine = `<div class="card" id="bk-mine"><h2>我約的課</h2>${upcoming.map(bkRow).join('') || '<p class="muted" style="margin:4px 0">還沒有。</p>'}
    ${past.length ? `<details style="margin-top:8px"><summary class="muted">之前的（${past.length}）</summary>${past.map(bkRow).join('')}</details>` : ''}</div>`;
  const rs = b.resched ? b.tutor.bookings.find((x) => x.id === b.resched) : null;
  const teachers = [...new Map(b.slots.map((s) => [s.teacherId, s.teacherName])).entries()];
  const shown = b.slots.filter((s) => !b.teacher || s.teacherId === b.teacher);
  const extra = rs ? rs.hours : 0;
  let lastDay = '';
  const slotRows = shown.map((s) => {
    const day = shopDT(s.startsAt).replace(/\s?\d\d:\d\d$/, ''), dayHead = day !== lastDay ? `<div class="seg" style="margin-top:10px">${esc(day)}</div>` : ''; lastDay = day;
    const short = h.available + extra < s.hours, ask = b.ask && b.ask.kind === 'book' && b.ask.id === s.id, mineNow = rs && rs.slotId === s.id;
    const btn = mineNow ? '' : short ? '<span class="muted small">時數不夠</span>' : `<button type="button" class="btn sm" data-act="bkAsk" data-id="${esc(s.id)}">${rs ? '改到這段' : '約這段'}</button>`;
    return `${dayHead}<div class="bk-s" data-slot="${esc(s.id)}" style="padding:6px 0;border-top:1px solid var(--line)"><div class="row spread"><span><b>${esc(shopHM(s.startsAt))}–${esc(shopHM(s.endsAt))}</b> <span class="pill">${s.hours} 小時</span> ${esc(s.teacherName)}</span>${btn}</div>
      ${ask ? `<div class="hint"><div>${rs ? `把 ${esc(shopDT(rs.startsAt))} 那堂改到` : '約'} ${esc(shopDT(s.startsAt))}–${esc(shopHM(s.endsAt))}（${esc(s.teacherName)}）？會保留 ${s.hours} 小時。</div><div class="row" style="margin-top:6px"><button type="button" class="btn sm" data-act="bkGo" data-id="${esc(s.id)}">${rs ? '確定改期' : '確定預約'}</button><button type="button" class="btn sm ghost" data-act="bkAskNo">先不要</button></div></div>` : ''}</div>`;
  }).join('');
  const pick = teachers.length > 1 ? `<label class="f" for="bk-t">看哪位老師的時段</label><select id="bk-t" data-in="bkTeacher"><option value="">全部老師</option>${teachers.map(([id, n]) => `<option value="${esc(id)}" ${b.teacher === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : '';
  const open = `<div class="card ${rs ? 'active' : ''}" id="bk-open"><h2>${rs ? '選一段新的時間' : '可以約的時段'}</h2>
    ${rs ? `<div class="hint" style="margin:0 0 8px">正在幫 ${esc(shopDT(rs.startsAt))}（${esc(rs.teacherName)}）那堂改時間。選好新的時間後，原本那段就不留了。<div style="margin-top:6px"><button type="button" class="btn sm ghost" data-act="bkReschedNo">不改了</button></div></div>` : ''}
    ${pick}${slotRows || '<p class="muted" style="margin:6px 0">目前沒有老師開放的時段。老師開了之後會出現在這裡。</p>'}</div>`;
  const html = head + (rs ? open + mine : mine + open);
  const box = $('cls-book');   // 2026-11-25 第 ③ 步：在上課頁（#/class）畫進 #cls-book 這一塊；獨立購買頁外殼（shop/index.html）沒有這一塊，走原本的 view
  if (box) box.innerHTML = html; else view(html);
}
// 2026-11-25 第 ③ 步：預約、取消、改期之後重讀。在上課頁只重讀「預約一對一」那一塊與「我的課表」（約好的課要出現在課表），不把整頁換成載入中；獨立購買頁外殼照舊 viewBook()
function bkReload() {
  if ($('cls-book') && typeof clsLoad === 'function') { clsLoad('book').catch((e) => console.warn('bk', e && e.message)); clsLoad('mine').catch((e) => console.warn('bk', e && e.message)); return; }
  return viewBook();
}
IN.bkTeacher = (el) => { S.ui.bk.teacher = el.value; S.ui.bk.ask = null; renderBook(); };
ACT.bkAskNo = () => { S.ui.bk.ask = null; renderBook(); };
ACT.bkAsk = (el) => { S.ui.bk.ask = { kind: 'book', id: el.dataset.id }; renderBook(); };
ACT.bkCancelAsk = (el) => { S.ui.bk.ask = { kind: 'cancel', id: el.dataset.id }; renderBook(); };
ACT.bkReschedAsk = (el) => { S.ui.bk.resched = el.dataset.id; S.ui.bk.ask = null; renderBook(); const box = $('cls-book'); if (box && box.scrollIntoView) box.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0); };   // 2026-11-25 第 ③ 步：在上課頁捲到那一塊，不捲回整頁最上面
ACT.bkReschedNo = () => { S.ui.bk.resched = null; S.ui.bk.ask = null; renderBook(); };
ACT.bkGo = async (el) => {
  const b = S.ui.bk, slot = el.dataset.id, old = b.resched;
  el.disabled = true;
  let r; try { r = old ? await call('reschedule_my_booking', { p_booking_id: old, p_new_slot_id: slot }, { quiet: true }) : await call('book_tutor_slot', { p_slot_id: slot }, { quiet: true }); } finally { el.disabled = false; }
  if (!r.ok) {
    const det = r.error === 'NOT_ENOUGH_HOURS' && r.detail ? `（還能約 ${r.detail.available} 小時，這段要 ${r.detail.need} 小時）` : '';
    toast(shopErr(r) + det, true); return bkReload();
  }
  toast(old ? `已改到 ${shopDT(r.booking.startsAt)}。` : `已約好 ${shopDT(r.booking.startsAt)}（${r.booking.teacherName}）。`); bkReload();
};
ACT.bkCancelGo = async (el) => {
  el.disabled = true; let r; try { r = await call('cancel_my_booking', { p_booking_id: el.dataset.id }, { quiet: true }); } finally { el.disabled = false; }
  if (!r.ok) { toast(shopErr(r), true); return bkReload(); }
  toast('已取消，時數還給你了。'); bkReload();
};
