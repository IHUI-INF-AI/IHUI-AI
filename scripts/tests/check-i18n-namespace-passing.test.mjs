import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
// 从 scripts/tests/ 回到 scripts/check-i18n-namespace-passing.mjs
const SCRIPT_PATH = join(__dirname, '..', 'check-i18n-namespace-passing.mjs')
const TMP_DIR = mkdtempSync(join(tmpdir(), 'ihui-i18n-ns-'))

// ─── 运行脚本并去除 ANSI 颜色码,便于正则断言 ───
function runScript(args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  r.err = (r.stderr || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

// ═══════════════════════════════════════════════════════════════
// 复制源脚本的正则/常量(源脚本未导出函数,直接复制规则逻辑)
// 与 check-parent-pollution.test.mjs / check-commit-loss-guard.test.mjs 同款做法
//
// 被测脚本:scripts/check-i18n-namespace-passing.mjs
// 测试范围:
//   ① useTranslations('xxx') 限定命名空间 hook 检测(NS_HOOK_RE)
//   ② t 传给 @ihui/ui-react 共享登录组件检测(UI_REACT_IMPORT_RE / SHARED_LOGIN_COMPONENTS / findTPropUsage)
//   ③ 无命中 pass case(CLI 集成测试,scanFile 完整流程)
// 退出码:0 = 全部通过;非 0 = 有失败
// ═══════════════════════════════════════════════════════════════

const NS_HOOK_RE =
  /(?:const|let|var)\s+(\w+)\s*=\s*useTranslations\(\s*['"]([^'"]+)['"]\s*\)/g

const UI_REACT_IMPORT_RE = /import\s+\{([^}]+)\}\s+from\s+['"]@ihui\/ui-react['"]/

const SHARED_LOGIN_COMPONENTS = new Set([
  'LoginForm',
  'EmailCodeLoginForm',
  'PhoneCodeLoginForm',
  'PasswordLoginForm',
  'AgreementCheckbox',
  'AgreementNoticeDialog',
  'ThirdPartyLoginButtons',
  'QrTab',
])

function parseUiReactImports(src) {
  const m = UI_REACT_IMPORT_RE.exec(src)
  if (!m) return new Set()
  const names = new Set()
  for (const raw of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
    const cleaned = raw.replace(/^type\s+/, '')
    const asMatch = cleaned.match(/^(\w+)\s+as\s+(\w+)$/)
    if (asMatch) {
      names.add(asMatch[2])
    } else if (/^\w+$/.test(cleaned)) {
      names.add(cleaned)
    }
  }
  return names
}

function findTPropUsage(src, compName, varName) {
  const escapedVar = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `<${compName}\\b[^<>]*?\\bt\\s*=\\s*\\{\\s*${escapedVar}\\s*\\}`,
  )
  return re.test(src)
}

// ═══════════════════════════════════════════════════════════════
// 1. NS_HOOK_RE 单元测试:命中 useTranslations('xxx') 限定命名空间
// ═══════════════════════════════════════════════════════════════

test('NS_HOOK_RE: 命中 const t = useTranslations("auth") → 捕获 varName=t, ns=auth', () => {
  NS_HOOK_RE.lastIndex = 0
  const m = NS_HOOK_RE.exec("const t = useTranslations('auth')")
  assert.ok(m, '应匹配 const + useTranslations("auth")')
  assert.equal(m[1], 't', 'varName 应为 t')
  assert.equal(m[2], 'auth', 'ns 应为 auth')
})

test('NS_HOOK_RE: 命中 const/let/var 三种声明 + 单双引号', () => {
  for (const decl of ['const', 'let', 'var']) {
    NS_HOOK_RE.lastIndex = 0
    const m = NS_HOOK_RE.exec(`${decl} tt = useTranslations("ns1")`)
    assert.ok(m, `${decl} 应匹配`)
    assert.equal(m[1], 'tt')
    assert.equal(m[2], 'ns1')
  }
})

test('NS_HOOK_RE: 不匹配无参数 useTranslations()(无命名空间,正确用法)', () => {
  NS_HOOK_RE.lastIndex = 0
  const m = NS_HOOK_RE.exec('const t = useTranslations()')
  assert.equal(m, null, '无参数 useTranslations() 不应匹配')
})

test('NS_HOOK_RE: 不匹配动态命名空间 useTranslations(varName)', () => {
  NS_HOOK_RE.lastIndex = 0
  const m = NS_HOOK_RE.exec('const t = useTranslations(someVar)')
  assert.equal(m, null, '动态命名空间不应匹配')
})

// ═══════════════════════════════════════════════════════════════
// 2. UI_REACT_IMPORT_RE / parseUiReactImports / findTPropUsage 单元测试
//    命中 t 传给 @ihui/ui-react 共享登录组件
// ═══════════════════════════════════════════════════════════════

test('UI_REACT_IMPORT_RE: 命中 import { LoginForm } from "@ihui/ui-react"', () => {
  const m = UI_REACT_IMPORT_RE.exec("import { LoginForm } from '@ihui/ui-react'")
  assert.ok(m, '应匹配 import 语句')
  assert.equal(m[1].trim(), 'LoginForm')
})

test('parseUiReactImports: 解析多组件 + as 别名 + type 前缀', () => {
  const src = `import { LoginForm, PasswordLoginForm as PLF, type AgreementCheckbox } from '@ihui/ui-react'`
  const names = parseUiReactImports(src)
  assert.ok(names.has('LoginForm'), '应包含 LoginForm')
  assert.ok(names.has('PLF'), '应包含 as 别名 PLF')
  assert.ok(names.has('AgreementCheckbox'), '应包含 type AgreementCheckbox')
})

test('UI_REACT_IMPORT_RE: 不匹配非 @ihui/ui-react 的 import', () => {
  const m = UI_REACT_IMPORT_RE.exec("import { LoginForm } from './local'")
  assert.equal(m, null, '非 @ihui/ui-react import 不应匹配')
})

test('findTPropUsage: 命中 <LoginForm t={t} />', () => {
  assert.ok(findTPropUsage('<LoginForm t={t} />', 'LoginForm', 't'), '应匹配 <LoginForm t={t} />')
  assert.ok(findTPropUsage('<LoginForm onSubmit={x} t={t} />', 'LoginForm', 't'), '应匹配多属性')
  assert.ok(findTPropUsage('<LoginForm\n  t={t}\n/>', 'LoginForm', 't'), '应匹配多行属性')
})

test('findTPropUsage: 不匹配 t={otherVar} 或非共享组件', () => {
  assert.ok(!findTPropUsage('<LoginForm t={otherVar} />', 'LoginForm', 't'), 'otherVar 不应匹配 varName=t')
  assert.ok(!findTPropUsage('<OtherComponent t={t} />', 'LoginForm', 't'), 'OtherComponent 不应被检测')
})

test('SHARED_LOGIN_COMPONENTS: 清单 8 个组件', () => {
  assert.equal(SHARED_LOGIN_COMPONENTS.size, 8, '应有 8 个共享登录组件')
  for (const c of ['LoginForm', 'EmailCodeLoginForm', 'PhoneCodeLoginForm', 'PasswordLoginForm', 'AgreementCheckbox', 'AgreementNoticeDialog', 'ThirdPartyLoginButtons', 'QrTab']) {
    assert.ok(SHARED_LOGIN_COMPONENTS.has(c), `${c} 应在共享清单`)
  }
})

// ═══════════════════════════════════════════════════════════════
// 3. CLI 集成测试:无命中 pass case(scanFile 完整流程)
// ═══════════════════════════════════════════════════════════════

// Bug 样本:全部 3 条规则命中
const BUG_SAMPLE = `'use client'
import { useTranslations } from 'next-intl'
import { LoginForm } from '@ihui/ui-react'

export function Demo() {
  const t = useTranslations('auth')
  return <LoginForm t={t} onSubmit={() => {}} />
}
`

// Pass case 1:无命名空间(正确用法)
const PASS_NO_NS = `'use client'
import { useTranslations } from 'next-intl'
import { LoginForm } from '@ihui/ui-react'

export function Demo() {
  const t = useTranslations()
  return <LoginForm t={t} onSubmit={() => {}} />
}
`

// Pass case 2:有命名空间,但未 import 共享组件
const PASS_NO_SHARED_IMPORT = `'use client'
import { useTranslations } from 'next-intl'

export function Demo() {
  const t = useTranslations('auth')
  return <div>{t('title')}</div>
}
`

// Pass case 3:有命名空间 + import @ihui/ui-react,但未导入共享登录组件
const PASS_IMPORT_OTHER_ONLY = `'use client'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'

export function Demo() {
  const t = useTranslations('auth')
  return <Button t={t} />
}
`

const BUG_FILE = join(TMP_DIR, 'bug.tsx')
const PASS_NO_NS_FILE = join(TMP_DIR, 'pass_no_ns.tsx')
const PASS_NO_SHARED_FILE = join(TMP_DIR, 'pass_no_shared.tsx')
const PASS_OTHER_IMPORT_FILE = join(TMP_DIR, 'pass_other_import.tsx')

writeFileSync(BUG_FILE, BUG_SAMPLE)
writeFileSync(PASS_NO_NS_FILE, PASS_NO_NS)
writeFileSync(PASS_NO_SHARED_FILE, PASS_NO_SHARED_IMPORT)
writeFileSync(PASS_OTHER_IMPORT_FILE, PASS_IMPORT_OTHER_ONLY)

test('CLI 集成:Bug case → exit 1 + stderr 含 useTranslations("auth") + LoginForm', () => {
  const r = runScript([BUG_FILE])
  assert.equal(r.status, 1, `bug 文件应 exit 1\nstdout: ${r.out}\nstderr: ${r.err}`)
  const combined = r.out + r.err
  assert.match(combined, /useTranslations\('auth'\)/, '应提及 useTranslations(auth)')
  assert.match(combined, /LoginForm/, '应提及 LoginForm')
})

test('CLI 集成:Pass case 1(无命名空间 useTranslations())→ exit 0 + ✅', () => {
  const r = runScript([PASS_NO_NS_FILE])
  assert.equal(r.status, 0, `pass 文件应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
  assert.match(r.out, /✅|无命名空间传递 bug/)
})

test('CLI 集成:Pass case 2(有命名空间但无共享组件 import)→ exit 0', () => {
  const r = runScript([PASS_NO_SHARED_FILE])
  assert.equal(r.status, 0, `无 import 共享组件应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
})

test('CLI 集成:Pass case 3(import Button 但非共享登录组件)→ exit 0', () => {
  const r = runScript([PASS_OTHER_IMPORT_FILE])
  assert.equal(r.status, 0, 'Button 不在共享登录组件清单,即使 t={t} 也不算 bug')
})

test('CLI 集成:目录扫描(混合 bug + pass 文件)→ exit 1(因 bug.tsx 命中)', () => {
  const r = runScript([TMP_DIR])
  assert.equal(r.status, 1, `目录含 bug 文件应 exit 1\nstdout: ${r.out}\nstderr: ${r.err}`)
  const combined = r.out + r.err
  assert.match(combined, /bug\.tsx/, '报告应包含 bug.tsx')
})

test('CLI 集成:--help → exit 0 + 输出用法', () => {
  const r = runScript(['--help'])
  assert.equal(r.status, 0)
  assert.match(r.out, /用法/)
})

// 清理临时目录(任务完成后)
test('cleanup: 删除临时目录', () => {
  try {
    rmSync(TMP_DIR, { recursive: true, force: true })
  } catch {
    // 忽略清理失败
  }
})
