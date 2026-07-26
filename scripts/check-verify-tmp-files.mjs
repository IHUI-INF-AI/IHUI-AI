#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * check-verify-tmp-files.mjs — verify-*.mjs / verify-*.ts 临时文件归档守门
 * (AGENTS.md §25 配套)
 *
 * 背景(2026-07-26 立):
 *   Agent 在调试 / 验证 / 探查某项功能时,常在 apps 下各端(apps/web, apps/api)的
 *   源码根目录随手写 verify-xxx.mjs 脚本(verify-permission-popover-v2.mjs,
 *   verify-permission-popover-v3.mjs, verify-login-tabs.mjs),git status
 *   会显示为 untracked,极易被误 commit 污染 main 分支。
 *
 * 检查项:
 *   1. apps 下各端根目录的 verify-*.mjs / verify-*.ts(主项):扫描源码区所有 verify-*.* 文件
 *      - 命中 → 警告 + 建议移动到 .trae-cn/tmp 任务名子目录
 *   2. scripts 下的 verify-*.mjs(豁免区):scripts 下正式守门脚本(必须 verify-* 前缀)
 *      - 豁免白名单:有 README/CLI/help 的正式工具
 *   3. apps 各端的 __tests__ 目录 / tests 目录 / spec 目录下的 verify-*:测试文件豁免
 *
 * 退出码:
 *   0 — 通过(可能有警告,默认 warn-only 不阻断)
 *   1 — --strict 模式下有警告 → 阻断
 *
 * 用法:
 *   node scripts/check-verify-tmp-files.mjs
 *   node scripts/check-verify-tmp-files.mjs --strict
 *
 * 集成位置: CI / guardian-runner 后续项(暂 warn-only)
 * 历史案例: 见 .trae-cn/archive/AGENTS_history.md §25
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

const ROOT = resolve(process.cwd())
// 只扫描源码区,跳过产物/依赖/审计
const SCAN_ROOTS = ['apps']
// 排除目录(产物/依赖/版本控制/审计)
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  '.output',
  'dist',
  'build',
  'coverage',
  '.trae-cn',
  '.git',
  '.swc',
  '.cache',
  '.pnpm-store',
  '.husky',
  'storybook-static',
  '.vercel',
  '.nitro',
  '.angular',
  '__pycache__',
])
// 隐藏目录白名单
const ALLOWED_DOT_DIRS = new Set([
  '.vscode',
  '.idea',
  '.git',
  '.github',
  '.husky',
  '.changeset',
  '.vs',
])
// 测试目录白名单(verify-*.test.ts 命名不算临时文件)
const TEST_DIR_NAMES = new Set(['__tests__', 'tests', 'test', 'spec'])
// 文件扩展名匹配
const VERIFY_FILE_RE = /^verify-.+\.(mjs|cjs|js|ts|tsx|jsx)$/i

function header(label) {
  return `\n${C.cyan}${C.bold}── ${label} ──${C.reset}`
}

/**
 * 递归扫描目录,返回所有匹配 verify-*.ext 的文件相对路径
 * @param {string} root 扫描根目录(绝对路径)
 * @param {string[]} roots 根路径前缀列表(用于判断是否在 apps/* 而非 scripts/)
 */
function findVerifyFiles(root) {
  const results = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const name = entry.name
      const full = join(dir, name)
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.has(name)) continue
        if (name.startsWith('.') && !ALLOWED_DOT_DIRS.has(name)) continue
        // 测试目录豁免:__tests__/tests/spec 下的 verify-*.test.ts 是合法测试文件
        if (TEST_DIR_NAMES.has(name)) continue
        stack.push(full)
        continue
      }
      if (!entry.isFile()) continue
      if (!VERIFY_FILE_RE.test(name)) continue
      results.push(full)
    }
  }
  return results
}

function toRel(absPath) {
  return relative(ROOT, absPath).split(sep).join('/')
}

function main() {
  const isStrict = process.argv.includes('--strict')

  console.log(`${C.cyan}${C.bold}🛡️  verify-*.mjs / verify-*.ts 临时文件归档守门(AGENTS.md §25 配套)${C.reset}`)
  console.log(`${C.dim}扫描根: ${ROOT}${C.reset}`)
  console.log(`${C.dim}扫描范围: ${SCAN_ROOTS.join(', ')}${C.reset}`)

  const issues = []
  let totalScanned = 0

  // ── 1. apps/*/verify-*.* 主项 ──
  console.log(header('1. apps/*/verify-*.mjs / verify-*.ts 扫描'))
  for (const r of SCAN_ROOTS) {
    const abs = join(ROOT, r)
    if (!existsSync(abs)) continue
    const files = findVerifyFiles(abs)
    totalScanned += files.length
    if (files.length === 0) {
      console.log(`  ${C.green}✅${C.reset} ${C.dim}${r}/${C.reset} 无 verify-*.{mjs,ts} 临时文件${C.reset}`)
    } else {
      console.log(`  发现 ${C.bold}${files.length}${C.reset} 个 verify-*.{mjs,ts} 临时文件,逐个核对…`)
      for (const file of files) {
        const rel = toRel(file)
        issues.push({
          level: 'warn',
          path: rel,
          reason: 'verify-*.* 临时文件位于 apps/* 根目录,易被误 commit 污染 main',
          fix: `移动到 ${C.cyan}.trae-cn/tmp/<任务名>/${C.reset}(如 .trae-cn/tmp/perm-popover-debug/${rel.split('/').pop()})`,
        })
        console.log(`  ${C.yellow}⚠${C.reset} ${C.bold}${rel}${C.reset}  ${C.yellow}[WARN]${C.reset}`)
      }
    }
  }

  // ── 2. 综合判定 ──
  console.log(header('2. 综合判定'))
  const warnIssues = issues.filter((i) => i.level === 'warn')
  const blockIssues = issues.filter((i) => i.level === 'block')

  console.log(`  扫描总数: ${C.bold}${totalScanned}${C.reset}`)
  console.log(`  阻断项: ${C.red}${C.bold}${blockIssues.length}${C.reset}`)
  console.log(`  警告项: ${C.yellow}${C.bold}${warnIssues.length}${C.reset}`)

  if (blockIssues.length === 0 && warnIssues.length === 0) {
    console.log(`\n  ${C.green}${C.bold}✅ 所有 verify-*.{mjs,ts} 临时文件均已归档${C.reset}`)
    process.exit(0)
  }

  if (warnIssues.length > 0) {
    console.log(`\n${C.yellow}${C.bold}⚠️  发现 ${warnIssues.length} 个警告项:${C.reset}`)
    for (const it of warnIssues) {
      console.log(`  ${C.yellow}⚠${C.reset} ${C.bold}${it.path}${C.reset}`)
      console.log(`     ${C.dim}原因:${C.reset} ${it.reason}`)
      console.log(`     ${C.dim}修复:${C.reset} ${it.fix}`)
    }
  }

  if (blockIssues.length > 0) {
    console.log(`\n${C.red}${C.bold}❌ 发现 ${blockIssues.length} 个阻断项:${C.reset}`)
    for (const it of blockIssues) {
      console.log(`  ${C.red}✗${C.reset} ${C.bold}${it.path}${C.reset}`)
      console.log(`     ${C.dim}原因:${C.reset} ${it.reason}`)
      console.log(`     ${C.dim}修复:${C.reset} ${it.fix}`)
    }
  }

  if (isStrict && warnIssues.length > 0) {
    console.log(`\n${C.yellow}💡 --strict 模式下警告项视为阻断,请人工复核${C.reset}`)
    process.exit(1)
  }

  console.log(`\n${C.yellow}💡 建议(AGENTS.md §25):${C.reset}`)
  console.log(`   1. 把 ${C.cyan}apps/*/verify-*.mjs${C.reset} 移到 ${C.cyan}.trae-cn/tmp/<任务名>/${C.reset}`)
  console.log(`   2. 详细规则见 ${C.cyan}AGENTS.md §25${C.reset}`)
  console.log(`   3. ${C.dim}默认 warn-only 不阻断,加 ${C.reset}${C.cyan}--strict${C.reset}${C.dim} 启用阻断模式${C.reset}`)

  console.log(`\n${C.green}✅ 阻断项 0,警告项已提示(不阻塞,默认 warn-only)${C.reset}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
  console.error(e?.stack ?? '(no stack)')
  process.exit(2)
})
