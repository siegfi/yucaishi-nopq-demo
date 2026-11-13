'use strict';
// 2026-11-12 楊老師試用回饋改版 階段 1（D6：兩版並排比）：兩段文字的差異，學生頁（write.js）與老師頁共用。純函式，不碰畫面。
// 做法：先一行一行比（最長共同子序列），改過的那幾行再逐字比；改過的一塊超過 1500 字就整塊當改過（逐字表太大會吃記憶體，同 11-08 W6b 的教訓）。
// TD.diffText(舊, 新) → {left:[{t:'='|'-', s}], right:[{t:'='|'+', s}], changed}：left 畫舊版（刪掉的標紅劃線），right 畫新版（加的標綠）。
(function (root) {
  function lcsOps(a, b) {
    const n = a.length, m = b.length;
    if (n * m > 4e6) return a.map((x) => ['-', x]).concat(b.map((y) => ['+', y]));
    const dp = []; for (let i = 0; i <= n; i++) dp.push(new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { out.push(['=', a[i]]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(['-', a[i]]); i++; } else { out.push(['+', b[j]]); j++; }
    }
    while (i < n) out.push(['-', a[i++]]); while (j < m) out.push(['+', b[j++]]);
    return out;
  }
  function push(arr, t, s) { if (!s) return; const last = arr[arr.length - 1]; if (last && last.t === t) last.s += s; else arr.push({ t, s }); }
  function diffText(oldText, newText) {
    const A = String(oldText == null ? '' : oldText).replace(/\r\n/g, '\n').split('\n'), B = String(newText == null ? '' : newText).replace(/\r\n/g, '\n').split('\n');
    const ops = lcsOps(A, B), left = [], right = []; let k = 0, changed = false;
    while (k < ops.length) {
      if (ops[k][0] === '=') { push(left, '=', ops[k][1] + '\n'); push(right, '=', ops[k][1] + '\n'); k++; continue; }
      const dels = [], adds = []; changed = true;
      while (k < ops.length && ops[k][0] !== '=') { (ops[k][0] === '-' ? dels : adds).push(ops[k][1]); k++; }
      const a = dels.join('\n'), b = adds.join('\n');
      if (!dels.length || !adds.length || a.length > 1500 || b.length > 1500) {
        if (dels.length) { push(left, '-', a); push(left, '=', '\n'); }
        if (adds.length) { push(right, '+', b); push(right, '=', '\n'); }
        continue;
      }
      lcsOps(Array.from(a), Array.from(b)).forEach(([t, c]) => { if (t !== '+') push(left, t, c); if (t !== '-') push(right, t, c); });
      push(left, '=', '\n'); push(right, '=', '\n');
    }
    const trim = (arr) => { const last = arr[arr.length - 1]; if (last && last.t === '=' && last.s.endsWith('\n')) { last.s = last.s.slice(0, -1); if (!last.s) arr.pop(); } return arr; };
    return { left: trim(left), right: trim(right), changed };
  }
  root.TD = { diffText };
})(typeof window !== 'undefined' ? window : globalThis);
