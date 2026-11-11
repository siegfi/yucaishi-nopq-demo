/* 來源 luodian-analysis/xuece.html 第 324–518 行，2026-11-02 複製；落點通改版要同步。
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

/* 第一階段是否通過 */
function passesStage1(scores, listenGrade, dept) {
  var thresh = dept.thresholds;
  for (var key in thresh) {
    if (!thresh.hasOwnProperty(key)) continue;
    var reqIdx = LEVEL_IDX[thresh[key]];
    if (reqIdx === undefined) continue;
    if (scores[key] === undefined) return false;
    if (getStudentLevel(key, scores[key]) < reqIdx) return false;
  }
  if (dept.listen && listenGrade) {
    if ((LISTEN_RANK[listenGrade] || 0) < (LISTEN_RANK[dept.listen] || 0)) return false;
  }
  return true;
}

/* 穩/衝/夢 */
function classify(scores, dept) {
  var thresh = dept.thresholds;
  var minMargin = Infinity;
  for (var key in thresh) {
    if (!thresh.hasOwnProperty(key)) continue;
    var reqIdx = LEVEL_IDX[thresh[key]];
    var stuIdx = getStudentLevel(key, scores[key]);
    var margin = stuIdx - reqIdx;
    if (margin < minMargin) minMargin = margin;
  }
  var m = dept.minMult;
  if (minMargin === Infinity) return { code:'reach', label:'衝' };
  if (minMargin >= 2 && (m === null || m >= 5))   return { code:'safe',  label:'穩' };
  if (minMargin >= 1 && (m === null || m >= 2.5)) return { code:'reach', label:'衝' };
  if (minMargin >= 0 && m === null)               return { code:'reach', label:'衝' };
  return { code:'dream', label:'夢' };
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
//  ⚠ 需 CAAC_HISTORY 有資料才輸出精算；無則回 null（退化為 band classify）
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
/* 跨年等值換算：fromY 級分 → toY 等值級分 */
function convertScore(subj, score, fromY, toY){
  var p = scoreToPosition(subj, score, fromY);
  return (p===null) ? null : positionToScore(subj, p, toY);
}
/* 取該系歷年資料（無則 null）*/
function getHistory(dept){
  return (typeof CAAC_HISTORY!=='undefined' && CAAC_HISTORY[dept.id]) || null;
}
/* 跨年精算落點：用 history 把學生 115 分換成基準年等值分，比對通過標準 */
function predictCrossYear(scores, dept){
  var h = getHistory(dept); if(!h) return null;
  var basisYear = null;
  ['114','113','112','111'].forEach(function(y){ if(!basisYear && h[y]) basisYear=y; });
  if(!basisYear) return null;
  var hy = h[basisYear];
  var counted = dept.counted || [];
  var equiv = {}, equivTotal = 0;
  for(var i=0;i<counted.length;i++){
    var k = counted[i];
    if(scores[k]===undefined) continue;
    var e = convertScore(k, scores[k], '115', basisYear);
    if(e===null) continue;
    equiv[k] = Math.round(e*10)/10;
    equivTotal += e * ((dept.mults && dept.mults[k]) || 1);
  }
  // 歷年檔（caac_history）自然科鍵是 nat、115 科系檔是 sci：補別名，passStandard／passCombo 才對得上（2026-11-07 修：之前自然科整科被跳過）
  if(equiv.sci!==undefined && equiv.nat===undefined) equiv.nat = equiv.sci;
  equivTotal = Math.round(equivTotal*10)/10;
  var verdict=null, margin=null, comboOverride=false;
  var passStd = hy.passStandard || null, passTot = (hy.passTotal!==undefined?hy.passTotal:null);
  var passCombo = hy.passCombo || null;
  if(passStd){
    var minM = Infinity;
    for(var k2 in passStd){ if(equiv[k2]!==undefined){ var m=equiv[k2]-passStd[k2]; if(m<minM) minM=m; } }
    if(minM!==Infinity){ margin=Math.round(minM*10)/10; verdict = minM>=1.5?'safe':(minM>=0?'reach':'dream'); }
  } else if(passTot!==null){
    margin = Math.round((equivTotal-passTot)*10)/10;
    verdict = margin>=3?'safe':(margin>=0?'reach':'dream');
  }
  var passStdVerdict = verdict;
  // passCombo check：合科加總閾值（如 英文+數A ≥ 26），疊加在 passStd 之上
  if(passCombo && passCombo.length > 0){
    var comboBestMargin = Infinity, comboFail = false;
    for(var ci=0;ci<passCombo.length;ci++){
      var combo = passCombo[ci], comboSum=0, hasAll=true;
      for(var si=0;si<combo.subjects.length;si++){
        var sk=combo.subjects[si];
        if(equiv[sk]!==undefined) comboSum+=equiv[sk]; else hasAll=false;
      }
      if(!hasAll) continue;
      var cm = comboSum - combo.threshold;
      if(cm < comboBestMargin) comboBestMargin = cm;
      if(cm < 0) comboFail = true;
    }
    if(comboBestMargin !== Infinity){
      if(comboFail){
        // 若 passStd 原本非夢，combo 拉低才算真正 override
        comboOverride = (passStdVerdict !== null && passStdVerdict !== 'dream');
        margin = Math.round(comboBestMargin*10)/10;
        verdict = 'dream';
      } else if(!passStd && passTot===null){
        // 只有 combo 無 passStd，全過則給衝/穩
        margin = Math.round(comboBestMargin*10)/10;
        verdict = comboBestMargin>=3?'safe':'reach';
      }
    }
  }
  return { basisYear:basisYear, equiv:equiv, equivTotal:equivTotal,
           passStandard:passStd, passTotal:passTot, passCombo:passCombo,
           verdict:verdict, margin:margin, comboOverride:comboOverride, hy:hy };
}

// ── State ──
var DEPT_BY_ID = {};   // id → dept（detail 懶載入用）
