'use strict';   // 原本整支主程式包在一個函式裡並開嚴格模式；拆檔後每個檔各自開
// ── 第 2、3 幕：成績落點、挑科系 ──
// 2026-11-09 落點分析改版 L2：原 score.js 原樣搬來（「新作落點分析」子分頁），再加：子分頁列、模考／正式、存成一版、存志願確認框＋留痕、每系「這系在做什麼」
const GROUPS = ['資訊學群', '工程學群', '數理化學群', '醫藥衛生學群', '生命科學學群', '生物資源學群', '地球與環境學群', '建築與設計學群', '藝術學群', '社會與心理學群', '大眾傳播學群', '外語學群', '文史哲學群', '教育學群', '法政學群', '管理學群', '財經學群', '遊憩與運動學群', '其他學群'];
const REGIONS = [['北', '北部'], ['中', '中部'], ['南', '南部'], ['東', '東部'], ['離島', '離島']];
const LD = { byId: null, byCode: null };
function ldIndex() {
  if (LD.byId) return LD;
  LD.byId = new Map(); LD.byCode = new Map();
  for (let i = 0; i < CAAC_DEPTS.length; i++) { const d = CAAC_DEPTS[i]; LD.byId.set(d.id, d); LD.byCode.set(codeOf(d.id), d); }
  return LD;
}
function scInit(h) {
  const ns = normScores(h.journey);
  S.sc = { scores: ns ? Object.assign({}, ns.scores) : {}, listen: ns ? ns.listen : '', rows: [], byId: new Map(), groups: {}, regions: {}, schools: {}, q: '', zone: 'safe',
    shown: { safe: 40, reach: 40, dream: 40 }, sel: [], snapOld: {}, panel: false, saveT: 0, wishLoaded: false, kind: 'mock', from: null, intro: {} };
}
// 從歷史「載回新作」：用那一版的成績、篩選、勾的系重建（不覆蓋那一版，再存就是新的一版）
const arrObj = (a) => { const o = {}; (Array.isArray(a) ? a : []).forEach((x) => { o[x] = true; }); return o; };
function scFromVersion(v) {
  ldIndex(); const f = v.filters || {};
  S.sc = { scores: Object.assign({}, v.scores || {}), listen: v.listen || '', rows: [], byId: new Map(), groups: arrObj(f.groups), regions: arrObj(f.regions), schools: arrObj(f.schools), q: f.q || '', zone: 'safe',
    shown: { safe: 40, reach: 40, dream: 40 }, sel: (v.picks || []).slice().sort((a, b) => a.rank - b.rank).map((p) => (LD.byCode.get(String(p.deptCode)) || {}).id).filter(Boolean),
    snapOld: {}, panel: false, saveT: 0, wishLoaded: true, kind: v.scoreKind === 'official' ? 'official' : 'mock', from: { seq: v.seq, at: v.createdAt }, intro: {}, autoZone: true };
}
// 落點資料檔版本（存進每一版，之後資料更新時看得出是哪一份算的）：caac_history.js 的 SHA-1 前 8 碼；拿不到就空
async function dataVersion() {
  if (typeof S.dataVer === 'string') return S.dataVer;
  try {
    const buf = await (await fetch('../luodian/data/caac_history.js')).arrayBuffer(), h = new Uint8Array(await crypto.subtle.digest('SHA-1', buf));
    S.dataVer = 'caac_history:' + Array.from(h.slice(0, 4)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { S.dataVer = ''; }
  return S.dataVer;
}
async function viewScore() {
  setTab('score'); view(loading); const my = S.rt; let h;
  try { h = (await Promise.all([call('me_home'), ldReady()]))[0]; } catch (e) { return; }
  if (!h.ok || my !== S.rt) return; S.home = h;
  if (!(await ensureAck()) || my !== S.rt) return;
  if (typeof CAAC_DEPTS === 'undefined' || typeof predictCrossYear !== 'function') {
    view('<div class="card"><h2>落點資料沒有載入</h2><p class="muted">這一頁要用到 115 學年的校系資料。請重新整理；還是不行就聯絡育才仕。</p></div>'); return;
  }
  ldIndex(); if (!S.sc) scInit(h);
  if (!S.sc.wishLoaded) { await loadWishInto(); if (!S.sc || my !== S.rt) return; }
  scMount();
}
async function loadWishInto() {
  try {
    const w = await call('my_wishlist', {}, { quiet: true });
    if (S.sc && w.ok) {
      const items = (w.items || []).slice().sort((a, b) => a.rank - b.rank);
      S.sc.sel = items.map((it) => LD.byCode.get(String(it.deptCode))).filter(Boolean).map((d) => d.id);
      items.forEach((it) => { const d = LD.byCode.get(String(it.deptCode)); if (d && it.snapshot) S.sc.snapOld[d.id] = it.snapshot; });
      S.sc.wishLoaded = true;   // 2026-11-09 Codex 審查 P0-2：只有真的讀到志願才算載入過；讀失敗下次進頁再讀（避免空選取蓋掉原本的志願）
    }
  } catch (e) { /* 取不到已存的志願，這次先從空的開始挑，下次進頁再讀 */ }
}
function scMount() {
  const sc = S.sc, opts = '<option value="">—</option>' + Array.from({ length: 16 }, (_, i) => 15 - i).map((n) => `<option value="${n}">${n}</option>`).join('');
  const fromLine = sc.from ? `<div class="hint" style="margin:0 0 10px">你正在改第 ${esc(sc.from.seq)} 版（${esc(mdOf(sc.from.at))}）。再存就是新的一版，原本那一版不會被蓋掉。 <button type="button" class="linkbtn" data-act="scFresh">改成從我存的成績重排</button></div>` : '';
  view(`${subTabsHtml('new')}${fromLine}<div class="card"><h2>你的成績</h2>
    <p class="muted" style="margin:0 0 8px">學測級分（${YEAR} 學年的五標換算）。填幾科算幾科，填了就會馬上算。</p>
    <div class="scgrid">${SUBJECTS.map((k) => `<div><label for="sc_${k}">${SUBJ_NAME[k]}</label><select id="sc_${k}" data-in="score" data-k="${k}">${opts}</select><div class="band" id="bh_${k}"></div></div>`).join('')}
      <div><label for="sc_listen">英聽</label><select id="sc_listen" data-in="listen"><option value="">—</option><option>A</option><option>B</option><option>C</option><option>F</option></select></div></div>
    <div class="row small" style="margin-top:8px" role="radiogroup" aria-label="這是哪一種成績"><span class="muted">這是：</span><label class="tick"><input type="radio" name="sckind" data-in="kind" value="mock" ${sc.kind !== 'official' ? 'checked' : ''}> 模考或預估</label><label class="tick"><input type="radio" name="sckind" data-in="kind" value="official" ${sc.kind === 'official' ? 'checked' : ''}> 正式學測成績</label></div>
    <div class="small muted" id="sc-saved" style="margin-top:6px"></div></div>
  <div id="sc-empty" class="card muted">先填成績，這裡就會出現你能去的校系，分成保底、正常、夢幻。</div>
  <div id="sc-res" class="hidden">
    <div class="card"><div class="small muted">你的位置</div><div class="posline" id="sc-pos"></div></div>
    <div class="teach" id="sc-teach"></div>
    <div class="card"><h2>想念哪些學群？</h2><p class="muted small" style="margin:0 0 6px">建議集中在 2 個學群方向，最多不要超過 3 個。括號是你過得了第一階段的系數。</p><div id="sc-groups"></div><div id="sc-gwarn"></div></div>
    <div class="card"><h2>想去哪些學校？</h2><p class="muted small" style="margin:0 0 6px">先選地區，下面只列你選的學群裡、過得了第一階段的學校。不選就是全部。</p>
      <label class="f">地區</label><div id="sc-regions"></div>
      <label class="f">學校</label><div id="sc-schools"></div>
      <label class="f" for="sc-q">直接找校名或系名</label><input type="text" id="sc-q" data-in="q" placeholder="例如：資訊、臺大" autocomplete="off" value="${esc(sc.q)}"></div>
    <div class="card"><div class="ztabs" id="sc-zones" role="tablist" aria-label="保底、正常、夢幻"></div><div class="small muted" id="sc-zinfo" style="margin-bottom:4px"></div><div id="sc-list" role="tabpanel"></div></div>
  </div>
  <div id="sc-sel" class="selwrap"></div>`);
  SUBJECTS.forEach((k) => { $('sc_' + k).value = sc.scores[k] != null ? String(sc.scores[k]) : ''; });
  $('sc_listen').value = sc.listen || '';
  scRecalc();
}
// 篩出通過第一階段的系，並照 xuece.html 的順序判落點：有跨年精算的 verdict 就用它，否則用 classify
// 2026-11-12 落點引擎改法（luodian-analysis/OUTPUTS/07_落點引擎改法設計_v0.2.md ④）：classify 會多回 code:'na'＝沒有去年通過分數、不給字。
// 'na' 的系另成一格「沒有去年資料」，不算進 2／2／2；存版時 code 存 null、存志願時不留快照（資料庫只收 safe／reach／dream）。
const NA = 'na', ZONES = ['safe', 'reach', 'dream'];
const zName = (z) => (z === NA ? '沒有去年資料' : LPN[z]);
const zCls = (z) => (z === NA ? 'none' : z);
const rowName = (r) => (r.code === NA ? (r.label || zName(NA)) : LPN[r.code]);   // na 的列寫原因：沒有去年資料／過檢定就進二階／資料待校／今年標準有變
const SUBJ_CH = { chi: '國文', eng: '英文', math_a: '數A', math_b: '數B', soc: '社會', sci: '自然' };
// 沒列進清單的系（目前篩選範圍內）：沒考要看的科目、數A／數B 規則待確認
function skippedLine() {
  const sk = filteredRows(false, S.sc.skipped || []); if (!sk.length) return '';
  const miss = sk.filter((x) => x.status === 'missing'), mr = sk.length - miss.length, subs = {};
  miss.forEach((x) => x.missing.forEach((k) => { subs[k] = 1; }));
  const ks = SUBJECTS.filter((k) => subs[k]).map((k) => SUBJ_CH[k] || k);
  return '另有 ' + sk.length + ' 系沒列進來：' + [miss.length ? miss.length + ' 系要看的科目你沒考（' + ks.join('、') + '）' : '', mr ? mr + ' 系檢定同列數A、數B，你只過一科，要等老師對過簡章' : ''].filter(Boolean).join('；') + '。';
}
// 引擎改版後每系一個狀態（assessDept）：檢定未過不列；沒考要看的科目、數A／數B 規則待確認也不列，但記下來在說明列報數；
// 資料待校、今年標準有變、沒有去年資料、只看檢定 → 'na' 格，列上寫原因（label）。
function scRows() {
  const sc = S.sc; sc.rows = []; sc.byId = new Map(); sc.skipped = [];
  if (!Object.keys(sc.scores).length) return;
  const A = typeof assessDept === 'function';
  for (let i = 0; i < CAAC_DEPTS.length; i++) {
    const d = CAAC_DEPTS[i]; let code, label = '', basis = null, margin = null;
    if (A) {
      const a = assessDept(sc.scores, sc.listen, d);
      if (a.status === 'fail') continue;
      if (a.status === 'missing' || a.status === 'mathRule') { sc.skipped.push({ d, status: a.status, missing: a.missing || [] }); continue; }
      if (a.status === 'ok' && a.pred && a.pred.verdict) { code = a.pred.verdict; basis = a.pred.basisYear; margin = a.pred.margin; }
      else { code = NA; label = (typeof STATUS_TEXT !== 'undefined' && STATUS_TEXT[a.status]) || '沒有去年資料'; }
    } else {   // 舊引擎
      if (!passesStage1(sc.scores, sc.listen, d)) continue;
      const p = predictCrossYear(sc.scores, d);
      if (p && p.verdict) { code = p.verdict; basis = p.basisYear; margin = p.margin; } else { const c = classify(sc.scores, d); code = c.code; label = c.label || ''; }
    }
    const r = { d, code, label, basis, margin }; sc.rows.push(r); sc.byId.set(d.id, r);
  }
}
// 2026-11-08 owner 試用回饋 #7：成績之後先選學群、再選學校，清單才收斂。noSchool＝算學校選項用（不套學校篩選）
function filteredRows(noSchool, from) {
  const sc = S.sc, gk = Object.keys(sc.groups).length, rk = Object.keys(sc.regions).length, sk = noSchool ? 0 : Object.keys(sc.schools).length, q = sc.q.trim().toLowerCase();
  return (from || sc.rows).filter((r) => (!gk || sc.groups[r.d.group]) && (!rk || sc.regions[r.d.region]) && (!sk || sc.schools[r.d.school]) && (!q || (r.d.school + r.d.dept).toLowerCase().includes(q)));
}
const scNarrowed = () => { const sc = S.sc; return Object.keys(sc.groups).length + Object.keys(sc.schools).length > 0 || !!sc.q.trim(); };
function bandHints() {
  const sc = S.sc;
  SUBJECTS.forEach((k) => {
    const el = $('bh_' + k); if (!el) return;
    if (sc.scores[k] == null) { el.textContent = ''; el.className = 'band'; return; }
    const lv = getStudentLevel(k, sc.scores[k]);
    el.textContent = lv < 0 ? '未達底標' : LV_NAME[lv]; el.className = 'band' + (lv === 4 ? ' top' : lv < 0 ? ' low' : '');
  });
}
function renderPos() {
  const sc = S.sc;
  $('sc-pos').innerHTML = SUBJECTS.filter((k) => sc.scores[k] != null).map((k) => { const lv = getStudentLevel(k, sc.scores[k]); return `${SUBJ_ABBR[k]} <b>${lv < 0 ? '未達底標' : LV_NAME[lv]}</b>`; }).join('｜');
}
// 老師的話一句：位置由各科實際算出的級別填入（國英數社自的順序），數字是目前篩選後的實際系數，學群名來自目前選的學群
function teacherLine(fr, cnt) {
  const sc = S.sc, lv = {}; Object.keys(sc.scores).forEach((k) => { lv[k] = getStudentLevel(k, sc.scores[k]); });
  const ks = SUBJECTS.filter((k) => lv[k] != null), at = (n) => ks.filter((k) => lv[k] === n);
  const who = (list) => list.map((k) => SUBJ_ABBR[k]).join('、') + (list.length > 1 ? '都' : '');
  let head;
  if (at(4).length) head = who(at(4)) + '頂標';   // 例：英、數A、自都頂標
  else {   // 一科頂標也沒有：照實際位置說，最高的兩個級別為止。例：國前標、英均標
    const parts = []; for (let n = 3; n >= -1 && parts.length < 2; n--) { const g = at(n); if (g.length) parts.push(who(g) + (n < 0 ? '未達底標' : LV_NAME[n])); }
    head = parts.join('、') || '你的位置已經算出來了';
  }
  const gs = Object.keys(sc.groups); let mid;
  if (!fr.length) mid = head + '，這個範圍裡沒有過得了第一階段的系，換個學群或地區看看';
  else if (!(cnt.safe + cnt.reach + cnt.dream)) mid = head + '，這個範圍裡過得了第一階段的 ' + fr.length + ' 系都沒有去年的通過分數，只能先看第一階段檢定';
  else if (gs.length) {
    const scope = gs.join('、') + (gs.length > 1 ? '合起來' : '');
    mid = cnt.safe + cnt.reach ? scope + '保底 ' + cnt.safe + ' 系、正常 ' + cnt.reach + ' 系' : scope + '目前只有夢幻的系（' + cnt.dream + ' 系），可以先看看，也可以換個學群';
  } else if (cnt.safe) mid = head + '，保底的就有 ' + cnt.safe + ' 系';
  else if (cnt.reach) mid = head + '，保底的還沒有，正常 ' + cnt.reach + ' 系';
  else mid = head + '，目前只有夢幻的系（' + cnt.dream + ' 系），可以先看看，也可以換個學群';
  if (!scNarrowed()) return mid + '。先選你想念的學群，再挑學校，範圍縮小了我們再一系一系看。';
  return mid + '。先圈你想去的，我們再看每一系要什麼。';
}
function rowHtml(r) {
  const d = r.d, on = S.sc.sel.includes(d.id), open = !!S.sc.intro[d.id];
  return `<div class="drow-w" data-row="${esc(d.id)}"><label class="drow"><input type="checkbox" data-in="pick" data-id="${esc(d.id)}" ${on ? 'checked' : ''} aria-label="選 ${esc(d.school + ' ' + d.dept)}">
    <span class="dmain"><b>${esc(d.school)} ${esc(d.dept)}</b> <span class="lp ${zCls(r.code)}">${esc(rowName(r))}</span><span class="muted small" style="display:block">${esc(s2Line(d.stage2))}</span></span></label>
    <button type="button" class="btn sm ghost introbtn" data-act="intro" data-id="${esc(d.id)}" aria-expanded="${open}">這系在做什麼 ${open ? '▴' : '▾'}</button>
    ${open ? `<div class="dintro">${introHtml(d)}</div>` : ''}</div>`;
}
// 「這系在做什麼」（設計稿 §4.1，B3 預設）：只用專案裡已有、查得到出處的資料；外部科系介紹要先查證、owner 點頭才接（L6a）
function introHtml(d) {
  const info = S.dinfo && S.dinfo.items[codeOf(d.id)];
  if (!S.dinfo || info === undefined) return '<span class="muted small"><span class="spin"></span>載入中…</span>';
  return NG.renderDeptIntro(NG.deptIntroLines(d, info, S.dinfo.has116), mdOf);
}
// 一次查一批系的分則連結、老師一句話、116 簡章欄位（快取在 S.dinfo；查不到的系記成 null）
async function deptInfo(codes) {
  if (!S.dinfo) S.dinfo = { has116: false, items: {} };
  const need = Array.from(new Set(codes)).filter((c) => !(c in S.dinfo.items)).slice(0, 60);
  if (!need.length) return S.dinfo;
  const r = await call('dept_info', { p_codes: need, p_year: LUODIAN_YEAR, p_channel: CHANNEL }, { quiet: true });
  if (r.ok) { S.dinfo.has116 = !!r.has116; need.forEach((c) => { S.dinfo.items[c] = (r.items && r.items[c]) || null; }); }
  return S.dinfo;
}
ACT.intro = async (el) => {
  const sc = S.sc, id = el.dataset.id, r = sc.byId.get(id); if (!r) return;
  sc.intro[id] = !sc.intro[id];
  const repaint = () => { const w = document.querySelector(`.drow-w[data-row="${CSS.escape(id)}"]`); if (w) w.outerHTML = rowHtml(r); };
  repaint();
  if (sc.intro[id]) { try { await deptInfo([codeOf(id)]); } catch (e) { /* 查不到就只顯示前端已有的學群與二階 */ if (S.dinfo && !(codeOf(id) in S.dinfo.items)) S.dinfo.items[codeOf(id)] = null; } repaint(); }
};
ACT.scFresh = () => { S.sc = null; route(); };
IN.kind = (el) => { S.sc.kind = el.value === 'official' ? 'official' : 'mock'; };
function scFilterPills() {
  const sc = S.sc, ng = Object.keys(sc.groups).length, nr = Object.keys(sc.regions).length, ns = Object.keys(sc.schools).length;
  const gcnt = {}; sc.rows.forEach((r) => { gcnt[r.d.group] = (gcnt[r.d.group] || 0) + 1; });
  $('sc-groups').innerHTML = `<button type="button" class="pill ${ng ? '' : 'on'}" data-act="grp" data-g="">全部學群</button>` + GROUPS.filter((g) => gcnt[g] || sc.groups[g]).map((g) => `<button type="button" class="pill ${sc.groups[g] ? 'on' : ''}" data-act="grp" data-g="${esc(g)}">${esc(g.replace('學群', ''))}（${gcnt[g] || 0}）</button>`).join('');
  $('sc-regions').innerHTML = `<button type="button" class="pill ${nr ? '' : 'on'}" data-act="reg" data-r="">全國</button>` + REGIONS.map((r) => `<button type="button" class="pill ${sc.regions[r[0]] ? 'on' : ''}" data-act="reg" data-r="${esc(r[0])}">${esc(r[1])}</button>`).join('');
  // 學校：只列目前學群＋地區裡過得了第一階段的學校，系數多的在前；已選的學校就算不在範圍裡也留著，才取消得掉
  const scnt = new Map(); filteredRows(true).forEach((r) => { scnt.set(r.d.school, (scnt.get(r.d.school) || 0) + 1); });
  Object.keys(sc.schools).forEach((s) => { if (!scnt.has(s)) scnt.set(s, 0); });
  const list = Array.from(scnt.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'));
  $('sc-schools').innerHTML = `<button type="button" class="pill ${ns ? '' : 'on'}" data-act="sch" data-s="">全部學校</button>` + list.map(([s, n]) => `<button type="button" class="pill ${sc.schools[s] ? 'on' : ''}" data-act="sch" data-s="${esc(s)}">${esc(s)}（${n}）</button>`).join('');
  renderGroupWarn();
}
function scRender() {
  const sc = S.sc, fr = filteredRows(), cnt = { safe: 0, reach: 0, dream: 0, na: 0 };
  fr.forEach((r) => { cnt[r.code]++; });
  $('sc-teach').innerHTML = `<b>老師的話</b><p>${esc(teacherLine(fr, cnt))}</p>`;
  // 「沒有去年資料」那格只在有這種系（或正停在那格）時出現；舊引擎沒有 'na'，畫面跟原本一樣三格
  const zones = cnt.na || sc.zone === NA ? ZONES.concat(NA) : ZONES;
  // 按鈕的名字不靠裡面那顆一個字的色塊（讀屏與無障礙樹會把它丟掉，只剩數字）：aria-label 寫完整字
  $('sc-zones').innerHTML = zones.map((z) => `<button type="button" role="tab" aria-selected="${sc.zone === z}" aria-controls="sc-list" aria-label="${zName(z)} ${cnt[z]} 系" class="ztab ${sc.zone === z ? 'on' : ''}" data-act="zone" data-z="${z}"><span class="lp ${zCls(z)}">${zName(z)}</span> ${cnt[z]}</button>`).join('');
  $('sc-zinfo').textContent = `通過第一階段檢定：${fr.length} 系（保底 ${cnt.safe}／正常 ${cnt.reach}／夢幻 ${cnt.dream}${cnt.na ? '／沒有去年資料 ' + cnt.na : ''}）${skippedLine() ? '　' + skippedLine() : ''}`;
  if (sc.autoZone) { sc.autoZone = false; if (!cnt[sc.zone]) { const z = zones.find((k) => cnt[k]); if (z) { sc.zone = z; return scRender(); } } }
  const list = fr.filter((r) => r.code === sc.zone), n = sc.shown[sc.zone] || 40;
  if (!scNarrowed()) { $('sc-list').innerHTML = '<div class="hint">先在上面選學群或學校，清單才會縮到看得完。</div>'; return; }
  $('sc-list').innerHTML = (sc.zone === NA && list.length ? `<div class="hint">這些系沒有去年的第一階段通過分數可以比，給不了保底／正常／夢幻；你已經過了它們的檢定。${list.some((r) => r.label === '過檢定就進二階') ? '標「過檢定就進二階」的系第一階段不篩人，過了檢定就進第二階段。' : ''}${list.some((r) => r.label === '資料待校') ? '標「資料待校」的系去年的通過分數還在核對。' : ''}</div>` : '')
    + (list.length ? list.slice(0, n).map(rowHtml).join('') : `<div class="muted">這個範圍裡沒有「${zName(sc.zone)}」的系。</div>`)
    + (list.length > n ? `<div style="margin-top:8px"><button type="button" class="btn ghost sm" data-act="more">再看 ${Math.min(40, list.length - n)} 個（還有 ${list.length - n} 個）</button></div>` : '');
}
function scRecalc() {
  const sc = S.sc; scRows(); bandHints();
  const has = Object.keys(sc.scores).length > 0;
  $('sc-empty').classList.toggle('hidden', has); $('sc-res').classList.toggle('hidden', !has);
  if (has) { renderPos(); scFilterPills(); scRender(); }
  renderSel();
}
const scResetShown = () => { S.sc.shown = { safe: 40, reach: 40, dream: 40 }; S.sc.autoZone = true; };   // 篩選或成績一變：目前這格沒有系就自動跳到有系的那格
// 成績存檔：停手 0.7 秒才存，換頁前會立刻補存
// 2026-11-09 Codex 審查 P1-3：成績存檔排隊一個一個送（每次送出當下的成績），前一個還沒回來就不送下一個，舊成績不會晚到蓋掉新成績
let scoreChain = Promise.resolve();
function scoreSave() { scoreChain = scoreChain.then(scoreSaveNow, scoreSaveNow); return scoreChain; }
async function scoreSaveNow() {
  const sc = S.sc; if (!sc || !Object.keys(sc.scores).length) return;
  const el = $('sc-saved');
  try {
    const r = await call('save_scores', { p_year: YEAR, p_scores: sc.scores, p_listen: sc.listen || null }, { quiet: true });
    if (el) el.textContent = r.ok ? '成績已存。' : '成績還沒存成功，再改一下會重存。';
  } catch (e) { if (el) el.textContent = '成績還沒存成功，再改一下會重存。'; }
}
function scSchedule() { const sc = S.sc; clearTimeout(sc.saveT); const el = $('sc-saved'); if (el) el.textContent = ''; sc.saveT = setTimeout(() => { sc.saveT = 0; scoreSave(); }, 700); }
function flushSave() { const sc = S.sc; if (sc && sc.saveT) { clearTimeout(sc.saveT); sc.saveT = 0; scoreSave(); } }
IN.score = (el) => {
  const sc = S.sc, k = el.dataset.k;
  if (el.value === '') delete sc.scores[k]; else sc.scores[k] = parseInt(el.value, 10);
  scResetShown(); scSchedule(); scRecalc();
};
IN.listen = (el) => { S.sc.listen = el.value; scResetShown(); scSchedule(); scRecalc(); };
IN.q = (el) => { S.sc.q = el.value; scResetShown(); scFilterPills(); scRender(); };
ACT.zone = (el) => { S.sc.zone = el.dataset.z; scRender(); };
ACT.more = () => { const sc = S.sc; sc.shown[sc.zone] = (sc.shown[sc.zone] || 40) + 40; scRender(); };
ACT.grp = (el) => {
  const sc = S.sc, g = el.dataset.g, before = Object.keys(sc.groups).length;
  if (!g) sc.groups = {}; else if (sc.groups[g]) delete sc.groups[g]; else sc.groups[g] = true;
  const after = Object.keys(sc.groups).length; if (after > 3 && before <= 3) toast(GROUP_WARN, true);   // 剛超過 3 個學群的那一下跳警示（不擋）
  scResetShown(); scFilterPills(); scRender();
};
ACT.reg = (el) => { const sc = S.sc, r = el.dataset.r; if (!r) sc.regions = {}; else if (sc.regions[r]) delete sc.regions[r]; else sc.regions[r] = true; scResetShown(); scFilterPills(); scRender(); };
ACT.sch = (el) => { const sc = S.sc, s = el.dataset.s; if (!s) sc.schools = {}; else if (sc.schools[s]) delete sc.schools[s]; else sc.schools[s] = true; scResetShown(); scFilterPills(); scRender(); };
// 勾選（最多六個）與「存成志願」
IN.pick = (el) => {
  const sc = S.sc, id = el.dataset.id, at = sc.sel.indexOf(id), ngOf = () => new Set(sc.sel.map((x) => (LD.byId.get(x) || {}).group).filter(Boolean)).size, before = ngOf();
  if (el.checked && at < 0) { if (sc.sel.length >= 6) { el.checked = false; toast('最多選六個。要換的話，先取消一個。', true); return; } sc.sel.push(id); }
  else if (!el.checked && at >= 0) sc.sel.splice(at, 1);
  if (ngOf() > 3 && before <= 3) toast(GROUP_WARN, true);   // 勾的系剛橫跨超過 3 個學群：跳警示（不擋）
  renderSel();
};
// 2026-11-09 owner：方向建議 2 個學群，不建議超過 3 個；超過 3 個要跳警示，但不限制選取
const GROUP_WARN = '建議同學檢查既有的學習歷程。因為不同的學群所需要的學習歷程內容會完全不同，這樣子準備可能會有所不及。';
function groupWarnHtml(n, what) {
  if (n > 3) return `<div class="issue" style="margin-top:8px"><b>${esc(what)}已經 ${n} 個學群方向。</b>${esc(GROUP_WARN)}</div>`;
  if (n === 3) return `<div class="hint" style="margin-top:8px">${esc(what)} 3 個學群方向了，建議集中在 2 個；再多準備會來不及。</div>`;
  return '';
}
function renderGroupWarn() { const el = $('sc-gwarn'); if (el) el.innerHTML = groupWarnHtml(Object.keys(S.sc.groups).length, '你選的學群'); }
// 2026-11-09 owner：六個志願建議 2 夢幻、2 正常、2 保底
function mixLine(sc) {
  const c = { dream: 0, reach: 0, safe: 0, none: 0, na: 0 };
  sc.sel.forEach((id) => { const r = sc.byId.get(id); c[r ? r.code : 'none']++; });
  const part = (k) => `${LPN[k]} ${c[k]}${c[k] === 2 ? ' ✓' : ''}`;
  const ok = c.dream === 2 && c.reach === 2 && c.safe === 2;
  return `<div class="small" style="margin-bottom:6px">${part('dream')}｜${part('reach')}｜${part('safe')}${c.na ? `｜沒有去年資料 ${c.na}` : ''}${c.none ? `｜現在成績不在清單 ${c.none}` : ''}　<span class="muted">${ok ? '剛好 2／2／2，很平衡。' : '建議 2 個夢幻、2 個正常、2 個保底。'}</span></div>`;
}
function renderSel() {
  const box = $('sc-sel'); if (!box) return; const sc = S.sc, n = sc.sel.length;
  if (!n) { box.innerHTML = ''; return; }
  const ng = new Set(sc.sel.map((id) => (LD.byId.get(id) || {}).group).filter(Boolean)).size;
  const rows = sc.panel ? sc.sel.map((id, i) => {
    const d = LD.byId.get(id), r = sc.byId.get(id); if (!d) return '';
    return `<div class="selrow"><div class="dmain"><b>${i + 1}. ${esc(d.school)} ${esc(d.dept)}</b> ${r ? `<span class="lp ${zCls(r.code)}">${esc(rowName(r))}</span>` : '<span class="small muted">（現在的成績不在清單裡）</span>'}
      <div class="muted small">這系看什麼：${esc(s2Line(d.stage2).replace(/｜/g, '、'))}</div></div><button type="button" class="btn sm ghost" data-act="unpick" data-id="${esc(id)}">取消</button></div>`;
  }).join('') : '';
  const hasScore = Object.keys(sc.scores).length > 0;
  box.innerHTML = `<div class="selbar">${sc.panel ? `<div class="selpanel">${rows}</div>` : ''}${mixLine(sc)}${groupWarnHtml(ng, '勾的系橫跨')}<div class="row spread"><button type="button" class="btn ghost sm" data-act="selPanel">已選 ${n}／6　${sc.panel ? '▾ 收起' : '▴ 這系看什麼'}</button><span class="row"><button type="button" class="btn ghost" data-act="saveVer" ${hasScore ? '' : 'disabled title="先填成績才能存成一版"'}>存成一版</button><button type="button" class="btn" data-act="saveWish">存成志願</button></span></div>
    <div class="muted small" style="margin-top:4px">「存成一版」只留下這次排的結果，不動志願；「存成志願」會取代原本的志願，這次的選擇會留在歷史。參考用，不是錄取保證（<button type="button" class="linkbtn" data-act="discFull">完整說明</button>）。</div></div>`;
}
ACT.selPanel = () => { S.sc.panel = !S.sc.panel; renderSel(); };
ACT.unpick = (el) => {
  const sc = S.sc, at = sc.sel.indexOf(el.dataset.id); if (at >= 0) sc.sel.splice(at, 1);
  document.querySelectorAll('input[data-in="pick"]').forEach((cb) => { if (cb.dataset.id === el.dataset.id) cb.checked = false; });
  if (!sc.sel.length) sc.panel = false; renderSel();
};
function snapOf(id) {
  const sc = S.sc, r = sc.byId.get(id);
  if (r) return r.code === NA ? null : { code: r.code, basisYear: r.basis ? parseInt(r.basis, 10) : null, margin: r.margin };   // 沒有去年資料：不留快照
  const old = sc.snapOld[id]; return old && old.code ? { code: old.code, basisYear: old.basisYear == null ? null : old.basisYear, margin: old.margin == null ? null : old.margin } : null;   // 現在的成績不在清單裡、也沒有舊的：不補假資料，快照留空
}
// 一版要存的東西（設計稿 §5.1）：成績、篩選、勾的系（含當下算出的落點）、清單統計、規則檢查、兩個年份、資料版本
function scPayload() {
  const sc = S.sc, fr = filteredRows(), cnt = { safe: 0, reach: 0, dream: 0, na: 0 }; fr.forEach((r) => { cnt[r.code]++; });
  const picks = sc.sel.map((id, i) => {
    const d = LD.byId.get(id) || {}, r = sc.byId.get(id);
    return { deptId: id, deptCode: codeOf(id), rank: i + 1, group: d.group || null, code: r && r.code !== NA ? r.code : null, basisYear: r && r.basis ? parseInt(r.basis, 10) : null, margin: r && r.margin != null ? r.margin : null };
  });
  return { scoreKind: sc.kind === 'official' ? 'official' : 'mock', scores: Object.assign({}, sc.scores), listen: sc.listen || null,
    filters: { groups: Object.keys(sc.groups), regions: Object.keys(sc.regions), schools: Object.keys(sc.schools), q: sc.q.trim() },
    picks, counts: { passed: fr.length, safe: cnt.safe, reach: cnt.reach, dream: cnt.dream }, rules: AP.ruleSummary(picks, Object.keys(sc.groups).length),
    luodianYear: LUODIAN_YEAR, openYear: OPEN_YEAR, channel: CHANNEL, dataVersion: S.dataVer || null };
}
// 「存成一版」：只存這次排的結果，不動志願；成功跳歷史
ACT.saveVer = async (el) => {
  const sc = S.sc; if (!sc.sel.length || !Object.keys(sc.scores).length) return;
  el.disabled = true;
  try {
    if (sc.saveT) { clearTimeout(sc.saveT); sc.saveT = 0; await scoreSave(); }
    await dataVersion();
    const r = await call('save_luodian_version', { p: scPayload() });
    if (!r.ok) return;
    sc.from = { seq: r.seq, at: new Date().toISOString() };
    toast(`存成第 ${r.seq} 版。` + (r.archivedId ? '最舊的一版移到「更早的版本」。' : '')); location.hash = '#/score/history';
  } finally { el.disabled = false; }
};
// 「存成志願」：確認框（短版警語＋這版 2／2／2 與學群數＋選填理由）→ new_to_wishlist（同畫面與最近一版相同就不另建版）→ 留一筆不能改的紀錄
ACT.saveWish = async (el) => {
  const sc = S.sc; if (!sc.sel.length) return;
  if (!(await ensureAck())) return;
  const p = scPayload(), ok = await wishConfirm(p.rules);
  if (!ok) return;
  el.disabled = true;
  try {
    if (sc.saveT) { clearTimeout(sc.saveT); sc.saveT = 0; await scoreSave(); }
    await dataVersion(); p.dataVersion = S.dataVer || null;
    const r = await call('new_to_wishlist', { p: Object.assign(p, { overrideNote: ok.note || null, disclaimerVersion: DISCLAIMER_VERSION }) });
    if (!r.ok) return;
    sc.from = { seq: r.seq, at: new Date().toISOString() };
    toast(r.reused ? `志願存好了（就是第 ${r.seq} 版）。` : `志願存好了，這次的選擇也留成第 ${r.seq} 版。`); location.hash = '#/wish';
  } finally { el.disabled = false; }
};
