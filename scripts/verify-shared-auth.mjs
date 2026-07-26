#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * verify-shared-auth — 共享 LoginForm 共用静态回归守门(2026-07-26 立)
 *
 * 触发背景:
 *   "扩展端登录界面与 web 端视觉一致 + 4 tab + 三方 + 协议" 任务完成后,
 *   web 端 / extension 端必须共用 packages/ui-react 共享包中的 LoginForm
 *   完整版(4 tab + 8 三方 + 协议 + 注册/忘记密码), 不能用简化版
 *   (tabs=['password'] + showThirdParty=false + showAgreement=false)。
 *   共享包简化配置只是给物理空间极小的场景使用, popup 物理空间
 *   ~460×600 滚动可解决, 不应简化。
 *
 * 本脚本为配套静态守门: 纯字符串/正则分析 (grep 风格), < 100ms 完成,
 * **不依赖 dev server / build / 任何运行时**。 防止未来有人:
 *   1. extension popup 改回简化版 LoginForm(tabs=['password'] 等)
 *   2. extension sidepanel LoginPage 退化为手写表单
 *   3. 共享 LoginForm 移除 4 tab / 三方 / 协议支持
 *
 * 检查项 (8 项, 全 1 才 exit 0):
 *   1. extension popup 必须从 @ihui/ui-react import LoginForm(共用)
 *   2. extension popup 不能传 tabs=['password'] 这种简化配置(用 4 tab 完整版)
 *   3. extension popup 不能传 showThirdParty={false}(8 个三方平台必须显示)
 *   4. extension popup 必须传 showAgreement(协议复选框)
 *   5. extension popup 必须传 thirdParty={...}(三方登录配置)
 *   6. extension sidepanel LoginPage 必须从 @ihui/ui-react import LoginForm
 *   7. extension sidepanel LoginPage 不能用本地手写 LoginForm
 *   8. 共享 LoginForm 必须包含 'email'/'phone'/'password'/'qr' 4 tab 支持
 *
 * 用法:
 *   node scripts/verify-shared-auth.mjs           # 全量静态扫描 (失败 exit 1)
 *   node scripts/verify-shared-auth.mjs --strict  # 同上 (预留位)
 *
 * 退出码:
 *   0 = 全部 8 项通过
 *   1 = 任一项失败
 *
 * 注意: 本脚本由 scripts/guardian-runner.mjs 调用(warn-only)。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// === CLI 解析(接受 guardian-runner 自动传的 --staged,纯静态扫描不依赖 staged) ===
const _argv = process.argv.slice(2).filter((a) => a === '--staged' || a === '--strict' || a.startsWith('--'))

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

const FILES = {
  popupApp: join(ROOT, 'apps', 'extension', 'entrypoints', 'popup', 'App.tsx'),
  sidepanelLoginPage: join(ROOT, 'apps', 'extension', 'entrypoints', 'sidepanel', 'pages', 'LoginPage.tsx'),
  sharedLoginForm: join(ROOT, 'packages', 'ui-react', 'src', 'components', 'login-form', 'login-form.tsx'),
  sharedThirdParty: join(ROOT, 'packages', 'ui-react', 'src', 'components', 'login-form', 'third-party-buttons.tsx'),
  sharedAgreementDialog: join(ROOT, 'packages', 'ui-react', 'src', 'components', 'login-form', 'agreement-notice-dialog.tsx'),
  extOAuthIcons: join(ROOT, 'apps', 'extension', 'public', 'images', 'oauth-providers'),
}

const IMPORT_LOGIN_FORM_RE =
  /import\s*\{[^}]*\bLoginForm\b[^}]*\}\s*from\s*['"]@ihui\/ui-react['"]/

// "简化版" 信号:tabs=['password'] 或 showThirdParty={false} 或 showAgreement={false}
// 这些是 popup 之前用的"紧凑版",用户反馈要求"跟 web 端一模一样"后必须废弃
const SIMPLIFIED_TABS_RE = /tabs\s*=\s*\{\s*\[\s*['"]password['"]\s*\]\s*\}/
const SIMPLIFIED_NO_TP_RE = /showThirdParty\s*=\s*\{?\s*false\s*\}?/
const SIMPLIFIED_NO_AGREE_RE = /showAgreement\s*=\s*\{?\s*false\s*\}?/
const HAS_THIRD_PARTY_PROP_RE = /thirdParty\s*=\s*\{/
const HAS_SHOW_AGREEMENT_RE = /\bshowAgreement\b/

function safeRead(p) {
  if (!existsSync(p)) return null
  return readFileSync(p, 'utf8')
}

function findTsxFiles(dir) {
  const results = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      results.push(...findTsxFiles(full))
    } else if (entry.endsWith('.tsx')) {
      results.push(full)
    }
  }
  return results
}

const checks = []

// ───── 检查项 1/8 ─────
// extension popup 必须从 @ihui/ui-react import LoginForm
{
  const content = safeRead(FILES.popupApp) || ''
  const ok = IMPORT_LOGIN_FORM_RE.test(content)
  checks.push({
    name: 'extension popup import LoginForm 共享',
    ok,
    detail: ok
      ? 'apps/extension/entrypoints/popup/App.tsx 共享 LoginForm 引入'
      : 'apps/extension/entrypoints/popup/App.tsx 未 import LoginForm from @ihui/ui-react',
  })
}

// ───── 检查项 2/8 ─────
// extension popup 不能传 tabs=['password'](简化版)
{
  const content = safeRead(FILES.popupApp) || ''
  const ok = !SIMPLIFIED_TABS_RE.test(content)
  checks.push({
    name: 'extension popup 不退化简化版 tabs',
    ok,
    detail: ok
      ? 'popup 不传 tabs=["password"] 这种简化配置(用 4 tab 完整版)'
      : 'popup 检测到 tabs=["password"] 简化配置(应删除,使用 4 tab 完整版与 web 端一致)',
  })
}

// ───── 检查项 3/8 ─────
// extension popup 不能传 showThirdParty={false}(8 个三方必须显示)
{
  const content = safeRead(FILES.popupApp) || ''
  const ok = !SIMPLIFIED_NO_TP_RE.test(content)
  checks.push({
    name: 'extension popup 不关闭三方登录',
    ok,
    detail: ok
      ? 'popup 不传 showThirdParty={false}(8 个三方登录按钮必须显示,跟 web 端一致)'
      : 'popup 检测到 showThirdParty={false}(必须显示 8 个三方登录按钮,跟 web 端 100% 一致)',
  })
}

// ───── 检查项 4/8 ─────
// extension popup 必须传 showAgreement(协议复选框)
{
  const content = safeRead(FILES.popupApp) || ''
  const ok = HAS_SHOW_AGREEMENT_RE.test(content)
  checks.push({
    name: 'extension popup 启用协议复选框',
    ok,
    detail: ok
      ? 'popup 含 showAgreement(协议复选框启用,跟 web 端一致)'
      : 'popup 必须传 showAgreement(协议复选框必须启用,跟 web 端 100% 一致)',
  })
}

// ───── 检查项 5/8 ─────
// extension popup 必须传 thirdParty={...}(三方登录配置)
{
  const content = safeRead(FILES.popupApp) || ''
  const ok = HAS_THIRD_PARTY_PROP_RE.test(content)
  checks.push({
    name: 'extension popup 注入三方登录配置',
    ok,
    detail: ok
      ? 'popup 含 thirdParty={...}(三方登录配置注入)'
      : 'popup 必须传 thirdParty={thirdParty.config}(注入 8 平台三方登录配置)',
  })
}

// ───── 检查项 6/8 ─────
// extension sidepanel LoginPage 必须从 @ihui/ui-react import LoginForm
{
  const content = safeRead(FILES.sidepanelLoginPage) || ''
  const ok = IMPORT_LOGIN_FORM_RE.test(content)
  checks.push({
    name: 'extension sidepanel LoginPage 共享 LoginForm',
    ok,
    detail: ok
      ? 'apps/extension/entrypoints/sidepanel/pages/LoginPage.tsx 共享 LoginForm 引入'
      : 'apps/extension/entrypoints/sidepanel/pages/LoginPage.tsx 未 import LoginForm from @ihui/ui-react',
  })
}

// ───── 检查项 7/8 ─────
// extension sidepanel LoginPage 不能用本地手写表单(检查 PasswordInput / loginByAccount 等)
{
  const content = safeRead(FILES.sidepanelLoginPage) || ''
  const hasLoginByAccount = /loginByAccount\s*\(/.test(content)
  const hasPasswordInput = /function\s+PasswordInput\s*\(/.test(content)
  const ok = !hasLoginByAccount && !hasPasswordInput
  checks.push({
    name: 'extension sidepanel LoginPage 无本地手写表单',
    ok,
    detail: ok
      ? 'sidepanel LoginPage 无 loginByAccount/function PasswordInput 手写表单(全部用共享版)'
      : 'sidepanel LoginPage 检测到本地手写表单(应统一用共享 LoginForm 完整版)',
  })
}

// ───── 检查项 8/8 ─────
// 共享 LoginForm 必须包含 4 tab 支持('email'/'phone'/'password'/'qr')
{
  const content = safeRead(FILES.sharedLoginForm) || ''
  const hasAllTabs = /tabs\.includes\(['"]email['"]\)/.test(content) &&
    /tabs\.includes\(['"]phone['"]\)/.test(content) &&
    /tabs\.includes\(['"]password['"]\)/.test(content) &&
    /tabs\.includes\(['"]qr['"]\)/.test(content)
  checks.push({
    name: '共享 LoginForm 含 4 tab 支持',
    ok: hasAllTabs,
    detail: hasAllTabs
      ? '共享 LoginForm 支持 email/phone/password/qr 4 tab 切换'
      : '共享 LoginForm 缺少 4 tab 支持(应包含 email/phone/password/qr)',
  })
}

// ───── 输出 ─────
const total = checks.length
let passed = 0

console.log(
  `${C.cyan}${C.bold}[verify-shared-auth]${C.reset} ${C.dim}共享 LoginForm 共用静态回归守门 (${total} 项, 纯 grep, < 100ms, 不依赖 dev server)${C.reset}`,
)
console.log(
  `${C.dim}  规则来源: AGENTS.md §4 + 2026-07-26 扩展端登录界面与 web 端视觉一致任务复盘(2 轮: 1 轮 AuthShell, 2 轮完整 LoginForm)${C.reset}`,
)
console.log('')

checks.forEach((c, i) => {
  const num = `${i + 1}/${total}`
  const label = `${C.cyan}[verify-shared-auth] 检查项 ${num}: ${c.name}${C.reset}`
  if (c.ok) {
    passed++
    console.log(label)
    console.log(`  ${C.green}${c.detail}${C.reset}`)
  } else {
    console.log(label)
    console.log(`  ${C.red}${c.detail}${C.reset}`)
  }
})

console.log('')
if (passed === total) {
  console.log(
    `${C.green}${C.bold}[verify-shared-auth] ✅ 全部 ${total} 项通过${C.reset}`,
  )
  process.exit(0)
} else {
  const failed = total - passed
  const failedNames = checks
    .filter((c) => !c.ok)
    .map((c) => c.name)
    .join('、')
  console.log(
    `${C.red}${C.bold}[verify-shared-auth] ❌ ${failed} 项失败 (${failedNames})${C.reset}`,
  )
  console.log(
    `${C.dim}  修复方向: 确认 extension popup + sidepanel 用共享 LoginForm 完整版(4 tab + 8 三方 + 协议 + 注册链接),不传简化配置${C.reset}`,
  )
  process.exit(1)
}
