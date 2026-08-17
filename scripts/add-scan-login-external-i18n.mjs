/**
 * 幂等注入扫码登录改造的 4 个 i18n key(5 语言)
 * - openExternalBrowser / externalBrowserHint / scanWithPhoneHint / orDivider
 * 插入到 publish.accounts.cancelScan 之后,保持 JSON key 顺序稳定
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.join(process.cwd(), 'packages', 'i18n', 'messages', 'web')
const NEW_KEYS = {
  'zh-CN': {
    openExternalBrowser: '在外部浏览器打开',
    externalBrowserHint: '用系统浏览器登录(适合验证码/密码登录);登录后复制该网站 Cookie 粘贴到账号表单保存',
    scanWithPhoneHint: '打开后请用手机扫二维码,页面无需点击;检测到登录后自动保存账号',
    orDivider: '或',
  },
  'zh-TW': {
    openExternalBrowser: '在外部瀏覽器開啟',
    externalBrowserHint: '用系統瀏覽器登入(適合驗證碼/密碼登入);登入後複製該網站 Cookie 貼到帳號表單儲存',
    scanWithPhoneHint: '開啟後請用手機掃描 QR Code,頁面無需點擊;偵測到登入後自動儲存帳號',
    orDivider: '或',
  },
  en: {
    openExternalBrowser: 'Open in external browser',
    externalBrowserHint: 'Log in with your system browser (for SMS/password login); after logging in, copy the site Cookie and paste it into the account form to save',
    scanWithPhoneHint: 'Scan the QR code with your phone — no clicking needed; the account is saved automatically once login is detected',
    orDivider: 'or',
  },
  ja: {
    openExternalBrowser: '外部ブラウザで開く',
    externalBrowserHint: 'システムブラウザでログイン(認証コード/パスワード向け);ログイン後、サイトのCookieをコピーしてアカウントフォームに貼り付けて保存',
    scanWithPhoneHint: 'QRコードはスマホでスキャンしてください — ページ操作は不要;ログイン検出後、自動でアカウントが保存されます',
    orDivider: 'または',
  },
  ko: {
    openExternalBrowser: '외부 브라우저에서 열기',
    externalBrowserHint: '시스템 브라우저로 로그인(인증번호/비밀번호용); 로그인 후 사이트 쿠키를 복사해 계정 양식에 붙여넣어 저장하세요',
    scanWithPhoneHint: 'QR코드는 휴대폰으로 스캔하세요 — 페이지 클릭 불필요; 로그인 감지 후 계정이 자동 저장됩니다',
    orDivider: '또는',
  },
}

let changed = 0
for (const [locale, kv] of Object.entries(NEW_KEYS)) {
  const file = path.join(DIR, `${locale}.json`)
  const j = JSON.parse(fs.readFileSync(file, 'utf8'))
  const acc = j.publish?.accounts
  if (!acc) {
    console.error(`[skip] ${locale}: 无 publish.accounts`)
    continue
  }
  let localChanged = false
  for (const [k, v] of Object.entries(kv)) {
    if (acc[k] !== undefined) continue // 幂等:已存在跳过
    acc[k] = v
    localChanged = true
  }
  if (!localChanged) continue
  // JSON.stringify 按对象属性插入顺序输出,新 key 追加在尾部,不影响功能
  fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8')
  changed++
  console.log(`[ok] ${locale}: 注入 4 key`)
}
console.log(changed === 0 ? '全部已存在,无变更(幂等)' : `完成 ${changed} 个语言文件`)
