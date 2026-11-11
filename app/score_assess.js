'use strict';   // 2026-11-09 落點分析改版 L4／L5：「AI 落點機率評估」子分頁（設計稿 §6）
// 規則版一定有（不用 AI）：每系一階範圍、壓線、等值分、門檻走勢、二階事實、依據、不知道的；整版總評；多版比較；用這版存成志願；請老師看。
// AI 對話版只在「學生有 AI 同意」且「功能開著」時出現；AI 只把規則版結果講成人話（本機是假模型）。
S.as = null;   // { items, ids, ai, job }
async function viewScoreAssess() {
  setTab('score'); view(loading); const my = S.rt; let h;
  try { h = (await Promise.all([call('me_home'), ldReady()]))[0]; } catch (e) { return; }
  if (!h.ok || my !== S.rt) return; S.home = h;
  if (!(await ensureAck()) || my !== S.rt) return;
  if (typeof CAAC_DEPTS === 'undefined' || typeof predictCrossYear !== 'function') { view('<div class="card"><h2>落點資料沒有載入</h2><p class="muted">請重新整理；還是不行就聯絡育才仕。</p></div>'); return; }
  ldIndex();
  const r = await call('list_luodian_versions'); if (!r.ok || my !== S.rt) return;
  const items = r.items || [];
  const m = hashParts().q.match(/(?:^|&)v=([^&]*)/);
  let raw = ''; if (m) { try { raw = decodeURIComponent(m[1]); } catch (e) { raw = ''; } }   // 網址參數壞掉就當沒給（Codex 審查 P1-4）
  let ids = raw ? raw.split(',') : ((S.as && S.as.ids) || []);
  ids = ids.filter((id, i, a) => a.indexOf(id) === i && items.some((v) => v.id === id)).slice(0, 3);
  if (!ids.length) { const v = items.find((x) => x.status === 'active') || items[0]; if (v) ids = [v.id]; }
  const vs = ids.map((id) => items.find((v) => v.id === id));
  try { await deptInfo(vs.flatMap((v) => (v.picks || []).map((p) => String(p.deptCode)))); } catch (e) { /* 116 與分則連結拿不到：卡片照樣畫，116 行寫未匯入 */ }
  let ai = null;
  if (h.consent && h.consent.ai) { try { const s = await call('luodian_ai_status', {}, { quiet: true }); if (s.ok) ai = s; } catch (e) { /* 拿不到就當沒開 */ } }
  let job = null;
  if (ai && ai.enabled) {
    try { const l = await call('my_luodian_assess_list', {}, { quiet: true }); if (l.ok) job = (l.items || []).find((j) => sameIds(j.versionIds, ids)) || null; } catch (e) { /* 沒有舊的解讀 */ }
  }
  if (my !== S.rt) return;
  S.as = { items, ids, ai, job };
  asRender();
}
const sameIds = (a, b) => Array.isArray(a) && a.length === b.length && a.slice().sort().join(',') === b.slice().sort().join(',');
// 一版的規則版結果：每系一張卡（AP.deptCard）
function asVersion(v) {
  const has116 = !!(S.dinfo && S.dinfo.has116);
  const depts = (v.picks || []).slice().sort((a, b) => a.rank - b.rank).map((p) => {
    const d = LD.byCode.get(String(p.deptCode));
    if (!d) return { missing: true, deptCode: String(p.deptCode), rank: p.rank };
    const pred = predictCrossYear(v.scores || {}, d), cls = classify(v.scores || {}, d), hist = (typeof CAAC_HISTORY !== 'undefined' && CAAC_HISTORY[d.id]) || null;
    const info = S.dinfo && S.dinfo.items[String(p.deptCode)];
    const c = AP.deptCard(d, pred, cls, hist, has116, info ? info.y116 : null, passesStage1(v.scores || {}, v.listen || '', d));
    c.deptCode = String(p.deptCode); c.rank = p.rank; c.rulesUrl = info && info.y ? info.y.rulesUrl : null;
    return c;
  });
  const rules = AP.ruleSummary((v.picks || []).map((p) => ({ deptCode: p.deptCode, group: p.group, code: p.code })), (v.rules && v.rules.groupsSelected) || 0);
  return { v, depts, rules, lines: AP.overallLines(rules, v.scoreKind) };
}
function cardHtml(c) {
  if (c.missing) return `<div class="acard"><b>${c.rank}. 系代碼 ${esc(c.deptCode)}</b><div class="small muted">這個系在 115 資料裡找不到（可能改名或停招），請看甄選會公告。</div></div>`;
  const L = c.lines, head = c.range ? `一階門檻推估：${c.range}` : `一階門檻推估：${c.fallback ? '115 檢定判在「' + c.fallback + '」' : '資料不足'}`;
  return `<div class="acard t-${c.tier}"><div class="row spread"><b>${c.rank}. ${esc(c.school)} ${esc(c.dept)}</b><span><span class="tierpill t-${c.tier}">${esc(head)}</span>${c.edge ? ' <span class="pill warn">壓線</span>' : ''}</span></div>
    <div class="small"><b>${esc(c.tierName)}</b>　${esc(L.tier)}${L.edge ? ' ' + esc(L.edge) : ''}</div>
    ${L.equiv ? `<div class="small">一階｜${esc(L.equiv)}</div>` : ''}${L.trend ? `<div class="small muted">${esc(L.trend)}</div>` : ''}
    <div class="small">二階（事實）｜${esc(L.facts116)}；${esc(L.stage2)}</div>
    <div class="muted small">${esc(L.basis)}</div><div class="muted small">${esc(L.unknown)}</div>
    ${NG.safeUrl(c.rulesUrl) ? `<div class="small"><a href="${esc(c.rulesUrl)}" target="_blank" rel="noopener noreferrer">115 校系分則（甄選會）</a></div>` : ''}</div>`;
}
function asRender() {
  const A = S.as;
  const picker = A.items.length ? `<div class="card"><h2>要評估哪幾版？（1～3 版）</h2><div>${A.items.map((v) => `<button type="button" class="pill ${A.ids.includes(v.id) ? 'on' : ''}" data-act="asPick" data-id="${esc(v.id)}">${esc(v.title)}${v.status === 'archived' ? '（更早）' : ''}</button>`).join('')}</div></div>` : '';
  if (!A.ids.length) { view(`${subTabsHtml('assess')}<div class="card"><h2>還沒有版本可以評估</h2><p>先到「新作落點分析」排好，按「存成一版」。</p><a class="btn" href="#/score">去排一版</a></div>`); return; }
  const R = A.ids.map((id) => asVersion(A.items.find((v) => v.id === id)));
  const top = '<div class="alertbox"><b>這裡只看「第一階段門檻距離」。</b>沒有實際錄取、正備取、報名人數資料；116 的名額與甄試人數只是簡章上的數字，不代表把握度。</div>';
  const vcards = R.map((x) => `<div class="card"><h2>${esc(x.v.title)}<span class="muted small">　${esc(when(x.v.createdAt))}・${x.v.scoreKind === 'official' ? '正式學測成績' : '模考或預估'}</span></h2>
    <div class="small muted" style="margin-bottom:6px">${esc(AP.scoreBrief(x.v.scores, x.v.listen))}</div>
    <ul class="overall">${x.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    ${x.depts.map(cardHtml).join('')}
    <div class="row" style="margin-top:8px">${x.v.status === 'active' ? `<button type="button" class="btn" data-act="asWish" data-id="${esc(x.v.id)}">用這版存成志願</button>` : '<span class="muted small">這版在「更早的版本」裡，要存成志願請先到歷史還原。</span>'}</div></div>`).join('');
  view(`${subTabsHtml('assess')}${picker}${top}${R.length > 1 ? asCompareHtml(R) : ''}${vcards}${asAiHtml(R)}${asLookHtml()}`);
}
// 多版比較：同一個系在不同版的一階範圍；哪一版最接近 2／2／2
function asCompareHtml(R) {
  const codes = []; R.forEach((x) => x.depts.forEach((c) => { if (!c.missing && codes.indexOf(c.deptCode) < 0) codes.push(c.deptCode); }));
  const best = AP.closest222(R.map((x) => x.rules)).map((i) => '「' + R[i].v.title + '」');
  return `<div class="card"><h2>幾版放在一起看</h2><div class="tablewrap"><table class="cmp"><thead><tr><th>系</th>${R.map((x) => `<th>${esc(x.v.title)}</th>`).join('')}</tr></thead><tbody>
    ${codes.map((code) => `<tr><td>${esc(deptName(code))}</td>${R.map((x) => { const c = x.depts.find((y) => y.deptCode === code); return `<td>${c ? esc(c.tierName) + (c.range ? '<br><span class="muted small">' + esc(c.range) + '</span>' : '') + (c.edge ? ' <span class="pill warn">壓線</span>' : '') : '<span class="muted">沒選</span>'}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div><p class="small" style="margin:8px 0 0">最接近建議 2 夢幻／2 正常／2 保底的是：${esc(best.join('、'))}。</p></div>`;
}
// AI 段：只有 AI 同意＋功能開著才出現；結果開頭、末尾固定句；前端再掃一次禁字
function asAiHtml(R) {
  const A = S.as;
  if (!(S.home && S.home.consent && S.home.consent.ai) || !A.ai || !A.ai.enabled) return '';
  const j = A.job;
  let body = '';
  if (j && j.status === 'done' && j.result) {
    const res = j.result, nameOf = (code) => deptName(code);
    const text = [].concat((res.perDept || []).flatMap((p) => [p.line1, p.line2 || '']), res.overall || [], [res.question || '']).join('\n');
    if (AP.scanAssertive(text, ASSERTIVE_BANNED, DISCLAIMER_ALLOWED).length || /[%％]/.test(text)) body = '<div class="hint">AI 的解讀沒有通過檢查，先看上面算出來的結果；也可以按下面「請老師看」。</div>';
    else body = `<div class="aibox"><div class="small"><b>${esc(AI_HEAD)}</b></div>
      ${(res.perDept || []).map((p) => { const nm = nameOf(p.deptId), l1 = String(p.line1 || '').replace(/^[^：]{2,40}：/, (h) => (nm.replace(/\s/g, '').includes(h.slice(0, -1).replace(/\s/g, '')) ? '' : h)); return `<div class="small"><b>${esc(nm)}</b>　${esc(l1)}${p.line2 ? ' ' + esc(p.line2) : ''}</div>`; }).join('')}
      ${(res.overall || []).length ? `<ul class="overall">${res.overall.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      ${res.question ? `<div class="small">想一想：${esc(res.question)}</div>` : ''}
      ${(res.nextLinks || []).length ? `<div class="small">建議先看這幾系的分則：${res.nextLinks.map((c) => { const u = S.dinfo && S.dinfo.items[c] && S.dinfo.items[c].y && S.dinfo.items[c].y.rulesUrl; return NG.safeUrl(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(nameOf(c))}</a>` : esc(nameOf(c)); }).join('、')}</div>` : ''}
      <div class="small muted" style="margin-top:6px">${esc(AI_TAIL)}</div></div>`;
  } else if (j && (j.status === 'running' || j.status === 'queued')) body = j.slow ? '<div class="hint">AI 老師還在看，等一下按「看結果出來了沒」。</div>' : '<div class="muted small"><span class="spin"></span>AI 老師正在看…</div>';
  else if (j && (j.status === 'failed' || j.status === 'rejected')) body = `<div class="hint">AI 的解讀沒有通過檢查${/^REJECTED_/.test(j.error || '') ? '（說法不合規，已退回）' : ''}，先看上面算出來的結果；也可以按下面「請老師看」。</div>`;
  return `<div class="card"><h2>AI 老師的解讀</h2><p class="muted small" style="margin:0 0 8px">AI 只會把上面算出來的結果講成人話、幫你比較這幾版，不會自己生數字。</p>${body}
    <div class="row" style="margin-top:8px">${j && (j.status === 'running' || j.status === 'queued')
      ? `<button type="button" class="btn ghost" data-act="asAiCheck" ${j.slow ? '' : 'disabled'}>看結果出來了沒</button>`
      : `<button type="button" class="btn ghost" data-act="asAi">${j ? '請 AI 老師重新解讀' : '請 AI 老師解讀這幾版'}</button>`}</div></div>`;
}
function asLookHtml() {
  return `<div class="card"><h2>請老師看</h2><p class="muted small" style="margin:0 0 6px">老師會看你勾的這幾版，給你建議。想問什麼可以先寫（可以不寫，最多 200 字）。</p>
    <textarea id="as-look" maxlength="200" rows="2"></textarea><div class="row" style="margin-top:6px"><button type="button" class="btn ghost" data-act="asLook">請老師看這幾版</button></div></div>`;
}
// 給 AI 的規則版結果（白名單欄位；deptId＝志願代碼）
function asRuleResult() {
  return { disclaimerVersion: DISCLAIMER_VERSION, versions: S.as.ids.map((id) => {
    const x = asVersion(S.as.items.find((v) => v.id === id));
    return { id: x.v.id, seq: x.v.seq, title: x.v.title, scoreKind: x.v.scoreKind, rules: x.rules,
      depts: x.depts.filter((c) => !c.missing).map((c) => ({ deptId: c.deptCode, name: c.school + ' ' + c.dept, tier: c.tier, tierName: c.tierName, range: c.range, edge: c.edge,
        basisYear: c.basisYear != null ? Number(c.basisYear) : null, margin: c.margin, quota116: c.quota116 != null ? c.quota116 : null, interview116: c.interview116 != null ? c.interview116 : null })) };
  }) };
}
ACT.asPick = (el) => {
  const A = S.as, id = el.dataset.id, at = A.ids.indexOf(id);
  if (at >= 0) { if (A.ids.length === 1) return; A.ids.splice(at, 1); }
  else { if (A.ids.length >= 3) { toast('最多一次評估 3 版。', true); return; } A.ids.push(id); }
  try { history.replaceState(null, '', '#/score/assess?v=' + encodeURIComponent(A.ids.join(','))); } catch (e) { /* 網址沒換也不影響畫面 */ }
  A.job = null; route();
};
ACT.asWish = (el) => { const v = S.as.items.find((x) => x.id === el.dataset.id); if (v) return versionToWish(v, 'assess', el); };
ACT.asLook = async (el) => {
  el.disabled = true;
  try {
    const r = await call('request_teacher_look', { p_version_ids: S.as.ids, p_note: ($('as-look').value || '').trim() || null });
    if (r.ok) { toast('已請老師看這幾版。'); $('as-look').value = ''; }
  } finally { el.disabled = false; }
};
ACT.asAi = async (el) => {
  const A = S.as, my = S.rt; el.disabled = true;
  try {
    const r = await call('luodian_assess_start', { p_version_ids: A.ids, p_rule_result: asRuleResult() });
    if (!r.ok) return;
    A.job = { id: r.jobId, status: 'running', versionIds: A.ids.slice() }; asRender();
    try { await sb.functions.invoke('nopq-ai', { body: { jobId: r.jobId } }); } catch (e) { /* 結果看 my_luodian_assess */ }
    await asPoll(r.jobId, my);
  } finally { el.disabled = false; }
};
// 讀 AI 解讀的結果；還在跑就每 1.5 秒再看一次，最多 8 次，之後給「看結果出來了沒」讓學生自己再按（Codex 審查 P0-1）
async function asPoll(jobId, my) {
  for (let k = 0; k < 8; k++) {
    let j = null; try { j = await call('my_luodian_assess', { p_job_id: jobId }, { quiet: true }); } catch (e) { j = null; }
    if (my !== S.rt) return;
    if (j && j.ok && j.job && j.job.status !== 'running' && j.job.status !== 'queued') { S.as.job = j.job; asRender(); return; }
    if (j && j.ok && j.job) S.as.job = j.job;
    await sleep(1500); if (my !== S.rt) return;
  }
  S.as.job = Object.assign({}, S.as.job || { id: jobId, status: 'running' }, { slow: true }); asRender();
}
ACT.asAiCheck = async (el) => { const j = S.as && S.as.job; if (!j) return; el.disabled = true; S.as.job = Object.assign({}, j, { slow: false }); asRender(); await asPoll(j.id, S.rt); };
