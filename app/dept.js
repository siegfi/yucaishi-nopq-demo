'use strict';
// ── 2026-11-21 審查資料項目模型第三步：「這一系要交的」一頁（#/dept/{校系代碼}）──
// 規格：OUTPUTS/uiux_plan_20261119/04_項目模型第三步_畫面規格_v0.1.md 畫面③（這一系要勾的）、④（套用到同學群的系）、⑤（照學校說的方式交打勾），第 14.1 節最後一段。
// 資料：後端 28v 的 my_dept_picks（一系的全部項目與進度＋可以勾的件＋請老師看狀態）；存：set_dept_picks、copy_dept_picks、ask_pick_review、accept_pick_advice、set_dept_item_check。
// 共用規則（規格第 1 節）：上限的數字一律從官方項目表讀；按一下就存（右上「存好了」，沒存到就退回原狀＋共用句）；學生畫面不出現 AI 字樣。
const DP = { code: null, r: null, msg: {}, askOpen: false, copyOpen: false, copySel: null, hideReply: false, savedT: 0 };
const dpW = () => NG.WORDS;
const dpF = (k, o) => NG.fill(NG.WORDS[k], o);
const dpDate = (t) => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? '' : (d.getMonth() + 1) + '/' + d.getDate(); };
const dpTeacher = (r) => { const n = (r && (r.teacherName || (r.dept && r.dept.ask && r.dept.ask.teacherName))) || ''; return n ? (/老師/.test(n) ? n : n + '老師') : '老師'; };
const dpSq = (code) => `<span class="csq${code ? '' : ' q'}" aria-label="${code ? '代碼 ' + esc(code) : '還沒標代碼'}">${esc(code || '？')}</span>`;
const DP_SCHOOL = ['schoolForm', 'proof', 'upload'], DP_OTHER = ['misc', 'unknown'];
const DP_HINT = { schoolForm: 'hintSchoolForm', proof: 'hintProof', upload: 'hintUpload', unknown: 'hintUnknown', misc: 'hintUnknown' };

// 11-22 A4（規格 4.4）：一件被收起來 → 伺服器從各系清單拿掉（inventory_hide 回 removedDepts）；那幾系的頁面下次打開寫一次 WORDS.dpHiddenNote。
//   記在這台瀏覽器（localStorage）；存取失敗就不寫那一句，清單本身照樣由伺服器拿掉。取出時就清掉那一系＝只寫一次。
const DP_HID_KEY = 'nopq.dpHiddenNotes';
function dpHidNoteAdd(title, depts) {
  try { const a = JSON.parse(localStorage.getItem(DP_HID_KEY) || '[]'); a.push({ t: String(title || ''), d: depts.map(String) }); localStorage.setItem(DP_HID_KEY, JSON.stringify(a.slice(-20))); } catch (e) { /* 存不了就不寫那一句 */ }
}
function dpHidNoteTake(code) {
  try {
    const a = JSON.parse(localStorage.getItem(DP_HID_KEY) || '[]'), out = a.filter((x) => Array.isArray(x.d) && x.d.includes(code)).map((x) => x.t);
    localStorage.setItem(DP_HID_KEY, JSON.stringify(a.map((x) => ({ t: x.t, d: (x.d || []).filter((c) => c !== code) })).filter((x) => x.d.length)));
    return out;
  } catch (e) { return []; }
}
async function viewDept(code) {
  setTab('need'); const my = S.rt; DP.hidNotes = dpHidNoteTake(code);
  view(`<div class="center muted" data-loading="1"><span class="spin"></span><span class="ld-msg">${esc(dpW().st3Loading)}</span></div>`);
  Object.assign(DP, { code, r: null, msg: {}, askOpen: false, copyOpen: false, copySel: null, hideReply: false, cited: null });
  const r = await call('my_dept_picks', { p_dept_code: code }, { quiet: true }).catch(() => null);
  if (my !== S.rt) return;
  if (!r || !r.ok) {
    view(`<div class="card"><p>${esc(r && r.error === 'NOT_IN_WISHLIST' ? dpW().dpNotWish : dpW().st3LoadFail)}</p>`
      + `<div class="row"><button type="button" class="btn" data-act="reload">${esc(dpW().st3Retry)}</button><a class="btn ghost" href="#/need">${esc(dpW().dpBack)}</a></div></div>`);
    return;
  }
  DP.r = r; dpDraw(); dpCiteLoad(my, code, r);   // 2026-11-24 A13 W13：再讀這一系各篇引用了哪幾件，補「還沒在任何一篇裡提到」
}
// 2026-11-24 A13 W13（07 乙「雙向提示」）：勾給這一系的件，在這一系的 N、O、P、Q 任何一篇都沒被引用 → 那一件下面寫「這一件還沒在任何一篇裡提到。」
//   每一篇讀 my_cite_items 的 citedIn；有一篇讀不到就不說（免得說錯）；沒有稿的系（還沒開 N、O）也不說。
async function dpCiteLoad(my, code, r) {
  const ids = ((r.dept && r.dept.write && r.dept.write.items) || []).filter((x) => x.docId && /^[NOPQ]$/.test(x.code)).map((x) => x.docId);
  if (!ids.length) return;
  const rs = await Promise.all(ids.map((id) => call('my_cite_items', { p_case_doc_id: id }, { quiet: true, noRefresh: true }).catch(() => null)));
  if (my !== S.rt || code !== DP.code || rs.some((x) => !x || !x.ok)) return;
  const set = new Set(); rs.forEach((x) => (x.items || []).forEach((it) => { if ((it.citedIn || []).length) set.add(it.sourceId); }));
  DP.cited = set; dpDraw();
}
const dpUncited = (f) => (DP.cited && f.picked && !DP.cited.has(f.id) ? `<div class="muted small dpuncited">${esc(W13.deptNo)}</div>` : '');
async function dpReload(force) {
  const my = S.rt, code = DP.code;
  const r = await call('my_dept_picks', { p_dept_code: code }, { quiet: true }).catch(() => null);
  if (my !== S.rt || code !== DP.code) return;
  if (!force && DP.pending > 0) return;   // 還有存檔在路上：不拿伺服端的舊樣子蓋掉畫面（最後一筆存完會再讀一次）
  if (r && r.ok) { DP.r = r; dpDraw(); }
}
function dpFlashSaved() {
  const el = $('dp-saved'); if (!el) return;
  el.classList.remove('hidden'); clearTimeout(DP.savedT); DP.savedT = setTimeout(() => { const e2 = $('dp-saved'); if (e2) e2.classList.add('hidden'); }, 2000);
}
function dpDraw() {
  const y = window.scrollY, r = DP.r, d = r.dept, off = r.official, W = dpW();
  const pickSum = (d.pick || []).reduce((a, g) => a + (g.picked || 0), 0);
  const head = `<div class="card"><div class="row spread"><a href="#/need" class="small">${esc(W.dpBack)}</a><span id="dp-saved" class="saved hidden" role="status">${esc(W.st3Saved)}</span></div>
    <h2 style="margin:6px 0 4px">${esc(d.rank + '. ' + (d.schoolName || '') + ' ' + (d.name || ''))}</h2>
    ${d.ready ? `<div class="muted small" data-role="dp-progress">${dpF('dpProgress', { w: d.write.total, f: d.write.finalized, p: pickSum, c: d.school.ready, t: d.school.total }).split('\n').map((l) => `<div>${esc(l)}</div>`).join('')}</div>` : ''}</div>`;
  if (!d.ready) {
    view(head + `<div class="card"><p>${esc(W.dpNotReady)}</p>${d.rulesUrl ? `<a class="btn ghost" href="${esc(d.rulesUrl)}" target="_blank" rel="noopener noreferrer">${esc(W.dpSeeRules)}</a>` : ''}</div>`);
    window.scrollTo(0, y); return;
  }
  view(head + dpWriteHtml(d, off) + dpPickHtml(r, d, off) + dpSchoolHtml(d, off));
  window.scrollTo(0, y);
}
// ── 要寫的，在這裡寫（沿用已上線的排法：點了去寫；R 以後還沒開的用「開始寫」）──
function dpWriteHtml(d, off) {
  const W = dpW(), items = (d.write && d.write.items) || [];
  if (!items.length) return '';
  const li = (x) => {
    const name = x.code > 'Q' ? x.code + ' ' + (x.name || '') : NG.offName(off, x.code);
    const sp = x.docId ? stepOf(x.state) : null, st = sp ? sp[0] : W.miNotStarted;   // 2026-11-25 第 1 批 N10-13、N04-04：跟撰寫NOPQ 同一套狀態字與按鈕字（原：後端 stateLabel＋一律〔繼續寫〕）
    const btn = x.docId ? `<a class="btn sm ghost" href="#/doc/${esc(x.docId)}">${esc(sp[1])}</a>`
      : x.code > 'Q' ? `<button type="button" class="btn sm" data-act="openExtra" data-dept="${esc(d.deptCode)}" data-code="${esc(x.code)}">${esc(W.startWrite)}</button>`
      : `<a class="btn sm ghost" href="#/write">${esc(W.startWrite)}</a>`;
    return `<li class="drow"><span><b>${esc(name)}</b>${x.code === 'N' || x.code === 'O' ? ` <span class="muted small">${esc(W.miShared)}</span>` : ''}${sp && sp[2] ? `<div class="muted small">${esc(sp[2])}</div>` : ''}</span><span class="pill">${esc(st)}</span>${btn}</li>`;
  };
  return `<div class="card dpwrite"><h3>${esc(W.zWrite)}</h3><ul class="plain">${items.map(li).join('')}</ul></div>`;
}
// ── 畫面③：從學習歷程檔案挑的 ──
function dpPickHtml(r, d, off) {
  const W = dpW(), groups = (d.pick || []).filter((g) => g.listed), files = r.files || [], ask = d.ask, tName = dpTeacher(r);
  let h = `<div class="card" id="dp-pick"><h3>${esc(W.zPrep)}</h3>${(DP.hidNotes || []).map((t) => `<div class="hint">${esc(dpF('dpHiddenNote', { t }))}</div>`).join('')}<p class="muted small" style="margin:0 0 6px">${esc(W.pickIntro)}</p>
    <div class="drow"><span><b>${esc(NG.offName(off, 'A'))}</b><div class="muted small">${esc(W.pickA)}</div></span></div>`;
  if (!groups.length) return h + `<p>${esc(W.dpNoPortfolio)}</p></div>`;
  if (!files.length) return h + `<p>${esc(W.dpEmptyAll)}</p><a class="btn" href="#/mine">${esc(W.dpGoPut)}</a></div>`;
  // 老師回覆（有才出現）
  if (ask && ask.status === 'replied' && !DP.hideReply) {
    const anyAdv = files.some((f) => (f.advice === 'swap' && f.picked) || (f.advice === 'pick' && !f.picked));   // 照建議改還會變才給兩顆鈕（11-21 截圖：照改之後鈕還在，再按＝拿掉 0、加上 0）
    h += `<div class="reply"><b>${esc(dpF('dpReplyTitle', { t: ask.teacherName ? dpTeacher({ teacherName: ask.teacherName }) : tName, d: dpDate(ask.repliedAt) }))}</b>
      ${ask.teacherNote ? `<div class="pre">${esc(ask.teacherNote)}</div>` : ''}${ask.changedAfterReply ? `<div class="muted small">${esc(W.cpStale)}</div>` : ''}
      ${anyAdv ? `<div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-act="dpAccept">${esc(W.dpAccept)}</button><button type="button" class="btn sm ghost" data-act="dpKeep">${esc(W.dpKeep)}</button></div>` : ''}</div>`;
  }
  h += '<div class="pcols2">';
  groups.forEach((g) => {
    const gf = files.filter((f) => f.group === g.group), picked = gf.filter((f) => f.picked).sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
    const un = gf.filter((f) => !f.picked), n = picked.length, lim = g.limit;
    const title = lim == null ? dpF('dpPickedNoLimit', { n }) : n === lim ? dpF('dpPickedFull', { limit: lim }) : dpF('dpPickedTitle', { n, limit: lim });
    const listed = (g.codes || []).map((c) => NG.offName(off, c)).join('、');
    const tags = (f) => (f.itemCode ? '' : ` <span class="pill warn">${esc(W.noCode)}</span>`) + (f.itemCode && f.itemCodeBy === 'teacher' ? ` <span class="pill">${esc(dpF('miByTeacher', { t: tName }))}</span>` : '')
      + (f.advice === 'pick' ? ` <span class="pill ok">${esc(W.advPick)}</span>` : f.advice === 'swap' ? ` <span class="pill warn">${esc(W.advSwap)}</span>` : '');
    const notes = (f) => (f.itemCode ? ((g.codes || []).includes(f.itemCode) ? '' : `<div class="muted small">${esc(dpF('dpNotListed', { code: f.itemCode }))}</div>`) : `<div class="muted small">${esc(W.noCodeHint)}</div>`)
      + (f.adviceNote ? `<div class="small">${esc(f.adviceNote)}</div>` : '');
    const name = (f) => esc(f.title || f.fileName || '');
    h += `<div class="pgroup" data-group="${esc(g.group)}"><h4>${esc(g.group)}　<span class="muted small">${esc(lim == null ? W.pickLimitNone : dpF(g.group === '課程學習成果' ? 'pickLimitCourse' : 'pickLimitMulti', { limit: lim }))}</span></h4>
      ${listed ? `<div class="muted small">${esc(dpF('dpListed', { list: listed }))}</div>` : ''}
      <div class="ptitle">${esc(title)}</div>
      ${lim != null && n > lim ? `<div class="redbox">${esc(dpF('dpOverLowered', { limit: lim, n, k: n - lim }))}</div>` : ''}
      ${n ? `<ol class="plain picked">${picked.map((f, i) => `<li class="pk" data-id="${esc(f.id)}"><span class="ord">${i + 1}</span>${dpSq(f.itemCode)}<span class="pt">${name(f)}${tags(f)}${notes(f)}${dpUncited(f)}</span>
          <span class="pbtns">${i > 0 ? `<button type="button" class="btn sm ghost" data-act="dpUp" data-id="${esc(f.id)}" data-group="${esc(g.group)}">${esc(W.dpUp)}</button>` : ''}${i < n - 1 ? `<button type="button" class="btn sm ghost" data-act="dpDown" data-id="${esc(f.id)}" data-group="${esc(g.group)}">${esc(W.dpDown)}</button>` : ''}<button type="button" class="btn sm ghost" data-act="dpRemove" data-id="${esc(f.id)}" data-group="${esc(g.group)}">${esc(W.dpRemove)}</button></span></li>`).join('')}</ol>`
        : `<p class="muted small">${esc(lim == null ? dpF('dpNotPickedNoLimit', { n: gf.length }) : dpF('dpNotPicked', { n: gf.length, limit: lim }))}</p>`}
      ${un.length ? `<div class="ptitle">${esc(dpF('dpUnpickedTitle', { m: un.length }))}</div><ul class="plain unpicked">${un.map((f) => `<li class="pk" data-id="${esc(f.id)}">${dpSq(f.itemCode)}<span class="pt">${name(f)}${tags(f)}${notes(f)}</span>
          <span class="pbtns"><button type="button" class="btn sm" data-act="dpPick" data-id="${esc(f.id)}" data-group="${esc(g.group)}">${esc(W.dpPickBtn)}</button></span>
          ${DP.msg[f.id] ? `<div class="redbox" role="alert">${esc(DP.msg[f.id])}</div>` : ''}</li>`).join('')}</ul>` : ''}</div>`;
  });
  h += `</div><p class="muted small">${esc(W.dpReminder)}</p>`;
  // 請老師看、套用到同學群的系
  let askH;
  if (!r.hasTeacher) askH = `<p>${esc(W.dpNoTeacher)}</p><a class="btn ghost" href="#/shop">${esc(W.dpSeePlans)}</a>`;
  else if (ask && ask.status === 'asked') askH = `<p>${esc(dpF('dpAsked', { t: tName, d: dpDate(ask.askedAt) }))}</p>${ask.changedAfterAsk ? `<p class="muted small">${esc(W.dpChangedAfterAsk)}</p>` : ''}`;
  else askH = DP.askOpen ? `<div class="askbox"><p>${esc(dpF('dpAskConfirm', { t: tName }))}</p><textarea id="dp-ask-note" maxlength="300" placeholder="${esc(W.dpAskPh)}"></textarea>
      <div class="row"><button type="button" class="btn" data-act="dpAskSend">${esc(W.dpSend)}</button><button type="button" class="btn ghost" data-act="dpAskCancel">${esc(W.dpNotNow)}</button></div></div>`
    : `<button type="button" class="btn" data-act="dpAskOpen">${esc(ask && ask.status === 'replied' ? W.dpAskAgain : W.dpAsk)}</button>`;
  const others = (r.otherDepts || []).filter((x) => (x.pick || []).some((p) => p.listed));
  const pickSum = (d.pick || []).reduce((a, g) => a + (g.picked || 0), 0);
  const copyBtn = others.length && pickSum ? `<button type="button" class="btn ghost" data-act="dpCopyOpen">${esc(W.dpCopy)}</button>` : '';
  h += `<div class="row" style="margin-top:8px;align-items:flex-start">${askH}${DP.copyOpen ? '' : copyBtn}</div>`;
  if (DP.copyOpen) h += dpCopyHtml(r, d, others);
  return h + '</div>';
}
// ── 畫面④：套用到同學群的系 ──
function dpCopyHtml(r, d, others) {
  const W = dpW(), cnt = (x, g) => ((x.pick || []).find((p) => p.group === g) || {}).picked || 0;
  if (!DP.copySel) DP.copySel = new Set(d.group ? others.filter((x) => x.group === d.group).map((x) => x.deptCode) : []);
  const srcGroups = (d.pick || []).filter((p) => p.listed && p.picked).map((p) => p.group);
  const row = (x) => {
    const tg = (x.pick || []).filter((p) => p.listed).map((p) => p.group), miss = srcGroups.filter((g) => !tg.includes(g)), has = srcGroups.filter((g) => tg.includes(g));
    const now = has.reduce((a, g) => a + cnt(x, g), 0);
    const sub = miss.length && has.length ? dpF('cpOnly', { g: miss.join('、'), h: has.join('、') }) : now ? dpF('cpWill', { n: now }) : W.cpNone;
    return `<label class="crow"><input type="checkbox" data-in="dpCopySel" value="${esc(x.deptCode)}"${DP.copySel.has(x.deptCode) ? ' checked' : ''}${has.length ? '' : ' disabled'}>
      <span>${esc(x.rank + '. ' + (x.schoolName || '') + ' ' + (x.name || ''))}<div class="muted small">${esc(sub)}</div></span></label>`;
  };
  const same = d.group ? others.filter((x) => x.group === d.group) : [], rest = others.filter((x) => !same.includes(x));
  let h = `<div class="copybox"><h4>${esc(W.cpTitle)}</h4><p class="small">${esc(dpF('cpFrom', { name: d.name || '', a: cnt(d, '課程學習成果'), b: cnt(d, '多元表現') }))}</p>`;
  if (!d.group) h += `<p class="muted small">${esc(W.cpNoGroup)}</p>${rest.map(row).join('')}`;
  else if (!same.length) h += `<p class="muted small">${esc(W.cpNoSame)}</p>${rest.map(row).join('')}`;
  else h += `<div class="ptitle">${esc(dpF('cpSame', { g: d.group }))}</div><p class="muted small">${esc(W.cpSameHint)}</p>${same.map(row).join('')}`
    + (rest.length ? `<details><summary>${esc(dpF('cpOthers', { n: rest.length }))}</summary>${rest.map(row).join('')}</details>` : '');
  const n = DP.copySel.size;
  h += `<p class="muted small">${esc(W.cpTip1)}<br>${esc(W.cpTip2)}</p>
    <div class="row"><button type="button" class="btn" data-act="dpCopyGo"${n ? '' : ' disabled'}>${esc(dpF('cpGo', { n }))}</button>${n ? '' : `<span class="muted small">${esc(W.cpPickOne)}</span>`}<button type="button" class="btn ghost" data-act="dpCopyCancel">${esc(W.dpNotNow)}</button></div></div>`;
  return h;
}
// ── 畫面⑤：照學校說的方式交、其他資料（打勾「準備好了」；選繳多一顆「這一項我不交」）──
function dpSchoolHtml(d, off) {
  const W = dpW(), items = (d.school && d.school.items) || [];
  const sec = (forms, zname, intro) => {
    const xs = items.filter((x) => forms.includes(x.form)); if (!xs.length) return '';
    const total = xs.filter((x) => x.state !== 'skip').length, ready = xs.filter((x) => x.state === 'ready').length;
    return `<div class="card"><h3>${esc(zname)}${total && ready === total ? ` <span class="pill ok">${esc(W.scAllDone)}</span>` : ''}</h3>${intro ? `<p class="muted small" style="margin:0 0 6px">${esc(intro)}</p>` : ''}
      <ul class="plain">${xs.map((x) => {
        const name = x.code > 'Q' ? x.code + ' ' + (x.name || '') : NG.offName(off, x.code), hint = W[DP_HINT[x.form]] || '';
        if (x.state === 'skip') return `<li class="drow faded"><span><b>${esc(name)}</b> <span class="pill">${esc(W.optShort)}</span><div class="muted small">${esc(W.scSkipped)}</div></span>
          <button type="button" class="btn sm ghost" data-act="dpUnskip" data-code="${esc(x.code)}">${esc(W.scUndo)}</button></li>`;
        return `<li class="drow"><span><b>${esc(name)}</b>${x.optional ? ` <span class="pill">${esc(W.optShort)}</span>` : ''}<div class="muted small">${esc(hint)}</div>
            ${x.state === 'ready' ? `<div class="muted small">${esc(dpF('scDoneAt', { d: dpDate(x.doneAt) }))}</div>` : ''}</span>
          <label class="ck"><input type="checkbox" data-in="dpCheck" data-code="${esc(x.code)}"${x.state === 'ready' ? ' checked' : ''}> ${esc(W.scReady)}</label>
          ${x.optional && x.state !== 'ready' ? `<button type="button" class="btn sm ghost" data-act="dpSkip" data-code="${esc(x.code)}">${esc(W.scSkip)}</button>` : ''}</li>`;
      }).join('')}</ul></div>`;
  };
  return sec(DP_SCHOOL, W.zSchool, W.scIntro) + sec(DP_OTHER, W.zOther, DP_SCHOOL.some((f) => items.some((x) => x.form === f)) ? '' : W.scIntro);
}

// ── 動作 ──
const dpGroupOf = (g) => ((DP.r.dept.pick || []).find((p) => p.group === g) || {});
const dpPickedIds = (g) => (DP.r.files || []).filter((f) => f.group === g && f.picked).sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99)).map((f) => f.id);
// 2026-11-21：連續快速按（勾、拿掉、上下移）時，每一下送的是「整份清單」；兩筆同時在路上，伺服端可能照相反的順序處理，舊的那一份蓋掉新的
//   （走查實測：連勾三件，伺服端只剩兩件）。所以存檔一律排隊、一筆存完才送下一筆；還有存檔在路上時不重讀（dpReload 會跳過），最後一筆存完才讀回伺服端那一份。
DP.chain = Promise.resolve(); DP.pending = 0;
function dpSave(group, ids, failId) {
  (DP.r.files || []).forEach((f) => { if (f.group !== group) return; const i = ids.indexOf(f.id); f.picked = i >= 0; f.sortOrder = i >= 0 ? i + 1 : null; });   // 先在畫面上改（按一下就存）
  const gp = dpGroupOf(group); gp.picked = ids.length; dpDraw();
  DP.pending++;
  const run = async () => {
    const res = await call('set_dept_picks', { p_dept_code: DP.code, p_group: group, p_file_ids: ids }, { quiet: true }).catch(() => null);
    DP.pending--;
    if (res && res.ok) { if (DP.pending === 0) { await dpReload(); dpFlashSaved(); } return true; }
    // 沒存到：退回伺服端那一份（強制重讀）並出共用句；伺服端擋下上限（例如兩個分頁同時開）用同一句紅框
    if (res && res.error === 'OVER_LIMIT' && failId) DP.msg[failId] = dpF('dpOver', { group, limit: res.limit });
    else toast(dpW().st3SaveFail, true);
    await dpReload(true); return false;
  };
  const p = DP.chain.then(run, run); DP.chain = p.catch(() => null); return p;
}
ACT.dpPick = async (el) => {
  const id = el.dataset.id, g = el.dataset.group, gp = dpGroupOf(g), cur = dpPickedIds(g); DP.msg = {};
  if (gp.limit != null && cur.length >= gp.limit) { DP.msg[id] = dpF('dpOver', { group: g, limit: gp.limit }); dpDraw(); return; }   // 畫面先擋（不必等網路）
  await dpSave(g, cur.concat([id]), id);
};
ACT.dpRemove = async (el) => { DP.msg = {}; const g = el.dataset.group; await dpSave(g, dpPickedIds(g).filter((x) => x !== el.dataset.id)); };
const dpMove = async (el, dir) => {
  DP.msg = {}; const g = el.dataset.group, ids = dpPickedIds(g), i = ids.indexOf(el.dataset.id), j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]]; await dpSave(g, ids);
};
ACT.dpUp = (el) => dpMove(el, -1);
ACT.dpDown = (el) => dpMove(el, 1);
ACT.dpAskOpen = () => { DP.msg = {}; DP.askOpen = true; dpDraw(); const t = $('dp-ask-note'); if (t) t.focus(); };
ACT.dpAskCancel = () => { DP.askOpen = false; dpDraw(); };
ACT.dpAskSend = async (el) => {
  el.disabled = true; const note = (($('dp-ask-note') || {}).value || '').trim();
  const res = await call('ask_pick_review', { p_dept_code: DP.code, p_note: note || null }, { quiet: true }).catch(() => null);
  if (!res || !res.ok) { el.disabled = false; toast(dpW().st3SaveFail, true); return; }
  DP.askOpen = false; await dpReload(); dpFlashSaved();
};
ACT.dpAccept = async (el) => {
  el.disabled = true; DP.msg = {};
  const res = await call('accept_pick_advice', { p_dept_code: DP.code }, { quiet: true }).catch(() => null);
  if (res && res.ok) { toast(dpF('dpAccepted', { r: res.removed, a: res.added })); await dpReload(); return; }
  if (res && res.error === 'OVER_LIMIT') toast(dpF('dpOver', { group: res.group, limit: res.limit }), true); else toast(dpW().st3SaveFail, true);
  el.disabled = false;
};
ACT.dpKeep = () => { DP.hideReply = true; dpDraw(); };
ACT.dpCopyOpen = () => { DP.msg = {}; DP.copyOpen = true; DP.copySel = null; dpDraw(); };
ACT.dpCopyCancel = () => { DP.copyOpen = false; DP.copySel = null; dpDraw(); };
IN.dpCopySel = (el) => { if (!DP.copySel) DP.copySel = new Set(); if (el.checked) DP.copySel.add(el.value); else DP.copySel.delete(el.value); dpDraw(); };
ACT.dpCopyGo = async (el) => {
  const to = [...(DP.copySel || [])]; if (!to.length) return; el.disabled = true;
  const res = await call('copy_dept_picks', { p_from_dept: DP.code, p_to_depts: to }, { quiet: true }).catch(() => null);
  if (!res || !res.ok) { el.disabled = false; toast(dpW().st3SaveFail, true); return; }
  const bad = (res.results || []).filter((x) => !x.ok), good = (res.results || []).filter((x) => x.ok);
  const nameOf = (c) => { const x = (DP.r.otherDepts || []).find((o) => o.deptCode === c); return x ? (x.schoolName || '') + (x.name || '') : c; };
  if (bad.length) toast(dpF('cpPartial', { name: bad.map((x) => nameOf(x.deptCode)).join('、'), n: good.length }), true);
  else toast(dpF('cpDone', { n: good.length, name: DP.r.dept.name || '' }));
  DP.copyOpen = false; DP.copySel = null; await dpReload();
};
async function dpCheck(code, state, el) {
  const res = await call('set_dept_item_check', { p_dept_code: DP.code, p_code: code, p_state: state }, { quiet: true }).catch(() => null);
  if (res && res.ok) { await dpReload(); dpFlashSaved(); return; }
  if (el && el.type === 'checkbox') el.checked = !el.checked;   // 沒存到：勾退回原狀
  toast(dpW().st3SaveFail, true);
}
IN.dpCheck = (el) => dpCheck(el.dataset.code, el.checked ? 'ready' : null, el);
ACT.dpSkip = (el) => dpCheck(el.dataset.code, 'skip');
ACT.dpUnskip = (el) => dpCheck(el.dataset.code, null);
