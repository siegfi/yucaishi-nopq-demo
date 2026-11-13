/* 落點分析（新作／歷史／評估）的純函式：不碰頁面、不連網、不呼叫落點引擎（引擎算好的 pred 由呼叫端傳進來）。
 * 2026-11-09 落點分析改版（設計稿 OUTPUTS/nopq_luodian_tab_design_v0.2.md §5.3、§6.2、§八）。
 * 瀏覽器載入成全域 AP；離線測試 profile-db/tests/test_assess_pure.mjs 用 vm 直接讀這個檔。 */
(function (root) {
'use strict';
var LP = { safe: '保底', reach: '正常', dream: '夢幻' };
var ORDER = ['chi', 'eng', 'math_a', 'math_b', 'soc', 'sci', 'nat'];
var SUBJ = { chi: '國', eng: '英', math_a: '數A', math_b: '數B', soc: '社', sci: '自', nat: '自' };
var YEARS = ['111', '112', '113', '114', '115'];
// owner 2026-11-09 原句（第 15 條）；與 score_new.js 的 GROUP_WARN 同一句，離線測試比對兩邊一致
var GROUP_WARN = '建議同學檢查既有的學習歷程。因為不同的學群所需要的學習歷程內容會完全不同，這樣子準備可能會有所不及。';

var r1 = function (x) { return Math.round(x * 10) / 10; };
var num = function (x) { var s = String(r1(x)); return s; };

// 一階範圍（2026-11-07 owner 裁定：±1 級分範圍＋壓線提示；字用保底／正常／夢幻，設計稿 B2）。
// 2026-11-12 落點引擎改版（luodian-analysis/OUTPUTS/07_落點引擎改法設計_v0.2.md §三③）：切點改跟引擎同一套——
// 差距→級照 luodian_core.js levelOfMargin（單科：≥2 五級、≥1 四級、≥0 三級、≥−1 二級、≥−2 一級；合科／加權總分的五級要 ≥3），
// 級→三格照 verdictOfLevel（5、4＝保底；3、2＝正常；1、0＝夢幻）。範圍＝門檻下修／上修 1 級分時各落哪一格。
// 這兩支是引擎的複本（本檔不呼叫引擎），test_assess_pure.mjs 逐點比對兩邊一致。
function levelOf(m, kind) {
  if (m >= (kind === 'std' ? 2 : 3)) return 5;
  if (m >= 1) return 4;
  if (m >= 0) return 3;
  if (m >= -1) return 2;
  if (m >= -2) return 1;
  return 0;
}
function verdictOf(lv) { return lv >= 4 ? 'safe' : (lv >= 2 ? 'reach' : 'dream'); }
// 決定級別的那一項（同引擎 gradeOf：各條件各自算級、取最低一級，同級取差距小的）；舊格式的 pred 沒有 parts 時看門檻型別
function decidingKind(pred) {
  var best = null;
  (pred.parts || []).forEach(function (p) {
    var lv = levelOf(p.margin, p.kind);
    if (!best || lv < best.lv || (lv === best.lv && p.margin < best.m)) best = { lv: lv, m: p.margin, kind: p.kind };
  });
  if (best) return best.kind;
  return (!pred.passStandard && pred.passTotal !== null && pred.passTotal !== undefined) ? 'total' : 'std';
}
function predRange(pred) {
  if (!pred || !pred.verdict || pred.margin === null || pred.margin === undefined) return null;
  var kind = decidingKind(pred), byTotal = kind !== 'std';
  var v = function (m) { return verdictOf(levelOf(m, kind)); };
  var lo, up;
  if (pred.floor) { lo = 'safe'; up = 'safe'; }   // 要看的科目全部 15 級分：引擎保底給五級，門檻不會比滿級分高
  else { lo = v(pred.margin - 1); up = v(pred.margin + 1); }   // 合科未達時 margin 就是合科差距（<0），下緣自然落夢幻，不另外強制
  return { lo: lo, up: up, edge: !pred.floor && pred.margin >= -1 && pred.margin < 1, byTotal: byTotal, kind: kind, hi: 1, floor: !!pred.floor,
    label: lo === up ? LP[lo] : LP[lo] + '～' + LP[up],
    lowMargin: r1(pred.margin - 1), highMargin: r1(pred.margin + 1) };
}

// 三級（只描述門檻距離，設計稿 §6.2 對照表；B2 預設用詞）。
// 實作細節：範圍「夢幻～正常」但等值分其實已達門檻（margin 0～0.5）時，歸「在門檻附近」而不是「還不到門檻」，免得句子和數字對不上。
var TIER = { high: '高出門檻不少', near: '在門檻附近', below: '還不到門檻', nodata: '資料不足' };
function tierOf(pred, range) {
  if (!range) return 'nodata';
  if (pred && pred.comboOverride) return 'below';
  if (pred && pred.margin < 0) return 'below';
  if (range.lo === 'safe') return 'high';
  return 'near';
}
// 不給範圍的原因（2026-11-12 引擎 assessDept 的狀態；文字同 luodian_core.js STATUS_TEXT）。一句學生看得懂的說明
var NORANGE = {
  nodata: { head: '沒有去年資料', line: '這系沒有去年的第一階段通過分數，不給範圍。' },
  checkOnly: { head: '過檢定就進二階', line: '這系第一階段只看檢定、不篩人：過了檢定就進第二階段，不用比分數。' },
  dataFlag: { head: '資料待校', line: '這系去年的通過分數還在核對，先不給範圍。' },
  changed: { head: '今年標準有變', line: '這系今年的第一階段標準跟去年不一樣，拿去年的分數比不準，先不給範圍。' },
  missing: { head: '沒考這個系要看的科目', line: '' },
  otherExam: { head: '要看 APCS 或術科', line: '這系第一階段要看 APCS 或術科成績，學測級分算不出來，不給範圍。' },
  mathRule: { head: '資格規則待確認', line: '這系檢定同時列數A、數B，你只過了其中一科；要兩科都過還是擇一，要等老師對過簡章才知道。' },
  fail: { head: '檢定或英聽未達', line: '這版成績沒過這系 115 年第一階段的檢定標準，要先補到檢定才有機會。' }
};
function tierLine(tier, pred, range, why) {
  var y = pred && pred.basisYear, m = pred ? pred.margin : null;
  if (tier === 'high' && range && range.floor) return '這系要看的科目你都是 15 級分（滿級分），門檻不會比這更高。';
  if (tier === 'high') return '你的等值分比 ' + y + ' 年門檻高出 ' + num(m) + ' 級分，就算門檻上跳 1 級分也還在。';
  if (tier === 'near') return '跟 ' + y + ' 年門檻差不多（' + (m >= 0 ? '高出 ' : '差 ') + num(Math.abs(m)) + ' 級分），門檻跳一下就會變。';
  if (tier === 'below') {
    if (pred && pred.comboOverride) return '合科加總還沒到 ' + y + ' 年的門檻，要門檻往下掉才有機會。';
    return y + ' 年門檻你還差 ' + num(Math.abs(m)) + ' 級分，要門檻往下掉才有機會。';
  }
  if (why && NORANGE[why] && NORANGE[why].line) return NORANGE[why].line;
  return '這個系沒有往年門檻資料，只看 115 年第一階段檢定，不給範圍。';
}
var EDGE_LINE = '剛好在邊上，今年可能過、也可能不過。';

// 等值分與門檻的一句話
function equivLine(pred) {
  if (!pred) return '';
  var y = pred.basisYear, eq = pred.equiv || {};
  if (pred.passStandard) {
    var ks = ORDER.filter(function (k) { return pred.passStandard[k] != null && eq[k] != null && !(k === 'sci' && pred.passStandard.nat != null); });
    if (!ks.length) return '';
    return '你的分數換算成 ' + y + ' 年等值：' + ks.map(function (k) { return SUBJ[k] + ' ' + num(eq[k]); }).join('、')
      + '；' + y + ' 年門檻 ' + ks.map(function (k) { return SUBJ[k] + ' ' + num(pred.passStandard[k]); }).join('、');
  }
  if (pred.passTotal != null) return '你的加權總分換算成 ' + y + ' 年等值 ' + num(pred.equivTotal) + '；' + y + ' 年門檻 ' + num(pred.passTotal);
  if (pred.passCombo && pred.passCombo.length) {
    return y + ' 年門檻是合科加總：' + pred.passCombo.map(function (c) { return c.subjects.map(function (k) { return SUBJ[k] || k; }).join('＋') + ' ' + num(c.threshold); }).join('、');
  }
  return '';
}

// 門檻走勢 111→115（只列基準年有門檻的科目；沒有那年資料寫「—」）
function trendLine(hist, pred) {
  if (!hist || !pred) return '';
  if (pred.passStandard) {
    var ks = ORDER.filter(function (k) { return pred.passStandard[k] != null && !(k === 'sci' && pred.passStandard.nat != null); }).slice(0, 3);
    if (!ks.length) return '';
    return '門檻走勢（111→115）：' + ks.map(function (k) {
      return SUBJ[k] + ' ' + YEARS.map(function (y) { var ps = hist[y] && hist[y].passStandard; return ps && ps[k] != null ? num(ps[k]) : '—'; }).join('／');
    }).join('；');
  }
  if (pred.passTotal != null) {
    return '門檻走勢（111→115，加權總分）：' + YEARS.map(function (y) { var t = hist[y] && hist[y].passTotal; return t != null ? num(t) : '—'; }).join('／');
  }
  return '';
}

// 二階比重（評估頁不用「%」，寫「滿分 100」）
function stage2Line(s2) {
  if (!s2) return '二階資料還沒有';
  var parts = [];
  if (s2.gsatPct != null) parts.push('學測 ' + s2.gsatPct);
  (s2.items || []).forEach(function (it) { if (it && it.name) parts.push(it.name + (it.pct != null ? ' ' + it.pct : '')); });
  return parts.length ? '二階比重（滿分 100）：' + parts.join('、') : '二階資料還沒有';
}

// 116 簡章事實（不參與評等）。has116＝示範庫有沒有匯 116；y116＝這個系的 116 列（沒有＝null）
function facts116Line(has116, y116) {
  if (!has116) return '116 資料未匯入';
  if (!y116) return '116 簡章查不到這個系代碼（可能改名或調整，請看甄選會公告）';
  var a = [];
  if (y116.quota != null) a.push('招 ' + y116.quota + ' 人');
  if (y116.expectedInterview != null) a.push('預計甄試 ' + y116.expectedInterview + ' 人');
  return '116 簡章：' + (a.length ? a.join('、') : '名額未列') + '（只是簡章上的數字，不代表把握度）';
}

// 一張系卡的全部文字（評估頁畫面與 AI 輸入共用）。d＝CAAC_DEPTS 一筆；cls＝classify() 結果（退回用）；hist＝CAAC_HISTORY[d.id]；
// s1＝這版成績的狀態：舊呼叫傳 true／false（過不過 115 第一階段檢定）；2026-11-12 起傳引擎 assessDept 的 {status, missing}
//    （fail／missing／mathRule＝第一階段過不了或待確認；nodata／checkOnly／dataFlag／changed＝不給範圍；ok＝照範圍）。
//    非 ok 一律不給範圍（不拿部分科目或待校的數字硬算）。
function deptCard(d, pred, cls, hist, has116, y116, s1) {
  var st = s1 === false ? 'fail' : (s1 && typeof s1 === 'object' && s1.status) || 'ok';
  var range = st === 'ok' ? predRange(pred) : null;
  if (st === 'ok' && !range && cls && cls.code === 'na' && cls.label === '過檢定就進二階') st = 'checkOnly';
  var tier = (st === 'fail' || st === 'missing') ? 'below' : tierOf(pred, range);
  var miss = st === 'missing' ? (s1.missing || []).map(function (k) { return SUBJ[k] || k; }).join('、') : '';
  var c = { deptId: d.id, school: d.school, dept: d.dept, group: d.group, tier: tier, tierName: TIER[tier], edge: !!(range && range.edge),
    range: range ? range.label : null, basisYear: range ? pred.basisYear : null, margin: range ? pred.margin : null, byTotal: !!(range && range.byTotal),
    fallback: range ? null : (cls && LP[cls.code] ? LP[cls.code] : null), status: st,
    noRange: range ? null : (NORANGE[st] ? NORANGE[st].head : null) };
  // 2026-11-12：引擎 assessDept 的 checkEdge＝級分剛好等於檢定那一標的科目（116 五標公布前用 115 五標估，五標一動就可能過不了）
  var ce = s1 && typeof s1 === 'object' && Array.isArray(s1.checkEdge) ? s1.checkEdge.map(function (k) { return SUBJ[k] || k; }) : [];
  // 2026-11-12 owner「評估卡加上英聽門檻提醒」：這系有英聽門檻就寫出來；學生沒填英聽時，引擎不檢查英聽（學生頁英聽選單寫明未填就忽略），要特別點出來。
  // s1.listen＝這版填的英聽級（'' 或 null＝沒填）；舊呼叫（s1 是 true／false）不知道學生填了什麼，只寫門檻。
  var lt = d && d.listen ? String(d.listen) : '', known = !!(s1 && typeof s1 === 'object' && 'listen' in s1), sl = known && s1.listen ? String(s1.listen) : '';
  c.listenNeed = lt || null; c.listenChecked = lt ? (known ? !!sl : null) : null;
  c.lines = {
    listen: lt ? '這系要英聽 ' + lt + ' 級' + (sl ? '（你填的是 ' + sl + ' 級）。' : known ? '。你還沒填英聽，這系的英聽門檻沒有檢查。' : '。') : '',
    checkEdge: ce.length ? '檢定壓線：' + ce.join('、') + ' 剛好等於這系的檢定標準；116 五標公布後標準的級分可能變，要再看一次。' : '',
    tier: st === 'missing' ? '這版成績沒有這系要看的' + (miss || '科目') + '，第一階段過不了。' : (st === 'fail' ? NORANGE.fail.line : tierLine(tier, pred, range, st)),
    edge: c.edge ? EDGE_LINE : '',
    equiv: range ? equivLine(pred) : '',
    trend: range ? trendLine(hist, pred) : '',
    stage2: stage2Line(d.stage2),
    facts116: facts116Line(has116, y116),
    basis: range ? '依據：' + pred.basisYear + ' 年門檻＋你的等值分；門檻每年約上下 1 級分，所以給範圍不給單一答案。'
      : (c.fallback ? '依據：115 年第一階段檢定標準與篩選倍率（判在「' + c.fallback + '」）；沒有往年門檻資料，不給範圍。'
        : '依據：115 年第一階段檢定標準' + (c.noRange ? '（' + c.noRange + '）' : '') + '；不給範圍。'),
    unknown: '不知道的：115 實際錄取了誰、正備取幾人（查榜還沒有名單）。',
  };
  if (has116 && y116) { c.quota116 = y116.quota != null ? y116.quota : null; c.interview116 = y116.expectedInterview != null ? y116.expectedInterview : null; }
  return c;
}

// 規則檢查：picks＝[{deptCode, rank, group, code}]；groupsSelected＝學群篩選選了幾個
function ruleSummary(picks, groupsSelected) {
  var mix = { dream: 0, reach: 0, safe: 0, none: 0 }, gs = {};
  (picks || []).forEach(function (p) { mix[p && LP[p.code] ? p.code : 'none']++; if (p && p.group) gs[p.group] = 1; });
  var gp = Object.keys(gs).length, sel = groupsSelected || 0;
  return { mix: mix, groupsPicked: gp, groupsSelected: sel, warnOver3: gp > 3 || sel > 3, mix222: mix.dream === 2 && mix.reach === 2 && mix.safe === 2 };
}
var dist222 = function (mix) { return Math.abs((mix.dream || 0) - 2) + Math.abs((mix.reach || 0) - 2) + Math.abs((mix.safe || 0) - 2) + (mix.none || 0); };

// 整版總評（固定句，規則產生）：學群超過 3 個時第一條固定是 owner 原句（設計稿 §八）
function overallLines(rules, scoreKind) {
  var m = (rules && rules.mix) || {}, out = [];
  if (rules && rules.warnOver3) out.push(GROUP_WARN);
  out.push('這版 夢幻 ' + (m.dream || 0) + '／正常 ' + (m.reach || 0) + '／保底 ' + (m.safe || 0) + (m.none ? '／現在成績不在清單 ' + m.none : '') + '（建議 2／2／2）' + (rules && rules.mix222 ? '，剛好平衡。' : '。'));
  out.push('勾的系橫跨 ' + ((rules && rules.groupsPicked) || 0) + ' 個學群（建議 2 個，不要超過 3 個）。');
  if (scoreKind === 'mock') out.push('這是模考成績，正式成績出來記得重排。');
  return out;
}

// 兩版比較（設計稿 §5.3）：成績逐科差、篩選差、系集合三區、2／2／2 比例、學群數
function setDiff(a, b) {
  var A = (a || []).map(String), B = (b || []).map(String);
  return { onlyA: A.filter(function (x) { return B.indexOf(x) < 0; }), onlyB: B.filter(function (x) { return A.indexOf(x) < 0; }) };
}
function compareVersions(a, b) {
  var sa = (a && a.scores) || {}, sb = (b && b.scores) || {};
  var scores = ORDER.filter(function (k) { return k !== 'nat' && (sa[k] != null || sb[k] != null) && sa[k] !== sb[k]; })
    .map(function (k) { return { k: k, name: SUBJ[k], a: sa[k] == null ? null : sa[k], b: sb[k] == null ? null : sb[k], diff: (sa[k] != null && sb[k] != null) ? sb[k] - sa[k] : null }; });
  var fa = (a && a.filters) || {}, fb = (b && b.filters) || {};
  var filters = { groups: setDiff(fa.groups, fb.groups), regions: setDiff(fa.regions, fb.regions), schools: setDiff(fa.schools, fb.schools),
    q: (fa.q || '') === (fb.q || '') ? null : { a: fa.q || '', b: fb.q || '' } };
  var pa = {}, pb = {};
  ((a && a.picks) || []).forEach(function (p) { pa[p.deptCode] = p; });
  ((b && b.picks) || []).forEach(function (p) { pb[p.deptCode] = p; });
  var depts = { onlyA: [], onlyB: [], changed: [], same: [] };
  Object.keys(pa).forEach(function (code) {
    if (!pb[code]) depts.onlyA.push(code);
    else if ((pa[code].code || null) !== (pb[code].code || null)) depts.changed.push({ deptCode: code, a: pa[code].code || null, b: pb[code].code || null });
    else depts.same.push(code);
  });
  Object.keys(pb).forEach(function (code) { if (!pa[code]) depts.onlyB.push(code); });
  var ra = (a && a.rules) || ruleSummary(a && a.picks, 0), rb = (b && b.rules) || ruleSummary(b && b.picks, 0);
  var da = dist222(ra.mix || {}), db = dist222(rb.mix || {});
  return { scores: scores, listen: (a && a.listen || '') === (b && b.listen || '') ? null : { a: (a && a.listen) || '', b: (b && b.listen) || '' },
    filters: filters, depts: depts,
    mix: { a: ra.mix, b: rb.mix, closer: da === db ? 'tie' : (da < db ? 'a' : 'b') },
    groups: { a: ra.groupsPicked || 0, b: rb.groupsPicked || 0 } };
}
// 多版裡哪一版最接近 2／2／2：回 index 陣列（並列就多個）
function closest222(rulesList) {
  var ds = (rulesList || []).map(function (r) { return dist222((r && r.mix) || {}); });
  if (!ds.length) return [];
  var min = Math.min.apply(null, ds), out = [];
  ds.forEach(function (d, i) { if (d === min) out.push(i); });
  return out;
}

// 肯定語氣掃描（設計稿 §6.3）：先拿掉白名單裡的免責句，再找禁字；回命中的禁字陣列
function scanAssertive(text, banned, allowed) {
  var t = String(text || '');
  (allowed || []).slice().sort(function (x, y) { return y.length - x.length; }).forEach(function (p) { if (p) t = t.split(p).join(''); });
  return (banned || []).filter(function (w) { return w && t.indexOf(w) >= 0; });
}

// 版本列表一行的成績摘要：「國 12、英 13、數A 11｜英聽 A」
function scoreBrief(scores, listen) {
  var s = scores || {};
  return ORDER.filter(function (k) { return k !== 'nat' && s[k] != null; }).map(function (k) { return SUBJ[k] + ' ' + s[k]; }).join('、') + (listen ? '｜英聽 ' + listen : '');
}

root.AP = { LP: LP, TIER: TIER, NORANGE: NORANGE, GROUP_WARN: GROUP_WARN, EDGE_LINE: EDGE_LINE, levelOf: levelOf, verdictOf: verdictOf, predRange: predRange, tierOf: tierOf, tierLine: tierLine, equivLine: equivLine,
  trendLine: trendLine, stage2Line: stage2Line, facts116Line: facts116Line, deptCard: deptCard, ruleSummary: ruleSummary, dist222: dist222,
  overallLines: overallLines, compareVersions: compareVersions, closest222: closest222, scanAssertive: scanAssertive, scoreBrief: scoreBrief };
})(typeof window !== 'undefined' ? window : globalThis);
