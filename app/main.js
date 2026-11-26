'use strict';   // 原本整支主程式包在一個函式裡並開嚴格模式；拆檔後每個檔各自開
(async function boot() {
  try {
    if (typeof resetBoot === 'function' && resetBoot()) return;   // 2026-11-25 第 ① 步：重設密碼的連結回來（網址帶 type=recovery）→ 進「設新密碼」，不進首頁
    const { data } = await sb.auth.getSession();   // 存的登入過期或 refresh 失敗：supabase-js 會自己清掉，這裡拿到 null，就是乾淨的登入頁
    if (data && data.session) await enter(); else showLogin('');
  } catch (e) { showLogin(''); } finally { bootQuiet = false; }
})();
