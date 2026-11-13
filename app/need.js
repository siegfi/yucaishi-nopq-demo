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
  const items = (w.items || []).slice().sort((a, b) => a.rank - b.rank);
  if (!items.length) { view('<div class="card"><h2>要交什麼</h2><p>還沒存志願，所以還看不到每一系要你交什麼。</p><a class="btn" href="#/score">去挑科系</a> <a class="btn ghost" href="#/import">匯入落點通的志願</a></div>'); return; }
  const starP = fetchStars(items);
  const render = (stars) => view(`<div class="card active"><h2>這幾系要你交什麼</h2><p style="margin:0 0 6px">${esc(NG.guideSummary(items))}</p><p class="muted" style="margin:0">N、O 各寫一篇；P、Q 每個志願系各寫一篇，題目就是下面每系「自述要答」列的。都在「寫」。</p></div>
    ${items.map((it) => NG.renderGuideCard(it, stars[String(it.deptCode)])).join('')}
    <div class="card"><button class="btn" data-act="needDone">看過了，往下</button></div>`);
  render({}); markReqSeen();
  const stars = await starP; if (my !== S.rt || !Object.keys(stars).length) return;
  const y = window.scrollY; render(stars); window.scrollTo(0, y);
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
