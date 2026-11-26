'use strict';
// 2026-11-25 第 ① 步：帳號頁（#/acct）、登入頁的〔忘記密碼〕、設新密碼頁。
// 後端：profile-db/29l_account_schedule.sql 的 my_profile、update_my_profile、my_consents；改密碼與寄重設信用 supabase-js 內建的 auth。
// 畫面上的字逐字照 OUTPUTS/uiux_plan_20261119/11_畫面文字待確認表_v0.1.md 第九節（第 51～87 條）與九之二（第 88～95 條）；缺字就沿用 core.js、shop.js 現有的句子。
// 全域名稱一律 acct／pw／forgot／rp 開頭，避免跟學生頁其他檔撞名。

const ACCT_NET = '連線失敗，請檢查網路再試一次。';   // core.js 現有句
const ACCT_PW = { wrong: '現在的密碼不對。', mismatch: '兩次輸入的新密碼不一樣。', len: '新密碼要 8 到 72 個字元。', done: '密碼改好了，下次登入用新密碼。', same: '新密碼跟現在的一樣，換一個。', set: '新密碼設好了。' };   // 第 75～78、81、83 條
const ACCT_FIELD_MSG = { nickname: '暱稱要 1 到 20 個字。', school: '學校最多 40 個字。', phone: '手機號碼要 09 開頭、10 個數字。' };   // 第 85、86、79 條
const ACCT_FN = { prof: 'my_profile', cons: 'my_consents', shop: 'my_shop' };
const acctLen = (s) => Array.from(String(s || '')).length;
const acctNetErr = (e) => !!e && (e.name === 'AuthRetryableFetchError' || !e.status);
const acctAuthMsg = (e) => (acctNetErr(e) ? ACCT_NET : errText({}));
function acctEmailSave(v) { try { sessionStorage.setItem('ycs-reset-email', v); } catch (e) { /* 存不了就算了 */ } }
function acctEmailLast() { try { return sessionStorage.getItem('ycs-reset-email') || ''; } catch (e) { return ''; } }

// ═════════ 帳號頁 ═════════
// 讀一支後端函式。函式不存在（PGRST202）回 NOT_READY：那一張卡整張不畫；其他連線失敗回 NET
async function acctRead(fn) {
  try { return await call(fn, {}, { quiet: true }); }
  catch (e) {
    if (!e || e.message !== 'NET') throw e;
    const keep = lastFailMsg; let missing = false;
    try { const pr = await sb.rpc(fn, {}); missing = !!(pr.error && pr.error.code === 'PGRST202'); } catch (e2) { /* 探不到就當一般連線失敗 */ }
    lastFailMsg = keep;
    return { ok: false, error: missing ? 'NOT_READY' : 'NET', msg: keep };
  }
}
async function acctLoad(k) {
  const A = S.ui.acct, my = A.my;
  if (!A[k] || A[k].s !== 'ok') { A[k] = { s: 'load' }; acctDraw(k); }
  let r;
  try { r = await acctRead(ACCT_FN[k]); }
  catch (e) { if (e && (e.message === 'AUTH' || /^NOT_/.test(e.message))) return; console.warn('acct', k, e && e.message); r = { ok: false, error: 'NET' }; }
  if (S.ui.acct !== A || S.rt !== my) return;   // 已經換頁，晚到的不蓋掉新的一頁
  A[k] = r.ok ? { s: 'ok', d: r } : r.error === 'NOT_READY' ? { s: 'miss' } : { s: 'err', msg: r.error === 'NET' ? (r.msg || '請檢查網路，再按「重新載入」。') : errText(r) };
  acctDraw(k);
}
function acctDraw(k) {
  const el = $('acct-' + k), A = S.ui.acct; if (!el || !A) return;
  const x = A[k]; let h = '';
  if (!x || x.s === 'load') h = '<div class="state state-loading">正在讀你的資料…</div>';
  else if (x.s === 'err') h = `<div class="state state-error"><p class="state-title">這一頁沒有載入</p><p style="margin:0">${esc(x.msg)}</p><div class="state-act"><button type="button" class="btn" data-act="acctRetry" data-k="${k}">重新載入</button></div></div>`;
  else if (x.s === 'ok') h = k === 'prof' ? acctProfHtml(x.d) : k === 'cons' ? acctConsHtml(x.d) : acctShopHtml(x.d);
  el.innerHTML = h; acctJump();
}
function acctJump() {   // 頁首跳轉鈕：只畫還有的那幾塊
  const A = S.ui.acct, el = $('acct-jump'); if (!A || !el) return;
  const on = (k) => !!A[k] && A[k].s !== 'miss', b = (to, t) => `<button type="button" class="btn sm ghost" data-act="acctJump" data-to="${to}">${t}</button>`;
  el.innerHTML = (on('prof') ? b('acct-prof', '個人資料') : '') + b('acct-pw', '改密碼') + (on('cons') ? b('acct-cons', '同意紀錄') : '') + (on('shop') ? b('acct-shop', '購買') : '');
}
ACT.acctJump = (el) => {
  const t = $(el.dataset.to); if (!t) return;
  const d = t.tagName === 'DETAILS' ? t : t.querySelector('details'); if (d) d.open = true;
  t.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
ACT.acctRetry = (el) => { acctLoad(el.dataset.k).catch((e) => console.warn('acct', e && e.message)); };

function acctProfHtml(p) {
  const opts = p.gradeOptions || [], gs = opts.includes(p.gradeYear) ? p.gradeYear : '';
  const ro = (k, v) => `<div class="acct-ro"><div class="acct-k">${k}</div><div class="row"><span class="acct-v">${esc(v)}</span><span class="pill">不能改</span></div></div>`;
  return `<div class="card active" id="acct-profcard"><h2>個人資料</h2><p class="muted" style="margin:0">標「不能改」的，要改請聯絡育才仕。</p>
    <label class="f" for="ac-nick">暱稱</label><input type="text" id="ac-nick" autocomplete="off" value="${esc(p.nickname)}">
    <label class="f" for="ac-school">學校</label><input type="text" id="ac-school" autocomplete="off" value="${esc(p.school)}">
    <label class="f" for="ac-grade">年級</label><select id="ac-grade"><option value="">不填</option>${opts.map((g) => `<option value="${esc(g)}"${g === gs ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select>
    <label class="f" for="ac-phone">手機號碼</label><input type="tel" id="ac-phone" inputmode="tel" autocomplete="off" value="${esc(p.phone)}">
    ${ro('登入的 Email', p.email)}${p.channel && p.channel.name ? ro('補習班', p.channel.name) : ''}
    <div id="acct-perr" class="err hidden" role="alert"></div>
    <div style="margin-top:14px"><button type="button" class="btn" data-act="acctSave">存起來</button></div></div>`;
}
function acctPErr(list) {
  const e = $('acct-perr'); if (!e) return;
  e.innerHTML = (list || []).map((m) => `<div>${esc(m)}</div>`).join(''); e.classList.toggle('hidden', !(list && list.length));
}
ACT.acctSave = async (el) => {
  const A = S.ui.acct, x = A && A.prof; if (!x || x.s !== 'ok') return;
  const p = x.d, opts = p.gradeOptions || [];
  const cur = { nickname: $('ac-nick').value.trim(), school: $('ac-school').value.trim(), gradeYear: $('ac-grade').value, phone: $('ac-phone').value.trim() };
  const base = { nickname: String(p.nickname || '').trim(), school: String(p.school || '').trim(), gradeYear: opts.includes(p.gradeYear) ? p.gradeYear : '', phone: String(p.phone || '').trim() };
  const send = {}, bad = [];
  Object.keys(cur).forEach((k) => { if (cur[k] !== base[k]) send[k] = cur[k]; });   // 只送使用者改過的欄；沒動的欄不送（舊年級值讀不出來時，送出去會把它清掉）
  if ('nickname' in send && (acctLen(send.nickname) < 1 || acctLen(send.nickname) > 20)) bad.push(ACCT_FIELD_MSG.nickname);
  if ('school' in send && acctLen(send.school) > 40) bad.push(ACCT_FIELD_MSG.school);
  if ('phone' in send && send.phone.replace(/[\s-]/g, '') !== '' && !/^09\d{8}$/.test(send.phone.replace(/[\s-]/g, ''))) bad.push(ACCT_FIELD_MSG.phone);
  if (bad.length) { acctPErr(bad); return; }
  acctPErr([]);
  if (!Object.keys(send).length) { toast('存好了。'); return; }
  el.disabled = true;
  let r;
  try { r = await call('update_my_profile', { p: send }, { quiet: true }); }
  catch (e) { if (e && e.message === 'NET') acctPErr([lastFailMsg || ACCT_NET]); else if (!e || !KNOWN.has(e.message)) throw e; return; }
  finally { el.disabled = false; }
  if (S.ui.acct !== A) return;
  if (!r.ok) {
    const msgs = [];
    if (r.error === 'VALIDATION' && Array.isArray(r.detail)) r.detail.forEach((k) => { const m = ACCT_FIELD_MSG[k] || ERRS.VALIDATION; if (!msgs.includes(m)) msgs.push(m); });
    acctPErr(msgs.length ? msgs : [errText(r)]); return;
  }
  A.prof = { s: 'ok', d: Object.assign({}, p, r) }; acctDraw('prof');
  homeAt = 0; if (S.home) S.home.nickname = r.nickname; $('who').textContent = r.nickname || '帳號';   // 首頁「某某，你好」與頂欄跟著變
  toast('存好了。');
};

// 改密碼：先用現在的密碼登入一次，對了才換
function acctPwErr(msg) { const e = $('acct-pwerr'); if (!e) return; e.textContent = msg || ''; e.classList.toggle('hidden', !msg); }
function acctPwAuthMsg(e, signIn) {
  const code = e.code || '', msg = String(e.message || '');
  if (signIn && (code === 'invalid_credentials' || /invalid|credentials/i.test(msg))) return ACCT_PW.wrong;
  if (!signIn && (code === 'same_password' || /different from the old|same/i.test(msg))) return ACCT_PW.same;
  if (!signIn && (code === 'weak_password' || /password should|at least|characters/i.test(msg))) return ACCT_PW.len;
  return acctAuthMsg(e);
}
ACT.pwChange = async () => {
  const cur = $('pw-cur').value, nw = $('pw-new').value, again = $('pw-new2').value, btn = $('acct-pwbtn');
  acctPwErr('');
  if (!cur) { acctPwErr(ACCT_PW.wrong); return; }
  if (nw !== again) { acctPwErr(ACCT_PW.mismatch); return; }
  if (nw.length < 8 || nw.length > 72) { acctPwErr(ACCT_PW.len); return; }
  if (nw === cur) { acctPwErr(ACCT_PW.same); return; }
  btn.disabled = true;
  try {
    const ss = await sb.auth.getSession(), u0 = ss.data && ss.data.session && ss.data.session.user, pd = S.ui.acct && S.ui.acct.prof && S.ui.acct.prof.d;
    const a = await sb.auth.signInWithPassword({ email: (u0 && u0.email) || (pd && pd.email) || '', password: cur });
    if (a.error) { acctPwErr(acctPwAuthMsg(a.error, true)); return; }
    const u = await sb.auth.updateUser({ password: nw });
    if (u.error) { acctPwErr(acctPwAuthMsg(u.error, false)); return; }
    $('pw-cur').value = ''; $('pw-new').value = ''; $('pw-new2').value = '';
    toast(ACCT_PW.done);
  } catch (e) { acctPwErr(ACCT_NET); }
  finally { btn.disabled = false; }
};
document.addEventListener('submit', (ev) => {
  if (ev.target && ev.target.id === 'acct-pwform') { ev.preventDefault(); ACT.pwChange().catch((e) => console.warn('pw', e && e.message)); }
});

// 同意紀錄：最上面只一行現在的狀況；下面一次同意一列（家長簽、本人簽、已撤回）
function acctDate(iso) {   // 簽署日換成台北的日期（後端可能回 UTC 時間，直接取前 10 碼會差一天）；只有日期沒有時間的照字面
  const s = String(iso || ''), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (m) return `${m[1]}/${+m[2]}/${+m[3]}`;
  const d = new Date(s); if (!s || isNaN(d.getTime())) return '';
  try { return d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric' }); } catch (e) { return ''; }
}
function acctConsHtml(d) {
  const ok = !!(d.current && d.current.general === true);
  const rows = (d.items || []).map((x) => {
    const g = x.consentBy === 'guardian', nm = g ? (x.guardianName || x.signerName || '') : '', dt = acctDate(x.consentAt);
    return `<div class="acct-crow">${g ? '家長同意' : '本人同意'}${nm ? '　' + esc(nm) : ''}${dt ? '　' + dt + ' 簽' : ''}${x.revokedAt ? ' <span class="pill">已撤回</span>' : ''}</div>`;
  }).join('');
  return `<details class="card" id="acct-conscard"><summary>同意紀錄</summary>
    <div class="row spread" style="padding-bottom:6px"><b>使用同意</b><span>${ok ? '已同意' : '還沒有'}</span></div>
    ${rows || '<p class="muted" style="margin:6px 0">還沒有。</p>'}
    <p class="muted small" style="margin:10px 0 0">要看同意內容或撤回，請聯絡育才仕。</p></details>`;
}

// 購買卡：額度、訂單兩段跟購買頁共用（shop.js 的 shopQuotaHtml、shopOrdersHtml），畫面不變
function acctShopHtml(d) {
  // 2026-11-25 第 ② 步：〔去購買〕留著（購買放在帳號頁裡），只把連結改成通到購物車；上面加購物車一行（n 項、合計；空車寫「購物車是空的。」）。畫之前先校正一次（下架的拿掉）
  if (typeof cartReconcile === 'function') cartReconcile(d, true);
  const sm = typeof shopCartSummary === 'function' ? shopCartSummary(d) : { n: 0, total: 0 };
  return `<div class="card" id="acct-shopcard"><h2>購買</h2><p class="muted" style="margin:0 0 8px">付款購買都在這裡。</p>
    <div class="cart-row" id="acct-cartrow"><div><b>購物車</b><div class="muted small" id="acct-cartsum">${sm.n ? `${sm.n} 項，合計 ${shopMoney(sm.total)} 元` : '購物車是空的。'}</div></div><a class="btn" href="#/cart">去購買</a></div>
    <h3>我的額度</h3>${shopQuotaHtml(d)}<h3>我的訂單</h3>${shopOrdersHtml(d, S.ui.shop)}</div>`;
}
function acctShopRefresh(fresh) {   // shop.js 的取消訂單幾顆鈕在帳號頁按時，呼叫這裡
  if (!S.ui.acct) return; return fresh ? acctLoad('shop') : acctDraw('shop');
}

async function viewAcct() {
  setTab('');
  if (typeof shopState === 'function') {   // 2026-11-25 第 ② 步：沒有就用瀏覽器存的購物車建起來（shopState 在 shop.js）
    shopState().cancelAsk = null;
  }
  const A = S.ui.acct = { my: S.rt, prof: { s: 'load' }, cons: { s: 'load' }, shop: typeof shopQuotaHtml === 'function' && S.ui.shop ? { s: 'load' } : { s: 'miss' } };
  view(`<div class="row acct-jump" id="acct-jump"></div><div id="acct-prof"></div>
    <details class="card" id="acct-pw"><summary>改密碼</summary><form id="acct-pwform" autocomplete="off">
      <label class="f" for="pw-cur">現在的密碼</label><input type="password" id="pw-cur" autocomplete="current-password">
      <label class="f" for="pw-new">新密碼</label><input type="password" id="pw-new" autocomplete="new-password">
      <label class="f" for="pw-new2">再輸入一次新密碼</label><input type="password" id="pw-new2" autocomplete="new-password">
      <div id="acct-pwerr" class="err hidden" role="alert"></div>
      <div style="margin-top:14px"><button type="submit" class="btn" id="acct-pwbtn">改密碼</button></div></form></details>
    <div id="acct-cons"></div><div id="acct-shop"></div>
    <div class="acct-out"><button type="button" class="btn ghost" data-act="logout">登出</button></div>`);
  ['prof', 'cons', 'shop'].forEach((k) => acctDraw(k));
  ['prof', 'cons', 'shop'].forEach((k) => { if (A[k].s === 'load') acctLoad(k).catch((e) => console.warn('acct', k, e && e.message)); });
}

// ═════════ 登入頁：忘記密碼（寄重設信） ═════════
function loginPane(w) {   // 'login'｜'forgot'｜'sent'
  show('login-form', w === 'login'); show('forgot-form', w === 'forgot'); show('forgot-sent', w === 'sent'); show('resetpw', false);
}
ACT.forgotOpen = () => {
  $('f-email').value = ($('l-email').value || '').trim() || acctEmailLast();
  show('l-err', false); show('f-err', false); $('f-btn').disabled = false; loginPane('forgot'); $('f-email').focus();
};
ACT.forgotBack = () => { loginPane('login'); };
$('forgot-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const em = $('f-email').value.trim(), btn = $('f-btn'), say = (m) => { $('f-err').textContent = m || ''; show('f-err', !!m); };
  say('');
  if (!em) { say('先填 Email。'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { say('Email 格式不對。'); return; }
  btn.disabled = true;
  let r; try { r = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname }); } catch (e) { r = { error: { name: 'AuthRetryableFetchError' } }; }   // redirectTo＝學生頁本身，不帶 #
  if (r && r.error) { btn.disabled = false; say(acctAuthMsg(r.error)); return; }
  acctEmailSave(em); loginPane('sent');   // 不管這個 Email 有沒有帳號，畫面都是同一張
});

// ═════════ 設新密碼頁（信裡的連結回來） ═════════
// 連結回來時網址 # 後面帶 type=recovery；supabase-js 開機會自己吃掉並清掉網址，所以 core.js 在建立 sb 之前先記在 BOOT_URL
function acctUrlParam(k) {
  const h = BOOT_URL.hash.replace(/^#/, ''), qi = h.indexOf('?'), ps = [new URLSearchParams(h), new URLSearchParams(BOOT_URL.search)];
  if (qi >= 0) ps.push(new URLSearchParams(h.slice(qi + 1)));
  for (const p of ps) { const v = p.get(k); if (v) return v; }
  return '';
}
function rpBad() { $('rp-fields').classList.add('hidden'); $('rp-bad').classList.remove('hidden'); }
function resetBoot() {   // 開機最前面呼叫（main.js）：是重設連結就進這一頁、不進首頁；回 true 表示接手了
  const bad = !!acctUrlParam('error_code'), rec = acctUrlParam('type') === 'recovery';
  if (!bad && !rec) return false;
  show('boot', false); show('login', false); show('app', false); show('resetpw', true);
  if (bad) rpBad();
  return true;
}
ACT.resetAgain = () => {   // 連結失效：回到忘記密碼表單，Email 已填
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* 留著網址也沒關係 */ }
  $('f-email').value = acctEmailLast() || ($('l-email').value || '').trim();
  show('boot', false); show('app', false); show('login', true); show('f-err', false); $('f-btn').disabled = false; loginPane('forgot');
};
$('rp-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const a = $('rp-new').value, b = $('rp-new2').value, btn = $('rp-btn'), say = (m) => { $('rp-err').textContent = m || ''; show('rp-err', !!m); };
  say('');
  if (a !== b) { say(ACCT_PW.mismatch); return; }
  if (a.length < 8 || a.length > 72) { say(ACCT_PW.len); return; }
  btn.disabled = true;
  let u; try { u = await sb.auth.updateUser({ password: a }); } catch (e) { u = { error: { name: 'AuthRetryableFetchError' } }; }
  if (u && u.error) {
    btn.disabled = false;
    if (u.error.name === 'AuthSessionMissingError' || /session/i.test(String(u.error.message || ''))) { rpBad(); return; }   // 憑證已經沒用了：當成連結失效
    say(acctPwAuthMsg(u.error, false)); return;
  }
  $('rp-new').value = ''; $('rp-new2').value = ''; btn.disabled = false;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
  show('resetpw', false); toast(ACCT_PW.set); bootQuiet = false; await enter();
});
