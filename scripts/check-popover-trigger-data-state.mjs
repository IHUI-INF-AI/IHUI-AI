#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 自写 popover trigger data-state 守门(2026-09-02 立)
 *
 * 背景:
 *   globals.css:1090 写了 `button[data-state='closed']:focus-visible { box-shadow: none }`
 *   抑制 Radix trigger 关闭后的焦点环,但**只命中带 `data-state="closed"` 的 button**。
 *   自写 popover(`useState + createPortal` 而非 Radix)trigger 上**没有** `data-state` 属性,
 *   规则完全不命中 → 关闭面板后 useEffect 把焦点归还到 trigger,2px focus-visible:ring-2
 *   会常驻显示(用户报告:PermissionHistoryPanel 时钟图标按钮常驻边框)。
 *
 *   修复模式(已落 3 处):trigger 手动加 `data-state={open ? 'open' : 'closed'}`,
 *   复用 globals.css 现有规则,零样式策略外溢。
 *
 * 检测规则:
 *   1. 扫描 apps/web/src 下所有 .tsx 文件
 *   2. 找出含 `createPortal(` 的文件 → 视为自写 popover 候选
 *   3. 跳过含 Radix import(`from '@radix-ui/` 或 `Popover/Dialog/DropdownMenu`)的文件
 *      (Radix trigger 自带 data-state,无需手动加)
 *   4. 检查同一文件内是否含 `data-state` 属性(JSX 字面量或字符串)
 *      - 有 → 通过(已按规范治理)
 *      - 无 → 警告(WARN,非阻塞)+ 列出修复指引
 *
 * 模式:
 *   默认:全量扫描,无违规 exit 0;有违规 WARN(exit 0 但打印修复清单)
 *   --staged:pre-commit 模式,新增违规则 exit 1(已在全量报过的豁免)
 *
 * 跳过:HUSKY_SKIP_POPOVER_DATA_STATE=1 git commit ...
 */
import { execSync } from 'node:child_process'
import { readFileSync, statSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { withExcludes } from './lib/exclude-dirs.mjs'
import { COLORS as C } from './lib/logger.mjs'

const ROOT = process.cwd()
const SCAN_DIR = join(ROOT, 'apps', 'web', 'src')
const isStaged = process.argv.includes('--staged')
const isHelp = process.argv.includes('--help')

if (process.env.HUSKY_SKIP_POPOVER_DATA_STATE === '1') {
  console.log('⏭  popover trigger data-state 守门(HUSKY_SKIP_POPOVER_DATA_STATE=1, 跳过)')
  process.exit(0)
}

if (isHelp) {
  console.log(`
check-popover-trigger-data-state.mjs — 自写 popover trigger data-state 守门

用法:
  node scripts/check-popover-trigger-data-state.mjs              全量扫描(exit 0 + WARN 报告)
  node scripts/check-popover-trigger-data-state.mjs --staged     pre-commit 模式(新增违规 exit 1)
  node scripts/check-popover-trigger-data-state.mjs --help       显示本帮助

判定:
  - 含 createPortal + 无 data-state + 无 Radix import → 警告(WARN,告知需治理)
  - 含 createPortal + 无 data-state + 有 triggerRef.current?.focus()(关闭时归还焦点)
    → 阻塞(BLOCKING,典型的 PermissionHistoryPanel 类反模式)

修复指引:
  trigger 按钮上加 data-state={open ? 'open' : 'closed'} 即可复用
  globals.css:1090 的 box-shadow 清除规则。

  若 trigger 已在父级声明 focus-visible:ring-* 但仍常驻显示,99% 是缺此属性。
`)
  process.exit(0)
}

const EXCLUDE_DIRS = withExcludes([
  // 测试文件不需要 popover 治理
  'tests',
  '__tests__',
  'e2e',
])

/**
 * 递归扫描目录,返回所有 .tsx 文件路径(相对 ROOT)
 * @param {string} dir
 * @returns {string[]}
 */
function walkTsx(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (EXCLUDE_DIRS.has(ent.name)) continue
      out.push(...walkTsx(join(dir, ent.name)))
    } else if (ent.isFile() && ent.name.endsWith('.tsx')) {
      out.push(join(dir, ent.name))
    }
  }
  return out
}

/**
 * 判断文件是否"安全"(已合规或不需要治理)
 * @param {string} content
 * @returns {{safe: boolean, reason: 'radix'|'has-data-state'|'no-portal'|'needs-fix', hasFocusReturn: boolean}}
 */
function classifyFile(content) {
  // 1. 没有 createPortal → 不是自写 popover
  if (!/createPortal\s*\(/.test(content)) {
    return { safe: true, reason: 'no-portal', hasFocusReturn: false }
  }
  // 2. 含 Radix import → trigger 自动带 data-state
  if (/from\s+['"]@radix-ui\//.test(content)) {
    return { safe: true, reason: 'radix', hasFocusReturn: false }
  }
  // 含 Radix-style 组件引用(Popover/DropdownMenu/Dialog 等)→ 也算 Radix 生态
  if (/import\s+.*\s+from\s+['"]@radix-ui\/react-(popover|dialog|dropdown-menu|select|hover-card|context-menu|alert-dialog|tooltip)['"]/.test(content)) {
    return { safe: true, reason: 'radix', hasFocusReturn: false }
  }
  // 2.5 右键菜单(2026-09-02 增补豁免):含 onContextMenu + 无 aria-haspopup/aria-expanded
  // → 不是按钮 trigger 的 popover,而是右键唤起的浮层,无 trigger button 需要 data-state
  if (
    /onContextMenu/.test(content) &&
    !/aria-haspopup=/.test(content) &&
    !/aria-expanded/.test(content)
  ) {
    return { safe: true, reason: 'context-menu', hasFocusReturn: false }
  }
  // 3. 检测是否有关闭时归还焦点的模式
  const hasFocusReturn =
    /triggerRef\.current\?\.focus\(\)/.test(content) ||
    /trigger\.current\?\.focus\(\)/.test(content) ||
    /\bref\.current\?\.focus\(\)/.test(content)
  // 4. 检查是否含 data-state 属性(JSX `data-state={...}` 裸标识符或字符串字面量都算)
  if (/\bdata-state\s*=/.test(content)) {
    return { safe: true, reason: 'has-data-state', hasFocusReturn }
  }
  return { safe: false, reason: 'needs-fix', hasFocusReturn }
}

const files = walkTsx(SCAN_DIR)
const violations = [] // {path, hasFocusReturn}
const scanned = []

for (const filePath of files) {
  const rel = relative(ROOT, filePath)
  let content
  try {
    content = readFileSync(filePath, 'utf8')
  } catch (e) {
    continue
  }
  const result = classifyFile(content)
  if (result.reason === 'no-portal') continue
  scanned.push(rel)
  if (!result.safe) {
    violations.push({
      path: rel,
      hasFocusReturn: result.hasFocusReturn,
    })
  }
}

if (violations.length === 0) {
  console.log(
    `${C.green}✅ 自写 popover trigger data-state 守门通过${C.reset} ` +
      `(扫描 ${scanned.length} 个含 createPortal 的文件,0 违规)`,
  )
  process.exit(0)
}

// 区分 BLOCKING(高危:含 triggerRef.focus 模式)vs WARN(低危)
const blocking = violations.filter((v) => v.hasFocusReturn)
const warning = violations.filter((v) => !v.hasFocusReturn)

if (blocking.length > 0) {
  console.error(
    `\n${C.red}❌ 自写 popover trigger data-state 守门 — 发现 ${blocking.length} 个高危违规(关闭时归还焦点 + 缺 data-state):${C.reset}\n`,
  )
  for (const v of blocking) {
    console.error(`  ${C.red}BLOCKING${C.reset}  ${v.path}`)
  }
  console.error(
    `\n${C.yellow}典型反模式:${C.reset} PermissionHistoryPanel 时钟图标常驻边框(2026-09-02 用户报告)`,
  )
  console.error(
    `${C.yellow}        关闭 popover 后 triggerRef.current?.focus() 归还焦点,触发 focus-visible:ring-2 常驻显示${C.reset}`,
  )
  console.error(
    `${C.yellow}修复方法:${C.reset} trigger 按钮上加 data-state={open ? 'open' : 'closed'}\n`,
  )
}

if (warning.length > 0) {
  console.error(
    `\n${C.yellow}⚠️  发现 ${warning.length} 个低危文件(自写 popover 但未检到 triggerRef.focus 模式,建议补 data-state 防御):${C.reset}\n`,
  )
  for (const v of warning) {
    console.error(`  ${C.yellow}WARN${C.reset}     ${v.path}`)
  }
}

if (blocking.length > 0) {
  console.error(`\n${C.bold}跳过方法(紧急):${C.reset} HUSKY_SKIP_POPOVER_DATA_STATE=1 git commit ...\n`)
  process.exit(1)
}

// 只有 WARN 时 exit 0(给老代码过渡期)
console.log(
  `\n${C.yellow}⚠️  全量模式仅警告(exit 0),建议在新代码中预防${C.reset}`,
)
process.exit(0)
