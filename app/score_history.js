'use strict';   // 2026-11-09 落點分析改版 L3：「歷史落點分析」子分頁（設計稿 §5：列表、改名備註、軟刪、更早的版本、載回新作、比較兩版、去評估、用這版存成志願）
S.lv = null;   // { items, limit, sel:[版本 id], cmp:{a,b}|null, edit:版本 id|null }
async function viewScoreHistory() {
  setTab('score'); view(loading); const my = S.rt;
  try { await ldReady(); } catch (e) { return; }
  if (!(await ensureAck()) || my !== S.rt) return;
  const r = await call('list_luodian_versions'); if (!r.ok || my !== S.rt) return;
  const items = r.items || [], keep = S.lv || {};
  if (typeof CAAC_DEPTS !== 'undefined') { ldIndex(); normVersions(items); }   // 2026-11-12：115 存的舊版本換成 116 代碼再顯示
  S.lv = { items, limit: r.limit || 30, sel: (keep.sel || []).filter((id) => items.some((v) => v.id === id)), cmp: null, edit: null };
  lvRender();
}
const lvById = (id) => S.lv.items.find((v) => v.id === id);
const deptName = (code) => { const s = String(code), m = /^(\d{3}):(\d{6})$/.exec(s); if (m) return `${m[1]} 學年的系 ${m[2]}（116 沒有同名系組）`; const d = LD.byCode && LD.byCode.get(s); return d ? d.school + ' ' + d.dept : '系代碼 ' + s; };
function lvPicks(v) { return (v.picks || []).slice().sort((a, b) => a.rank - b.rank).map((p) => `${p.rank}. ${deptName(p.deptCode)}${p.code ? '（' + LPN[p.code] + '）' : ''}`).join('、'); }
function lvMixLine(v) {
  const m = (v.rules && v.rules.mix) || {}, gp = (v.rules && v.rules.groupsPicked) || 0;
  return `夢幻 ${m.dream || 0}／正常 ${m.reach || 0}／保底 ${m.safe || 0}${m.none ? `／不在清單 ${m.none}` : ''}　<span class="pill ${gp > 3 ? 'bad' : ''}">${gp > 3 ? '⚠ ' : ''}學群 ${gp}</span>`;
}
function lvCard(v) {
  const L = S.lv, on = L.sel.includes(v.id), ev = v.wishEvents || 0, id = esc(v.id);
  return `<div class="ver" data-ver="${id}"><div class="row spread"><label class="tick"><input type="checkbox" data-in="lvPick" data-id="${id}" ${on ? 'checked' : ''} aria-label="勾選 ${esc(v.title)}"> <b>${esc(v.title)}</b></label><span class="muted small">${esc(when(v.createdAt))}</span></div>
    <div class="small">${esc(AP.scoreBrief(v.scores, v.listen)) || '（沒有成績）'}<span class="muted">　${v.scoreKind === 'official' ? '正式學測成績' : '模考或預估'}</span></div>
    <div class="small">${lvMixLine(v)}${ev ? `<span class="pill ok">已存成志願${ev > 1 ? ` ${ev} 次` : ''}</span>` : ''}</div>
    <div class="muted small">${esc(lvPicks(v))}</div>
    ${v.note ? `<div class="small">備註：${esc(v.note)}</div>` : ''}
    ${L.edit === v.id ? `<div class="vedit"><label class="f" for="lv-title">名稱（最多 30 字）</label><input type="text" id="lv-title" maxlength="30" value="${esc(v.title)}">
      <label class="f" for="lv-note">備註（最多 200 字）</label><textarea id="lv-note" maxlength="200" rows="2">${esc(v.note || '')}</textarea>
      <div class="row" style="margin-top:6px"><button type="button" class="btn sm" data-act="lvEditSave" data-id="${id}">存</button><button type="button" class="btn sm ghost" data-act="lvEditCancel">取消</button></div></div>` : ''}
    ${v.status === 'archived' ? `<div class="row" style="margin-top:6px"><button type="button" class="btn sm ghost" data-act="lvRestore" data-id="${id}">還原到上面</button><span class="muted small">更早的版本可以看、可以還原，要載回新作請先還原。</span></div>`
      : `<div class="row" style="margin-top:6px"><button type="button" class="btn sm ghost" data-act="lvLoad" data-id="${id}">載回新作</button><button type="button" class="btn sm ghost" data-act="lvEdit" data-id="${id}">改名／備註</button><button type="button" class="btn sm" data-act="lvWish" data-id="${id}">用這版存成志願</button><button type="button" class="btn sm warn" data-act="lvDel" data-id="${id}" ${ev ? 'disabled' : ''}>刪除</button></div>
      ${ev ? '<div class="muted small">這版存過志願，會留著，不能刪。</div>' : ''}`}</div>`;
}
// 2026-11-12 工單 M1（設計稿 §9.2「跟歷史頁那條不打架」）：手機上改用新作頁同一款的一行列（只有列、沒有面板），高度位置一樣；寬螢幕維持原本那一條
function lvBar() {
  const n = S.lv.sel.length;
  if (!n) return '';
  if (selMobile()) return `<div class="selline lv"><span class="small"><b>已勾 ${n} 版</b>${n > 3 ? '（評估最多 3 版）' : ''}</span><span class="row"><button type="button" class="btn sm ghost" data-act="lvCmp" ${n === 2 ? '' : 'disabled'}>比較這兩版</button><button type="button" class="btn sm" data-act="lvAssess" ${n >= 1 && n <= 3 ? '' : 'disabled'}>去評估</button></span></div>`;
  return `<div class="selbar"><div class="row spread"><span class="small">已勾 ${n} 版${n > 3 ? '（評估最多 3 版）' : ''}</span><span class="row">
    <button type="button" class="btn ghost" data-act="lvCmp" ${n === 2 ? '' : 'disabled'}>比較這兩版</button><button type="button" class="btn" data-act="lvAssess" ${n >= 1 && n <= 3 ? '' : 'disabled'}>去評估</button></span></div>
    <div class="muted small">勾 2 版可以比較；勾 1～3 版可以去評估。</div></div>`;
}
function lvRender() {
  const L = S.lv, act = L.items.filter((v) => v.status === 'active'), old = L.items.filter((v) => v.status === 'archived');
  const tip = '<div class="teach"><b>老師的話</b><p>每排一次就存一版，不用怕排錯。勾兩版可以比較差在哪；挑 1～3 版去「AI 落點機率評估」，看每一系離門檻多遠。</p></div>';
  if (!L.items.length) { view(`${subTabsHtml('history')}${tip}<div class="card"><h2>還沒有存過版本</h2><p>到「新作落點分析」排好以後，按「存成一版」就會留在這裡。</p><a class="btn" href="#/score">去排一版</a></div>`); return; }
  view(`${subTabsHtml('history')}${tip}
    <div class="card"><h2>我存的版本</h2><p class="muted small" style="margin:0 0 6px">最多留 ${L.limit} 版；滿了以後，最舊、沒存過志願的那一版會移到下面「更早的版本」，不會不見。</p>
      ${act.map(lvCard).join('') || '<p class="muted">目前的版本都在「更早的版本」裡。</p>'}</div>
    <div id="lv-bar" class="selwrap">${lvBar()}</div>${lvFlag()}
    ${L.cmp ? lvCompareHtml() : ''}
    ${old.length ? `<details class="card" id="lv-old"><summary>更早的版本（${old.length}）</summary>${old.map(lvCard).join('')}</details>` : ''}`);
}
IN.lvPick = (el) => {
  const L = S.lv, id = el.dataset.id, at = L.sel.indexOf(id);
  if (el.checked && at < 0) L.sel.push(id); else if (!el.checked && at >= 0) L.sel.splice(at, 1);
  const bar = $('lv-bar'); if (bar) bar.innerHTML = lvBar(); lvFlag();
};
// 手機上有列時，頁面底部多留一條、提示訊息移到列上方（同新作頁 selBodyFlags）
function lvFlag() { selBodyFlags(!!(S.lv && S.lv.sel.length && selMobile()), false); return ''; }
// 比較兩版（AP.compareVersions）：成績逐科差、篩選差、只有 A 有／只有 B 有／都有但落點變了、2／2／2、學群數
function lvCompareHtml() {
  const a = lvById(S.lv.cmp.a), b = lvById(S.lv.cmp.b); if (!a || !b) return '';
  const c = AP.compareVersions(a, b), nm = (codes) => codes.length ? codes.map(deptName).join('、') : '沒有';
  const fl = (k, name) => { const f = c.filters[k]; return f.onlyA.length || f.onlyB.length ? `<div class="small">${name}：只有 A 選 ${esc(f.onlyA.join('、') || '—')}；只有 B 選 ${esc(f.onlyB.join('、') || '—')}</div>` : ''; };
  const mx = (m) => `夢幻 ${m.dream || 0}／正常 ${m.reach || 0}／保底 ${m.safe || 0}`;
  return `<div class="card" id="lv-cmp"><h2>比較兩版</h2><p class="small" style="margin:0 0 6px"><b>A</b> ${esc(a.title)}（${esc(when(a.createdAt))}）　<b>B</b> ${esc(b.title)}（${esc(when(b.createdAt))}）</p>
    <h3>成績</h3>${c.scores.length ? c.scores.map((s) => `<div class="small">${esc(s.name)}：A ${s.a == null ? '—' : s.a} → B ${s.b == null ? '—' : s.b}${s.diff ? `（${s.diff > 0 ? '+' : ''}${s.diff}）` : ''}</div>`).join('') : '<div class="small muted">兩版成績一樣。</div>'}
    ${c.listen ? `<div class="small">英聽：A ${esc(c.listen.a || '—')} → B ${esc(c.listen.b || '—')}</div>` : ''}
    <h3>篩選條件</h3>${fl('groups', '學群') + fl('regions', '地區') + fl('schools', '學校') + (c.filters.q ? `<div class="small">搜尋字：A「${esc(c.filters.q.a)}」→ B「${esc(c.filters.q.b)}」</div>` : '') || '<div class="small muted">篩選條件一樣。</div>'}
    <h3>勾的系</h3>
    <div class="small"><b>只有 A 有：</b>${esc(nm(c.depts.onlyA))}</div>
    <div class="small"><b>只有 B 有：</b>${esc(nm(c.depts.onlyB))}</div>
    <div class="small"><b>都有、落點變了：</b>${c.depts.changed.length ? c.depts.changed.map((x) => `${esc(deptName(x.deptCode))}（A ${x.a ? LPN[x.a] : '不在清單'} → B ${x.b ? LPN[x.b] : '不在清單'}）`).join('、') : '沒有'}</div>
    <div class="small muted">都有、落點一樣：${c.depts.same.length} 系</div>
    <h3>2／2／2 與學群</h3><div class="small">A ${mx(c.mix.a)}、學群 ${c.groups.a}；B ${mx(c.mix.b)}、學群 ${c.groups.b}</div>
    <div class="small">${c.mix.closer === 'tie' ? '兩版離建議的 2／2／2 一樣近。' : `比較接近建議 2／2／2 的是 ${c.mix.closer === 'a' ? 'A' : 'B'}。`}</div>
    <div class="row" style="margin-top:8px"><button type="button" class="btn sm ghost" data-act="lvCmpClose">收起比較</button></div></div>`;
}
ACT.lvCmp = () => {
  const L = S.lv; if (L.sel.length !== 2) return;
  const [x, y] = L.sel.map(lvById).sort((p, q) => p.seq - q.seq);   // A＝較早的一版
  L.cmp = { a: x.id, b: y.id }; lvRender(); const el = $('lv-cmp'); if (el) el.scrollIntoView({ block: 'start' });
};
ACT.lvCmpClose = () => { S.lv.cmp = null; lvRender(); };
ACT.lvAssess = () => { const ids = S.lv.sel.slice(0, 3); if (!ids.length) return; location.hash = '#/score/assess?v=' + encodeURIComponent(ids.join(',')); };
ACT.lvLoad = (el) => { const v = lvById(el.dataset.id); if (!v || v.status !== 'active') return; scFromVersion(v); toast(`載回「${v.title}」，改好再存就是新的一版。`); location.hash = '#/score'; };
ACT.lvEdit = (el) => { S.lv.edit = el.dataset.id; lvRender(); const t = $('lv-title'); if (t) t.focus(); };
ACT.lvEditCancel = () => { S.lv.edit = null; lvRender(); };
ACT.lvEditSave = async (el) => {
  const id = el.dataset.id, title = ($('lv-title').value || '').trim(), note = ($('lv-note').value || '').trim();
  if (!title) { toast('名稱不能空白。', true); return; }
  el.disabled = true;
  try {
    const r = await call('update_luodian_version', { p_id: id, p_title: title, p_note: note });
    if (!r.ok) return;
    const i = S.lv.items.findIndex((v) => v.id === id); if (i >= 0 && r.item) S.lv.items[i] = Object.assign({}, S.lv.items[i], r.item);
    S.lv.edit = null; lvRender(); toast('改好了。');
  } finally { el.disabled = false; }
};
ACT.lvDel = async (el) => {
  const v = lvById(el.dataset.id); if (!v || v.wishEvents) return;
  if (!window.confirm(`刪除「${v.title}」？刪掉以後這裡就看不到了。`)) return;
  el.disabled = true;
  try {
    const r = await call('delete_luodian_version', { p_id: v.id });
    if (!r.ok) return;
    S.lv.items = S.lv.items.filter((x) => x.id !== v.id); S.lv.sel = S.lv.sel.filter((x) => x !== v.id);
    if (S.lv.cmp && (S.lv.cmp.a === v.id || S.lv.cmp.b === v.id)) S.lv.cmp = null;
    lvRender(); toast('刪掉了。');
  } finally { el.disabled = false; }
};
ACT.lvRestore = async (el) => {
  el.disabled = true;
  try { const r = await call('restore_luodian_version', { p_id: el.dataset.id }); if (!r.ok) return; toast('還原了。'); await viewScoreHistory(); } finally { el.disabled = false; }
};
ACT.lvWish = (el) => { const v = lvById(el.dataset.id); if (v) return versionToWish(v, 'history', el); };
// 用某一版存成志願（歷史頁與評估頁共用）：成績跟現在存的不一樣先問要不要蓋掉；確認框；version_to_wishlist 留一筆不能改的紀錄
const sortedJson = (o) => JSON.stringify(Object.keys(o || {}).sort().reduce((a, k) => { a[k] = o[k]; return a; }, {}));
async function versionToWish(v, source, el) {
  if (!(await ensureAck())) return;
  let cur = null; try { const h = await call('me_home', {}, { quiet: true }); if (h.ok) { S.home = h; cur = normScores(h.journey); } } catch (e) { /* 取不到現在的成績，就當作不一樣、讓學生自己決定 */ }
  const vs = v.scores || {}, same = cur ? sortedJson(cur.scores) === sortedJson(vs) && (cur.listen || '') === (v.listen || '') : !Object.keys(vs).length;
  let overwrite = false;
  if (!same && Object.keys(vs).length) overwrite = window.confirm(`這版的成績（${AP.scoreBrief(vs, v.listen)}）跟你現在存的成績不一樣。\n要用這版的成績蓋掉現在存的成績嗎？\n按「取消」：只存志願，成績不動。`);
  const ok = await wishConfirm(v.rules, `用的是「${esc(v.title)}」${overwrite ? '，成績也會換成這版的' : ''}。`);
  if (!ok) return;
  if (el) el.disabled = true;
  try {
    const r = await call('version_to_wishlist', { p_id: v.id, p_overwrite_scores: overwrite, p_override_note: ok.note || null, p_disclaimer_version: DISCLAIMER_VERSION, p_source: source });
    if (!r.ok) return;
    S.sc = null;   // 志願換了：新作頁下次從存好的成績與志願重新帶入
    toast(`志願存好了（用「${v.title}」）。`); location.hash = '#/wish';
  } finally { if (el) el.disabled = false; }
}
