/**
 * 幂等注入"用 Chrome 登录(自动保存)"的 i18n key(5 语言)
 * - useChromeLogin / useChromeLoginHint / chromeLoginStarting / chromeLoginPolling / chromeLoginStartFailed
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.join(process.cwd(), 'packages', 'i18n', 'messages', 'web')
const NEW_KEYS = {
  'zh-CN': {
    useChromeLogin: '用 Chrome 登录（自动保存）',
    useChromeLoginHint: '桌面版：弹出 Google Chrome 完整登录，检测到登录后自动保存账号',
    chromeLoginStarting: '正在启动 Chrome 登录窗口...',
    chromeLoginPolling: '已在 Chrome 中打开登录页，请完成登录；检测到登录后自动保存账号',
    chromeLoginStartFailed: '启动 Chrome 登录窗口失败，请确认已安装 Google Chrome',
  },
  'zh-TW': {
    useChromeLogin: '用 Chrome 登入（自動儲存）',
    useChromeLoginHint: '桌面版：彈出 Google Chrome 完整登入，偵測到登入後自動儲存帳號',
    chromeLoginStarting: '正在啟動 Chrome 登入視窗...',
    chromeLoginPolling: '已在 Chrome 中開啟登入頁，請完成登入；偵測到登入後自動儲存帳號',
    chromeLoginStartFailed: '啟動 Chrome 登入視窗失敗，請確認已安裝 Google Chrome',
  },
  en: {
    useChromeLogin: 'Log in with Chrome (auto-save)',
    useChromeLoginHint: 'Desktop: opens Google Chrome for full login; account is saved automatically once login is detected',
    chromeLoginStarting: 'Starting Chrome login window...',
    chromeLoginPolling: 'Login page opened in Chrome. Complete the login — the account will be saved automatically once detected',
    chromeLoginStartFailed: 'Failed to launch Chrome login window. Make sure Google Chrome is installed',
  },
  ja: {
    useChromeLogin: 'Chromeでログイン（自動保存）',
    useChromeLoginHint: 'デスクトップ版：Google Chromeでフルログイン。ログイン検出後、自動でアカウントを保存',
    chromeLoginStarting: 'Chromeログインウィンドウを起動中...',
    chromeLoginPolling: 'Chromeでログインページを開きました。ログインすると自動でアカウントが保存されます',
    chromeLoginStartFailed: 'Chromeログインウィンドウの起動に失敗しました。Google Chromeがインストールされているか確認してください',
  },
  ko: {
    useChromeLogin: 'Chrome으로 로그인(자동 저장)',
    useChromeLoginHint: '데스크톱: Google Chrome에서 전체 로그인, 로그인 감지 후 계정 자동 저장',
    chromeLoginStarting: 'Chrome 로그인 창을 시작하는 중...',
    chromeLoginPolling: 'Chrome에서 로그인 페이지를 열었습니다. 로그인하면 계정이 자동 저장됩니다',
    chromeLoginStartFailed: 'Chrome 로그인 창을 시작하지 못했습니다. Google Chrome이 설치되어 있는지 확인하세요',
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
    if (acc[k] !== undefined) continue // 幂等
    acc[k] = v
    localChanged = true
  }
  if (!localChanged) continue
  fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8')
  changed++
  console.log(`[ok] ${locale}: 注入 ${Object.keys(kv).length} key`)
}
console.log(changed === 0 ? '全部已存在,无变更(幂等)' : `完成 ${changed} 个语言文件`)
