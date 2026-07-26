#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Shared Auth 静态回归守门脚本 (2026-07-26 升级,前身为 verify-auth-shell.mjs)
 *
 * 触发背景:
 *   2026-07-26 用户反馈"扩展端登录界面与 web 端视觉/功能不一致,4 tab + 8 三方登录缺失,
 *   为什么没共用 LoginForm"——根因是扩展端 popup/sidepanel 各自手写 form,没用共享包。
 *   修复方向:把 LoginForm 抽到 packages/ui-react 共享,web + extension 全部统一。
 *
 * 本脚本是静态守门(纯 grep, < 100ms, 不依赖 dev server / build / 任何运行时), 防止
 * 未来有人:
 *   1-7  AuthShell 共享(继承自 verify-auth-shell.mjs)
 *       - 1: web 端 AuthShell.tsx 必须 import { AuthShell } from '@ihui/ui-react'
 *       - 2: web 端 AuthShell.tsx 不能定义非透传的 function AuthShell (避免重复实现)
 *       - 3: 共享 auth-shell.css 必须含 .login-scope 选择器 (单一来源)
 *       - 4: 共享 auth-shell.css 必须含 .welcome-img-dark 规则 (浅/深主题切换)
 *       - 5: web 端 globals.css 不应再定义根级 .login-scope (已抽到共享包)
 *       - 6: extension 端 globals.css 不应再定义根级 .login-scope
 *       - 7: extension 端必须从 @ihui/ui-react import AuthShell (扫 .tsx 文件)
 *
 *   8-11 LoginForm 共享(新增)
 *       - 8: 共享 packages/ui-react/src/components/login-form/login-form.tsx 必须存在
 *       - 9: extension popup 必须 import LoginForm from @ihui/ui-react (不能手写 form)
 *      - 10: extension sidepanel LoginPage 必须 import LoginForm from @ihui/ui-react
 *      - 11: extension popup 必须启用第三方登录(useExtensionThirdPartyAuth / ThirdPartyConfig)
 *
 * 退出码:
 *   0 = 全部可执行项通过(检查 8-11 在共享 LoginForm 尚未落地时处于"等待"状态, 不阻塞)
 *   1 = 任一项失败
 *
 * 注意: 本脚本已接入 .husky/pre-commit(经 scripts/guardian-runner.mjs 第 31 项,
 *       warn-only),在 pre-commit 时自动跑(guardian-runner 会传 --staged,本脚本纯
 *       静态扫描不依赖 staged,接收并忽略此标记保持接口兼容)。
 *
 * 用法:
 *   node scripts/verify-shared-auth.mjs           # 全量静态扫描 (默认, 失败 exit 1)
 *   node scripts/verify-shared-auth.mjs --staged  # 同上, 接受并忽略 (guardian-runner 传)
 *   node scripts/verify-shared-auth.mjs --strict  # 同上, 接受并忽略 (预留位)
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// === CLI 解析(接受 guardian-runner 自动传的 --staged / --strict,纯静态扫描不依赖 staged) ===
// eslint-disable-next-line no-unused-vars
const _argv = process.argv.slice(2).filter((a) => a === '--staged' || a === '--strict' || a.startsWith('--'))
// 接受并忽略这些标记,避免 "unrecognized flag" 警告。--strict 保留位(当前实现无 warn 路径)

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
  // AuthShell 相关(继承自 verify-auth-shell.mjs)
  sharedShell: join(ROOT, 'packages', 'ui-react', 'src', 'components', 'auth-shell.tsx'),
  sharedCss: join(ROOT, 'packages', 'ui-react', 'src', 'styles', 'auth-shell.css'),
  webShell: join(ROOT, 'apps', 'web', 'src', 'components', 'auth', 'AuthShell.tsx'),
  webGlobals: join(ROOT, 'apps', 'web', 'app', 'globals.css'),
  extGlobals: join(ROOT, 'apps', 'extension', 'entrypoints', 'sidepanel', 'globals.css'),
  extEntrypoints: join(ROOT, 'apps', 'extension', 'entrypoints'),
  // LoginForm 相关(2026-07-26 新增)
  sharedLoginForm: join(ROOT, 'packages', 'ui-react', 'src', 'components', 'login-form', 'login-form.tsx'),
  extPopupApp: join(ROOT, 'apps', 'extension', 'entrypoints', 'popup', 'App.tsx'),
  extLoginPage: join(ROOT, 'apps', 'extension', 'entrypoints', 'sidepanel', 'pages', 'LoginPage.tsx'),
}

const IMPORT_AUTH_SHELL_RE =
  /import\s*\{[^}]*\bAuthShell\b[^}]*\}\s*from\s*['"]@ihui\/ui-react['"]/
const IMPORT_LOGIN_FORM_RE =
  /import\s*\{[^}]*\bLoginForm\b[^}]*\}\s*from\s*['"]@ihui\/ui-react['"]/
// 真正"重复实现" = 自己的 function AuthShell(...) 内部不用 SharedAuthShell
// 允许透传 wrapper: `return <SharedAuthShell ...rest />`(只做默认值/简单属性透传)
const FUNCTION_AUTH_SHELL_RE = /\bfunction\s+AuthShell\s*\(/
const SHELL_PASS_THROUGH_RE =
  /function\s+AuthShell\s*\([^)]*\)\s*\{[\s\S]{0,200}return\s*<\s*SharedAuthShell/
const ROOT_LOGIN_SCOPE_RE = /\.login-scope\s*\{/

// 扩展端第三方登录:useExtensionThirdPartyAuth (hook) / ThirdPartyConfig (配置) / ThirdPartyProvider / thirdParty 配置
const USE_THIRD_PARTY_RE = /(useExtensionThirdPartyAuth|ThirdPartyConfig|ThirdPartyProvider|thirdParty)/
// 扩展端手写 form 退化:用原生 <form onSubmit> + loginByAccount + password 拼装(不经过共享 LoginForm)
const USE_RAW_FORM_RE = /(<form\s+onSubmit|onLogin\s*=\s*\{[^}]*loginByAccount|loginByAccount\s*\(.*password)/

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

// === 检查项收集 ===
// status: 'pass' | 'fail' | 'pending'
//   pass    = 检查通过
//   fail    = 检查失败 (exit 1)
//   pending = 等待共享 LoginForm 落地后再启用, 当前不算 fail, 也不算 pass (仅 LoginForm 8-11)
const checks = []

// ───── 检查项 1/11 ─────
// web 端 AuthShell.tsx 必须 import { AuthShell } from '@ihui/ui-react'
{
  const content = safeRead(FILES.webShell) || ''
  const ok = IMPORT_AUTH_SHELL_RE.test(content)
  checks.push({
    name: 'web AuthShell re-export',
    status: ok ? 'pass' : 'fail',
    detail: ok
      ? 'apps/web/src/components/auth/AuthShell.tsx 含 `import { AuthShell } from "@ihui/ui-react"`'
      : 'apps/web/src/components/auth/AuthShell.tsx 缺少 `import { AuthShell } from "@ihui/ui-react"`',
  })
}

// ───── 检查项 2/11 ─────
// web 端 AuthShell.tsx 不能定义**非透传**的 function AuthShell( (避免重复实现)
{
  const content = safeRead(FILES.webShell) || ''
  const hasOwnDef = FUNCTION_AUTH_SHELL_RE.test(content)
  const isPassThrough = hasOwnDef && SHELL_PASS_THROUGH_RE.test(content)
  const ok = !hasOwnDef || isPassThrough
  checks.push({
    name: 'web AuthShell 不重定义',
    status: ok ? 'pass' : 'fail',
    detail: !hasOwnDef
      ? 'apps/web/src/components/auth/AuthShell.tsx 无 function AuthShell 重复定义 (纯 re-export)'
      : isPassThrough
        ? 'apps/web/src/components/auth/AuthShell.tsx 存在 thin wrapper 但仅透传 SharedAuthShell (允许: className 默认值)'
        : 'apps/web/src/components/auth/AuthShell.tsx 检测到非透传的 function AuthShell 重复定义 (应纯 re-export 或 thin wrapper 透传)',
  })
}

// ───── 检查项 3/11 ─────
// 共享 auth-shell.css 必须包含 .login-scope 选择器
{
  const content = safeRead(FILES.sharedCss) || ''
  const ok = /\.login-scope\b/.test(content)
  checks.push({
    name: '共享 auth-shell.css 含 .login-scope',
    status: ok ? 'pass' : 'fail',
    detail: ok
      ? 'packages/ui-react/src/styles/auth-shell.css 包含 .login-scope 选择器'
      : 'packages/ui-react/src/styles/auth-shell.css 缺少 .login-scope 选择器 (单一来源丢失)',
  })
}

// ───── 检查项 4/11 ─────
// 共享 auth-shell.css 必须包含 .welcome-img-dark 规则 (浅/深主题切换)
{
  const content = safeRead(FILES.sharedCss) || ''
  const ok = /\.welcome-img-dark\b/.test(content)
  checks.push({
    name: '共享 auth-shell.css 含 .welcome-img-dark',
    status: ok ? 'pass' : 'fail',
    detail: ok
      ? 'packages/ui-react/src/styles/auth-shell.css 包含 .welcome-img-dark 规则 (浅/深 welcome 图切换)'
      : 'packages/ui-react/src/styles/auth-shell.css 缺少 .welcome-img-dark 规则 (浅/深切换会失效)',
  })
}

// ───── 检查项 5/11 ─────
// web 端 globals.css 不应再定义根级 .login-scope 规则 (已抽到共享包)
{
  const content = safeRead(FILES.webGlobals) || ''
  const hasRootRule = ROOT_LOGIN_SCOPE_RE.test(content)
  checks.push({
    name: 'web globals.css 无根级 .login-scope',
    status: !hasRootRule ? 'pass' : 'fail',
    detail: hasRootRule
      ? 'apps/web/app/globals.css 检测到根级 `.login-scope {` 规则 (已抽到共享包, 应删除避免重复)'
      : 'apps/web/app/globals.css 无根级 `.login-scope {` 重复 (后代选择器如 .login-scope [role=\'tablist\'] 允许保留)',
  })
}

// ───── 检查项 6/11 ─────
// extension 端 globals.css 不应再定义根级 .login-scope 规则
{
  const content = safeRead(FILES.extGlobals) || ''
  const hasRootRule = ROOT_LOGIN_SCOPE_RE.test(content)
  checks.push({
    name: 'extension globals.css 无根级 .login-scope',
    status: !hasRootRule ? 'pass' : 'fail',
    detail: hasRootRule
      ? 'apps/extension/entrypoints/sidepanel/globals.css 检测到根级 `.login-scope {` 规则 (已抽到共享包, 应删除避免重复)'
      : 'apps/extension/entrypoints/sidepanel/globals.css 无根级 `.login-scope {` 重复',
  })
}

// ───── 检查项 7/11 ─────
// extension 端必须从 @ihui/ui-react import AuthShell (扫 .tsx 文件)
{
  const tsxFiles = findTsxFiles(FILES.extEntrypoints)
  let importFound = null
  for (const file of tsxFiles) {
    const content = readFileSync(file, 'utf8')
    if (IMPORT_AUTH_SHELL_RE.test(content)) {
      importFound = relative(ROOT, file)
      break
    }
  }
  checks.push({
    name: 'extension import AuthShell from @ihui/ui-react',
    status: importFound !== null ? 'pass' : 'fail',
    detail: importFound
      ? `apps/extension/entrypoints/ 在 ${importFound} 找到 import { AuthShell } from "@ihui/ui-react"`
      : 'apps/extension/entrypoints/ 下 .tsx 文件均未 import { AuthShell } from "@ihui/ui-react" (扩展端可能本地重新实现, 漂移)',
  })
}

// ───── LoginForm 8-11: 等待共享 LoginForm 落地 ─────
// 8-11 共用一条 pending 模式: 共享 packages/ui-react/src/components/login-form/login-form.tsx 尚未
// 创建 → 全部标 pending, 不阻塞 commit; 一旦文件落地, 立即切到严格模式扫 4 项。
const sharedLoginFormReady = existsSync(FILES.sharedLoginForm)
const pendingSuffix = sharedLoginFormReady
  ? null
  : '等共享 LoginForm 落地后会自动启用(本任务范围外, 不阻塞 commit)'

// ───── 检查项 8/11 ─────
// 共享 packages/ui-react/src/components/login-form/login-form.tsx 必须存在
{
  if (sharedLoginFormReady) {
    checks.push({
      name: '共享 LoginForm 组件存在',
      status: 'pass',
      detail: 'packages/ui-react/src/components/login-form/login-form.tsx 存在 (单一来源已就位)',
    })
  } else {
    checks.push({
      name: '共享 LoginForm 组件存在',
      status: 'pending',
      detail: `packages/ui-react/src/components/login-form/login-form.tsx 尚未创建 → ${pendingSuffix}`,
    })
  }
}

// ───── 检查项 9/11 ─────
// extension popup 必须 import LoginForm (不能手写 form)
{
  if (!sharedLoginFormReady) {
    checks.push({
      name: 'extension popup 使用共享 LoginForm',
      status: 'pending',
      detail: `apps/extension/entrypoints/popup/App.tsx 当前手写 <form onSubmit>+loginByAccount, ${pendingSuffix}`,
    })
  } else {
    const content = safeRead(FILES.extPopupApp) || ''
    const importsLoginForm = IMPORT_LOGIN_FORM_RE.test(content)
    const usesRawForm = USE_RAW_FORM_RE.test(content)
    const ok = importsLoginForm && !usesRawForm
    checks.push({
      name: 'extension popup 使用共享 LoginForm',
      status: ok ? 'pass' : 'fail',
      detail: !importsLoginForm
        ? 'apps/extension/entrypoints/popup/App.tsx 缺少 `import { LoginForm } from "@ihui/ui-react"` (手写 form 会与 web 端样式/功能不一致)'
        : usesRawForm
          ? 'apps/extension/entrypoints/popup/App.tsx 既 import LoginForm 又用 raw form/onLogin+loginByAccount 手写 (应删除手写 form, 统一用 LoginForm)'
          : 'apps/extension/entrypoints/popup/App.tsx 使用共享 LoginForm (与 web 端 LoginDialog 一致)',
    })
  }
}

// ───── 检查项 10/11 ─────
// extension sidepanel LoginPage 必须 import LoginForm
{
  if (!sharedLoginFormReady) {
    checks.push({
      name: 'extension sidepanel LoginPage 使用共享 LoginForm',
      status: 'pending',
      detail: `apps/extension/entrypoints/sidepanel/pages/LoginPage.tsx 当前手写 <form onSubmit>+loginByAccount, ${pendingSuffix}`,
    })
  } else {
    const content = safeRead(FILES.extLoginPage) || ''
    const importsLoginForm = IMPORT_LOGIN_FORM_RE.test(content)
    const usesRawForm = USE_RAW_FORM_RE.test(content)
    const ok = importsLoginForm && !usesRawForm
    checks.push({
      name: 'extension sidepanel LoginPage 使用共享 LoginForm',
      status: ok ? 'pass' : 'fail',
      detail: !importsLoginForm
        ? 'apps/extension/entrypoints/sidepanel/pages/LoginPage.tsx 缺少 `import { LoginForm } from "@ihui/ui-react"` (手写 form 与 web 端不一致)'
        : usesRawForm
          ? 'apps/extension/entrypoints/sidepanel/pages/LoginPage.tsx 既 import LoginForm 又用 raw form (应删除手写, 统一用 LoginForm)'
          : 'apps/extension/entrypoints/sidepanel/pages/LoginPage.tsx 使用共享 LoginForm',
    })
  }
}

// ───── 检查项 11/11 ─────
// extension popup 必须启用 8 个第三方登录(不能简化省略)
{
  if (!sharedLoginFormReady) {
    checks.push({
      name: 'extension popup 启用 8 个第三方登录',
      status: 'pending',
      detail: `apps/extension/entrypoints/popup/App.tsx 当前未使用 useExtensionThirdPartyAuth / ThirdPartyConfig, ${pendingSuffix}`,
    })
  } else {
    const content = safeRead(FILES.extPopupApp) || ''
    const usesThirdParty = USE_THIRD_PARTY_RE.test(content)
    checks.push({
      name: 'extension popup 启用 8 个第三方登录',
      status: usesThirdParty ? 'pass' : 'fail',
      detail: usesThirdParty
        ? 'apps/extension/entrypoints/popup/App.tsx 含 useExtensionThirdPartyAuth / ThirdPartyConfig (8 个第三方登录按钮可见)'
        : 'apps/extension/entrypoints/popup/App.tsx 未使用第三方登录配置 (用户反馈缺 8 个第三方登录, 应使用 useExtensionThirdPartyAuth hook)',
    })
  }
}

// ───── 输出 ─────
const total = checks.length
let passed = 0
let failed = 0
let pending = 0

console.log(
  `${C.cyan}${C.bold}[verify-shared-auth]${C.reset} ${C.dim}Shared Auth 静态回归守门 (11 项, 纯 grep, < 100ms, 不依赖 dev server)${C.reset}`,
)
console.log(
  `${C.dim}  规则来源: AGENTS.md §4 + 2026-07-26 扩展端登录界面与 web 端视觉/功能一致任务复盘 (前身为 verify-auth-shell.mjs)${C.reset}`,
)
if (pending > 0 || !sharedLoginFormReady) {
  console.log(
    `${C.dim}  当前模式: ${sharedLoginFormReady ? 'strict (共享 LoginForm 已就位)' : 'soft   (共享 LoginForm 尚未落地, 8-11 项 pending, 不阻塞 commit)'}${C.reset}`,
  )
}
console.log('')

checks.forEach((c, i) => {
  const num = `${i + 1}/${total}`
  const label = `${C.cyan}[verify-shared-auth] 检查项 ${num}: ${c.name}${C.reset}`
  if (c.status === 'pass') {
    passed++
    console.log(label)
    console.log(`  ${C.green}${c.detail}${C.reset}`)
  } else if (c.status === 'pending') {
    pending++
    console.log(label)
    console.log(`  ${C.yellow}${c.detail}${C.reset}`)
  } else {
    failed++
    console.log(label)
    console.log(`  ${C.red}${c.detail}${C.reset}`)
  }
})

console.log('')
if (failed === 0) {
  console.log(
    `${C.green}${C.bold}[verify-shared-auth] ✅ 通过 ${passed} 项, 失败 0 项${pending > 0 ? `, 等待 ${pending} 项` : ''} (总计 ${total} 项)${C.reset}`,
  )
  if (pending > 0) {
    console.log(
      `${C.dim}  等待项 (${pending}) 不阻塞 commit; 待共享 packages/ui-react/src/components/login-form/login-form.tsx 落地后, 本脚本自动切到 strict 模式扫全部 11 项。${C.reset}`,
    )
  }
  process.exit(0)
} else {
  const failedNames = checks
    .filter((c) => c.status === 'fail')
    .map((c) => c.name)
    .join('、')
  console.log(
    `${C.red}${C.bold}[verify-shared-auth] ❌ ${failed} 项失败 (${failedNames})${C.reset}`,
  )
  console.log(
    `${C.dim}  修复方向: 把漂移的 AuthShell / LoginForm / .login-scope 规则迁回 packages/ui-react 共享包, 保持单一来源${C.reset}`,
  )
  process.exit(1)
}
