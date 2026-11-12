/* 來源 luodian-analysis/xuece.html 第 339–642 行，2026-11-12 複製；落點通改版要同步。
 * 這是原文複製（只加這個檔頭），不要在這裡改引擎；要改請改 xuece.html，再重新複製這一段。
 * 載入順序：wubiao_multi_year.js、caac_history.js、caac_115_full.js 載入之後才能載入本檔。 */
function buildWubiao115() {
  var map = { chi:'chi', eng:'eng', math_a:'math_a', math_b:'math_b', soc:'soc', sci:'nat' };
  var wb = {};
  for (var k in map) {
    var arr = WUBIAO_YEARS[map[k]]['115']; // [頂,前,均,後,底]
    wb[k] = { 頂:arr[0], 前:arr[1], 均:arr[2], 後:arr[3], 底:arr[4] };
  }
  return wb;
}
var WUBIAO = buildWubiao115();

var LEVEL_IDX   = { 底:0, 後:1, 均:2, 前:3, 頂:4 };
var LISTEN_RANK = { A:4, B:3, C:2, F:1 };
var SUBJ_LABEL  = { chi:'國文', eng:'英文', math_a:'數學A', math_b:'數學B', soc:'社會', sci:'自然' };
var SUBJ_SHORT  = { chi:'國', eng:'英', math_a:'數A', math_b:'數B', soc:'社', sci:'自' };
var LEVEL_CSS   = { 頂:'wu-ding', 前:'wu-qian', 均:'wu-jun', 後:'wu-hou', 底:'wu-di' };
var LEVEL_NAME  = { 頂:'頂標', 前:'前標', 均:'均標', 後:'後標', 底:'底標' };
var ALL_SUBJ    = ['chi','eng','math_a','math_b','soc','sci'];
var COL_SUBJ    = ['chi','eng','math_a','math_b','soc','sci'];
var REGION_ORDER= ['北','中','南','東','離島'];
var REGION_NAME = { '北':'北部','中':'中部','南':'南部','東':'東部','離島':'離島' };
var LD1_YEAR = 115; // 116 資料上線時改 116
var LD1_CHANNEL = 'U';
/* 落點基準（2026-11-12 依 luodian-analysis/OUTPUTS/07_落點引擎改法設計_v0.2.md 改）
   BASIS_YEAR：拿哪一年的第一階段實際通過分數來比；只用這一年，不往回找（這一年沒有通過分數的系不拿更早的年份頂）。
   INPUT_YEAR：學生輸入的級分屬於哪一年的尺度。116 學測五標公布前＝115（與基準年相同，不做跨年換算）。 */
var BASIS_YEAR = '115';
var INPUT_YEAR = '115';
/* 五級落點（07 v0.2 §三③ 刻度 A）：依「比基準年通過分數差幾級分」切；0 級收到「不建議填」區 */
var GRADE_NAME = ['差太遠', '夢', '衝', '壓線', '偏穩', '穩'];
/* 每系只給一個狀態（07 v0.2 §八 05），優先序照陣列順序 */
var STATUS_ORDER = ['fail', 'missing', 'mathRule', 'dataFlag', 'changed', 'nodata', 'checkOnly', 'ok'];
var STATUS_TEXT = { fail:'檢定或英聽未達', missing:'沒考這個系要看的科目', mathRule:'資格規則待確認', dataFlag:'資料待校',
                    changed:'今年標準有變', nodata:'沒有去年資料', checkOnly:'過檢定就進二階', ok:'' };
/* 檢定同時列數A、數B 的系：兩科都要（'both'）或擇一（'either'）。等對過簡章再逐系填；沒填的＝待確認（unknown） */
var MATH_RULE = {};
/* 基準年通過分數待對原圖的系（07 v0.2 §三① 第 3 項）：對完之前標「資料待校」，不給落點 */
var DATA_SUSPECT = {};

/* 學生五標 level：4=頂 3=前 2=均 1=後 0=底 -1=未達底 */
function getStudentLevel(key, score) {
  var wb = WUBIAO[key];
  if (score >= wb['頂']) return 4;
  if (score >= wb['前']) return 3;
  if (score >= wb['均']) return 2;
  if (score >= wb['後']) return 1;
  if (score >= wb['底']) return 0;
  return -1;
}
function levelToBand(lvl) {
  return ['底','後','均','前','頂'][lvl] || '—';
}

/* 這個系要看的科目：採計、檢定、篩選倍率、相加項，加上基準年通過分數用到的科目（歷年檔自然科鍵 nat → sci） */
function deptSubjects(dept) {
  var seen = {}, out = [];
  var add = function(k){ if (k === 'nat') k = 'sci'; if (SUBJ_LABEL[k] && !seen[k]) { seen[k] = 1; out.push(k); } };
  (dept.counted || []).forEach(add);
  Object.keys(dept.thresholds || {}).forEach(add);
  Object.keys(dept.mults || {}).forEach(add);
  if (dept.combined) (dept.combined.subjs || []).forEach(add);
  var h = getHistory(dept), hy = h && h[BASIS_YEAR];
  if (hy) {
    Object.keys(hy.passStandard || {}).forEach(add);
    (hy.passCombo || []).forEach(function(c){ (c.subjects || []).forEach(add); });
  }
  return out;
}
/* 檢定同時列數A、數B 的系回傳 'both'／'either'／'unknown'；其他系回傳 null */
function mathRuleOf(dept) {
  var t = dept.thresholds || {};
  if (!(t.math_a && t.math_b)) return null;
  return MATH_RULE[dept.id] || 'unknown';
}
/* 第一階段資格（2026-11-12 改，07 v0.2 §三⑥、§八 03）
   status：'fail' 檢定或英聽未達｜'missing' 沒考要看的科目｜'mathRule' 數A／數B 規則待確認｜'ok'
   failed：未達的科目（英聽記 'listen'）；missing：沒考的科目。 */
function stage1Check(scores, listenGrade, dept) {
  var thresh = dept.thresholds || {}, failed = [], missing = [], ambiguous = false;
  var rule = mathRuleOf(dept), pairLoose = (rule === 'either' || rule === 'unknown');
  var met = function(k){ return scores[k] !== undefined && getStudentLevel(k, scores[k]) >= LEVEL_IDX[thresh[k]]; };
  for (var key in thresh) {
    if (!thresh.hasOwnProperty(key)) continue;
    if (LEVEL_IDX[thresh[key]] === undefined) continue;
    if (pairLoose && (key === 'math_a' || key === 'math_b')) continue;
    if (scores[key] === undefined) { missing.push(key); continue; }
    if (!met(key)) failed.push(key);
  }
  if (pairLoose) {
    var okA = met('math_a'), okB = met('math_b');
    if (!okA && !okB) {
      if (scores.math_a === undefined && scores.math_b === undefined) { missing.push('math_a'); missing.push('math_b'); }
      else { if (scores.math_a !== undefined) failed.push('math_a'); if (scores.math_b !== undefined) failed.push('math_b'); }
    } else if (!(okA && okB) && rule === 'unknown') {
      ambiguous = true;   // 只過其中一科：擇一就過、兩科都要就不過
    }
  }
  if (dept.listen && listenGrade) {
    if ((LISTEN_RANK[listenGrade] || 0) < (LISTEN_RANK[dept.listen] || 0)) failed.push('listen');
  }
  var subs = deptSubjects(dept);
  for (var i = 0; i < subs.length; i++) {
    var k = subs[i];
    if (pairLoose && (k === 'math_a' || k === 'math_b')) continue;
    if (scores[k] === undefined && missing.indexOf(k) < 0) missing.push(k);
  }
  var status = failed.length ? 'fail' : (missing.length ? 'missing' : (ambiguous ? 'mathRule' : 'ok'));
  return { status: status, failed: failed, missing: missing };
}
/* 舊介面（NOPQ通也在用）：true＝檢定、英聽都過，要看的科目都有考，數A／數B 規則沒有疑義 */
function passesStage1(scores, listenGrade, dept) {
  return stage1Check(scores, listenGrade, dept).status === 'ok';
}

/* 一階只看檢定、不篩人的系（沒有篩選倍率、也沒有相加項） */
function isCheckOnly(dept) {
  return !dept.minMult && !dept.combined && !Object.keys(dept.mults || {}).length;
}
/* 沒有基準年通過分數的系不估落點（2026-11-12 依 07 v0.2 §三④ 改）。
   舊判法（比檢定高幾級＋倍率）沒有實際通過資料撐著，滿分也會判夢，已停用；函式留給舊介面，一律回 code:'na'。 */
function classify(scores, dept) {
  return { code:'na', label: isCheckOnly(dept) ? STATUS_TEXT.checkOnly : STATUS_TEXT.nodata };
}

/* 加權總分 Σ(級分×倍率) */
function computeWeighted(scores, dept) {
  var counted = dept.counted || Object.keys(dept.thresholds);
  var mults = dept.mults || {};
  var total = 0, allPresent = true;
  for (var i = 0; i < counted.length; i++) {
    var key = counted[i];
    if (scores[key] === undefined) { allPresent = false; continue; }
    total += scores[key] * (mults[key] || 1);
  }
  if (total === 0) return '—';
  return total.toFixed(1) + (allPresent ? '' : '*');
}

function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// ================================================================
//  跨年對標引擎（ARCHITECTURE.md §0/§3）
//  五標為相對位置 → 級分↔位置↔他年級分 線性內插換算
//  ⚠ 需 CAAC_HISTORY 有基準年資料才輸出落點；無則回 null（2026-11-12 起不再退回五標判法）
// ================================================================
function wbArr(subj, year){
  var key = (subj === 'sci') ? 'nat' : subj;   // 自然：五標表用 nat
  return (typeof WUBIAO_YEARS!=='undefined' && WUBIAO_YEARS[key] && WUBIAO_YEARS[key][year]) || null;
}
/* 級分 → 相對位置（0=底標 … 4=頂標，五標間線性內插，超界外推）*/
function scoreToPosition(subj, score, year){
  var a = wbArr(subj, year); if(!a) return null;     // a=[頂,前,均,後,底]
  var an = [[a[0],4],[a[1],3],[a[2],2],[a[3],1],[a[4],0]];
  if(score >= a[0]){ var s1=(a[0]-a[1])||1; return 4+(score-a[0])/s1; }
  if(score <= a[4]){ var s2=(a[3]-a[4])||1; return Math.max(0,(score-a[4])/s2); }
  for(var i=0;i<an.length-1;i++){
    var hi=an[i], lo=an[i+1];
    if(score<=hi[0] && score>=lo[0]){ var d=(hi[0]-lo[0])||1; return lo[1]+(score-lo[0])/d*(hi[1]-lo[1]); }
  }
  return null;
}
/* 相對位置 → 該年等值級分 */
function positionToScore(subj, pos, year){
  var a = wbArr(subj, year); if(!a) return null;
  var an = [[4,a[0]],[3,a[1]],[2,a[2]],[1,a[3]],[0,a[4]]];
  if(pos >= 4){ var s1=(a[0]-a[1])||1; return a[0]+(pos-4)*s1; }
  if(pos <= 0){ return a[4]; }
  for(var i=0;i<an.length-1;i++){
    var hi=an[i], lo=an[i+1];
    if(pos<=hi[0] && pos>=lo[0]){ var d=(hi[0]-lo[0])||1; return lo[1]+(pos-lo[0])/d*(hi[1]-lo[1]); }
  }
  return null;
}
/* 跨年等值換算：fromY 級分 → toY 等值級分
   2026-11-12（07 v0.2 §三⑤ 第一步）：滿級分換到哪一年都是滿級分；同一年不換；結果夾在 0–15 */
function convertScore(subj, score, fromY, toY){
  if(score >= 15) return 15;
  if(String(fromY) === String(toY)) return score;
  var p = scoreToPosition(subj, score, fromY);
  if(p===null) return null;
  var e = positionToScore(subj, p, toY);
  return (e===null) ? null : Math.max(0, Math.min(15, e));
}
/* 取該系歷年資料（無則 null）*/
function getHistory(dept){
  return (typeof CAAC_HISTORY!=='undefined' && CAAC_HISTORY[dept.id]) || null;
}
/* 落點（2026-11-12 依 07 v0.2 改）：學生級分（INPUT_YEAR 尺度）換成基準年等值分，比基準年第一階段實際通過分數。
   每個條件各自算級：單科取最差一科、加權總分、每一組合科；由 gradeOf 取最低一級（唯一合成處）。
   通過分數不合理的條件（單科不在 1–15、合科門檻高於科目數×15）略過並標 dataFlag。
   要看的科目全部 15 級分 → 保底給穩（資格、缺考、數A／數B 由 stage1Check 先擋；dataFlag 不保底）。
   舊欄位 verdict／margin／basisYear／equiv／passStandard／passTotal／passCombo／comboOverride／hy 意義不變（verdict 改由五級導出）。 */
function predictCrossYear(scores, dept){
  var h = getHistory(dept); if(!h) return null;
  var basisYear = h[BASIS_YEAR] ? BASIS_YEAR : null;
  if(!basisYear) return null;
  var hy = h[basisYear];
  var counted = dept.counted || [], subs = deptSubjects(dept);
  var equiv = {}, rawEq = {}, equivTotal = 0;
  for(var i=0;i<subs.length;i++){
    var k = subs[i];
    if(scores[k]===undefined) continue;
    var e = convertScore(k, scores[k], INPUT_YEAR, basisYear);
    if(e===null) continue;
    rawEq[k] = e;
    equiv[k] = Math.round(e*10)/10;
  }
  for(var ci0=0;ci0<counted.length;ci0++){
    var kc = counted[ci0];
    if(rawEq[kc]!==undefined) equivTotal += rawEq[kc] * ((dept.mults && dept.mults[kc]) || 1);
  }
  // 歷年檔（caac_history）自然科鍵是 nat、科系檔是 sci：補別名，passStandard／passCombo 才對得上（2026-11-07 修）
  if(equiv.sci!==undefined && equiv.nat===undefined) equiv.nat = equiv.sci;
  equivTotal = Math.round(equivTotal*10)/10;
  var r1 = function(x){ return Math.round(x*10)/10; };
  var passStd = hy.passStandard || null, passTot = (hy.passTotal!==undefined?hy.passTotal:null);
  var passCombo = hy.passCombo || null;
  var parts = [], dataFlag = false, stdMargin = null, comboMargin = null, totalMargin = null;
  if(passStd){
    var minM = Infinity;
    for(var k2 in passStd){
      var pv = passStd[k2];
      if(!(pv >= 1 && pv <= 15)){ dataFlag = true; continue; }
      if(equiv[k2]!==undefined){ var m = equiv[k2]-pv; if(m<minM) minM=m; }
    }
    if(minM!==Infinity){ stdMargin = r1(minM); parts.push({ kind:'std', margin:stdMargin }); }
  }
  if(passTot!==null){
    totalMargin = r1(equivTotal-passTot);
    parts.push({ kind:'total', margin:totalMargin });
  }
  if(passCombo && passCombo.length > 0){
    for(var ci=0;ci<passCombo.length;ci++){
      var combo = passCombo[ci], n = (combo.subjects || []).length, comboSum = 0, hasAll = true;
      if(!(n > 0 && combo.threshold > 0 && combo.threshold <= 15*n)){ dataFlag = true; continue; }
      for(var si=0;si<n;si++){
        var sk = combo.subjects[si];
        if(equiv[sk]!==undefined) comboSum += equiv[sk]; else hasAll = false;
      }
      if(!hasAll) continue;
      var cm = r1(comboSum - combo.threshold);
      if(comboMargin===null || cm < comboMargin) comboMargin = cm;
      parts.push({ kind:'combo', margin:cm, subjects:combo.subjects, threshold:combo.threshold });
    }
  }
  var all15 = subs.length > 0;
  for(var fi=0;fi<subs.length;fi++){ if(scores[subs[fi]] !== 15){ all15 = false; break; } }
  var pred = { basisYear:basisYear, inputYear:INPUT_YEAR, equiv:equiv, equivTotal:equivTotal,
               passStandard:passStd, passTotal:passTot, passCombo:passCombo,
               parts:parts, stdMargin:stdMargin, comboMargin:comboMargin, totalMargin:totalMargin,
               dataFlag:dataFlag, floor:false, level:null, verdict:null, margin:null, comboOverride:false, hy:hy };
  var g = gradeOf(pred);
  if(g){
    pred.level = g.level; pred.margin = g.margin;
    if(all15 && !dataFlag && pred.level < 5){ pred.level = 5; pred.floor = true; }
    pred.verdict = verdictOfLevel(pred.level);
    pred.comboOverride = (comboMargin!==null && comboMargin < 0 && stdMargin!==null && stdMargin >= 0);
  }
  return pred;
}
/* 差距 → 級（07 v0.2 §三③ 表）。kind 'std'＝單科最差一科；'combo'／'total'＝合計差 */
function levelOfMargin(m, kind){
  if(m >= (kind === 'std' ? 2 : 3)) return 5;
  if(m >= 1)  return 4;
  if(m >= 0)  return 3;
  if(m >= -1) return 2;
  if(m >= -2) return 1;
  return 0;
}
/* 舊三級（NOPQ通等舊程式讀 verdict）：5、4 級＝safe；3、2 級＝reach；1、0 級＝dream */
function verdictOfLevel(lv){ return lv >= 4 ? 'safe' : (lv >= 2 ? 'reach' : 'dream'); }
/* 五級合成（唯一一處，07 v0.2 §八 01）：各條件各自算級、取最低一級。pred.level 已定（含保底）時照用。
   回傳 level、name、verdict、margin（決定級別的那一項）、kind、lowMargin／highMargin（門檻上下 1 級分時的差距）、
   edge（壓線帶：差距 −1 以上、未滿 ＋1）、floor（全部 15 級分保底）。 */
function gradeOf(pred){
  if(!pred || !pred.parts || !pred.parts.length) return null;
  var best = null;
  for(var i=0;i<pred.parts.length;i++){
    var p = pred.parts[i], lv = levelOfMargin(p.margin, p.kind);
    if(!best || lv < best.level || (lv === best.level && p.margin < best.margin)) best = { level:lv, margin:p.margin, kind:p.kind };
  }
  var level = (pred.level!==null && pred.level!==undefined) ? pred.level : best.level;
  return { level:level, name:GRADE_NAME[level], verdict:verdictOfLevel(level), margin:best.margin, kind:best.kind,
           lowMargin:Math.round((best.margin-1)*10)/10, highMargin:Math.round((best.margin+1)*10)/10,
           edge:(!pred.floor && best.margin >= -1 && best.margin < 1), floor:!!pred.floor };
}
/* 每系一個狀態（07 v0.2 §八 05），畫面與批次比對都只讀這裡。
   回傳 status（STATUS_ORDER 其中之一）、failed、missing、pred、grade、level、name。 */
function assessDept(scores, listenGrade, dept){
  var s1 = stage1Check(scores, listenGrade, dept);
  var out = { status:s1.status, failed:s1.failed, missing:s1.missing, pred:null, grade:null, level:null, name:null };
  if(s1.status !== 'ok') return out;
  if(DATA_SUSPECT[dept.id]){ out.status = 'dataFlag'; return out; }
  var pred = predictCrossYear(scores, dept);
  out.pred = pred;
  if(pred && pred.dataFlag){ out.status = 'dataFlag'; return out; }
  if(dept.changed){ out.status = 'changed'; return out; }
  if(!pred || pred.level===null){ out.status = isCheckOnly(dept) ? 'checkOnly' : 'nodata'; return out; }
  out.grade = gradeOf(pred); out.level = out.grade.level; out.name = out.grade.name;
  return out;
}

// ── State ──
var DEPT_BY_ID = {};   // id → dept（detail 懶載入用）
