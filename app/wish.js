'use strict';   // 原本整支主程式包在一個函式裡並開嚴格模式；拆檔後每個檔各自開
// ── 志願分頁 ──
async function viewWish() {
  setTab('wish'); view(loading); const my = S.rt;
  const w = await call('my_wishlist'); if (!w.ok || my !== S.rt) return;
  const items = (w.items || []).slice().sort((a, b) => a.rank - b.rank);
  if (!items.length) { view('<div class="card"><h2>志願</h2><p>還沒存志願。先到「落點分析」，從清單裡挑最多六個你想去的系。</p><a class="btn" href="#/score">去挑科系</a> <a class="btn ghost" href="#/import">匯入落點通的志願</a></div>'); return; }
  // 2026-11-09 落點分析改版：最近一筆「存成志願」紀錄跟現在的志願一樣，就標「來自第 N 版」；不一樣（落點通匯入、改版前存的）就說不是從落點分析存的
  let from = '';
  try {
    const ev = await call('my_wishlist_events', { p_limit: 1 }, { quiet: true }); if (my !== S.rt) return;
    const e = ev.ok && (ev.items || [])[0], key = (arr) => arr.slice().sort((a, b) => a.rank - b.rank).map((x) => String(x.deptCode) + '@' + x.rank).join(',');
    if (e && Array.isArray(e.picks) && key(e.picks) === key(items)) from = `這組志願來自${e.versionSeq ? `第 ${esc(e.versionSeq)} 版「${esc(e.versionTitle || '')}」` : '落點分析'}（${esc(when(e.createdAt))} 存）。`;
    else from = '這組志願不是從落點分析存的（例如從落點通匯入，或在落點分析改版前存的）。';
  } catch (e) { /* 查不到紀錄就不標 */ }
  view(`<div class="card"><h2>我的志願</h2><p class="muted" style="margin:0 0 6px">最多六個，之後還可以回「落點分析」換。</p>${from ? `<p class="small" style="margin:0 0 6px">${from}</p>` : ''}
    ${items.map((it) => { const s = it.snapshot || {};
      return `<div class="doc-row"><div class="dmain"><b>${it.rank}. ${esc(it.schoolName)} ${esc(it.name)}</b> ${snapPill(s)}<div class="muted small">${esc(s2Line(it.stage2))}${s.basisYear ? '｜對照 ' + esc(s.basisYear) + ' 年資料' : ''}</div></div></div>`; }).join('')}
    <div class="row" style="margin-top:12px"><a class="btn ghost" href="#/score">換志願</a><a class="btn" href="#/need">看每一系要交什麼</a></div></div>`);
}
