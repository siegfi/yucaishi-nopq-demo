'use strict';
// NOPQ通 瀏覽器版 Word 匯出（第 3 批；2026-11-24）。一般 script，掛 window.NX.docx；沒有外部套件、不連網。
// 四件事：①buildDocBytes 一篇稿的 Word ②buildDeptFiles 一系要交的兩份（N 一份；O、P、Q 合成一份；X 位置由呼叫端資料決定）
//        ③buildReviewBytes 批改版（追蹤修訂＋註解，照 profile-db/tools/local_platform/export_docx.mjs＋docx_tracked.mjs 移植，document.xml 逐字相同）④download 用 Blob 下載。
// 壓縮：CompressionStream('deflate-raw')；瀏覽器沒有（或 opts.noCompress）就存成不壓縮的 zip（method 0），Word 照樣打得開。
// 字型：中文標楷體、英數 Times New Roman；正文 12 號、標題 14 號；A4。預設不寫學生名字（opts.studentName 有給才寫）。
(function (root) {
  const E = new TextEncoder();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const nlen = (s) => String(s || '').replace(/\s/g, '').length;   // 字數＝去空白字元數（同 core.js nlen、資料庫 nopq_nonspace_len）
  const CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = (a) => { let c = -1; for (let i = 0; i < a.length; i++) c = T[(c ^ a[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  async function deflateRaw(u8) {   // 回壓縮後位元組；瀏覽器不支援或失敗回 null（呼叫端改存不壓縮）
    if (typeof CompressionStream === 'undefined') return null;
    try { const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); } catch (e) { return null; }
  }
  const cat = (arr) => { let n = 0; arr.forEach((a) => { n += a.length; }); const o = new Uint8Array(n); let p = 0; arr.forEach((a) => { o.set(a, p); p += a.length; }); return o; };
  const le = (bytes, n) => { const o = []; for (let i = 0; i < bytes; i++) o.push(Math.floor(n / Math.pow(2, 8 * i)) & 255); return Uint8Array.from(o); };
  const u16 = (n) => le(2, n), u32 = (n) => le(4, n);
  async function pack(entries, noCompress) {   // entries: [[檔名, 字串]]；回 Uint8Array（zip）
    let pos = 0; const L = [], C = [];
    for (const [name, val] of entries) {
      const nb = E.encode(name), raw = E.encode(val), z = noCompress ? null : await deflateRaw(raw), data = z || raw, method = z ? 8 : 0, r = crc(raw), o = pos;
      const lh = cat([u32(0x04034b50), u16(20), u16(0x800), u16(method), u32(0), u32(r), u32(data.length), u32(raw.length), u16(nb.length), u16(0), nb, data]);
      L.push(lh); pos += lh.length;
      C.push(cat([u32(0x02014b50), u16(20), u16(20), u16(0x800), u16(method), u32(0), u32(r), u32(data.length), u32(raw.length), u16(nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(o), nb]));
    }
    const cd = cat(C);
    return cat([...L, cd, u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cd.length), u32(pos), u16(0)]);
  }
  // ── 共用零件：樣式（字型字級）、內容型別、關聯 ──
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="' + NS + '"><w:docDefaults><w:rPrDefault><w:rPr>'
    + '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="標楷體"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US" w:eastAsia="zh-TW"/></w:rPr></w:rPrDefault>'
    + '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
    + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="60"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Meta"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style></w:styles>';
  const CTYPES = (withComments) => '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/word/document.xml" ContentType="' + CT + '.main+xml"/>' + (withComments ? '<Override PartName="/word/comments.xml" ContentType="' + CT.replace('.document', '') + '.comments+xml"/>' : '')
    + '<Override PartName="/word/styles.xml" ContentType="' + CT.replace('.document', '') + '.styles+xml"/></Types>';
  const RELS = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + R + '/officeDocument" Target="word/document.xml"/></Relationships>';
  const DOCRELS = (withComments) => '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + (withComments ? '<Relationship Id="rId1" Type="' + R + '/comments" Target="comments.xml"/>' : '')
    + '<Relationship Id="rId2" Type="' + R + '/styles" Target="styles.xml"/></Relationships>';
  const CORE = (title, author) => '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>' + esc(title) + '</dc:title><dc:creator>' + esc(author) + '</dc:creator></cp:coreProperties>';

  // ── ① 一篇稿 ──
  // doc: {title, deptName, text | sections:[{heading, text, photo}], studentName?, charCount?}
  //   deptName 空＝寫「全部志願共用」；photo＝true 或 {caption}：這一段後面放一個框「〔圖 n：圖說〕」，n 依出現順序 1、2、3…
  //   text 的每個換行＝一個段落（空行＝空段落）；sections 每段先寫標題（14 號粗體）再寫內文。
  const SHARED_DEPT = '全部志願共用';
  const run = (t) => '<w:r><w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>';
  const para = (t, style, extra) => '<w:p><w:pPr><w:pStyle w:val="' + (style || 'Normal') + '"/>' + (extra || '') + '</w:pPr>' + (t === '' ? '' : run(t)) + '</w:p>';
  const bodyLines = (text) => String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n').map((l) => para(l, 'Normal', l === '' ? '' : '<w:ind w:firstLineChars="200"/>')).join('');
  const BOX_B = ['top', 'left', 'bottom', 'right'].map((s) => '<w:' + s + ' w:val="single" w:sz="8" w:space="0" w:color="7F7F7F"/>').join('');
  const photoBox = (n, cap) => '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>' + BOX_B + '</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="9026"/></w:tblGrid><w:tr><w:trPr><w:trHeight w:val="2400" w:hRule="atLeast"/></w:trPr>'
    + '<w:tc><w:tcPr><w:tcW w:w="5000" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:pStyle w:val="Normal"/><w:jc w:val="center"/></w:pPr>' + run('〔圖 ' + n + '：' + (cap || '圖說') + '〕') + '</w:p></w:tc></w:tr></w:tbl>' + para('', 'Normal');
  const SECT = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';
  function docParts(doc) {   // 回 {xml, photos, chars}
    const secs = Array.isArray(doc.sections) ? doc.sections : [{ heading: '', text: doc.text }];
    let n = 0, chars = 0, body = '';
    secs.forEach((s) => {
      if (s.heading) { body += para(String(s.heading), 'Heading1'); }
      body += bodyLines(s.text); chars += nlen(s.text);
      if (s.photo) { n++; body += photoBox(n, s.photo && s.photo.caption); }
    });
    const count = doc.charCount != null ? doc.charCount : chars;
    // 2026-11-24 主線（替 owner 選的預設）：doc.showMeta＝false 時不放「學生／系名／字數」三行與分隔線——「這一系要交的」是學生直接上傳甄選會的檔，
    // 「全部志願共用」是系統內部說法、字數是給學生看的，不該印在交出去的檔裡（字數改顯示在畫面上，下載鈕旁）。單篇下載（學生自己留存）沒給就照放。
    const showMeta = doc.showMeta !== false;
    const meta = para(doc.title || '', 'Title') + (!showMeta ? '' : (doc.studentName ? para('學生：' + doc.studentName, 'Meta') : '')
      + para('系名：' + (doc.deptName || SHARED_DEPT), 'Meta') + para('字數：' + count, 'Meta')
      + '<w:p><w:pPr><w:pStyle w:val="Meta"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="7F7F7F"/></w:pBdr></w:pPr></w:p>');
    return { xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="' + NS + '"><w:body>' + meta + body + SECT + '</w:body></w:document>', photos: n, chars: count };
  }
  async function buildDocBytes(doc, opts) {
    opts = opts || {}; const p = docParts(doc);
    const bytes = await pack([['[Content_Types].xml', CTYPES(false)], ['_rels/.rels', RELS], ['word/document.xml', p.xml], ['word/styles.xml', STYLES], ['word/_rels/document.xml.rels', DOCRELS(false)], ['docProps/core.xml', CORE(doc.title, doc.studentName || '')]], opts.noCompress);
    bytes.photos = p.photos; bytes.chars = p.chars; return bytes;
  }
  // ── ③ 批改版：以下 diffChars／para／diffLong／tidyDiff／sectionParagraphs 逐字移自 local_platform（docx_tracked.mjs、export_docx.mjs），只去掉 export；改動前請先對本機版（測試會比 document.xml） ──
function diffChars(before,after){let a=Array.from(before??''),b=Array.from(after??''),m=a.length,n=b.length,d=Array.from({length:m+1},()=>new Uint32Array(n+1)),o=[],put=(type,text)=>{if(!text)return;let q=o.at(-1);q?.type===type?q.text+=text:o.push({type,text})};for(let i=m-1;i>=0;i--)for(let j=n-1;j>=0;j--)d[i][j]=a[i]===b[j]?d[i+1][j+1]+1:Math.max(d[i+1][j],d[i][j+1]);for(let i=0,j=0;i<m||j<n;)if(i<m&&j<n&&a[i]===b[j])put('eq',a[i++]),j++;else if(j<n&&(i===m||d[i][j+1]>=d[i+1][j]))put('ins',b[j++]);else put('del',a[i++]);return o}
function trackedPara(p,cs,s){let a=[];for(let z of p.segments||[])for(let ch of Array.from(z.text||''))a.push({type:z.type,text:ch});let fin=a.filter(q=>q.type!=='del').map(q=>q.text).join(''),old=a.filter(q=>q.type!=='ins').map(q=>q.text).join(''),st=new Map(),en=new Map(),empty=[];for(let c of cs){let allow=q=>q.type!=='del',at=fin.indexOf(c.quote);if(at<0){allow=q=>q.type!=='ins';at=old.indexOf(c.quote)}if(at<0){s.warnings.push(`第 ${c.para+1} 段找不到註解引文「${c.quote}」，已掛在段首。`);empty.push(c);continue}let k=0,A=-1,B=-1,len=Array.from(c.quote).length;for(let i=0;i<a.length;i++)if(allow(a[i])){if(k===at)A=i;if(k===at+len-1){B=i;break}k++}if(A<0||B<0)empty.push(c);else{st.has(A)?st.get(A).push(c):st.set(A,[c]);en.has(B)?en.get(B).push(c):en.set(B,[c])}}let mark=c=>`<w:commentRangeStart w:id="${c.id}"/><w:commentRangeEnd w:id="${c.id}"/><w:r><w:commentReference w:id="${c.id}"/></w:r>`,out=empty.map(mark).join('');for(let i=0;i<a.length;){let begin=i,ty=a[i].type,tx='',S=[],N=[];while(i<a.length&&a[i].type===ty){if(i>begin&&(st.has(i)||en.has(i-1)))break;if(st.has(i))S.push(...st.get(i));tx+=a[i].text;if(en.has(i))N.push(...en.get(i));i++}out+=S.map(c=>`<w:commentRangeStart w:id="${c.id}"/>`).join('');let txe=esc(tx);out+=ty==='del'?`<w:del w:id="${s.id++}" w:author="${esc(s.author)}" w:date="${esc(s.date)}"><w:r><w:delText xml:space="preserve">${txe}</w:delText></w:r></w:del>`:ty==='ins'?`<w:ins w:id="${s.id++}" w:author="${esc(s.author)}" w:date="${esc(s.date)}"><w:r><w:t xml:space="preserve">${txe}</w:t></w:r></w:ins>`:`<w:r><w:t xml:space="preserve">${txe}</w:t></w:r>`;out+=N.map(c=>`<w:commentRangeEnd w:id="${c.id}"/><w:r><w:commentReference w:id="${c.id}"/></w:r>`).join('')}return `<w:p><w:pPr><w:pStyle w:val="${p.heading?'Heading1':'Normal'}"/></w:pPr>${p.heading?`<w:r><w:t>${esc(p.heading)}</w:t></w:r>`:''}${out}</w:p>`}
const CHAR_DIFF_LIMIT = 2_000_000;   // 逐字差異的 LCS 表是 (前字數×後字數)；超過就先逐行比，只在不同的行塊裡逐字比

// 每行（含行尾換行，最後一行不含）當一個單位，先比行，再在連續不同的行塊裡逐字比
function diffLong(before, after) {
  const a = String(before ?? ''), b = String(after ?? '');
  if (a.length * b.length <= CHAR_DIFF_LIMIT) return diffChars(a, b);
  const lines = (s) => { const p = s.split('\n'); return p.map((x, i) => (i < p.length - 1 ? x + '\n' : x)).filter((x, i, arr) => x !== '' || i < arr.length - 1); };
  const A = lines(a), B = lines(b), m = A.length, n = B.length;
  const d = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) d[i][j] = A[i] === B[j] ? d[i + 1][j + 1] + 1 : Math.max(d[i + 1][j], d[i][j + 1]);
  const out = [], put = (type, text) => { if (!text) return; const q = out[out.length - 1]; if (q && q.type === type) q.text += text; else out.push({ type, text }); };
  let del = '', ins = '';
  const flush = () => {
    if (del && ins && del.length * ins.length <= CHAR_DIFF_LIMIT) diffChars(del, ins).forEach((z) => put(z.type, z.text));
    else { put('del', del); put('ins', ins); }
    del = ''; ins = '';
  };
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && A[i] === B[j]) { flush(); put('eq', A[i]); i++; j++; }
    else if (j < n && (i === m || d[i][j + 1] >= d[i + 1][j])) ins += B[j++];
    else del += A[i++];
  }
  flush();
  return out;
}

// 中文逐字比對會把一句改寫切成很多小修訂（例：「十次三次降到十次一次」→「三成降到一成」變成七八個碎片）。
// 兩處修改之間只隔 2 個字以內（且不是換行）就併成一個「刪掉這段、換成那段」，Word 裡一條修訂讀得懂。
function tidyDiff(segs, gap = 2) {
  const out = []; let del = '', ins = '', open = false;
  const close = () => { if (del) out.push({ type: 'del', text: del }); if (ins) out.push({ type: 'ins', text: ins }); del = ''; ins = ''; open = false; };
  for (let i = 0; i < segs.length; i++) {
    const z = segs[i];
    if (z.type !== 'eq') { open = true; if (z.type === 'del') del += z.text; else ins += z.text; continue; }
    const nextChange = i + 1 < segs.length && segs[i + 1].type !== 'eq';
    if (open && nextChange && z.text.length <= gap && !z.text.includes('\n')) { del += z.text; ins += z.text; continue; }
    close(); const q = out[out.length - 1]; if (q && q.type === 'eq') q.text += z.text; else out.push({ type: 'eq', text: z.text });
  }
  close();
  return out;
}

// 一節的差異 → 多個 Word 段落：保留與插入的文字遇到換行就分段；刪掉的換行改成空白（刪除修訂裡不能分段）
function sectionParagraphs(segs) {
  const paras = []; let cur = [];
  for (const z of segs) {
    if (z.type === 'del') { cur.push({ type: 'del', text: z.text.replace(/\n/g, ' ') }); continue; }
    z.text.split('\n').forEach((p, k) => { if (k > 0) { paras.push({ heading: null, segments: cur }); cur = []; } if (p) cur.push({ type: z.type, text: p }); });
  }
  paras.push({ heading: null, segments: cur });
  return paras;
}
  // data＝後端 export_review_doc 回傳：{title, author, date, sections:[{key, heading, before, after}], comments:[{key|sectionKey, quote, text, author}]}
  // 回 Uint8Array（zip）；.warnings＝找不到引文的註解提示。opts.noCompress：不壓縮。
  async function buildReviewBytes(data, opts) {
    opts = opts || {}; const sections = data.sections || [], comments = data.comments || [], paragraphs = [], range = {};
    for (const s of sections) {
      if (s.heading) paragraphs.push({ heading: String(s.heading), segments: [] });
      const start = paragraphs.length;
      paragraphs.push(...sectionParagraphs(tidyDiff(diffLong(s.before, s.after))));
      range[s.key] = [start, paragraphs.length];
    }
    const textOf = (p, drop) => p.segments.filter((z) => z.type !== drop).map((z) => z.text).join('');
    const author = data.author || '老師';
    const placed = comments.map((c) => {
      const [st, en] = range[c.key] || range[c.sectionKey] || [0, paragraphs.length];
      let pi = -1;
      for (let k = st; k < en && pi < 0; k++) if (c.quote && (textOf(paragraphs[k], 'del').includes(c.quote) || textOf(paragraphs[k], 'ins').includes(c.quote))) pi = k;
      return { para: pi < 0 ? st : pi, quote: c.quote || '', text: String(c.text || ''), author: c.author || author };
    });
    const doc = { title: data.title || 'NOPQ通 批改版', author, date: data.date || new Date().toISOString(), paragraphs, comments: placed };
    const s = { id: 1, author: doc.author || '', date: doc.date || '', warnings: [] }, cs = doc.comments.map((c, id) => ({ ...c, id }));
    const body = doc.paragraphs.map((p, i) => trackedPara(p, cs.filter((c) => c.para === i), s)).join('');
    const D = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${NS}"><w:body><w:p><w:r><w:t>${esc(doc.title)}</w:t></w:r></w:p>${body}<w:sectPr/></w:body></w:document>`;
    const M = `<?xml version="1.0" encoding="UTF-8"?><w:comments xmlns:w="${NS}">${cs.map((c) => `<w:comment w:id="${c.id}" w:author="${esc(c.author || doc.author)}" w:date="${esc(doc.date)}"><w:p><w:r><w:t>${esc(c.text)}</w:t></w:r></w:p></w:comment>`).join('')}</w:comments>`;
    const b = await pack([['[Content_Types].xml', CTYPES(true)], ['_rels/.rels', RELS], ['word/document.xml', D], ['word/comments.xml', M], ['word/styles.xml', STYLES], ['word/_rels/document.xml.rels', DOCRELS(true)], ['docProps/core.xml', CORE(doc.title, doc.author)]], opts.noCompress);
    b.warnings = s.warnings; return b;
  }
  const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'NOPQ';

  // ── ② 一系要交的兩份 ──
  // pack: {deptName, deptCode?, studentName?, docs:{N,O,P,Q,X}（各＝{title, text | sections, state?}；沒定稿的不要放，或 state 不是 'finalized' 會被略過）,
  //        xPlacement:'withOPQ'|'separate'（X 放哪份；由資料庫各系項目資料決定，沒給＝'separate'）, limits:{N:{maxChars, maxImages}}（由資料庫讀，沒給不檢查）}
  // 回 {files:[{kind:'N'|'OPQ'|'X', fileName, bytes, parts:['O','P','Q']}], missing:['P',…], warnings:[…]}；O、P、Q 沒定稿的排除並列在 missing。
  const PART_LABEL = { N: '多元表現綜整心得', O: '高中學習歷程反思', P: '就讀動機', Q: '未來學習計畫與生涯規劃', X: '其他' };   // 2026-11-25 第 1 批 N10-26：116 簡章原名
  const ready = (d) => d && (d.state == null || d.state === 'finalized') && (d.sections ? d.sections.some((s) => String(s.text || '').trim()) : String(d.text || '').trim());
  // planDept 不產檔、只排好每份要放什麼（給列印版面共用）：回 {groups:[{kind, fileName, doc, parts}], missing, warnings}
  // 一系兩份是上傳甄選會用的：預設不放檔頭三行（pk.showMeta＝true 才放）；N 標題只寫「多元表現綜整心得」，
  // O、P、Q 合併那份大標題用簡章第 12 頁 D 款的名稱「學習歷程自述」、不列系名（系名只放檔名），三篇各自的小標照留。2026-11-24 主線替 owner 選的預設。
  const OPQ_TITLE = '學習歷程自述';
  // 2026-11-25 主線（施工線查、對過簡章原文）：一系最多三份——N（總則第 12 頁 C 款）、O＋P＋Q「學習歷程自述」（D 款）、其他（R、S、T，E 款「由考生自行製作一個其他 PDF 檔案上傳」）。
  // 「其他」獨立一份，不併進前兩份；大標題「其他」、各項小標用分則的名稱（officialName）。該系有列、學生也有寫才出這一份（由呼叫端決定要放哪幾項）。
  const OTHER_TITLE = '其他';
  // N 的圖數上限：後端格子規格還沒有欄位（只寫死在規則檢查 R9），先用這個常數；後端補 photoLimit 後改讀。字數上限由呼叫端傳 get_doc_state 的 spec.totalLimit。
  const N_MAX_IMAGES = 3;   // 出處：116 簡章總則第 12 頁 C 款「字數合計至多 800 字、圖片至多 3 張」
  function planDept(pk) {
    const docs = pk.docs || {}, dept = pk.deptName || '', out = { groups: [], missing: [], warnings: [] }, base = safeName(dept) + (pk.studentName ? '_' + safeName(pk.studentName) : '');
    const named = (t) => ({ studentName: pk.studentName, showMeta: pk.showMeta === true, ...t });
    if (ready(docs.N)) {
      const n = docs.N, lim = (pk.limits && pk.limits.N) || {}, doc = named({ title: PART_LABEL.N, deptName: SHARED_DEPT, text: n.text, sections: n.sections }), p = docParts(doc);
      if (lim.maxChars && p.chars > lim.maxChars) out.warnings.push('N 的字數 ' + p.chars + ' 超過上限 ' + lim.maxChars + '。');
      const maxImg = lim.maxImages != null ? lim.maxImages : N_MAX_IMAGES;
      if (p.photos > maxImg) out.warnings.push('N 放圖的段有 ' + p.photos + ' 段，超過上限 ' + maxImg + '。');
      out.groups.push({ kind: 'N', fileName: base + '_N多元表現綜整心得.docx', doc, parts: ['N'] });
    } else out.missing.push('N');
    const parts = [], sections = [], withX = pk.xPlacement === 'withOPQ';
    for (const t of ['O', 'P', 'Q'].concat(withX ? ['X'] : [])) {
      const d = docs[t];
      if (!ready(d)) { if (t !== 'X') out.missing.push(t); continue; }
      parts.push(t); const hd = d.title || PART_LABEL[t];
      if (d.sections) d.sections.forEach((s, i) => sections.push({ heading: i === 0 ? hd + (s.heading ? '　' + s.heading : '') : s.heading, text: s.text, photo: s.photo })); else sections.push({ heading: hd, text: d.text });
    }
    if (parts.length) out.groups.push({ kind: 'OPQ', fileName: base + '_' + parts.join('') + '合併.docx', doc: named({ title: OPQ_TITLE, deptName: dept, sections }), parts });
    // 其他（R、S、T）：docs.X 可以是一項或多項 [{code, officialName, title, text | sections, state}]；合成一份，大標題「其他」，每項小標＝officialName（沒有就用 title）
    const xs = (Array.isArray(docs.X) ? docs.X : docs.X ? [docs.X] : []).filter(ready);
    if (!withX && xs.length) {
      const xsec = [];
      xs.forEach((d) => { const hd = d.officialName || d.title || PART_LABEL.X;
        if (d.sections) d.sections.forEach((s, i) => xsec.push({ heading: i === 0 ? hd + (s.heading ? '　' + s.heading : '') : s.heading, text: s.text, photo: s.photo })); else xsec.push({ heading: hd, text: d.text }); });
      out.groups.push({ kind: 'X', fileName: base + '_其他.docx', doc: named({ title: OTHER_TITLE, deptName: dept, sections: xsec }), parts: xs.map((d) => d.code || 'X') });
    }
    return out;
  }
  async function buildDeptFiles(pk, opts) {
    const pl = planDept(pk), files = [];
    for (const g of pl.groups) files.push({ kind: g.kind, fileName: g.fileName, bytes: await buildDocBytes(g.doc, opts), parts: g.parts });
    return { files, missing: pl.missing, warnings: pl.warnings };
  }
  // 兩段以上的格子稿（P、Q 分格寫）：照後端 nopq_pq_compose 的拼法：每格去頭尾空白、空的跳過、格與格之間空一行、不夾格名
  const composeCells = (cells) => (cells || []).map((c) => String(c == null ? '' : (typeof c === 'string' ? c : c.text)).trim()).filter(Boolean).join('\n\n');
  // ── ④ 下載：Blob＋<a download>。回 true＝已觸發；LINE 內建瀏覽器請先用 export_print.js 的 lineHint() 提示 ──
  function download(bytes, fileName, mime) {
    try {
      const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime || CT + '.document' }), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = fileName || 'NOPQ通.docx'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); return true;
    } catch (e) { return false; }
  }
  root.NX = root.NX || {};
  root.NX.docx = { buildDocBytes, buildDeptFiles, buildReviewBytes, composeCells, planDept, download, count: nlen, safeName, SHARED_DEPT, PART_LABEL, OPQ_TITLE, OTHER_TITLE, N_MAX_IMAGES, MIME: CT + '.document', diffChars, tidyDiff, diffLong };
})(typeof window !== 'undefined' ? window : globalThis);
