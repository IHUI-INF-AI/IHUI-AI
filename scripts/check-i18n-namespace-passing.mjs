#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-i18n-namespace-passing.mjs — 防止 useTranslations('xxx') 限定命名空间后把 t 传给共享登录组件
 *
 * 背景(2026-07-27 立):
 *   apps/web/src/components/login/LoginFormContent.tsx 曾用 useTranslations('auth') 限定命名空间,
 *   把 t 传给共享 @ihui/ui-react.LoginForm,但共享 LoginForm 内部调用 t('auth.emailLogin') 长 key 路径,
 *   实际查找 auth.auth.emailLogin 找不到,导致弹窗内全部显示 key 名。
 *   已修复(改用 useTranslations() 无命名空间),但为防止未来复制粘贴复发,新增本守门。
 *
 * 检测规则(3 条全部命中才报错):
 *   1. 文件中有 useTranslations('xxx') 调用(带参数 = 限定命名空间)
 *   2. 文件中有 from '@ihui/ui-react' import,且导入了共享登录组件
 *   3. 文件中有 JSX 属性 t={t} 传给了上述共享组件(varName 匹配 useTranslations 的绑定变量)
 *
 * 共享登录组件清单(8 个,来自 packages/ui-react/src/components/login-form/index.ts):
 *   LoginForm / EmailCodeLoginForm / PhoneCodeLoginForm / PasswordLoginForm /
 *   AgreementCheckbox / AgreementNoticeDialog / ThirdPartyLoginButtons / QrTab
 *
 * 用法:
 *   node scripts/check-i18n-namespace-passing.mjs [--staged] [--help] [path]
 *
 *   --staged  仅检查 staged 的 .tsx 文件(pre-commit 模式)
 *   --help    打印帮助
 *   path      可选,指定文件或目录扫描(默认 apps/web/src/;用于测试临时样本)
 *
 * 退出码:
 *   0  无 bug
 *   1  发现 bug(warn 级别,guardian-runner 不阻塞 commit)
 *
 * 已知限制:
 *   - JSX 检测用正则,不能解析 `{cond ? <A /> : <B />}` 表达式内的 `<` `>` 符号;
 *     若共享组件的 t prop 出现在含嵌套 JSX 的表达式之后,可能漏报(实际登录组件 props 不含嵌套 JSX,影响可忽略)。
 *   - 仅检测字面量命名空间 useTranslations('xxx'),不检测动态命名空间 useTranslations(varName)。
 *
 * 守门集成:guardian-runner.mjs id=2g-web(warn 模式)
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

const ROOT = path.resolve(import.meta.dirname, '..')
const WEB_SRC = path.join(ROOT, 'apps/web/src')

// 共享登录组件清单(packages/ui-react/src/components/login-form/index.ts)
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

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  'tests',
  '__tests__',
])

// 匹配 const/let/var <varName> = useTranslations('<ns>')
// 仅匹配带参数形式(限定命名空间);无参数形式 useTranslations() 是正确用法,不匹配
const NS_HOOK_RE =
  /(?:const|let|var)\s+(\w+)\s*=\s*useTranslations\(\s*['"]([^'"]+)['"]\s*\)/g

// 匹配 import { A, B as C, ... } from '@ihui/ui-react'(单行)
const UI_REACT_IMPORT_RE = /import\s+\{([^}]+)\}\s+from\s+['"]@ihui\/ui-react['"]/

function collectTsxFiles(dir, result = []) {
  if (!existsSync(dir)) return result
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectTsxFiles(full, result)
    } else if (entry.endsWith('.tsx')) {
      result.push(full)
    }
  }
  return result
}

function getStagedFiles() {
  try {
    const out = execSync(
      'git -c core.quotepath=false diff --cached --name-only --diff-filter=ACMR',
      { cwd: ROOT, encoding: 'utf8' },
    )
    return out.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

/**
 * 解析 import { A, B as C } from '@ihui/ui-react'
 * 返回导入到本地的组件名集合(处理 type 前缀与 as 别名)
 */
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

/**
 * 提取所有 useTranslations('xxx') 的 (varName, namespace) 对
 */
function extractNamespaceHooks(src) {
  const pairs = []
  NS_HOOK_RE.lastIndex = 0
  let m
  while ((m = NS_HOOK_RE.exec(src)) !== null) {
    pairs.push({ varName: m[1], ns: m[2] })
  }
  return pairs
}

/**
 * 检测 <ComponentName ... t={varName} ...> JSX 模式
 * 用 [^<>] 限定在单个 JSX 开标签内(不跨子元素 / 不跨闭合 >)
 * 支持多行属性(换行属 [^<>] 字符类,默认匹配)
 */
function findTPropUsage(src, compName, varName) {
  const escapedVar = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `<${compName}\\b[^<>]*?\\bt\\s*=\\s*\\{\\s*${escapedVar}\\s*\\}`,
  )
  return re.test(src)
}

function scanFile(filePath) {
  let src
  try {
    src = readFileSync(filePath, 'utf8')
  } catch {
    return []
  }
  const hooks = extractNamespaceHooks(src)
  if (hooks.length === 0) return []
  const imports = parseUiReactImports(src)
  if (imports.size === 0) return []
  const sharedUsed = [...imports].filter((n) =>
    SHARED_LOGIN_COMPONENTS.has(n),
  )
  if (sharedUsed.length === 0) return []

  const bugs = []
  for (const { varName, ns } of hooks) {
    for (const compName of sharedUsed) {
      if (findTPropUsage(src, compName, varName)) {
        bugs.push({ varName, ns, compName })
      }
    }
  }
  return bugs
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('用法: node scripts/check-i18n-namespace-passing.mjs [--staged] [--help]')
    console.log('')
    console.log("检测 useTranslations('xxx') 限定命名空间 + 把 t 传给 @ihui/ui-react 共享登录组件的 bug")
    console.log('共享组件清单:' + [...SHARED_LOGIN_COMPONENTS].join(' / '))
    console.log('退出码:0 无 bug / 1 发现 bug(warn 级别,不阻塞 commit)')
    process.exit(0)
  }

  const isStaged = args.includes('--staged')
  // 可选位置参数:指定文件或目录扫描(测试用,默认 apps/web/src/)
  const positional = args.find((a) => !a.startsWith('-'))
  let files
  if (isStaged) {
    const staged = getStagedFiles()
    files = staged
      .filter((f) => f.startsWith('apps/web/src/') && f.endsWith('.tsx'))
      .map((f) => path.join(ROOT, f))
      .filter((f) => existsSync(f))
  } else if (positional) {
    const target = path.resolve(positional)
    if (!existsSync(target)) {
      console.log(`${C.dim}ℹ️  check-i18n-namespace: 路径不存在 ${positional},跳过${C.reset}`)
      process.exit(0)
    }
    if (statSync(target).isDirectory()) {
      files = collectTsxFiles(target)
    } else if (target.endsWith('.tsx')) {
      files = [target]
    } else {
      files = []
    }
  } else {
    files = collectTsxFiles(WEB_SRC)
  }

  if (files.length === 0) {
    console.log(`${C.dim}ℹ️  check-i18n-namespace: 无目标文件,跳过${C.reset}`)
    process.exit(0)
  }

  const violations = []
  for (const f of files) {
    const bugs = scanFile(f)
    if (bugs.length > 0) {
      violations.push({ file: path.relative(ROOT, f), bugs })
    }
  }

  if (violations.length === 0) {
    console.log(
      `${C.green}✅${C.reset} check-i18n-namespace: ${files.length} 个文件无命名空间传递 bug`,
    )
    process.exit(0)
  }

  const totalBugs = violations.reduce((s, v) => s + v.bugs.length, 0)
  console.log(
    `${C.yellow}⚠️  check-i18n-namespace: 发现 ${C.bold}${totalBugs}${C.reset}${C.yellow} 处命名空间传递 bug(共 ${violations.length} 个文件)${C.reset}`,
  )
  console.log(
    `   ${C.dim}useTranslations('xxx') 限定命名空间后,t('auth.emailLogin') 会查找 xxx.auth.emailLogin 失败${C.reset}`,
  )
  console.log('')
  for (const v of violations) {
    console.log(`   ${C.bold}${v.file}${C.reset}:`)
    for (const b of v.bugs) {
      console.log(
        `     ${C.cyan}useTranslations('${b.ns}')${C.reset} → ${C.yellow}<${b.compName} t={${b.varName}} />${C.reset}`,
      )
    }
  }
  console.log('')
  console.log(
    `   ${C.cyan}修复:${C.reset}把 useTranslations('${violations[0].bugs[0].ns}') 改为 useTranslations()(无命名空间),`,
  )
  console.log(
    `   ${C.dim}让 t 能解析共享组件内部的长 key 路径(如 auth.emailLogin)${C.reset}`,
  )
  process.exit(1)
}

main().catch((e) => {
  console.error(
    `${C.red}❌ check-i18n-namespace 脚本执行异常:${C.reset}`,
    e?.message ?? e,
  )
  console.error(e?.stack ?? '(no stack)')
  process.exit(2)
})
