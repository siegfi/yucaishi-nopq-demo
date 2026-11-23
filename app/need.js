'use strict';   // 原本整支主程式包在一個函式裡並開嚴格模式；拆檔後每個檔各自開
// ── 第 4 幕：這幾系要你交什麼 ──
function markReqSeen() {
  if (!S.reqSeen) S.reqSeen = call('me_mark_card_viewed', { p_lesson_id: 'req_seen' }, { quiet: true }).catch(() => null);
  return S.reqSeen;
}
// 2026-11-12 繁星顯示：志願系有核准的繁星對應就在卡片上照分則原文列。先把頁面畫出來，繁星資料回來再補（不讓整頁多等一支查詢；查不到就不顯示）
function fetchStars(items) {
  return call('dept_info', { p_codes: items.map((x) => String(x.deptCode)), p_year: YEAR, p_channel: CHANNEL }, { quiet: true })
    .then((di) => { const st = {}; if (di && di.ok) Object.keys(di.items || {}).forEach((c) => { if (di.items[c] && di.items[c].star) st[c] = di.items[c].star; }); return st; })
    .catch(() => ({}));
}
async function viewNeed() {
  setTab('need'); view(loading); const my = S.rt;
  const w = await call('my_wishlist'); if (!w.ok || my !== S.rt) return;
  // 11-20（28t）：R 以後要寫的那一項要知道開過了沒（開始寫／繼續寫）；用開機載好的首頁資料，不另外重撈（楊老師改版：換分頁不重撈首頁資料）
  const items = (w.items || []).slice().sort((a, b) => a.rank - b.rank), docs = ((S.home || {}).docs || []);
  if (!items.length) { view('<div class="card"><h2>審查資料準備指引說明</h2><p>還沒存志願，所以還看不到每一系要你交什麼。</p><a class="btn" href="#/score">去挑科系</a> <a class="btn ghost" href="#/import">匯入落點通的志願</a></div>'); return; }
  const starP = fetchStars(items);
  // 11-22 A4（規格 14.1）：學生一件都還沒放 → 卡片按鈕維持「去看你放了哪幾件」連到我的學習歷程（guide_pure 看 invN===0）。
  //   件數用前端已有的（這次讀過「我的學習歷程」就用 S.mine.inv）；沒有就背景叫現成的 my_inventory（加總 counts），先畫頁面、0 件才重畫，不讓整頁多等
  const invHad = S.mine && S.mine.inv ? Object.values(S.mine.inv).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0) : undefined;
  let invN = invHad, starsNow = {};
  const render = (stars) => view(`<div class="card active"><h2>審查資料準備指引說明</h2><p class="muted small" style="margin:0 0 6px">這幾系要你交什麼、題目是什麼。</p><p style="margin:0 0 6px">${esc(NG.guideSummary(items))}</p><p class="muted" style="margin:0">${esc(NG.WORDS.needIntro)}</p></div>
    ${items.map((it) => NG.renderGuideCard(it, stars[String(it.deptCode)], { docs, official: w.official, invN })).join('')}
    <div class="card"><button class="btn" data-act="needDone">看過了，往下</button></div>`);
  render({}); markReqSeen();
  if (invHad === undefined && w.official) {   // 背景補件數；0 件才需要重畫（按鈕換回「去看你放了哪幾件」）
    call('my_inventory', {}, { quiet: true }).then((r) => {
      if (!r || !r.ok || my !== S.rt) return;
      invN = Object.entries(r.counts || {}).reduce((s, [k, n]) => s + (k === 'hidden' ? 0 : Number(n) || 0), 0);   // 收起來的不算「放進來」
      if (invN === 0) { const y = window.scrollY; render(starsNow); window.scrollTo(0, y); }
    }).catch(() => null);
  }
  const stars = await starP; if (my !== S.rt || !Object.keys(stars).length) return;
  starsNow = stars; const y = window.scrollY; render(stars); window.scrollTo(0, y);
}
ACT.needDone = async (el) => { el.disabled = true; try { await markReqSeen(); } finally { el.disabled = false; } location.hash = '#/mine'; };
// ── 匯入志願：貼落點通的志願代碼（或網址帶 ?ld1=）──
function impSay(id, html) { const el = $(id); if (!el) return; if (html) el.innerHTML = html; el.classList.toggle('hidden', !html); }
async function viewImport() {
  setTab(''); const code = hashLd1() || ssGet(); S.imp = S.imp || {};
  view(`<div class="card"><h2>匯入志願</h2>
    <p class="muted" style="margin:0 0 8px">把落點通複製的志願代碼貼在這裡。代碼只含校系，不含你的成績和個資。</p>
    <label class="f" for="imp-code">志願代碼</label><input type="text" id="imp-code" placeholder="LD1-116-U-…" autocomplete="off" value="${esc(code)}">
    <div id="imp-msg" class="err hidden"></div><div id="imp-ask" class="hint hidden"></div>
    <div class="row" style="margin-top:12px"><button type="button" class="btn" id="imp-btn" data-act="doImport">匯入</button><a class="btn ghost" href="#/score">自己挑</a></div></div>`);
  if (code && S.imp.tried !== code) { S.imp.tried = code; await runImport(code, false); }
}
async function runImport(raw, force) {
  impSay('imp-msg', ''); impSay('imp-ask', '');
  await ldReady();
  const d = decodeLd1(raw);
  if (!d.ok) { impSay('imp-msg', esc(d.message)); return; }   // 代碼不對：只顯示原句，不呼叫後端
  const btn = $('imp-btn'); if (btn) btn.disabled = true;
  try {
    if (!force) {
      const cur = await call('my_wishlist', {}, { quiet: true });
      const have = cur.ok ? (cur.items || []).slice().sort((a, b) => a.rank - b.rank).map((x) => String(x.deptCode)) : [];
      if (have.length && have.join() !== d.codes.join()) {
        impSay('imp-ask', `你已經存了 ${have.length} 個志願，匯入會換成這 ${d.codes.length} 個。<div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-act="importForce">換成這 ${d.codes.length} 個</button><a class="btn sm ghost" href="#/wish">先不換</a></div>`); return;
      }
    }
    if (!d.codes.length) { impSay('imp-msg', esc(`這份代碼是 ${d.fromYear} 學年的，裡面的系 116 都沒有同名系組，請到「落點分析」重新挑。`)); return; }
    const items = d.codes.map((c, i) => ({ deptCode: c, rank: i + 1, snapshot: null }));
    const r = await call('set_wishlist', { p_year: YEAR, p_channel: CHANNEL, p_items: items, p_source: 'luodianCode' }, { quiet: true });
    if (!r.ok) { impSay('imp-msg', esc(errText(r) + '。代碼還留著，可以再按一次「匯入」。')); return; }
    ssSet(''); toast(`${d.codes.length} 個志願存好了。` + (d.unmapped && d.unmapped.length ? `另有 ${d.unmapped.length} 個 ${d.fromYear} 學年的系 116 沒有同名系組，沒有帶進來，請到「落點分析」重選。` : (d.fromYear ? `（${d.fromYear} 學年的代碼已照同名系換成 116）` : '')), !!(d.unmapped && d.unmapped.length)); location.hash = '#/wish';
  } catch (e) {
    if (e && (e.message === 'AUTH' || /^NOT_/.test(e.message))) return;
    impSay('imp-msg', '連線失敗，請稍後再按一次「匯入」。代碼還留著。');
  } finally { const b2 = $('imp-btn'); if (b2) b2.disabled = false; }
}
ACT.doImport = () => runImport(($('imp-code') || {}).value, false);
ACT.importForce = () => runImport(($('imp-code') || {}).value, true);
