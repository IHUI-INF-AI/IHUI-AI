#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-ui-react-usage.mjs — Web 系三端 ui-react 共享组件使用守门
 * (AGENTS.md §3 共享层优先 + P3-2.4 配套)
 *
 * 背景(2026-08-01 立,P3-2.3 阶段):
 *   PageShell/Dialog/Card/Form 等页面级组件已抽到 @ihui/ui-react 共享包,
 *   但端内可能仍有独立实现(旧代码未迁移 / 新代码不知道有共享包)。
 *   本脚本检测端内独立实现,引导使用共享包,防止端内重复实现回升。
 *
 * 检查项:
 *   1. [FAIL] PageShell 独立实现:文件名含 'page-shell' / 'page-layout'
 *      但未 import @ihui/ui-react → 阻塞(应改用共享 PageShell)
 *   2. [WARN] Dialog/Card/Form 独立实现:文件名是 dialog.tsx/card.tsx/form.tsx
 *      或 *-dialog.tsx / *-card.tsx / *-form.tsx 等,且未 import @ihui/ui-react
 *      → 警告(可能有合理场景,如特化变体)
 *
 * 退出码:
 *   0 — 无 FAIL(WARN 不阻塞,除非 --strict)
 *   1 — 有 FAIL(或 --strict 模式下有 WARN)
 *   2 — 脚本执行异常
 *
 * 用法:
 *   node scripts/check-ui-react-usage.mjs              (全量扫描,默认)
 *   node scripts/check-ui-react-usage.mjs --staged      (pre-commit 透传,语义同默认)
 *   node scripts/check-ui-react-usage.mjs --strict      (WARN 也阻塞)
 *
 * 集成位置: CI / guardian-runner 后续项(暂 FAIL-blocking + WARN-only)
 * 历史案例: P3-2.3 PageShell 抽离(2026-08-01)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { withExcludes } from './lib/exclude-dirs.mjs'
import { COLORS as C } from './lib/logger.mjs'

const ROOT = resolve(process.cwd())
// 只扫描 Web 系三端(web + extension + desktop),P3-2 阶段 2 范围
const SCAN_ROOTS = ['apps/web', 'apps/extension', 'apps/desktop']
// 排除目录:构建产物 / 依赖 / 测试 / 脚本子目录
const EXCLUDE_DIRS = withExcludes(['tests', '__tests__', 'e2e', 'scripts'])
// 隐藏目录白名单(允许进入扫描)
const ALLOWED_DOT_DIRS = new Set(['.vscode', '.idea', '.github'])
// @ihui/ui-react import 检测
const UI_REACT_IMPORT_RE = /@ihui\/ui-react/
// PageShell 独立实现:文件名含 page-shell / page-layout(大小写不敏感)
const PAGE_SHELL_FILE_RE = /(page-shell|page-layout)/i
// Dialog/Card 独立实现:文件名是对应组件名或 *-dialog.tsx 等变体
// 注:不含 form — 共享层 @ihui/ui-react 无通用 Form 组件(只有场景化 LoginForm),
// 检测 Form 独立实现是误报。web 端 form/Form.tsx 已作为孤儿代码删除(零引用)。
// 若未来共享层新增 Form 组件,可在此正则重新加回 form。
const DIALOG_CARD_FORM_FILE_RE = /^([a-z0-9]+-)?(dialog|card)\.tsx$/i

/**
 * 递归扫描目录,返回所有 .tsx 文件绝对路径
 * @param {string} root 扫描根目录(绝对路径)
 * @returns {string[]} .tsx 文件绝对路径列表
 */
function findTsxFiles(root) {
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
        stack.push(full)
        continue
      }
      if (!entry.isFile()) continue
      if (!name.endsWith('.tsx')) continue
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

  console.log(`${C.cyan}${C.bold}🛡️  Web 系三端 ui-react 共享组件使用守门(P3-2.4 配套)${C.reset}`)
  console.log(`${C.dim}扫描根: ${ROOT}${C.reset}`)
  console.log(`${C.dim}扫描范围: ${SCAN_ROOTS.join(', ')}${C.reset}`)
  console.log(`${C.dim}模式: ${isStrict ? 'strict(WARN 也阻断)' : '默认(FAIL 阻断, WARN 提示)'}${C.reset}`)

  const fails = []
  const warns = []
  let totalScanned = 0

  for (const r of SCAN_ROOTS) {
    const abs = join(ROOT, r)
    if (!existsSync(abs)) {
      console.log(`  ${C.dim}${r}/ 不存在,跳过${C.reset}`)
      continue
    }
    const files = findTsxFiles(abs)
    totalScanned += files.length

    for (const file of files) {
      const basename = file.split(/[\\/]/).pop()
      let content = ''
      try {
        content = readFileSync(file, 'utf8')
      } catch {
        continue
      }
      const usesShared = UI_REACT_IMPORT_RE.test(content)
      const rel = toRel(file)

      // [FAIL] PageShell 独立实现:文件名含 page-shell/page-layout 但未用共享包
      if (PAGE_SHELL_FILE_RE.test(basename) && !usesShared) {
        fails.push({
          path: rel,
          reason: '文件名含 page-shell/page-layout 但未 import @ihui/ui-react,疑似独立实现 PageShell',
          fix: `改用 ${C.cyan}import { PageShell } from '@ihui/ui-react'${C.reset}`,
        })
        continue
      }

      // [WARN] Dialog/Card/Form 独立实现:文件名是对应组件名但未用共享包
      if (DIALOG_CARD_FORM_FILE_RE.test(basename) && !usesShared) {
        warns.push({
          path: rel,
          reason: '文件名是 dialog/card/form 组件但未 import @ihui/ui-react,疑似独立实现',
          fix: `评估是否可改用 ${C.cyan}@ihui/ui-react${C.reset} 的 Dialog/Card(特化变体可保留)`,
        })
      }
    }
  }

  // ── 综合判定 ──
  console.log(`\n${C.cyan}${C.bold}── 扫描结果 ──${C.reset}`)
  console.log(`  扫描 .tsx 文件总数: ${C.bold}${totalScanned}${C.reset}`)
  console.log(`  FAIL(PageShell 独立实现): ${C.red}${C.bold}${fails.length}${C.reset}`)
  console.log(`  WARN(Dialog/Card/Form 独立实现): ${C.yellow}${C.bold}${warns.length}${C.reset}`)

  if (fails.length > 0) {
    console.log(`\n${C.red}${C.bold}❌ [FAIL] PageShell 独立实现(应改用共享 PageShell):${C.reset}`)
    for (const it of fails) {
      console.log(`  ${C.red}[FAIL]${C.reset} ${C.bold}${it.path}${C.reset}`)
      console.log(`     ${C.dim}原因:${C.reset} ${it.reason}`)
      console.log(`     ${C.dim}修复:${C.reset} ${it.fix}`)
    }
  }

  if (warns.length > 0) {
    console.log(`\n${C.yellow}${C.bold}⚠️  [WARN] Dialog/Card/Form 独立实现(可能有合理场景):${C.reset}`)
    for (const it of warns) {
      console.log(`  ${C.yellow}[WARN]${C.reset} ${C.bold}${it.path}${C.reset}`)
      console.log(`     ${C.dim}原因:${C.reset} ${it.reason}`)
      console.log(`     ${C.dim}修复:${C.reset} ${it.fix}`)
    }
  }

  if (fails.length === 0 && warns.length === 0) {
    console.log(`\n  ${C.green}${C.bold}✅ [PASS] Web 系三端未发现独立实现 PageShell/Dialog/Card/Form${C.reset}`)
    process.exit(0)
  }

  if (fails.length > 0) {
    console.log(`\n${C.red}❌ 存在 FAIL,exit 1${C.reset}`)
    process.exit(1)
  }

  if (isStrict && warns.length > 0) {
    console.log(`\n${C.red}❌ --strict 模式下 WARN 也阻断,exit 1${C.reset}`)
    process.exit(1)
  }

  console.log(`\n${C.green}✅ [PASS] 无 FAIL(WARN 为提示,不阻塞)${C.reset}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
  console.error(e?.stack ?? '(no stack)')
  process.exit(2)
})
