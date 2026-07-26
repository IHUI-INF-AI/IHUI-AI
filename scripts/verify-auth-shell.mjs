#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * AuthShell 共享实现 — 静态回归守门脚本
 *
 * 触发背景 (2026-07-26):
 *   "扩展端登录界面与 web 端视觉一致" 任务完成后, web 端
 *   (apps/web/src/components/auth/AuthShell.tsx) + extension 端
 *   (apps/extension/entrypoints/popup/App.tsx + sidepanel/pages/LoginPage.tsx)
 *   全部统一使用 packages/ui-react 共享包中的 AuthShell 组件 + auth-shell.css
 *   共享样式, 根治了"web/extension 各维护一份 AuthShell → 视觉漂移"的历史问题。
 *
 * 本脚本为配套静态守门: 纯字符串/正则分析 (grep 风格), < 100ms 完成,
 * **不依赖 dev server / build / 任何运行时**。 防止未来有人:
 *   1. 在 web 端或 extension 端重新写一份本地 AuthShell 实现
 *   2. 把 .login-scope / .welcome-img 规则从共享 CSS 搬回 web/extension globals.css
 *   3. web 端 AuthShell.tsx 重新定义自己的 function AuthShell(...)
 *
 * 检查项 (7 项, 全 1 才 exit 0):
 *   1. web 端 AuthShell.tsx 必须 `import { AuthShell } from '@ihui/ui-react'`
 *   2. web 端 AuthShell.tsx 不能定义**非透传**的 `function AuthShell(` (避免重复实现)。
 *      允许:thin wrapper 仅做 className 默认值透传 `<SharedAuthShell ... />` (web 端
 *      `max-w-[460px]` 默认值需要,3 个调用方避免重复传)。禁止:wrapper 内有
 *      自己的 JSX 结构 (div/header/footer 等) 与 SharedAuthShell 视觉漂移。
 *   3. 共享 auth-shell.css 必须包含 `.login-scope` 选择器 (单一来源)
 *   4. 共享 auth-shell.css 必须包含 `.welcome-img-dark` 规则 (浅/深主题切换)
 *   5. web 端 globals.css 不应再定义根级 `.login-scope` 规则 (已抽到共享包)
 *   6. extension 端 globals.css 不应再定义根级 `.login-scope` 规则
 *   7. extension 端必须从 `@ihui/ui-react` import AuthShell (扫 .tsx 文件)
 *
 * 用法:
 *   node scripts/verify-auth-shell.mjs           # 全量静态扫描 (默认, 失败 exit 1)
 *   node scripts/verify-auth-shell.mjs --strict   # 同上, 预留位 (当前实现无 warn 路径)
 *
 * 退出码:
 *   0 = 全部 7 项通过
 *   1 = 任一项失败
 *
 * 注意: 本脚本不接 .husky/pre-commit (留给主 agent 决定接入策略)。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  sharedShell: join(ROOT, 'packages', 'ui-react', 'src', 'components', 'auth-shell.tsx'),
  sharedCss: join(ROOT, 'packages', 'ui-react', 'src', 'styles', 'auth-shell.css'),
  webShell: join(ROOT, 'apps', 'web', 'src', 'components', 'auth', 'AuthShell.tsx'),
  webGlobals: join(ROOT, 'apps', 'web', 'app', 'globals.css'),
  extGlobals: join(ROOT, 'apps', 'extension', 'entrypoints', 'sidepanel', 'globals.css'),
  extEntrypoints: join(ROOT, 'apps', 'extension', 'entrypoints'),
}

const IMPORT_AUTH_SHELL_RE =
  /import\s*\{[^}]*\bAuthShell\b[^}]*\}\s*from\s*['"]@ihui\/ui-react['"]/
// 真正"重复实现" = 自己的 function AuthShell(...) 内部不用 SharedAuthShell
// 允许透传 wrapper: `return <SharedAuthShell ...rest />`(只做默认值/简单属性透传)
const FUNCTION_AUTH_SHELL_RE = /\bfunction\s+AuthShell\s*\(/
const SHELL_PASS_THROUGH_RE =
  /function\s+AuthShell\s*\([^)]*\)\s*\{[\s\S]{0,200}return\s*<\s*SharedAuthShell/
const ROOT_LOGIN_SCOPE_RE = /\.login-scope\s*\{/

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

// ───── 检查项 1/7 ─────
// web 端 AuthShell.tsx 必须 import { AuthShell } from '@ihui/ui-react'
{
  const content = safeRead(FILES.webShell) || ''
  const ok = IMPORT_AUTH_SHELL_RE.test(content)
  checks.push({
    name: 'web AuthShell re-export',
    ok,
    detail: ok
      ? 'apps/web/src/components/auth/AuthShell.tsx 含 `import { AuthShell } from "@ihui/ui-react"`'
      : 'apps/web/src/components/auth/AuthShell.tsx 缺少 `import { AuthShell } from "@ihui/ui-react"`',
  })
}

// ───── 检查项 2/7 ─────
// web 端 AuthShell.tsx 不能定义**非透传**的 function AuthShell( (避免重复实现)
// 允许:thin wrapper 仅做 className 默认值透传 SharedAuthShell (web 端 max-w-[460px] 默认值)
// 禁止:wrapper 内有自定义 JSX 结构 (div/header/footer 等) 造成视觉漂移
{
  const content = safeRead(FILES.webShell) || ''
  const hasOwnDef = FUNCTION_AUTH_SHELL_RE.test(content)
  const isPassThrough = hasOwnDef && SHELL_PASS_THROUGH_RE.test(content)
  checks.push({
    name: 'web AuthShell 不重定义',
    ok: !hasOwnDef || isPassThrough,
    detail: !hasOwnDef
      ? 'apps/web/src/components/auth/AuthShell.tsx 无 function AuthShell 重复定义 (纯 re-export)'
      : isPassThrough
        ? 'apps/web/src/components/auth/AuthShell.tsx 存在 thin wrapper 但仅透传 SharedAuthShell (允许: className 默认值)'
        : 'apps/web/src/components/auth/AuthShell.tsx 检测到非透传的 function AuthShell 重复定义 (应纯 re-export 或 thin wrapper 透传, 业务默认值请走 props / 外层包装)',
  })
}

// ───── 检查项 3/7 ─────
// 共享 auth-shell.css 必须包含 .login-scope 选择器
{
  const content = safeRead(FILES.sharedCss) || ''
  const ok = /\.login-scope\b/.test(content)
  checks.push({
    name: '共享 auth-shell.css 含 .login-scope',
    ok,
    detail: ok
      ? 'packages/ui-react/src/styles/auth-shell.css 包含 .login-scope 选择器'
      : 'packages/ui-react/src/styles/auth-shell.css 缺少 .login-scope 选择器 (单一来源丢失)',
  })
}

// ───── 检查项 4/7 ─────
// 共享 auth-shell.css 必须包含 .welcome-img-dark 规则 (浅/深主题切换)
{
  const content = safeRead(FILES.sharedCss) || ''
  const ok = /\.welcome-img-dark\b/.test(content)
  checks.push({
    name: '共享 auth-shell.css 含 .welcome-img-dark',
    ok,
    detail: ok
      ? 'packages/ui-react/src/styles/auth-shell.css 包含 .welcome-img-dark 规则 (浅/深 welcome 图切换)'
      : 'packages/ui-react/src/styles/auth-shell.css 缺少 .welcome-img-dark 规则 (浅/深切换会失效)',
  })
}

// ───── 检查项 5/7 ─────
// web 端 globals.css 不应再定义根级 .login-scope 规则 (已抽到共享包)
// 注意: 只检查根级 `.login-scope {` 规则, 不检查 `.login-scope [role='tablist'] {`
//       等后代选择器 (web 专属覆盖, 文档允许保留, 见 globals.css 注释)
{
  const content = safeRead(FILES.webGlobals) || ''
  const hasRootRule = ROOT_LOGIN_SCOPE_RE.test(content)
  checks.push({
    name: 'web globals.css 无根级 .login-scope',
    ok: !hasRootRule,
    detail: hasRootRule
      ? 'apps/web/app/globals.css 检测到根级 `.login-scope {` 规则 (已抽到共享包, 应删除避免重复)'
      : 'apps/web/app/globals.css 无根级 `.login-scope {` 重复 (后代选择器如 .login-scope [role=\'tablist\'] 允许保留)',
  })
}

// ───── 检查项 6/7 ─────
// extension 端 globals.css 不应再定义根级 .login-scope 规则
{
  const content = safeRead(FILES.extGlobals) || ''
  const hasRootRule = ROOT_LOGIN_SCOPE_RE.test(content)
  checks.push({
    name: 'extension globals.css 无根级 .login-scope',
    ok: !hasRootRule,
    detail: hasRootRule
      ? 'apps/extension/entrypoints/sidepanel/globals.css 检测到根级 `.login-scope {` 规则 (已抽到共享包, 应删除避免重复)'
      : 'apps/extension/entrypoints/sidepanel/globals.css 无根级 `.login-scope {` 重复',
  })
}

// ───── 检查项 7/7 ─────
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
    ok: importFound !== null,
    detail: importFound
      ? `apps/extension/entrypoints/ 在 ${importFound} 找到 import { AuthShell } from "@ihui/ui-react"`
      : 'apps/extension/entrypoints/ 下 .tsx 文件均未 import { AuthShell } from "@ihui/ui-react" (扩展端可能本地重新实现, 漂移)',
  })
}

// ───── 输出 ─────
const total = checks.length
let passed = 0

console.log(
  `${C.cyan}${C.bold}[verify-auth-shell]${C.reset} ${C.dim}AuthShell 共享实现静态回归守门 (7 项, 纯 grep, < 100ms, 不依赖 dev server)${C.reset}`,
)
console.log(
  `${C.dim}  规则来源: AGENTS.md §4 + 2026-07-26 扩展端登录界面与 web 端视觉一致任务复盘${C.reset}`,
)
console.log('')

checks.forEach((c, i) => {
  const num = `${i + 1}/${total}`
  const label = `${C.cyan}[verify-auth-shell] 检查项 ${num}: ${c.name}${C.reset}`
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
    `${C.green}${C.bold}[verify-auth-shell] ✅ 全部 ${total} 项通过${C.reset}`,
  )
  process.exit(0)
} else {
  const failed = total - passed
  const failedNames = checks
    .filter((c) => !c.ok)
    .map((c) => c.name)
    .join('、')
  console.log(
    `${C.red}${C.bold}[verify-auth-shell] ❌ ${failed} 项失败 (${failedNames})${C.reset}`,
  )
  console.log(
    `${C.dim}  修复方向: 把漂移的 AuthShell / .login-scope 规则迁回 packages/ui-react 共享包, 保持单一来源${C.reset}`,
  )
  process.exit(1)
}
