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
// 這兩頁自己的幾條樣式（接進學生頁時不用改 app.css）
(function shopCss() {
  if (document.getElementById('shop-css')) return;
  const st = document.createElement('style'); st.id = 'shop-css';
  st.textContent = '.shop-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:6px 0 4px}.shop-tile{border:1px solid var(--line);border-radius:6px;padding:8px;font-size:13px;color:var(--muted);background:#fff}'
    + '.shop-tile b{display:block;font-size:24px;line-height:1.15;color:var(--main)}.shop-price{color:var(--main);font-size:18px;white-space:nowrap}';
  document.head.appendChild(st);
})();
const shopRid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
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

// ═════════ 購買頁 ═════════
async function viewShop() {
  setTab('shop'); view(loading); const my = S.rt;
  const rs = await shopLoad([['my_shop']]); if (!rs || my !== S.rt) return; const d = rs[0];
  S.ui.shopData = d;
  const old = S.ui.shop || {}, codes = new Set(d.products.map((p) => p.code)), qty = {};
  Object.keys(old.qty || {}).forEach((c) => { if (codes.has(c)) qty[c] = old.qty[c]; });   // 下架的就不留在購物清單
  S.ui.shop = { qty, payer: old.payer || { name: '', relation: '', contact: '', isGuardian: false }, rid: old.rid || shopRid(), last: old.last || null, cancelAsk: null };
  renderShop();
}
function renderShop() {
  const d = S.ui.shopData, u = S.ui.shop, minor = d.student.ageStatus !== 'adult';
  const picked = d.products.filter((p) => (u.qty[p.code] || 0) > 0), total = picked.reduce((s, p) => s + p.priceTwd * u.qty[p.code], 0);
  const cards = d.products.map((p) => {
    const w = shopWhat(p), q = u.qty[p.code] || 0;
    return `<div class="card shop-p" data-code="${esc(p.code)}"><div class="row spread"><h3 style="margin:0">${esc(p.name)}</h3><b class="shop-price">${shopMoney(p.priceTwd)} 元</b></div>
      <p style="margin:6px 0 2px">${esc(w.what)}</p>${w.use ? `<p class="muted small" style="margin:0 0 8px">${esc(w.use)}</p>` : ''}
      <div class="row"><button type="button" class="btn sm ghost" data-act="shopQty" data-code="${esc(p.code)}" data-d="-1" ${q ? '' : 'disabled'} aria-label="少一份">－</button><span class="shop-q" style="min-width:4.5em;text-align:center">${q ? `${q} 份` : '還沒選'}</span><button type="button" class="btn sm ghost" data-act="shopQty" data-code="${esc(p.code)}" data-d="1" ${q >= 20 ? 'disabled' : ''} aria-label="多一份">＋</button></div></div>`;
  }).join('');
  const payer = !minor ? '' : `<h3>付款的家長</h3><p class="muted small" style="margin:0 0 4px">未滿 18 歲（或年齡還沒確認）的同學，要由家長付款，請填家長的資料。</p>
    <label class="f" for="sp-name">家長姓名（必填）</label><input type="text" id="sp-name" data-in="shopPayer" data-k="name" maxlength="50" value="${esc(u.payer.name)}">
    <label class="f" for="sp-rel">關係（必填）</label><select id="sp-rel" data-in="shopPayer" data-k="relation"><option value="">請選</option>${['父', '母', '其他監護人'].map((x) => `<option ${u.payer.relation === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <label class="f" for="sp-contact">聯絡方式（必填，電話或 Email）</label><input type="text" id="sp-contact" data-in="shopPayer" data-k="contact" maxlength="100" value="${esc(u.payer.contact)}">
    <label class="row" style="margin-top:10px;align-items:flex-start"><input type="checkbox" id="sp-guard" data-in="shopPayer" data-k="isGuardian" ${u.payer.isGuardian ? 'checked' : ''} style="margin-top:4px"><span>付款的家長是我的法定代理人，同意這筆購買。</span></label>`;
  const cart = `<div class="card ${picked.length ? 'active' : ''}" id="shop-cart"><h2>這次要買的</h2>${picked.length ? `<ul class="plain" style="padding-left:18px;margin:4px 0">${picked.map((p) => `<li>${esc(p.name)} × ${u.qty[p.code]}：${shopMoney(p.priceTwd * u.qty[p.code])} 元</li>`).join('')}</ul><p style="margin:6px 0"><b>合計 <span id="shop-total">${shopMoney(total)}</span> 元</b></p>` : '<p class="muted" style="margin:4px 0">還沒選。在上面按「＋」選數量。</p>'}
    ${payer}<p class="muted small" style="margin:10px 0 0">送出後，育才仕會在 1 個工作天內跟你聯絡，告訴你怎麼付款。</p>
    <div style="margin-top:10px"><button type="button" class="btn" data-act="shopOrder" ${picked.length ? '' : 'disabled'}>送出訂單</button></div></div>`;
  const last = u.last ? `<div class="hint" id="shop-done" style="margin:0 0 12px">已開一張待付款訂單：編號 <b>${esc(u.last.orderNo)}</b>，金額 <b>${shopMoney(u.last.totalTwd)} 元</b>。育才仕會在 1 個工作天內跟你聯絡付款方式。收到款後，額度會出現在下面。</div>` : '';
  const quota = d.quota && d.quota.length ? d.quota.map((q) => `<div class="row spread" style="padding:4px 0;border-top:1px solid var(--line)"><span>${esc(SHOP_KIND[q.quotaKind] || q.quotaKind)}</span><span><b>還有 ${q.remainingUnits} ${esc(SHOP_UNIT[q.quotaKind] || '')}</b><span class="muted small">（共 ${q.totalUnits}、用掉 ${q.usedUnits}${q.nextExpiresAt ? `；最近一份到 ${esc(shopDay(q.nextExpiresAt))}` : ''}）</span></span></div>`).join('')
    + (d.quota.some((q) => q.quotaKind === 'tutorHour' && q.remainingUnits > 0) ? '<div style="margin-top:8px"><a class="btn sm" href="#/book">去預約一對一</a></div>' : '')
    : '<p class="muted" style="margin:4px 0">你還沒有可用的額度。付款後，這裡會列出能交幾篇稿、能約幾小時。</p>';
  const orders = d.orders.length ? d.orders.map((o) => {
    const st = SHOP_STATUS[o.status] || [o.status, ''], ask = u.cancelAsk === o.id;
    return `<div class="shop-o" data-order="${esc(o.id)}" style="padding:8px 0;border-top:1px solid var(--line)"><div class="row spread"><span><b>${esc(o.orderNo)}</b> <span class="muted small">${esc(shopDay(o.createdAt))}</span></span><span><span class="pill ${st[1]}">${esc(st[0])}</span> <b>${shopMoney(o.totalTwd)} 元</b></span></div>
      <div class="small">${(o.items || []).map((i) => `${esc(i.productName)} × ${i.qty}`).join('、')}${o.payerName ? `<span class="muted">｜付款：${esc(o.payerName)}${o.payerRelation ? `（${esc(o.payerRelation)}）` : ''}</span>` : ''}</div>
      ${o.status === 'pending' ? (ask ? `<div class="hint"><div>取消這張訂單？取消後就不用付款了。</div><div class="row" style="margin-top:6px"><button type="button" class="btn sm warn" data-act="shopCancelGo" data-id="${esc(o.id)}">確定取消</button><button type="button" class="btn sm ghost" data-act="shopCancelNo">先不要</button></div></div>` : `<div style="margin-top:4px"><button type="button" class="btn sm ghost" data-act="shopCancelAsk" data-id="${esc(o.id)}">取消這張</button></div>`) : ''}</div>`;
  }).join('') : '<p class="muted" style="margin:4px 0">還沒有訂單。</p>';
  view(`<div class="card"><h2>購買</h2><p class="muted" style="margin:0">選好項目和數量，送出後會開一張待付款的訂單。</p></div>${last}
    <div id="shop-products">${cards}</div>${cart}
    <div class="card" id="shop-quota"><h2>我的額度</h2>${quota}</div>
    <div class="card" id="shop-orders"><h2>我的訂單</h2>${orders}</div>`);
}
ACT.shopQty = (el) => {
  const u = S.ui.shop, c = el.dataset.code, n = Math.max(0, Math.min(20, (u.qty[c] || 0) + Number(el.dataset.d)));
  if (n) u.qty[c] = n; else delete u.qty[c];
  u.last = null; renderShop();
};
IN.shopPayer = (el) => { S.ui.shop.payer[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; };
ACT.shopOrder = async (el) => {
  const d = S.ui.shopData, u = S.ui.shop, minor = d.student.ageStatus !== 'adult';
  const items = Object.keys(u.qty).filter((c) => u.qty[c] > 0).map((c) => ({ productCode: c, qty: u.qty[c] }));
  if (!items.length) return toast(SHOP_ERR.ITEMS_REQUIRED, true);
  const pz = { name: String(u.payer.name || '').trim(), relation: u.payer.relation || '', contact: String(u.payer.contact || '').trim(), isGuardian: !!u.payer.isGuardian };
  if (minor && (!pz.name || !pz.relation || !pz.contact)) return toast(SHOP_ERR.PAYER_REQUIRED, true);
  if (minor && !pz.isGuardian) return toast(SHOP_ERR.PAYER_GUARDIAN_CONFIRM_REQUIRED, true);
  el.disabled = true;
  let r; try { r = await call('my_create_order', { p: { items, payer: minor ? pz : {}, clientRequestId: u.rid } }, { quiet: true }); } finally { el.disabled = false; }
  if (!r.ok) { toast(shopErr(r), true); if (r.error === 'PRODUCT_NOT_FOUND') viewShop(); return; }
  S.ui.shop = { qty: {}, payer: u.payer, rid: shopRid(), last: r.order, cancelAsk: null };   // 下一張用新的請求編號
  toast('已送出，開了一張待付款訂單。'); viewShop();
};
ACT.shopCancelAsk = (el) => { S.ui.shop.cancelAsk = el.dataset.id; renderShop(); };
ACT.shopCancelNo = () => { S.ui.shop.cancelAsk = null; renderShop(); };
ACT.shopCancelGo = async (el) => {
  el.disabled = true; let r; try { r = await call('my_cancel_order', { p_order_id: el.dataset.id }, { quiet: true }); } finally { el.disabled = false; }
  S.ui.shop.cancelAsk = null; S.ui.shop.last = null;
  if (!r.ok) { toast(shopErr(r), true); return viewShop(); }
  toast('已取消這張訂單。'); viewShop();
};

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
    ${rs ? `<div class="hint" style="margin:0 0 8px">正在幫 ${esc(shopDT(rs.startsAt))}（${esc(rs.teacherName)}）那堂改時間。選好新的時間後，原本那段會自動取消。<div style="margin-top:6px"><button type="button" class="btn sm ghost" data-act="bkReschedNo">不改了</button></div></div>` : ''}
    ${pick}${slotRows || '<p class="muted" style="margin:6px 0">目前沒有老師開放的時段。老師開了之後會出現在這裡。</p>'}</div>`;
  view(head + (rs ? open + mine : mine + open));
}
IN.bkTeacher = (el) => { S.ui.bk.teacher = el.value; S.ui.bk.ask = null; renderBook(); };
ACT.bkAskNo = () => { S.ui.bk.ask = null; renderBook(); };
ACT.bkAsk = (el) => { S.ui.bk.ask = { kind: 'book', id: el.dataset.id }; renderBook(); };
ACT.bkCancelAsk = (el) => { S.ui.bk.ask = { kind: 'cancel', id: el.dataset.id }; renderBook(); };
ACT.bkReschedAsk = (el) => { S.ui.bk.resched = el.dataset.id; S.ui.bk.ask = null; renderBook(); window.scrollTo(0, 0); };
ACT.bkReschedNo = () => { S.ui.bk.resched = null; S.ui.bk.ask = null; renderBook(); };
ACT.bkGo = async (el) => {
  const b = S.ui.bk, slot = el.dataset.id, old = b.resched;
  el.disabled = true;
  let r; try { r = old ? await call('reschedule_my_booking', { p_booking_id: old, p_new_slot_id: slot }, { quiet: true }) : await call('book_tutor_slot', { p_slot_id: slot }, { quiet: true }); } finally { el.disabled = false; }
  if (!r.ok) {
    const det = r.error === 'NOT_ENOUGH_HOURS' && r.detail ? `（還能約 ${r.detail.available} 小時，這段要 ${r.detail.need} 小時）` : '';
    toast(shopErr(r) + det, true); return viewBook();
  }
  toast(old ? `已改到 ${shopDT(r.booking.startsAt)}。` : `已約好 ${shopDT(r.booking.startsAt)}（${r.booking.teacherName}）。`); viewBook();
};
ACT.bkCancelGo = async (el) => {
  el.disabled = true; let r; try { r = await call('cancel_my_booking', { p_booking_id: el.dataset.id }, { quiet: true }); } finally { el.disabled = false; }
  if (!r.ok) { toast(shopErr(r), true); return viewBook(); }
  toast('已取消，時數還給你了。'); viewBook();
};
