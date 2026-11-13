'use strict';   // 原本整支主程式包在一個函式裡並開嚴格模式；拆檔後每個檔各自開
// ── 志願分頁 ──
async function viewWish() {
  setTab('wish'); view(loading); const my = S.rt;
  const w = await call('my_wishlist'); if (!w.ok || my !== S.rt) return;
  const items = (w.items || []).slice().sort((a, b) => a.rank - b.rank);
  // 2026-11-12 換 116（D4）：換碼時系名略有不同、或 116 沒有同名系組的志願，列在最上面請學生看一眼或重選（不替學生換）
  let carry = [];
  try { const c = await call('my_wishlist_carry', {}, { quiet: true }); if (my !== S.rt) return; if (c.ok) carry = c.items || []; } catch (e) { /* 舊後端沒有這支就不顯示 */ }
  const carryHtml = carryCardHtml(carry);
  // 2026-11-12 繁星顯示：每系只放一行「這系也有繁星推薦」，點開才看細節（設計稿 §五③）；先畫頁面，繁星資料回來再補
  const starP = items.length ? fetchStars(items) : Promise.resolve({});
  if (!items.length) { view(carryHtml + '<div class="card"><h2>志願</h2><p>還沒存志願。先到「落點分析」，從清單裡挑最多六個你想去的系。</p><a class="btn" href="#/score">去挑科系</a> <a class="btn ghost" href="#/import">匯入落點通的志願</a></div>'); return; }
  // 2026-11-09 落點分析改版：最近一筆「存成志願」紀錄跟現在的志願一樣，就標「來自第 N 版」；不一樣（落點通匯入、改版前存的）就說不是從落點分析存的
  let from = '';
  try {
    const ev = await call('my_wishlist_events', { p_limit: 1 }, { quiet: true }); if (my !== S.rt) return;
    const e = ev.ok && (ev.items || [])[0], key = (arr) => arr.slice().sort((a, b) => a.rank - b.rank).map((x) => String(x.deptCode) + '@' + x.rank).join(',');
    if (e && Array.isArray(e.picks) && key(e.picks) === key(items)) from = `這組志願來自${e.versionSeq ? `第 ${esc(e.versionSeq)} 版「${esc(e.versionTitle || '')}」` : '落點分析'}（${esc(when(e.createdAt))} 存）。`;
    else if (items.every((x) => x.snapshot && x.snapshot.carriedFrom)) from = `這組志願是你 ${esc(items[0].snapshot.carriedFrom.year)} 學年存的，換成 116 簡章時已照同名系換成 116 的代碼。`;
    else from = '這組志願不是從落點分析存的（例如從落點通匯入，或在落點分析改版前存的）。';
  } catch (e) { /* 查不到紀錄就不標 */ }
  const render = (stars) => view(carryHtml + `<div class="card"><h2>我的志願</h2><p class="muted" style="margin:0 0 6px">最多六個，之後還可以回「落點分析」換。</p>${from ? `<p class="small" style="margin:0 0 6px">${from}</p>` : ''}
    ${items.map((it) => { const s = it.snapshot || {};
      return `<div class="doc-row"><div class="dmain"><b>${it.rank}. ${esc(it.schoolName)} ${esc(it.name)}</b> ${snapPill(s)}<div class="muted small">${esc(s2Line(it.stage2))}${s.basisYear ? '｜對照 ' + esc(s.basisYear) + ' 年資料' : ''}</div>${stars[String(it.deptCode)] ? `<details class="small"><summary>這系也有繁星推薦</summary>${NG.renderStar(stars[String(it.deptCode)])}</details>` : ''}</div></div>`; }).join('')}
    <div class="row" style="margin-top:12px"><a class="btn ghost" href="#/score">換志願</a><a class="btn" href="#/need">看每一系要交什麼</a></div></div>`);
  render({});
  const stars = await starP; if (my !== S.rt || !Object.keys(stars).length) return;
  const y = window.scrollY; render(stars); window.scrollTo(0, y);
}
function carryCardHtml(list) {
  if (!list || !list.length) return '';
  const row = (c) => {
    const nm = esc((c.school || '') + ' ' + (c.fromName || ''));
    const msg = c.kind === 'near' ? `${nm}：116 簡章的系名是「${esc(c.toName || '')}」，已經幫你換過去（系名略有不同，請確認是同一個系）。`
      : `${nm}：116 簡章沒有同名的系組，這個志願沒有帶過來，請重選。${c.hint ? `<div class="muted small">同校可能相關的 116 系（系統比對，請自己確認）：${esc(c.hint)}</div>` : ''}`;
    return `<div class="doc-row"><div class="dmain">${c.rank ? `原本第 ${esc(c.rank)} 志願　` : ''}${msg}</div><button type="button" class="btn sm ghost" data-act="carryOk" data-id="${esc(c.id)}">看過了</button></div>`;
  };
  return `<div class="card active"><h2>換成 116 簡章時要你看一眼</h2><p class="muted small" style="margin:0 0 6px">校系代碼每年重排，系統只照「同校＋同系名」幫你換；下面這幾個要你自己確認。</p>${list.map(row).join('')}
    <div class="row" style="margin-top:8px"><a class="btn sm" href="#/score">去落點分析重選</a></div></div>`;
}
ACT.carryOk = async (el) => { el.disabled = true; try { const r = await call('dismiss_wishlist_carry', { p_id: el.dataset.id }); if (r.ok) route(); } finally { el.disabled = false; } };
