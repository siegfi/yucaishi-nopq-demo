'use strict';   // 2026-11-09 落點分析改版 L9（設計稿 §10）：免責警語、首次勾選、存志願確認框
// 警語文字【待法務確認】（設計稿 §10.4 F1）；改任何一個字都要把 DISCLAIMER_VERSION 升版，學生下次進「落點分析」會再彈一次完整版重勾。
const DISCLAIMER_VERSION = '2026-11-09a';
const DISCLAIMER_SHORT = '這裡算的是「用去年（115）的門檻、你現在的分數，大概落在哪」。門檻每年都會動，這是幫你和老師討論用的參考，不是錄取保證；最後要填什麼，以 116 簡章和你自己的決定為準。';
// 「判對的大約七成」＝回測落點判定一致率 W3C 74.0%、現行 B 72.1%（luodian-analysis/CONTEXT.md「回測」段 W3C／B 一致率）；「壓在門檻邊差不多一半會判錯」＝d=0 一致率 49.5%
// （luodian-analysis/OUTPUTS/05_落點推論模型與回測設計_v0.2.md §5.4）。回測數字更新時這兩句跟著改，並升 DISCLAIMER_VERSION（設計稿 §10.2）。
const DISCLAIMER_FULL = [
  ['資料從哪來', '115 學年各校系第一階段通過門檻與招生名額（甄選會公告），111–115 歷年門檻，116 學年招生簡章（名額、預計甄試人數、審查項目）。你填的成績存在你的帳號裡。'],
  ['怎麼算', '把你的級分換算成前一個有資料年度的等值級分，跟那一年該系門檻比，距離越遠越有把握。116 簡章該系招幾人、預計找幾人來二階，只當事實列給你看。'],
  ['哪裡會不準', '各系門檻每年會上下跳動，主要看那一年多少人報名，這沒有人算得到。用過去幾年回頭驗證，這種算法判對的大約七成，剛好壓在門檻邊的系差不多一半會判錯，所以我們給「範圍」不給單一答案，壓線的系會特別標出來。'],
  ['我們沒有的', '各系實際錄取了誰、正取備取幾人。查榜資料進來前，這裡不會告訴你「錄取機率」。'],
  ['AI 的話', '有開 AI 的同學會看到一段對話式解讀，它只是把上面算出來的數字講成人話，不會自己生出新的數字，也不會告訴你「一定上」。'],
  ['你的決定', '落點分析是起點，不是答案。要填哪六個系，是你和家長的決定；老師會給建議，不會替你填。你每一次排的版本、每一次存成志願的選擇我們都留著，是為了之後一起回頭看哪裡想得對、哪裡要調整。'],
  ['以官方為準', '門檻、名額、日期、審查項目，一律以 116 簡章與甄選會、各校公告為準；看到不一樣請告訴我們。'],
];
// 肯定語氣禁字（AI 回覆與評估頁都不准出現）；清單由 owner 增刪【待確認】。validate.mjs 有同一份，離線測試比對兩邊一致。
const ASSERTIVE_BANNED = ['保證錄取', '一定上', '一定會上', '穩上', '必上', '100%', '錄取機率高', '很有機會上', '安心填', '沒問題', '放心', '十拿九穩', '篤定'];
// 免責否定句白名單：掃禁字前先拿掉這些句子（設計稿 §6.3，Codex P0-2 處置）
const DISCLAIMER_ALLOWED = ['不是錄取保證', '不是保證', '不保證', '可能過、也可能不過', '只是參考', '也不會告訴你「一定上」'];
const AI_HEAD = 'AI 老師的解讀（依上面算出來的結果）';
const AI_TAIL = '依去年資料推估，不是保證；正式以 116 簡章與放榜為準。';
const LUODIAN_YEAR = YEAR, OPEN_YEAR = YEAR;   // 2026-11-12 換 116：落點清單、志願、存版都用 116 代碼（YEAR）；比的是 115 的第一階段通過分數（落點引擎 BASIS_YEAR）

const discShortHtml = () => `<div class="disc small">${esc(DISCLAIMER_SHORT)} <button type="button" class="linkbtn" data-act="discFull">完整說明</button></div>`;
const discFullHtml = () => DISCLAIMER_FULL.map(([h, p]) => `<p><b>${esc(h)}</b>　${esc(p)}</p>`).join('');

// 蓋版視窗（掛在 body，不在 #view 裡，換頁不會被清掉；同時只開一個）
// onCancel：視窗不是由裡面的按鈕關掉（例如換頁）時呼叫，讓還在等的流程收到「取消」（Codex 審查 P2-5）
let modalCancel = null;
function modalOpen(html, onMount, onCancel) {
  modalClose(); const box = document.createElement('div'); box.id = 'modal'; box.className = 'modal';
  box.innerHTML = `<div class="mbox" role="dialog" aria-modal="true">${html}</div>`; document.body.appendChild(box);
  modalCancel = onCancel || null;
  if (onMount) onMount(box); return box;
}
function modalClose() { const m = $('modal'); if (m) m.remove(); const c = modalCancel; modalCancel = null; if (c) c(); }
function modalDone() { modalCancel = null; modalClose(); }   // 由視窗裡的按鈕正常結束：不觸發取消

// 首次進「落點分析」：完整版警語，捲到底才出現勾選框；勾了才寫 LuodianAck（kind=first_view；警語改版則 reack）
S.ack = null;   // null＝還沒查；{version, any}
async function loadAcks() {
  if (S.ack) return S.ack;
  const r = await call('my_luodian_acks', {}, { quiet: true });
  const items = (r && r.ok && r.items) || [];
  S.ack = { version: items.some((x) => x.disclaimerVersion === DISCLAIMER_VERSION) ? DISCLAIMER_VERSION : '', any: items.length > 0 };
  return S.ack;
}
function ackModal(kind) {
  return new Promise((resolve) => {
    modalOpen(`<h2>${kind === 'reack' ? '落點分析的說明更新了，請再看一次' : '開始之前，先看一下這頁怎麼用'}</h2>
      <div class="mscroll" id="disc-scroll" tabindex="0">${discFullHtml()}<p class="muted small">未滿 18 歲的同學，請家長也看過這頁。（說明版本 ${esc(DISCLAIMER_VERSION)}）</p></div>
      <div id="disc-tick" class="hidden"><label class="tick"><input type="checkbox" id="disc-ok"> 我了解這是參考，不是保證</label></div>
      <p class="muted small" id="disc-more">往下捲到底，就會出現勾選框。</p>
      <div class="row" style="margin-top:10px"><button type="button" class="btn" id="disc-go" disabled>開始用落點分析</button></div>`, (box) => {
      const sc = box.querySelector('#disc-scroll'), tick = box.querySelector('#disc-tick'), ok = box.querySelector('#disc-ok'), go = box.querySelector('#disc-go');
      const atEnd = () => { if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) { tick.classList.remove('hidden'); box.querySelector('#disc-more').classList.add('hidden'); } };
      sc.addEventListener('scroll', atEnd); setTimeout(atEnd, 0);
      ok.addEventListener('change', () => { go.disabled = !ok.checked; });
      go.addEventListener('click', async () => {
        go.disabled = true;
        try {
          const r = await call('ack_disclaimer', { p_kind: kind, p_version: DISCLAIMER_VERSION });
          if (!r.ok) { go.disabled = false; return; }
          S.ack = { version: DISCLAIMER_VERSION, any: true }; modalDone(); resolve(true);
        } catch (e) { go.disabled = false; }
      });
    }, () => resolve(false));
  });
}
async function ensureAck() {
  const a = await loadAcks();
  if (a.version === DISCLAIMER_VERSION) return true;
  return ackModal(a.any ? 'reack' : 'first_view');
}
ACT.discFull = () => {
  modalOpen(`<h2>落點分析怎麼看</h2><div class="mscroll">${discFullHtml()}<p class="muted small">說明版本 ${esc(DISCLAIMER_VERSION)}</p></div>
    <div class="row" style="margin-top:10px"><button type="button" class="btn" data-act="modalClose">知道了</button></div>`);
};
ACT.modalClose = () => modalClose();

// 存成志願的確認框（設計稿 §10.3(a)）：顯示短版警語＋這版的 2／2／2 與學群數，選填「我為什麼這樣填」；按「我了解，存成志願」才回 {note}
function wishConfirm(rules, extra) {
  const m = (rules && rules.mix) || {}, gp = (rules && rules.groupsPicked) || 0;
  const off = [];
  if (!(rules && rules.mix222)) off.push('跟建議的 2 夢幻／2 正常／2 保底不一樣');
  if (gp > 3) off.push('超過 3 個學群');
  return new Promise((resolve) => {
    modalOpen(`<h2>存成志願之前</h2>
      <div class="disc small" style="margin:0 0 10px">${esc(DISCLAIMER_SHORT)}</div>
      <div class="hint" style="margin:0 0 8px">這版 夢幻 ${m.dream || 0}／正常 ${m.reach || 0}／保底 ${m.safe || 0}${m.none ? `／現在成績不在清單 ${m.none}` : ''}、橫跨 ${gp} 個學群。<br>建議 2／2／2、不超過 3 個學群${off.length ? `；這版${esc(off.join('、'))}。` : '，這版符合。'}</div>
      ${extra ? `<div class="muted small" style="margin:0 0 8px">${extra}</div>` : ''}
      <label class="f" for="wc-note">我為什麼這樣填（可以不寫，最多 200 字）</label><textarea id="wc-note" maxlength="200" rows="3"></textarea>
      <p class="muted small" style="margin:6px 0 0">會取代原本的志願；這次的選擇會留在歷史，之後可以和老師一起回頭看。</p>
      <div class="row" style="margin-top:10px"><button type="button" class="btn" id="wc-go">我了解，存成志願</button><button type="button" class="btn ghost" id="wc-no">先不要</button></div>`, (box) => {
      box.querySelector('#wc-go').addEventListener('click', () => { const note = box.querySelector('#wc-note').value.trim(); modalDone(); resolve({ note }); });
      box.querySelector('#wc-no').addEventListener('click', () => { modalDone(); resolve(null); });
    }, () => resolve(null));
  });
}

// 三個子分頁共用的頂部：分段切換列＋年份說明＋短版警語
const SUBTABS = [['new', '#/score', '新作落點分析'], ['history', '#/score/history', '歷史落點分析'], ['assess', '#/score/assess', 'AI 落點機率評估']];
function subTabsHtml(on) {
  return `<div class="ztabs subtabs" role="tablist" aria-label="落點分析">${SUBTABS.map(([k, href, name]) => `<a role="tab" aria-selected="${k === on}" class="ztab ${k === on ? 'on' : ''}" href="${href}">${name}</a>`).join('')}</div>
    <div class="yearline small"><b>校系、名額照 ${OPEN_YEAR} 學年簡章；落點拿 ${typeof BASIS_YEAR !== 'undefined' ? esc(BASIS_YEAR) : '115'} 學年（去年）各系第一階段實際通過的分數來比。</b>116 五標公布前，檢定先用 ${SCORE_YEAR} 五標估。門檻每年會變，結果是參考。</div>
    ${discShortHtml()}`;
}
